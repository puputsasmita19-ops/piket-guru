/**
 * Piket Guru - IndexedDB & Scoped Storage Engine (v2)
 *
 * Implements isolated, account-scoped persistence for:
 * 1. Form Drafts (with Blob attachments for photos)
 * 2. Submission Sync Queue (idempotent operational actions)
 * 3. Scoped Read Cache (strictly isolated by Firebase project + User UID)
 * 4. Device Trust Configuration (Perangkat Pribadi Tepercaya vs Perangkat Bersama)
 */

import { UserProfile } from '../../types';
import firebaseConfig from '../../../firebase-applet-config.json';

export const OFFLINE_DB_NAME = 'piket_guru_offline_v2';
export const OFFLINE_DB_VERSION = 1;
export const STORAGE_SCHEMA_VERSION = 2;
export const CURRENT_PROJECT_ID = (firebaseConfig as any)?.projectId || 'piket-guru';

export interface DraftRecord<T = any> {
  id: string; // Composite: `${userId}:${formType}:${recordId}`
  userId: string;
  formType: string;
  recordId: string;
  data: T;
  attachments?: { [key: string]: Blob };
  updatedAt: string;
  schemaVersion: number;
}

export type QueueItemStatus = 'PENDING_NETWORK' | 'SENDING' | 'SUCCESS' | 'NEEDS_ACTION';

export interface QueueItem<T = any> {
  operationId: string; // Unique deterministic composite ID
  projectId: string; // Firebase project ID
  userId: string;
  userName: string;
  operationType: 'ATTENDANCE_CHECKIN' | 'DUTYBOOK_SUBMIT' | 'INCIDENT_REPORT' | 'TARDY_REPORT' | 'PERMIT_REPORT' | 'VISITOR_REPORT' | 'SUBSTITUTION_REPORT' | 'GENERIC_SET';
  collectionName: string;
  recordId: string;
  payload: T;
  attachments?: { [key: string]: Blob };
  uploadedAttachmentUrls?: { [key: string]: string };
  createdAt: string;
  updatedAt?: string;
  nextRetryAt?: number;
  retryCount: number;
  status: QueueItemStatus;
  lastError?: string;
  schemaVersion: number;
  /** Hash of the original submission, unchanged by upload/sync progress. */
  submissionFingerprint?: string;
  /** Random lease token for the CURRENT sender, invalidated on stale recovery. */
  deliveryAttemptId?: string;
}

export interface ScopedCacheRecord<T = any> {
  key: string; // Composite: `${userId}:${collectionName}`
  userId: string;
  collectionName: string;
  data: T[];
  cachedAt: string;
  schemaVersion: number;
}

// In-memory fallback for environments without IndexedDB or for untrusted devices
const memoryStore = {
  drafts: new Map<string, DraftRecord>(),
  syncQueue: new Map<string, QueueItem>(),
  scopedCache: new Map<string, ScopedCacheRecord>(),
  metadata: new Map<string, any>(),
};

// Registered Firestore listeners for graceful teardown on logout
const activeFirestoreUnsubscribers = new Set<() => void>();

export class OfflineStorage {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static isIndexedDBSupported = typeof indexedDB !== 'undefined';

  /**
   * Register an active Firestore listener for unified teardown on logout/switch
   */
  public static registerListener(unsub: () => void): () => void {
    activeFirestoreUnsubscribers.add(unsub);
    return () => {
      activeFirestoreUnsubscribers.delete(unsub);
      try {
        unsub();
      } catch {}
    };
  }

