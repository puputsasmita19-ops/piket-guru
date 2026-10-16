import { auth } from '../firebase/firebase';

export interface DriveStatusResponse {
  success: boolean;
  configuredInEnv: boolean;
  status: 'CONNECTED' | 'NEEDS_RECONNECT' | 'DISCONNECTED';
  enabled: boolean;
  accountEmail: string | null;
  accountName: string | null;
  rootFolderName: string;
  lastConnectedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
}

export type DriveStorageStatusResponse = Pick<DriveStatusResponse,
  'success' | 'configuredInEnv' | 'status' | 'enabled'>;

export interface DriveUploadResult {
  success: boolean;
  fileId: string;
  provider: 'google_drive';
  mimeType: string;
  size: number;
  folderPath: string;
  photoUrl: string;
  createdAt: string;
  error?: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (auth && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export class DriveClientService {
  /** Minimal storage policy for authenticated staff; contains no owner details. */
  public static async getStorageStatus(): Promise<DriveStorageStatusResponse> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/storage-status', {
      method: 'GET',
      cache: 'no-store',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengambil kebijakan penyimpanan foto.');
    }
    return data;
  }
  /**
   * Fetches Google Drive storage configuration and connection status.
   */
  public static async getStatus(): Promise<DriveStatusResponse> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal mengambil status Google Drive.');
    }

    return await res.json();
  }

  /**
   * Obtains OAuth authorization link for Admin to connect Google Drive.
   */
  public static async getAuthUrl(): Promise<{ url: string; redirectUri: string }> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/auth/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal memperoleh URL otorisasi Google Drive.');
    }

    return { url: data.url, redirectUri: data.redirectUri };
  }

  /**
   * Runs diagnostic connection test on connected Google Drive.
   */
  public static async testConnection(): Promise<{ success: boolean; accountEmail?: string; message: string }> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const data = await res.json();
    return {
      success: data.success === true,
      accountEmail: data.accountEmail,
      message: data.message || 'Uji koneksi selesai.',
    };
  }

  /**
   * Toggles Google Drive storage activation state on/off.
   */
  public static async toggleStorage(enabled: boolean): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ enabled }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengubah status pengaktifan Google Drive.');
    }

    return { success: true, message: data.message };
  }

  /**
   * Disconnects connected Google Drive account.
   */
  public static async disconnect(): Promise<void> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal memutuskan koneksi Google Drive.');
    }
  }

  /**
   * Uploads compressed image base64 data to owner's Google Drive.
   */
  public static async uploadPhoto(options: {
    base64: string;
    module: 'attendance' | 'studentTardiness' | 'incidents' | 'studentPermits' | 'visitors' | 'general';
    mimeType?: string;
    clientPhotoId?: string;
    recordId?: string;
  }): Promise<DriveUploadResult> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(options),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        fileId: '',
        provider: 'google_drive',
        mimeType: options.mimeType || 'image/jpeg',
        size: 0,
        folderPath: '',
        photoUrl: '',
        createdAt: new Date().toISOString(),
        error: data.error || 'Gagal mengunggah foto ke Google Drive.',
      };
    }

    return {
      success: true,
      fileId: data.fileId,
      provider: 'google_drive',
      mimeType: data.mimeType,
      size: data.size,
      folderPath: data.folderPath,
      photoUrl: data.photoUrl,
      createdAt: data.createdAt,
    };
  }

  /**
   * Helper to construct an authenticated URL for displaying or printing a Google Drive photo.
   */
  public static async getAuthenticatedPhotoUrl(fileIdOrPath: string, signal?: AbortSignal): Promise<string> {
    if (!fileIdOrPath) return '';
    if (fileIdOrPath.startsWith('data:image/')) return fileIdOrPath; // Legacy Base64

    let fileId = fileIdOrPath;
    if (fileIdOrPath.startsWith('/api/drive/photo/')) {
      fileId = fileIdOrPath.replace('/api/drive/photo/', '');
    }

    const headers = await getAuthHeader();
    const res = await fetch(`/api/drive/photo/${encodeURIComponent(fileId)}`, {
      headers, cache: 'no-store', signal,
    });
    if (!res.ok) throw new Error('Foto Drive belum dapat dimuat. Periksa koneksi atau hak akses.');
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Respons dokumentasi bukan gambar.');
    // Tokens stay in the Authorization header, never in an image URL/history.
    return URL.createObjectURL(blob);
  }
}
