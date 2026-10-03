import * as http from 'http';
import express, { Request, Response } from 'express';
import { authRouter, requireAuth, requireAdmin } from '../src/server/routes/authRoutes';
import { hashPinAdaptive, verifyPinAdaptive } from '../src/server/crypto/adaptiveHash';
import { AuthRateLimiter, AtomicRateLimitStore, getClientIp } from '../src/server/middleware/rateLimiter';
import { CredentialStore } from '../src/server/services/credentialStore';
import { BackupService, BackupPayload, containsCredentialFields, stripCredentialsDeep } from '../src/services/backup/backupService';
import { SnapshotService, computeSha256 } from '../src/services/backup/snapshotService';
import { runMigration } from './migrate_credentials';
import { UserProfile } from '../src/types';

interface TestRecord {
  code: string;
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const records: TestRecord[] = [];

function pass(code: string, category: string, name: string, details: string) {
  records.push({ code, category, name, status: 'PASS', details });
  console.log(`✅ [PASS] ${code}: ${name}`);
  console.log(`   ${details}\n`);
}

function fail(code: string, category: string, name: string, details: string) {
  records.push({ code, category, name, status: 'FAIL', details });
  console.error(`❌ [FAIL] ${code}: ${name}`);
  console.error(`   ${details}\n`);
}

/**
 * In-process HTTP request helper against an Express instance
 */
async function makeRequest(
  server: http.Server,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  const addr = server.address() as any;
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (options.body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export async function runComprehensiveSuite(): Promise<boolean> {
  console.log('================================================================');
  console.log('   CR-AUTH-BACKUP-001 — COMPREHENSIVE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  // Setup test Express server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    // -------------------------------------------------------------
    // CATEGORY 1: TOKEN GUARD & AUTHENTICATION ENFORCEMENT
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 1] TOKEN GUARD & AUTHENTICATION ENFORCEMENT ---');

    // 1.1: Missing Authorization header
    const r1 = await makeRequest(server, '/api/auth/verify-pin', {
      method: 'POST',
      body: { userId: 'usr-1', pin: '123456' },
    });
    if (r1.status === 401 && r1.body.code === 'UNAUTHORIZED') {
      pass('AUTH-01', 'HTTP', 'Missing Authorization Header', 'Returned 401 UNAUTHORIZED');
    } else {
      fail('AUTH-01', 'HTTP', 'Missing Authorization Header', `Expected 401, got ${r1.status}`);
    }

    // 1.2: Empty Bearer token
    const r2 = await makeRequest(server, '/api/auth/verify-pin', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' },
      body: { userId: 'usr-1', pin: '123456' },
    });
    if (r2.status === 401 && r2.body.code === 'EMPTY_TOKEN') {
      pass('AUTH-02', 'HTTP', 'Empty Bearer Token', 'Returned 401 EMPTY_TOKEN');
    } else {
      fail('AUTH-02', 'HTTP', 'Empty Bearer Token', `Expected 401 EMPTY_TOKEN, got ${r2.status}`);
    }

    // 1.3: Invalid token signature with "test-token-" prefix on NODE_ENV=production
    // STRICT: Must be rejected by verifyIdToken without decoding fallback!
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const fakeToken = 'test-token-unsigned.eyJ1aWQiOiJ1c3ItYWRtaW4tMDEiLCJyb2xlIjoiQURNQSUifQ.invalidsig';
    const r3 = await makeRequest(server, '/api/auth/verify-pin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fakeToken}` },
      body: { userId: 'usr-admin-01', pin: '123456' },
    });
    process.env.NODE_ENV = oldEnv;

    if (r3.status === 401 && r3.body.code === 'INVALID_TOKEN') {
      pass(
        'AUTH-03',
        'HTTP',
        'Prefix Token Bypass Rejection in Production',
        'Tokens starting with test-token- with invalid signatures are strictly rejected (401 INVALID_TOKEN)'
      );
    } else {
      fail(
        'AUTH-03',
        'HTTP',
        'Prefix Token Bypass Rejection in Production',
        `Expected 401 INVALID_TOKEN, got ${r3.status} (${JSON.stringify(r3.body)})`
      );
    }

    // 1.4: PIN input validation (must be exactly 6 numeric digits)
    const r4_alpha = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: { nip: '123456', pin: 'abc123' },
    });
    const r4_short = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      body: { nip: '123456', pin: '12345' },
    });
    if (r4_alpha.status === 400 && r4_short.status === 400) {
      pass('AUTH-04', 'HTTP', 'PIN Format Enforcement', 'Strictly rejects non-numeric or non-6-digit PINs (400)');
    } else {
      fail('AUTH-04', 'HTTP', 'PIN Format Enforcement', 'Did not reject malformed PIN format with 400');
    }

    // -------------------------------------------------------------
    // CATEGORY 2: PUBLIC CONFIG DTO & ALLOWLIST EXPOSURE
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 2] PUBLIC CONFIG DTO & INFORMATION LEAKAGE ---');

    const r5 = await makeRequest(server, '/api/auth/public-config');
    const sensitiveKeys = ['schoolLat', 'schoolLng', 'radius', 'workHours', 'geofence', 'adminPin'];
    const exposed = sensitiveKeys.filter((k) => r5.body?.config && k in r5.body.config);

    if (r5.status === 200 && exposed.length === 0) {
      pass(
        'DTO-01',
        'LEAK_PREVENTION',
        'Public Config Allowlist Enforcement',
        `Clean public branding returned; sensitive keys [${sensitiveKeys.join(', ')}] completely excluded.`
      );
    } else {
      fail('DTO-01', 'LEAK_PREVENTION', 'Public Config Allowlist Enforcement', `Sensitive keys leaked: ${exposed.join(', ')}`);
    }

    // -------------------------------------------------------------
    // CATEGORY 3: RATE LIMITER, MULTI-INSTANCE & SPOOFING PROTECTION
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 3] RATE LIMITER & DISTRIBUTED STATE ---');

    await AuthRateLimiter.clearAll();

    // 3.1: 5 sequential wrong PINs on login leads to lockout (429)
    const testNip = `nip-test-${Date.now()}`;
    const testIp = '198.51.100.25';

    for (let i = 0; i < 5; i++) {
      await AuthRateLimiter.recordFailure(testNip, testIp);
    }

    const lockStatus = await AuthRateLimiter.isLocked(testNip);
    if (lockStatus.locked) {
      pass(
        'LIMIT-01',
        'RATE_LIMIT',
        'Sequential Failed Attempts Lockout',
        `Account locked out after 5 failures (remainingSeconds: ${lockStatus.remainingSeconds})`
      );
    } else {
      fail('LIMIT-01', 'RATE_LIMIT', 'Sequential Failed Attempts Lockout', 'Account was not locked after 5 attempts');
    }

    // Test login route middleware returns 429 when locked
    const r6_locked = await makeRequest(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': testIp },
      body: { nip: testNip, pin: '111111' },
    });
    if (r6_locked.status === 429 && r6_locked.body.code === 'ACCOUNT_LOCKED') {
      pass('LIMIT-02', 'HTTP', 'Locked Account Rejection', 'Login handler returns 429 ACCOUNT_LOCKED');
    } else {
      fail('LIMIT-02', 'HTTP', 'Locked Account Rejection', `Expected 429, got ${r6_locked.status}`);
    }

    // 3.2: Multi-instance / Restart Simulation
    // Create a new AtomicRateLimitStore instance which reloads from the shared file
    const secondStore = new AtomicRateLimitStore();
    const secondInstanceLock = await secondStore.isLocked(testNip);
    if (secondInstanceLock.locked) {
      pass(
        'LIMIT-03',
        'MULTI_INSTANCE',
        'Rate Limiter State Persistence across Restarts',
        'Lockout state successfully loaded by new store instance from persistence layer'
      );
    } else {
      fail('LIMIT-03', 'MULTI_INSTANCE', 'Rate Limiter State Persistence across Restarts', 'State was lost across store instances');
    }

    // 3.3: IP Spoofing Protection in getClientIp
    const mockReqWithSpoof = {
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.195' },
      ip: '127.0.0.1',
    } as unknown as Request;
    const derivedIp = getClientIp(mockReqWithSpoof);
    if (derivedIp === '203.0.113.195') {
      pass(
        'LIMIT-04',
        'SPOOFING_GUARD',
        'X-Forwarded-For Spoofing Resistance',
        'Correctly extracted rightmost proxy-appended IP (203.0.113.195) instead of client-controlled first element (1.2.3.4)'
      );
    } else {
      fail('LIMIT-04', 'SPOOFING_GUARD', 'X-Forwarded-For Spoofing Resistance', `Expected 203.0.113.195, got ${derivedIp}`);
    }

    await AuthRateLimiter.clearAll();

    // -------------------------------------------------------------
    // CATEGORY 4: ADAPTIVE CRYPTO & TIMING ATTACK RESISTANCE
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 4] ADAPTIVE CRYPTO & SCRYPT VALIDATION ---');

    // 4.1: Adaptive scrypt generation and self-verification
    const samplePin = '839201';
    const hash = await hashPinAdaptive(samplePin);
    const verifyOk = await verifyPinAdaptive(samplePin, hash);
    const verifyWrong = await verifyPinAdaptive('999999', hash);

    if (verifyOk && !verifyWrong && hash.includes('$scrypt$N=16384,r=8,p=5$')) {
      pass('CRYPTO-01', 'SCRYPT', 'Adaptive Scrypt OWASP Baseline', 'Format $scrypt$N=16384,r=8,p=5$ verified');
    } else {
      fail('CRYPTO-01', 'SCRYPT', 'Adaptive Scrypt OWASP Baseline', 'Verification failed or parameter mismatch');
    }

    // 4.2: Malformed hex rejection (empty salt/key, odd-length hex)
    const malformed1 = '$scrypt$N=16384,r=8,p=5$$abcd';
    const malformed2 = '$scrypt$N=16384,r=8,p=5$abc$1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const ok1 = await verifyPinAdaptive('123456', malformed1);
    const ok2 = await verifyPinAdaptive('123456', malformed2);

    if (!ok1 && !ok2) {
      pass('CRYPTO-02', 'SCRYPT', 'Malformed / Empty Hex Rejection', 'Rigorously rejected empty salt and odd-length hex');
    } else {
      fail('CRYPTO-02', 'SCRYPT', 'Malformed / Empty Hex Rejection', 'Malformed hash was unexpectedly parsed or accepted');
    }

    // -------------------------------------------------------------
    // CATEGORY 5: CREDENTIAL STORE INTEGRITY
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 5] CREDENTIAL STORE SERVER-AUTHORITATIVE CHECKS ---');

    // Test CredentialStore parameter enforcement
    try {
      await CredentialStore.setCredential('usr-test', '123', 'abc');
      fail('STORE-01', 'CREDENTIAL_STORE', 'PIN Format in CredentialStore', 'Did not reject non-numeric PIN');
    } catch {
      pass('STORE-01', 'CREDENTIAL_STORE', 'PIN Format in CredentialStore', 'Enforces strict 6 numeric digits before database write');
    }

    // -------------------------------------------------------------
    // CATEGORY 6: MIGRATION RUNNER MUTUAL EXCLUSION & SAFEGUARDS
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 6] MIGRATION RUNNER SAFEGUARDS ---');

    // 6.1: Reject --execute together with --dry-run
    const conflictResult = await runMigration(['--execute', '--dry-run']);
    if (!conflictResult.success) {
      pass(
        'MIGR-01',
        'MIGRATION',
        'Flag Conflict Mutual Exclusion',
        'Successfully rejected simultaneous --execute and --dry-run flags'
      );
    } else {
      fail('MIGR-01', 'MIGRATION', 'Flag Conflict Mutual Exclusion', 'Allowed conflicting flags to execute together');
    }

    // -------------------------------------------------------------
    // CATEGORY 7: BACKUP, RESTORE & CRYPTOGRAPHIC SNAPSHOTS
    // -------------------------------------------------------------
    console.log('--- [CATEGORY 7] BACKUP, RESTORE & SNAPSHOT INTEGRITY ---');

    // 7.1: Deep credential detection and stripping
    const dirtyUser = {
      id: 'usr-1',
      fullName: 'Teacher A',
      pin: '123456',
      pinHash: 'hash_val',
      nested: { password: 'secret_pass' },
    };
    const hasCreds = containsCredentialFields(dirtyUser);
    const cleaned = stripCredentialsDeep(dirtyUser);
    const stillHasCreds = containsCredentialFields(cleaned);

    if (hasCreds && !stillHasCreds && !(cleaned as any).pin && !(cleaned as any).nested.password) {
      pass('BACKUP-01', 'BACKUP', 'Deep Credential Stripping', 'Cleaned root and nested credential fields completely');
    } else {
      fail('BACKUP-01', 'BACKUP', 'Deep Credential Stripping', 'Credential fields retained after stripping');
    }

    // 7.2: Schema validation rejects forbidden / unknown collections
    const invalidBackupPayload = {
      formatVersion: '1.2.0',
      app: 'PIKET_GURU_DIGITAL',
      data: {
        users: [],
        user_credentials: [{ userId: '1', scryptHash: 'leak' }],
      },
    };
    const validation = BackupService.validateBackupSchema(invalidBackupPayload);
    if (!validation.isValid && validation.error?.includes('koleksi terlarang')) {
      pass(
        'BACKUP-02',
        'VALIDATION',
        'Forbidden Collection Rejection Before Write',
        'Rejected payload containing user_credentials prior to any database write'
      );
    } else {
      fail('BACKUP-02', 'VALIDATION', 'Forbidden Collection Rejection Before Write', 'Failed to reject forbidden collection');
    }

    // 7.3: Cryptographic SHA-256 Checksum on Snapshots
    const testData = JSON.stringify({ app: 'PIKET_GURU', counter: 42 });
    const digestA = await computeSha256(testData);
    const digestB = await computeSha256(testData);
    const digestTampered = await computeSha256(JSON.stringify({ app: 'PIKET_GURU', counter: 43 }));

    if (digestA === digestB && digestA !== digestTampered && digestA.length === 64) {
      pass(
        'SNAP-01',
        'SNAPSHOT',
        'Cryptographic SHA-256 Checksum Generation',
        `Standard 64-char hex digest verified (SHA-256: ${digestA.substring(0, 16)}...)`
      );
    } else {
      fail('SNAP-01', 'SNAPSHOT', 'Cryptographic SHA-256 Checksum Generation', 'SHA-256 hash computation mismatch');
    }

    // 7.4: Verification Failure on Tampered Snapshot Payload
    const tamperedSnapshotRecord: any = {
      id: 'SNAP-TEST-01',
      hashFingerprint: digestA,
      isChunked: false,
      dataPayload: { app: 'PIKET_GURU', counter: 999 }, // Tampered payload
    };

    try {
      await SnapshotService.loadAndVerifyPayload(tamperedSnapshotRecord);
      fail('SNAP-02', 'SNAPSHOT', 'Tampered Snapshot Detection', 'Did not throw error on tampered snapshot digest mismatch');
    } catch (err: any) {
      if (err.message.includes('Verifikasi integritas snapshot gagal')) {
        pass(
          'SNAP-02',
          'SNAPSHOT',
          'Tampered Snapshot Detection',
          'Successfully caught hash mismatch and aborted restore operation'
        );
      } else {
        fail('SNAP-02', 'SNAPSHOT', 'Tampered Snapshot Detection', `Unexpected error: ${err.message}`);
      }
    }
  } finally {
    server.close();
  }

  // Summary
  const passCount = records.filter((r) => r.status === 'PASS').length;
  const failCount = records.filter((r) => r.status === 'FAIL').length;

  console.log('\n================================================================');
  console.log(`SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${records.length})`);
  console.log('================================================================\n');

  return failCount === 0;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('test_rules_and_auth_suite.ts')) {
  runComprehensiveSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('[FATAL] Verification suite error:', err);
      process.exit(1);
    });
}
