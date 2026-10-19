import { google } from 'googleapis';
import { randomBytes, createHash } from 'crypto';
import { Readable } from 'stream';
import { adminDb } from '../firebaseAdmin.js';
import { encryptToken, decryptToken } from '../crypto/tokenEncryption.js';

export interface DriveConfigDoc {
  status: 'CONNECTED' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
  enabled: boolean;
  accountEmail?: string | null;
  accountName?: string | null;
  encryptedRefreshToken?: string | null;
  rootFolderId?: string | null;
  rootFolderName?: string | null;
  lastConnectedAt?: string | null;
  lastTestedAt?: string | null;
  lastError?: string | null;
  updatedBy?: string | null;
}

export interface DriveUploadOptions {
  buffer: Buffer;
  mimeType: string;
  module: 'attendance' | 'studentTardiness' | 'incidents' | 'studentPermits' | 'visitors' | 'general' | 'profilePhotos';
  clientPhotoId?: string;
  uploadedBy?: string;
  recordId?: string;
  contentHash?: string;
}

export interface DriveUploadResult {
  fileId: string;
  mimeType: string;
  size: number;
  folderPath: string;
  provider: 'google_drive';
  createdAt: string;
  driveViewUrl?: string;
}

const CONFIG_COLLECTION = 'system_config';
const CONFIG_DOC_ID = 'google_drive';
const DEFAULT_ROOT_FOLDER = 'PiketGuru_Photos';

