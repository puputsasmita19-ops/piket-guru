/**
 * Piket Guru - Synchronization Queue Engine (v2)
 *
 * Coordinates reliable, idempotent delivery of queued records:
 * - Cross-tab lock protection (Web Locks API + timestamped lease lock fallback)
 * - Pre-flight reachability & Firebase authentication verification
 * - Re-verification of user roles & module permissions before execution
 * - Exponential backoff with retry limit for transient network dropouts
 * - Immediate stop of auto-retries for validation errors, permission denials, and conflicts
 * - Progress tracking for photo attachments so partial failures resume without re-processing
 * - Idempotent operational delivery to authoritative services
 * - Observable state listeners for UI status indicators & panel
 */

import { OfflineStorage, QueueItem, QueueItemStatus } from './offlineStorage';
import { DraftService } from './draftService';
import { UserProfile } from '../../types';
import { auth } from '../firebase/firebase';
import { FirestoreService } from '../firebase/firestoreService';
import { AttendanceService } from '../firebase/attendanceService';
import { DutyBookService } from '../firebase/dutyBookService';
import { IncidentService } from '../firebase/incidentService';
import { StudentTardyService } from '../firebase/studentTardyService';
import { StudentPermitService } from '../firebase/studentPermitService';
import { VisitorService } from '../firebase/visitorService';
import { SubstitutionService } from '../firebase/substitutionService';

export interface SyncQueueStatus {
  pendingCount: number;
  needsActionCount: number;
  isSyncing: boolean;
  lastSuccessfulSyncAt: string | null;
  items: QueueItem[];
}

type SyncListener = (status: SyncQueueStatus) => void;

const listeners = new Set<SyncListener>();
let isSyncInProgress = false;
let isSyncCancelled = false;
let lastSuccessfulSyncAt: string | null = null;

