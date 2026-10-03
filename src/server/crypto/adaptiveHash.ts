import { scrypt, randomBytes, timingSafeEqual } from 'crypto';

/**
 * OWASP Password Storage Cheat Sheet compliant adaptive password hashing using Scrypt.
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt
 *
 * OWASP Recommended Parameters:
 *   N (CPU/memory cost parameter): 16384 (2^14)
 *   r (Block size parameter): 8
 *   p (Parallelization parameter): 5
 *   keylen: 64 bytes (512 bits)
 *   salt: 32 bytes (256 bits cryptographically secure random from crypto.randomBytes)
 *   maxmem: 64 MB (67,108,864 bytes)
 *
 * Encoded self-describing modular crypt format:
 *   $scrypt$N=16384,r=8,p=5$<salt_hex>$<derived_key_hex>
 */
const OWASP_SCRYPT_N = 16384;
const OWASP_SCRYPT_R = 8;
const OWASP_SCRYPT_P = 5;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;
const MAX_MEM_BYTES = 64 * 1024 * 1024; // 64 MB
const HARD_CEILING_MEM_BYTES = 128 * 1024 * 1024; // 128 MB

// Concurrency Limiter: Prevent CPU starvation DoS by limiting simultaneous scrypt operations
const MAX_CONCURRENT_SCRYPT = 4;
let activeScryptCount = 0;
const scryptQueue: Array<() => void> = [];

function acquireScryptSlot(): Promise<void> {
  if (activeScryptCount < MAX_CONCURRENT_SCRYPT) {
    activeScryptCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    scryptQueue.push(() => {
      activeScryptCount++;
      resolve();
    });
  });
}

function releaseScryptSlot(): void {
  activeScryptCount--;
  if (scryptQueue.length > 0) {
    const next = scryptQueue.shift();
    if (next) next();
  }
}

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keyLength: number;
  maxmem?: number;
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  N: OWASP_SCRYPT_N,
  r: OWASP_SCRYPT_R,
  p: OWASP_SCRYPT_P,
  keyLength: KEY_LENGTH,
  maxmem: MAX_MEM_BYTES,
};

async function deriveScrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem?: number }
): Promise<Buffer> {
  await acquireScryptSlot();
  try {
    const opts = {
      cost: options.N,
      blockSize: options.r,
      parallelization: options.p,
      maxmem: options.maxmem || MAX_MEM_BYTES,
    };
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, keyLength, opts, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  } finally {
    releaseScryptSlot();
  }
}

let customHashInterceptor: ((pin: string) => Promise<string>) | null = null;

export function setCustomHashInterceptor(fn: ((pin: string) => Promise<string>) | null) {
  customHashInterceptor = fn;
}

/**
 * Hashes a 6-digit PIN using adaptive scrypt with OWASP parameters (N=16384, r=8, p=5).
 */
export async function hashPinAdaptive(
  pin: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<string> {
  if (customHashInterceptor) {
    return customHashInterceptor(pin);
  }
  if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be a valid 6-digit string');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveScrypt(pin, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem || MAX_MEM_BYTES,
  });

  const saltHex = salt.toString('hex');
  const keyHex = derivedKey.toString('hex');

  return `$scrypt$N=${params.N},r=${params.r},p=${params.p}$${saltHex}$${keyHex}`;
}

/**
 * Verifies a PIN against an encoded scrypt hash.
 * Supports self-describing parameters from the encoded string ($scrypt$N=...,r=...,p=...$salt$key).
 * Timing-safe comparison is used to prevent timing side-channel attacks.
 *
 * Rigorously rejects:
 * - Empty salt or empty key
 * - Invalid hex characters or non-hex string
 * - Truncated key lengths (< 32 bytes)
 * - Out-of-bounds parameters (N not power of two, excessive memory cost)
 */
export async function verifyPinAdaptive(pin: string, storedHash: string): Promise<boolean> {
  if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
    return false;
  }
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  // Format: ['', 'scrypt', 'N=16384,r=8,p=5', '<salt_hex>', '<key_hex>']
  if (parts.length !== 5 || parts[1] !== 'scrypt') {
    return false;
  }

  const paramStr = parts[2];
  const saltHex = parts[3];
  const originalKeyHex = parts[4];

  // Rigorous validation of salt and key hex format (REV-01 fix: prevent empty key bypass and odd-length hex)
  if (!saltHex || !/^[0-9a-fA-F]{32,128}$/.test(saltHex) || saltHex.length % 2 !== 0) {
    return false;
  }
  if (!originalKeyHex || !/^[0-9a-fA-F]{64,256}$/.test(originalKeyHex) || originalKeyHex.length % 2 !== 0) {
    return false;
  }

  // Parse parameters dynamically from hash
  const paramMap = new Map<string, number>();
  for (const pair of paramStr.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) {
      const parsedVal = parseInt(v, 10);
      if (isNaN(parsedVal)) return false;
      paramMap.set(k.trim(), parsedVal);
    }
  }

  const N = paramMap.get('N');
  const r = paramMap.get('r');
  const p = paramMap.get('p');

  if (N === undefined || r === undefined || p === undefined) {
    return false;
  }

  // Validate parameter boundaries (prevent DoS memory exhaustion or weak degradation)
  // N must be a power of 2 between 1024 and 1048576
  if (N < 1024 || N > 1048576 || (N & (N - 1)) !== 0) {
    return false;
  }
  // r must be between 1 and 32
  if (r < 1 || r > 32) {
    return false;
  }
  // p must be between 1 and 32
  if (p < 1 || p > 32) {
    return false;
  }

  // Ensure computed memory cost 128 * r * N does not exceed ceiling
  const estimatedMemBytes = 128 * r * N;
  if (estimatedMemBytes > HARD_CEILING_MEM_BYTES) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const originalKey = Buffer.from(originalKeyHex, 'hex');

  if (salt.length < 16 || originalKey.length < 32) {
    return false;
  }

  try {
    const derivedKey = await deriveScrypt(pin, salt, originalKey.length, {
      N,
      r,
      p,
      maxmem: Math.max(MAX_MEM_BYTES, estimatedMemBytes * 2),
    });

    if (derivedKey.length !== originalKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, originalKey);
  } catch (err) {
    console.error('[SCRYPT] Verification error:', err);
    return false;
  }
}
