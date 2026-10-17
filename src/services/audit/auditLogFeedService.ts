import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { OfflineStorage } from '../offline/offlineStorage';
import type { AuditLogRecord } from '../../types/master.types';
import { toEpochMs } from '../../utils/dateUtils';

export const AUDIT_LOG_LIMIT = 50;
export interface AuditLogFeedSnapshot {
  logs: AuditLogRecord[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
  receivedAt: string | null;
}
export const EMPTY_AUDIT_FEED: AuditLogFeedSnapshot = { logs: [], loading: true, fromCache: false, error: null, receivedAt: null };
export function normalizeAuditRecord(id: string, raw: Record<string, any>): AuditLogRecord {
  const ms = toEpochMs(raw.timestamp);
  const text = (key: string, fallback = '') => typeof raw[key] === 'string' ? raw[key] : raw[key] == null ? fallback : String(raw[key]);
  return { ...raw, id, timestamp: ms ? new Date(ms).toISOString() : '', userId: text('userId'), userName: text('userName', 'Tidak diketahui'), role: text('role') as AuditLogRecord['role'], module: text('module') as AuditLogRecord['module'], action: text('action') as AuditLogRecord['action'], details: text('details'), loginId: text('loginId'), target: text('target'), recordId: text('recordId') };
}
export function auditReadError(code?: string): string {
  if (code?.includes('permission-denied')) return 'Akses log ditolak. Pastikan akun Admin/Kepala Sekolah aktif dan Rules yang berlaku sesuai.';
  if (code?.includes('failed-precondition')) return 'Konfigurasi pembacaan log perlu diperiksa. Pastikan index otomatis timestamp Descending aktif untuk koleksi auditLogs.';
  if (code?.includes('unauthenticated')) return 'Sesi tidak valid. Silakan masuk kembali untuk membaca log terbaru.';
  return 'Log terbaru belum dapat dibaca. Periksa koneksi, lalu klik Muat ulang log.';
}
/** Server-side ordering MUST precede limit. No module filter, collection-wide cache, or unbounded fallback. */
export function subscribeLatestAuditLogs(uid: string, onChange: (data: AuditLogFeedSnapshot) => void): () => void {
  if (!uid || auth.currentUser?.uid !== uid) return () => {};
  let stopped = false;
  let previous: AuditLogRecord[] = [];
  let receivedAt: string | null = null;
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(AUDIT_LOG_LIMIT));
  const unsub = onSnapshot(q, { includeMetadataChanges: true }, snapshot => {
    if (stopped || auth.currentUser?.uid !== uid) return;
    previous = snapshot.docs.map(d => normalizeAuditRecord(d.id, d.data()));
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) receivedAt = new Date().toISOString();
    onChange({ logs: previous, loading: false, fromCache: snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites, error: null, receivedAt });
  }, error => {
    if (stopped || auth.currentUser?.uid !== uid) return;
    const forbidden = ['permission-denied', 'unauthenticated'].some(code => error.code?.includes(code));
    onChange({ logs: forbidden ? [] : previous, loading: false, fromCache: true, error: auditReadError(error.code), receivedAt });
  });
  return OfflineStorage.registerListener(() => { stopped = true; previous = []; unsub(); });
}
