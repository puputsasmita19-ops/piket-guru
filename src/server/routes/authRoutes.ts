import { Router, Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb, testSignerCapability } from '../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { CredentialStore } from '../services/credentialStore.js';
import { AuthRateLimiter, getClientIp } from '../middleware/rateLimiter.js';
import { UserProfile } from '../../types/index.js';
import firebaseConfig from '../../../firebase-applet-config.json';

export const authRouter = Router();

/**
 * Sanitizes a UserProfile object to ensure NO credential fields are ever returned to the client
 */
export function sanitizeUserProfile(u: any): UserProfile {
  return {
    id: u.id,
    nip: u.nip || '',
    fullName: u.fullName || '',
    role: u.role || 'GURU',
    email: u.email || '',
    phone: u.phone || '',
    avatarUrl: u.avatarUrl || null,
    isActive: u.isActive === true,
    permissions: u.permissions || [],
    dataSource: u.dataSource || 'PRODUCTION',
    isDemo: u.isDemo || false,
    createdAt: u.createdAt || '',
    updatedAt: u.updatedAt || '',
  };
}

/**
 * Returns true if the client disconnected, lease was lost/aborted, or socket was destroyed before response ended.
 * Independent of whether a response has been sent.
 */
export function isRequestCancelled(req: Request): boolean {
  const res = (req as any).res;

  if (Boolean((req as any).leaseSignal?.aborted) || Boolean((req as any).leaseAbortController?.signal?.aborted)) {
    return true;
  }

  if (Boolean((req as any).clientDisconnected) || Boolean((req as any).aborted)) {
    return true;
  }

  if (req.socket && req.socket.destroyed && !res?.writableEnded && !res?.finished) {
    return true;
  }

  return false;
}

/**
 * Returns true if response headers have been sent or response has ended.
 */
export function isResponseClosed(res?: Response | any): boolean {
  if (!res) return false;
  return Boolean(res.headersSent || res.writableEnded || res.finished);
}

/**
 * Checks whether an active request has been aborted due to lease loss, client disconnect, or completed response.
 * Handlers use this to halt further processing and prevent duplicate response writes (R15-01, R15-02).
 */
export function isRequestAborted(req: Request): boolean {
  const res = (req as any).res;
  return isRequestCancelled(req) || isResponseClosed(res);
}

