var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// firebase-applet-config.json
var firebase_applet_config_default;
var init_firebase_applet_config = __esm({
  "firebase-applet-config.json"() {
    firebase_applet_config_default = {
      projectId: "strange-legacy-pxfhk",
      appId: "1:1014257447647:web:3daa6dcd1b3def18feef6a",
      apiKey: "AIzaSyBlccRXHjWBzmAcGydwqfalTmxnJcz0xEM",
      authDomain: "strange-legacy-pxfhk.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192",
      storageBucket: "strange-legacy-pxfhk.firebasestorage.app",
      messagingSenderId: "1014257447647",
      measurementId: "",
      oAuthClientId: "1014257447647-pe91q43ps0shdl9igl2nirsrp8gsbnh9.apps.googleusercontent.com",
      recaptchaSiteKey: ""
    };
  }
});

// src/server/firebaseAdmin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
function initFirebaseAdmin() {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
  } else {
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const gCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (saEnv) {
      try {
        let creds;
        if (saEnv.startsWith("{")) {
          creds = JSON.parse(saEnv);
        } else if (fs.existsSync(saEnv)) {
          creds = JSON.parse(fs.readFileSync(saEnv, "utf8"));
        }
        if (creds) {
          adminApp = initializeApp({
            credential: cert(creds),
            projectId: firebase_applet_config_default.projectId
          });
        }
      } catch (err) {
        console.warn("[FIREBASE_ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to ADC:", err);
      }
    }
    if (!adminApp && gCreds && fs.existsSync(gCreds)) {
      try {
        const creds = JSON.parse(fs.readFileSync(gCreds, "utf8"));
        adminApp = initializeApp({
          credential: cert(creds),
          projectId: firebase_applet_config_default.projectId
        });
      } catch (err) {
        console.warn("[FIREBASE_ADMIN] Failed to parse GOOGLE_APPLICATION_CREDENTIALS:", err);
      }
    }
    if (!adminApp) {
      adminApp = initializeApp({
        projectId: firebase_applet_config_default.projectId
      });
    }
  }
  adminAuth = getAuth(adminApp);
  adminDb = firebase_applet_config_default.firestoreDatabaseId && firebase_applet_config_default.firestoreDatabaseId !== "(default)" ? getFirestore(adminApp, firebase_applet_config_default.firestoreDatabaseId) : getFirestore(adminApp);
}
async function testSignerCapability(testUid = "health-check-probe") {
  try {
    const token = await adminAuth.createCustomToken(testUid);
    return { available: true, token };
  } catch (err) {
    return {
      available: false,
      code: err.code || "UNKNOWN_ERROR",
      message: err.message
    };
  }
}
var adminApp, adminAuth, adminDb;
var init_firebaseAdmin = __esm({
  "src/server/firebaseAdmin.ts"() {
    init_firebase_applet_config();
    initFirebaseAdmin();
  }
});

// src/server/crypto/adaptiveHash.ts
var adaptiveHash_exports = {};
__export(adaptiveHash_exports, {
  DEFAULT_SCRYPT_PARAMS: () => DEFAULT_SCRYPT_PARAMS,
  hashPinAdaptive: () => hashPinAdaptive,
  setCustomHashInterceptor: () => setCustomHashInterceptor,
  verifyPinAdaptive: () => verifyPinAdaptive
});
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
function acquireScryptSlot() {
  if (activeScryptCount < MAX_CONCURRENT_SCRYPT) {
    activeScryptCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    scryptQueue.push(() => {
      activeScryptCount++;
      resolve();
    });
  });
}
function releaseScryptSlot() {
  activeScryptCount--;
  if (scryptQueue.length > 0) {
    const next = scryptQueue.shift();
    if (next) next();
  }
}
async function deriveScrypt(password, salt, keyLength, options) {
  await acquireScryptSlot();
  try {
    const opts = {
      cost: options.N,
      blockSize: options.r,
      parallelization: options.p,
      maxmem: options.maxmem || MAX_MEM_BYTES
    };
    return await new Promise((resolve, reject) => {
      scrypt(password, salt, keyLength, opts, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  } finally {
    releaseScryptSlot();
  }
}
function setCustomHashInterceptor(fn) {
  customHashInterceptor = fn;
}
async function hashPinAdaptive(pin, params = DEFAULT_SCRYPT_PARAMS) {
  if (customHashInterceptor) {
    return customHashInterceptor(pin);
  }
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    throw new Error("PIN must be a valid 6-digit string");
  }
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveScrypt(pin, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem || MAX_MEM_BYTES
  });
  const saltHex = salt.toString("hex");
  const keyHex = derivedKey.toString("hex");
  return `$scrypt$N=${params.N},r=${params.r},p=${params.p}$${saltHex}$${keyHex}`;
}
async function verifyPinAdaptive(pin, storedHash) {
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return false;
  }
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") {
    return false;
  }
  const paramStr = parts[2];
  const saltHex = parts[3];
  const originalKeyHex = parts[4];
  if (!saltHex || !/^[0-9a-fA-F]{32,128}$/.test(saltHex) || saltHex.length % 2 !== 0) {
    return false;
  }
  if (!originalKeyHex || !/^[0-9a-fA-F]{64,256}$/.test(originalKeyHex) || originalKeyHex.length % 2 !== 0) {
    return false;
  }
  const paramMap = /* @__PURE__ */ new Map();
  for (const pair of paramStr.split(",")) {
    const [k, v] = pair.split("=");
    if (k && v) {
      const parsedVal = parseInt(v, 10);
      if (isNaN(parsedVal)) return false;
      paramMap.set(k.trim(), parsedVal);
    }
  }
  const N = paramMap.get("N");
  const r = paramMap.get("r");
  const p = paramMap.get("p");
  if (N === void 0 || r === void 0 || p === void 0) {
    return false;
  }
  if (N < 1024 || N > 1048576 || (N & N - 1) !== 0) {
    return false;
  }
  if (r < 1 || r > 32) {
    return false;
  }
  if (p < 1 || p > 32) {
    return false;
  }
  const estimatedMemBytes = 128 * r * N;
  if (estimatedMemBytes > HARD_CEILING_MEM_BYTES) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const originalKey = Buffer.from(originalKeyHex, "hex");
  if (salt.length < 16 || originalKey.length < 32) {
    return false;
  }
  try {
    const derivedKey = await deriveScrypt(pin, salt, originalKey.length, {
      N,
      r,
      p,
      maxmem: Math.max(MAX_MEM_BYTES, estimatedMemBytes * 2)
    });
    if (derivedKey.length !== originalKey.length) {
      return false;
    }
    return timingSafeEqual(derivedKey, originalKey);
  } catch (err) {
    console.error("[SCRYPT] Verification error:", err);
    return false;
  }
}
var OWASP_SCRYPT_N, OWASP_SCRYPT_R, OWASP_SCRYPT_P, KEY_LENGTH, SALT_LENGTH, MAX_MEM_BYTES, HARD_CEILING_MEM_BYTES, MAX_CONCURRENT_SCRYPT, activeScryptCount, scryptQueue, DEFAULT_SCRYPT_PARAMS, customHashInterceptor;
var init_adaptiveHash = __esm({
  "src/server/crypto/adaptiveHash.ts"() {
    OWASP_SCRYPT_N = 16384;
    OWASP_SCRYPT_R = 8;
    OWASP_SCRYPT_P = 5;
    KEY_LENGTH = 64;
    SALT_LENGTH = 32;
    MAX_MEM_BYTES = 64 * 1024 * 1024;
    HARD_CEILING_MEM_BYTES = 128 * 1024 * 1024;
    MAX_CONCURRENT_SCRYPT = 4;
    activeScryptCount = 0;
    scryptQueue = [];
    DEFAULT_SCRYPT_PARAMS = {
      N: OWASP_SCRYPT_N,
      r: OWASP_SCRYPT_R,
      p: OWASP_SCRYPT_P,
      keyLength: KEY_LENGTH,
      maxmem: MAX_MEM_BYTES
    };
    customHashInterceptor = null;
  }
});

