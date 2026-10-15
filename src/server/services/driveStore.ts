import { google } from 'googleapis';
import { Readable } from 'stream';
import { adminDb } from '../firebaseAdmin.js';
import { encryptToken, decryptToken } from '../crypto/tokenEncryption.js';

export interface DriveConfigDoc {
  status: 'CONNECTED' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
  enabled: boolean;
  accountEmail?: string;
  accountName?: string;
  encryptedRefreshToken?: string;
  rootFolderId?: string;
  rootFolderName?: string;
  lastConnectedAt?: string;
  lastTestedAt?: string;
  lastError?: string;
  updatedBy?: string;
}

export interface DriveUploadOptions {
  buffer: Buffer;
  mimeType: string;
  module: 'attendance' | 'incidents' | 'studentPermits' | 'visitors' | 'general';
  clientPhotoId?: string;
  uploadedBy?: string;
  recordId?: string;
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

// In-memory state cache for CSRF state validation (10 min TTL)
const activeOAuthStates = new Map<string, { adminUid: string; timestamp: number }>();

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
  public static createAuthState(adminUid: string): string {
    const randomHex = Math.random().toString(36).substring(2, 12);
    const timestamp = Date.now();
    const stateToken = `${adminUid}_${randomHex}_${timestamp}`;

    activeOAuthStates.set(stateToken, { adminUid, timestamp });

    // Clean up expired states older than 15 minutes
    for (const [key, val] of activeOAuthStates.entries()) {
      if (Date.now() - val.timestamp > 15 * 60 * 1000) {
        activeOAuthStates.delete(key);
      }
    }

    return stateToken;
  }

  /**
   * Validates an OAuth state token.
   */
  public static validateAuthState(stateToken: string): { valid: boolean; adminUid?: string; error?: string } {
    if (!stateToken) return { valid: false, error: 'State OAuth parameter tidak ditemukan.' };
    const record = activeOAuthStates.get(stateToken);
    if (!record) return { valid: false, error: 'State OAuth tidak valid atau telah kadaluwarsa.' };

    activeOAuthStates.delete(stateToken); // Single-use token

    if (Date.now() - record.timestamp > 15 * 60 * 1000) {
      return { valid: false, error: 'Sesi permintaan OAuth telah kadaluwarsa. Silakan coba lagi.' };
    }

    return { valid: true, adminUid: record.adminUid };
  }

  /**
   * Generates OAuth authorization URL for connecting Google Drive.
   */
  public static getAuthUrl(adminUid: string, redirectUri?: string): { url: string; state: string } {
    const creds = this.getCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum dikonfigurasi di variabel lingkungan backend.');
    }

