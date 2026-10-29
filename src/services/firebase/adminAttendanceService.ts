import { collection, doc, getDocsFromServer, limit, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { getTodayISODate, toEpochMs } from '../../utils/dateUtils';
import { validateMissingCheckoutEvidence, type MissingCheckoutEvidence } from '../../utils/missedCheckoutCorrectionPolicy';

/** Admin corrections are online-only and written with an immutable audit record in the same transaction. */
export interface AttendanceCorrectionInput {
  jamMasuk: string;
  jamPulang: string | null;
  status: AttendanceStatus;
  keteranganCheckout: string;
  alasan: string;
  missingCheckoutEvidence?: MissingCheckoutEvidence;
}

const allowedStatuses: AttendanceStatus[] = ['DALAM_LOKASI', 'DI_LUAR_LOKASI', 'GPS_ERROR', 'AKURASI_RENDAH'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Convert a date + wall clock in WIB to an ISO instant, never through the device timezone. */
export function wibTimeToIso(date: string, time: string): string {
  if (!datePattern.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Format tanggal atau waktu tidak valid.');
  }
  const d = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(d.getTime()) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) !== date) {
    throw new Error('Tanggal dan waktu tidak valid.');
  }
  return d.toISOString();
}

export function isoToWibTime(value: unknown): string {
  const epoch = toEpochMs(value as any);
  return epoch ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(epoch)) : '';
}

/** Publicly typed helper for UI and local automated checks. */
export function validateAttendanceCorrection(record: AttendanceRecord, input: AttendanceCorrectionInput) {
  const alasan = input.alasan.trim();
  if (alasan.length < 10 || alasan.length > 500) throw new Error('Alasan koreksi wajib 10–500 karakter.');
  if (input.keteranganCheckout.length > 500) throw new Error('Keterangan maksimal 500 karakter.');
  if (!allowedStatuses.includes(input.status)) throw new Error('Status presensi tidak valid.');
  const jamMasuk = wibTimeToIso(record.tanggal, input.jamMasuk);
  const jamPulang = input.jamPulang ? wibTimeToIso(record.tanggal, input.jamPulang) : null;
  if (jamPulang && Date.parse(jamPulang) <= Date.parse(jamMasuk)) {
    throw new Error('Waktu pulang harus lebih lambat dari waktu masuk.');
  }
  return { jamMasuk, jamPulang, status: input.status, keteranganCheckout: input.keteranganCheckout.trim(), alasan };
}

function versionMatches(current: AttendanceRecord, expected: AttendanceRecord) {
  return current.userId === expected.userId && current.tanggal === expected.tanggal &&
    toEpochMs(current.jamMasuk) === toEpochMs(expected.jamMasuk) &&
    toEpochMs(current.jamPulang) === toEpochMs(expected.jamPulang) &&
    current.status === expected.status &&
    (current.keteranganCheckout || '') === (expected.keteranganCheckout || '') &&
    toEpochMs(current.updatedAt) === toEpochMs(expected.updatedAt);
}