// src/server/middleware/rateLimiter.ts
var rateLimiter_exports = {};
__export(rateLimiter_exports, {
  AtomicRateLimitStore: () => LocalFileStoreDriver,
  AuthRateLimiter: () => AuthRateLimiter,
  BlockedStoreDriver: () => BlockedStoreDriver,
  CentralizedMockStoreDriver: () => TestSimulatorStoreDriver,
  FirestoreStoreDriver: () => FirestoreStoreDriver,
  LocalFileStoreDriver: () => LocalFileStoreDriver,
  StoreUnavailableError: () => StoreUnavailableError,
  TestSimulatorStoreDriver: () => TestSimulatorStoreDriver,
  createFirestoreAdminTransport: () => createFirestoreAdminTransport,
  createInMemoryTransactionTransport: () => createInMemoryTransactionTransport,
  createStoreDriverFromConfig: () => createStoreDriverFromConfig,
  getActiveRateLimitDriver: () => getActiveRateLimitDriver,
  getAuthRateLimiterReadiness: () => getAuthRateLimiterReadiness,
  getClientIp: () => getClientIp,
  setActiveRateLimitDriver: () => setActiveRateLimitDriver,
  toAccountIdKey: () => toAccountIdKey,
  toActionKey: () => toActionKey,
  toCanonicalKey: () => toCanonicalKey,
  toIpKey: () => toIpKey
});
import * as fs2 from "fs";
import * as path from "path";
function toAccountIdKey(rawId) {
  return `id:${encodeURIComponent((rawId || "").trim())}`;
}
function toIpKey(rawIp) {
  return `ip:${encodeURIComponent((rawIp || "").trim())}`;
}
function toActionKey(actionName, rawTargetId) {
  return `act:${encodeURIComponent((actionName || "").trim())}:${encodeURIComponent((rawTargetId || "").trim())}`;
}
function toCanonicalKey(key, defaultNamespace = "id") {
  const trimmed = (key || "").trim();
  if (trimmed.startsWith("id:") || trimmed.startsWith("ip:") || trimmed.startsWith("act:")) {
    return trimmed;
  }
  if (defaultNamespace === "ip") return toIpKey(trimmed);
  if (defaultNamespace === "act") return toActionKey("default", trimmed);
  return toAccountIdKey(trimmed);
}
function createFirestoreAdminTransport(db) {
  const collectionPath = "_sys_rate_limiter";
  return {
    async isHealthy() {
      if (!db || typeof db.collection !== "function") return false;
      try {
        await db.collection(collectionPath).doc("_ping").get();
        return true;
      } catch {
        return false;
      }
    },
    async runTransaction(updateFn) {
      if (!db || typeof db.runTransaction !== "function") {
        throw new StoreUnavailableError("Firestore db runTransaction is unavailable");
      }
      return db.runTransaction(async (firestoreTx) => {
        const txAdapter = {
          async get(key) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            const snap = await firestoreTx.get(ref);
            return snap.exists ? snap.data() : null;
          },
          set(key, data) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            firestoreTx.set(ref, data, { merge: true });
          },
          delete(key) {
            const ref = db.collection(collectionPath).doc(encodeURIComponent(key));
            firestoreTx.delete(ref);
          }
        };
        return updateFn(txAdapter);
      });
    }
  };
}
function createInMemoryTransactionTransport(initialHealthy = true) {
  const store = /* @__PURE__ */ new Map();
  let healthy = initialHealthy;
  let lockChain = Promise.resolve();
  return {
    setHealthy(h) {
      healthy = h;
    },
    getRawData() {
      return store;
    },
    async isHealthy() {
      return healthy;
    },
    async runTransaction(updateFn) {
      if (!healthy) {
        throw new StoreUnavailableError("Shared transport backend is unavailable.");
      }
      let releaseLock;
      const nextLock = new Promise((resolve) => {
        releaseLock = resolve;
      });
      const currentLock = lockChain;
      lockChain = lockChain.then(() => nextLock);
      await currentLock;
      try {
        const draft = /* @__PURE__ */ new Map();
        for (const [k, v] of store.entries()) {
          draft.set(k, JSON.parse(JSON.stringify(v)));
        }
        let hasWritten = false;
        const tx = {
          async get(key) {
            if (hasWritten) {
              throw new Error("Firestore Transaction Contract Violation: Reads must come before all writes.");
            }
            const val = draft.get(key);
            return val ? JSON.parse(JSON.stringify(val)) : null;
          },
          set(key, data) {
            hasWritten = true;
            draft.set(key, JSON.parse(JSON.stringify(data)));
          },
          delete(key) {
            hasWritten = true;
            draft.delete(key);
          }
        };
        const result = await updateFn(tx);
        store.clear();
        for (const [k, v] of draft.entries()) {
          store.set(k, v);
        }
        return result;
      } catch (err) {
        throw err;
      } finally {
        releaseLock();
      }
    }
  };
}
function createStoreDriverFromConfig(env, customDb) {
  const isProduction = env.NODE_ENV === "production";
  const driverType = (env.RATE_LIMIT_STORE_DRIVER || "").trim();
  const db = customDb !== void 0 ? customDb : adminDb;
  if (isProduction) {
    if (!driverType || driverType === "file" || driverType === "local_file") {
      return new BlockedStoreDriver(
        "PRODUCTION_UNCONFIGURED_SHARED_DRIVER: Production multi-replica deployment requires a configured centralized/distributed rate limit driver. Local file mode is strictly prohibited."
      );
    }
    if (driverType === "centralized_mock" || driverType === "mock" || driverType === "simulator") {
      return new BlockedStoreDriver(
        "PRODUCTION_MOCK_DRIVER_REJECTED: Mock or simulator rate limit driver is strictly prohibited in production environment."
      );
    }
    if (driverType === "firestore" || driverType === "distributed" || driverType === "centralized" || driverType === "redis") {
      try {
        if (!db) {
          return new BlockedStoreDriver(
            `PRODUCTION_CENTRALIZED_STORE_UNCONFIGURED: Real backend connection for '${driverType}' is missing or unconfigured.`
          );
        }
        return new FirestoreStoreDriver(db);
      } catch (err) {
        return new BlockedStoreDriver(
          `PRODUCTION_CENTRALIZED_STORE_UNCONFIGURED: Real backend connection for '${driverType}' is missing or unconfigured: ${err.message}`
        );
      }
    }
    return new BlockedStoreDriver(
      `PRODUCTION_UNKNOWN_STORE_DRIVER: Driver '${driverType}' is unknown or missing required connection configuration in production.`
    );
  }
  if (driverType === "firestore") {
    try {
      return new FirestoreStoreDriver(db);
    } catch {
      return new LocalFileStoreDriver();
    }
  }
  if (driverType === "simulator" || driverType === "centralized_mock" || driverType === "distributed" || driverType === "centralized") {
    return new TestSimulatorStoreDriver(env.DISTRIBUTED_STORE_CLUSTER || "test-piket-cluster");
  }
  return new LocalFileStoreDriver();
}
function createDefaultStoreDriver() {
  return createStoreDriverFromConfig(process.env);
}
function setActiveRateLimitDriver(driver) {
  activeStoreDriver = driver;
}
function getActiveRateLimitDriver() {
  return activeStoreDriver;
}
function getClientIp(req, trustedHops = 1) {
  if (req.ips && req.ips.length > 0) {
    return req.ips[0];
  }
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1" && req.ip !== "::ffff:127.0.0.1") {
    return req.ip;
  }
  const rawRealIp = req.headers ? req.headers["x-real-ip"] : void 0;
  if (typeof rawRealIp === "string" && rawRealIp.trim() && rawRealIp.trim() !== "::1" && rawRealIp.trim() !== "127.0.0.1") {
    return rawRealIp.trim();
  }
  if (trustedHops > 0) {
    const rawForwarded = req.headers ? req.headers["x-forwarded-for"] : void 0;
    if (typeof rawForwarded === "string") {
      const ips = rawForwarded.split(",").map((s) => s.trim()).filter(Boolean);
      if (ips.length >= trustedHops) {
        return ips[ips.length - trustedHops];
      } else if (ips.length > 0) {
        return ips[0];
      }
    }
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}
async function getAuthRateLimiterReadiness() {
  try {
    if (activeStoreDriver instanceof BlockedStoreDriver) {
      return { status: "UNAVAILABLE", driver: activeStoreDriver.name };
    }
    const isHealthy = await activeStoreDriver.isHealthy();
    if (isHealthy) {
      return { status: "HEALTHY", driver: activeStoreDriver.name };
    }
  } catch {
  }
  return { status: "UNAVAILABLE", driver: activeStoreDriver.name };
}
var StoreUnavailableError, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS, WINDOW_DURATION_MS, MAX_CONCURRENT_IN_FLIGHT_PER_ID, MAX_CONCURRENT_IN_FLIGHT_PER_IP, IN_FLIGHT_LEASE_TTL_MS, LEASE_HEARTBEAT_INTERVAL_MS, LocalFileStoreDriver, FirestoreStoreDriver, ClusterSharedBackend, TestSimulatorStoreDriver, BlockedStoreDriver, activeStoreDriver, AuthRateLimiter;
var init_rateLimiter = __esm({
  "src/server/middleware/rateLimiter.ts"() {
    init_firebaseAdmin();
    StoreUnavailableError = class extends Error {
      constructor(message = "Rate limit store is unavailable") {
        super(message);
        this.name = "StoreUnavailableError";
      }
    };
    MAX_FAILED_ATTEMPTS = 5;
    LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
    WINDOW_DURATION_MS = 15 * 60 * 1e3;
    MAX_CONCURRENT_IN_FLIGHT_PER_ID = 5;
    MAX_CONCURRENT_IN_FLIGHT_PER_IP = 15;
    IN_FLIGHT_LEASE_TTL_MS = 30 * 1e3;
    LEASE_HEARTBEAT_INTERVAL_MS = 10 * 1e3;
    LocalFileStoreDriver = class {
      constructor(customFilePath) {
        this.name = "local_file";
        this.inMemoryLocks = /* @__PURE__ */ new Map();
        this.filePath = customFilePath || process.env.RATE_LIMIT_STORE_FILE || path.join(process.env.TMPDIR || "/tmp", "piket_ratelimit_store.json");
        this.lockPath = `${this.filePath}.oslock`;
        this.ensureDirectory();
      }
      ensureDirectory() {
        try {
          const dir = path.dirname(this.filePath);
          if (!fs2.existsSync(dir)) {
            fs2.mkdirSync(dir, { recursive: true });
          }
        } catch {
        }
      }
      async acquireMemoryLocks(keys) {
        const uniqueSortedKeys = Array.from(new Set(keys.filter(Boolean))).sort();
        const releaseFns = [];
        for (const key of uniqueSortedKeys) {
          while (this.inMemoryLocks.has(key)) {
            await this.inMemoryLocks.get(key);
          }
          let resolver = () => {
          };
          const lockPromise = new Promise((resolve) => {
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
      async acquireFileLock(maxWaitMs = 3e3) {
        this.ensureDirectory();
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          try {
            const fd = fs2.openSync(this.lockPath, "wx");
            fs2.writeSync(fd, `${process.pid}
${Date.now()}`);
            fs2.closeSync(fd);
            return () => {
              try {
                if (fs2.existsSync(this.lockPath)) {
                  fs2.unlinkSync(this.lockPath);
                }
              } catch {
              }
            };
          } catch (e) {
            if (e.code === "EEXIST") {
              try {
                const stat = fs2.statSync(this.lockPath);
                if (Date.now() - stat.mtimeMs > 4e3) {
                  fs2.unlinkSync(this.lockPath);
                  continue;
                }
              } catch {
              }
              await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 15)));
            } else {
              return null;
            }
          }
        }
        return null;
      }
      pruneExpiredLeases(leases, now) {
        for (const [token, lease] of Object.entries(leases)) {
          if (!lease || typeof lease.expiresAt !== "number" || now >= lease.expiresAt) {
            delete leases[token];
          }
        }
      }
      async withAtomicState(lockKeys, fn) {
        const releaseMem = await this.acquireMemoryLocks(lockKeys);
        const releaseFile = await this.acquireFileLock();
        if (!releaseFile) {
          releaseMem();
          throw new StoreUnavailableError("Failed to acquire atomic store file lock.");
        }
        try {
          let state = { records: {}, leases: {} };
          const now = Date.now();
          if (fs2.existsSync(this.filePath)) {
            try {
              const raw = fs2.readFileSync(this.filePath, "utf8");
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                state.records = parsed.records || {};
                state.leases = parsed.leases || {};
              }
            } catch (readErr) {
              throw new StoreUnavailableError(`Failed to read/parse store: ${readErr?.message}`);
            }
          }
          this.pruneExpiredLeases(state.leases, now);
          const result = fn(state);
          const tempFile = `${this.filePath}.${process.pid}.${now}.${Math.random().toString(36).substring(2)}.tmp`;
          try {
            fs2.writeFileSync(tempFile, JSON.stringify(state), "utf8");
            fs2.renameSync(tempFile, this.filePath);
          } catch (writeErr) {
            try {
              if (fs2.existsSync(tempFile)) fs2.unlinkSync(tempFile);
            } catch {
            }
            throw new StoreUnavailableError(`Failed to persist store state: ${writeErr?.message}`);
          }
          return result;
        } finally {
          releaseFile();
          releaseMem();
        }
      }
      async isHealthy() {
        try {
          this.ensureDirectory();
          return true;
        } catch {
          return false;
        }
      }
      async isLocked(canonicalKey) {
        return this.withAtomicState([canonicalKey], (state) => {
          const record = state.records[canonicalKey];
          if (!record) return { locked: false };
          const now = Date.now();
          if (record.lockedUntil && record.lockedUntil > now) {
            return {
              locked: true,
              remainingSeconds: Math.ceil((record.lockedUntil - now) / 1e3)
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
      recordFailureInState(records, key, now, threshold, lockoutDuration) {
        let record = records[key];
        if (!record || now - record.firstAttempt > WINDOW_DURATION_MS) {
          record = { count: 1, firstAttempt: now, lastAttempt: now, lockedUntil: null };
        } else {
          record.count += 1;
          record.lastAttempt = now;
        }
        let locked = false;
        let remainingSeconds;
        if (record.count >= threshold) {
          record.lockedUntil = now + lockoutDuration;
          locked = true;
          remainingSeconds = Math.ceil(lockoutDuration / 1e3);
        }
        records[key] = record;
        const remainingAttempts = Math.max(0, threshold - record.count);
        return { locked, remainingAttempts, remainingSeconds };
      }
      async recordFailureCombined(params) {
        const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;
        const lockKeys = [idKey, ipKey, actKey || ""].filter(Boolean);
        return this.withAtomicState(lockKeys, (state) => {
          const now = Date.now();
          const idResult = this.recordFailureInState(state.records, idKey, now, threshold, lockoutDuration);
          let actResult = {
            locked: false,
            remainingAttempts: 0
          };
          if (actKey) {
            actResult = this.recordFailureInState(state.records, actKey, now, threshold, lockoutDuration);
          }
          const ipResult = this.recordFailureInState(state.records, ipKey, now, threshold * 3, lockoutDuration);
          const isLocked = idResult.locked || actResult.locked || ipResult.locked;
          const lockoutSeconds = idResult.remainingSeconds || actResult.remainingSeconds || ipResult.remainingSeconds;
          return {
            locked: isLocked,
            remainingAttempts: idResult.remainingAttempts,
            lockoutSeconds
          };
        });
      }
      async tryAcquireDualInFlight(params) {
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
            expiresAt: now + leaseTtlMs
          };
          return { admitted: true, leaseToken };
        });
      }
      async renewDualInFlight(leaseToken, extensionMs) {
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
      async releaseDualInFlight(leaseToken) {
        if (!leaseToken) return;
        try {
          await this.withAtomicState([], (state) => {
            if (state.leases[leaseToken]) {
              delete state.leases[leaseToken];
            }
          });
        } catch {
        }
      }
      async reset(canonicalKey) {
        try {
          await this.withAtomicState([canonicalKey], (state) => {
            delete state.records[canonicalKey];
          });
        } catch (err) {
          throw new StoreUnavailableError(`Reset failed: ${err?.message}`);
        }
      }
      async clearAll() {
        try {
          if (fs2.existsSync(this.filePath)) fs2.unlinkSync(this.filePath);
          if (fs2.existsSync(this.lockPath)) fs2.unlinkSync(this.lockPath);
        } catch {
        }
      }
      async dumpState() {
        return this.withAtomicState([], (state) => JSON.parse(JSON.stringify(state)));
      }
    };
    FirestoreStoreDriver = class {
      constructor(transportOrDb) {
        this.name = "firestore_centralized";
        if (transportOrDb && typeof transportOrDb.runTransaction === "function") {
          if (typeof transportOrDb.isHealthy === "function") {
            this.transport = transportOrDb;
          } else {
            this.transport = createFirestoreAdminTransport(transportOrDb);
          }
        } else if (adminDb && typeof adminDb.collection === "function") {
          this.transport = createFirestoreAdminTransport(adminDb);
        } else {
          this.transport = {
            async isHealthy() {
              return false;
            },
            async runTransaction() {
              throw new StoreUnavailableError("Firestore adminDb unavailable or unconfigured");
            }
          };
        }
      }
      async isHealthy() {
        try {
          return await this.transport.isHealthy();
        } catch {
          return false;
        }
      }
      async isLocked(canonicalKey) {
        return this.transport.runTransaction(async (tx) => {
          const record = await tx.get(`records:${canonicalKey}`);
          if (!record) return { locked: false };
          const now = Date.now();
          if (record.lockedUntil && record.lockedUntil > now) {
            return {
              locked: true,
              remainingSeconds: Math.ceil((record.lockedUntil - now) / 1e3)
            };
          }
          if (record.lockedUntil && record.lockedUntil <= now) {
            tx.delete(`records:${canonicalKey}`);
          }
          return { locked: false };
        });
      }
      async recordFailureCombined(params) {
        const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;
        return this.transport.runTransaction(async (tx) => {
          const idRecord = await tx.get(`records:${idKey}`);
          const actRecord = actKey ? await tx.get(`records:${actKey}`) : null;
          const ipRecord = await tx.get(`records:${ipKey}`);
          const now = Date.now();
          const computeOne = (rec, limit) => {
            let record = rec ? { ...rec } : { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: null };
            if (now - record.firstAttempt > WINDOW_DURATION_MS) {
              record = { count: 1, firstAttempt: now, lastAttempt: now, lockedUntil: null };
            } else {
              record.count++;
              record.lastAttempt = now;
            }
            let locked = false;
            let remainingSeconds;
            if (record.count >= limit) {
              record.lockedUntil = now + lockoutDuration;
              locked = true;
              remainingSeconds = Math.ceil(lockoutDuration / 1e3);
            }
            return { record, locked, remainingAttempts: Math.max(0, limit - record.count), remainingSeconds };
          };
          const idRes = computeOne(idRecord, threshold);
          const actRes = actKey ? computeOne(actRecord, threshold) : { record: null, locked: false, remainingAttempts: 0, remainingSeconds: void 0 };
          const ipRes = computeOne(ipRecord, threshold * 3);
          tx.set(`records:${idKey}`, idRes.record);
          if (actKey && actRes.record) {
            tx.set(`records:${actKey}`, actRes.record);
          }
          tx.set(`records:${ipKey}`, ipRes.record);
          return {
            locked: idRes.locked || actRes.locked || ipRes.locked,
            remainingAttempts: idRes.remainingAttempts,
            lockoutSeconds: idRes.remainingSeconds || actRes.remainingSeconds || ipRes.remainingSeconds
          };
        });
      }
      async tryAcquireDualInFlight(params) {
        const { idKey, ipKey, maxId, maxIp, leaseTtlMs } = params;
        return this.transport.runTransaction(async (tx) => {
          const now = Date.now();
          const leaseRegistry = await tx.get("leases:registry") || { activeTokens: [] };
          const activeTokensList = leaseRegistry.activeTokens || [];
          const leaseDocs = [];
          for (const token of activeTokensList) {
            const doc = await tx.get(`leases:${token}`);
            leaseDocs.push({ token, doc });
          }
          const validTokens = [];
          const expiredTokens = [];
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
            for (const expToken of expiredTokens) {
              tx.delete(`leases:${expToken}`);
            }
            tx.set("leases:registry", { activeTokens: validTokens });
            return { admitted: false };
          }
          const leaseToken = `dist_lease_${now}_${Math.random().toString(36).slice(2, 10)}`;
          const newLease = {
            leaseToken,
            idKey,
            ipKey,
            acquiredAt: now,
            expiresAt: now + leaseTtlMs
          };
          validTokens.push(leaseToken);
          for (const expToken of expiredTokens) {
            tx.delete(`leases:${expToken}`);
          }
          tx.set(`leases:${leaseToken}`, newLease);
          tx.set("leases:registry", { activeTokens: validTokens });
          return { admitted: true, leaseToken };
        });
      }
      async renewDualInFlight(leaseToken, extensionMs) {
        if (!leaseToken) return false;
        try {
          return await this.transport.runTransaction(async (tx) => {
            const lease = await tx.get(`leases:${leaseToken}`);
            if (!lease || lease.expiresAt <= Date.now()) {
              return false;
            }
            lease.expiresAt = Date.now() + extensionMs;
            tx.set(`leases:${leaseToken}`, lease);
            return true;
          });
        } catch {
          return false;
        }
      }
      async releaseDualInFlight(leaseToken) {
        if (!leaseToken) return;
        try {
          await this.transport.runTransaction(async (tx) => {
            const lease = await tx.get(`leases:${leaseToken}`);
            const registry = await tx.get("leases:registry") || { activeTokens: [] };
            if (!lease && !(registry.activeTokens || []).includes(leaseToken)) {
              return;
            }
            if (lease) {
              tx.delete(`leases:${leaseToken}`);
            }
            const updatedTokens = (registry.activeTokens || []).filter((t) => t !== leaseToken);
            tx.set("leases:registry", { activeTokens: updatedTokens });
          });
        } catch (err) {
          console.warn(`[RATE_LIMITER] releaseDualInFlight error for ${leaseToken}:`, err?.message || err);
          throw new StoreUnavailableError(`Release failed for token ${leaseToken}: ${err?.message}`);
        }
      }
      async reset(canonicalKey) {
        await this.transport.runTransaction(async (tx) => {
          const record = await tx.get(`records:${canonicalKey}`);
          if (record) {
            tx.delete(`records:${canonicalKey}`);
          }
        });
      }
      async clearAll() {
        await this.transport.runTransaction(async (tx) => {
          const registry = await tx.get("leases:registry") || { activeTokens: [] };
          const tokens = registry.activeTokens || [];
          for (const t of tokens) {
            tx.delete(`leases:${t}`);
          }
          tx.delete("leases:registry");
        });
      }
      async dumpState() {
        return this.transport.runTransaction(async (tx) => {
          const registry = await tx.get("leases:registry") || { activeTokens: [] };
          const tokens = registry.activeTokens || [];
          const leaseDocs = [];
          for (const token of tokens) {
            const doc = await tx.get(`leases:${token}`);
            leaseDocs.push({ token, doc });
          }
          const leases = {};
          for (const { token, doc } of leaseDocs) {
            if (doc) leases[token] = doc;
          }
          return { records: {}, leases };
        });
      }
    };
    ClusterSharedBackend = class {
      static {
        this.clusters = /* @__PURE__ */ new Map();
      }
      static getClusterState(clusterName) {
        if (!this.clusters.has(clusterName)) {
          this.clusters.set(clusterName, { records: {}, leases: {} });
        }
        return this.clusters.get(clusterName);
      }
      static clearCluster(clusterName) {
        this.clusters.set(clusterName, { records: {}, leases: {} });
      }
    };
    TestSimulatorStoreDriver = class {
      constructor(clusterName = "test-cluster") {
        this.name = "test_simulator";
        this.isSimulatedUnavailable = false;
        this.clusterName = clusterName;
      }
      setUnavailable(unavailable) {
        this.isSimulatedUnavailable = unavailable;
      }
      async isHealthy() {
        return !this.isSimulatedUnavailable;
      }
      getSharedState() {
        if (this.isSimulatedUnavailable) throw new StoreUnavailableError("Simulator store backend is unavailable.");
        return ClusterSharedBackend.getClusterState(this.clusterName);
      }
      async isLocked(canonicalKey) {
        const state = this.getSharedState();
        const record = state.records[canonicalKey];
        if (!record) return { locked: false };
        const now = Date.now();
        if (record.lockedUntil && record.lockedUntil > now) {
          return { locked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1e3) };
        }
        return { locked: false };
      }
      async recordFailureCombined(params) {
        const state = this.getSharedState();
        const now = Date.now();
        const { idKey, ipKey, actKey, threshold, lockoutDuration } = params;
        const recordOne = (key, limit) => {
          let rec = state.records[key] || { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: null };
          rec.count++;
          rec.lastAttempt = now;
          let locked = false;
          let remainingSeconds;
          if (rec.count >= limit) {
            rec.lockedUntil = now + lockoutDuration;
            locked = true;
            remainingSeconds = Math.ceil(lockoutDuration / 1e3);
          }
          state.records[key] = rec;
          return { locked, remainingAttempts: Math.max(0, limit - rec.count), remainingSeconds };
        };
        const idRes = recordOne(idKey, threshold);
        const actRes = actKey ? recordOne(actKey, threshold) : { locked: false, remainingAttempts: 0, remainingSeconds: void 0 };
        const ipRes = recordOne(ipKey, threshold * 3);
        return {
          locked: idRes.locked || actRes.locked || ipRes.locked,
          remainingAttempts: idRes.remainingAttempts,
          lockoutSeconds: idRes.remainingSeconds || actRes.remainingSeconds || ipRes.remainingSeconds
        };
      }
      async tryAcquireDualInFlight(params) {
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
          expiresAt: now + leaseTtlMs
        };
        return { admitted: true, leaseToken };
      }
      async renewDualInFlight(leaseToken, extensionMs) {
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
      async releaseDualInFlight(leaseToken) {
        try {
          const state = this.getSharedState();
          if (state.leases[leaseToken]) {
            delete state.leases[leaseToken];
          }
        } catch {
        }
      }
      async reset(canonicalKey) {
        const state = this.getSharedState();
        delete state.records[canonicalKey];
      }
      async clearAll() {
        ClusterSharedBackend.clearCluster(this.clusterName);
      }
      async dumpState() {
        const state = this.getSharedState();
        return JSON.parse(JSON.stringify(state));
      }
    };
    BlockedStoreDriver = class {
      constructor(reason) {
        this.name = "blocked_driver";
        this.reason = reason;
      }
      async isHealthy() {
        return false;
      }
      async isLocked(_canonicalKey) {
        throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
      }
      async recordFailureCombined() {
        throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
      }
      async tryAcquireDualInFlight() {
        throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
      }
      async renewDualInFlight() {
        return false;
      }
      async releaseDualInFlight() {
      }
      async reset() {
        throw new StoreUnavailableError(`FAIL_CLOSED: ${this.reason}`);
      }
      async clearAll() {
      }
      async dumpState() {
        return { records: {}, leases: {} };
      }
    };
    activeStoreDriver = createDefaultStoreDriver();
    AuthRateLimiter = class {
      static getStore() {
        return activeStoreDriver;
      }
      static async isLocked(identifier) {
        const key = toAccountIdKey(identifier);
        return activeStoreDriver.isLocked(key);
      }
      static async recordFailure(identifier, ip, threshold = MAX_FAILED_ATTEMPTS, lockoutDuration = LOCKOUT_DURATION_MS) {
        const idKey = toAccountIdKey(identifier);
        const ipKey = toIpKey(ip);
        return activeStoreDriver.recordFailureCombined({
          idKey,
          ipKey,
          threshold,
          lockoutDuration
        });
      }
      static async recordFailureWithAction(identifier, actionKey, ip, threshold = MAX_FAILED_ATTEMPTS, lockoutDuration = LOCKOUT_DURATION_MS) {
        const idKey = toAccountIdKey(identifier);
        const ipKey = toIpKey(ip);
        let actKey = "";
        if (actionKey.startsWith("act:")) {
          actKey = actionKey;
        } else if (actionKey.includes(":")) {
          const [actName, ...rest] = actionKey.split(":");
          actKey = toActionKey(actName, rest.join(":"));
        } else {
          actKey = toActionKey(actionKey, identifier);
        }
        return activeStoreDriver.recordFailureCombined({
          idKey,
          ipKey,
          actKey,
          threshold,
          lockoutDuration
        });
      }
      static async recordLoginSuccess(nip, ip) {
        const idKey = toAccountIdKey(nip);
        const ipKey = toIpKey(ip);
        await activeStoreDriver.reset(idKey);
        const ipLock = await activeStoreDriver.isLocked(ipKey);
        if (!ipLock.locked) {
          await activeStoreDriver.reset(ipKey);
        }
      }
      static async recordActionSuccess(actionName, targetId, ip) {
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
      static async resetAction(actionName, targetId) {
        const actKey = toActionKey(actionName, targetId);
        await activeStoreDriver.reset(actKey);
      }
      static async recordSuccess(identifier, ip) {
        if (identifier.includes(":")) {
          const [actName, ...rest] = identifier.split(":");
          await this.recordActionSuccess(actName, rest.join(":"), ip);
        } else {
          await this.recordLoginSuccess(identifier, ip);
        }
      }
      static async clearAll() {
        await activeStoreDriver.clearAll();
      }
      /**
       * Express middleware for Login route with token-based lease backpressure,
       * active request lease renewal heartbeat (R10-02, R11-02, R12-02, R13-02), and fail-closed store check
       */
      static async loginMiddleware(req, res, next) {
        const nip = (req.body?.nip || "").trim();
        const ip = getClientIp(req);
        const idKey = toAccountIdKey(nip || "anon");
        const ipKey = toIpKey(ip);
        try {
          const ipLock = await activeStoreDriver.isLocked(ipKey);
          if (ipLock.locked) {
            res.status(429).json({
              success: false,
              error: `Alamat IP diblokir sementara karena terlalu banyak percobaan gagal. Silakan tunggu ${ipLock.remainingSeconds} detik.`,
              code: "IP_LOCKED",
              remainingSeconds: ipLock.remainingSeconds
            });
            return;
          }
          if (nip) {
            const nipLock = await activeStoreDriver.isLocked(idKey);
            if (nipLock.locked) {
              res.status(429).json({
                success: false,
                error: `Akun ini terkunci sementara karena 5 kali percobaan PIN salah. Silakan coba lagi dalam ${nipLock.remainingSeconds} detik.`,
                code: "ACCOUNT_LOCKED",
                remainingSeconds: nipLock.remainingSeconds
              });
              return;
            }
          }
          const acquireRes = await activeStoreDriver.tryAcquireDualInFlight({
            idKey,
            ipKey,
            maxId: MAX_CONCURRENT_IN_FLIGHT_PER_ID,
            maxIp: MAX_CONCURRENT_IN_FLIGHT_PER_IP,
            leaseTtlMs: IN_FLIGHT_LEASE_TTL_MS
          });
          if (!acquireRes.admitted || !acquireRes.leaseToken) {
            res.status(429).json({
              success: false,
              error: "Terlalu banyak permintaan serentak dari alamat IP atau akun ini. Silakan coba beberapa saat lagi.",
              code: "TOO_MANY_CONCURRENT_REQUESTS"
            });
            return;
          }
          const leaseToken = acquireRes.leaseToken;
          let released = false;
          const leaseAbortController = req.leaseAbortController || new AbortController();
          req.leaseAbortController = leaseAbortController;
          req.leaseSignal = leaseAbortController.signal;
          if (typeof req.on === "function") {
            req.on("aborted", () => {
              req.clientDisconnected = true;
              leaseAbortController.abort(new Error("CLIENT_ABORTED"));
            });
          }
          req.socket?.on("close", () => {
            if (!res.writableEnded && !res.headersSent) {
              req.clientDisconnected = true;
              leaseAbortController.abort(new Error("CLIENT_DISCONNECTED"));
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
                leaseAbortController.abort(new Error("LEASE_RENEWAL_FAILED"));
                req.emit("leaseLost", new Error("LEASE_RENEWAL_FAILED"));
                if (!res.headersSent) {
                  res.status(503).json({
                    success: false,
                    error: "Sesi permintaan kehilangan batas laju aman (Lease Lost). Pekerjaan dibatalkan secara aman.",
                    code: "RATE_LIMIT_LEASE_LOST"
                  });
                }
              }
            } catch (err) {
              clearInterval(heartbeatTimer);
              leaseAbortController.abort(err);
              req.emit("leaseLost", err);
              if (!res.headersSent) {
                res.status(503).json({
                  success: false,
                  error: "Gagal memperbarui batas laju aman. Pekerjaan dibatalkan secara aman.",
                  code: "RATE_LIMIT_STORE_UNAVAILABLE"
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
              activeStoreDriver.releaseDualInFlight(leaseToken).catch(() => {
              });
            }
          };
          res.on("finish", safeRelease);
          res.on("close", safeRelease);
          next();
        } catch (storeErr) {
          res.status(503).json({
            success: false,
            error: "Layanan keamanan autentikasi sedang tidak tersedia. Permintaan ditolak secara aman (Fail-Closed).",
            code: "RATE_LIMIT_STORE_UNAVAILABLE"
          });
        }
      }
      /**
       * Generic PIN operation rate limit middleware with token lease, lifecycle signals, and fail-closed 503 (R13-02)
       */
      static createPinActionLimiter(actionName, idField) {
        return async (req, res, next) => {
          const targetId = (req.body?.[idField] || req.user?.uid || "").trim();
          const ip = getClientIp(req);
          const ipKey = toIpKey(ip);
          const actKey = toActionKey(actionName, targetId || "anon");
          const idKey = toAccountIdKey(targetId || "anon");
          try {
            const ipLock = await activeStoreDriver.isLocked(ipKey);
            if (ipLock.locked) {
              res.status(429).json({
                success: false,
                error: `Terlalu banyak percobaan pada aksi ${actionName}. Alamat IP diblokir sementara. Tunggu ${ipLock.remainingSeconds} detik.`,
                code: "IP_LOCKED",
                remainingSeconds: ipLock.remainingSeconds
              });
              return;
            }
            if (targetId) {
              const actionLock = await activeStoreDriver.isLocked(actKey);
              if (actionLock.locked) {
                res.status(429).json({
                  success: false,
                  error: `Aksi ${actionName} untuk akun ini terkunci sementara. Silakan coba lagi dalam ${actionLock.remainingSeconds} detik.`,
                  code: "ACTION_LOCKED",
                  remainingSeconds: actionLock.remainingSeconds
                });
                return;
              }
              const targetLock = await activeStoreDriver.isLocked(idKey);
              if (targetLock.locked) {
                res.status(429).json({
                  success: false,
                  error: `Akun ini terkunci sementara. Silakan coba lagi dalam ${targetLock.remainingSeconds} detik.`,
                  code: "ACCOUNT_LOCKED",
                  remainingSeconds: targetLock.remainingSeconds
                });
                return;
              }
            }
            const acquireRes = await activeStoreDriver.tryAcquireDualInFlight({
              idKey,
              ipKey,
              maxId: MAX_CONCURRENT_IN_FLIGHT_PER_ID,
              maxIp: MAX_CONCURRENT_IN_FLIGHT_PER_IP,
              leaseTtlMs: IN_FLIGHT_LEASE_TTL_MS
            });
            if (!acquireRes.admitted || !acquireRes.leaseToken) {
              res.status(429).json({
                success: false,
                error: "Terlalu banyak permintaan serentak dari alamat IP atau akun ini. Silakan coba beberapa saat lagi.",
                code: "TOO_MANY_CONCURRENT_REQUESTS"
              });
              return;
            }
            const leaseToken = acquireRes.leaseToken;
            let released = false;
            const leaseAbortController = req.leaseAbortController || new AbortController();
            req.leaseAbortController = leaseAbortController;
            req.leaseSignal = leaseAbortController.signal;
            if (typeof req.on === "function") {
              req.on("aborted", () => {
                req.clientDisconnected = true;
                leaseAbortController.abort(new Error("CLIENT_ABORTED"));
              });
            }
            req.socket?.on("close", () => {
              if (!res.writableEnded && !res.headersSent) {
                req.clientDisconnected = true;
                leaseAbortController.abort(new Error("CLIENT_DISCONNECTED"));
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
                  leaseAbortController.abort(new Error("LEASE_RENEWAL_FAILED"));
                  req.emit("leaseLost", new Error("LEASE_RENEWAL_FAILED"));
                  if (!res.headersSent) {
                    res.status(503).json({
                      success: false,
                      error: "Sesi permintaan kehilangan batas laju aman (Lease Lost). Pekerjaan dibatalkan secara aman.",
                      code: "RATE_LIMIT_LEASE_LOST"
                    });
                  }
                }
              } catch (err) {
                clearInterval(heartbeatTimer);
                leaseAbortController.abort(err);
                req.emit("leaseLost", err);
                if (!res.headersSent) {
                  res.status(503).json({
                    success: false,
                    error: "Gagal memperbarui batas laju aman. Pekerjaan dibatalkan secara aman.",
                    code: "RATE_LIMIT_STORE_UNAVAILABLE"
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
                activeStoreDriver.releaseDualInFlight(leaseToken).catch(() => {
                });
              }
            };
            res.on("finish", safeRelease);
            res.on("close", safeRelease);
            next();
          } catch (storeErr) {
            res.status(503).json({
              success: false,
              error: `Layanan keamanan untuk aksi ${actionName} sedang tidak tersedia. Permintaan dihentikan secara aman (Fail-Closed).`,
              code: "RATE_LIMIT_STORE_UNAVAILABLE"
            });
          }
        };
      }
    };
  }
});

// src/server/app.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// src/server/routes/authRoutes.ts
init_firebaseAdmin();
import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";

// src/server/services/credentialStore.ts
init_adaptiveHash();
init_firebaseAdmin();
var CREDENTIALS_COLLECTION = "user_credentials";
var CredentialStore = class {
  static getDb() {
    if (!adminDb) {
      throw new Error("[CREDENTIAL_STORE] Admin SDK Firestore (adminDb) is uninitialized or unavailable.");
    }
    return adminDb;
  }
  /**
   * Sets or updates the adaptive scrypt hashed PIN for a user.
   * Enforces 6-digit numeric constraint, verifies write consistency by reading back,
   * and propagates any database errors immediately.
   */
  static async setCredential(userId, nip, pin) {
    if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
      throw new Error("PIN must be exactly 6 numeric digits");
    }
    const scryptHash = await hashPinAdaptive(pin.trim());
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      userId,
      nip: nip ? nip.trim() : "",
      scryptHash,
      updatedAt: now,
      createdAt: now
    };
    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);
    await credRef.set(record, { merge: true });
    const verifySnap = await credRef.get();
    if (!verifySnap.exists || verifySnap.data()?.scryptHash !== scryptHash) {
      throw new Error(`Write consistency check failed for credential of user '${userId}'`);
    }
  }
  /**
   * Retrieves user credential from private collection.
   * Returns null strictly when document does not exist.
   * Propagates errors on permission or connection failure.
   */
  static async getCredential(userId) {
    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);
    const snap = await credRef.get();
    if (!snap.exists) {
      return null;
    }
    return snap.data();
  }
  /**
   * Verifies a PIN against the user's stored adaptive hash.
   * Fails closed: returns false if credential not found or hash invalid.
   * Strictly avoids plaintext fallback or cached credential revival.
   */
  static async verifyCredential(userId, pin) {
    if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
      return false;
    }
    const cred = await this.getCredential(userId);
    if (!cred || !cred.scryptHash) {
      return false;
    }
    return verifyPinAdaptive(pin.trim(), cred.scryptHash);
  }
  /**
   * Permanently deletes credentials for a removed user with error propagation and readback verification.
   */
  static async deleteCredential(userId) {
    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);
    await credRef.delete();
    const checkSnap = await credRef.get();
    if (checkSnap.exists) {
      throw new Error(`Failed to delete credential record for user '${userId}': document still exists.`);
    }
  }
};

// src/server/routes/authRoutes.ts
init_rateLimiter();
init_firebase_applet_config();
var authRouter = Router();
function sanitizeUserProfile(u) {
  return {
    id: u.id,
    nip: u.nip || "",
    fullName: u.fullName || "",
    role: u.role || "GURU",
    email: u.email || "",
    phone: u.phone || "",
    avatarUrl: u.avatarUrl || null,
    isActive: u.isActive === true,
    permissions: u.permissions || [],
    dataSource: u.dataSource || "PRODUCTION",
    isDemo: u.isDemo || false,
    createdAt: u.createdAt || "",
    updatedAt: u.updatedAt || ""
  };
}
function isRequestCancelled(req) {
  const res = req.res;
  if (Boolean(req.leaseSignal?.aborted) || Boolean(req.leaseAbortController?.signal?.aborted)) {
    return true;
  }
  if (Boolean(req.clientDisconnected) || Boolean(req.aborted)) {
    return true;
  }
  if (req.socket && req.socket.destroyed && !res?.writableEnded && !res?.finished) {
    return true;
  }
  return false;
}
function isResponseClosed(res) {
  if (!res) return false;
  return Boolean(res.headersSent || res.writableEnded || res.finished);
}
function isRequestAborted(req) {
  const res = req.res;
  return isRequestCancelled(req) || isResponseClosed(res);
}
async function requireAuth(req, res, next) {
  const rawAuthHeader = req.headers.authorization;
  if (!rawAuthHeader) {
    res.status(401).json({
      success: false,
      error: "Token autentikasi tidak disertakan. Header Authorization Bearer diperlukan.",
      code: "UNAUTHORIZED"
    });
    return;
  }
  const authHeader = rawAuthHeader.trim();
  if (!authHeader.startsWith("Bearer ") && authHeader !== "Bearer") {
    res.status(401).json({
      success: false,
      error: "Token autentikasi tidak disertakan. Header Authorization Bearer diperlukan.",
      code: "UNAUTHORIZED"
    });
    return;
  }
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
  if (!idToken) {
    res.status(401).json({
      success: false,
      error: "Token autentikasi kosong.",
      code: "EMPTY_TOKEN"
    });
    return;
  }
  try {
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      res.status(401).json({
        success: false,
        error: "Sesi autentikasi tidak valid atau telah kedaluwarsa.",
        code: "INVALID_TOKEN",
        detail: err.message
      });
      return;
    }
    if (!adminDb) {
      res.status(503).json({
        success: false,
        error: "Database backend belum tersedia.",
        code: "DB_UNAVAILABLE"
      });
      return;
    }
    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerSnap.exists) {
      res.status(403).json({
        success: false,
        error: "Profil pengguna tidak ditemukan dalam database.",
        code: "USER_NOT_FOUND"
      });
      return;
    }
    const callerData = callerSnap.data() || {};
    if (callerData.isActive !== true) {
      res.status(403).json({
        success: false,
        error: "Akun Anda dinonaktifkan oleh administrator.",
        code: "ACCOUNT_DISABLED"
      });
      return;
    }
    if (callerData.requiresActivation === true) {
      res.status(403).json({
        success: false,
        error: "Akun Anda memerlukan aktivasi PIN baru oleh Administrator sebelum dapat digunakan.",
        code: "ACCOUNT_REQUIRES_ACTIVATION"
      });
      return;
    }
    const authTime = decoded.auth_time;
    if (typeof authTime !== "number" || authTime <= 0) {
      res.status(401).json({
        success: false,
        error: "Token autentikasi tidak memiliki stempel waktu auth_time yang valid.",
        code: "INVALID_TOKEN"
      });
      return;
    }
    const revokedAt = callerData.sessionRevokedAtSeconds || 0;
    if (revokedAt > 0 && authTime <= revokedAt) {
      res.status(401).json({
        success: false,
        error: "Sesi Anda telah dicabut karena pergantian kredensial atau perubahan status keamanan. Silakan login kembali.",
        code: "SESSION_REVOKED"
      });
      return;
    }
    req.user = {
      ...decoded,
      role: callerData.role || "NONE"
      // Server-authoritative role
    };
    req.callerData = callerData;
    next();
  } catch (fatalErr) {
    console.error("[AUTH MIDDLEWARE] Unexpected failure:", fatalErr);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan sistem saat memvalidasi sesi autentikasi."
    });
  }
}
function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      error: "Operasi ini memerlukan hak akses Administrator.",
      code: "FORBIDDEN_NOT_ADMIN"
    });
    return;
  }
  next();
}
authRouter.get("/signer-status", async (req, res) => {
  const result = await testSignerCapability();
  res.json({
    status: result.available ? "OPERATIONAL" : "BLOCKED",
    projectId: firebase_applet_config_default.projectId,
    signerAvailable: result.available,
    error: result.message || null,
    remediation: result.available ? null : {
      requiredRole: "roles/iam.serviceAccountTokenCreator",
      apiRequired: "iamcredentials.googleapis.com",
      instruction: "Assign Service Account Token Creator role to the Cloud Run runtime service account, or configure FIREBASE_SERVICE_ACCOUNT_KEY."
    }
  });
});
authRouter.get("/users-summary", async (req, res) => {
  if (!adminDb) {
    res.json({
      success: false,
      status: "DEGRADED",
      users: [],
      error: "Database backend tidak tersedia."
    });
    return;
  }
  try {
    const snap = await adminDb.collection("users").get();
    if (snap.empty) {
      res.json({
        success: true,
        status: "EMPTY",
        users: [],
        message: "Belum ada pengguna terdaftar dalam sistem."
      });
      return;
    }
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nip: data.nip || "",
        fullName: data.fullName || "",
        role: data.role || "GURU",
        avatarUrl: data.avatarUrl || null,
        isActive: data.isActive === true
      };
    }).filter((u) => u.isActive);
    if (users.length === 0) {
      res.json({
        success: true,
        status: "EMPTY",
        users: [],
        message: "Tidak ada pengguna aktif dalam sistem."
      });
      return;
    }
    res.json({
      success: true,
      status: "OPERATIONAL",
      users
    });
  } catch (err) {
    const isPermError = err?.code === 7 || err?.message?.includes("PERMISSION_DENIED") || err?.message?.includes("Missing or insufficient permissions");
    res.status(isPermError ? 403 : 500).json({
      success: false,
      status: isPermError ? "PERMISSION_DENIED" : "DEGRADED",
      users: [],
      error: isPermError ? "Izin akses database ditolak (PERMISSION_DENIED)." : "Gagal memuat ringkasan pengguna."
    });
  }
});
authRouter.get("/public-config", async (req, res) => {
  const DEFAULT_CONFIG = {
    schoolName: "SMK dr. SOEBANDI",
    npsn: "20109988",
    address: "Jl. Pendidikan No. 45, Kompleks Edukasi, Jakarta",
    phone: "081234567890",
    logoUrl: "",
    appName: "PIKET GURU",
    appSubtitle: "Jadwal & Buku Piket Digital Sekolah"
  };
  if (!adminDb) {
    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: "DEFAULT_FALLBACK",
      status: "DEGRADED"
    });
    return;
  }
  try {
    const docSnap = await adminDb.collection("settings").doc("school_config").get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      res.json({
        success: true,
        config: {
          schoolName: data.schoolName || DEFAULT_CONFIG.schoolName,
          npsn: data.npsn || DEFAULT_CONFIG.npsn,
          address: data.address || DEFAULT_CONFIG.address,
          phone: data.phone || DEFAULT_CONFIG.phone,
          logoUrl: data.logoUrl || DEFAULT_CONFIG.logoUrl,
          appName: data.appName || DEFAULT_CONFIG.appName,
          appSubtitle: data.appSubtitle || DEFAULT_CONFIG.appSubtitle
        },
        source: "DATABASE",
        status: "OPERATIONAL"
      });
      return;
    }
    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: "DEFAULT_FALLBACK",
      status: "SETUP"
    });
  } catch (err) {
    console.warn("[AUTH ROUTES] public-config read warning:", err?.message || err);
    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: "DEFAULT_FALLBACK",
      status: "DEGRADED",
      warning: "Menggunakan konfigurasi bawaan karena kendala database: " + (err?.message || "Error")
    });
  }
});
authRouter.post("/login", AuthRateLimiter.loginMiddleware, async (req, res) => {
  const { nip, pin } = req.body || {};
  const ip = getClientIp(req);
  if (!nip || !pin) {
    res.status(400).json({
      success: false,
      error: "NIP dan PIN wajib diisi."
    });
    return;
  }
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
    res.status(400).json({
      success: false,
      error: "PIN harus berupa tepat 6 digit angka numerik."
    });
    return;
  }
  if (isRequestAborted(req)) {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: "Sesi permintaan dibatalkan karena kehilangan lease atau pembatalan koneksi.",
        code: "RATE_LIMIT_LEASE_LOST"
      });
    }
    return;
  }
  if (!adminDb) {
    res.status(503).json({
      success: false,
      error: "Layanan database backend tidak tersedia.",
      code: "DB_UNAVAILABLE"
    });
    return;
  }
  try {
    let userData = null;
    let userId = "";
    try {
      const snap = await adminDb.collection("users").where("nip", "==", nip.trim()).limit(1).get();
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        userData = userDoc.data();
        userId = userDoc.id;
      }
    } catch (dbErr) {
      if (isResponseClosed(res)) {
        return;
      }
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: "Sesi permintaan dibatalkan saat pemrosesan verifikasi.",
            code: "RATE_LIMIT_LEASE_LOST"
          });
        }
        return;
      }
      res.status(500).json({
        success: false,
        error: "Gagal mencari data pengguna di database.",
        code: "DB_ERROR"
      });
      return;
    }
    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Sesi permintaan dibatalkan saat pemrosesan verifikasi.",
          code: "RATE_LIMIT_LEASE_LOST"
        });
      }
      return;
    }
    if (!userData) {
      const failInfo = await AuthRateLimiter.recordFailure(nip.trim(), ip);
      if (isRequestAborted(req) || isResponseClosed(res)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: "Sesi permintaan dibatalkan setelah pembaruan batas gagal.",
            code: "RATE_LIMIT_LEASE_LOST"
          });
        }
        return;
      }
      res.status(401).json({
        success: false,
        error: "NIP atau PIN keamanan tidak sesuai.",
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds
      });
      return;
    }
    if (userData.isActive !== true) {
      res.status(403).json({
        success: false,
        error: "Akun Anda dinonaktifkan oleh administrator.",
        code: "ACCOUNT_DISABLED"
      });
      return;
    }
    if (userData.requiresActivation === true) {
      res.status(403).json({
        success: false,
        error: "Akun Anda memerlukan aktivasi PIN baru oleh Administrator sebelum dapat digunakan.",
        code: "ACCOUNT_REQUIRES_ACTIVATION"
      });
      return;
    }
    let isValid = false;
    try {
      isValid = await CredentialStore.verifyCredential(userId, pin.trim());
    } catch (credErr) {
      if (isResponseClosed(res)) {
        return;
      }
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: "Sesi permintaan dibatalkan saat verifikasi kredensial.",
            code: "RATE_LIMIT_LEASE_LOST"
          });
        }
        return;
      }
      res.status(500).json({
        success: false,
        error: "Gagal memverifikasi kredensial database.",
        code: "CREDENTIAL_VERIFY_ERROR"
      });
      return;
    }
    if (isRequestAborted(req)) {
      if (!isResponseClosed(res)) {
        res.status(503).json({
          success: false,
          error: "Sesi permintaan dibatalkan setelah pemrosesan verifikasi.",
          code: "RATE_LIMIT_LEASE_LOST"
        });
      }
      return;
    }
    if (!isValid) {
      const failInfo = await AuthRateLimiter.recordFailure(nip.trim(), ip);
      if (isRequestAborted(req) || isResponseClosed(res)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: "Sesi permintaan dibatalkan setelah pembaruan batas gagal.",
            code: "RATE_LIMIT_LEASE_LOST"
          });
        }
        return;
      }
      res.status(401).json({
        success: false,
        error: "NIP atau PIN keamanan tidak sesuai.",
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds
      });
      return;
    }
    await AuthRateLimiter.recordSuccess(nip.trim(), ip);
    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Sesi permintaan dibatalkan setelah pembaruan batas laju.",
          code: "RATE_LIMIT_LEASE_LOST"
        });
      }
      return;
    }
    const safeUser = sanitizeUserProfile({ id: userId, ...userData });
    let customToken = null;
    try {
      const developerClaims = {
        role: safeUser.role,
        nip: safeUser.nip
      };
      if (!isRequestAborted(req)) {
        customToken = await adminAuth.createCustomToken(userId, developerClaims);
      }
    } catch (signerErr) {
      if (isResponseClosed(res)) return;
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Layanan penandatangan token autentikasi (Firebase Admin SDK) tidak tersedia.",
          code: "SIGNER_UNAVAILABLE"
        });
      }
      return;
    }
    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Sesi permintaan dibatalkan sebelum tanggapan dikirimkan.",
          code: "RATE_LIMIT_LEASE_LOST"
        });
      }
      return;
    }
    if (!customToken) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Token autentikasi tidak berhasil dibuat.",
          code: "TOKEN_MINT_FAILED"
        });
      }
      return;
    }
    res.json({
      success: true,
      user: safeUser,
      customToken
    });
  } catch (err) {
    if (isResponseClosed(res)) {
      console.warn("[AUTH LOGIN] Catch error after response closed:", err?.message || err);
      return;
    }
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan sistem saat memproses autentikasi."
    });
  }
});
async function getUserProfileRecord(userId) {
  if (!adminDb) {
    throw new Error("adminDb not initialized");
  }
  const snap = await adminDb.collection("users").doc(userId).get();
  if (snap.exists) return snap.data();
  return null;
}
authRouter.post(
  "/verify-pin",
  requireAuth,
  AuthRateLimiter.createPinActionLimiter("verifyPin", "userId"),
  async (req, res) => {
    const { userId, pin } = req.body || {};
    const caller = req.user;
    const ip = getClientIp(req);
    if (!userId || !pin) {
      res.status(400).json({ success: false, error: "User ID dan PIN wajib disertakan." });
      return;
    }
    if (typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
      res.status(400).json({ success: false, error: "PIN harus tepat 6 digit angka numerik." });
      return;
    }
    if (caller.uid !== userId && caller.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Akses ditolak: Anda hanya dapat memverifikasi PIN akun Anda sendiri.",
        code: "FORBIDDEN_CROSS_USER"
      });
      return;
    }
    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const userData = await getUserProfileRecord(userId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat mengambil profil.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      if (!userData) {
        res.status(404).json({ success: false, error: "Pengguna tidak ditemukan." });
        return;
      }
      const isMatch = await CredentialStore.verifyCredential(userId, pin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat memverifikasi PIN.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      if (!isMatch) {
        const failInfo = await AuthRateLimiter.recordFailureWithAction(userId, `verifyPin:${userId}`, ip);
        if (isRequestAborted(req) || isResponseClosed(res)) {
          if (!isResponseClosed(res)) {
            res.status(503).json({
              success: false,
              error: "Sesi permintaan dibatalkan setelah pembaruan batas gagal.",
              code: "RATE_LIMIT_LEASE_LOST"
            });
          }
          return;
        }
        res.status(401).json({
          success: false,
          error: "PIN Keamanan tidak sesuai. Akses ditolak.",
          remainingAttempts: failInfo.remainingAttempts,
          isLocked: failInfo.locked,
          remainingSeconds: failInfo.lockoutSeconds
        });
        return;
      }
      await AuthRateLimiter.recordActionSuccess("verifyPin", userId, ip);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan setelah pembaruan status.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      res.json({ success: true, verified: true });
    } catch (err) {
      if (isResponseClosed(res)) return;
      console.error("Verify PIN error:", err);
      res.status(500).json({ success: false, error: err.message || "Gagal memverifikasi PIN." });
    }
  }
);
async function revokeRefreshTokensWithRetry(userId) {
  if (!adminAuth) {
    return { status: "PENDING_RETRY", attempts: 0, error: "adminAuth service unavailable" };
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await adminAuth.revokeRefreshTokens(userId);
      return { status: "REVOKED", attempts: attempt };
    } catch (err) {
      if (attempt === 3) {
        console.warn(`[AUTH] revokeRefreshTokens failed after 3 attempts for ${userId}:`, err?.message || err);
        return { status: "PENDING_RETRY", attempts: attempt, error: err?.message || "Service unavailable" };
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  return { status: "PENDING_RETRY", attempts: 3, error: "Max retries exceeded" };
}
async function executePinChangeTransaction(db, userId, userNip, newHash, nowSeconds, req) {
  let effectiveRevocation = nowSeconds;
  await db.runTransaction(async (transaction) => {
    if (req && isRequestAborted(req)) {
      throw new Error("TRANSACTION_CANCELLED_REQUEST_ABORTED");
    }
    const userRef = db.collection("users").doc(userId);
    const credRef = db.collection("user_credentials").doc(userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("User document not found in transaction");
    if (req && isRequestAborted(req)) {
      throw new Error("TRANSACTION_CANCELLED_REQUEST_ABORTED");
    }
    const existingRevocation = userSnap.data()?.sessionRevokedAtSeconds || 0;
    effectiveRevocation = Math.max(existingRevocation, nowSeconds);
    transaction.set(
      credRef,
      {
        userId,
        nip: userNip,
        scryptHash: newHash,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    transaction.update(userRef, {
      sessionRevokedAtSeconds: effectiveRevocation,
      pin: FieldValue.delete(),
      pinHash: FieldValue.delete(),
      pinSalt: FieldValue.delete(),
      requiresActivation: FieldValue.delete(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  return { effectiveRevocation };
}
authRouter.post(
  "/change-pin",
  requireAuth,
  AuthRateLimiter.createPinActionLimiter("changePin", "userId"),
  async (req, res) => {
    const { userId, oldPin, newPin } = req.body || {};
    const caller = req.user;
    const ip = getClientIp(req);
    if (!userId || !oldPin || !newPin) {
      res.status(400).json({ success: false, error: "Semua field wajib diisi." });
      return;
    }
    if (caller.uid !== userId) {
      res.status(403).json({
        success: false,
        error: "Akses ditolak: Anda hanya dapat mengubah PIN untuk akun Anda sendiri.",
        code: "FORBIDDEN_CROSS_USER"
      });
      return;
    }
    if (typeof newPin !== "string" || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ success: false, error: "PIN baru harus tepat 6 digit angka numerik." });
      return;
    }
    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const userData = await getUserProfileRecord(userId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat mengambil profil.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      if (!userData) {
        res.status(404).json({ success: false, error: "Pengguna tidak ditemukan." });
        return;
      }
      const isOldValid = await CredentialStore.verifyCredential(userId, oldPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat verifikasi PIN lama.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      if (!isOldValid) {
        const failInfo = await AuthRateLimiter.recordFailureWithAction(userId, `changePin:${userId}`, ip);
        if (isRequestAborted(req) || isResponseClosed(res)) {
          if (!isResponseClosed(res)) {
            res.status(503).json({
              success: false,
              error: "Sesi permintaan dibatalkan setelah pembaruan batas gagal.",
              code: "RATE_LIMIT_LEASE_LOST"
            });
          }
          return;
        }
        res.status(401).json({
          success: false,
          error: "PIN lama yang Anda masukkan salah.",
          remainingAttempts: failInfo.remainingAttempts,
          isLocked: failInfo.locked,
          remainingSeconds: failInfo.lockoutSeconds
        });
        return;
      }
      const { hashPinAdaptive: hashPinAdaptive2 } = await Promise.resolve().then(() => (init_adaptiveHash(), adaptiveHash_exports));
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan sebelum hashing.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const newHash = await hashPinAdaptive2(newPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan setelah hashing.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const nowSeconds = Math.floor(Date.now() / 1e3);
      if (!adminDb) throw new Error("Database service unavailable");
      await executePinChangeTransaction(adminDb, userId, userData.nip, newHash, nowSeconds, req);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan setelah transaksi.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      await AuthRateLimiter.recordActionSuccess("changePin", userId, ip);
      const refreshRevocation = await revokeRefreshTokensWithRetry(userId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan sebelum balasan.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      res.json({
        success: true,
        message: "PIN berhasil diubah.",
        refreshRevocation
      });
    } catch (err) {
      if (isResponseClosed(res)) return;
      if (err?.message === "TRANSACTION_CANCELLED_REQUEST_ABORTED") {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat transaksi.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      console.error("Change PIN error:", err);
      res.status(500).json({ success: false, error: err.message || "Gagal mengubah PIN." });
    }
  }
);
authRouter.post(
  "/reset-pin",
  requireAuth,
  requireAdmin,
  AuthRateLimiter.createPinActionLimiter("resetPin", "targetUserId"),
  async (req, res) => {
    const { targetUserId, newPin } = req.body || {};
    const caller = req.user;
    const ip = getClientIp(req);
    if (!targetUserId || !newPin) {
      res.status(400).json({ success: false, error: "Target User ID dan PIN baru wajib disertakan." });
      return;
    }
    if (typeof newPin !== "string" || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ success: false, error: "PIN baru harus tepat 6 digit angka numerik." });
      return;
    }
    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const targetData = await getUserProfileRecord(targetUserId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat mengambil profil target.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      if (!targetData) {
        res.status(404).json({ success: false, error: "Target pengguna tidak ditemukan." });
        return;
      }
      const { hashPinAdaptive: hashPinAdaptive2 } = await Promise.resolve().then(() => (init_adaptiveHash(), adaptiveHash_exports));
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan sebelum hashing.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const newHash = await hashPinAdaptive2(newPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan setelah hashing.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const nowSeconds = Math.floor(Date.now() / 1e3);
      if (!adminDb) throw new Error("Database service unavailable");
      await executePinChangeTransaction(adminDb, targetUserId, targetData.nip, newHash, nowSeconds, req);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan setelah transaksi.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      const refreshRevocation = await revokeRefreshTokensWithRetry(targetUserId);
      await AuthRateLimiter.recordLoginSuccess(targetData.nip, ip);
      await AuthRateLimiter.recordActionSuccess("verifyPin", targetUserId, ip);
      await AuthRateLimiter.recordActionSuccess("changePin", targetUserId, ip);
      await AuthRateLimiter.recordActionSuccess("resetPin", targetUserId, ip);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan sebelum balasan.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      console.log(`[AUDIT] Admin ${caller.uid} successfully reset PIN for user ${targetUserId}`);
      res.json({
        success: true,
        message: "PIN pengguna berhasil direset.",
        refreshRevocation
      });
    } catch (err) {
      if (isResponseClosed(res)) return;
      if (err?.message === "TRANSACTION_CANCELLED_REQUEST_ABORTED") {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: "Sesi permintaan dibatalkan saat transaksi.", code: "RATE_LIMIT_LEASE_LOST" });
        return;
      }
      console.error("Reset PIN error:", err);
      res.status(500).json({ success: false, error: err.message || "Gagal mereset PIN pengguna." });
    }
  }
);

// src/server/app.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function createApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(express.json({ limit: "15mb" }));
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.pin) sanitizedBody.pin = "[REDACTED]";
      if (sanitizedBody.oldPin) sanitizedBody.oldPin = "[REDACTED]";
      if (sanitizedBody.newPin) sanitizedBody.newPin = "[REDACTED]";
      console.log(`[API] ${req.method} ${req.path}`, Object.keys(sanitizedBody).length ? sanitizedBody : "");
    }
    next();
  });
  app2.use("/api/auth", authRouter);
  app2.use("/artifacts", express.static(path2.resolve(__dirname, "../../public/artifacts")));
  app2.use("/artifacts", express.static(path2.resolve(__dirname, "../../artifacts")));
  app2.get("/api/health", async (req, res) => {
    const { getAuthRateLimiterReadiness: getAuthRateLimiterReadiness2 } = await Promise.resolve().then(() => (init_rateLimiter(), rateLimiter_exports));
    const authReadiness = await getAuthRateLimiterReadiness2();
    const isOk = authReadiness.status === "HEALTHY";
    res.status(isOk ? 200 : 503).json({
      status: isOk ? "OK" : "UNAVAILABLE",
      app: "Piket Guru Digital",
      version: "1.1.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      authRateLimiter: {
        status: authReadiness.status,
        driver: authReadiness.driver
      }
    });
  });
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({
        success: false,
        error: `Rute API ${req.method} ${req.originalUrl} tidak ditemukan.`,
        code: "NOT_FOUND"
      });
      return;
    }
    next();
  });
  return app2;
}
var app = createApp();

// api/index.ts
var index_default = app;
export {
  index_default as default
};