/**
 * Authenticates requests strictly via verified Firebase ID Token.
 * Resolves caller UID, verifies profile existence, strict isActive=true, and session revocation (REV-02).
 * STRICT: Zero mock/test token bypasses in production trust model.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawAuthHeader = req.headers.authorization;
  if (!rawAuthHeader) {
    res.status(401).json({
      success: false,
      error: 'Token autentikasi tidak disertakan. Header Authorization Bearer diperlukan.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const authHeader = rawAuthHeader.trim();
  if (!authHeader.startsWith('Bearer ') && authHeader !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: 'Token autentikasi tidak disertakan. Header Authorization Bearer diperlukan.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  if (!idToken) {
    res.status(401).json({
      success: false,
      error: 'Token autentikasi kosong.',
      code: 'EMPTY_TOKEN',
    });
    return;
  }

  try {
    let decoded: any;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: 'Sesi autentikasi tidak valid atau telah kedaluwarsa.',
        code: 'INVALID_TOKEN',
        detail: err.message,
      });
      return;
    }

    if (!adminDb) {
      res.status(503).json({
        success: false,
        error: 'Database backend belum tersedia.',
        code: 'DB_UNAVAILABLE',
      });
      return;
    }

    // Verify caller existence in Firestore strictly via Admin SDK
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) {
      res.status(403).json({
        success: false,
        error: 'Profil pengguna tidak ditemukan dalam database.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    const callerData = callerSnap.data() || {};

    // Strict active check: isActive must be strictly boolean true
    if (callerData.isActive !== true) {
      res.status(403).json({
        success: false,
        error: 'Akun Anda dinonaktifkan oleh administrator.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    // Strict activation check: account pending activation must be rejected
    if (callerData.requiresActivation === true) {
      res.status(403).json({
        success: false,
        error: 'Akun Anda memerlukan aktivasi PIN baru oleh Administrator sebelum dapat digunakan.',
        code: 'ACCOUNT_REQUIRES_ACTIVATION',
      });
      return;
    }

    // Check token auth_time: must be a valid positive integer
    const authTime = decoded.auth_time;
    if (typeof authTime !== 'number' || authTime <= 0) {
      res.status(401).json({
        success: false,
        error: 'Token autentikasi tidak memiliki stempel waktu auth_time yang valid.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Check session revocation: auth_time <= sessionRevokedAtSeconds must be rejected
    const revokedAt = callerData.sessionRevokedAtSeconds || 0;
    if (revokedAt > 0 && authTime <= revokedAt) {
      res.status(401).json({
        success: false,
        error: 'Sesi Anda telah dicabut karena pergantian kredensial atau perubahan status keamanan. Silakan login kembali.',
        code: 'SESSION_REVOKED',
      });
      return;
    }

    (req as any).user = {
      ...decoded,
      role: callerData.role || 'NONE', // Server-authoritative role
    };
    (req as any).callerData = callerData;

    next();
  } catch (fatalErr: any) {
    console.error('[AUTH MIDDLEWARE] Unexpected failure:', fatalErr);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan sistem saat memvalidasi sesi autentikasi.',
    });
  }
}

/**
 * Enforces that caller must hold server-verified ADMIN role (REV-02).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Operasi ini memerlukan hak akses Administrator.',
      code: 'FORBIDDEN_NOT_ADMIN',
    });
    return;
  }
  next();
}

/**
 * GET /api/auth/signer-status
 * Diagnostics endpoint to check IAM ADC signer availability for Firebase Custom Tokens
 */
authRouter.get('/signer-status', async (req: Request, res: Response) => {
  const result = await testSignerCapability();
  res.json({
    status: result.available ? 'OPERATIONAL' : 'BLOCKED',
    projectId: firebaseConfig.projectId,
    signerAvailable: result.available,
    error: result.message || null,
    remediation: result.available
      ? null
      : {
          requiredRole: 'roles/iam.serviceAccountTokenCreator',
          apiRequired: 'iamcredentials.googleapis.com',
          instruction:
            'Assign Service Account Token Creator role to the Cloud Run runtime service account, or configure FIREBASE_SERVICE_ACCOUNT_KEY.',
        },
  });
});

/**
 * GET /api/auth/users-summary
 * Provides a minimal, sanitized DTO list of active users from database via Admin SDK.
 * Evaluates the absolute minimum fields required: { id, nip, fullName, role, avatarUrl, isActive }.
 * Distinguishes OPERATIONAL, EMPTY, and DEGRADED / PERMISSION_DENIED (R21-05).
 */
authRouter.get('/users-summary', async (req: Request, res: Response) => {
  if (!adminDb) {
    res.json({
      success: false,
      status: 'DEGRADED',
      users: [],
      error: 'Database backend tidak tersedia.',
    });
    return;
  }

  try {
    const snap = await adminDb.collection('users').get();
    if (snap.empty) {
      res.json({
        success: true,
        status: 'EMPTY',
        users: [],
        message: 'Belum ada pengguna terdaftar dalam sistem.',
      });
      return;
    }

    const users = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nip: data.nip || '',
          fullName: data.fullName || '',
          role: data.role || 'GURU',
          avatarUrl: data.avatarUrl || null,
          isActive: data.isActive === true,
        };
      })
      .filter((u) => u.isActive);

    if (users.length === 0) {
      res.json({
        success: true,
        status: 'EMPTY',
        users: [],
        message: 'Tidak ada pengguna aktif dalam sistem.',
      });
      return;
    }

    res.json({
      success: true,
      status: 'OPERATIONAL',
      users,
    });
  } catch (err: any) {
    const isPermError =
      err?.code === 7 ||
      err?.message?.includes('PERMISSION_DENIED') ||
      err?.message?.includes('Missing or insufficient permissions');

    res.status(isPermError ? 403 : 500).json({
      success: false,
      status: isPermError ? 'PERMISSION_DENIED' : 'DEGRADED',
      users: [],
      error: isPermError
        ? 'Izin akses database ditolak (PERMISSION_DENIED).'
        : 'Gagal memuat ringkasan pengguna.',
    });
  }
});

