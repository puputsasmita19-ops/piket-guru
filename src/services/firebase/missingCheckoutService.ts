import { auth, db } from './firebase';
import {
  collection, getDocsFromServer, limit, orderBy, query, startAfter, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { AttendanceRecord, isOperationalRecord } from '../../types';
import { summarizeCheckoutHistory, wibDateDaysBefore } from '../../utils/missingCheckoutPolicy';

const PAGE_SIZE = 100;
export type MissingCheckoutPage = {
  items: AttendanceRecord[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

function activeSession(uid: string): void {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Sesi berganti. Buka kembali monitoring dengan akun aktif.');
}

/** One-shot server-only history; no offline/browser fallback, listener, or auto polling. */
export async function readMissingCheckoutPage(
  uid: string, todayWib: string, days: 7 | 14 | 30, cursor: QueryDocumentSnapshot | null = null,
): Promise<MissingCheckoutPage> {
  activeSession(uid);
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Riwayat memerlukan koneksi server.');
  const start = wibDateDaysBefore(todayWib, days);
  const end = todayWib;
  const constraints = [where('tanggal', '>=', start), where('tanggal', '<', end), orderBy('tanggal', 'desc')];
  const snapshot = await getDocsFromServer(query(collection(db, 'attendance'), ...constraints,
    ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE + 1)));
  activeSession(uid);
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error('Data dari cache atau perubahan lokal belum dapat dijadikan bukti.');
  const visible = snapshot.docs.slice(0, PAGE_SIZE);
  return {
    items: visible.map(doc => ({ ...doc.data(), id: doc.id } as AttendanceRecord)).filter(isOperationalRecord),
    cursor: visible.length ? visible[visible.length - 1] : null,
    hasMore: snapshot.docs.length > PAGE_SIZE,
  };
}

/** Recheck from server immediately before opening a correction dialog.
 * No existing checkout or second document may be silently classified as missing.
 */
export async function verifyMissingCheckoutCandidate(uid: string, record: AttendanceRecord, todayWib: string): Promise<AttendanceRecord> {
  activeSession(uid);
  if (record.tanggal >= todayWib) throw new Error('Presensi hari ini bukan kasus checkout historis.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Koneksi server diperlukan sebelum koreksi.');
  const snapshot = await getDocsFromServer(query(collection(db, 'attendance'), where('tanggal', '==', record.tanggal)));
  activeSession(uid);
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error('Verifikasi server belum selesai.');
  const sameUser = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AttendanceRecord))
    .filter(item => isOperationalRecord(item) && item.userId === record.userId);
  const summary = summarizeCheckoutHistory(sameUser, todayWib);
  if (summary.missing.length !== 1 || summary.conflicts.length || summary.missing[0].record.id !== record.id) {
    throw new Error('Status presensi berubah atau ditemukan data ganda. Segarkan daftar sebelum koreksi.');
  }
  const fresh = summary.missing[0].record;
  const previousVersion = record.updatedAt && typeof record.updatedAt === 'object' && 'toMillis' in record.updatedAt
    ? (record.updatedAt as { toMillis: () => number }).toMillis() : String(record.updatedAt ?? '');
  const latestVersion = fresh.updatedAt && typeof fresh.updatedAt === 'object' && 'toMillis' in fresh.updatedAt
    ? (fresh.updatedAt as { toMillis: () => number }).toMillis() : String(fresh.updatedAt ?? '');
  if (previousVersion !== latestVersion || String(fresh.jamMasuk) !== String(record.jamMasuk)) {
    // Firestore Timestamp stringification is stable for the same underlying stored values.
    throw new Error('Presensi telah diperbarui. Segarkan daftar untuk melihat versi terbaru.');
  }
  return fresh;
}