  /**
   * Stop all registered real-time listeners and clear in-memory state
   */
  public static teardownActiveListeners(): void {
    activeFirestoreUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.warn('[OFFLINE_STORAGE] Error tearing down listener:', err);
      }
    });
    activeFirestoreUnsubscribers.clear();
  }

  /**
   * Return current Firebase project identifier
   */
  public static getProjectId(): string {
    return CURRENT_PROJECT_ID;
  }

  /**
   * Check whether current device is marked as a Trusted/Personal device.
   * Default: FALSE (Shared / Public device mode).
   */
  public static isTrustedDevice(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem('piket_device_trusted_v2') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set device trust preference.
   */
  public static setTrustedDevice(trusted: boolean): void {
    if (typeof localStorage === 'undefined') return;
    try {
      if (trusted) {
        localStorage.setItem('piket_device_trusted_v2', 'true');
        // Promote existing session-only work when the owner marks a personal HP.
        void this.persistMemoryWork().catch(error => console.warn('Data masih tersimpan sementara:', error));
      } else {
        localStorage.removeItem('piket_device_trusted_v2');
      }
    } catch {}
  }

  public static async persistMemoryWork(): Promise<void> {
    if (!this.isTrustedDevice()) return;
    if (!this.isIndexedDBSupported) throw new Error('Penyimpanan permanen browser tidak tersedia.');
    for (const draft of [...memoryStore.drafts.values()]) {
      await this.saveDraft(draft.userId, draft.formType, draft.recordId, draft.data, draft.attachments);
    }
    for (const item of [...memoryStore.syncQueue.values()]) {
      await this.enqueueSyncItem(item); memoryStore.syncQueue.delete(item.operationId);
    }
  }

  /**
   * Purge all legacy, un-scoped operational caches (e.g. piket_firestore_<col>)
   * without affecting server data or current session.
   */
  public static purgeLegacyUnscopedCaches(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('piket_firestore_') || key === 'piket_guru_users_db_v1')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      console.warn('[OFFLINE_STORAGE] Error purging legacy caches:', err);
    }
  }

  /**
   * Initialize or open IndexedDB instance with required object stores
   */
  private static async getDb(): Promise<IDBDatabase> {
    if (!this.isIndexedDBSupported) {
      throw new Error('IndexedDB not supported in this environment');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains('drafts')) {
              const draftStore = db.createObjectStore('drafts', { keyPath: 'id' });
              draftStore.createIndex('userId', 'userId', { unique: false });
              draftStore.createIndex('user_form', ['userId', 'formType'], { unique: false });
            }

            if (!db.objectStoreNames.contains('syncQueue')) {
              const queueStore = db.createObjectStore('syncQueue', { keyPath: 'operationId' });
              queueStore.createIndex('userId', 'userId', { unique: false });
              queueStore.createIndex('status', 'status', { unique: false });
              queueStore.createIndex('user_status', ['userId', 'status'], { unique: false });
            }

            if (!db.objectStoreNames.contains('scopedCache')) {
              const cacheStore = db.createObjectStore('scopedCache', { keyPath: 'key' });
              cacheStore.createIndex('userId', 'userId', { unique: false });
              cacheStore.createIndex('collectionName', 'collectionName', { unique: false });
            }

            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' });
            }
          };

          request.onsuccess = () => {
            const database = request.result;
            // A second tab (or a newer app release) can upgrade the schema.
            // Keep no stale connection: future operations must reopen the DB.
            database.onversionchange = () => {
              database.close();
              this.dbPromise = null;
            };
            resolve(database);
          };

          request.onerror = () => {
            reject(request.error || new Error('Failed to open IndexedDB'));
          };
        } catch (e) {
          reject(e);
        }
      });
    }

    return this.dbPromise.catch(error => { this.dbPromise = null; throw error; });
  }

  // ==========================================
  // DRAFTS MANAGEMENT
  // ==========================================

  public static async saveDraft(
    userId: string,
    formType: string,
    recordId: string,
    data: any,
    attachments?: { [key: string]: Blob }
  ): Promise<void> {
    if (!userId) return;

    // Check if draft data contains oversized photo string (> 550,000 chars ~ 400 KB JPEG)
    const photoStr = (data as any)?.dataUrl || (data as any)?.photoUrl;
    if (typeof photoStr === 'string' && photoStr.length > 550_000) {
      const sizeKb = Math.round(((photoStr.length - 23) * 0.75) / 1024);
      throw new Error(`Ukuran foto draf (${sizeKb} KB) melebihi batas aman dokumen (maksimal ~400 KB). Silakan ambil ulang foto.`);
    }

    const id = `${userId}:${formType}:${recordId}`;
    const draft: DraftRecord = {
      id,
      userId,
      formType,
      recordId,
      data,
      attachments,
      updatedAt: new Date().toISOString(),
      schemaVersion: STORAGE_SCHEMA_VERSION,
    };

    // If device is not trusted, keep in volatile memory / sessionStorage only
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      memoryStore.drafts.set(id, draft);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`piket_draft_${id}`, JSON.stringify({ ...draft, attachments: undefined }));
        }
      } catch (sErr) {
        console.warn('[OFFLINE_STORAGE] sessionStorage write warning (memory fallback preserved):', sErr);
      }
      return;
    }

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');
        const req = store.put(draft);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error('Penyimpanan lokal dibatalkan.'));
        tx.onerror = () => reject(tx.error || req.error);
      });
      memoryStore.drafts.delete(id);
    } catch (err: any) {
      console.warn('[OFFLINE_STORAGE] IndexedDB draft save failed, using memory fallback:', err);
      memoryStore.drafts.set(id, draft);
    }
  }

  public static async getDraft<T = any>(
    userId: string,
    formType: string,
    recordId: string
  ): Promise<DraftRecord<T> | null> {
    if (!userId) return null;
    const id = `${userId}:${formType}:${recordId}`;

    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      return (memoryStore.drafts.get(id) as DraftRecord<T>) || null;
    }

    try {
      const db = await this.getDb();
      return await new Promise<DraftRecord<T> | null>((resolve, reject) => {
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return (memoryStore.drafts.get(id) as DraftRecord<T>) || null;
    }
  }

  public static async deleteDraft(userId: string, formType: string, recordId: string): Promise<void> {
    if (!userId) return;
    const id = `${userId}:${formType}:${recordId}`;
    memoryStore.drafts.delete(id);

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(`piket_draft_${id}`);
      }
    } catch {}

    if (this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('drafts', 'readwrite');
          const store = tx.objectStore('drafts');
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {}
    }
  }

  public static async listDraftsByUser(userId: string, formType?: string, options: { strict?: boolean } = {}): Promise<DraftRecord[]> {
    if (!userId) return [];

    let results: DraftRecord[] = [];
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      memoryStore.drafts.forEach((draft) => {
        if (draft.userId === userId && (!formType || draft.formType === formType)) {
          results.push(draft);
        }
      });
      return results;
    }

    try {
      const db = await this.getDb();
      results = await new Promise<DraftRecord[]>((resolve, reject) => {
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const index = store.index('userId');
        const req = index.getAll(userId);
        let received: DraftRecord[] = [];
        req.onsuccess = () => {
          const items = (req.result || []) as DraftRecord[];
          if (formType) {
            received = items.filter((d) => d.formType === formType);
          } else {
            received = items;
          }
        };
        tx.oncomplete = () => resolve(received);
        tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Pembacaan draf dibatalkan.'));
      });
    } catch (error) {
      if (options.strict) throw error;
      memoryStore.drafts.forEach((draft) => {
        if (draft.userId === userId && (!formType || draft.formType === formType)) {
          results.push(draft);
        }
      });
    }
    return results;
  }

  // ==========================================
  // SYNC QUEUE MANAGEMENT
  // ==========================================

  public static async enqueueSyncItem(item: QueueItem, options: { createOnly?: boolean } = {}): Promise<void> {
    if (!item.userId) return;
    if (this.isTrustedDevice() && !this.isIndexedDBSupported) throw new Error('Penyimpanan offline browser tidak tersedia. Jangan tutup formulir sebelum data terkirim.');

    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      if (options.createOnly && memoryStore.syncQueue.has(item.operationId)) {
        if (item.submissionFingerprint && memoryStore.syncQueue.get(item.operationId)?.submissionFingerprint === item.submissionFingerprint) return;
        throw new Error('Data ini masih dalam antrean sinkronisasi. Selesaikan atau hapus kiriman sebelumnya sebelum mengirim perubahan baru.');
      }
      memoryStore.syncQueue.set(item.operationId, item);
      return;
    }

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        let conflict = false;
        const req = options.createOnly ? store.get(item.operationId) : store.put(item);
        if (options.createOnly) req.onsuccess = () => {
          if (req.result && item.submissionFingerprint && req.result.submissionFingerprint === item.submissionFingerprint) return;
          if (req.result) { conflict = true; tx.abort(); }
          else store.put(item);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(conflict
          ? new Error('Data ini masih dalam antrean sinkronisasi. Selesaikan atau hapus kiriman sebelumnya sebelum mengirim perubahan baru.')
          : tx.error || new Error('Penyimpanan lokal dibatalkan.'));
        tx.onerror = () => reject(tx.error || req.error);
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Data ini masih dalam antrean')) throw err;
      console.warn('[OFFLINE_STORAGE] Antrean belum tersimpan secara permanen:', err);
      throw new Error('Antrean belum berhasil disimpan di perangkat. Jangan tutup formulir; periksa ruang penyimpanan lalu coba lagi.');
    }
  }

  /**
   * R114-B: Claim an immutable queued submission inside ONE IndexedDB transaction.
   * A second tab must never send the same pending operation concurrently.
   * Only the original queued fingerprint may be claimed; unrelated edits cannot
   * replace a pending submission while it is being delivered.
   */
  public static async claimSyncItem(item: QueueItem): Promise<string | null> {
    const attemptId = crypto.randomUUID();
    const matches = (stored?: QueueItem) => !!stored &&
      stored.operationId === item.operationId && stored.projectId === CURRENT_PROJECT_ID &&
      stored.userId === item.userId && stored.status === 'PENDING_NETWORK' &&
      stored.submissionFingerprint === item.submissionFingerprint;
    const claimed = (stored: QueueItem): QueueItem => ({
      ...stored, status: 'SENDING', deliveryAttemptId: attemptId, updatedAt: new Date().toISOString(),
    });
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const current = memoryStore.syncQueue.get(item.operationId);
      if (!matches(current)) return null;
      memoryStore.syncQueue.set(item.operationId, claimed(current!));
      return attemptId;
    }
    const db = await this.getDb();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let acquired = false;
      const req = store.get(item.operationId);
      req.onsuccess = () => {
        if (matches(req.result)) { store.put(claimed(req.result)); acquired = true; }
      };
      tx.oncomplete = () => resolve(acquired ? attemptId : null);
      tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Klaim antrean gagal.'));
    });
  }

  /** A stale sender may only remove the exact submission it originally claimed. */
  public static async acknowledgeSyncItem(item: QueueItem): Promise<boolean> {
    const matches = (stored?: QueueItem) => !!stored &&
      stored.operationId === item.operationId && stored.projectId === CURRENT_PROJECT_ID &&
      stored.userId === item.userId && stored.status === 'SENDING' &&
      !!item.deliveryAttemptId && stored.deliveryAttemptId === item.deliveryAttemptId &&
      stored.submissionFingerprint === item.submissionFingerprint;
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const stored = memoryStore.syncQueue.get(item.operationId);
      if (!matches(stored)) return false;
      memoryStore.syncQueue.delete(item.operationId);
      return true;
    }
    const db = await this.getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let acknowledged = false;
      const req = store.get(item.operationId);
      req.onsuccess = () => {
        if (matches(req.result)) { store.delete(item.operationId); acknowledged = true; }
      };
      tx.oncomplete = () => resolve(acknowledged);
      tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Konfirmasi antrean gagal.'));
    });
  }

  /**
   * A stale send MUST be timed from its last attempt update, NOT createdAt.
   * A draft can be days old but have a recently started delivery. Invalid or
   * missing attempt timestamps are left in place for manual recovery review.
   */
  public static isStaleSendingItem(item: QueueItem, now = Date.now()): boolean {
    if (item.status !== 'SENDING') return false;
    const lastAttempt = Date.parse(item.updatedAt || '');
    return Number.isFinite(lastAttempt) && now - lastAttempt > 120000;
  }

  /**
   * R114-C1: Recover only the exact interrupted delivery attempt.
   * Matching only the fingerprint could reset another tab's newer SENDING
   * attempt if the recovery snapshot is out of date. Legacy rows without an
   * attempt token are recoverable only if both snapshots lack that token.
   */
  public static async recoverStaleSyncItem(item: QueueItem, now = Date.now()): Promise<boolean> {
    const stale = (stored?: QueueItem) => {
      if (!stored || item.projectId !== CURRENT_PROJECT_ID || stored.userId !== item.userId || stored.projectId !== CURRENT_PROJECT_ID ||
          stored.operationId !== item.operationId || stored.status !== 'SENDING' ||
          stored.submissionFingerprint !== item.submissionFingerprint ||
          stored.deliveryAttemptId !== item.deliveryAttemptId) return false;
      // Unknown timestamps require manual review rather than blind replay.
      return this.isStaleSendingItem(stored, now);
    };
    const recovered = (stored: QueueItem): QueueItem => ({ ...stored, status: 'PENDING_NETWORK',
      deliveryAttemptId: undefined, nextRetryAt: undefined, updatedAt: new Date().toISOString() });
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const stored = memoryStore.syncQueue.get(item.operationId);
      if (!stale(stored)) return false;
      memoryStore.syncQueue.set(item.operationId, recovered(stored!));
      return true;
    }
    const db = await this.getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let changed = false;
      const req = store.get(item.operationId);
      req.onsuccess = () => {
        if (stale(req.result)) { store.put(recovered(req.result)); changed = true; }
      };
      tx.oncomplete = () => resolve(changed);
      tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Pemulihan antrean gagal.'));
    });
  }

  /**
   * R114-C1: Only the same, still-pending submission can transition to
   * NEEDS_ACTION before dispatch. A stale permission check from another tab
   * must never overwrite SENDING, SUCCESS, or a newer queue item.
   */
  public static async markPendingSyncItemNeedsAction(item: QueueItem, reason: string): Promise<boolean> {
    const matches = (stored?: QueueItem) => !!stored &&
      stored.operationId === item.operationId && stored.userId === item.userId &&
      item.projectId === CURRENT_PROJECT_ID && stored.projectId === CURRENT_PROJECT_ID && stored.status === 'PENDING_NETWORK' &&
      stored.submissionFingerprint === item.submissionFingerprint &&
      !stored.deliveryAttemptId;
    const changed = (stored: QueueItem): QueueItem => ({ ...stored,
      status: 'NEEDS_ACTION', lastError: reason, nextRetryAt: undefined,
      updatedAt: new Date().toISOString(),
    });
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const stored = memoryStore.syncQueue.get(item.operationId);
      if (!matches(stored)) return false;
      memoryStore.syncQueue.set(item.operationId, changed(stored!));
      return true;
    }
    const db = await this.getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let updated = false;
      const req = store.get(item.operationId);
      req.onsuccess = () => {
        if (matches(req.result)) { store.put(changed(req.result)); updated = true; }
      };
      tx.oncomplete = () => resolve(updated);
      tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Penandaan konflik antrean gagal.'));
    });
  }

  /**
   * R114-B: Save conversion progress or a final failure only if THIS sender
   * still owns the same attempt. A delayed tab must never overwrite a later
   * attempt or an already acknowledged/removed submission.
   */
  public static async updateClaimedSyncItem(item: QueueItem): Promise<boolean> {
    const matches = (stored?: QueueItem) => !!stored && stored.status === 'SENDING' &&
      stored.projectId === CURRENT_PROJECT_ID && stored.userId === item.userId &&
      !!item.deliveryAttemptId && stored.deliveryAttemptId === item.deliveryAttemptId &&
      stored.submissionFingerprint === item.submissionFingerprint;
    const next = (stored: QueueItem) => ({ ...stored, ...item });
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const stored = memoryStore.syncQueue.get(item.operationId);
      if (!matches(stored)) return false;
      memoryStore.syncQueue.set(item.operationId, next(stored!));
      return true;
    }
    const db = await this.getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let updated = false;
      const req = store.get(item.operationId);
      req.onsuccess = () => {
        if (matches(req.result)) { store.put(next(req.result)); updated = true; }
      };
      tx.oncomplete = () => resolve(updated);
      tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Status kiriman gagal disimpan.'));
    });
  }

  public static async updateSyncItem(item: QueueItem): Promise<void> {
    await this.enqueueSyncItem(item);
  }

  /** Retry controls must atomically inspect the latest queue state, not a stale UI snapshot. */
  public static async resetSyncItemForRetry(operationId: string, userId: string, networkOnly = false): Promise<boolean> {
    const reset = (item?: QueueItem): QueueItem | null => {
      if (!item || item.userId !== userId || item.projectId !== CURRENT_PROJECT_ID) return null;
      if (item.status === 'SENDING') {
        if (networkOnly) return null;
        throw new Error('Data sedang dikirim ke server. Harap tunggu hingga pengiriman selesai.');
      }
      if (item.status !== 'PENDING_NETWORK' && item.status !== 'NEEDS_ACTION') return null;
      if (networkOnly && (item.status !== 'PENDING_NETWORK' || !/unavailable|deadline-exceeded|network|Failed to fetch|offline|koneksi|terhubung|timeout/i.test(item.lastError || ''))) return null;
      return { ...item, status: 'PENDING_NETWORK', retryCount: networkOnly ? item.retryCount : 0,
        nextRetryAt: 0, lastError: networkOnly ? item.lastError : undefined, updatedAt: new Date().toISOString() };
    };
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      const next = reset(memoryStore.syncQueue.get(operationId));
      if (next) memoryStore.syncQueue.set(operationId, next);
      return !!next;
    }
    const db = await this.getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite'), store = tx.objectStore('syncQueue');
      let changed = false, cause: unknown;
      const request = store.get(operationId);
      request.onsuccess = () => {
        try {
          const next = reset(request.result);
          if (next) { store.put(next); changed = true; }
        } catch (error) { cause = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(changed);
      tx.onabort = tx.onerror = () => reject(cause || tx.error || new Error('Percobaan ulang antrean belum tersimpan.'));
    });
  }

  /** Atomic cross-tab lease, also used when Web Locks is unavailable. */
  public static async syncLease(userId: string, owner: string, release = false): Promise<boolean> {
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) return true;
    const db = await this.getDb(), key = `sync_lease:${CURRENT_PROJECT_ID}:${userId}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite'), store = tx.objectStore('metadata');
      let acquired = false;
      const request = store.get(key);
      request.onsuccess = () => {
        const lease = request.result;
        if (release) { if (lease?.owner === owner) store.delete(key); return; }
        if (!lease || lease.owner === owner || lease.expiresAt < Date.now()) {
          acquired = true; store.put({ key, owner, expiresAt: Date.now() + 90000 });
        }
      };
      tx.oncomplete = () => resolve(acquired);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Kunci antrean tidak tersedia.'));
    });
  }

  public static async removeSyncItem(operationId: string, options: { allowSending?: boolean; userId?: string } = {}): Promise<void> {
    const busyError = () => new Error('Data sedang dikirim ke server. Harap tunggu hingga pengiriman selesai.');
    const ownerError = () => new Error('Antrean bukan milik sesi akun atau proyek ini. Penghapusan ditolak.');
    const allowed = (item?: QueueItem) => {
      if (!item) return;
      if (options.userId && (item.userId !== options.userId || item.projectId !== CURRENT_PROJECT_ID)) throw ownerError();
      if (!options.allowSending && item.status === 'SENDING') throw busyError();
    };
    // A public/shared device stores its queue only in memory. Never open a
    // private persistent DB just to remove an ephemeral item.
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      allowed(memoryStore.syncQueue.get(operationId));
      memoryStore.syncQueue.delete(operationId);
      return;
    }
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      let refusal: unknown;
      const req = store.get(operationId);
      req.onsuccess = () => {
        try {
          allowed(req.result);
          if (req.result) store.delete(operationId);
        } catch (error) { refusal = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(refusal || tx.error || req.error || new Error('Penghapusan antrean lokal dibatalkan.'));
    });
    // A transient memory fallback may contain a different account's entry.
    // Never remove it just because the persistent copy was removed.
    const fallback = memoryStore.syncQueue.get(operationId);
    if (!fallback || !options.userId || (fallback.userId === options.userId && fallback.projectId === CURRENT_PROJECT_ID)) {
      memoryStore.syncQueue.delete(operationId);
    }
  }

  public static async getSyncItemsByUser(userId: string, options: { strict?: boolean } = {}): Promise<QueueItem[]> {
    if (!userId) return [];

    let results: QueueItem[] = [];
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId && item.projectId === CURRENT_PROJECT_ID) {
          results.push(item);
        }
      });
      return results;
    }

    try {
      const db = await this.getDb();
      results = await new Promise<QueueItem[]>((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readonly');
        const store = tx.objectStore('syncQueue');
        const index = store.index('userId');
        const req = index.getAll(userId);
        let received: QueueItem[] = [];
        req.onsuccess = () => { received = req.result || []; };
        tx.oncomplete = () => resolve(received);
        tx.onabort = tx.onerror = () => reject(tx.error || req.error || new Error('Pembacaan antrean dibatalkan.'));
      });
      // A browser's IndexedDB may outlive a Firebase project switch. Never
      // expose an old project's drafts/queue in the active project's status.
      results = results.filter(item => item.projectId === CURRENT_PROJECT_ID);
      // Merge memory items in case any are pending flush.
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId && item.projectId === CURRENT_PROJECT_ID && !results.some((r) => r.operationId === item.operationId)) {
          results.push(item);
        }
      });
    } catch (error) {
      if (options.strict) throw error;
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId && item.projectId === CURRENT_PROJECT_ID) {
          results.push(item);
        }
      });
    }
    return results;
  }

  // ==========================================
  // SCOPED READ CACHE (ISOLATED PER USER UID)
  // ==========================================

  public static async setScopedCache<T>(userId: string, collectionName: string, data: T[]): Promise<void> {
    if (!userId || !collectionName) return;
    const key = `${userId}:${collectionName}`;
    const record: ScopedCacheRecord<T> = {
      key,
      userId,
      collectionName,
      data,
      cachedAt: new Date().toISOString(),
      schemaVersion: STORAGE_SCHEMA_VERSION,
    };

    memoryStore.scopedCache.set(key, record);

    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      return;
    }

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('scopedCache', 'readwrite');
        const store = tx.objectStore('scopedCache');
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Cache belum tersimpan.'));
      });
    } catch (err) {
      console.warn('[OFFLINE_STORAGE] Failed to write scoped cache to IndexedDB:', err);
    }
  }

  public static async getScopedCache<T>(userId: string, collectionName: string): Promise<ScopedCacheRecord<T> | null> {
    if (!userId || !collectionName) return null;
    const key = `${userId}:${collectionName}`;

    if (memoryStore.scopedCache.has(key)) {
      return memoryStore.scopedCache.get(key) as ScopedCacheRecord<T>;
    }

    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      return null;
    }

    try {
      const db = await this.getDb();
      return await new Promise<ScopedCacheRecord<T> | null>((resolve, reject) => {
        const tx = db.transaction('scopedCache', 'readonly');
        const store = tx.objectStore('scopedCache');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  // ==========================================
  // VERIFIED PROFILE LOCAL SNAPSHOT (OFFLINE RESILIENCE)
  // ==========================================

  public static async saveVerifiedProfile(profile: UserProfile): Promise<void> {
    if (!profile || !profile.id) return;
    const key = `verified_profile_${profile.id}`;
    const payload = {
      key,
      userId: profile.id,
      profile,
      verifiedAt: Date.now(),
    };

    memoryStore.metadata.set(key, payload);

    if (this.isTrustedDevice() && this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('metadata', 'readwrite');
          const store = tx.objectStore('metadata');
          store.put(payload);
          tx.oncomplete = () => resolve();
          tx.onabort = tx.onerror = () => reject(tx.error || new Error('Profil verifikasi belum tersimpan.'));
        });
      } catch {}
    }
  }

  public static async getVerifiedProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const key = `verified_profile_${userId}`;

    if (memoryStore.metadata.has(key)) {
      return memoryStore.metadata.get(key).profile || null;
    }

    if (this.isTrustedDevice() && this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        const record = await new Promise<any>((resolve, reject) => {
          const tx = db.transaction('metadata', 'readonly');
          const store = tx.objectStore('metadata');
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
        return record?.profile || null;
      } catch {}
    }

    return null;
  }

  // ==========================================
  // PURGE ON LOGOUT OR UNTRUSTED EXIT
  // ==========================================

  public static async purgeUserData(userId: string): Promise<void> {
    if (!userId) return;

    // 1. Clear memory stores for this user
    memoryStore.drafts.forEach((_, k) => {
      if (k.startsWith(`${userId}:`)) memoryStore.drafts.delete(k);
    });
    memoryStore.syncQueue.forEach((item, k) => {
      if (item.userId === userId) memoryStore.syncQueue.delete(k);
    });
    memoryStore.scopedCache.forEach((_, k) => {
      if (k.startsWith(`${userId}:`)) memoryStore.scopedCache.delete(k);
    });
    memoryStore.metadata.delete(`verified_profile_${userId}`);

    // 2. Make purge completion an actual IndexedDB transaction commit.
    // Previously this method returned while four independent transactions
    // were still running. A fast account switch could observe old records,
    // or one failed transaction could leave only part of the data cleared.
    if (this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['drafts', 'syncQueue', 'scopedCache', 'metadata'], 'readwrite');
          const deleteForUser = (name: 'drafts' | 'syncQueue' | 'scopedCache') => {
            const store = tx.objectStore(name);
            const request = store.index('userId').getAllKeys(userId);
            request.onsuccess = () => {
              for (const key of request.result || []) store.delete(key);
            };
          };
          deleteForUser('drafts');
          deleteForUser('syncQueue');
          deleteForUser('scopedCache');
          tx.objectStore('metadata').delete(`verified_profile_${userId}`);
          tx.oncomplete = () => resolve();
          tx.onabort = tx.onerror = () => reject(tx.error || new Error('Pembersihan data akun tidak selesai.'));
        });
      } catch (err) {
        // Do not claim data was removed if browser storage denied the purge.
        console.warn('[OFFLINE_STORAGE] Error purging user data from IndexedDB:', err);
        // Retain logout behavior when the browser denies IndexedDB; server
        // session isolation still applies and account-scoped reads stay fenced.

      }
    }
  }

  /**
   * Returns exact counts of pending syncQueue items and unsaved drafts for a user.
   * Protects offline data from silent deletion during logout.
   */
  public static async getPendingCount(userId: string): Promise<{ syncQueueCount: number; draftsCount: number; total: number }> {
    if (!userId) return { syncQueueCount: 0, draftsCount: 0, total: 0 };
    // An unreadable persistent store is unknown, never a verified empty queue.
    const queueItems = await this.getSyncItemsByUser(userId, { strict: true });
    const pendingQueue = queueItems.filter(i => i.status === 'PENDING_NETWORK' || i.status === 'SENDING' || i.status === 'NEEDS_ACTION');
    const drafts = await this.listDraftsByUser(userId, undefined, { strict: true });
    return { syncQueueCount: pendingQueue.length, draftsCount: drafts.length, total: pendingQueue.length + drafts.length };
  }

  /**
   * Cleans display read cache ONLY for the active user without touching form drafts or sync queue items.
   * Ensures draft resilience while allowing users to free up display cache memory.
   */
  public static async clearDisplayCacheOnly(userId: string): Promise<void> {
    if (!userId) return;

    // 1. Purge from memory store
    memoryStore.scopedCache.forEach((_, k) => {
      if (k.startsWith(`${userId}:`)) memoryStore.scopedCache.delete(k);
    });

    // 2. Purge from IndexedDB scopedCache store
    if (this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('scopedCache', 'readwrite');
          const store = tx.objectStore('scopedCache');
          const req = store.index('userId').getAllKeys(userId);
          req.onsuccess = () => {
            for (const key of req.result || []) store.delete(key);
          };
          tx.oncomplete = () => resolve();
          tx.onabort = tx.onerror = () => reject(tx.error || new Error('Cache belum berhasil dibersihkan.'));
        });
      } catch (err) {
        console.warn('[OFFLINE_STORAGE] Error clearing display cache from IndexedDB:', err);
      }
    }
  }
}

