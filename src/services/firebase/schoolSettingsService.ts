import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { SchoolSettings } from '../../types';
import { LobbyTvConfig, sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { LocationService, type LocationCoordinates } from '../location/locationService';

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
    const snap = await getDocFromServer(doc(db, 'settings', 'school_config'));
    return snap.exists() ? { ...snap.data(), id: snap.id } as SchoolSettings : null;
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
        !LOCATION_KEYS.includes(key) && !['id', 'updatedAt'].includes(key) && value !== undefined));
      transaction.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      // Profile save always preserves the latest saved coordinates, including another admin's update.
      expected = { ...current, ...patch } as SchoolSettings;
    });
    return this.receipt(expected);
  }

  /**
   * Authoritative Lobby TV configuration persistence in settings/school_config.
   * Enforces server-side administrator role verification at the storage layer.
   */
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

    return this.receipt(expected);
  }
}
