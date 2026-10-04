import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { adminDb } from '../firebaseAdmin.js';

export interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

export interface InFlightLease {
  leaseToken: string;
  idKey: string;
  ipKey: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface SharedStoreState {
  records: Record<string, AttemptRecord>;
  leases: Record<string, InFlightLease>;
}

export interface LockStatus {
  locked: boolean;
  remainingSeconds?: number;
}

export interface FailureRecordResult {
  locked: boolean;
  remainingAttempts: number;
  lockoutSeconds?: number;
}

export interface AcquireResult {
  admitted: boolean;
  leaseToken?: string;
}

export class StoreUnavailableError extends Error {
  constructor(message: string = 'Rate limit store is unavailable') {
    super(message);
    this.name = 'StoreUnavailableError';
  }
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CONCURRENT_IN_FLIGHT_PER_ID = 5; // Max 5 concurrent per account
const MAX_CONCURRENT_IN_FLIGHT_PER_IP = 15; // Max 15 concurrent per IP
const IN_FLIGHT_LEASE_TTL_MS = 30 * 1000; // 30 seconds lease TTL for crash recovery
const LEASE_HEARTBEAT_INTERVAL_MS = 10 * 1000; // 10s heartbeat renewal

/**
 * Strict typed key canonicalizers to prevent raw prefix injection / collision.
 * Domain is explicitly and unconditionally prefixed.
 */
export function toAccountIdKey(rawId: string): string {
  return `id:${encodeURIComponent((rawId || '').trim())}`;
}

export function toIpKey(rawIp: string): string {
  return `ip:${encodeURIComponent((rawIp || '').trim())}`;
}

export function toActionKey(actionName: string, rawTargetId: string): string {
  return `act:${encodeURIComponent((actionName || '').trim())}:${encodeURIComponent((rawTargetId || '').trim())}`;
}

/**
 * Universal canonicalizer for backward compatibility that preserves typed domains.
 */
export function toCanonicalKey(key: string, defaultNamespace = 'id'): string {
  const trimmed = (key || '').trim();
  if (trimmed.startsWith('id:') || trimmed.startsWith('ip:') || trimmed.startsWith('act:')) {
    return trimmed;
  }
  if (defaultNamespace === 'ip') return toIpKey(trimmed);
  if (defaultNamespace === 'act') return toActionKey('default', trimmed);
  return toAccountIdKey(trimmed);
}

/**
 * Pluggable Store Driver Interface (R10-01, R12-01, R13-01)
 */
export interface RateLimitStoreDriver {
  name: string;
  isHealthy(): Promise<boolean>;
  isLocked(canonicalKey: string): Promise<LockStatus>;
  recordFailureCombined(params: {
    idKey: string;
    ipKey: string;
    actKey?: string;
    threshold: number;
    lockoutDuration: number;
  }): Promise<FailureRecordResult>;
  tryAcquireDualInFlight(params: {
    idKey: string;
    ipKey: string;
    maxId: number;
    maxIp: number;
    leaseTtlMs: number;
  }): Promise<AcquireResult>;
  renewDualInFlight(leaseToken: string, extensionMs: number): Promise<boolean>;
  releaseDualInFlight(leaseToken: string): Promise<void>;
  reset(canonicalKey: string): Promise<void>;
  clearAll(): Promise<void>;
  dumpState(): Promise<SharedStoreState>;
}

/**
 * Local File-Based Store Driver with OS-level locking, atomic write, per-token leases, and renewal.
 * Strictly permitted only in development and isolated unit test environments.
 */
export class LocalFileStoreDriver implements RateLimitStoreDriver {
  public readonly name = 'local_file';
  private filePath: string;
  private lockPath: string;
  private inMemoryLocks = new Map<string, Promise<void>>();

  constructor(customFilePath?: string) {
    this.filePath =
      customFilePath ||
      process.env.RATE_LIMIT_STORE_FILE ||
      path.join(process.env.TMPDIR || '/tmp', 'piket_ratelimit_store.json');
    this.lockPath = `${this.filePath}.oslock`;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
  }

  private async acquireMemoryLocks(keys: string[]): Promise<() => void> {
    const uniqueSortedKeys = Array.from(new Set(keys.filter(Boolean))).sort();
    const releaseFns: Array<() => void> = [];

    for (const key of uniqueSortedKeys) {
      while (this.inMemoryLocks.has(key)) {
        await this.inMemoryLocks.get(key);
      }
      let resolver: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => {
        resolver = resolve;
      });
      this.inMemoryLocks.set(key, lockPromise);
      releaseFns.push(() => {
        this.inMemoryLocks.delete(key);
        resolver();
      });
    }

    return () => {
      for (let i = releaseFns.length - 1; i >= 0; i--) {
        releaseFns[i]();
      }
    };
  }

