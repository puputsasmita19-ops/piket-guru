import { Router, Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb, testSignerCapability } from '../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { CredentialStore } from '../services/credentialStore.js';
import { AuthRateLimiter, getClientIp } from '../middleware/rateLimiter.js';
import { UserProfile } from '../../types/index.js';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

export const authRouter = Router();

/**
 * Normalizes a loginId / employee code consistently:
 * Trims whitespace, standardizes to uppercase.
 */
export function normalizeLoginId(raw: string): string {
  return (raw || '').trim().toUpperCase();
}

/**
 * Validates loginId format (3-50 chars, alphanumeric, hyphens, underscores, dots)
 */
export function validateLoginId(loginId: string): { valid: boolean; error?: string } {
  if (!loginId || typeof loginId !== 'string') {
    return { valid: false, error: 'ID Login / Kode Pegawai wajib diisi.' };
  }
  const normalized = normalizeLoginId(loginId);
  if (normalized.length < 3 || normalized.length > 50) {
    return { valid: false, error: 'ID Login / Kode Pegawai harus berukuran antara 3 sampai 50 karakter.' };
  }
  if (!/^[A-Z0-9_.-]+$/.test(normalized)) {
    return { valid: false, error: 'ID Login / Kode Pegawai hanya boleh memuat huruf, angka, tanda minus (-), underscore (_), atau titik (.).' };
  }
  return { valid: true };
}

/**
 * Sanitizes a UserProfile object to ensure NO credential fields are ever returned to the client
 */
