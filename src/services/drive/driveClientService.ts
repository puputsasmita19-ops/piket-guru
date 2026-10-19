import { auth } from '../firebase/firebaseAuth';

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

async function getDriveSession() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  const assertCurrent = () => {
    if (auth.currentUser?.uid !== user.uid) throw new Error('Sesi akun telah berubah. Permintaan foto dibatalkan.');
  };
  const token = await user.getIdToken();
  assertCurrent();
  return { headers: { Authorization: `Bearer ${token}` }, assertCurrent };
}

async function requestJson(path: string, options: RequestInit = {}) {
  const session = await getDriveSession();
  session.assertCurrent();
  const res = await fetch(path, {
    ...options, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...session.headers },
  });
  session.assertCurrent();
  const data = await res.json().catch(() => {
    if (!res.ok) return {};
    throw new Error('Respons Google Drive tidak valid. Silakan coba lagi.');
  });
  session.assertCurrent();
  return { res, data };
}

// Share only requests currently in flight, per UID. No stale policy TTL cache.
const policyRequests = new Map<string, Promise<DriveStorageStatusResponse>>();

export class DriveClientService {
  public static async getStorageStatus(): Promise<DriveStorageStatusResponse> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sesi berakhir. Silakan masuk kembali.');
    const current = policyRequests.get(uid);
    if (current) return current;
    const pending = (async () => {
      const { res, data } = await requestJson('/api/drive/storage-status', { method: 'GET' });
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil kebijakan penyimpanan foto.');
      return data as DriveStorageStatusResponse;
    })();
    policyRequests.set(uid, pending);
    const clear = () => { if (policyRequests.get(uid) === pending) policyRequests.delete(uid); };
    void pending.then(clear, clear);
    return pending;
  }

  public static async getStatus(): Promise<DriveStatusResponse> {
    const { res, data } = await requestJson('/api/drive/status', { method: 'GET' });
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil status Google Drive.');
    return data;
  }

  public static async getAuthUrl(): Promise<{ url: string; redirectUri: string }> {
    const { res, data } = await requestJson('/api/drive/auth/url', { method: 'POST' });
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memperoleh URL otorisasi Google Drive.');
    return { url: data.url, redirectUri: data.redirectUri };
  }

  public static async testConnection(): Promise<{ success: boolean; accountEmail?: string; message: string }> {
    const { res, data } = await requestJson('/api/drive/test', { method: 'POST' });
    return { success: res.ok && data.success === true, accountEmail: data.accountEmail, message: data.message || data.error || 'Uji koneksi selesai.' };
  }

  public static async toggleStorage(enabled: boolean): Promise<{ success: boolean; message: string }> {
    const { res, data } = await requestJson('/api/drive/toggle', { method: 'POST', body: JSON.stringify({ enabled }) });
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengubah status pengaktifan Google Drive.');
    return { success: true, message: data.message };
  }

  public static async disconnect(): Promise<void> {
    const { res, data } = await requestJson('/api/drive/disconnect', { method: 'POST' });
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memutuskan koneksi Google Drive.');
  }

  public static async uploadPhoto(options: {
    base64: string;
    module: 'attendance' | 'studentTardiness' | 'incidents' | 'studentPermits' | 'visitors' | 'general';
    mimeType?: string;
    clientPhotoId?: string;
    recordId?: string;
  }): Promise<DriveUploadResult> {
    const { res, data } = await requestJson('/api/drive/upload', { method: 'POST', body: JSON.stringify(options) });
    if (!res.ok || !data.success) {
      return { success: false, fileId: '', provider: 'google_drive', mimeType: options.mimeType || 'image/jpeg', size: 0,
        folderPath: '', photoUrl: '', createdAt: new Date().toISOString(), error: data.error || 'Gagal mengunggah foto ke Google Drive.' };
    }
    return { success: true, fileId: data.fileId, provider: 'google_drive', mimeType: data.mimeType,
      size: data.size, folderPath: data.folderPath, photoUrl: data.photoUrl, createdAt: data.createdAt };
  }

  public static async getAuthenticatedPhotoUrl(fileIdOrPath: string, signal?: AbortSignal): Promise<string> {
    if (!fileIdOrPath) return '';
    if (fileIdOrPath.startsWith('data:image/')) return fileIdOrPath;
    const fileId = fileIdOrPath.startsWith('/api/drive/photo/') ? fileIdOrPath.slice('/api/drive/photo/'.length) : fileIdOrPath;
    const session = await getDriveSession();
    session.assertCurrent();
    const res = await fetch(`/api/drive/photo/${encodeURIComponent(fileId)}`, { headers: session.headers, cache: 'no-store', signal });
    session.assertCurrent();
    if (!res.ok) throw new Error('Foto Drive belum dapat dimuat. Periksa koneksi atau hak akses.');
    const blob = await res.blob();
    session.assertCurrent();
    if (!blob.type.startsWith('image/')) throw new Error('Respons dokumentasi bukan gambar.');
    return URL.createObjectURL(blob);
  }
}
