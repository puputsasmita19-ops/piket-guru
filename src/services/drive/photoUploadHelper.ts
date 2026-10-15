import { DriveClientService } from './driveClientService';

export interface ProcessedPhotoResult {
  photoUrl: string;
  driveFileId?: string;
  provider: 'google_drive' | 'base64';
}

/**
 * Checks if Google Drive Photo Storage is enabled and active.
 */
let cachedDriveEnabled: { enabled: boolean; lastCheck: number } | null = null;

export async function isDriveStorageActive(): Promise<boolean> {
  const now = Date.now();
  // Cache status for 30 seconds to avoid excessive network calls
  if (cachedDriveEnabled && now - cachedDriveEnabled.lastCheck < 30000) {
    return cachedDriveEnabled.enabled;
  }

  try {
    const status = await DriveClientService.getStatus();
    const isActive = status.configuredInEnv && status.status === 'CONNECTED' && status.enabled === true;
    cachedDriveEnabled = { enabled: isActive, lastCheck: now };
    return isActive;
  } catch (err) {
    console.warn('[PHOTO_UPLOAD_HELPER] Failed to check Drive status, defaulting to inactive:', err);
    return false;
  }
}

/**
 * Force invalidates the local cached Drive status.
 */
export function invalidateDriveStatusCache(): void {
  cachedDriveEnabled = null;
}

/**
 * Processes a single photo (Base64 string or existing URL).
 * If Drive storage is enabled and photo is Base64: uploads to Google Drive.
 * Strict policy: If Drive is active and upload fails, throws error to prevent silent Base64 fallback.
 */
export async function processPhotoForStorage(
  photoInput: string,
  module: 'attendance' | 'incidents' | 'studentPermits' | 'visitors' | 'general',
  clientPhotoId?: string,
  recordId?: string
): Promise<ProcessedPhotoResult> {
  if (!photoInput) {
    return { photoUrl: '', provider: 'base64' };
  }

  // If photo is already a Drive URL or HTTP URL, keep as is
  if (photoInput.startsWith('/api/drive/photo/') || photoInput.startsWith('http')) {
    return { photoUrl: photoInput, provider: 'google_drive' };
  }

  const driveActive = await isDriveStorageActive();

  if (!driveActive) {
    // Drive storage disabled or not connected -> keep original Base64 string
    return { photoUrl: photoInput, provider: 'base64' };
  }

  // Drive storage IS active -> MUST upload to Google Drive
  try {
    const uploadRes = await DriveClientService.uploadPhoto({
      base64: photoInput,
      module,
      clientPhotoId,
      recordId,
    });

    if (!uploadRes.success) {
      throw new Error(uploadRes.error || 'Gagal mengunggah foto ke Google Drive.');
    }

    return {
      photoUrl: uploadRes.photoUrl,
      driveFileId: uploadRes.fileId,
      provider: 'google_drive',
    };
  } catch (err: any) {
    console.error(`[PHOTO_UPLOAD_HELPER] Upload failed for module ${module}:`, err);
    // Mandatory policy: DO NOT fall back silently to Base64 in Firestore when Drive is enabled!
    throw new Error(`Gagal menyimpan foto ke Google Drive: ${err.message || 'Kesalahan koneksi'}. Draf/data Anda telah diamankan, silakan coba kirim kembali.`);
  }
}

/**
 * Processes an array of incident/visitor photos.
 */
export async function processMultiplePhotosForStorage<T extends { url: string; id?: string }>(
  photos: T[],
  module: 'attendance' | 'incidents' | 'studentPermits' | 'visitors' | 'general',
  recordId?: string
): Promise<T[]> {
  if (!photos || photos.length === 0) return [];

  const driveActive = await isDriveStorageActive();
  if (!driveActive) return photos;

  const processed: T[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p.url || p.url.startsWith('/api/drive/photo/') || p.url.startsWith('http')) {
      processed.push(p);
      continue;
    }

    const res = await processPhotoForStorage(p.url, module, p.id || `photo-${i}-${Date.now()}`, recordId);
    processed.push({
      ...p,
      url: res.photoUrl,
      driveFileId: res.driveFileId,
      provider: res.provider,
    });
  }

  return processed;
}