  private async acquireFileLock(maxWaitMs = 3000): Promise<(() => void) | null> {
    this.ensureDirectory();
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        const fd = fs.openSync(this.lockPath, 'wx');
        fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
        fs.closeSync(fd);

        return () => {
          try {
            if (fs.existsSync(this.lockPath)) {
              fs.unlinkSync(this.lockPath);
            }
          } catch {}
        };
      } catch (e: any) {
        if (e.code === 'EEXIST') {
          try {
            const stat = fs.statSync(this.lockPath);
            if (Date.now() - stat.mtimeMs > 4000) {
              fs.unlinkSync(this.lockPath);
              continue;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 15)));
        } else {
          return null;
        }
      }
    }

    return null;
  }

  private pruneExpiredLeases(leases: Record<string, InFlightLease>, now: number): void {
    for (const [token, lease] of Object.entries(leases)) {
      if (!lease || typeof lease.expiresAt !== 'number' || now >= lease.expiresAt) {
        delete leases[token];
      }
    }
  }

  private async withAtomicState<T>(
    lockKeys: string[],
    fn: (state: SharedStoreState) => T
  ): Promise<T> {
    const releaseMem = await this.acquireMemoryLocks(lockKeys);
    const releaseFile = await this.acquireFileLock();

    if (!releaseFile) {
      releaseMem();
      throw new StoreUnavailableError('Failed to acquire atomic store file lock.');
    }

    try {
      let state: SharedStoreState = { records: {}, leases: {} };
      const now = Date.now();

      if (fs.existsSync(this.filePath)) {
        try {
          const raw = fs.readFileSync(this.filePath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            state.records = parsed.records || {};
            state.leases = parsed.leases || {};
          }
        } catch (readErr) {
          throw new StoreUnavailableError(`Failed to read/parse store: ${(readErr as any)?.message}`);
        }
      }

      // Prune expired leases
      this.pruneExpiredLeases(state.leases, now);

      const result = fn(state);

      const tempFile = `${this.filePath}.${process.pid}.${now}.${Math.random().toString(36).substring(2)}.tmp`;
      try {
        fs.writeFileSync(tempFile, JSON.stringify(state), 'utf8');
        fs.renameSync(tempFile, this.filePath);
      } catch (writeErr) {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {}
        throw new StoreUnavailableError(`Failed to persist store state: ${(writeErr as any)?.message}`);
      }

      return result;
    } finally {
      releaseFile();
      releaseMem();
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      this.ensureDirectory();
      return true;
    } catch {
      return false;
    }
  }

  public async isLocked(canonicalKey: string): Promise<LockStatus> {
    return this.withAtomicState([canonicalKey], (state) => {
      const record = state.records[canonicalKey];
      if (!record) return { locked: false };

      const now = Date.now();
      if (record.lockedUntil && record.lockedUntil > now) {
        return {
          locked: true,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }

      if (record.lockedUntil && record.lockedUntil <= now) {
        record.lockedUntil = null;
        record.count = 0;
        record.firstAttempt = now;
        state.records[canonicalKey] = record;
      }

      return { locked: false };
    });
  }

  private recordFailureInState(
    records: Record<string, AttemptRecord>,
    key: string,
    now: number,
    threshold: number,
    lockoutDuration: number
  ): { locked: boolean; remainingAttempts: number; remainingSeconds?: number } {
    let record = records[key];

    if (!record || now - record.firstAttempt > WINDOW_DURATION_MS) {
      record = { count: 1, firstAttempt: now, lastAttempt: now, lockedUntil: null };
    } else {
      record.count += 1;
      record.lastAttempt = now;
    }

    let locked = false;
    let remainingSeconds: number | undefined;

    if (record.count >= threshold) {
      record.lockedUntil = now + lockoutDuration;
      locked = true;
      remainingSeconds = Math.ceil(lockoutDuration / 1000);
    }

    records[key] = record;
    const remainingAttempts = Math.max(0, threshold - record.count);

    return { locked, remainingAttempts, remainingSeconds };
  }

  public async recordFailureCombined(params: {
    idKey: string;
    ipKey: string;
    actKey?: string;
    threshold: number;
    lockoutDuration: number;
  }): Promise<FailureRecordResult> {
    const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;
    const lockKeys = [idKey, ipKey, actKey || ''].filter(Boolean);

    return this.withAtomicState(lockKeys, (state) => {
      const now = Date.now();

      // 1. Record ID failure
      const idResult = this.recordFailureInState(state.records, idKey, now, threshold, lockoutDuration);

      // 2. Record Action failure if key provided
      let actResult: { locked: boolean; remainingAttempts: number; remainingSeconds?: number } = {
        locked: false,
        remainingAttempts: 0,
      };
      if (actKey) {
        actResult = this.recordFailureInState(state.records, actKey, now, threshold, lockoutDuration);
      }

      // 3. Record IP failure EXACTLY ONCE
      const ipResult = this.recordFailureInState(state.records, ipKey, now, threshold * 3, lockoutDuration);

      const isLocked = idResult.locked || actResult.locked || ipResult.locked;
      const lockoutSeconds = idResult.remainingSeconds || actResult.remainingSeconds || ipResult.remainingSeconds;

      return {
        locked: isLocked,
        remainingAttempts: idResult.remainingAttempts,
        lockoutSeconds,
      };
    });
  }

  public async tryAcquireDualInFlight(params: {
    idKey: string;
    ipKey: string;
    maxId: number;
    maxIp: number;
    leaseTtlMs: number;
  }): Promise<AcquireResult> {
    const { idKey, ipKey, maxId, maxIp, leaseTtlMs } = params;

    return this.withAtomicState([idKey, ipKey], (state) => {
      const now = Date.now();

      let activeIdCount = 0;
      let activeIpCount = 0;

      for (const lease of Object.values(state.leases)) {
        if (lease.expiresAt > now) {
          if (lease.idKey === idKey) activeIdCount++;
          if (lease.ipKey === ipKey) activeIpCount++;
        }
      }

      if (activeIdCount >= maxId || activeIpCount >= maxIp) {
        return { admitted: false };
      }

      const leaseToken = `lease_${process.pid}_${now}_${Math.random().toString(36).slice(2, 10)}`;
      state.leases[leaseToken] = {
        leaseToken,
        idKey,
        ipKey,
        acquiredAt: now,
        expiresAt: now + leaseTtlMs,
      };

      return { admitted: true, leaseToken };
    });
  }

  public async renewDualInFlight(leaseToken: string, extensionMs: number): Promise<boolean> {
    if (!leaseToken) return false;
    try {
      return await this.withAtomicState([], (state) => {
        const lease = state.leases[leaseToken];
        if (lease) {
          lease.expiresAt = Date.now() + extensionMs;
          return true;
        }
        return false;
      });
    } catch {
      return false;
    }
  }

  public async releaseDualInFlight(leaseToken: string): Promise<void> {
    if (!leaseToken) return;
    try {
      await this.withAtomicState([], (state) => {
        if (state.leases[leaseToken]) {
          delete state.leases[leaseToken];
        }
      });
    } catch {}
  }

  public async reset(canonicalKey: string): Promise<void> {
    try {
      await this.withAtomicState([canonicalKey], (state) => {
        delete state.records[canonicalKey];
      });
    } catch (err: any) {
      throw new StoreUnavailableError(`Reset failed: ${err?.message}`);
    }
  }

  public async clearAll(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
      if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath);
    } catch {}
  }

  public async dumpState(): Promise<SharedStoreState> {
    return this.withAtomicState([], (state) => JSON.parse(JSON.stringify(state)));
  }
}

/**
 * Atomic Transaction Transport Interface for Centralized Store Adapters (R12-01, R13-01).
 * Abstracts Firestore Admin SDK transactions or injected mock transactions in tests.
 */
export interface AtomicTransactionTransport {
  runTransaction<T>(
    updateFn: (tx: {
      get(key: string): Promise<any>;
      set(key: string, data: any): void;
      delete(key: string): void;
    }) => Promise<T>
  ): Promise<T>;
  isHealthy(): Promise<boolean>;
}

/**
 * Creates an AtomicTransactionTransport over Firebase Admin Firestore instance
 */
