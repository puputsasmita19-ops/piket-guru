import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { AuditLogAction, AuditLogModule, AuditLogRecord, AuditLogStatus } from '../../types/master.types';
import { UserRole } from '../../types';
import { normalizeAuditStatus } from './auditEventRegistry';

const AUDIT_QUEUE_STORAGE_KEY = 'piket_guru_audit_offline_queue';
const SENSITIVE_KEY_REGEX = /(pin|password|token|secret|hash|salt|credential)/i;

/**
 * Strips sensitive fields (PINs, passwords, secrets, tokens, salts) from any metadata object recursively.
 */
export function sanitizeAuditMetadata(val: any, depth = 0): any {
  if (depth > 6 || val === undefined || val === null) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeAuditMetadata(value, depth + 1);
    } else {
      result[key] = value;
    }
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
  private static isFlushingQueue = false;
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
      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
        this.enqueueOffline(record);
        return;
      }

      // Write to Firestore directly
      try {
        const docRef = doc(db, 'auditLogs', id);
        await setDoc(docRef, record);
      } catch (writeErr) {
        console.warn('[AUDIT_SERVICE] Firestore write failed, enqueuing locally:', writeErr);
        this.enqueueOffline(record);
      }
    } catch (err) {
      console.warn('[AUDIT_SERVICE] Unhandled error in logAudit:', err);
    }
  }

  /**
   * Store record in offline localStorage queue
   */
  private static enqueueOffline(record: AuditLogRecord): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUDIT_QUEUE_STORAGE_KEY);
      const queue: AuditLogRecord[] = raw ? JSON.parse(raw) : [];
      // Keep maximum 500 items in queue to avoid quota overflow
      if (queue.length > 500) {
        queue.shift();
      }
      queue.push(record);
      localStorage.setItem(AUDIT_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Storage quota or parse error ignored
    }
  }

  /**
   * Drain offline queue when internet connection is restored
   */
  public static async flushOfflineQueue(): Promise<void> {
    if (this.isFlushingQueue || typeof localStorage === 'undefined' || !navigator.onLine) return;
    this.isFlushingQueue = true;

    try {
      const raw = localStorage.getItem(AUDIT_QUEUE_STORAGE_KEY);
      if (!raw) return;

      const queue: AuditLogRecord[] = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: AuditLogRecord[] = [];

      for (const item of queue) {
        try {
          const docRef = doc(db, 'auditLogs', item.id);
          await setDoc(docRef, item);
        } catch {
          // Keep in queue if write still fails
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(AUDIT_QUEUE_STORAGE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(AUDIT_QUEUE_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[AUDIT_SERVICE] Error flushing offline queue:', err);
    } finally {
      this.isFlushingQueue = false;
    }
  }

  /**
   * Sends high-trust verified login event to server-side endpoint /api/auth/record-login
   * Ensures Firebase ID token is strictly verified before audit log creation.
   */
  public static async recordLogin(method: 'PIN' | 'GOOGLE'): Promise<void> {
    if (!auth?.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (!idToken) return;

      const res = await fetch('/api/auth/record-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ method }),
      });

      if (!res.ok) {
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
      // Fallback
      this.log({
        action: 'LOGIN',
        module: 'USERS',
        status: 'SUCCESS',
        details: `Login berhasil melalui ${method === 'GOOGLE' ? 'Google Authentication' : 'PIN Kredensial'}`,
        metadata: { authMethod: method, fallback: true },
      });
    }
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