export class SyncQueueService {
  /**
   * Subscribe to queue status changes for UI badges and drawers
   */
  public static subscribe(listener: SyncListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  private static notifyListeners(status: SyncQueueStatus): void {
    listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.warn('[SYNC_QUEUE] Error in listener callback:', err);
      }
    });
  }

  /**
   * Verified network reachability test (does not rely solely on navigator.onLine)
   */
  public static async isNetworkReachable(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (typeof fetch === 'undefined') {
      return true;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/manifest.json?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 304;
    } catch {
      return false;
    }
  }

  /**
   * Cancel ongoing synchronization loops on user logout or account switch
   */
  public static cancelSync(): void {
    isSyncCancelled = true;
    isSyncInProgress = false;
  }

  /**
   * Enqueue a validated action for submission
   */
  public static async enqueue(
    user: UserProfile,
    operationType: QueueItem['operationType'],
    collectionName: string,
    recordId: string,
    payload: any,
    attachments?: { [key: string]: Blob }
  ): Promise<string> {
    // Enforce idempotency: composite deterministic operation ID based on user, collection, and recordId
    const operationId = `op:${user.id}:${collectionName}:${recordId}`;
    const projectId = OfflineStorage.getProjectId();

    // Check if item already exists in queue to preserve initial creation time if pending
    const existingItems = await OfflineStorage.getSyncItemsByUser(user.id);
    const existing = existingItems.find(
      (i) => i.operationId === operationId || (i.collectionName === collectionName && i.recordId === recordId)
    );

    const item: QueueItem = {
      operationId,
      projectId,
      userId: user.id,
      userName: user.fullName,
      operationType,
      collectionName,
      recordId,
      payload,
      attachments: attachments || existing?.attachments,
      uploadedAttachmentUrls: existing?.uploadedAttachmentUrls,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: existing?.retryCount || 0,
      status: 'PENDING_NETWORK',
      schemaVersion: 2,
    };

    await OfflineStorage.enqueueSyncItem(item);
    await this.refreshStatus(user.id);

    // If reachable, schedule background sync
    this.isNetworkReachable().then((reachable) => {
      if (reachable) {
        setTimeout(() => {
          this.triggerSync(user).catch(() => {});
        }, 500);
      }
    });

    return operationId;
  }

  /**
   * Refresh current status for active user and notify subscribers
   */
  public static async refreshStatus(userId: string): Promise<SyncQueueStatus> {
    if (!userId) {
      const empty: SyncQueueStatus = {
        pendingCount: 0,
        needsActionCount: 0,
        isSyncing: false,
        lastSuccessfulSyncAt,
        items: [],
      };
      this.notifyListeners(empty);
      return empty;
    }

    const items = await OfflineStorage.getSyncItemsByUser(userId);
    const pendingCount = items.filter((i) => i.status === 'PENDING_NETWORK' || i.status === 'SENDING').length;
    const needsActionCount = items.filter((i) => i.status === 'NEEDS_ACTION').length;

    const summary: SyncQueueStatus = {
      pendingCount,
      needsActionCount,
      isSyncing: isSyncInProgress,
      lastSuccessfulSyncAt,
      items,
    };

    this.notifyListeners(summary);
    return summary;
  }

  /**
   * Retry an item that previously required action or failed
   */
  public static async retryItem(operationId: string, user: UserProfile): Promise<void> {
    const items = await OfflineStorage.getSyncItemsByUser(user.id);
    const target = items.find((i) => i.operationId === operationId);
    if (!target) return;

    target.status = 'PENDING_NETWORK';
    target.retryCount = 0;
    target.nextRetryAt = undefined;
    target.lastError = undefined;
    target.updatedAt = new Date().toISOString();

    await OfflineStorage.updateSyncItem(target);
    await this.refreshStatus(user.id);
    this.triggerSync(user).catch(() => {});
  }

  /**
   * Discard an item from the queue
   */
  public static async removeItem(operationId: string, userId: string): Promise<void> {
    // Prevent removing items currently in flight
    const items = await OfflineStorage.getSyncItemsByUser(userId);
    const target = items.find((i) => i.operationId === operationId);
    if (target && target.status === 'SENDING') {
      throw new Error('Data sedang dikirim ke server. Harap tunggu hingga pengiriman selesai.');
    }

    await OfflineStorage.removeSyncItem(operationId);
    await this.refreshStatus(userId);
  }

  /**
   * Execute queue synchronization for current user
   */
  public static async triggerSync(currentUser: UserProfile): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (isSyncInProgress) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 1. Pre-flight reachability check
    const reachable = await this.isNetworkReachable();
    if (!reachable) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 2. Cross-tab lock protection via Web Locks API
    if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
      try {
        return await (navigator as any).locks.request(
          `piket_sync_lock_${currentUser.id}`,
          { ifAvailable: true },
          async (lock: any) => {
            if (!lock) {
              console.log('[SYNC_QUEUE] Another browser tab is currently syncing for this user.');
              return { processed: 0, succeeded: 0, failed: 0 };
            }
            return this.runSyncProcessWithLease(currentUser);
          }
        );
      } catch (lockErr) {
        console.warn('[SYNC_QUEUE] Web Locks API error, falling back to lease lock:', lockErr);
      }
    }

    // Fallback: timestamped lease lock
    return this.runSyncProcessWithLease(currentUser);
  }

  private static async runSyncProcessWithLease(currentUser: UserProfile): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const leaseKey = `piket_sync_lease_${currentUser.id}`;
    const now = Date.now();

    if (typeof localStorage !== 'undefined') {
      const existingLease = localStorage.getItem(leaseKey);
      if (existingLease && Number(existingLease) > now) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }
      localStorage.setItem(leaseKey, String(now + 25000)); // 25s lease
    }

    try {
      return await this.runSyncProcess(currentUser);
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(leaseKey);
      }
    }
  }

  private static async runSyncProcess(currentUser: UserProfile): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (isSyncInProgress) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 1. Auth check: user must be active in Firebase Auth
    if (!auth || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      console.warn('[SYNC_QUEUE] Sync aborted: Firebase Auth user does not match current session.');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 2. Active status check
    if (currentUser.isActive === false) {
      console.warn('[SYNC_QUEUE] Sync aborted: Account has been disabled.');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    isSyncInProgress = true;
    isSyncCancelled = false;
    await this.refreshStatus(currentUser.id);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const items = await OfflineStorage.getSyncItemsByUser(currentUser.id);
      const currentTime = Date.now();

      // Only pick items in PENDING_NETWORK whose backoff window has passed
      const eligibleItems = items.filter(
        (i) => i.status === 'PENDING_NETWORK' && (!i.nextRetryAt || i.nextRetryAt <= currentTime)
      );

      for (const item of eligibleItems) {
        if (isSyncCancelled || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
          console.log('[SYNC_QUEUE] Sync process cancelled due to user logout or session switch.');
          break;
        }

        // 3. Pre-flight permission verification for this operation type
        const permissionError = this.validateUserAuthority(item, currentUser);
        if (permissionError) {
          item.status = 'NEEDS_ACTION';
          item.lastError = permissionError;
          item.updatedAt = new Date().toISOString();
          await OfflineStorage.updateSyncItem(item);
          failed++;
          continue;
        }

        processed++;
        item.status = 'SENDING';
        item.updatedAt = new Date().toISOString();
        await OfflineStorage.updateSyncItem(item);
        await this.refreshStatus(currentUser.id);

        try {
          // 4. Coordinate attachment conversion/upload progress before writing record
          await this.prepareAttachments(item);

          // 5. Execute operation idempotently
          await this.executeOperation(item, currentUser);

          succeeded++;
          lastSuccessfulSyncAt = new Date().toISOString();
          await OfflineStorage.removeSyncItem(item.operationId);
        } catch (err: any) {
          failed++;
          console.error(`[SYNC_QUEUE] Error syncing item ${item.operationId}:`, err);

          const errorMessage = err?.message || String(err);
          const isPermanent =
            errorMessage.includes('permission-denied') ||
            errorMessage.includes('Akses ditolak') ||
            errorMessage.includes('tidak memiliki hak') ||
            errorMessage.includes('tidak memiliki wewenang') ||
            errorMessage.includes('Konflik pembaruan') ||
            errorMessage.includes('Konflik revisi') ||
            errorMessage.includes('dinonaktifkan') ||
            errorMessage.includes('tidak ditemukan');

          if (isPermanent) {
            // Permanent business or authorization error: stop retries, require user action
            item.status = 'NEEDS_ACTION';
            item.lastError = errorMessage;
          } else {
            // Transient network failure: exponential backoff
            item.retryCount = (item.retryCount || 0) + 1;
            if (item.retryCount >= 5) {
              item.status = 'NEEDS_ACTION';
              item.lastError = `Batas maksimal 5 kali percobaan tercapai: ${errorMessage}`;
            } else {
              item.status = 'PENDING_NETWORK';
              item.lastError = errorMessage;
              const backoffMs = Math.min(3000 * Math.pow(2, item.retryCount), 60000);
              item.nextRetryAt = Date.now() + backoffMs;
            }
          }
          item.updatedAt = new Date().toISOString();
          await OfflineStorage.updateSyncItem(item);
        }
      }
    } finally {
      isSyncInProgress = false;
      await this.refreshStatus(currentUser.id);
    }

    return { processed, succeeded, failed };
  }

  /**
   * Verify user has active permission/role to execute this operation
   */
  private static validateUserAuthority(item: QueueItem, user: UserProfile): string | null {
    if (user.isActive === false) {
      return 'Akun dinonaktifkan oleh Administrator. Sinkronisasi dihentikan.';
    }

    switch (item.operationType) {
      case 'INCIDENT_REPORT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET', 'GURU'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Akun Anda tidak memiliki wewenang melaporkan kejadian.';
      }
      case 'TARDY_REPORT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Hanya Guru Piket atau Admin yang dapat mencatat siswa terlambat.';
      }
      case 'PERMIT_REPORT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Hanya Guru Piket atau Admin yang dapat menerbitkan surat izin siswa.';
      }
      case 'VISITOR_REPORT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Hanya Guru Piket atau Admin yang dapat mencatat buku tamu.';
      }
      case 'SUBSTITUTION_REPORT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Hanya Guru Piket atau Admin yang dapat mengatur guru inval.';
      }
      case 'DUTYBOOK_SUBMIT': {
        const allowed = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU_PIKET', 'GURU'].includes(user.role);
        return allowed ? null : 'Hak akses dicabut: Akun Anda tidak memiliki wewenang mengisi jurnal piket.';
      }
      default:
        return null;
    }
  }

  /**
   * Process attachments and store conversion progress to prevent re-processing on partial failure
   */
  private static async prepareAttachments(item: QueueItem): Promise<void> {
    if (!item.attachments || Object.keys(item.attachments).length === 0) {
      return;
    }

    item.uploadedAttachmentUrls = item.uploadedAttachmentUrls || {};
    let hasNewConversions = false;

    for (const [key, blob] of Object.entries(item.attachments)) {
      if (!item.uploadedAttachmentUrls[key] && blob) {
        const dataUrl = await DraftService.blobToDataUrl(blob);
        item.uploadedAttachmentUrls[key] = dataUrl;
        hasNewConversions = true;
      }
    }

    if (hasNewConversions) {
      await OfflineStorage.updateSyncItem(item);
    }

    // Inject prepared attachments into the operation payload
    if (item.operationType === 'TARDY_REPORT' && item.uploadedAttachmentUrls['tardy_photo']) {
      item.payload.fotoUrl = item.uploadedAttachmentUrls['tardy_photo'];
    } else if (item.operationType === 'VISITOR_REPORT' && item.uploadedAttachmentUrls['visitor_photo']) {
      if (item.payload?.record) {
        item.payload.record.fotoUrl = item.uploadedAttachmentUrls['visitor_photo'];
      } else {
        item.payload.fotoUrl = item.uploadedAttachmentUrls['visitor_photo'];
      }
    } else if (item.operationType === 'INCIDENT_REPORT') {
      const incidentPhotos = Object.entries(item.uploadedAttachmentUrls).map(([k, url], idx) => ({
        id: `photo-${idx}`,
        url,
        uploadedAt: new Date().toISOString(),
      }));
      if (incidentPhotos.length > 0) {
        item.payload.photos = incidentPhotos;
      }
    }
  }

  /**
   * Execute single queue item idempotently
   */
  private static async executeOperation(item: QueueItem, user: UserProfile): Promise<void> {
    switch (item.operationType) {
      case 'ATTENDANCE_CHECKIN': {
        await AttendanceService.checkIn(item.payload);
        break;
      }

      case 'DUTYBOOK_SUBMIT': {
        const { record, isSubmitOnly } = item.payload;
        if (isSubmitOnly) {
          await DutyBookService.submitJournal(record, user);
        } else {
          await DutyBookService.saveDraft(record, user);
        }
        break;
      }

      case 'INCIDENT_REPORT': {
        await IncidentService.saveIncident(item.payload, user);
        break;
      }

      case 'TARDY_REPORT': {
        await StudentTardyService.saveTardyStudent(item.payload, user);
        break;
      }

      case 'PERMIT_REPORT': {
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await StudentPermitService.updatePermit(record, user);
        } else {
          await StudentPermitService.createPermit(record, user);
        }
        break;
      }

      case 'VISITOR_REPORT': {
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await VisitorService.updateVisitor(record, user);
        } else {
          await VisitorService.registerVisitor(record, user);
        }
        break;
      }

      case 'SUBSTITUTION_REPORT': {
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await SubstitutionService.updateSubstitution(record, user);
        } else {
          await SubstitutionService.createSubstitution(record, user);
        }
        break;
      }

      case 'GENERIC_SET': {
        await FirestoreService.setDocument(item.collectionName, item.recordId, item.payload);
        break;
      }

      default:
        throw new Error(`Tipe operasi antrean tidak dikenal: ${(item as any).operationType}`);
    }
  }
}
