import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ScheduleItem, UserProfile } from '../../types';
import { dutyCoverageId, getEffectiveSchedulesOnDate, isScheduleOnDate } from '../../utils/scheduleUtils';
import { getTodayISODate } from '../../utils/dateUtils';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export interface DutyCoverageInput {
  source: ScheduleItem;
  dateISO: string;
  reason: string;
  replacementUserId: string;
  actorName: string;
  allSchedules: ScheduleItem[];
  users: UserProfile[];
}

export function validateDutyCoverage(input: DutyCoverageInput, users: UserProfile[]) {
  const { source, dateISO, reason, replacementUserId, allSchedules } = input;
  if (!datePattern.test(dateISO) || dateISO !== getTodayISODate() || Number.isNaN(Date.parse(`${dateISO}T12:00:00+07:00`))) {
    throw new Error('Tanggal penggantian tidak valid.');
  }
  if (source.coverageForScheduleId || source.status === 'DIBATALKAN' || !isScheduleOnDate(source, dateISO)) {
    throw new Error('Pilih jadwal aktif asli yang berlaku pada tanggal ini.');
  }
  if (reason.trim().length < 10 || reason.trim().length > 500) {
    throw new Error('Keterangan berhalangan wajib 10–500 karakter.');
  }
  if (!replacementUserId) return null; // Pending substitute is explicitly allowed.
  if (replacementUserId === source.petugasId) throw new Error('Guru pengganti tidak boleh sama dengan guru berhalangan.');
  const user = users.find(u => u.id === replacementUserId && u.isActive === true && u.requiresActivation !== true);
  if (!user || !['GURU', 'TENAGA_KEPENDIDIKAN', 'ADMIN', 'KEPALA_SEKOLAH'].includes(user.role)) {
    throw new Error('Pilih pengguna aktif yang diperbolehkan bertugas piket.');
  }
  const effective = getEffectiveSchedulesOnDate(allSchedules, dateISO);
  const existing = effective.find(s => s.petugasId === replacementUserId &&
    s.id !== dutyCoverageId(dateISO, source.id) && s.jamMulai < source.jamSelesai && source.jamMulai < s.jamSelesai);
  if (existing) throw new Error(`Guru pengganti sudah mempunyai jadwal bentrok di ${existing.ruangName} (${existing.jamMulai}–${existing.jamSelesai}).`);
  return user;
}

/** Writes the one-day override + audit atomically. Only ADMIN is allowed by Firestore Rules. */
export class DutyCoverageService {
  static async save(input: DutyCoverageInput): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sesi administrator tidak tersedia.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Perubahan jadwal mendadak membutuhkan koneksi internet.');
    const { source, dateISO, replacementUserId } = input;
    const sourceRef = doc(db, 'schedules', source.id);
    const overrideRef = doc(db, 'schedules', dutyCoverageId(dateISO, source.id));
    const adminRef = doc(db, 'users', uid);
    const replacementRef = replacementUserId ? doc(db, 'users', replacementUserId) : null;
    const auditId = `audit-duty-cover-${crypto.randomUUID()}`;
    const auditRef = doc(db, 'auditLogs', auditId);
    const originalAttendanceRef = doc(db, 'attendance', `att-${dateISO}-${source.petugasId}`);