    const oauth2Client = this.createOAuth2Client(redirectUri);
    const state = this.createAuthState(adminUid);

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
      return { status: 'DISCONNECTED', enabled: false };
    }
    try {
      const snap = await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get();
      if (!snap.exists) {
        return { status: 'DISCONNECTED', enabled: false };
      }
      return snap.data() as DriveConfigDoc;
    } catch (err) {
      console.error('[DRIVE_STORE] Error reading Drive config:', err);
      return { status: 'DISCONNECTED', enabled: false };
    }
  }

  /**
   * Updates Google Drive configuration doc in Firestore.
   */
  public static async updateConfig(updates: Partial<DriveConfigDoc>): Promise<void> {
    if (!adminDb) return;
    try {
      await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).set(
        {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('[DRIVE_STORE] Error updating Drive config:', err);
      throw new Error('Gagal menyimpan konfigurasi Google Drive ke database.');
    }
  }

  /**
   * Handles OAuth Callback: exchanges code for tokens, verifies profile, ensures root folder, and saves config.
   */
  public static async handleOAuthCallback(code: string, state: string, redirectUri?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const stateVal = this.validateAuthState(state);
    if (!stateVal.valid) {
      return { success: false, error: stateVal.error || 'Autentikasi state OAuth tidak valid.' };
    }

    const oauth2Client = this.createOAuth2Client(redirectUri);

    try {
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        // If refresh token wasn't returned, check if existing refresh token is saved
        const currentConfig = await this.getConfig();
        if (!currentConfig.encryptedRefreshToken) {
          return {
            success: false,
            error: 'Google OAuth tidak memberikan Refresh Token. Silakan hubungkan ulang dengan izin konfirmasi penuh.',
          };
        }
      }

      oauth2Client.setCredentials(tokens);

      // Fetch user email profile from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const accountEmail = userInfo.data.email || 'Google Drive Owner';
      const accountName = userInfo.data.name || '';

      // Create or locate Root App Folder in Drive
      const rootFolderId = await this.ensureFolder(oauth2Client, DEFAULT_ROOT_FOLDER, null);

      // Encrypt and store refresh token
      const existingConfig = await this.getConfig();
      const rawRefreshToken = tokens.refresh_token || (existingConfig.encryptedRefreshToken ? decryptToken(existingConfig.encryptedRefreshToken) : '');

      if (!rawRefreshToken) {
        return { success: false, error: 'Gagal memperoleh Refresh Token dari Google.' };
      }

      const encryptedRefreshToken = encryptToken(rawRefreshToken);

      await this.updateConfig({
        status: 'CONNECTED',
        accountEmail,
        accountName,
        encryptedRefreshToken,
        rootFolderId,
        rootFolderName: DEFAULT_ROOT_FOLDER,
        lastConnectedAt: new Date().toISOString(),
        lastError: undefined,
        updatedBy: stateVal.adminUid,
      });

      return { success: true, email: accountEmail };
    } catch (err: any) {
      console.error('[DRIVE_STORE] OAuth Callback exchange failed:', err);
      await this.updateConfig({
        status: 'NEEDS_RECONNECT',
        lastError: err.message || 'Gagal melakukan pertukaran authorization code OAuth',
      });
      return { success: false, error: 'Gagal menghubungkan Google Drive: ' + (err.message || 'Error pertukaran token') };
    }
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
        this.updateConfig({ encryptedRefreshToken: encryptToken(newTokens.refresh_token) }).catch(() => {});
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
        lastError: undefined,
      });

      return {
        success: true,
        accountEmail: config.accountEmail,
        message: `Koneksi Google Drive (${config.accountEmail}) berfungsi dengan baik. File uji berhasil dibuat dan dibersihkan.`,
      };
    } catch (err: any) {
      console.error('[DRIVE_STORE] Test connection failed:', err);

      let isInvalidGrant = false;
      const msg = err.message || '';
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
        isInvalidGrant = true;
      }

      await this.updateConfig({
        status: isInvalidGrant ? 'NEEDS_RECONNECT' : configStatusFallback(err),
        lastError: err.message || 'Uji koneksi gagal',
      });

      return {
        success: false,
        message: isInvalidGrant
          ? 'Izin akses Google Drive telah kadaluwarsa atau dicabut. Silakan lakukan hubungkan ulang.'
          : `Gagal menguji koneksi Google Drive: ${err.message}`,
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

    const { folderId, folderPath } = await this.getOrCreateFolderHierarchy(drive, config.rootFolderId, options.module);

    // Idempotency check: search if file with same clientPhotoId property already exists
    if (options.clientPhotoId) {
      try {
        const searchRes = await drive.files.list({
          q: `'${folderId}' in parents and properties has { key='clientPhotoId' and value='${options.clientPhotoId}' } and trashed = false`,
          fields: 'files(id, mimeType, size, name)',
        });

        if (searchRes.data.files && searchRes.data.files.length > 0) {
          const existing = searchRes.data.files[0];
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
      } catch (err) {
        console.warn('[DRIVE_STORE] Idempotency lookup warning:', err);
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
      encryptedRefreshToken: undefined,
      accountEmail: undefined,
      accountName: undefined,
      lastError: undefined,
    });
  }
}

function configStatusFallback(err: any): 'CONNECTED' | 'NEEDS_RECONNECT' | 'DISCONNECTED' {
  if (err?.message?.includes('invalid_grant')) return 'NEEDS_RECONNECT';
  return 'CONNECTED';
}