export class AdminAttendanceService {
  static async change(record: AttendanceRecord, input: AttendanceCorrectionInput, mode: 'edit' | 'delete', actorName: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid || !record.id) throw new Error('Sesi administrator tidak tersedia. Silakan login kembali.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Perubahan hanya dapat dilakukan ketika online.');
    const reason = input.alasan.trim();
    if (reason.length < 10 || reason.length > 500) throw new Error('Alasan wajib diisi (10–500 karakter).');
    if (input.missingCheckoutEvidence) {
      if (mode !== 'edit') throw new Error('Checkout terlewat hanya dapat dikoreksi, bukan dihapus.');
      validateMissingCheckoutEvidence(record, input, input.missingCheckoutEvidence, getTodayISODate());
    }
    const next = mode === 'edit' ? validateAttendanceCorrection(record, input) : null;
    const ref = doc(db, 'attendance', record.id);
    const logId = `audit-attendance-${crypto.randomUUID()}`;
    const logRef = doc(db, 'auditLogs', logId);
    const profileRef = doc(db, 'users', uid);
    await runTransaction(db, async tx => {
      // All reads must precede writes; server rules separately enforce isAdmin().
      const [profileSnap, attendanceSnap] = await Promise.all([tx.get(profileRef), tx.get(ref)]);
      if (auth.currentUser?.uid !== uid) throw new Error('Sesi berubah selama proses koreksi.');
      if (!profileSnap.exists() || profileSnap.data().role !== 'ADMIN' || profileSnap.data().isActive !== true || profileSnap.data().requiresActivation === true) {
        throw new Error('Hanya administrator aktif yang dapat mengubah riwayat presensi.');
      }
      if (!attendanceSnap.exists()) throw new Error('Presensi sudah dihapus oleh pengguna lain. Muat ulang data.');
      const current = { id: attendanceSnap.id, ...attendanceSnap.data() } as AttendanceRecord;
      if (!versionMatches(current, record)) throw new Error('Data presensi telah berubah dari perangkat lain. Tutup dialog lalu buka kembali data terbaru.');
      if (input.missingCheckoutEvidence) {
        validateMissingCheckoutEvidence(current, input, input.missingCheckoutEvidence, getTodayISODate());
      }
      const before = {
        jamMasuk: current.jamMasuk, jamPulang: current.jamPulang || null,
        status: current.status, keteranganCheckout: current.keteranganCheckout || '',
      };
      const timestamp = new Date().toISOString();
      const evidence = input.missingCheckoutEvidence ? {
        channel: input.missingCheckoutEvidence.channel,
        note: input.missingCheckoutEvidence.note.trim(),
        acknowledged: true,
      } : null;
      // A missing-checkout adjustment never overwrites the original check-in or GPS status.
      const after = next ? {
        jamMasuk: evidence ? current.jamMasuk : next.jamMasuk,
        jamPulang: next.jamPulang,
        status: evidence ? current.status : next.status,
        keteranganCheckout: next.keteranganCheckout,
      } : null;
      const correction = { at: timestamp, byId: uid, byName: actorName, reason, before, after,
        source: evidence ? 'MISSING_CHECKOUT' : 'GENERAL', evidence };
      if (next) {
        tx.update(ref, evidence ? {
          // Preserve recorded check-in timestamp precision, GPS status, selfie and coordinates.
          jamPulang: next.jamPulang, keteranganCheckout: next.keteranganCheckout,
          updatedAt: timestamp, adminCorrection: correction,
        } : {
          jamMasuk: next.jamMasuk, jamPulang: next.jamPulang,
          status: next.status, keteranganCheckout: next.keteranganCheckout,
          updatedAt: timestamp, adminCorrection: correction,
        });
      } else {
        tx.delete(ref);
      }
      // Atomic audit is committed even for deletion. Never duplicate the selfie/data URL into an audit document.
      tx.set(logRef, {
        id: logId, timestamp, recordedAt: serverTimestamp(), userId: uid, userName: actorName, role: 'ADMIN',
        action: mode === 'edit' ? 'UPDATE' : 'DELETE', module: 'ATTENDANCE', status: 'SUCCESS', recordId: record.id,
        details: `${mode === 'edit' ? 'Koreksi' : 'Hapus'} riwayat presensi ${current.userName} (${current.tanggal}). Alasan: ${reason}`,
        metadata: {
          attendanceId: record.id, targetUserId: current.userId, targetUserName: current.userName,
          tanggal: current.tanggal, scheduleId: current.scheduleId || null,
          before, after: correction.after, alasan: reason, correctionSource: correction.source,
          missingCheckoutEvidence: evidence,
          photoAttached: Boolean(current.photoUrl),
          gpsEvidence: { latitude: current.latitude, longitude: current.longitude, accuracy: current.accuracy, distance: current.distance },
        },
      });
    });
  }
}

/** On-demand server audit read scoped to an attendance ID; no cached audit accepted. */
export async function readAttendanceAuditTrail(attendanceId: string, adminUid: string): Promise<{
  id: string; timestamp: string; action: string; userName: string; metadata: Record<string, any>;
}[]> {
  if (!adminUid || auth.currentUser?.uid !== adminUid) throw new Error('Sesi Admin berubah.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Audit perlu koneksi server.');
  const snapshot = await getDocsFromServer(query(collection(db, 'auditLogs'), where('recordId', '==', attendanceId), limit(100)));
  if (auth.currentUser?.uid !== adminUid) throw new Error('Sesi Admin berubah.');
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error('Riwayat audit belum terverifikasi server.');
  const entries = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .filter((item: any) => item.module === 'ATTENDANCE' && (item.action === 'UPDATE' || item.action === 'DELETE'))
    .map((item: any) => ({ id: item.id as string, timestamp: String(item.timestamp || ''),
      action: String(item.action || ''), userName: String(item.userName || ''),
      metadata: (item.metadata || {}) as Record<string, any> }));
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