/**
 * GET /api/auth/public-config
 * Provides safe, public school branding for kiosk displays and login screens.
 * Excludes sensitive geofencing, radius, coordinates, and internal configurations.
 * Reads strictly via Admin SDK without exposing internal school_config document publicly.
 */
authRouter.get('/public-config', async (req: Request, res: Response) => {
  const DEFAULT_CONFIG = {
    schoolName: 'SMK dr. SOEBANDI',
    npsn: '20109988',
    address: 'Jl. Pendidikan No. 45, Kompleks Edukasi, Jakarta',
    phone: '081234567890',
    logoUrl: '',
    appName: 'PIKET GURU',
    appSubtitle: 'Jadwal & Buku Piket Digital Sekolah',
  };

  if (!adminDb) {
    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: 'DEFAULT_FALLBACK',
      status: 'DEGRADED',
    });
    return;
  }

  try {
    const docSnap = await adminDb.collection('settings').doc('school_config').get();
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
          appSubtitle: data.appSubtitle || DEFAULT_CONFIG.appSubtitle,
        },
        source: 'DATABASE',
        status: 'OPERATIONAL',
      });
      return;
    }

    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: 'DEFAULT_FALLBACK',
      status: 'SETUP',
    });
  } catch (err: any) {
    console.warn('[AUTH ROUTES] public-config read warning:', err?.message || err);
    res.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: 'DEFAULT_FALLBACK',
      status: 'DEGRADED',
      warning: 'Menggunakan konfigurasi bawaan karena kendala database: ' + (err?.message || 'Error'),
    });
  }
});

/**
 * POST /api/auth/login
 * Verifies NIP and PIN on server-side using OWASP adaptive scrypt and rate limiting.
 * Returns a cryptographically signed Firebase Custom Token for client signInWithCustomToken.
 */