const OAUTH_STATE_COLLECTION = 'drive_oauth_states';
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export class DriveStore {
  /**
   * Retrieves Google OAuth Client credentials from environment variables.
   */
  public static getCredentials() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    };
  }

  /**
   * Initializes google.auth.OAuth2 instance.
   */
  public static createOAuth2Client(customRedirectUri?: string) {
    const creds = this.getCredentials();
    const redirectUri = customRedirectUri || creds.redirectUri;
    return new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri);
  }

  /**
   * Generates a secure, time-bound OAuth state token for the Admin session.
   */
  public static async createAuthState(adminUid: string): Promise<string> {
    if (!adminDb) throw new Error('Database sesi Google Drive tidak tersedia.');
    const stateToken = randomBytes(32).toString('base64url');
    const stateId = createHash('sha256').update(stateToken).digest('hex');
    await adminDb.collection(OAUTH_STATE_COLLECTION).doc(stateId).set({
      adminUid, createdAt: Date.now(), expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    });
    return stateToken;
  }

  /** Consume the opaque nonce once, across serverless replicas and cold starts. */
  public static async validateAuthState(stateToken: string): Promise<{ valid: boolean; adminUid?: string; error?: string }> {
    if (typeof stateToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(stateToken)) {
      return { valid: false, error: 'State OAuth tidak valid. Silakan hubungkan kembali.' };
    }
    if (!adminDb) throw new Error('Database sesi Google Drive tidak tersedia.');
    const stateId = createHash('sha256').update(stateToken).digest('hex');
    const ref = adminDb.collection(OAUTH_STATE_COLLECTION).doc(stateId);
    return adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { valid: false, error: 'Sesi OAuth tidak ditemukan atau sudah digunakan. Silakan coba lagi.' };
      const state = snapshot.data()!;
      transaction.delete(ref);
      if (!Number.isFinite(state.expiresAt) || !Number.isFinite(state.createdAt) || state.expiresAt <= Date.now() || state.createdAt > Date.now() + 60000 || typeof state.adminUid !== 'string' || !state.adminUid) {
        return { valid: false, error: 'Sesi permintaan OAuth telah kadaluwarsa. Silakan coba lagi.' };
      }
      return { valid: true, adminUid: state.adminUid };
    });
  }

  /**
   * Generates OAuth authorization URL for connecting Google Drive.
   */
  public static async getAuthUrl(adminUid: string, redirectUri?: string): Promise<{ url: string; state: string }> {
    const creds = this.getCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum dikonfigurasi di variabel lingkungan backend.');
    }

    const oauth2Client = this.createOAuth2Client(redirectUri);
    const state = await this.createAuthState(adminUid);

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Mandatory to receive refresh_token
      prompt: 'consent',     // Guarantees receiving refresh_token
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state,
    });

    return { url, state };
  }

  /**
   * Retrieves Google Drive configuration stored in Firestore.
   */
  public static async getConfig(): Promise<DriveConfigDoc> {
    if (!adminDb) {
      throw new Error('Database konfigurasi Google Drive tidak tersedia.');
    }
    try {
      const snap = await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get();
      if (!snap.exists) {
        return { status: 'DISCONNECTED', enabled: false };
      }
      return snap.data() as DriveConfigDoc;
    } catch (err) {
      console.error('[DRIVE_STORE] Error reading Drive config');
      throw new Error('Gagal membaca konfigurasi Google Drive.');
    }
  }

  /**
   * Updates Google Drive configuration doc in Firestore safely without undefined properties.
   */
  public static async updateConfig(updates: Partial<DriveConfigDoc>): Promise<void> {
    if (!adminDb) return;
    try {
      const cleanPayload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanPayload[key] = value;
        }
      }

      await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).set(
        cleanPayload,
        { merge: true }
      );
    } catch (err: any) {
      console.error('[DRIVE_STORE] Error updating Drive config:', err?.message || err);
      throw new Error('Gagal menyimpan konfigurasi Google Drive ke database.');
    }
  }

  /**
   * Handles OAuth Callback: exchanges code for tokens, verifies profile, ensures root folder, and saves config.
   * Separates failures explicitly into token exchange, encryption, folder setup, and Firestore persistence.
   */
  public static async handleOAuthCallback(code: string, state: string, redirectUri?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const stateVal = await this.validateAuthState(state);
    if (!stateVal.valid) {
      return { success: false, error: stateVal.error || 'Autentikasi state OAuth tidak valid.' };
    }

    // Permission may have changed while Google consent was open.
    const actor = await adminDb!.collection('users').doc(stateVal.adminUid!).get();
    if (!actor.exists || actor.data()?.role !== 'ADMIN' || actor.data()?.isActive !== true) {
      return { success: false, error: 'Hak administrator telah berubah. Hubungkan kembali melalui administrator aktif.' };
    }
    const oauth2Client = this.createOAuth2Client(redirectUri);

    // 1. Exchange authorization code for OAuth tokens
    let tokens: any;
    try {
      const tokenRes = await oauth2Client.getToken(code);
      tokens = tokenRes.tokens;
    } catch (err: any) {
      console.error('[DRIVE_STORE] OAuth token exchange failed:', err?.message || err);
      await this.updateConfig({
        status: 'NEEDS_RECONNECT',
        lastError: `Gagal pertukaran token OAuth: ${err?.message || 'Kode otorisasi tidak valid'}`,
      });
      return { success: false, error: 'Gagal pertukaran token OAuth: ' + (err?.message || 'Error pertukaran token') };
    }

    // 2. Validate or preserve Refresh Token
    const existingConfig = await this.getConfig();
    const rawRefreshToken = tokens.refresh_token || (existingConfig.encryptedRefreshToken ? decryptToken(existingConfig.encryptedRefreshToken) : '');

    if (!rawRefreshToken) {
      const errMsg = 'Google OAuth tidak memberikan Refresh Token. Silakan hubungkan ulang dengan izin konfirmasi penuh.';
      await this.updateConfig({
        status: 'NEEDS_RECONNECT',
        lastError: errMsg,
      });
      return { success: false, error: errMsg };
    }

    oauth2Client.setCredentials(tokens);

    // 3. Fetch user profile from Google
    let accountEmail = 'Google Drive Owner';
    let accountName = '';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      accountEmail = userInfo.data.email || 'Google Drive Owner';
      accountName = userInfo.data.name || '';
    } catch (err: any) {
      console.warn('[DRIVE_STORE] Failed to fetch Google user profile:', err?.message || err);
      accountEmail = existingConfig.accountEmail || 'Google Drive Owner';
      accountName = existingConfig.accountName || '';
    }

    // 4. Ensure Root App Folder in Drive
    let rootFolderId: string;
    try {
      rootFolderId = await this.ensureFolder(oauth2Client, DEFAULT_ROOT_FOLDER, null);
    } catch (err: any) {
      console.error('[DRIVE_STORE] Drive root folder creation failed:', err?.message || err);
      await this.updateConfig({
        status: 'NEEDS_RECONNECT',
        lastError: `Gagal membuat folder utama Google Drive: ${err?.message || 'Kesalahan API Drive'}`,
      });
      return { success: false, error: `Gagal membuat folder utama Google Drive: ${err?.message || 'Kesalahan API Drive'}` };
    }

    // 5. Encrypt refresh token
    let encryptedRefreshToken: string;
    try {
      encryptedRefreshToken = encryptToken(rawRefreshToken);
    } catch (err: any) {
      console.error('[DRIVE_STORE] Token encryption failed:', err?.message || err);
      await this.updateConfig({
        status: 'NEEDS_RECONNECT',
        lastError: `Gagal mengenkripsi Refresh Token: ${err?.message || 'Kesalahan sistem enkripsi'}`,
      });
      return { success: false, error: `Gagal mengenkripsi token otorisasi: ${err?.message || 'Kesalahan sistem enkripsi'}` };
    }

    // 6. Save final connected configuration in Firestore
    try {
      await this.updateConfig({
        status: 'CONNECTED',
        accountEmail,
        accountName,
        encryptedRefreshToken,
        rootFolderId,
        rootFolderName: DEFAULT_ROOT_FOLDER,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
        updatedBy: stateVal.adminUid,
      });
    } catch (err: any) {
      console.error('[DRIVE_STORE] Firestore config update failed:', err?.message || err);
      return { success: false, error: `Gagal menyimpan konfigurasi Google Drive: ${err?.message || 'Kesalahan database'}` };
    }

    return { success: true, email: accountEmail };
  }

  /**
   * Gets an authenticated Drive API client using stored encrypted refresh token.
   */
  public static async getAuthenticatedDriveClient() {
    const config = await this.getConfig();
    if (!config.encryptedRefreshToken || config.status === 'DISCONNECTED') {
      throw new Error('Google Drive belum terhubung. Silakan hubungkan akun Google Drive pada Pengaturan Sekolah.');
    }

    const refreshToken = decryptToken(config.encryptedRefreshToken);
    if (!refreshToken) {
      await this.updateConfig({ status: 'NEEDS_RECONNECT', lastError: 'Gagal mendekripsi Refresh Token' });
      throw new Error('Kredensial penyimpanan Google Drive tidak dapat dibaca. Silakan hubungkan ulang.');
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Listen for token updates (if Google issues a new refresh_token during rotation)
    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.refresh_token) {
        this.updateConfig({ encryptedRefreshToken: encryptToken(newTokens.refresh_token) }).catch((err) => {
          console.error('[DRIVE_STORE] Failed to save rotated refresh token:', err?.message || err);
        });
      }
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return { drive, config, oauth2Client };
  }

  /**
   * Helper to search for or create a folder on Drive.
   */
  private static async ensureFolder(oauthClient: any, folderName: string, parentFolderId: string | null): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: oauthClient });

    let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id!;
    }

    // Folder doesn't exist, create it
    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const folderRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return folderRes.data.id!;
  }

  /**
   * Builds the target folder hierarchy on Google Drive: Root -> Year -> Month -> Module.
   */
  public static async getOrCreateFolderHierarchy(drive: any, rootFolderId: string, moduleName: string): Promise<{ folderId: string; folderPath: string }> {
    const now = new Date();
    const yearStr = now.getFullYear().toString();
    const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');

    // 1. Year folder inside Root
    const yearFolderId = await this.ensureFolder(drive.context._options.auth, yearStr, rootFolderId);

    // 2. Month folder inside Year
    const monthFolderId = await this.ensureFolder(drive.context._options.auth, monthStr, yearFolderId);

    // 3. Module folder inside Month
    const moduleFolderId = await this.ensureFolder(drive.context._options.auth, moduleName, monthFolderId);

    const folderPath = `${DEFAULT_ROOT_FOLDER}/${yearStr}/${monthStr}/${moduleName}`;
    return { folderId: moduleFolderId, folderPath };
  }

  /**
   * Performs an API connection test (creates, reads, and deletes a small test file).
   */
  public static async testConnection(): Promise<{ success: boolean; accountEmail?: string; message: string }> {
    try {
      const { drive, config } = await this.getAuthenticatedDriveClient();

      if (!config.rootFolderId) {
        throw new Error('Folder utama PiketGuru_Photos belum dibuat.');
      }

      // Create a temporary test file
      const testFileName = `test_probe_${Date.now()}.txt`;
      const createRes = await drive.files.create({
        requestBody: {
          name: testFileName,
          parents: [config.rootFolderId],
        },
        media: {
          mimeType: 'text/plain',
          body: 'Piket Guru Drive Storage Diagnostics Probe',
        },
        fields: 'id',
      });

      const fileId = createRes.data.id;
      if (!fileId) {
        throw new Error('Gagal membuat file uji koneksi.');
      }

      // Clean up test file immediately
      await drive.files.delete({ fileId });

      await this.updateConfig({
        status: 'CONNECTED',
        lastTestedAt: new Date().toISOString(),
        lastError: null,
      });

      return {
        success: true,
        accountEmail: config.accountEmail || undefined,
        message: `Koneksi Google Drive (${config.accountEmail}) berfungsi dengan baik. File uji berhasil dibuat dan dibersihkan.`,
      };
    } catch (err: any) {
      console.error('[DRIVE_STORE] Test connection failed:', err?.message || err);

      let isInvalidGrant = false;
      const msg = err?.message || '';
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
        isInvalidGrant = true;
      }

      const existingConfig = await this.getConfig();
      const newStatus = isInvalidGrant ? 'NEEDS_RECONNECT' : (existingConfig.status || 'CONNECTED');

      await this.updateConfig({
        status: newStatus,
        lastError: err?.message || 'Uji koneksi gagal',
      });

      return {
        success: false,
        message: isInvalidGrant
          ? 'Izin akses Google Drive telah kadaluwarsa atau dicabut. Silakan lakukan hubungkan ulang.'
          : `Gagal menguji koneksi Google Drive: ${err?.message || 'Error tidak diketahui'}`,
      };
    }
  }

  /**
   * Uploads photo buffer to owner's Google Drive inside module subfolder.
   * Handles idempotency if clientPhotoId is supplied.
   */
  public static async uploadPhoto(options: DriveUploadOptions): Promise<DriveUploadResult> {
    const { drive, config } = await this.getAuthenticatedDriveClient();

    if (!config.enabled) {
      throw new Error('Penyimpanan foto Google Drive belum diaktifkan dalam Pengaturan Sekolah.');
    }

    if (!config.rootFolderId) {
      throw new Error('Folder aplikasi Google Drive belum terinisialisasi.');
    }

    const { folderId, folderPath } = options.module === 'profilePhotos'
      ? { folderId: await this.ensureFolder(drive.context._options.auth, 'Foto_Profil', config.rootFolderId), folderPath: `${DEFAULT_ROOT_FOLDER}/Foto_Profil` }
      : await this.getOrCreateFolderHierarchy(drive, config.rootFolderId, options.module);

    // Idempotency check: search if file with same clientPhotoId property already exists
    if (options.clientPhotoId) {
      try {
        const searchRes = await drive.files.list({
          q: `'${folderId}' in parents and properties has { key='clientPhotoId' and value='${options.clientPhotoId}' } and trashed = false`,
          fields: 'files(id, mimeType, size, name, properties)',
        });

        if (searchRes.data.files && searchRes.data.files.length > 0) {
          const existing = searchRes.data.files[0];
          if (options.module === 'profilePhotos' && (existing.properties?.contentHash !== options.contentHash || existing.properties?.recordId !== options.recordId)) throw new Error('PROFILE_PHOTO_RETRY_MISMATCH');
          console.log(`[DRIVE_STORE] Idempotent retry hit for clientPhotoId ${options.clientPhotoId}`);
          return {
            fileId: existing.id!,
            mimeType: existing.mimeType || options.mimeType,
            size: Number(existing.size || options.buffer.length),
            folderPath,
            provider: 'google_drive',
            createdAt: new Date().toISOString(),
          };
        }
      } catch (err: any) {
        // An unavailable search is not proof that no file exists. Never create
        // a second private photo when a previous upload may have succeeded.
        throw err;
      }
    }

    const fileTimestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 7);
    const fileName = `PG_${options.module.toUpperCase()}_${fileTimestamp}_${randomHex}.jpg`;

    // Convert Buffer to Readable Stream
    const stream = new Readable();
    stream.push(options.buffer);
    stream.push(null);

    const properties: Record<string, string> = {
      app: 'PiketGuru',
      module: options.module,
    };
    if (options.clientPhotoId) properties.clientPhotoId = options.clientPhotoId;
    if (options.uploadedBy) properties.uploadedBy = options.uploadedBy;
    if (options.recordId) properties.recordId = options.recordId;
    if (options.contentHash) properties.contentHash = options.contentHash;

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      properties,
    };

    const media = {
      mimeType: options.mimeType || 'image/jpeg',
      body: stream,
    };

    const uploadRes = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, webViewLink',
    });

    const fileId = uploadRes.data.id;
    if (!fileId) {
      throw new Error('Google Drive API tidak mengembalikan File ID.');
    }

    return {
      fileId,
      mimeType: uploadRes.data.mimeType || options.mimeType,
      size: Number(uploadRes.data.size || options.buffer.length),
      folderPath,
      provider: 'google_drive',
      createdAt: new Date().toISOString(),
      driveViewUrl: uploadRes.data.webViewLink || undefined,
    };
  }

  /**
   * Retrieves read stream for a file on Google Drive to serve directly to authenticated client.
   */
  public static async getPhotoStream(fileId: string): Promise<{ stream: Readable; mimeType: string; size?: number }> {
    const { drive } = await this.getAuthenticatedDriveClient();

    // First get file metadata
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id, mimeType, size, name',
    });

    const mimeType = metaRes.data.mimeType || 'image/jpeg';
    const size = metaRes.data.size ? Number(metaRes.data.size) : undefined;

    // Get media content stream
    const mediaRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return {
      stream: mediaRes.data as unknown as Readable,
      mimeType,
      size,
    };
  }

  /**
   * Disconnects Google Drive storage.
   */
  public static async disconnect(): Promise<void> {
    await this.updateConfig({
      status: 'DISCONNECTED',
      enabled: false,
      encryptedRefreshToken: null,
      accountEmail: null,
      accountName: null,
      lastError: null,
    });
  }
}

function configStatusFallback(err: any): 'CONNECTED' | 'NEEDS_RECONNECT' | 'DISCONNECTED' {
  if (err?.message?.includes('invalid_grant')) return 'NEEDS_RECONNECT';
  return 'CONNECTED';
}