export function createFirestoreAdminTransport(db: any): AtomicTransactionTransport {
  const collectionPath = '_sys_rate_limiter';
  return {
    async isHealthy(): Promise<boolean> {
      if (!db || typeof db.collection !== 'function') return false;
      try {
        await db.collection(collectionPath).doc('_ping').get();
        return true;
      } catch {
        return false;
      }
    },
    async runTransaction<T>(
      updateFn: (tx: {
        get(key: string): Promise<any>;
        set(key: string, data: any): void;
        delete(key: string): void;
      }) => Promise<T>
    ): Promise<T> {
      if (!db || typeof db.runTransaction !== 'function') {
        throw new StoreUnavailableError('Firestore db runTransaction is unavailable');
      }
      return db.runTransaction(async (firestoreTx: any) => {
        const txAdapter = {
          async get(key: string) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            const snap = await firestoreTx.get(ref);
            return snap.exists ? snap.data() : null;
          },
          set(key: string, data: any) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            firestoreTx.set(ref, data, { merge: true });
          },
          delete(key: string) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            firestoreTx.delete(ref);
          },
        };
        return updateFn(txAdapter);
      });
    },
  };
}

/**
 * In-Memory Transaction Transport for Unit Testing across Independent Client Instances (R12-01, R13-01, R13-03)
 * Enforces Read-Before-Write Firestore SDK contracts, staging drafts, and atomic rollback on error.
 */
export function createInMemoryTransactionTransport(initialHealthy = true): AtomicTransactionTransport & {
  setHealthy(healthy: boolean): void;
  getRawData(): Map<string, any>;
} {
  const store = new Map<string, any>();
  let healthy = initialHealthy;
  let lockChain = Promise.resolve();

  return {
    setHealthy(h: boolean) {
      healthy = h;
    },
    getRawData() {
      return store;
    },
    async isHealthy(): Promise<boolean> {
      return healthy;
    },
    async runTransaction<T>(
      updateFn: (tx: {
        get(key: string): Promise<any>;
        set(key: string, data: any): void;
        delete(key: string): void;
      }) => Promise<T>
    ): Promise<T> {
      if (!healthy) {
        throw new StoreUnavailableError('Shared transport backend is unavailable.');
      }
      let releaseLock: () => void;
      const nextLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const currentLock = lockChain;
      lockChain = lockChain.then(() => nextLock);

      await currentLock;
      try {
        const draft = new Map<string, any>();
        for (const [k, v] of store.entries()) {
          draft.set(k, JSON.parse(JSON.stringify(v)));
        }

        let hasWritten = false;

        const tx = {
          async get(key: string) {
            if (hasWritten) {
              throw new Error('Firestore Transaction Contract Violation: Reads must come before all writes.');
            }
            const val = draft.get(key);
            return val ? JSON.parse(JSON.stringify(val)) : null;
          },
          set(key: string, data: any) {
            hasWritten = true;
            draft.set(key, JSON.parse(JSON.stringify(data)));
          },
          delete(key: string) {
            hasWritten = true;
            draft.delete(key);
          },
        };

        const result = await updateFn(tx);

        // COMMIT: apply draft to store atomically
        store.clear();
        for (const [k, v] of draft.entries()) {
          store.set(k, v);
        }

        return result;
      } catch (err) {
        // ROLLBACK: store is untouched on error
        throw err;
      } finally {
        releaseLock!();
      }
    },
  };
}

/**
 * Real Production Centralized Store Driver powered by Firestore or Atomic Transport (R12-01, R13-01).
 * Strictly enforced Read-Compute-Write phase contract for all Firestore transactions.
 */
export class FirestoreStoreDriver implements RateLimitStoreDriver {
  public readonly name = 'firestore_centralized';
  private transport: AtomicTransactionTransport;

  constructor(transportOrDb?: any) {
    if (transportOrDb && typeof transportOrDb.runTransaction === 'function') {
      if (typeof transportOrDb.isHealthy === 'function') {
        this.transport = transportOrDb;
      } else {
        this.transport = createFirestoreAdminTransport(transportOrDb);
      }
    } else if (adminDb && typeof adminDb.collection === 'function') {
      this.transport = createFirestoreAdminTransport(adminDb);
    } else {
      this.transport = {
        async isHealthy() {
          return false;
        },
        async runTransaction() {
          throw new StoreUnavailableError('Firestore adminDb unavailable or unconfigured');
        },
      };
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      return await this.transport.isHealthy();
    } catch {
      return false;
    }
  }