export function sanitizeUserProfile(u: any): UserProfile {
  return {
    id: u.id,
    loginId: u.loginId ? normalizeLoginId(u.loginId) : '',
    nip: u.nip || '',
    nuptk: u.nuptk || '',
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
          loginId: data.loginId ? normalizeLoginId(data.loginId) : '',
          nip: data.nip || '',
          nuptk: data.nuptk || '',
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
    email: 'info@smkdrsoebandi.sch.id',
    website: 'smkdrsoebandi.sch.id',
    logoUrl: '',
    appName: 'PIKET GURU',
    appSubtitle: 'Jadwal & Buku Piket Digital Sekolah',
    loginSupportContact: {
      enabled: true,
      adminName: 'Admin Piket Sekolah',
      buttonLabel: 'Hubungi Admin',
      contactType: 'whatsapp',
      target: '081234567890',
      initialMessage: 'Halo Admin, saya membutuhkan bantuan terkait akses login akun Piket Guru.',
    },
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
      const contactData = data.loginSupportContact || {};
      const sanitizedContact = {
        enabled: contactData.enabled !== false,
        adminName: String(contactData.adminName || DEFAULT_CONFIG.loginSupportContact.adminName).slice(0, 100),
        buttonLabel: String(contactData.buttonLabel || DEFAULT_CONFIG.loginSupportContact.buttonLabel).slice(0, 50),
        contactType: ['whatsapp', 'phone', 'email'].includes(contactData.contactType)
          ? contactData.contactType
          : DEFAULT_CONFIG.loginSupportContact.contactType,
        target: String(contactData.target ?? DEFAULT_CONFIG.loginSupportContact.target).slice(0, 100),
        initialMessage: String(contactData.initialMessage ?? DEFAULT_CONFIG.loginSupportContact.initialMessage).slice(0, 500),
      };

      res.json({
        success: true,
        config: {
          schoolName: data.schoolName || DEFAULT_CONFIG.schoolName,
          npsn: data.npsn || DEFAULT_CONFIG.npsn,
          address: data.address || DEFAULT_CONFIG.address,
          phone: data.phone || DEFAULT_CONFIG.phone,
          email: data.email || DEFAULT_CONFIG.email,
          website: data.website || DEFAULT_CONFIG.website,
          logoUrl: data.logoUrl || DEFAULT_CONFIG.logoUrl,
          appName: data.appName || DEFAULT_CONFIG.appName,
          appSubtitle: data.appSubtitle || DEFAULT_CONFIG.appSubtitle,
          loginSupportContact: sanitizedContact,
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
 * Verifies ID Login / NIP and PIN on server-side using OWASP adaptive scrypt and rate limiting.
 * Supports loginId and legacy NIP. Rejects ambiguous identities clearly.
 * Returns a cryptographically signed Firebase Custom Token for client signInWithCustomToken.
 */
authRouter.post('/login', AuthRateLimiter.loginMiddleware, async (req: Request, res: Response) => {
  const rawIdentifier = (req.body?.identifier || req.body?.loginId || req.body?.nip || '').trim();
  const pin = (req.body?.pin || '').trim();
  const ip = getClientIp(req);

  if (!rawIdentifier || !pin) {
    res.status(400).json({
      success: false,
      error: 'ID Login / NIP dan PIN wajib diisi.',
    });
    return;
  }

  // Strict 6-digit PIN format policy (REV-02 & REV-03)
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
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
    // 1. Find user by loginId, legacy NIP, or document ID
    const normalized = normalizeLoginId(rawIdentifier);
    let matchedDocs = new Map<string, FirebaseFirestore.DocumentSnapshot>();

    try {
      const [byLoginId, byNip, byId] = await Promise.all([
        adminDb.collection('users').where('loginId', '==', normalized).get(),
        adminDb.collection('users').where('nip', '==', rawIdentifier).get(),
        adminDb.collection('users').doc(rawIdentifier).get().catch(() => null),
      ]);

      byLoginId.docs.forEach((d) => matchedDocs.set(d.id, d));
      byNip.docs.forEach((d) => matchedDocs.set(d.id, d));
      if (byId && byId.exists) {
        matchedDocs.set(byId.id, byId);
      }
    } catch (dbErr: any) {
      if (isResponseClosed(res)) return;
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

    // Handle ambiguous matches: reject clearly, NEVER pick the first account (Requirement 4)
    if (matchedDocs.size > 1) {
      await AuthRateLimiter.recordFailure(rawIdentifier, ip);
      res.status(409).json({
        success: false,
        error: 'Identitas login ambigu: ditemukan lebih dari satu akun yang cocok. Harap gunakan ID Login unik Anda.',
        code: 'AMBIGUOUS_LOGIN_IDENTITY',
      });
      return;
    }

    // Handle no matching user
    if (matchedDocs.size === 0) {
      const failInfo = await AuthRateLimiter.recordFailure(rawIdentifier, ip);
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
        error: 'ID Login/NIP atau PIN keamanan tidak sesuai.',
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds,
      });
      return;
    }

    const userDoc = Array.from(matchedDocs.values())[0];
    const userId = userDoc.id;
    const userData = userDoc.data() as any;

    // Check account-level lockout: all aliases share this unified account check (Requirement 5)
    const accountLock = await AuthRateLimiter.isLocked(userId);
    if (accountLock.locked) {
      res.status(429).json({
        success: false,
        error: `Akun ini terkunci sementara karena 5 kali percobaan PIN salah. Silakan coba lagi dalam ${accountLock.remainingSeconds} detik.`,
        code: 'ACCOUNT_LOCKED',
        remainingSeconds: accountLock.remainingSeconds,
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

    // 2. Check private credential store strictly via adaptive scrypt
    let isValid = false;
    try {
      isValid = await CredentialStore.verifyCredential(userId, pin);
    } catch (credErr: any) {
      if (isResponseClosed(res)) return;
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
      // Record failure for the canonical userId AND rawIdentifier so all aliases accumulate (Requirement 5)
      const failInfo = await AuthRateLimiter.recordFailure(userId, ip);
      if (rawIdentifier !== userId) {
        await AuthRateLimiter.recordFailure(rawIdentifier, ip);
      }
      if (userData.loginId && userData.loginId !== rawIdentifier && userData.loginId !== userId) {
        await AuthRateLimiter.recordFailure(userData.loginId, ip);
      }
      if (userData.nip && userData.nip !== rawIdentifier && userData.nip !== userId) {
        await AuthRateLimiter.recordFailure(userData.nip, ip);
      }

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
        error: 'ID Login/NIP atau PIN keamanan tidak sesuai.',
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.locked,
        remainingSeconds: failInfo.lockoutSeconds,
      });
      return;
    }

    // 3. Reset rate limiter on success for canonical userId and all known aliases
    await AuthRateLimiter.recordLoginSuccess(userId, ip);
    if (rawIdentifier !== userId) {
      await AuthRateLimiter.recordLoginSuccess(rawIdentifier, ip);
    }
    if (userData.loginId) {
      await AuthRateLimiter.recordLoginSuccess(userData.loginId, ip);
    }
    if (userData.nip) {
      await AuthRateLimiter.recordLoginSuccess(userData.nip, ip);
    }

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

    // 5. Mint Firebase Custom Token with role custom claims
    let customToken: string | null = null;
    try {
      const developerClaims = {
        role: safeUser.role,
        nip: safeUser.nip || '',
        loginId: safeUser.loginId || '',
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

/**
 * POST /api/auth/create-user
 * Atomic user profile creation with backend-enforced unique loginId (Requirement 1, CR-IDENTITAS-LOGIN-002).
 * Enforces uniqueness atomically via a dedicated login_ids reservation document inside a Firestore transaction.
 */
authRouter.post('/create-user', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { loginId, fullName, role, nip, nuptk, email, phone, initialPin, permissions, isActive } = req.body || {};

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    res.status(400).json({ success: false, error: 'Nama Lengkap wajib diisi.' });
    return;
  }

  const loginIdValidation = validateLoginId(loginId);
  if (!loginIdValidation.valid) {
    res.status(400).json({ success: false, error: loginIdValidation.error });
    return;
  }
  const normalizedLoginId = normalizeLoginId(loginId);

  const validRoles = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ success: false, error: `Peran (role) '${role}' tidak valid.` });
    return;
  }

  if (initialPin && (!/^\d{6}$/.test(String(initialPin).trim()))) {
    res.status(400).json({ success: false, error: 'PIN Awal harus berupa tepat 6 digit angka numerik.' });
    return;
  }

  if (!adminDb) {
    res.status(503).json({ success: false, error: 'Database backend belum tersedia.', code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const userId = (req.body?.id && typeof req.body.id === 'string' && req.body.id.trim())
      ? req.body.id.trim()
      : `usr-${role.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const hasInitialPin = Boolean(initialPin && /^\d{6}$/.test(String(initialPin).trim()));

    // Atomic transaction for reservation & uniqueness enforcement
    await adminDb.runTransaction(async (transaction) => {
      const reservationRef = adminDb.collection('login_ids').doc(normalizedLoginId);
      const reservationSnap = await transaction.get(reservationRef);
      if (reservationSnap.exists) {
        const resData = reservationSnap.data();
        if (resData?.userId !== userId) {
          throw new Error(`DUPLICATE_LOGIN_ID: ID Login '${normalizedLoginId}' sudah digunakan oleh akun lain.`);
        }
      }

      // Check if user doc already exists with this userId
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists) {
        throw new Error(`USER_EXISTS: Akun dengan ID '${userId}' sudah ada.`);
      }

      let effectivePermissions = Array.isArray(permissions) && permissions.length > 0 ? [...permissions] : [];
      if (effectivePermissions.length === 0) {
        if (role === 'ADMIN') effectivePermissions = ['*'];
        else if (role === 'GURU') effectivePermissions = ['dashboard.view', 'schedule.view', 'attendance.view', 'attendance.create', 'dutybook.view', 'dutybook.create', 'dutybook.update', 'incident.view', 'incident.create'];
        else if (role === 'KEPALA_SEKOLAH') effectivePermissions = ['dashboard.view', 'schedule.view', 'attendance.view', 'dutybook.view', 'dutybook.verify', 'dutybook.unlock', 'reports.view', 'reports.export'];
        else if (role === 'TENAGA_KEPENDIDIKAN') effectivePermissions = ['dashboard.view', 'schedule.view', 'attendance.view', 'attendance.create', 'dutybook.view', 'dutybook.create', 'incident.view', 'incident.create'];
        else if (role === 'SATPAM') effectivePermissions = ['dashboard.view', 'schedule.view', 'attendance.view', 'attendance.create', 'incident.view', 'incident.create'];
      }
      // Security rule: GURU must never be granted wildcard '*'
      if (role === 'GURU') {
        effectivePermissions = effectivePermissions.filter((p: string) => p !== '*');
      }

      const now = new Date().toISOString();
      const userRecord: any = {
        id: userId,
        loginId: normalizedLoginId,
        nip: (nip || '').trim(),
        nuptk: (nuptk || '').trim(),
        fullName: fullName.trim(),
        role,
        email: (email || '').trim(),
        phone: (phone || '').trim(),
        isActive: isActive !== false,
        permissions: effectivePermissions,
        requiresActivation: !hasInitialPin,
        sessionRevokedAtSeconds: Math.floor(Date.now() / 1000),
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      };

      // Set user profile
      transaction.set(userRef, userRecord);

      // Set atomic loginId reservation
      transaction.set(reservationRef, {
        loginId: normalizedLoginId,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Save initial credential if provided
    if (hasInitialPin) {
      await CredentialStore.setCredential(userId, (nip || '').trim(), String(initialPin).trim(), normalizedLoginId);
    }

    const createdSnap = await adminDb.collection('users').doc(userId).get();
    const createdData = createdSnap.data() || {};
    const safeUser = sanitizeUserProfile({ id: userId, ...createdData });

    res.json({
      success: true,
      user: safeUser,
      message: 'Pengguna berhasil didaftarkan.',
    });
  } catch (err: any) {
    if (err?.message?.includes('DUPLICATE_LOGIN_ID')) {
      res.status(409).json({
        success: false,
        error: err.message.replace('DUPLICATE_LOGIN_ID: ', ''),
        code: 'DUPLICATE_LOGIN_ID',
      });
      return;
    }
    console.error('[AUTH_ROUTES] Create user error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan sistem saat membuat pengguna.',
    });
  }
});

/**
 * POST /api/auth/update-user
 * Atomic user profile update with loginId uniqueness verification.
 */
authRouter.post('/update-user', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { userId, updates } = req.body || {};
  if (!userId || !updates || typeof updates !== 'object') {
    res.status(400).json({ success: false, error: 'User ID dan data pembaruan wajib disertakan.' });
    return;
  }

  if (!adminDb) {
    res.status(503).json({ success: false, error: 'Database backend belum tersedia.', code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const userRef = adminDb.collection('users').doc(userId);
    const existingSnap = await userRef.get();
    if (!existingSnap.exists) {
      res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const existingData = existingSnap.data() || {};

    let newNormalizedLoginId: string | null = null;
    if (updates.loginId !== undefined && updates.loginId !== null && updates.loginId !== '') {
      const validation = validateLoginId(updates.loginId);
      if (!validation.valid) {
        res.status(400).json({ success: false, error: validation.error });
        return;
      }
      newNormalizedLoginId = normalizeLoginId(updates.loginId);
    }

    const oldLoginId = existingData.loginId ? normalizeLoginId(existingData.loginId) : null;
    const loginIdChanged = newNormalizedLoginId !== null && newNormalizedLoginId !== oldLoginId;

    await adminDb.runTransaction(async (transaction) => {
      if (loginIdChanged && newNormalizedLoginId) {
        const newResRef = adminDb.collection('login_ids').doc(newNormalizedLoginId);
        const newResSnap = await transaction.get(newResRef);
        if (newResSnap.exists && newResSnap.data()?.userId !== userId) {
          throw new Error(`DUPLICATE_LOGIN_ID: ID Login '${newNormalizedLoginId}' sudah digunakan oleh akun lain.`);
        }

        transaction.set(newResRef, {
          loginId: newNormalizedLoginId,
          userId,
          updatedAt: new Date().toISOString(),
        });

        if (oldLoginId) {
          const oldResRef = adminDb.collection('login_ids').doc(oldLoginId);
          transaction.delete(oldResRef);
        }
      }

      const payloadToUpdate: any = {
        updatedAt: new Date().toISOString(),
      };
      if (newNormalizedLoginId !== null) payloadToUpdate.loginId = newNormalizedLoginId;
      if (updates.nip !== undefined) payloadToUpdate.nip = (updates.nip || '').trim();
      if (updates.nuptk !== undefined) payloadToUpdate.nuptk = (updates.nuptk || '').trim();
      if (updates.fullName !== undefined) payloadToUpdate.fullName = updates.fullName.trim();
      if (updates.role !== undefined) payloadToUpdate.role = updates.role;
      if (updates.email !== undefined) payloadToUpdate.email = (updates.email || '').trim();
      if (updates.phone !== undefined) payloadToUpdate.phone = (updates.phone || '').trim();
      if (updates.avatarUrl !== undefined) payloadToUpdate.avatarUrl = updates.avatarUrl;
      if (updates.isActive !== undefined) payloadToUpdate.isActive = updates.isActive;
      if (updates.permissions !== undefined) payloadToUpdate.permissions = updates.permissions;
      if (updates.sessionRevokedAtSeconds !== undefined) payloadToUpdate.sessionRevokedAtSeconds = updates.sessionRevokedAtSeconds;
      if (updates.requiresActivation !== undefined) payloadToUpdate.requiresActivation = updates.requiresActivation;

      transaction.update(userRef, payloadToUpdate);
    });

    const updatedSnap = await userRef.get();
    res.json({
      success: true,
      user: sanitizeUserProfile({ id: userId, ...updatedSnap.data() }),
      message: 'Data pengguna berhasil diperbarui.',
    });
  } catch (err: any) {
    if (err?.message?.includes('DUPLICATE_LOGIN_ID')) {
      res.status(409).json({
        success: false,
        error: err.message.replace('DUPLICATE_LOGIN_ID: ', ''),
        code: 'DUPLICATE_LOGIN_ID',
      });
      return;
    }
    console.error('[AUTH_ROUTES] Update user error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Gagal memperbarui pengguna.' });
  }
});

/**
 * POST /api/auth/delete-user
 * Atomic user profile, credential, and loginId reservation deletion (CR-LIFECYCLE-LOGINID).
 * Reads all required documents inside transaction before writing.
 * Strictly preserves loginId reservation if owned by another account.
 * Handles Firebase Auth revocation with explicit error reporting outside transaction.
 */
authRouter.post('/delete-user', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { userId } = req.body || {};
  const caller = (req as any).user;

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    res.status(400).json({ success: false, error: 'User ID wajib disertakan.' });
    return;
  }
  const targetUserId = userId.trim();

  // Self-deletion protection
  if (caller.uid === targetUserId) {
    res.status(400).json({
      success: false,
      error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.',
      code: 'CANNOT_DELETE_SELF',
    });
    return;
  }

  if (!adminDb) {
    res.status(503).json({ success: false, error: 'Database backend belum tersedia.', code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const userRef = adminDb.collection('users').doc(targetUserId);
    const existingSnap = await userRef.get();

    if (!existingSnap.exists) {
      // Check if there are orphan credentials or reservations for this ID
      res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan dalam sistem.', code: 'USER_NOT_FOUND' });
      return;
    }

    const existingData = existingSnap.data() || {};

    // Administrator protection: cannot delete last active administrator
    if (existingData.role === 'ADMIN') {
      const adminQuery = await adminDb
        .collection('users')
        .where('role', '==', 'ADMIN')
        .where('isActive', '==', true)
        .get();
      const otherActiveAdmins = adminQuery.docs.filter((d) => d.id !== targetUserId);
      if (otherActiveAdmins.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Tidak dapat menghapus satu-satunya Administrator aktif di sistem.',
          code: 'LAST_ADMIN_PROTECTED',
        });
        return;
      }
    }

    const targetLoginId = existingData.loginId ? normalizeLoginId(existingData.loginId) : null;
    let reservationDeleted = false;

    // 1. Transactional Firestore Cleanup: Users, Credentials, & LoginId Reservation
    await adminDb.runTransaction(async (transaction) => {
      // READS MUST OCCUR FIRST
      const txUserSnap = await transaction.get(userRef);
      const credRef = adminDb.collection('user_credentials').doc(targetUserId);
      const credSnap = await transaction.get(credRef);

      let resRef: FirebaseFirestore.DocumentReference | null = null;
      let resSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (targetLoginId) {
        resRef = adminDb.collection('login_ids').doc(targetLoginId);
        resSnap = await transaction.get(resRef);
      }

      // WRITES OCCUR AFTER ALL READS
      if (txUserSnap.exists) {
        transaction.delete(userRef);
      }
      if (credSnap.exists) {
        transaction.delete(credRef);
      }
      if (resRef && resSnap && resSnap.exists) {
        const resData = resSnap.data();
        // Strict ownership check: only delete reservation if it belongs to targetUserId
        if (resData?.userId === targetUserId) {
          transaction.delete(resRef);
          reservationDeleted = true;
        } else {
          console.warn(`[AUTH_ROUTES] Reservation for loginId '${targetLoginId}' belongs to userId '${resData?.userId}', not deleting.`);
        }
      }
    });

    // 2. Out-of-transaction Firebase Auth session revocation & user deletion
    let authCleanupStatus: 'COMPLETED' | 'NOT_APPLICABLE' | 'FAILED' = 'COMPLETED';
    let authCleanupError: string | undefined;
    if (adminAuth) {
      try {
        await adminAuth.revokeRefreshTokens(targetUserId).catch(() => {});
        await adminAuth.deleteUser(targetUserId);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/user-not-found') {
          authCleanupStatus = 'NOT_APPLICABLE';
        } else {
          console.warn(`[AUTH_ROUTES] Firebase Auth deletion warning for ${targetUserId}:`, authErr);
          authCleanupStatus = 'FAILED';
          authCleanupError = authErr?.message || 'Gagal menghapus akun Firebase Auth.';
        }
      }
    }

    // 3. Log Audit
    const callerData = (req as any).callerData || {};
    await adminDb.collection('audit_logs').add({
      userId: caller.uid,
      userName: callerData.fullName || caller.email || 'Admin',
      role: 'ADMIN',
      action: 'DELETE',
      module: 'USERS',
      recordId: targetUserId,
      details: `Menghapus akun pengguna ${existingData.fullName || targetUserId} (ID Login: ${targetLoginId || '-'}) beserta kredensial dan reservasi ID.`,
      timestamp: new Date().toISOString(),
      authCleanupStatus,
      reservationDeleted,
    });

    res.json({
      success: true,
      partial: authCleanupStatus === 'FAILED',
      authCleanup: {
        status: authCleanupStatus,
        error: authCleanupError,
        retryable: authCleanupStatus === 'FAILED',
      },
      reservationDeleted,
      message: authCleanupStatus === 'FAILED'
        ? 'Profil pengguna, kredensial, dan reservasi ID berhasil dihapus dari database, namun pencabutan sesi Firebase Auth mengalami kegagalan/tertunda.'
        : `Akun pengguna ${existingData.fullName || targetUserId} beserta kredensial dan reservasi ID berhasil dihapus sepenuhnya.`,
    });
  } catch (err: any) {
    console.error('[AUTH_ROUTES] Delete user error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Gagal menghapus pengguna dari sistem.',
    });
  }
});

/**
 * GET /api/auth/orphan-reservations
 * Scans login_ids collection to find orphan reservations without modifying data (dry-run inspection).
 */
authRouter.get('/orphan-reservations', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  if (!adminDb) {
    res.status(503).json({ success: false, error: 'Database backend belum tersedia.', code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const resSnaps = await adminDb.collection('login_ids').get();
    const orphans: Array<{
      loginId: string;
      userId: string;
      createdAt?: string;
      reason: string;
    }> = [];

    for (const doc of resSnaps.docs) {
      const data = doc.data() || {};
      const resUserId = data.userId;
      const resLoginId = doc.id;

      if (!resUserId) {
        orphans.push({
          loginId: resLoginId,
          userId: '',
          createdAt: data.createdAt,
          reason: 'Reservasi tidak memiliki userId yang terasosiasi.',
        });
        continue;
      }

      const userSnap = await adminDb.collection('users').doc(resUserId).get();
      if (!userSnap.exists) {
        // Double-check if any other user uses this loginId
        const usersWithSameLoginId = await adminDb
          .collection('users')
          .where('loginId', '==', resLoginId)
          .get();

        if (usersWithSameLoginId.empty) {
          orphans.push({
            loginId: resLoginId,
            userId: resUserId,
            createdAt: data.createdAt,
            reason: `Profil akun pemilik (ID: ${resUserId}) sudah tidak ada di database.`,
          });
        }
      }
    }

    res.json({
      success: true,
      count: orphans.length,
      orphans,
      message: orphans.length === 0
        ? 'Tidak ditemukan reservasi ID Login yatim.'
        : `Ditemukan ${orphans.length} reservasi ID Login yatim yang dapat dibersihkan.`,
    });
  } catch (err: any) {
    console.error('[AUTH_ROUTES] Check orphan reservations error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Gagal memeriksa reservasi yatim.',
    });
  }
});

/**
 * POST /api/auth/clean-orphan-reservation
 * Atomically releases an orphan loginId reservation if owner user document does not exist.
 */
authRouter.post('/clean-orphan-reservation', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { loginId } = req.body || {};
  const caller = (req as any).user;

  if (!loginId || typeof loginId !== 'string' || !loginId.trim()) {
    res.status(400).json({ success: false, error: 'ID Login wajib disertakan.' });
    return;
  }
  const normLoginId = normalizeLoginId(loginId);

  if (!adminDb) {
    res.status(503).json({ success: false, error: 'Database backend belum tersedia.', code: 'DB_UNAVAILABLE' });
    return;
  }

  try {
    const resRef = adminDb.collection('login_ids').doc(normLoginId);

    await adminDb.runTransaction(async (transaction) => {
      const resSnap = await transaction.get(resRef);
      if (!resSnap.exists) {
        return; // Already cleaned
      }

      const resData = resSnap.data() || {};
      const resUserId = resData.userId;

      if (resUserId) {
        const userRef = adminDb.collection('users').doc(resUserId);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          throw new Error(`ACTIVE_USER_EXISTS: Tidak dapat melepas reservasi '${normLoginId}' karena akun pemilik '${userSnap.data()?.fullName || resUserId}' masih aktif.`);
        }
      }

      // Safe to delete
      transaction.delete(resRef);
    });

    const callerData = (req as any).callerData || {};
    await adminDb.collection('audit_logs').add({
      userId: caller.uid,
      userName: callerData.fullName || caller.email || 'Admin',
      role: 'ADMIN',
      action: 'DELETE',
      module: 'USERS',
      recordId: normLoginId,
      details: `Membersihkan reservasi ID Login yatim: ${normLoginId}`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      loginId: normLoginId,
      message: `Reservasi ID Login '${normLoginId}' berhasil dilepaskan dan dapat digunakan kembali.`,
    });
  } catch (err: any) {
    if (err?.message?.includes('ACTIVE_USER_EXISTS')) {
      res.status(409).json({
        success: false,
        error: err.message.replace('ACTIVE_USER_EXISTS: ', ''),
        code: 'ACTIVE_USER_EXISTS',
      });
      return;
    }
    console.error('[AUTH_ROUTES] Clean orphan reservation error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Gagal membersihkan reservasi yatim.',
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

    const existingData = userSnap.data() || {};
    const existingRevocation = existingData.sessionRevokedAtSeconds || 0;
    effectiveRevocation = Math.max(existingRevocation, nowSeconds);

    transaction.set(
      credRef,
      {
        userId,
        loginId: existingData.loginId ? normalizeLoginId(existingData.loginId) : '',
        nip: userNip || '',
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

      // Clear any rate limiter lockout for target user across all identifiers
      await AuthRateLimiter.recordLoginSuccess(targetUserId, ip);
      if (targetData.loginId) await AuthRateLimiter.recordLoginSuccess(targetData.loginId, ip);
      if (targetData.nip) await AuthRateLimiter.recordLoginSuccess(targetData.nip, ip);
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
