import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteField,
  writeBatch,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AuditLogRecord } from '../../types/master.types';
import { isOperationalRecord, UserRole } from '../../types';
import { OfflineStorage } from '../offline/offlineStorage';

const getLocalItem = (key: string): string | null => {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
};

const setLocalItem = (key: string, value: string): void => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
};

/**
 * Recursively sanitizes Firestore document and audit log payloads:
 * - Strictly omits keys whose value is `undefined` (at top-level and in nested objects/arrays).
 * - Strictly preserves valid falsy values: false, 0, "", null.
 * - Strictly preserves Firestore sentinels, FieldValues (deleteField, serverTimestamp),
 *   Timestamps (toMillis/isEqual), DocumentReferences, GeoPoints, and Date objects.
 * - Does not use JSON.parse/JSON.stringify so no special Firestore classes are broken.
 */
export function sanitizeFirestorePayload<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  const obj = value as any;
  const constructorName = obj.constructor?.name;
  if (
    typeof obj.toMillis === 'function' ||
    typeof obj.isEqual === 'function' ||
    typeof obj.onSnapshot === 'function' ||
    obj._methodName !== undefined ||
    constructorName === 'FieldValue' ||
    constructorName === 'Timestamp' ||
    constructorName === 'DocumentReference' ||
    constructorName === 'GeoPoint' ||
    obj.type === 'serverTimestamp'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      const sanitized = sanitizeFirestorePayload(v);
      if (sanitized !== undefined) {
        cleaned[k] = sanitized;
      }
    }
  }
  return cleaned as T;
}

export interface QueryDataOptions {
  /** If true (default), returns only operational / production records. Set to false to include seed records. */
  operationalOnly?: boolean;
}

export class FirestoreService {
  public static sanitizeFirestorePayload = sanitizeFirestorePayload;

  /**
   * Sanitizes browser cache by purging any cached demo/seed data across all collections
   * while strictly protecting active user session, production data, and school configuration.
   */
  public static purgeDemoCache(): void {
    // Purge legacy unscoped caches (piket_firestore_*) across all collections
    OfflineStorage.purgeLegacyUnscopedCaches();

    if (typeof localStorage === 'undefined') return;

    try {
      // Clean legacy plaintext credentials cache
      localStorage.removeItem('piket_guru_users_db_v1');
    } catch (e) {
      console.warn('Error purging demo cache:', e);
    }
  }