  public async isLocked(canonicalKey: string): Promise<LockStatus> {
    return this.transport.runTransaction(async (tx) => {
      // Phase 1: READ
      const record = await tx.get(`records:${canonicalKey}`);
      if (!record) return { locked: false };
      const now = Date.now();
      if (record.lockedUntil && record.lockedUntil > now) {
        return {
          locked: true,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }
      if (record.lockedUntil && record.lockedUntil <= now) {
        // Phase 3: WRITE
        tx.delete(`records:${canonicalKey}`);
      }
      return { locked: false };
    });
  }

  public async recordFailureCombined(params: {
    idKey: string;
    ipKey: string;
    actKey?: string;
    threshold: number;
    lockoutDuration: number;
  }): Promise<FailureRecordResult> {
    const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;

    return this.transport.runTransaction(async (tx) => {
      // Phase 1: READ ALL
      const idRecord = await tx.get(`records:${idKey}`);
      const actRecord = actKey ? await tx.get(`records:${actKey}`) : null;
      const ipRecord = await tx.get(`records:${ipKey}`);

      // Phase 2: COMPUTE
      const now = Date.now();
      const computeOne = (rec: any, limit: number) => {
        let record = rec ? { ...rec } : { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: null };
        if (now - record.firstAttempt > WINDOW_DURATION_MS) {
          record = { count: 1, firstAttempt: now, lastAttempt: now, lockedUntil: null };
        } else {
          record.count++;
          record.lastAttempt = now;
        }

        let locked = false;
        let remainingSeconds: number | undefined;
        if (record.count >= limit) {
          record.lockedUntil = now + lockoutDuration;
          locked = true;
          remainingSeconds = Math.ceil(lockoutDuration / 1000);
        }
        return { record, locked, remainingAttempts: Math.max(0, limit - record.count), remainingSeconds };
      };

      const idRes = computeOne(idRecord, threshold);
      const actRes = actKey
        ? computeOne(actRecord, threshold)
        : { record: null, locked: false, remainingAttempts: 0, remainingSeconds: undefined };
      const ipRes = computeOne(ipRecord, threshold * 3);

      // Phase 3: WRITE ALL
      tx.set(`records:${idKey}`, idRes.record);
      if (actKey && actRes.record) {
        tx.set(`records:${actKey}`, actRes.record);
      }
      tx.set(`records:${ipKey}`, ipRes.record);

      return {
        locked: idRes.locked || actRes.locked || ipRes.locked,
        remainingAttempts: idRes.remainingAttempts,
        lockoutSeconds: idRes.remainingSeconds || actRes.remainingSeconds || ipRes.remainingSeconds,
      };
    });
  }

  public async tryAcquireDualInFlight(params: {
    idKey: string;
    ipKey: string;
    maxId: number;
    maxIp: number;
    leaseTtlMs: number;
  }): Promise<AcquireResult> {
    const { idKey, ipKey, maxId, maxIp, leaseTtlMs } = params;

    return this.transport.runTransaction(async (tx) => {
      // Phase 1: READ ALL
      const now = Date.now();
      const leaseRegistry = (await tx.get('leases:registry')) || { activeTokens: [] };
      const activeTokensList: string[] = leaseRegistry.activeTokens || [];
      const leaseDocs: Array<{ token: string; doc: any }> = [];

      for (const token of activeTokensList) {
        const doc = await tx.get(`leases:${token}`);
        leaseDocs.push({ token, doc });
      }

      // Phase 2: COMPUTE
      const validTokens: string[] = [];
      const expiredTokens: string[] = [];
      let activeIdCount = 0;
      let activeIpCount = 0;

      for (const { token, doc } of leaseDocs) {
        if (doc && doc.expiresAt > now) {
          validTokens.push(token);
          if (doc.idKey === idKey) activeIdCount++;
          if (doc.ipKey === ipKey) activeIpCount++;
        } else {
          expiredTokens.push(token);
        }
      }

      if (activeIdCount >= maxId || activeIpCount >= maxIp) {
        // Phase 3: WRITE ALL
        for (const expToken of expiredTokens) {
          tx.delete(`leases:${expToken}`);
        }
        tx.set('leases:registry', { activeTokens: validTokens });
        return { admitted: false };
      }

      const leaseToken = `dist_lease_${now}_${Math.random().toString(36).slice(2, 10)}`;
      const newLease: InFlightLease = {
        leaseToken,
        idKey,
        ipKey,
        acquiredAt: now,
        expiresAt: now + leaseTtlMs,
      };
      validTokens.push(leaseToken);

      // Phase 3: WRITE ALL
      for (const expToken of expiredTokens) {
        tx.delete(`leases:${expToken}`);
      }
      tx.set(`leases:${leaseToken}`, newLease);
      tx.set('leases:registry', { activeTokens: validTokens });

      return { admitted: true, leaseToken };
    });
  }

  public async renewDualInFlight(leaseToken: string, extensionMs: number): Promise<boolean> {
    if (!leaseToken) return false;
    try {
      return await this.transport.runTransaction(async (tx) => {
        // Phase 1: READ ALL
        const lease = await tx.get(`leases:${leaseToken}`);

        // Phase 2: COMPUTE
        if (!lease || lease.expiresAt <= Date.now()) {
          return false;
        }

        // Phase 3: WRITE ALL
        lease.expiresAt = Date.now() + extensionMs;
        tx.set(`leases:${leaseToken}`, lease);
        return true;
      });
    } catch {
      return false;
    }
  }

  public async releaseDualInFlight(leaseToken: string): Promise<void> {
    if (!leaseToken) return;
    try {
      await this.transport.runTransaction(async (tx) => {
        // Phase 1: READ ALL
        const lease = await tx.get(`leases:${leaseToken}`);
        const registry = (await tx.get('leases:registry')) || { activeTokens: [] };

        // Phase 2: COMPUTE
        if (!lease && !(registry.activeTokens || []).includes(leaseToken)) {
          return;
        }

        // Phase 3: WRITE ALL
        if (lease) {
          tx.delete(`leases:${leaseToken}`);
        }
        const updatedTokens = (registry.activeTokens || []).filter((t: string) => t !== leaseToken);
        tx.set('leases:registry', { activeTokens: updatedTokens });
      });
    } catch (err: any) {
      console.warn(`[RATE_LIMITER] releaseDualInFlight error for ${leaseToken}:`, err?.message || err);
      throw new StoreUnavailableError(`Release failed for token ${leaseToken}: ${err?.message}`);
    }
  }

  public async reset(canonicalKey: string): Promise<void> {
    await this.transport.runTransaction(async (tx) => {
      // Phase 1: READ ALL
      const record = await tx.get(`records:${canonicalKey}`);
      // Phase 3: WRITE ALL
      if (record) {
        tx.delete(`records:${canonicalKey}`);
      }
    });
  }

  public async clearAll(): Promise<void> {
    await this.transport.runTransaction(async (tx) => {
      // Phase 1: READ ALL
      const registry = (await tx.get('leases:registry')) || { activeTokens: [] };
      const tokens: string[] = registry.activeTokens || [];

      // Phase 3: WRITE ALL
      for (const t of tokens) {
        tx.delete(`leases:${t}`);
      }
      tx.delete('leases:registry');
    });
  }

  public async dumpState(): Promise<SharedStoreState> {
    return this.transport.runTransaction(async (tx) => {
      const registry = (await tx.get('leases:registry')) || { activeTokens: [] };
      const tokens: string[] = registry.activeTokens || [];
      const leaseDocs: Array<{ token: string; doc: any }> = [];

      for (const token of tokens) {
        const doc = await tx.get(`leases:${token}`);
        leaseDocs.push({ token, doc });
      }

      const leases: Record<string, InFlightLease> = {};
      for (const { token, doc } of leaseDocs) {
        if (doc) leases[token] = doc;
      }
      return { records: {}, leases };
    });
  }
}

/**
 * Shared Backend Memory for Test-Only Simulator
 */
class ClusterSharedBackend {
  private static clusters = new Map<string, SharedStoreState>();

  public static getClusterState(clusterName: string): SharedStoreState {
    if (!this.clusters.has(clusterName)) {
      this.clusters.set(clusterName, { records: {}, leases: {} });
    }
    return this.clusters.get(clusterName)!;
  }

