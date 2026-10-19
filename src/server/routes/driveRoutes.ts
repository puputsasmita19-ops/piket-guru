import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from './authRoutes.js';
import { DriveStore } from '../services/driveStore.js';
import { adminAuth, adminDb } from '../firebaseAdmin.js';

export const driveRouter = Router();

/** Storage policy only. Connection management and owner information stay admin-only. */
driveRouter.get('/storage-status', requireAuth, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const config = await DriveStore.getConfig();
    const creds = DriveStore.getCredentials();
    res.json({
      success: true,
      configuredInEnv: Boolean(creds.clientId && creds.clientSecret),
      status: config.status || 'DISCONNECTED',
      enabled: config.enabled === true,
    });
  } catch {
    res.status(503).json({ success: false, error: 'Kebijakan penyimpanan foto belum dapat dibaca. Coba lagi.' });
  }
});

/**
 * GET /api/drive/status
 * Returns connection and activation status for Google Drive Photo Storage.
 * Strictly excludes any refresh tokens, secrets, or internal credentials.
 */
driveRouter.get('/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const config = await DriveStore.getConfig();
    const creds = DriveStore.getCredentials();

    res.json({
      success: true,
      configuredInEnv: Boolean(creds.clientId && creds.clientSecret),
      status: config.status || 'DISCONNECTED',
      enabled: config.enabled === true,
      accountEmail: config.accountEmail || null,
      accountName: config.accountName || null,
      rootFolderName: config.rootFolderName || 'PiketGuru_Photos',
      lastConnectedAt: config.lastConnectedAt || null,
      lastTestedAt: config.lastTestedAt || null,
      lastError: config.lastError || null,
    });
  } catch (err: any) {
    console.error('[DRIVE_ROUTES] Status check error:', err);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil status Google Drive.',
    });
  }
});

/**
 * POST /api/drive/auth/url
 * Initiates Google OAuth 2.0 flow for Admin user.
 */
driveRouter.post('/auth/url', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { redirectUri } = req.body || {};

  try {
    const creds = DriveStore.getCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      res.status(400).json({
        success: false,
        error: 'Variabel lingkungan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum dikonfigurasi pada server Vercel/backend.',
        code: 'MISSING_ENV_CONFIG',
      });
      return;
    }

    // Auto construct callback URL if custom redirectUri not provided
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const effectiveRedirectUri = redirectUri || creds.redirectUri || `${protocol}://${host}/api/drive/auth/callback`;

    const { url, state } = await DriveStore.getAuthUrl(user.uid, effectiveRedirectUri);

    res.json({
      success: true,
      url,
      state,
      redirectUri: effectiveRedirectUri,
    });
  } catch (err: any) {
    console.error('[DRIVE_ROUTES] Auth URL generation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal membuat URL otorisasi Google OAuth.',
    });
  }
});

/**
 * GET /api/drive/auth/callback
 * Public Google OAuth 2.0 redirect URI handler.
 * Exchanges code for tokens, initializes drive root folder, and redirects Admin back to Settings UI.
 */
driveRouter.get('/auth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const errorParam = req.query.error as string;

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const redirectBase = `${protocol}://${host}/#settings`;

  if (errorParam) {
    console.warn('[DRIVE_ROUTES] OAuth Consent denied by user:', errorParam);
    res.redirect(`${redirectBase}?drive_status=error&drive_message=${encodeURIComponent('Persetujuan OAuth ditolak: ' + errorParam)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${redirectBase}?drive_status=error&drive_message=${encodeURIComponent('Parameter OAuth callback tidak lengkap.')}`);
    return;
  }

  try {
    const creds = DriveStore.getCredentials();
    const effectiveRedirectUri = creds.redirectUri || `${protocol}://${host}/api/drive/auth/callback`;

    const result = await DriveStore.handleOAuthCallback(code, state, effectiveRedirectUri);

    if (result.success) {
      res.redirect(`${redirectBase}?drive_status=success&drive_email=${encodeURIComponent(result.email || '')}`);
    } else {
      res.redirect(`${redirectBase}?drive_status=error&drive_message=${encodeURIComponent(result.error || 'Gagal menghubungkan Google Drive')}`);
    }
  } catch (err: any) {
    console.error('[DRIVE_ROUTES] OAuth Callback error:', err);
    res.redirect(`${redirectBase}?drive_status=error&drive_message=${encodeURIComponent(err.message || 'Terjadi kesalahan sistem')}`);
  }
});

/**
 * POST /api/drive/test
 * Diagnostic endpoint to test Google Drive read/write capabilities.
 */
driveRouter.post('/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const testRes = await DriveStore.testConnection();
    res.json({
      success: testRes.success,
      accountEmail: testRes.accountEmail,
      message: testRes.message,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Uji koneksi Google Drive gagal.',
    });
  }
});

/**
 * POST /api/drive/toggle
 * Enables or disables Google Drive storage for new photos.
 */
driveRouter.post('/toggle', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'Parameter "enabled" wajib berupa boolean.' });
    return;
  }

  try {
    const config = await DriveStore.getConfig();

    if (enabled && config.status !== 'CONNECTED') {
      res.status(400).json({
        success: false,
        error: 'Tidak dapat mengaktifkan penyimpanan Drive sebelum akun Google Drive berhasil dihubungkan dan diuji.',
      });
      return;
    }

    await DriveStore.updateConfig({ enabled });

    res.json({
      success: true,
      enabled,
      message: enabled
        ? 'Penyimpanan foto Google Drive BERHASIL DIAKTIFKAN untuk foto baru.'
        : 'Penyimpanan foto Google Drive DINONAKTIFKAN.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Gagal memperbarui status pengaktifan Google Drive.',
    });
  }
});