    // Preliminary conflict protection; live Firestore transaction will re-read identities and current override.
    validateDutyCoverage(input, input.users);
    await runTransaction(db, async tx => {
      const [adminSnap, originalSnap, oldOverrideSnap, originalAttendance, substituteSnap] = await Promise.all([
        tx.get(adminRef), tx.get(sourceRef), tx.get(overrideRef), tx.get(originalAttendanceRef),
        replacementRef ? tx.get(replacementRef) : Promise.resolve(null),
      ]);
      if (auth.currentUser?.uid !== uid) throw new Error('Sesi pengguna berubah. Silakan buka kembali dialog.');
      if (!adminSnap.exists() || adminSnap.data().role !== 'ADMIN' || adminSnap.data().isActive !== true || adminSnap.data().requiresActivation === true) {
        throw new Error('Hanya administrator aktif yang dapat mengganti guru piket.');
      }
      if (!originalSnap.exists()) throw new Error('Jadwal asli tidak ditemukan. Muat ulang halaman.');
      const original = { id: originalSnap.id, ...originalSnap.data() } as ScheduleItem;
      if (original.updatedAt !== source.updatedAt || original.petugasId !== source.petugasId || original.coverageForScheduleId || !isScheduleOnDate(original, dateISO)) {
        throw new Error('Jadwal asli sudah berubah. Muat ulang dan pilih jadwal terbaru.');
      }
      if (originalAttendance.exists()) throw new Error('Guru asli sudah presensi masuk hari ini. Jangan gunakan penggantian mendadak setelah check-in; hubungi admin untuk penyesuaian terpisah.');
      if (oldOverrideSnap.exists()) {
        const old = oldOverrideSnap.data() as ScheduleItem;
        const seen = input.allSchedules.find(s => s.id === overrideRef.id);
        if (!seen || seen.updatedAt !== old.updatedAt) throw new Error('Penugasan sudah diubah oleh admin lain. Muat ulang dan buka kembali dialog.');
        if (old.coverageForScheduleId !== original.id || old.tanggal !== dateISO) throw new Error('Konflik data penggantian. Muat ulang halaman.');
        if (oldOverrideSnap.data().petugasId !== original.petugasId) {
          const oldAttendance = await tx.get(doc(db, 'attendance', `att-${dateISO}-${old.petugasId}`));
          if (oldAttendance.exists() && (replacementUserId !== old.petugasId || input.reason.trim() !== (old.absenceReason || '').trim())) {
            throw new Error('Pengganti lama sudah presensi. Guru atau alasan penugasan tidak boleh diubah setelah check-in.');
          }
        }
      }
      let substitute: UserProfile | null = null;
      if (replacementUserId) {
        if (!substituteSnap?.exists()) throw new Error('Akun pengganti sudah tidak tersedia.');
        substitute = { id: substituteSnap.id, ...substituteSnap.data() } as UserProfile;
        validateDutyCoverage(input, [substitute]);
      } else {
        validateDutyCoverage(input, []);
      }
      const timestamp = new Date().toISOString();
      const override: ScheduleItem = {
        id: overrideRef.id, tanggal: dateISO, recurrence: 'ONCE', hari: original.hari,
        jamMulai: original.jamMulai, jamSelesai: original.jamSelesai,
        petugasId: substitute?.id || original.petugasId, petugasName: substitute?.fullName || original.petugasName,
        petugasRole: substitute?.role || original.petugasRole,
        ruangId: original.ruangId, ruangName: original.ruangName,
        status: substitute ? 'TERJADWAL' : 'DIBATALKAN',
        keterangan: substitute ? `Pengganti piket mendadak: ${input.reason.trim()}` : `Menunggu pengganti: ${input.reason.trim()}`,
        coverageForScheduleId: original.id,
        absentOfficerId: original.petugasId, absentOfficerName: original.petugasName,
        absenceReason: input.reason.trim(), coverageUpdatedBy: uid,
        dataSource: 'PRODUCTION', isDemo: false,
        createdAt: oldOverrideSnap.exists() ? oldOverrideSnap.data().createdAt || timestamp : timestamp,
        updatedAt: timestamp, updatedBy: uid,
      };
      tx.set(overrideRef, override);
      tx.set(auditRef, {
        id: auditId, timestamp, userId: uid, userName: input.actorName, role: 'ADMIN',
        action: oldOverrideSnap.exists() ? 'UPDATE' : 'CREATE', module: 'SCHEDULES', status: 'SUCCESS',
        recordId: overrideRef.id,
        details: `Penggantian piket tanggal ${dateISO}: ${original.petugasName} berhalangan (${input.reason.trim()}); ${substitute ? `pengganti ${substitute.fullName}` : 'menunggu pengganti'}.`,
      });
    });
  }

  /** Cancels only the day override; never deletes the recurring template. */
  static async restore(override: ScheduleItem, actorName: string): Promise<void> {
    if (override.tanggal !== getTodayISODate()) throw new Error('Hanya penggantian hari ini yang dapat dipulihkan melalui menu ini.');
    const uid = auth.currentUser?.uid;
    if (!uid || !override.coverageForScheduleId) throw new Error('Data penggantian tidak valid.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sambungkan internet sebelum membatalkan.');
    const ref = doc(db, 'schedules', override.id);
    const adminRef = doc(db, 'users', uid);
    const auditId = `audit-duty-cover-${crypto.randomUUID()}`;
    await runTransaction(db, async tx => {
      const [adminSnap, snap, attended] = await Promise.all([
        tx.get(adminRef), tx.get(ref), tx.get(doc(db, 'attendance', `att-${override.tanggal}-${override.petugasId}`)),
      ]);
      if (auth.currentUser?.uid !== uid || !adminSnap.exists() || adminSnap.data().role !== 'ADMIN' || adminSnap.data().isActive !== true || adminSnap.data().requiresActivation === true) throw new Error('Akses admin tidak valid.');
      if (!snap.exists() || snap.data().updatedAt !== override.updatedAt) throw new Error('Data sudah berubah. Muat ulang halaman.');
      if (attended.exists()) throw new Error('Presensi sudah tercatat hari ini. Tidak bisa menghapus penugasan terkait.');
      const timestamp = new Date().toISOString();
      tx.delete(ref);
      tx.set(doc(db, 'auditLogs', auditId), {
        id: auditId, timestamp, userId: uid, userName: actorName, role: 'ADMIN', action: 'DELETE',
        module: 'SCHEDULES', status: 'SUCCESS', recordId: override.id,
        details: `Membatalkan penggantian piket ${override.tanggal}; jadwal rutin ${override.absentOfficerName} dipulihkan.`,
      });
    });
  }
}