  public static clearCluster(clusterName: string): void {
    this.clusters.set(clusterName, { records: {}, leases: {} });
  }
}

/**
 * Test-Only Simulator Store Driver (R12-01, R13-01)
 * Strictly prohibited in production environments.
 */
export class TestSimulatorStoreDriver implements RateLimitStoreDriver {
  public readonly name = 'test_simulator';
  private clusterName: string;
  private isSimulatedUnavailable = false;

  constructor(clusterName: string = 'test-cluster') {
    this.clusterName = clusterName;
  }

  public setUnavailable(unavailable: boolean): void {
    this.isSimulatedUnavailable = unavailable;
  }

  public async isHealthy(): Promise<boolean> {
    return !this.isSimulatedUnavailable;
  }

  private getSharedState(): SharedStoreState {
    if (this.isSimulatedUnavailable) throw new StoreUnavailableError('Simulator store backend is unavailable.');
    return ClusterSharedBackend.getClusterState(this.clusterName);
  }

  public async isLocked(canonicalKey: string): Promise<LockStatus> {
    const state = this.getSharedState();
    const record = state.records[canonicalKey];
    if (!record) return { locked: false };
    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      return { locked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    return { locked: false };
  }

  public async recordFailureCombined(params: {
    idKey: string;
    ipKey: string;
    actKey?: string;
    threshold: number;
    lockoutDuration: number;
  }): Promise<FailureRecordResult> {
    const state = this.getSharedState();
    const now = Date.now();
    const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;

    const recordOne = (key: string, limit: number) => {
      let rec = state.records[key] || { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: null };
      rec.count++;
      rec.lastAttempt = now;
      let locked = false;
      let remainingSeconds: number | undefined;
      if (rec.count >= limit) {
        rec.lockedUntil = now + lockoutDuration;
        locked = true;
        remainingSeconds = Math.ceil(lockoutDuration / 1000);
      }
      state.records[key] = rec;
      return { locked, remainingAttempts: Math.max(0, limit - rec.count), remainingSeconds };
    };

    const idRes = recordOne(idKey, threshold);
    const actRes = actKey ? recordOne(actKey, threshold) : { locked: false, remainingAttempts: 0, remainingSeconds: undefined };
    const ipRes = recordOne(ipKey, threshold * 3);

    return {
      locked: idRes.locked || actRes.locked || ipRes.locked,
      remainingAttempts: idRes.remainingAttempts,
      lockoutSeconds: idRes.remainingSeconds || actRes.remainingSeconds || ipRes.remainingSeconds,
    };
  }

  public async tryAcquireDualInFlight(params: {
    idKey: string;
    ipKey: string;
    maxId: number;
    maxIp: number;
    leaseTtlMs: number;
  }): Promise<AcquireResult> {
    const state = this.getSharedState();
    const now = Date.now();
    const { idKey, ipKey, maxId, maxIp, leaseTtlMs } = params;

    let activeIdCount = 0;
    let activeIpCount = 0;
    for (const lease of Object.values(state.leases)) {
      if (lease.expiresAt > now) {
        if (lease.idKey === idKey) activeIdCount++;
        if (lease.ipKey === ipKey) activeIpCount++;
      }
    }

    if (activeIdCount >= maxId || activeIpCount >= maxIp) {
      return { admitted: false };
    }

    const leaseToken = `sim_lease_${now}_${Math.random().toString(36).slice(2, 10)}`;
    state.leases[leaseToken] = {
      leaseToken,
      idKey,
      ipKey,
      acquiredAt: now,
      expiresAt: now + leaseTtlMs,
    };

    return { admitted: true, leaseToken };
  }

  public async renewDualInFlight(leaseToken: string, extensionMs: number): Promise<boolean> {
    if (!leaseToken) return false;
    try {
      const state = this.getSharedState();
      const lease = state.leases[leaseToken];
      if (lease) {
        lease.expiresAt = Date.now() + extensionMs;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async releaseDualInFlight(leaseToken: string): Promise<void> {
    try {
      const state = this.getSharedState();
      if (state.leases[leaseToken]) {
        delete state.leases[leaseToken];
      }
    } catch {}
  }

  public async reset(canonicalKey: string): Promise<void> {
    const state = this.getSharedState();
    delete state.records[canonicalKey];
  }

  public async clearAll(): Promise<void> {
    ClusterSharedBackend.clearCluster(this.clusterName);
  }

  public async dumpState(): Promise<SharedStoreState> {
    const state = this.getSharedState();
    return JSON.parse(JSON.stringify(state));
  }
}

/**
 * Blocked Store Driver that fails closed on all operations.
 * Returned when production environment is misconfigured.
 */
export class BlockedStoreDriver implements RateLimitStoreDriver {
  public readonly name = 'blocked_driver';
  private reason: string;

  constructor(reason: string) {
    this.reason = reason;
  }

  public async isHealthy(): Promise<boolean> {
    return false;
  }

  public async isLocked(_canonicalKey?: string): Promise<LockStatus> {
    throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
  }

  public async recordFailureCombined(): Promise<FailureRecordResult> {
    throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
  }

  public async tryAcquireDualInFlight(): Promise<AcquireResult> {
    throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
  }

  public async renewDualInFlight(): Promise<boolean> {
    return false;
  }

  public async releaseDualInFlight(): Promise<void> {}

  public async reset(): Promise<void> {
    throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
  }

  public async clearAll(): Promise<void> {}

  public async dumpState(): Promise<SharedStoreState> {
    return { records: {}, leases: {} };
  }
}

/**
 * Production Driver Factory & Strict Configuration Gate (R10-01, R12-01, R13-01)
 */
export function createStoreDriverFromConfig(
  env: {
    NODE_ENV?: string;
    RATE_LIMIT_STORE_DRIVER?: string;
    DISTRIBUTED_STORE_CLUSTER?: string;
  },
  customDb?: any
): RateLimitStoreDriver {
  const isProduction = env.NODE_ENV === 'production';
  const driverType = (env.RATE_LIMIT_STORE_DRIVER || '').trim();
  const db = customDb !== undefined ? customDb : adminDb;

  if (isProduction) {
    // 1. In production, local file store is strictly rejected
    if (!driverType || driverType === 'file' || driverType === 'local_file') {
      return new BlockedStoreDriver(
        'PRODUCTION_UNCONFIGURED_SHARED_DRIVER: Production multi-replica deployment requires a configured centralized/distributed rate limit driver. Local file mode is strictly prohibited.'
      );
    }

    // 2. In production, mock/simulator drivers are strictly rejected
    if (driverType === 'centralized_mock' || driverType === 'mock' || driverType === 'simulator') {
      return new BlockedStoreDriver(
        'PRODUCTION_MOCK_DRIVER_REJECTED: Mock or simulator rate limit driver is strictly prohibited in production environment.'
      );
    }

    // 3. Centralized driver labels require real backend transport
    if (
      driverType === 'firestore' ||
      driverType === 'distributed' ||
      driverType === 'centralized' ||
      driverType === 'redis'
    ) {
      try {
        if (!db) {
          return new BlockedStoreDriver(
            `PRODUCTION_CENTRALIZED_STORE_UNCONFIGURED: Real backend connection for '${driverType}' is missing or unconfigured.`
          );
        }
        return new FirestoreStoreDriver(db);
      } catch (err: any) {
        return new BlockedStoreDriver(
          `PRODUCTION_CENTRALIZED_STORE_UNCONFIGURED: Real backend connection for '${driverType}' is missing or unconfigured: ${err.message}`
        );
      }
    }

    // 4. Unknown driver name in production
    return new BlockedStoreDriver(
      `PRODUCTION_UNKNOWN_STORE_DRIVER: Driver '${driverType}' is unknown or missing required connection configuration in production.`
    );
  }

  // In development / test mode:
  if (driverType === 'firestore') {
    try {
      return new FirestoreStoreDriver(db);
    } catch {
      return new LocalFileStoreDriver();
    }
  }
  if (
    driverType === 'simulator' ||
    driverType === 'centralized_mock' ||
    driverType === 'distributed' ||
    driverType === 'centralized'
  ) {
    return new TestSimulatorStoreDriver(env.DISTRIBUTED_STORE_CLUSTER || 'test-piket-cluster');
  }

  return new LocalFileStoreDriver();
}

function createDefaultStoreDriver(): RateLimitStoreDriver {
  return createStoreDriverFromConfig(process.env);
}

let activeStoreDriver: RateLimitStoreDriver = createDefaultStoreDriver();

/**
 * Set active store driver (used for testing or distributed configuration)
 */
export function setActiveRateLimitDriver(driver: RateLimitStoreDriver): void {
  activeStoreDriver = driver;
}

export function getActiveRateLimitDriver(): RateLimitStoreDriver {
  return activeStoreDriver;
}

/**
 * Extracts client IP safely from request based on topology and proxy trust settings.
 */
export function getClientIp(req: Request, trustedHops: number = 1): string {
  if (req.ips && req.ips.length > 0) {
    return req.ips[0];
  }
  if (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1' && req.ip !== '::ffff:127.0.0.1') {
    return req.ip;
  }

  const rawRealIp = req.headers ? (req.headers['x-real-ip'] as string) : undefined;
  if (typeof rawRealIp === 'string' && rawRealIp.trim() && rawRealIp.trim() !== '::1' && rawRealIp.trim() !== '127.0.0.1') {
    return rawRealIp.trim();
  }

  if (trustedHops > 0) {
    const rawForwarded = req.headers ? req.headers['x-forwarded-for'] : undefined;
    if (typeof rawForwarded === 'string') {
      const ips = rawForwarded.split(',').map((s) => s.trim()).filter(Boolean);
      if (ips.length >= trustedHops) {
        return ips[ips.length - trustedHops];
      } else if (ips.length > 0) {
        return ips[0];
      }
    }
  }

  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Main High-Level Rate Limiter facade with fail-closed semantics and typed domains
 */
export class AuthRateLimiter {
  public static getStore(): RateLimitStoreDriver {
    return activeStoreDriver;
  }

  public static async isLocked(identifier: string): Promise<LockStatus> {
    const key = toAccountIdKey(identifier);
    return activeStoreDriver.isLocked(key);
  }

  public static async recordFailure(
    identifier: string,
    ip: string,
    threshold: number = MAX_FAILED_ATTEMPTS,
    lockoutDuration: number = LOCKOUT_DURATION_MS
  ): Promise<FailureRecordResult> {
    const idKey = toAccountIdKey(identifier);
    const ipKey = toIpKey(ip);
    return activeStoreDriver.recordFailureCombined({
      idKey,
      ipKey,
      threshold,
      lockoutDuration,
    });
  }

  public static async recordFailureWithAction(
    identifier: string,
    actionKey: string,
    ip: string,
    threshold: number = MAX_FAILED_ATTEMPTS,
    lockoutDuration: number = LOCKOUT_DURATION_MS
  ): Promise<FailureRecordResult> {
    const idKey = toAccountIdKey(identifier);
    const ipKey = toIpKey(ip);
    let actKey = '';
    if (actionKey.startsWith('act:')) {
      actKey = actionKey;
    } else if (actionKey.includes(':')) {
      const [actName, ...rest] = actionKey.split(':');
      actKey = toActionKey(actName, rest.join(':'));
    } else {
      actKey = toActionKey(actionKey, identifier);
    }

    return activeStoreDriver.recordFailureCombined({
      idKey,
      ipKey,
      actKey,
      threshold,
      lockoutDuration,
    });
  }

  public static async recordLoginSuccess(nip: string, ip: string): Promise<void> {
    const idKey = toAccountIdKey(nip);
    const ipKey = toIpKey(ip);
    await activeStoreDriver.reset(idKey);
    const ipLock = await activeStoreDriver.isLocked(ipKey);
    if (!ipLock.locked) {
      await activeStoreDriver.reset(ipKey);
    }
  }

  public static async recordActionSuccess(actionName: string, targetId: string, ip: string): Promise<void> {
    const actKey = toActionKey(actionName, targetId);
    const idKey = toAccountIdKey(targetId);
    const ipKey = toIpKey(ip);

    await activeStoreDriver.reset(actKey);
    await activeStoreDriver.reset(idKey);

    const ipLock = await activeStoreDriver.isLocked(ipKey);
    if (!ipLock.locked) {
      await activeStoreDriver.reset(ipKey);
    }
  }

  public static async resetAction(actionName: string, targetId: string): Promise<void> {
    const actKey = toActionKey(actionName, targetId);
    await activeStoreDriver.reset(actKey);
  }

  public static async recordSuccess(identifier: string, ip: string): Promise<void> {
    if (identifier.includes(':')) {
      const [actName, ...rest] = identifier.split(':');
      await this.recordActionSuccess(actName, rest.join(':'), ip);
    } else {
      await this.recordLoginSuccess(identifier, ip);
    }
  }

  public static async clearAll(): Promise<void> {
    await activeStoreDriver.clearAll();
  }

  /**
   * Express middleware for Login route with token-based lease backpressure,
   * active request lease renewal heartbeat (R10-02, R11-02, R12-02, R13-02), and fail-closed store check
   */
  public static async loginMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawIdentifier = (req.body?.identifier || req.body?.loginId || req.body?.nip || '').trim();
    const ip = getClientIp(req);
    const ipKey = toIpKey(ip);

    let targetAccountId = rawIdentifier;
    if (rawIdentifier && adminDb) {
      try {
        const normalized = rawIdentifier.trim().toUpperCase();
        const [loginIdSnap, nipSnap] = await Promise.all([
          adminDb.collection('users').where('loginId', '==', normalized).limit(2).get(),
          adminDb.collection('users').where('nip', '==', rawIdentifier).limit(2).get(),
        ]);
        const matchedUids = new Set<string>();
        loginIdSnap.docs.forEach((d) => matchedUids.add(d.id));
        nipSnap.docs.forEach((d) => matchedUids.add(d.id));
        if (matchedUids.size === 1) {
          targetAccountId = Array.from(matchedUids)[0];
          (req as any).resolvedUserId = targetAccountId;
        }
      } catch {
        // Fall back to rawIdentifier if lookup fails
      }
    }

    const idKey = toAccountIdKey(targetAccountId || 'anon');

    try {
      // 1. Check IP lockout
      const ipLock = await activeStoreDriver.isLocked(ipKey);
      if (ipLock.locked) {
        res.status(429).json({
          success: false,
          error: `Alamat IP diblokir sementara karena terlalu banyak percobaan gagal. Silakan tunggu ${ipLock.remainingSeconds} detik.`,
          code: 'IP_LOCKED',
          remainingSeconds: ipLock.remainingSeconds,
        });
        return;
      }

      // 2. Check Account / Alias lockout
      let isAccountLocked = false;
      let remainingLockSeconds: number | undefined;

      if (targetAccountId) {
        const targetLock = await activeStoreDriver.isLocked(toAccountIdKey(targetAccountId));
        if (targetLock.locked) {
          isAccountLocked = true;
          remainingLockSeconds = targetLock.remainingSeconds;
        }
      }

      if (!isAccountLocked && rawIdentifier && rawIdentifier !== targetAccountId) {
        const rawLock = await activeStoreDriver.isLocked(toAccountIdKey(rawIdentifier));
        if (rawLock.locked) {
          isAccountLocked = true;
          remainingLockSeconds = rawLock.remainingSeconds;
        }
      }

      if (isAccountLocked) {
        res.status(429).json({
          success: false,
          error: `Akun ini terkunci sementara karena 5 kali percobaan PIN salah. Silakan coba lagi dalam ${remainingLockSeconds} detik.`,
          code: 'ACCOUNT_LOCKED',
          remainingSeconds: remainingLockSeconds,
        });
        return;
      }

      // 3. Acquire Token-Based In-Flight Lease
      const acquireRes = await activeStoreDriver.tryAcquireDualInFlight({
        idKey,
        ipKey,
        maxId: MAX_CONCURRENT_IN_FLIGHT_PER_ID,
        maxIp: MAX_CONCURRENT_IN_FLIGHT_PER_IP,
        leaseTtlMs: IN_FLIGHT_LEASE_TTL_MS,
      });

      if (!acquireRes.admitted || !acquireRes.leaseToken) {
        res.status(429).json({
          success: false,
          error: 'Terlalu banyak permintaan serentak dari alamat IP atau akun ini. Silakan coba beberapa saat lagi.',
          code: 'TOO_MANY_CONCURRENT_REQUESTS',
        });
        return;
      }

      const leaseToken = acquireRes.leaseToken;
      let released = false;

      // Attach AbortController & Signal to request for active cancellation control (R11-02, R12-02, R13-02)
      const leaseAbortController = (req as any).leaseAbortController || new AbortController();
      (req as any).leaseAbortController = leaseAbortController;
      (req as any).leaseSignal = leaseAbortController.signal;

      // Track client disconnect explicitly (R13-02)
      if (typeof req.on === 'function') {
        req.on('aborted', () => {
          (req as any).clientDisconnected = true;
          leaseAbortController.abort(new Error('CLIENT_ABORTED'));
        });
      }
      req.socket?.on('close', () => {
        if (!res.writableEnded && !res.headersSent) {
          (req as any).clientDisconnected = true;
          leaseAbortController.abort(new Error('CLIENT_DISCONNECTED'));
        }
      });

      // 4. Active Request Lease Heartbeat Renewal with Cancellation Control (R11-02, R12-02, R13-02)
      const heartbeatTimer = setInterval(async () => {
        if (released) {
          clearInterval(heartbeatTimer);
          return;
        }
        try {
          const renewed = await activeStoreDriver.renewDualInFlight(leaseToken, IN_FLIGHT_LEASE_TTL_MS);
          if (!renewed) {
            clearInterval(heartbeatTimer);
            leaseAbortController.abort(new Error('LEASE_RENEWAL_FAILED'));
            req.emit('leaseLost', new Error('LEASE_RENEWAL_FAILED'));
            if (!res.headersSent) {
              res.status(503).json({
                success: false,
                error: 'Sesi permintaan kehilangan batas laju aman (Lease Lost). Pekerjaan dibatalkan secara aman.',
                code: 'RATE_LIMIT_LEASE_LOST',
              });
            }
          }
        } catch (err: any) {
          clearInterval(heartbeatTimer);
          leaseAbortController.abort(err);
          req.emit('leaseLost', err);
          if (!res.headersSent) {
            res.status(503).json({
              success: false,
              error: 'Gagal memperbarui batas laju aman. Pekerjaan dibatalkan secara aman.',
              code: 'RATE_LIMIT_STORE_UNAVAILABLE',
            });
          }
        }
      }, LEASE_HEARTBEAT_INTERVAL_MS);

      if (heartbeatTimer.unref) {
        heartbeatTimer.unref();
      }

      const safeRelease = () => {
        if (!released) {
          released = true;
          clearInterval(heartbeatTimer);
          activeStoreDriver.releaseDualInFlight(leaseToken).catch(() => {});
        }
      };

      res.on('finish', safeRelease);
      res.on('close', safeRelease);

      next();
    } catch (storeErr: any) {
      // Fail-closed with 503 Service Unavailable (R10-01)
      res.status(503).json({
        success: false,
        error: 'Layanan keamanan autentikasi sedang tidak tersedia. Permintaan ditolak secara aman (Fail-Closed).',
        code: 'RATE_LIMIT_STORE_UNAVAILABLE',
      });
    }
  }

  /**
   * Generic PIN operation rate limit middleware with token lease, lifecycle signals, and fail-closed 503 (R13-02)
   */
  public static createPinActionLimiter(actionName: string, idField: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const targetId = (req.body?.[idField] || (req as any).user?.uid || '').trim();
      const ip = getClientIp(req);
      const ipKey = toIpKey(ip);
      const actKey = toActionKey(actionName, targetId || 'anon');
      const idKey = toAccountIdKey(targetId || 'anon');

      try {
        // 1. IP lock check
        const ipLock = await activeStoreDriver.isLocked(ipKey);
        if (ipLock.locked) {
          res.status(429).json({
            success: false,
            error: `Terlalu banyak percobaan pada aksi ${actionName}. Alamat IP diblokir sementara. Tunggu ${ipLock.remainingSeconds} detik.`,
            code: 'IP_LOCKED',
            remainingSeconds: ipLock.remainingSeconds,
          });
          return;
        }

        // 2. Action & Account lock check
        if (targetId) {
          const actionLock = await activeStoreDriver.isLocked(actKey);
          if (actionLock.locked) {
            res.status(429).json({
              success: false,
              error: `Aksi ${actionName} untuk akun ini terkunci sementara. Silakan coba lagi dalam ${actionLock.remainingSeconds} detik.`,
              code: 'ACTION_LOCKED',
              remainingSeconds: actionLock.remainingSeconds,
            });
            return;
          }

          const targetLock = await activeStoreDriver.isLocked(idKey);
          if (targetLock.locked) {
            res.status(429).json({
              success: false,
              error: `Akun ini terkunci sementara. Silakan coba lagi dalam ${targetLock.remainingSeconds} detik.`,
              code: 'ACCOUNT_LOCKED',
              remainingSeconds: targetLock.remainingSeconds,
            });
            return;
          }
        }

        // 3. Acquire Token Lease for PIN action
        const acquireRes = await activeStoreDriver.tryAcquireDualInFlight({
          idKey,
          ipKey,
          maxId: MAX_CONCURRENT_IN_FLIGHT_PER_ID,
          maxIp: MAX_CONCURRENT_IN_FLIGHT_PER_IP,
          leaseTtlMs: IN_FLIGHT_LEASE_TTL_MS,
        });

        if (!acquireRes.admitted || !acquireRes.leaseToken) {
          res.status(429).json({
            success: false,
            error: 'Terlalu banyak permintaan serentak dari alamat IP atau akun ini. Silakan coba beberapa saat lagi.',
            code: 'TOO_MANY_CONCURRENT_REQUESTS',
          });
          return;
        }

        const leaseToken = acquireRes.leaseToken;
        let released = false;

        const leaseAbortController = (req as any).leaseAbortController || new AbortController();
        (req as any).leaseAbortController = leaseAbortController;
        (req as any).leaseSignal = leaseAbortController.signal;

        if (typeof req.on === 'function') {
          req.on('aborted', () => {
            (req as any).clientDisconnected = true;
            leaseAbortController.abort(new Error('CLIENT_ABORTED'));
          });
        }
        req.socket?.on('close', () => {
          if (!res.writableEnded && !res.headersSent) {
            (req as any).clientDisconnected = true;
            leaseAbortController.abort(new Error('CLIENT_DISCONNECTED'));
          }
        });

        const heartbeatTimer = setInterval(async () => {
          if (released) {
            clearInterval(heartbeatTimer);
            return;
          }
          try {
            const renewed = await activeStoreDriver.renewDualInFlight(leaseToken, IN_FLIGHT_LEASE_TTL_MS);
            if (!renewed) {
              clearInterval(heartbeatTimer);
              leaseAbortController.abort(new Error('LEASE_RENEWAL_FAILED'));
              req.emit('leaseLost', new Error('LEASE_RENEWAL_FAILED'));
              if (!res.headersSent) {
                res.status(503).json({
                  success: false,
                  error: 'Sesi permintaan kehilangan batas laju aman (Lease Lost). Pekerjaan dibatalkan secara aman.',
                  code: 'RATE_LIMIT_LEASE_LOST',
                });
              }
            }
          } catch (err: any) {
            clearInterval(heartbeatTimer);
            leaseAbortController.abort(err);
            req.emit('leaseLost', err);
            if (!res.headersSent) {
              res.status(503).json({
                success: false,
                error: 'Gagal memperbarui batas laju aman. Pekerjaan dibatalkan secara aman.',
                code: 'RATE_LIMIT_STORE_UNAVAILABLE',
              });
            }
          }
        }, LEASE_HEARTBEAT_INTERVAL_MS);

        if (heartbeatTimer.unref) {
          heartbeatTimer.unref();
        }

        const safeRelease = () => {
          if (!released) {
            released = true;
            clearInterval(heartbeatTimer);
            activeStoreDriver.releaseDualInFlight(leaseToken).catch(() => {});
          }
        };

        res.on('finish', safeRelease);
        res.on('close', safeRelease);

        next();
      } catch (storeErr: any) {
        // Fail-closed with 503 Service Unavailable (R10-01)
        res.status(503).json({
          success: false,
          error: `Layanan keamanan untuk aksi ${actionName} sedang tidak tersedia. Permintaan dihentikan secara aman (Fail-Closed).`,
          code: 'RATE_LIMIT_STORE_UNAVAILABLE',
        });
      }
    };
  }
}

/**
 * Auth Rate Limiter Readiness Check for Health Check endpoints (R11-01, R12-01)
 */
export async function getAuthRateLimiterReadiness(): Promise<{
  status: 'HEALTHY' | 'UNAVAILABLE';
  driver: string;
}> {
  try {
    if (activeStoreDriver instanceof BlockedStoreDriver) {
      return { status: 'UNAVAILABLE', driver: activeStoreDriver.name };
    }
    const isHealthy = await activeStoreDriver.isHealthy();
    if (isHealthy) {
      return { status: 'HEALTHY', driver: activeStoreDriver.name };
    }
  } catch {}
  return { status: 'UNAVAILABLE', driver: activeStoreDriver.name };
}

// Export LocalFileStoreDriver as AtomicRateLimitStore for backward compatibility
export { LocalFileStoreDriver as AtomicRateLimitStore };
export { TestSimulatorStoreDriver as CentralizedMockStoreDriver };
