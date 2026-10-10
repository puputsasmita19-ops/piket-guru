/**
 * Piket Guru - Form Draft Management Service
 *
 * Provides account-isolated draft caching with debounced auto-save,
 * blob attachment storage for photos, and recovery on page refresh.
 */

import { OfflineStorage, DraftRecord } from './offlineStorage';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export class DraftService {
  /**
   * Save a form draft immediately
   */
  public static async saveDraft<T = any>(
    userId: string,
    formType: string,
    recordId: string,
    data: T,
    attachments?: { [key: string]: Blob }
  ): Promise<void> {
    if (!userId) return;
    await OfflineStorage.saveDraft(userId, formType, recordId, data, attachments);
  }

  /**
   * Debounced draft auto-save (e.g. 500ms debounce while user is typing in forms)
   */
  public static saveDraftDebounced<T = any>(
    userId: string,
    formType: string,
    recordId: string,
    data: T,
    attachments?: { [key: string]: Blob },
    delayMs = 600
  ): void {
    if (!userId) return;
    const timerKey = `${userId}:${formType}:${recordId}`;
    if (debounceTimers.has(timerKey)) {
      clearTimeout(debounceTimers.get(timerKey)!);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(timerKey);
      this.saveDraft(userId, formType, recordId, data, attachments).catch((err) => {
        console.warn('[DRAFT_SERVICE] Debounced save failed:', err);
      });
    }, delayMs);

    debounceTimers.set(timerKey, timer);
  }

  /**
   * Retrieve an existing draft for this user & record
   */
  public static async getDraft<T = any>(
    userId: string,
    formType: string,
    recordId: string
  ): Promise<DraftRecord<T> | null> {
    if (!userId) return null;
    return OfflineStorage.getDraft<T>(userId, formType, recordId);
  }

  /**
   * Delete draft upon successful submission or user discard
   */
  public static async deleteDraft(userId: string, formType: string, recordId: string): Promise<void> {
    if (!userId) return;
    const timerKey = `${userId}:${formType}:${recordId}`;
    if (debounceTimers.has(timerKey)) {
      clearTimeout(debounceTimers.get(timerKey)!);
      debounceTimers.delete(timerKey);
    }
    await OfflineStorage.deleteDraft(userId, formType, recordId);
  }

  /**
   * List all drafts for a user (optionally filtered by formType)
   */
  public static async listDrafts(userId: string, formType?: string): Promise<DraftRecord[]> {
    if (!userId) return [];
    return OfflineStorage.listDraftsByUser(userId, formType);
  }

  /**
   * Convert data URL / base64 image to Blob for storage in IndexedDB
   */
  public static async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  /**
   * Convert Blob back to data URL for image preview in forms
   */
  public static async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

