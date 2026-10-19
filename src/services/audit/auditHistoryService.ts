import { collection, query, orderBy, documentId, limit, startAfter, getDocsFromServer, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { AuditLogRecord } from '../../types/master.types';
import { getTodayISODate } from '../../utils/dateUtils';
import { normalizeAuditRecord } from './auditLogFeedService';
import { normalizeAuditModule, normalizeAuditStatus, getAuditModuleLabel, getAuditActionLabel, getAuditStatusMeta } from './auditEventRegistry';

export const AUDIT_PAGE_SIZES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const AUDIT_SCAN_BUDGET = 500;
export interface AuditHistoryFilters { search: string; startDate: string; endDate: string; module: string; action: string; status: string }
export interface AuditCursor { timestamp: unknown; id: string }
export interface AuditHistoryPage {
  logs: AuditLogRecord[];
  cursor: AuditCursor | null;
  hasNext: boolean;
  incomplete: boolean;
  scanned: number;
  fromCache: boolean;
  receivedAt: string | null;
}
export const EMPTY_AUDIT_HISTORY_PAGE: AuditHistoryPage = { logs: [], cursor: null, hasNext: false, incomplete: false, scanned: 0, fromCache: false, receivedAt: null };
export function hasAuditHistoryFilters(f: AuditHistoryFilters) {
  return !!(f.search.trim() || f.startDate || f.endDate || f.module !== 'SEMUA' || f.action !== 'SEMUA' || f.status !== 'SEMUA');
}
export function matchesAuditHistory(log: AuditLogRecord, f: AuditHistoryFilters): boolean {
  if (f.module !== 'SEMUA' && normalizeAuditModule(log.module) !== f.module) return false;
  if (f.action !== 'SEMUA' && log.action !== f.action) return false;
  if (f.status !== 'SEMUA' && normalizeAuditStatus(log.status) !== f.status) return false;
  if (f.startDate || f.endDate) {
    if (!log.timestamp) return false;
    const date = getTodayISODate(log.timestamp);
    if ((f.startDate && date < f.startDate) || (f.endDate && date > f.endDate)) return false;
  }
  const search = f.search.trim().toLocaleLowerCase('id-ID');
  return !search || [log.userName, log.userId, log.loginId, log.role, log.details, log.target, log.recordId,
    log.module, log.action, log.status, getAuditModuleLabel(log.module), getAuditActionLabel(log.action), getAuditStatusMeta(log.status).label]
    .some(value => String(value || '').toLocaleLowerCase('id-ID').includes(search));
}
function auditQuery(size: number, cursor: AuditCursor | null = null) {
  return query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), orderBy(documentId(), 'desc'),
    ...(cursor ? [startAfter(cursor.timestamp, cursor.id)] : []), limit(size));
}
const cursorOf = (doc: { id: string; data: () => Record<string, any> }): AuditCursor => ({ id: doc.id, timestamp: doc.data().timestamp });

/** Bounded server reads; filters include legacy aliases/default statuses and the entire searchable history. */
export async function readAuditHistoryPage(filters: AuditHistoryFilters, size: number, cursor: AuditCursor | null, assertActive: () => void): Promise<AuditHistoryPage> {
  if (!Number.isInteger(size) || size < 0 || size > 100) throw new Error('Ukuran halaman audit tidak valid.');
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.');
  assertActive();
  const matches: { log: AuditLogRecord; cursor: AuditCursor }[] = [];
  let scanned = 0, position = cursor;
  while (scanned < AUDIT_SCAN_BUDGET) {
    const batchSize = Math.min(Math.max(1, size + 1), 100, AUDIT_SCAN_BUDGET - scanned);
    const snapshot = await getDocsFromServer(auditQuery(batchSize, position));
    assertActive();
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) throw new Error('Riwayat audit membutuhkan konfirmasi server. Periksa koneksi lalu coba kembali.');
    scanned += snapshot.docs.length;
    for (const doc of snapshot.docs) {
      const next = cursorOf(doc);
      const log = normalizeAuditRecord(doc.id, doc.data());
      if (matchesAuditHistory(log, filters)) matches.push({ log, cursor: next });
      if (matches.length > size) {
        const displayed = matches.slice(0, size);
        return { logs: displayed.map(m => m.log), cursor: displayed.at(-1)?.cursor || cursor, hasNext: true, incomplete: false, scanned, fromCache: false, receivedAt: new Date().toISOString() };
      }
      position = next;
    }
    if (snapshot.docs.length < batchSize) return { logs: matches.map(m => m.log), cursor: position, hasNext: false, incomplete: false, scanned, fromCache: false, receivedAt: new Date().toISOString() };
  }
  return { logs: matches.map(m => m.log), cursor: position, hasNext: false, incomplete: true, scanned, fromCache: false, receivedAt: new Date().toISOString() };
}

/** Only the newest bounded window stays live. Historic pages retain their cursor boundaries. */
export function subscribeAuditHistoryHead(size: number, assertActive: () => void, next: (page: AuditHistoryPage) => void, error: (error: Error) => void) {
  assertActive();
  return onSnapshot(auditQuery(size + 1), { includeMetadataChanges: true }, snapshot => {
    try { assertActive(); } catch { return; }
    const docs = snapshot.docs.slice(0, size);
    const cached = snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites;
    next({ logs: docs.map(d => normalizeAuditRecord(d.id, d.data())), cursor: docs.length ? cursorOf(docs[docs.length - 1]) : null,
      hasNext: snapshot.docs.length > size, incomplete: false, scanned: snapshot.docs.length, fromCache: cached, receivedAt: cached ? null : new Date().toISOString() });
  }, error);
}
