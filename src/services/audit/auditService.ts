import { auth } from '../firebase/firebaseAuth';
import { AuditLogAction, AuditLogModule, AuditLogRecord, AuditLogStatus } from '../../types/master.types';
import { UserRole } from '../../types';
import { operationalEventFromAudit } from '../../types/notification.types';
import { normalizeAuditStatus } from './auditEventRegistry';

import { enqueueAudit, pendingAudits, acknowledgeAudit } from './auditOutbox';
const SENSITIVE_KEY_REGEX = /(pin|password|token|secret|hash|salt|credential)/i;

async function writeAuditRecord(id: string, record: AuditLogRecord): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!uid || record.userId !== uid) throw new Error('AUDIT_SESSION_CHANGED');
  const [{ doc, setDoc }, { db }] = await Promise.all([
    import('firebase/firestore'), import('../firebase/firebase'),
  ]);
  if (auth?.currentUser?.uid !== uid) throw new Error('AUDIT_SESSION_CHANGED');
  await setDoc(doc(db, 'auditLogs', id), record);
  const event = operationalEventFromAudit(record);
  if (event && auth?.currentUser?.uid === uid) void import('../notifications/notificationPublisher').then(m => m.publishNotificationEvent(event)).catch(() => {});
}

/**
 * Strips sensitive fields (PINs, passwords, secrets, tokens, salts) from any metadata object recursively.
 */
export function sanitizeAuditMetadata(val: any, depth = 0): any {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (depth > 6) return '[TRUNCATED]';
  if (typeof val !== 'object') return typeof val === 'number' && !Number.isFinite(val) ? null : val;
  if (Array.isArray(val)) return val.map(item => sanitizeAuditMetadata(item, depth + 1) ?? null);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (value === undefined) continue;
    result[key] = SENSITIVE_KEY_REGEX.test(key) ? '[REDACTED]' : sanitizeAuditMetadata(value, depth + 1);
  }
  return result;
}

export interface AuditLogInput {
  userId?: string;
  userName?: string;
  role?: UserRole | string;
  loginId?: string;
  action: AuditLogAction;
  module: AuditLogModule;
  status?: AuditLogStatus;
  target?: string;
  recordId?: string;
  details: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  private static flushingUsers = new Set<string>();
  private static queueListenerAttached = false;

  public static init(): void {
    if (typeof window === 'undefined' || this.queueListenerAttached) return;
    this.queueListenerAttached = true;

    window.addEventListener('online', () => {
      this.flushOfflineQueue().catch(() => {});
    });

    // Attempt initial flush if online
    if (navigator.onLine) {
      setTimeout(() => {
        this.flushOfflineQueue().catch(() => {});
      }, 3000);
    }
  }