/**
 * POST /api/drive/disconnect
 * Disconnects connected Google Drive account.
 */
driveRouter.post('/disconnect', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await DriveStore.disconnect();
    res.json({
      success: true,
      message: 'Koneksi Google Drive berhasil diputuskan.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Gagal memutuskan koneksi Google Drive.',
    });
  }
});

/**
 * POST /api/drive/upload
 * Backend endpoint to upload compressed photo to owner's Google Drive.
 * Requires Firebase ID token in Authorization header.
 * Verifies caller authorization for target module.
 */
driveRouter.post('/upload', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { base64, mimeType, module, clientPhotoId, recordId } = req.body || {};

  if (!base64 || typeof base64 !== 'string') {
    res.status(400).json({ success: false, error: 'Data foto (base64) wajib disertakan.' });
    return;
  }

  const validModules = ['attendance', 'studentTardiness', 'incidents', 'studentPermits', 'visitors', 'general'];
  if (!module || !validModules.includes(module)) {
    res.status(400).json({ success: false, error: `Modul '${module}' tidak valid.` });
    return;
  }

  // Match staff roles and attendance permissions enforced by firestore.rules.
  if (['attendance', 'studentTardiness', 'incidents', 'visitors'].includes(module) && !['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(user.role)) {
    res.status(403).json({ success: false, error: 'Akses unggah dokumentasi ditolak.' });
    return;
  }
  if (module === 'attendance' && user.role !== 'ADMIN') {
    const permissions = (req as any).callerData?.permissions;
    if (!Array.isArray(permissions) || !permissions.some((p: string) => ['*', 'attendance.create', 'input_duty_book'].includes(p))) {
      res.status(403).json({ success: false, error: 'Hak presensi tidak tersedia untuk akun ini.' });
      return;
    }
  }

  console.info('[DRIVE_UPLOAD] started', { module });

  try {
    // Strip Base64 header prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      res.status(400).json({ success: false, error: 'Data biner foto kosong.' });
      return;
    }

    // Strict size cap: maximum 10 MB per photo upload
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'Ukuran foto melebihi batas maksimum 10 MB.' });
      return;
    }

    const uploadResult = await DriveStore.uploadPhoto({
      buffer,
      mimeType: mimeType || 'image/jpeg',
      module,
      clientPhotoId,
      uploadedBy: user.uid,
      recordId,
    });

    const photoUrl = `/api/drive/photo/${uploadResult.fileId}`;

    console.info('[DRIVE_UPLOAD] completed', { module, size: uploadResult.size });

    res.json({
      success: true,
      fileId: uploadResult.fileId,
      provider: uploadResult.provider,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      folderPath: uploadResult.folderPath,
      photoUrl,
      createdAt: uploadResult.createdAt,
    });
  } catch (err: any) {
    console.error('[DRIVE_UPLOAD] failed', { module, code: err?.code || err?.response?.status || 'UPLOAD_FAILED' });
    res.status(500).json({
      success: false,
      error: 'Gagal mengunggah foto ke Google Drive: ' + (err.message || 'Kesalahan sistem'),
    });
  }
});

/**
 * GET /api/drive/photo/:fileId
 * Authenticated proxy endpoint to view image stored in private Google Drive.
 * Accepts Firebase ID token via Authorization header OR via query string `?token=...`.
 * Serves image stream with private caching headers.
 */
driveRouter.get('/photo/:fileId', async (req: Request, res: Response) => {
  const fileId = req.params.fileId;
  if (!fileId || typeof fileId !== 'string') {
    res.status(400).send('File ID tidak valid.');
    return;
  }

  // Support token from Bearer header or query parameter
  let token = req.query.token as string;
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization.trim();
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    res.status(401).send('Token autentikasi tidak disertakan.');
    return;
  }

  try {
    // Verify caller session via Firebase Admin Auth
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
      res.status(401).send('Sesi token autentikasi tidak valid atau telah kadaluwarsa.');
      return;
    }

    if (!adminDb) {
      res.status(503).send('Database backend tidak tersedia.');
      return;
    }

    // Verify caller profile existence and active status
    const callerSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.isActive !== true) {
      res.status(403).send('Akses ditolak: Akun pengguna tidak aktif.');
      return;
    }

    // Retrieve stream from Google Drive API
    const photoData = await DriveStore.getPhotoStream(fileId);

    res.setHeader('Content-Type', photoData.mimeType || 'image/jpeg');
    if (photoData.size) {
      res.setHeader('Content-Length', photoData.size);
    }
    // Private caching for 1 hour to optimize repeated UI preview renders
    res.setHeader('Cache-Control', 'private, max-age=3600, no-transform');

    photoData.stream.pipe(res);
  } catch (err: any) {
    console.error(`[DRIVE_ROUTES] Photo proxy error for file ${fileId}:`, err);
    if (!res.headersSent) {
      res.status(500).send('Gagal memuat foto dari Google Drive.');
    }
  }
});
