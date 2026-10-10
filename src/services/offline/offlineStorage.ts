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
      } else {
        localStorage.removeItem('piket_device_trusted_v2');
      }
    } catch {}
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
            resolve(request.result);
          };

          request.onerror = () => {
            reject(request.error || new Error('Failed to open IndexedDB'));
          };
        } catch (e) {
          reject(e);
        }
      });
    }

    return this.dbPromise;
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
      } catch {}
      return;
    }

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');
        const req = store.put(draft);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
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

  public static async listDraftsByUser(userId: string, formType?: string): Promise<DraftRecord[]> {
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
        req.onsuccess = () => {
          const items = (req.result || []) as DraftRecord[];
          if (formType) {
            resolve(items.filter((d) => d.formType === formType));
          } else {
            resolve(items);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
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

  public static async enqueueSyncItem(item: QueueItem): Promise<void> {
    if (!item.userId) return;

    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      memoryStore.syncQueue.set(item.operationId, item);
      return;
    }

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[OFFLINE_STORAGE] Failed to persist sync item to IndexedDB, fallback to memory:', err);
      memoryStore.syncQueue.set(item.operationId, item);
    }
  }

  public static async updateSyncItem(item: QueueItem): Promise<void> {
    await this.enqueueSyncItem(item);
  }

  public static async removeSyncItem(operationId: string): Promise<void> {
    memoryStore.syncQueue.delete(operationId);

    if (this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('syncQueue', 'readwrite');
          const store = tx.objectStore('syncQueue');
          const req = store.delete(operationId);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {}
    }
  }

  public static async getSyncItemsByUser(userId: string): Promise<QueueItem[]> {
    if (!userId) return [];

    let results: QueueItem[] = [];
    if (!this.isTrustedDevice() || !this.isIndexedDBSupported) {
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId) {
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
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      // Merge memory items in case any are pending flush
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId && !results.some((r) => r.operationId === item.operationId)) {
          results.push(item);
        }
      });
    } catch {
      memoryStore.syncQueue.forEach((item) => {
        if (item.userId === userId) {
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
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
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
          const req = store.put(payload);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
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

    // 2. Clear IndexedDB entries for this user
    if (this.isIndexedDBSupported) {
      try {
        const db = await this.getDb();
        // Remove drafts
        const tx1 = db.transaction('drafts', 'readwrite');
        const store1 = tx1.objectStore('drafts');
        const idx1 = store1.index('userId');
        const req1 = idx1.getAllKeys(userId);
        req1.onsuccess = () => {
          (req1.result || []).forEach((key) => store1.delete(key));
        };

        // Remove syncQueue
        const tx2 = db.transaction('syncQueue', 'readwrite');
        const store2 = tx2.objectStore('syncQueue');
        const idx2 = store2.index('userId');
        const req2 = idx2.getAllKeys(userId);
        req2.onsuccess = () => {
          (req2.result || []).forEach((key) => store2.delete(key));
        };

        // Remove scopedCache
        const tx3 = db.transaction('scopedCache', 'readwrite');
        const store3 = tx3.objectStore('scopedCache');
        const idx3 = store3.index('userId');
        const req3 = idx3.getAllKeys(userId);
        req3.onsuccess = () => {
          (req3.result || []).forEach((key) => store3.delete(key));
        };

        // Remove profile snapshot
        const tx4 = db.transaction('metadata', 'readwrite');
        tx4.objectStore('metadata').delete(`verified_profile_${userId}`);
      } catch (err) {
        console.warn('[OFFLINE_STORAGE] Error purging user data from IndexedDB:', err);
      }
    }
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
        const tx = db.transaction('scopedCache', 'readwrite');
        const store = tx.objectStore('scopedCache');
        const idx = store.index('userId');
        const req = idx.getAllKeys(userId);
        req.onsuccess = () => {
          (req.result || []).forEach((key) => store.delete(key));
        };
      } catch (err) {
        console.warn('[OFFLINE_STORAGE] Error clearing display cache from IndexedDB:', err);
      }
    }
  }
}
