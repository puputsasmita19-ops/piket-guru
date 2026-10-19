import type { AuditLogRecord } from '../../types/master.types';
import { OfflineStorage } from '../offline/offlineStorage';
import firebaseConfig from '../../../firebase-applet-config.json';

const PREFIX = `piket_audit_v2:${encodeURIComponent(firebaseConfig.projectId)}:`;
const LEGACY_KEY = 'piket_guru_audit_offline_queue';
const memory = new Map<string, AuditLogRecord>();
const userPrefix = (uid: string) => `${PREFIX}${encodeURIComponent(uid)}:`;
const keyFor = (record: AuditLogRecord) => `${userPrefix(record.userId)}${encodeURIComponent(record.id)}`;
const isRecord = (value: any, uid: string): value is AuditLogRecord => !!value && value.userId === uid && typeof value.id === 'string' && !!value.id && typeof value.timestamp === 'string' && typeof value.action === 'string';

/** One key per event: acknowledging one event cannot overwrite another tab's append. */
export function enqueueAudit(record: AuditLogRecord): void {
  const key = keyFor(record);
  memory.set(key, record);
  if (!OfflineStorage.isTrustedDevice()) return;
  try { localStorage.setItem(key, JSON.stringify(record)); memory.delete(key); }
  catch { console.warn('[AUDIT_OUTBOX] Penyimpanan penuh/tidak tersedia; log ditahan dalam sesi ini.'); }
}

export function pendingAudits(uid: string): AuditLogRecord[] {
  const result = new Map<string, AuditLogRecord>();
  const prefix = userPrefix(uid);
  for (const [key, record] of memory) if (key.startsWith(prefix)) result.set(record.id, record);
  if (OfflineStorage.isTrustedDevice()) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const record = JSON.parse(localStorage.getItem(key) || 'null');
          if (isRecord(record, uid) && key === keyFor(record)) result.set(record.id, record);
        } catch { /* A malformed entry must not hide healthy entries. */ }
      }
      // Preserve pre-upgrade pending logs; never replay another account's logs.
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
      if (Array.isArray(legacy)) for (const record of legacy) {
        if (isRecord(record, uid) && !result.has(record.id)) result.set(record.id, record);
      }
    } catch { /* Session-only entries still remain available. */ }
  }
  return [...result.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function acknowledgeAudit(record: AuditLogRecord): void {
  memory.delete(keyFor(record));
  try {
    localStorage.removeItem(keyFor(record));
    if (!OfflineStorage.isTrustedDevice()) return;
    // Re-read at acknowledgement, preserving events added while IO was awaiting.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.some(item => item?.id === record.id && item?.userId === record.userId)) {
      const remaining = legacy.filter(item => item?.id !== record.id || item?.userId !== record.userId);
      if (remaining.length) localStorage.setItem(LEGACY_KEY, JSON.stringify(remaining));
      else localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* Retry retains the stable event ID when persistent acknowledgement fails. */ }
}