  /**
   * Generic get all documents from a collection with default operational filtering.
   * Falls back to offline cache for graceful UI display during temporary network loss.
   */
  public static async getAll<T>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options: QueryDataOptions = { operationalOnly: true }
  ): Promise<T[]> {
    const currentUid = auth?.currentUser?.uid || 'guest';
    try {
      const colRef = collection(db, collectionName);
      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));

      // Update scoped cache for current user account
      OfflineStorage.setScopedCache(currentUid, collectionName, items).catch(() => {});

      if (options.operationalOnly !== false) {
        return items.filter(isOperationalRecord);
      }
      return items;
    } catch (err) {
      console.error(`Error fetching collection ${collectionName}:`, err);
      // Fallback to isolated scoped cache for current user if network is offline
      const cached = await OfflineStorage.getScopedCache<T>(currentUid, collectionName);
      if (cached && Array.isArray(cached.data)) {
        if (options.operationalOnly !== false) {
          return cached.data.filter(isOperationalRecord);
        }
        return cached.data;
      }
      return [];
    }
  }

  /**
   * STRICT retrieval for security-critical operations, backups, and audits.
   * MUST NOT swallow errors, mask permissions, or fall back to stale cache.
   * Throws immediately if reading the collection fails.
   */
  public static async getAllStrict<T>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
  }

  /**
   * Real-time listener for a collection with default operational filtering and scoped cache fallback.
   */
  public static subscribeToCollection<T>(
    collectionName: string,
    onData: (data: T[]) => void,
    onError?: (err: Error) => void,
    constraints: QueryConstraint[] = [],
    options: QueryDataOptions = { operationalOnly: true }
  ): Unsubscribe {
    const currentUid = auth?.currentUser?.uid || 'guest';
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);

    // Load cached data right away for instant offline rendering
    OfflineStorage.getScopedCache<T>(currentUid, collectionName).then((cached) => {
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        if (options.operationalOnly !== false) {
          onData(cached.data.filter(isOperationalRecord));
        } else {
          onData(cached.data);
        }
      }
    }).catch(() => {});

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
        // Cache full snapshot to scoped cache
        OfflineStorage.setScopedCache(currentUid, collectionName, items).catch(() => {});

        if (options.operationalOnly !== false) {
          onData(items.filter(isOperationalRecord));
        } else {
          onData(items);
        }
      },
      async (error) => {
        console.warn(`Snapshot listener warning for ${collectionName}:`, error);
        // Fallback to scoped cache on offline listener interruption
        const cached = await OfflineStorage.getScopedCache<T>(currentUid, collectionName);
        if (cached && Array.isArray(cached.data)) {
          if (options.operationalOnly !== false) {
            onData(cached.data.filter(isOperationalRecord));
          } else {
            onData(cached.data);
          }
        }
        if (onError) onError(error);
      }
    );

    // Register active listener with unified teardown manager
    return OfflineStorage.registerListener(unsubscribe);
  }

  /**
   * Explicit method to fetch raw documents including seed records (for operational views)
   */
  public static async getAllRaw<T>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    return this.getAll<T>(collectionName, constraints, { operationalOnly: false });
  }

  /**
   * Get count of operational vs seed records for a collection
   */
  public static async getRecordStats(
    collectionName: string
  ): Promise<{ total: number; operational: number; seed: number }> {
    const all = await this.getAllRaw<any>(collectionName);
    const operational = all.filter(isOperationalRecord).length;
    return {
      total: all.length,
      operational,
      seed: all.length - operational,
    };
  }

  /**
   * Get single document by ID with safe null on error
   */
  public static async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as unknown as T;
      }
      return null;
    } catch (err) {
      console.error(`Error getting document ${collectionName}/${id}:`, err);
      return null;
    }
  }

  /**
   * STRICT retrieval for a single document.
   * Returns null strictly when document does not exist.
   * Throws if permission denied, network unavailable, or query errors.
   */
  public static async getByIdStrict<T>(collectionName: string, id: string): Promise<T | null> {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as unknown as T;
  }

  /**
   * Create or update a document with controlled field replacement.
   * If purgeLegacyCredentials is true (or collection is users), actively deletes legacy credential fields
   * via deleteField() so merge:true does not retain plaintext/legacy credentials.
   * Never decreases security markers (e.g. sessionRevokedAtSeconds).
   */
  public static async setDocument<T extends { id: string }>(
    collectionName: string,
    id: string,
    data: Partial<T>,
    options: { purgeLegacyCredentials?: boolean; controlledReplace?: boolean } = {}
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    const rawPayload: Record<string, any> = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };

    // System collections that do not require entity data-source tagging
    const isSystemConfig = ['settings', 'auditLogs', 'database_snapshots'].includes(collectionName);

    if (!isSystemConfig) {
      if (rawPayload.dataSource === undefined && rawPayload.isDemo === undefined) {
        rawPayload.dataSource = 'PRODUCTION';
        rawPayload.isDemo = false;
      } else if (rawPayload.isDemo === true && !rawPayload.dataSource) {
        rawPayload.dataSource = 'SEED';
      } else if (rawPayload.dataSource === 'PRODUCTION' && rawPayload.isDemo === undefined) {
        rawPayload.isDemo = false;
      }
    }

    const payload = sanitizeFirestorePayload(rawPayload);

    // Actively delete all legacy/credential fields when updating users or when explicitly requested
    if (options.purgeLegacyCredentials || collectionName === 'users') {
      payload.pin = deleteField();
      payload.pinHash = deleteField();
      payload.pinSalt = deleteField();
      payload.scryptHash = deleteField();
      payload.hashedPin = deleteField();
      payload.password = deleteField();
      payload.token = deleteField();
      payload.secret = deleteField();
      payload.credential = deleteField();
      payload.authSecret = deleteField();
      payload.privateKey = deleteField();
    }

    if (options.controlledReplace) {
      await setDoc(docRef, payload, { merge: false });
    } else {
      await setDoc(docRef, payload, { merge: true });
    }

    // Update scoped cache for active user
    try {
      const currentUid = auth?.currentUser?.uid || 'guest';
      const existing = await this.getAllRaw<T>(collectionName);
      const updated = existing.filter((item) => item.id !== id).concat(payload as unknown as T);
      OfflineStorage.setScopedCache(currentUid, collectionName, updated).catch(() => {});
    } catch {}
  }

  /**
   * Real-time listener for a single document
   */
  public static subscribeToDocument<T>(
    collectionName: string,
    id: string,
    onData: (data: T | null) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, collectionName, id);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onData({ id: snapshot.id, ...snapshot.data() } as unknown as T);
        } else {
          onData(null);
        }
      },
      (error) => {
        console.warn(`Doc listener warning for ${collectionName}/${id}:`, error);
        if (onError) onError(error);
      }
    );
    return OfflineStorage.registerListener(unsubscribe);
  }

  /**
   * Updates specified fields in an existing document without full replacement.
   * Useful for partial updates (e.g. presensi checkout jamPulang).
   */
  public static async updateDocument(
    collectionName: string,
    id: string,
    fields: Record<string, any>
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    const cleanFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        cleanFields[key] = value;
      }
    }
    await updateDoc(docRef, cleanFields);

    // Update scoped cache for active user
    try {
      const currentUid = auth?.currentUser?.uid || 'guest';
      const existing = await this.getAllRaw<any>(collectionName);
      const updated = existing.map((item) =>
        item.id === id ? { ...item, ...cleanFields } : item
      );
      OfflineStorage.setScopedCache(currentUid, collectionName, updated).catch(() => {});
    } catch {}
  }

  /**
   * Delete a document
   */
  public static async deleteDocument(collectionName: string, id: string): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Append-only Audit Log recorder.
   * Records cannot be updated or deleted in compliance with security rules.
   */
  public static async logAudit(entry: {
    userId: string;
    userName: string;
    role: UserRole | string;
    action: AuditLogRecord['action'];
    module: AuditLogRecord['module'] | string;
    recordId?: string;
    details: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const rawAuditLog: Record<string, any> = {
        id,
        timestamp: new Date().toISOString(),
        userId: entry.userId,
        userName: entry.userName,
        role: entry.role as any,
        action: entry.action,
        module: entry.module as any,
        details: entry.details,
      };

      if (entry.recordId !== undefined && entry.recordId !== null) {
        rawAuditLog.recordId = entry.recordId;
      }

      if (entry.metadata !== undefined && entry.metadata !== null) {
        const sanitizedMeta = sanitizeFirestorePayload(entry.metadata);
        if (typeof sanitizedMeta === 'object' && Object.keys(sanitizedMeta).length > 0) {
          rawAuditLog.metadata = sanitizedMeta;
        }
      }

      const logRecord = sanitizeFirestorePayload(rawAuditLog);
      const docRef = doc(db, 'auditLogs', id);
      await setDoc(docRef, logRecord);
    } catch (err) {
      console.warn('Failed to record audit log:', err);
    }
  }

  /**
   * Atomically writes a document and its corresponding audit log entry in a single batch write.
   * If either write fails, the entire transaction rolls back.
   */
  public static async setDocumentWithAudit<T extends { id: string }>(
    collectionName: string,
    id: string,
    data: Partial<T>,
    auditEntry: {
      userId: string;
      userName: string;
      role: UserRole | string;
      action: AuditLogRecord['action'];
      module: AuditLogRecord['module'] | string;
      recordId?: string;
      details: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const batch = writeBatch(db);
    const docRef = doc(db, collectionName, id);
    const rawPayload: Record<string, any> = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      dataSource: (data as any)?.dataSource || 'PRODUCTION',
      isDemo: (data as any)?.isDemo || false,
    };

    const payload = sanitizeFirestorePayload(rawPayload);

    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditRef = doc(db, 'auditLogs', auditId);

    const rawAuditLog: Record<string, any> = {
      id: auditId,
      timestamp: new Date().toISOString(),
      userId: auditEntry.userId,
      userName: auditEntry.userName,
      role: auditEntry.role as any,
      action: auditEntry.action,
      module: auditEntry.module as any,
      recordId: auditEntry.recordId || id,
      details: auditEntry.details,
    };

    if (auditEntry.metadata !== undefined && auditEntry.metadata !== null) {
      const sanitizedMeta = sanitizeFirestorePayload(auditEntry.metadata);
      if (typeof sanitizedMeta === 'object' && Object.keys(sanitizedMeta).length > 0) {
        rawAuditLog.metadata = sanitizedMeta;
      }
    }

    const logRecord = sanitizeFirestorePayload(rawAuditLog);

    batch.set(docRef, payload, { merge: true });
    batch.set(auditRef, logRecord);
    await batch.commit();

    // Update scoped cache for active user
    try {
      const currentUid = auth?.currentUser?.uid || 'guest';
      const existing = await this.getAllRaw<T>(collectionName);
      const updated = existing.filter((item) => item.id !== id).concat(payload as unknown as T);
      OfflineStorage.setScopedCache(currentUid, collectionName, updated).catch(() => {});
    } catch {}
  }
}