authRouter.post('/login', AuthRateLimiter.loginMiddleware, async (req: Request, res: Response) => {
  const { nip, pin } = req.body || {};
  const ip = getClientIp(req);

  if (!nip || !pin) {
    res.status(400).json({
      success: false,
      error: 'NIP dan PIN wajib diisi.',
    });
    return;
  }

  // Strict 6-digit PIN format policy (REV-02 & REV-03)
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
    res.status(400).json({
      success: false,
      error: 'PIN harus berupa tepat 6 digit angka numerik.',
    });
    return;
  }

  if (isRequestAborted(req)) {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Sesi permintaan dibatalkan karena kehilangan lease atau pembatalan koneksi.',
        code: 'RATE_LIMIT_LEASE_LOST',
      });
    }
    return;
  }

  if (!adminDb) {
    res.status(503).json({
      success: false,
      error: 'Layanan database backend tidak tersedia.',
      code: 'DB_UNAVAILABLE',
    });
    return;
  }

  try {
    // 1. Find user by NIP strictly via Admin SDK (R21-01: zero fallback list)
    let userData: any = null;
    let userId: string = '';

    try {
      const snap = await adminDb.collection('users').where('nip', '==', nip.trim()).limit(1).get();
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        userData = userDoc.data() as any;
        userId = userDoc.id;
      }
    } catch (dbErr: any) {
      if (isResponseClosed(res)) {
        return;
      }
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: 'Sesi permintaan dibatalkan saat pemrosesan verifikasi.',
            code: 'RATE_LIMIT_LEASE_LOST',
          });
        }
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Gagal mencari data pengguna di database.',
        code: 'DB_ERROR',
      });
      return;
    }

    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Sesi permintaan dibatalkan saat pemrosesan verifikasi.',
          code: 'RATE_LIMIT_LEASE_LOST',
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
            error: 'Sesi permintaan dibatalkan setelah pembaruan batas gagal.',
            code: 'RATE_LIMIT_LEASE_LOST',
          });
        }
        return;
      }
      res.status(401).json({
        success: false,
        error: 'NIP atau PIN keamanan tidak sesuai.',
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds,
      });
      return;
    }

    if (userData.isActive !== true) {
      res.status(403).json({
        success: false,
        error: 'Akun Anda dinonaktifkan oleh administrator.',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    if (userData.requiresActivation === true) {
      res.status(403).json({
        success: false,
        error: 'Akun Anda memerlukan aktivasi PIN baru oleh Administrator sebelum dapat digunakan.',
        code: 'ACCOUNT_REQUIRES_ACTIVATION',
      });
      return;
    }

    // 2. Check private credential store strictly via adaptive scrypt (R21-01: zero plaintext / default PIN fallback)
    let isValid = false;
    try {
      isValid = await CredentialStore.verifyCredential(userId, pin.trim());
    } catch (credErr: any) {
      if (isResponseClosed(res)) {
        return;
      }
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) {
          res.status(503).json({
            success: false,
            error: 'Sesi permintaan dibatalkan saat verifikasi kredensial.',
            code: 'RATE_LIMIT_LEASE_LOST',
          });
        }
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Gagal memverifikasi kredensial database.',
        code: 'CREDENTIAL_VERIFY_ERROR',
      });
      return;
    }

    if (isRequestAborted(req)) {
      if (!isResponseClosed(res)) {
        res.status(503).json({
          success: false,
          error: 'Sesi permintaan dibatalkan setelah pemrosesan verifikasi.',
          code: 'RATE_LIMIT_LEASE_LOST',
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
            error: 'Sesi permintaan dibatalkan setelah pembaruan batas gagal.',
            code: 'RATE_LIMIT_LEASE_LOST',
          });
        }
        return;
      }
      res.status(401).json({
        success: false,
        error: 'NIP atau PIN keamanan tidak sesuai.',
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds,
      });
      return;
    }

    // 3. Reset rate limiter on success
    await AuthRateLimiter.recordSuccess(nip.trim(), ip);

    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Sesi permintaan dibatalkan setelah pembaruan batas laju.',
          code: 'RATE_LIMIT_LEASE_LOST',
        });
      }
      return;
    }

    // 4. Generate clean sanitized profile
    const safeUser = sanitizeUserProfile({ id: userId, ...userData });

    // 5. Mint Firebase Custom Token with role custom claims (R21-02: controlled failure on signer error)
    let customToken: string | null = null;
    try {
      const developerClaims = {
        role: safeUser.role,
        nip: safeUser.nip,
      };

      if (!isRequestAborted(req)) {
        customToken = await adminAuth.createCustomToken(userId, developerClaims);
      }
    } catch (signerErr: any) {
      if (isResponseClosed(res)) return;
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Layanan penandatangan token autentikasi (Firebase Admin SDK) tidak tersedia.',
          code: 'SIGNER_UNAVAILABLE',
        });
      }
      return;
    }

    if (isRequestAborted(req)) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Sesi permintaan dibatalkan sebelum tanggapan dikirimkan.',
          code: 'RATE_LIMIT_LEASE_LOST',
        });
      }
      return;
    }

    if (!customToken) {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Token autentikasi tidak berhasil dibuat.',
          code: 'TOKEN_MINT_FAILED',
        });
      }
      return;
    }

    res.json({
      success: true,
      user: safeUser,
      customToken,
    });
  } catch (err: any) {
    if (isResponseClosed(res)) {
      console.warn('[AUTH LOGIN] Catch error after response closed:', err?.message || err);
      return;
    }
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan sistem saat memproses autentikasi.',
    });
  }
});

