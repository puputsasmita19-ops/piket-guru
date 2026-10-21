import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ScheduleItem } from '../../types';
import { dutyCancellationId, dutyCoverageId, getScheduleRecurrence, isScheduleOnDate } from '../../utils/scheduleUtils';
import { getTodayISODate } from '../../utils/dateUtils';

export type DutyCancellationScope = 'DAY' | 'RECURRING';
export interface DutyCancellationRequest {
  source: ScheduleItem;
  dateISO: string;
  scope: DutyCancellationScope;
  reason: string;
  actorName: string;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00+07:00`)) &&
    new Date(`${value}T12:00:00+07:00`).toISOString().slice(0, 10) === value;
}

export function validateDutyCancellation(input: DutyCancellationRequest): void {
  const { source, dateISO, scope, reason } = input;
  if (source.coverageForScheduleId || source.cancelForScheduleId) throw new Error('Pilih jadwal asli, bukan penugasan pengganti.');
  if (!validDate(dateISO) || dateISO < getTodayISODate()) throw new Error('Pilih tanggal tugas hari ini atau yang akan datang.');
  if (!isScheduleOnDate(source, dateISO)) throw new Error('Jadwal tidak berlaku pada tanggal yang dipilih.');
  if (!reason || reason.trim().length < 10 || reason.trim().length > 500) throw new Error('Alasan pembatalan wajib 10–500 karakter.');
  if (scope === 'RECURRING' && getScheduleRecurrence(source) !== 'WEEKLY') throw new Error('Pembatalan berulang hanya untuk jadwal mingguan.');
}

/** All schedule changes and their audit are atomic. Firestore Rules enforce ADMIN. */
export class DutyCancellationService {
  static async cancel(input: DutyCancellationRequest): Promise<void> {
    validateDutyCancellation(input);
    const uid = auth.currentUser?.uid;
    if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) throw new Error('Sesi admin dan internet aktif diperlukan.');
    const { source, dateISO, scope } = input;
    const sourceRef = doc(db, 'schedules', source.id);
    const dayRef = doc(db, 'schedules', dutyCancellationId(dateISO, source.id));
    const coverageRef = doc(db, 'schedules', dutyCoverageId(dateISO, source.id));
    const attendanceRef = doc(db, 'attendance', `att-${dateISO}-${source.petugasId}`);
    const adminRef = doc(db, 'users', uid);
    const auditId = `audit-duty-cancel-${crypto.randomUUID()}`;
    await runTransaction(db, async tx => {
      const [admin, sourceSnap, daySnap, coverageSnap, attendanceSnap] = await Promise.all([
        tx.get(adminRef), tx.get(sourceRef), tx.get(dayRef), tx.get(coverageRef), tx.get(attendanceRef),
      ]);
      if (auth.currentUser?.uid !== uid || !admin.exists() || admin.data().role !== 'ADMIN' || admin.data().isActive !== true || admin.data().requiresActivation === true) throw new Error('Hanya administrator aktif dapat membatalkan jadwal.');
      if (!sourceSnap.exists()) throw new Error('Jadwal asli sudah tidak tersedia. Muat ulang.');
      const latest = { id: sourceSnap.id, ...sourceSnap.data() } as ScheduleItem;
      if (latest.updatedAt !== source.updatedAt || latest.petugasId !== source.petugasId || !isScheduleOnDate(latest, dateISO)) throw new Error('Jadwal berubah. Muat ulang dahulu.');
      if (attendanceSnap.exists()) throw new Error('Guru sudah presensi pada tanggal ini. Pembatalan tidak diperbolehkan.');
      if (coverageSnap.exists()) throw new Error('Sudah ada penugasan pengganti. Pulihkan penggantian terlebih dahulu.');
      if (daySnap.exists()) throw new Error('Tanggal ini sudah dibatalkan. Perbarui halaman.');
      const timestamp = new Date().toISOString();
      const reason = input.reason.trim();
      if (scope === 'DAY') {
        tx.set(dayRef, {
          ...latest, id: dayRef.id, recurrence: 'ONCE', tanggal: dateISO,
          status: 'DIBATALKAN', cancelForScheduleId: source.id, cancellationReason: reason,
          keterangan: `Pembatalan khusus ${dateISO}: ${reason}`,
          dataSource: 'PRODUCTION', isDemo: false, createdAt: timestamp, updatedAt: timestamp, updatedBy: uid,
        } as ScheduleItem);
      } else {
        tx.update(sourceRef, { status: 'DIBATALKAN', updatedAt: timestamp, updatedBy: uid,
          keterangan: [latest.keterangan || '', `Pembatalan jadwal berulang: ${reason}`].filter(Boolean).join(' · ') });
      }
      tx.set(doc(db, 'auditLogs', auditId), {
        id: auditId, timestamp, userId: uid, userName: input.actorName, role: 'ADMIN', module: 'SCHEDULES',
        status: 'SUCCESS', action: scope === 'DAY' ? 'CREATE' : 'UPDATE', recordId: scope === 'DAY' ? dayRef.id : source.id,
        details: `${scope === 'DAY' ? `Pembatalan khusus ${dateISO}` : 'Pembatalan seluruh jadwal mingguan'}: ${latest.petugasName} (${latest.ruangName}). Alasan: ${reason}`,
      });
    });
  }

  static async restoreDay(dayCancellation: ScheduleItem, actorName: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid || !dayCancellation.cancelForScheduleId || dayCancellation.tanggal < getTodayISODate()) throw new Error('Pembatalan yang sudah berlalu tidak bisa dipulihkan.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Internet diperlukan untuk memulihkan jadwal.');
    const adminRef = doc(db, 'users', uid);
    const cancelRef = doc(db, 'schedules', dayCancellation.id);
    const auditId = `audit-duty-cancel-${crypto.randomUUID()}`;
    await runTransaction(db, async tx => {
      const [admin, snap] = await Promise.all([tx.get(adminRef), tx.get(cancelRef)]);
      if (auth.currentUser?.uid !== uid || !admin.exists() || admin.data().role !== 'ADMIN' || admin.data().isActive !== true || admin.data().requiresActivation === true) throw new Error('Hanya administrator aktif yang dapat memulihkan pembatalan.');
      if (!snap.exists() || snap.data().updatedAt !== dayCancellation.updatedAt || snap.data().cancelForScheduleId !== dayCancellation.cancelForScheduleId) throw new Error('Data pembatalan sudah berubah. Muat ulang.');
      const timestamp = new Date().toISOString();
      tx.delete(cancelRef);
      tx.set(doc(db, 'auditLogs', auditId), { id: auditId, timestamp, userId: uid, userName: actorName, role: 'ADMIN', module: 'SCHEDULES', status: 'SUCCESS', action: 'DELETE', recordId: dayCancellation.id, details: `Memulihkan jadwal ${dayCancellation.petugasName} tanggal ${dayCancellation.tanggal}.` });
    });
  }

  static async restoreRecurring(source: ScheduleItem, actorName: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid || source.status !== 'DIBATALKAN' || getScheduleRecurrence(source) !== 'WEEKLY') throw new Error('Hanya jadwal mingguan yang dibatalkan dapat diaktifkan kembali.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Internet diperlukan untuk memulihkan jadwal.');
    const adminRef = doc(db, 'users', uid);
    const sourceRef = doc(db, 'schedules', source.id);
    const auditId = `audit-duty-cancel-${crypto.randomUUID()}`;
    await runTransaction(db, async tx => {
      const [admin, snap] = await Promise.all([tx.get(adminRef), tx.get(sourceRef)]);
      if (auth.currentUser?.uid !== uid || !admin.exists() || admin.data().role !== 'ADMIN' || admin.data().isActive !== true || admin.data().requiresActivation === true) throw new Error('Hanya administrator aktif yang dapat memulihkan jadwal.');
      if (!snap.exists() || snap.data().updatedAt !== source.updatedAt || snap.data().status !== 'DIBATALKAN') throw new Error('Jadwal sudah berubah. Muat ulang.');
      const timestamp = new Date().toISOString();
      tx.update(sourceRef, { status: 'TERJADWAL', updatedAt: timestamp, updatedBy: uid });
      tx.set(doc(db, 'auditLogs', auditId), { id: auditId, timestamp, userId: uid, userName: actorName, role: 'ADMIN', module: 'SCHEDULES', status: 'SUCCESS', action: 'UPDATE', recordId: source.id, details: `Mengaktifkan kembali jadwal mingguan ${source.petugasName}.` });
    });
  }
}
