import { sanitizeLoginAppearance, type LoginAppearanceConfig } from '../../types/loginAppearance.types';
import { normalizeLetterhead, validateBrandLogo } from '../../utils/reportBranding';
import type { LetterheadConfig } from '../../types';
import { sanitizeDashboardInfoConfig, type DashboardInfoConfig } from '../../types/dashboardInfo.types';
import { sanitizeNotificationConfig, type NotificationConfig } from '../../types/notification.types';
import { sanitizeAnnouncementConfig, type AnnouncementConfig } from '../../types/announcement.types';
import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { SchoolSettings } from '../../types';
import { LobbyTvConfig, sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { LocationService, type LocationCoordinates } from '../location/locationService';
import { AuditService } from '../audit/auditService';
import { normalizeReportPrint } from '../../utils/operationalReport';
import { normalizeVisitorConfig, type VisitorConfig } from '../../types/visitorConfig.types';
import type { PrintLayoutConfig } from '../../types';
import { createAuthenticatedSession } from './sessionGuard';
import { sanitizeSessionPolicy, type SessionPolicy } from '../../types/sessionPolicy.types';

export interface SchoolSettingsSaveResult {
  settings: SchoolSettings;
  confirmed: boolean;
}
const LOCATION_KEYS = ['schoolLat', 'schoolLng', 'allowedRadiusMeters', 'schoolLocationLocked',
  'schoolLocationSavedAt', 'schoolLocationSavedBy', 'schoolLocationUnlockedAt', 'schoolLocationUnlockedBy'];

export function validateSchoolLocation(settings: Pick<SchoolSettings, 'schoolLat' | 'schoolLng' | 'allowedRadiusMeters'>): void {
  if (!Number.isFinite(settings.schoolLat) || Math.abs(settings.schoolLat) > 90 ||
      !Number.isFinite(settings.schoolLng) || Math.abs(settings.schoolLng) > 180) {
    throw new Error('Latitude harus antara -90 dan 90; longitude harus antara -180 dan 180. Isi angka yang valid.');
  }
  if (!Number.isFinite(settings.allowedRadiusMeters) || settings.allowedRadiusMeters < 10 || settings.allowedRadiusMeters > 1000) {
    throw new Error('Radius presensi harus antara 10 dan 1000 meter.');
  }
}

export function schoolLocationDraftFromGps(position: LocationCoordinates) {
  if (!LocationService.isFreshPosition(position)) throw new Error('Pembacaan GPS tidak valid atau kedaluwarsa. Titik sekolah belum diubah.');
  if (position.accuracy > LocationService.MAX_ATTENDANCE_ACCURACY_METERS) {
    throw new Error(`Akurasi GPS ±${Math.round(position.accuracy)} meter terlalu rendah untuk menetapkan titik sekolah. Koordinat lama dipertahankan. Aktifkan lokasi akurat, coba di area terbuka, atau masukkan titik sekolah yang sudah Anda pastikan.`);
  }
  return { schoolLat: Number(position.latitude.toFixed(6)), schoolLng: Number(position.longitude.toFixed(6)) };
}

/** School location is authoritative in settings/school_config, never in browser storage. */
export class SchoolSettingsService {
  private static actor(userId: string): string {
    if (!auth.currentUser || auth.currentUser.uid !== userId) throw new Error('Sesi administrator tidak sesuai. Silakan masuk kembali.');
    return auth.currentUser.uid;
  }
  public static async load(): Promise<SchoolSettings | null> {
    try {
      const snap = await getDocFromServer(doc(db, 'settings', 'school_config'));
      if (snap.exists()) {
        const data = { ...snap.data(), id: snap.id } as SchoolSettings;
        try {
          localStorage.setItem('piket_guru_school_config', JSON.stringify(data));
        } catch {
          // localStorage non-fatal
        }
        return data;
      }
    } catch {
      // Offline fallback: load from last available localStorage cache
      try {
        const cached = localStorage.getItem('piket_guru_school_config');
        if (cached) {
          return JSON.parse(cached) as SchoolSettings;
        }
      } catch {
        // Cache parse error
      }
    }
    return null;
  }
  private static async receipt(expected: SchoolSettings): Promise<SchoolSettingsSaveResult> {
    try {
      const stored = await this.load();
      if (stored) return { settings: stored, confirmed: true };
    } catch { /* Commit succeeded; do not encourage duplicate writes when readback fails. */ }
    return { settings: expected, confirmed: false };
  }
  public static async saveAndLockLocation(draft: SchoolSettings, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    validateSchoolLocation(draft);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = snap.exists() ? snap.data() as SchoolSettings : null;
      if (current?.schoolLocationLocked === true) {
        throw new Error('Lokasi sekolah sudah dikunci. Muat ulang status; buka kunci terlebih dahulu sebelum mengubah lokasi.');
      }
      const location = { schoolLat: draft.schoolLat, schoolLng: draft.schoolLng,
        allowedRadiusMeters: draft.allowedRadiusMeters, schoolLocationLocked: true,
        schoolLocationSavedAt: serverTimestamp(), schoolLocationSavedBy: uid, updatedAt: serverTimestamp() };
      // Existing profile and work hours are preserved by the location-only button.
      transaction.set(ref, snap.exists() ? location : { ...draft, ...location, id: 'school_config' }, { merge: true });
      expected = { ...(current ?? draft), schoolLat: draft.schoolLat, schoolLng: draft.schoolLng,
        allowedRadiusMeters: draft.allowedRadiusMeters, schoolLocationLocked: true, schoolLocationSavedBy: uid };
      // Expected data does not invent a server timestamp if readback is unavailable.
      delete expected.schoolLocationSavedAt;
    });

    void AuditService.log({
      userId: uid,
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: 'Koordinat GPS Sekolah',
      details: `Menyimpan dan mengunci titik GPS sekolah (${draft.schoolLat.toFixed(6)}, ${draft.schoolLng.toFixed(6)}) dengan radius ${draft.allowedRadiusMeters} meter untuk acuan presensi`,
    });

    return this.receipt(expected);
  }
  public static async unlockLocation(userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Lokasi sekolah belum pernah disimpan.');
      const current = snap.data() as SchoolSettings;
      if (current.schoolLocationLocked !== true) throw new Error('Lokasi sudah terbuka. Muat ulang status sebelum mengedit.');
      transaction.update(ref, { schoolLocationLocked: false, schoolLocationUnlockedAt: serverTimestamp(),
        schoolLocationUnlockedBy: uid, updatedAt: serverTimestamp() });
      expected = { ...current, schoolLocationLocked: false, schoolLocationUnlockedBy: uid };
      delete expected.schoolLocationUnlockedAt;
    });

    void AuditService.log({
      userId: uid,
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: 'Koordinat GPS Sekolah',
      details: 'Membuka kunci koordinat GPS sekolah tanpa mengubah titik tersimpan',
    });

    return this.receipt(expected);
  }
  public static async saveProfile(draft: SchoolSettings, userId: string): Promise<SchoolSettingsSaveResult> {
    this.actor(userId);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Simpan & Kunci Lokasi sekolah terlebih dahulu, lalu simpan perubahan profil.');
      const current = snap.data() as SchoolSettings;
      const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) =>
        !LOCATION_KEYS.includes(key) && !['id', 'updatedAt', 'notificationConfig', 'announcementConfig', 'dashboardInfoConfig', 'sessionPolicy', 'printConfig', 'visitorConfig', 'appLogoUrl', 'letterheadLogoUrl', 'letterheadConfig', 'loginAppearance'].includes(key) && value !== undefined));
      transaction.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      // Profile save always preserves the latest saved coordinates, including another admin's update.
      expected = { ...current, ...patch } as SchoolSettings;
    });

    try {
      localStorage.setItem('piket_guru_school_config', JSON.stringify(expected));
    } catch {
      // Local cache failure non-fatal
    }

    void AuditService.log({
      userId,
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: draft.schoolName || 'Profil Sekolah',
      details: `Memperbarui profil, identitas, dan jam kerja instansi: ${draft.schoolName || ''}`,
    });

    return this.receipt(expected);
  }

  /**
   * Authoritative Lobby TV configuration persistence in settings/school_config.
   * Enforces server-side administrator role verification at the storage layer.
   */
  public static async saveNotificationSettings(config: NotificationConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const userSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!userSnap.exists() || userSnap.data().role !== 'ADMIN' || userSnap.data().isActive !== true) {
      throw new Error('Hanya administrator aktif yang dapat mengubah notifikasi.');
    }
    const notificationConfig = sanitizeNotificationConfig(config);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      expected = { ...snap.data(), notificationConfig } as SchoolSettings;
      // Update only this section; never overwrite another admin's GPS/profile edits.
      transaction.update(ref, { notificationConfig, updatedAt: serverTimestamp() });
    });
    void AuditService.log({ userId: uid, userName: userSnap.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui pengaturan notifikasi realtime sekolah' });
    return this.receipt(expected);
  }

  public static async saveAnnouncementSettings(config: AnnouncementConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const announcementConfig = sanitizeAnnouncementConfig(config);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const [user, school] = await Promise.all([
        transaction.get(doc(db, 'users', uid)), transaction.get(ref),
      ]);
      this.actor(uid);
      if (!user.exists() || user.data().role !== 'ADMIN' || user.data().isActive !== true) {
        throw new Error('Hanya administrator aktif yang dapat mengubah pengaturan pengumuman.');
      }
      if (!school.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      expected = { ...school.data(), announcementConfig } as SchoolSettings;
      transaction.update(ref, { announcementConfig, updatedAt: serverTimestamp() });
    });
    void AuditService.log({ userId: uid, action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui pengaturan edit dan keterangan pembaruan papan pengumuman' });
    return this.receipt(expected);
  }

  public static async saveBrandingSettings(application: string, letterLogo: string, letter: LetterheadConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId), user = await getDocFromServer(doc(db, 'users', uid));
    if (!user.exists() || user.data().role !== 'ADMIN' || user.data().isActive !== true) throw new Error('Hanya administrator aktif yang dapat mengubah logo dan kop surat.');
    const appLogoUrl = validateBrandLogo(application, true), letterheadLogoUrl = validateBrandLogo(letterLogo);
    const letterheadConfig = normalizeLetterhead(letter), ref = doc(db, 'settings', 'school_config');
    if (!letterheadConfig.schoolName) throw new Error('Nama sekolah pada kop wajib diisi.');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref); if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      expected = { ...snap.data(), appLogoUrl, letterheadLogoUrl, letterheadConfig } as SchoolSettings;
      transaction.update(ref, { appLogoUrl, letterheadLogoUrl, letterheadConfig, updatedAt: serverTimestamp() });
    });
    void AuditService.log({ userId: uid, userName: user.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui logo aplikasi, logo kop dan format kop surat' });
    return this.receipt(expected);
  }

  public static async saveOperationalReportSettings(print: PrintLayoutConfig, visitor: VisitorConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId), user = await getDocFromServer(doc(db, 'users', uid));
    if (!user.exists() || user.data().role !== 'ADMIN' || user.data().isActive !== true) throw new Error('Hanya administrator aktif yang dapat mengubah pengaturan cetak dan buku tamu.');
    const printConfig = normalizeReportPrint(print), visitorConfig = normalizeVisitorConfig(visitor), ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref); if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      expected = { ...snap.data(), printConfig, visitorConfig } as SchoolSettings;
      transaction.update(ref, { printConfig, visitorConfig, updatedAt: serverTimestamp() });
    });
    void AuditService.log({ userId: uid, userName: user.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui format cetak laporan operasional dan pilihan tujuan buku tamu' });
    return this.receipt(expected);
  }

  public static async saveLoginAppearanceSettings(config: LoginAppearanceConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const user = await getDocFromServer(doc(db, 'users', uid));
    if (!user.exists() || user.data().role !== 'ADMIN' || user.data().isActive !== true) throw new Error('Hanya administrator aktif yang dapat mengubah tampilan login.');
    const loginAppearance = sanitizeLoginAppearance(config), ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      transaction.update(ref, { loginAppearance, updatedAt: serverTimestamp() });
      expected = { ...snap.data(), loginAppearance } as SchoolSettings;
    });
    void AuditService.log({ userId: uid, userName: user.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui motion background dan teks pengembang halaman login' });
    return this.receipt(expected);
  }

  public static async saveSessionPolicy(config: SessionPolicy, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const session = createAuthenticatedSession(uid);
    try {
      const user = await getDocFromServer(doc(db, 'users', uid));
      session.assertActive();
      if (!user.exists() || user.data().role !== 'ADMIN' || user.data().isActive !== true) throw new Error('Hanya administrator aktif yang dapat mengubah kebijakan sesi.');
      const sessionPolicy = sanitizeSessionPolicy(config);
      const ref = doc(db, 'settings', 'school_config');
      let expected!: SchoolSettings;
      await runTransaction(db, async transaction => {
        const snap = await transaction.get(ref);
        session.assertActive();
        if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
        expected = { ...snap.data(), sessionPolicy } as SchoolSettings;
        transaction.update(ref, { sessionPolicy, updatedAt: serverTimestamp() });
      });
      session.assertActive();
      void AuditService.log({ userId: uid, userName: user.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: `Memperbarui keluar otomatis: ${(['mobile', 'desktop'] as const).map(device => `${device}: ${sessionPolicy[device].backgroundLogoutEnabled ? `ON, jeda ${sessionPolicy[device].backgroundDelaySeconds} detik` : 'OFF'}`).join('; ')}` });
      const result = await this.receipt(expected);
      session.assertActive();
      return result;
    } finally { session.close(); }
  }

  public static async saveDashboardInfoSettings(config: DashboardInfoConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);
    const userSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!userSnap.exists() || userSnap.data().role !== 'ADMIN' || userSnap.data().isActive !== true) {
      throw new Error('Hanya administrator aktif yang dapat mengubah info dashboard.');
    }
    const dashboardInfoConfig = sanitizeDashboardInfoConfig(config);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Simpan profil sekolah terlebih dahulu.');
      expected = { ...snap.data(), dashboardInfoConfig } as SchoolSettings;
      transaction.update(ref, { dashboardInfoConfig, updatedAt: serverTimestamp() });
    });
    void AuditService.log({ userId: uid, userName: userSnap.data().fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'SETTINGS', status: 'SUCCESS', details: 'Memperbarui sapaan, kalimat penyemangat, dan flash info dashboard' });
    return this.receipt(expected);
  }

  public static async saveTvSettings(lobbyTv: LobbyTvConfig, userId: string): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);

    // Storage-layer access control check: verify user exists and holds active ADMIN role
    const userSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      throw new Error('Akses ditolak: Pengguna tidak ditemukan pada database.');
    }
    const userData = userSnap.data();
    if (userData?.role !== 'ADMIN' || userData?.isActive !== true) {
      throw new Error('Akses ditolak: Hanya pengguna dengan hak akses Administrator yang dapat mengubah konfigurasi TV Lobi.');
    }

    const sanitizedTv = sanitizeLobbyTvConfig(lobbyTv);
    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error('Konfigurasi sekolah belum diinisialisasi di server. Simpan profil sekolah terlebih dahulu.');
      }
      const current = snap.data() as SchoolSettings;
      transaction.set(ref, { lobbyTv: sanitizedTv, updatedAt: serverTimestamp() }, { merge: true });
      expected = { ...current, lobbyTv: sanitizedTv } as SchoolSettings;
    });

    try {
      localStorage.setItem('piket_guru_school_config', JSON.stringify(expected));
    } catch {
      // Local cache failure non-fatal
    }

    void AuditService.log({
      userId: uid,
      userName: userData?.fullName || 'Administrator',
      role: 'ADMIN',
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: 'TV Lobi Sekolah',
      details: 'Memperbarui konfigurasi TV Lobi sekolah (layout, pengumuman, dan tampilan monitor)',
    });

    return this.receipt(expected);
  }

  /**
   * Authoritative Student Tardiness configuration persistence in settings/school_config.
   * - Sets student entry limit and tolerance minutes.
   * - Strict ADMIN-only RBAC enforced at the storage/service layer.
   * - Does NOT modify teacher attendance hours or workHours.
   */
  public static async saveStudentTardyConfig(
    tardyConfig: { entryLimit: string; toleranceMinutes: number },
    userId: string
  ): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);

    // Storage-layer access control check: verify user exists and holds active ADMIN role
    const userSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      throw new Error('Akses ditolak: Pengguna tidak ditemukan pada database.');
    }
    const userData = userSnap.data();
    if (userData?.role !== 'ADMIN' || userData?.isActive !== true) {
      throw new Error('Akses ditolak: Hanya pengguna dengan hak akses Administrator yang dapat mengubah Pengaturan Keterlambatan Siswa.');
    }

    const cleanLimit = (tardyConfig.entryLimit || '07:00').trim();
    if (!/^[0-2][0-9]:[0-5][0-9]$/.test(cleanLimit)) {
      throw new Error('Format batas jam masuk siswa harus berupa format jam:menit yang valid (HH:mm, contoh 07:00).');
    }

    const tolerance = Math.max(0, Math.floor(Number(tardyConfig.toleranceMinutes) || 0));
    if (isNaN(tolerance) || tolerance < 0 || tolerance > 120) {
      throw new Error('Toleransi keterlambatan harus berupa bilangan bulat tidak negatif (0 - 120 menit).');
    }

    const payload = {
      entryLimit: cleanLimit,
      toleranceMinutes: tolerance,
      updatedAt: new Date().toISOString(),
      updatedBy: userData?.fullName || 'Administrator',
    };

    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error('Konfigurasi sekolah belum diinisialisasi di server. Simpan profil sekolah terlebih dahulu.');
      }
      const current = snap.data() as SchoolSettings;
      transaction.set(ref, { studentTardyConfig: payload, updatedAt: serverTimestamp() }, { merge: true });
      expected = { ...current, studentTardyConfig: payload } as SchoolSettings;
    });

    try {
      localStorage.setItem('piket_guru_school_config', JSON.stringify(expected));
    } catch {}

    void AuditService.log({
      userId: uid,
      userName: userData?.fullName || 'Administrator',
      role: 'ADMIN',
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: 'Keterlambatan Siswa',
      details: `Memperbarui konfigurasi jam masuk siswa: batas ${cleanLimit}, toleransi ${tolerance} menit`,
    });

    return this.receipt(expected);
  }

  /**
   * Menyimpan konfigurasi Jam Pelajaran (JP) sekolah.
   * Khusus Administrator:
   * - Validasi jam selesai setelah jam mulai
   * - Validasi nomor JP tidak ganda pada jadwal hari yang sama
   * - Validasi interval waktu tidak bertabrakan
   * - Akses dicek di Firestore rules dan backend
   */
  public static async savePeriodScheduleConfig(
    periodConfig: import('../../types/period.types').LessonPeriodConfig,
    userId: string
  ): Promise<SchoolSettingsSaveResult> {
    const uid = this.actor(userId);

    // Storage-layer access control check: verifikasi admin aktif
    const userSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      throw new Error('Akses ditolak: Pengguna tidak ditemukan pada database.');
    }
    const userData = userSnap.data();
    if (userData?.role !== 'ADMIN' || userData?.isActive !== true) {
      throw new Error('Akses ditolak: Hanya pengguna dengan hak akses Administrator yang dapat mengubah Pengaturan Jam Pelajaran (JP).');
    }

    // Validasi aturan JP
    const { validateLessonPeriodConfig } = await import('../../types/period.types');
    const validation = validateLessonPeriodConfig(periodConfig);
    if (!validation.isValid) {
      throw new Error(`Validasi Jam Pelajaran gagal:\n- ${validation.errors.join('\n- ')}`);
    }

    const payload: import('../../types/period.types').LessonPeriodConfig = {
      effectiveDate: periodConfig.effectiveDate.trim(),
      periods: periodConfig.periods.map((p) => ({
        id: p.id || `jp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        periodNumber: Number(p.periodNumber),
        name: p.name?.trim() || `JP ${p.periodNumber}`,
        startTime: p.startTime.trim(),
        endTime: p.endTime.trim(),
        days: p.days,
        effectiveStartDate: p.effectiveStartDate || periodConfig.effectiveDate.trim(),
        isActive: Boolean(p.isActive),
        notes: p.notes?.trim() || '',
      })),
      updatedAt: new Date().toISOString(),
      updatedBy: userData?.fullName || 'Administrator',
    };

    const ref = doc(db, 'settings', 'school_config');
    let expected!: SchoolSettings;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error('Konfigurasi sekolah belum diinisialisasi di server. Simpan profil sekolah terlebih dahulu.');
      }
      const current = snap.data() as SchoolSettings;
      transaction.set(ref, { lessonPeriodConfig: payload, updatedAt: serverTimestamp() }, { merge: true });
      expected = { ...current, lessonPeriodConfig: payload } as SchoolSettings;
    });

    try {
      localStorage.setItem('piket_guru_school_config', JSON.stringify(expected));
    } catch {}

    void AuditService.log({
      userId: uid,
      userName: userData?.fullName || 'Administrator',
      role: 'ADMIN',
      action: 'UPDATE',
      module: 'SETTINGS',
      status: 'SUCCESS',
      target: 'Jam Pelajaran (JP)',
      details: `Memperbarui jadwal jam pelajaran sekolah (${periodConfig.periods.length} JP) berlaku mulai ${periodConfig.effectiveDate}`,
    });

    return this.receipt(expected);
  }
}