  /**
   * Non-blocking, asynchronous audit logger with reliable offline queue and privacy sanitization.
   * NEVER throws or rejects; failures fall back to local queue and warning.
   */
  public static async log(entry: AuditLogInput): Promise<void> {
    try {
      this.init();

      const currentUser = auth?.currentUser;
      const id = `audit-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const normalizedStatus = normalizeAuditStatus(entry.status);

      const record: AuditLogRecord = {
        id,
        timestamp: new Date().toISOString(),
        userId: entry.userId || currentUser?.uid || 'anonymous',
        userName: entry.userName || currentUser?.displayName || currentUser?.email || 'Tamu / Anonim',
        role: (entry.role as UserRole) || 'GURU',
        action: entry.action,
        module: entry.module,
        status: normalizedStatus,
        details: entry.details,
      };

      if (entry.loginId) record.loginId = entry.loginId;
      if (entry.target) record.target = entry.target;
      if (entry.recordId) record.recordId = entry.recordId;
      if (entry.ipAddress) record.ipAddress = entry.ipAddress;
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        record.userAgent = navigator.userAgent;
      }

      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        record.metadata = sanitizeAuditMetadata(entry.metadata);
      }

      // If offline or db is not ready, enqueue locally
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.enqueueOffline(record, currentUser?.uid);
        return;
      }

      // Write to Firestore directly
      try {
        await writeAuditRecord(id, record);
      } catch (writeErr) {
        console.warn('[AUDIT_SERVICE] Firestore write failed, enqueuing locally:', writeErr);
        this.enqueueOffline(record, currentUser?.uid);
      }
    } catch (err) {
      console.warn('[AUDIT_SERVICE] Unhandled error in logAudit:', err);
    }
  }

  private static enqueueOffline(record: AuditLogRecord, ownerUid?: string): void {
    // Never attach anonymous/other-account events to the next person's session.
    if (!ownerUid || record.userId !== ownerUid) return;
    enqueueAudit(record);
  }

  public static async flushOfflineQueue(): Promise<void> {
    const uid = auth?.currentUser?.uid;
    if (!uid || this.flushingUsers.has(uid) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.flushingUsers.add(uid);
    let completed = 0;
    try {
      const batch = pendingAudits(uid).slice(0, 50);
      for (const record of batch) {
        if (auth?.currentUser?.uid !== uid || (typeof navigator !== 'undefined' && !navigator.onLine)) break;
        try {
          await writeAuditRecord(record.id, record);
          acknowledgeAudit(record);
          completed++;
        } catch (error: any) {
          // Preserve a rejected/malformed event without blocking healthy events.
          // A connection/server failure stops this drain until the next recovery.
          if (!['permission-denied', 'already-exists', 'invalid-argument'].some(code => String(error?.code || '').endsWith(code))) break;
        }
      }
      if (completed > 0 && batch.length === 50 && auth?.currentUser?.uid === uid && pendingAudits(uid).length) {
        setTimeout(() => { if (auth?.currentUser?.uid === uid) void this.flushOfflineQueue().catch(() => {}); }, 1000);
      }
    } catch (err) {
      console.warn('[AUDIT_SERVICE] Error flushing offline queue:', err);
    } finally { this.flushingUsers.delete(uid); }
  }

  /**
   * Sends high-trust verified login event to server-side endpoint /api/auth/record-login
   * Ensures Firebase ID token is strictly verified before audit log creation.
   */
  public static async recordLogin(method: 'PIN' | 'GOOGLE'): Promise<void> {
    const user = auth?.currentUser;
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      if (!idToken || auth?.currentUser?.uid !== user.uid) return;

      const res = await fetch('/api/auth/record-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ method }),
      });

      if (!res.ok && auth?.currentUser?.uid === user.uid) {
        // Fallback to client-side logging if endpoint is unreachable
        this.log({
          action: 'LOGIN',
          module: 'USERS',
          status: 'SUCCESS',
          details: `Login berhasil melalui ${method === 'GOOGLE' ? 'Google Authentication' : 'PIN Kredensial'}`,
          metadata: { authMethod: method, fallback: true },
        });
      }
    } catch {
      // Do not attribute an earlier account's failed request to the new session.
      if (auth?.currentUser?.uid === user.uid) this.log({
        action: 'LOGIN',
        module: 'USERS',
        status: 'SUCCESS',
        details: `Login berhasil melalui ${method === 'GOOGLE' ? 'Google Authentication' : 'PIN Kredensial'}`,
        metadata: { authMethod: method, fallback: true },
      });
    } finally {
      void this.flushOfflineQueue().catch(() => {});
    }
  }

  /** Record the verified logout before Firebase signOut; never hold logout indefinitely. */
  public static async recordLogout(reason: 'MANUAL' | 'INACTIVITY_TIMEOUT' | 'APP_BACKGROUND'): Promise<void> {
    const user = auth?.currentUser;
    if (!user) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          const token = await user.getIdToken();
          if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return;
          const response = await fetch('/api/auth/record-logout', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason }), signal: controller.signal, keepalive: true,
          });
          if (!response.ok) throw new Error('LOGOUT_AUDIT_UNAVAILABLE');
        })(),
        new Promise<void>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(); }, 1500); }),
      ]);
    } catch {
      void this.log({ action: 'LOGOUT', module: 'USERS', status: 'SUCCESS', userId: user.uid,
        details: reason === 'APP_BACKGROUND' ? 'Sesi berakhir karena aplikasi ditinggalkan' : reason === 'MANUAL' ? 'Logout manual dari aplikasi' : 'Sesi berakhir karena inaktivitas', metadata: { reason, fallback: true } });
    } finally { if (timer) clearTimeout(timer); }
  }

  /**
   * Reports client-side authentication failure (e.g., Google popup cancelled by user or blocked)
   */
  public static async recordLoginFailure(params: {
    method: 'PIN' | 'GOOGLE';
    reason: string;
    details: string;
    status?: 'FAILED' | 'BLOCKED';
    email?: string;
  }): Promise<void> {
    try {
      const res = await fetch('/api/auth/record-login-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        this.log({
          action: 'LOGIN',
          module: 'USERS',
          status: params.status || 'FAILED',
          details: params.details,
          metadata: { reason: params.reason, authMethod: params.method, email: params.email },
        });
      }
    } catch {
      this.log({
        action: 'LOGIN',
        module: 'USERS',
        status: params.status || 'FAILED',
        details: params.details,
        metadata: { reason: params.reason, authMethod: params.method, email: params.email },
      });
    }
  }
}