async function getUserProfileRecord(userId: string): Promise<any | null> {
  if (!adminDb) {
    throw new Error('adminDb not initialized');
  }
  const snap = await adminDb.collection('users').doc(userId).get();
  if (snap.exists) return snap.data();
  return null;
}

async function revokeUserSessionInDb(userId: string, revokedAtSeconds: number): Promise<void> {
  if (!adminDb) {
    throw new Error('adminDb not initialized');
  }
  await adminDb.collection('users').doc(userId).update({
    sessionRevokedAtSeconds: revokedAtSeconds,
    pin: FieldValue.delete(),
    pinHash: FieldValue.delete(),
    pinSalt: FieldValue.delete(),
    requiresActivation: FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * POST /api/auth/verify-pin
 * Protected by requireAuth and rate limiting.
 * Re-authenticates sensitive operations against server-side adaptive scrypt hash.
 * Completely eliminates hardcoded bypasses and plaintext fallbacks.
 * Correctly records failures in AuthRateLimiter on incorrect PIN.
 */
authRouter.post(
  '/verify-pin',
  requireAuth,
  AuthRateLimiter.createPinActionLimiter('verifyPin', 'userId'),
  async (req: Request, res: Response) => {
    const { userId, pin } = req.body || {};
    const caller = (req as any).user;
    const ip = getClientIp(req);

    if (!userId || !pin) {
      res.status(400).json({ success: false, error: 'User ID dan PIN wajib disertakan.' });
      return;
    }

    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      res.status(400).json({ success: false, error: 'PIN harus tepat 6 digit angka numerik.' });
      return;
    }

    // Authorization: caller can only verify PIN for themselves, unless caller is an active ADMIN
    if (caller.uid !== userId && caller.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Akses ditolak: Anda hanya dapat memverifikasi PIN akun Anda sendiri.',
        code: 'FORBIDDEN_CROSS_USER',
      });
      return;
    }

    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const userData = await getUserProfileRecord(userId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat mengambil profil.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      if (!userData) {
        res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
        return;
      }

      // Check private store strictly via adaptive scrypt
      const isMatch = await CredentialStore.verifyCredential(userId, pin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat memverifikasi PIN.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      if (!isMatch) {
        const failInfo = await AuthRateLimiter.recordFailureWithAction(userId, `verifyPin:${userId}`, ip);
        if (isRequestAborted(req) || isResponseClosed(res)) {
          if (!isResponseClosed(res)) {
            res.status(503).json({
              success: false,
              error: 'Sesi permintaan dibatalkan setelah pembaruan batas gagal.',
              code: 'RATE_LIMIT_LEASE_LOST',
            });
          }
          return;
        }
        res.status(401).json({
          success: false,
          error: 'PIN Keamanan tidak sesuai. Akses ditolak.',
          remainingAttempts: failInfo.remainingAttempts,
          isLocked: failInfo.locked,
          remainingSeconds: failInfo.lockoutSeconds,
        });
        return;
      }

      // Record success to reset attempts
      await AuthRateLimiter.recordActionSuccess('verifyPin', userId, ip);

      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan setelah pembaruan status.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      res.json({ success: true, verified: true });
    } catch (err: any) {
      if (isResponseClosed(res)) return;
      console.error('Verify PIN error:', err);
      res.status(500).json({ success: false, error: err.message || 'Gagal memverifikasi PIN.' });
    }
  }
);

async function revokeRefreshTokensWithRetry(userId: string): Promise<{
  status: 'REVOKED' | 'PENDING_RETRY';
  attempts: number;
  error?: string;
}> {
  if (!adminAuth) {
    return { status: 'PENDING_RETRY', attempts: 0, error: 'adminAuth service unavailable' };
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await adminAuth.revokeRefreshTokens(userId);
      return { status: 'REVOKED', attempts: attempt };
    } catch (err: any) {
      if (attempt === 3) {
        console.warn(`[AUTH] revokeRefreshTokens failed after 3 attempts for ${userId}:`, err?.message || err);
        return { status: 'PENDING_RETRY', attempts: attempt, error: err?.message || 'Service unavailable' };
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  return { status: 'PENDING_RETRY', attempts: 3, error: 'Max retries exceeded' };
}

export async function executePinChangeTransaction(
  db: any,
  userId: string,
  userNip: string,
  newHash: string,
  nowSeconds: number,
  req?: Request
): Promise<{ effectiveRevocation: number }> {
  let effectiveRevocation = nowSeconds;
  await db.runTransaction(async (transaction: any) => {
    if (req && isRequestAborted(req)) {
      throw new Error('TRANSACTION_CANCELLED_REQUEST_ABORTED');
    }

    const userRef = db.collection('users').doc(userId);
    const credRef = db.collection('user_credentials').doc(userId);

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('User document not found in transaction');

    if (req && isRequestAborted(req)) {
      throw new Error('TRANSACTION_CANCELLED_REQUEST_ABORTED');
    }

    const existingRevocation = userSnap.data()?.sessionRevokedAtSeconds || 0;
    effectiveRevocation = Math.max(existingRevocation, nowSeconds);

    transaction.set(
      credRef,
      {
        userId,
        nip: userNip,
        scryptHash: newHash,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    transaction.update(userRef, {
      sessionRevokedAtSeconds: effectiveRevocation,
      pin: FieldValue.delete(),
      pinHash: FieldValue.delete(),
      pinSalt: FieldValue.delete(),
      requiresActivation: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  });
  return { effectiveRevocation };
}

/**
 * POST /api/auth/change-pin
 * Protected by requireAuth and rate limiting.
 * Caller can ONLY change PIN for their own account with proof of old PIN.
 * Uses atomic transaction for credential store + user profile session revocation.
 */
authRouter.post(
  '/change-pin',
  requireAuth,
  AuthRateLimiter.createPinActionLimiter('changePin', 'userId'),
  async (req: Request, res: Response) => {
    const { userId, oldPin, newPin } = req.body || {};
    const caller = (req as any).user;
    const ip = getClientIp(req);

    if (!userId || !oldPin || !newPin) {
      res.status(400).json({ success: false, error: 'Semua field wajib diisi.' });
      return;
    }

    // Caller can ONLY change PIN for their own account
    if (caller.uid !== userId) {
      res.status(403).json({
        success: false,
        error: 'Akses ditolak: Anda hanya dapat mengubah PIN untuk akun Anda sendiri.',
        code: 'FORBIDDEN_CROSS_USER',
      });
      return;
    }

    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ success: false, error: 'PIN baru harus tepat 6 digit angka numerik.' });
      return;
    }

    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const userData = await getUserProfileRecord(userId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat mengambil profil.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      if (!userData) {
        res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
        return;
      }

      // Verify old PIN strictly against private credential store
      const isOldValid = await CredentialStore.verifyCredential(userId, oldPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat verifikasi PIN lama.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      if (!isOldValid) {
        const failInfo = await AuthRateLimiter.recordFailureWithAction(userId, `changePin:${userId}`, ip);
        if (isRequestAborted(req) || isResponseClosed(res)) {
          if (!isResponseClosed(res)) {
            res.status(503).json({
              success: false,
              error: 'Sesi permintaan dibatalkan setelah pembaruan batas gagal.',
              code: 'RATE_LIMIT_LEASE_LOST',
            });
          }
          return;
        }
        res.status(401).json({
          success: false,
          error: 'PIN lama yang Anda masukkan salah.',
          remainingAttempts: failInfo.remainingAttempts,
          isLocked: failInfo.locked,
          remainingSeconds: failInfo.lockoutSeconds,
        });
        return;
      }

      // Compute scrypt hash BEFORE transaction
      const { hashPinAdaptive } = await import('../crypto/adaptiveHash');
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan sebelum hashing.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const newHash = await hashPinAdaptive(newPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan setelah hashing.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!adminDb) throw new Error('Database service unavailable');

      // Atomic commit: Credential write + Monotonic session revocation marker in single application transaction
      await executePinChangeTransaction(adminDb, userId, userData.nip, newHash, nowSeconds, req);

      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan setelah transaksi.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      // Reset limiter on correct old PIN & success
      await AuthRateLimiter.recordActionSuccess('changePin', userId, ip);

      // Revoke Firebase refresh tokens with retry & transparent reporting (R6-03)
      const refreshRevocation = await revokeRefreshTokensWithRetry(userId);

      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan sebelum balasan.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      res.json({
        success: true,
        message: 'PIN berhasil diubah.',
        refreshRevocation,
      });
    } catch (err: any) {
      if (isResponseClosed(res)) return;
      if (err?.message === 'TRANSACTION_CANCELLED_REQUEST_ABORTED') {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat transaksi.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      console.error('Change PIN error:', err);
      res.status(500).json({ success: false, error: err.message || 'Gagal mengubah PIN.' });
    }
  }
);

/**
 * POST /api/auth/reset-pin
 * Admin-initiated PIN reset.
 * STRICTLY PROTECTED by requireAuth and requireAdmin (NEVER trust adminUserId in body).
 * Uses atomic transaction for credential store + user profile session revocation.
 */
authRouter.post(
  '/reset-pin',
  requireAuth,
  requireAdmin,
  AuthRateLimiter.createPinActionLimiter('resetPin', 'targetUserId'),
  async (req: Request, res: Response) => {
    const { targetUserId, newPin } = req.body || {};
    const caller = (req as any).user;
    const ip = getClientIp(req);

    if (!targetUserId || !newPin) {
      res.status(400).json({ success: false, error: 'Target User ID dan PIN baru wajib disertakan.' });
      return;
    }

    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ success: false, error: 'PIN baru harus tepat 6 digit angka numerik.' });
      return;
    }

    try {
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const targetData = await getUserProfileRecord(targetUserId);
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat mengambil profil target.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      if (!targetData) {
        res.status(404).json({ success: false, error: 'Target pengguna tidak ditemukan.' });
        return;
      }

      // Compute scrypt hash BEFORE transaction
      const { hashPinAdaptive } = await import('../crypto/adaptiveHash');
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan sebelum hashing.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const newHash = await hashPinAdaptive(newPin.trim());
      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan setelah hashing.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!adminDb) throw new Error('Database service unavailable');

      // Atomic commit: Credential write + Monotonic session revocation marker in single application transaction
      await executePinChangeTransaction(adminDb, targetUserId, targetData.nip, newHash, nowSeconds, req);

      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan setelah transaksi.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      // Revoke refresh tokens with retry & transparent reporting (R6-03)
      const refreshRevocation = await revokeRefreshTokensWithRetry(targetUserId);

      // Clear any rate limiter lockout for target user
      await AuthRateLimiter.recordLoginSuccess(targetData.nip, ip);
      await AuthRateLimiter.recordActionSuccess('verifyPin', targetUserId, ip);
      await AuthRateLimiter.recordActionSuccess('changePin', targetUserId, ip);
      await AuthRateLimiter.recordActionSuccess('resetPin', targetUserId, ip);

      if (isRequestAborted(req)) {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan sebelum balasan.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }

      console.log(`[AUDIT] Admin ${caller.uid} successfully reset PIN for user ${targetUserId}`);
      res.json({
        success: true,
        message: 'PIN pengguna berhasil direset.',
        refreshRevocation,
      });
    } catch (err: any) {
      if (isResponseClosed(res)) return;
      if (err?.message === 'TRANSACTION_CANCELLED_REQUEST_ABORTED') {
        if (!isResponseClosed(res)) res.status(503).json({ success: false, error: 'Sesi permintaan dibatalkan saat transaksi.', code: 'RATE_LIMIT_LEASE_LOST' });
        return;
      }
      console.error('Reset PIN error:', err);
      res.status(500).json({ success: false, error: err.message || 'Gagal mereset PIN pengguna.' });
    }
  }
);
