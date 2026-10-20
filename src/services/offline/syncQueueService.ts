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
import { auth } from '../firebase/firebaseAuth';
import { PERMISSIONS, checkUserPermission, type PermissionKey } from '../../config/permissions';

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
let syncEpoch = 0;
type SyncResult = { processed: number; succeeded: number; failed: number };
let syncRequest: { epoch: number; uid: string; promise: Promise<SyncResult> } | null = null;
const noSyncWork = (): SyncResult => ({ processed: 0, succeeded: 0, failed: 0 });
const sameSyncSession = (uid: string, epoch: number) => syncEpoch === epoch && auth.currentUser?.uid === uid;

function canonicalSubmission(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalSubmission);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonicalSubmission(value[key])]));
  }
  return value;
}

async function submissionFingerprint(payload: any, attachments?: { [key: string]: Blob }): Promise<string> {
  const hash = async (value: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), b => b.toString(16).padStart(2, '0')).join('');
  const photos: [string, string][] = [];
  for (const key of Object.keys(attachments || {}).sort()) photos.push([key, await hash(await attachments![key].arrayBuffer())]);
  return hash(new TextEncoder().encode(JSON.stringify([canonicalSubmission(payload), photos])));
}

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`/manifest.json?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 304;
    } catch {
      return false;
    } finally { clearTimeout(timeoutId); }
  }

  /**
   * Cancel ongoing synchronization loops on user logout or account switch
   */
  public static cancelSync(): void {
    isSyncCancelled = true;
    syncEpoch++;
    syncRequest = null;
  }

  /** A real reconnect may retry transient network work immediately. */
  public static async resumeNetwork(user: UserProfile): Promise<void> {
    const epoch = syncEpoch;
    if (auth.currentUser?.uid !== user.id || isSyncInProgress) return;
    for (const item of await OfflineStorage.getSyncItemsByUser(user.id)) {
      if (!sameSyncSession(user.id, epoch)) return;
      await OfflineStorage.resetSyncItemForRetry(item.operationId, user.id, true);
    }
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
    const epoch = syncEpoch;
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
      submissionFingerprint: await submissionFingerprint({ operationType, collectionName, recordId, payload }, attachments),
    };

    // Queue entries are immutable submissions. Replacing one while a sender
    // holds an older copy can lose the replacement when that sender removes it.
    await OfflineStorage.enqueueSyncItem(item, { createOnly: true });
    await this.refreshStatus(user.id);

    // If reachable, schedule background sync
    this.isNetworkReachable().then((reachable) => {
      if (reachable && sameSyncSession(user.id, epoch)) {
        setTimeout(() => {
          if (sameSyncSession(user.id, epoch)) this.triggerSync(user).catch(() => {});
        }, 500);
      }
    });

    return operationId;
  }

  /**
   * Refresh current status for active user and notify subscribers
   */
  public static async refreshStatus(userId: string): Promise<SyncQueueStatus> {
    const epoch = syncEpoch;
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

    if (sameSyncSession(userId, epoch)) this.notifyListeners(summary);
    else return { ...summary, items: [], pendingCount: 0, needsActionCount: 0, isSyncing: false };
    return summary;
  }

  /**
   * Retry an item that previously required action or failed
   */
  public static async retryItem(operationId: string, user: UserProfile): Promise<void> {
    if (auth.currentUser?.uid !== user.id) throw new Error('Sesi akun telah berubah. Masuk kembali dengan akun pemilik data.');
    const changed = await OfflineStorage.resetSyncItemForRetry(operationId, user.id);
    if (!changed) return;
    if (auth.currentUser?.uid !== user.id) return;
    await this.refreshStatus(user.id);
    if (auth.currentUser?.uid === user.id) this.triggerSync(user).catch(() => {});
  }

  /**
   * Discard an item from the queue
   */
  public static async removeItem(operationId: string, userId: string): Promise<void> {
    if (!userId || auth.currentUser?.uid !== userId) {
      throw new Error('Sesi akun telah berubah. Antrean tidak dapat dihapus dari akun lain.');
    }
    // Ownership and SENDING status must be checked in the same IndexedDB
    // transaction as deletion, never in a separate (racy) UI read.
    await OfflineStorage.removeSyncItem(operationId, { userId });
    if (auth.currentUser?.uid === userId) await this.refreshStatus(userId);
  }

  /**
   * Execute queue synchronization for current user
   */
  public static async triggerSync(currentUser: UserProfile): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const epoch = syncEpoch;
    if (auth.currentUser?.uid !== currentUser.id) return noSyncWork();
    if (syncRequest?.uid === currentUser.id && syncRequest.epoch === epoch) return syncRequest.promise;
    if (isSyncInProgress) return noSyncWork();
    // Cover the asynchronous probe/lock phase too, before the delivery flag is set.
    const request = { uid: currentUser.id, epoch, promise: this.startSync(currentUser, epoch) };
    syncRequest = request;
    try { return await request.promise; }
    finally { if (syncRequest === request) syncRequest = null; }
  }

  private static async startSync(currentUser: UserProfile, epoch: number): Promise<SyncResult> {

    // 1. Pre-flight reachability check
    const reachable = await this.isNetworkReachable();
    if (!reachable || !sameSyncSession(currentUser.id, epoch)) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 2. Cross-tab lock protection via Web Locks API
    if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
      let callbackStarted = false;
      try {
        return await (navigator as any).locks.request(
          `piket_sync_lock_${currentUser.id}`,
          { ifAvailable: true },
          async (lock: any) => {
            callbackStarted = true;
            if (!lock || !sameSyncSession(currentUser.id, epoch)) {
              console.log('[SYNC_QUEUE] Another browser tab is currently syncing for this user.');
              return { processed: 0, succeeded: 0, failed: 0 };
            }
            return this.runSyncProcessWithLease(currentUser, epoch);
          }
        );
      } catch (lockErr) {
        if (callbackStarted) throw lockErr; // A delivery/storage error is not a lock acquisition failure.
        console.warn('[SYNC_QUEUE] Web Locks API error, falling back to lease lock:', lockErr);
      }
    }

    // Fallback: timestamped lease lock
    if (!sameSyncSession(currentUser.id, epoch)) return noSyncWork();
    return this.runSyncProcessWithLease(currentUser, epoch);
  }

  private static async runSyncProcessWithLease(currentUser: UserProfile, epoch: number): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const owner = `${Date.now()}:${Math.random()}`;
    if (!await OfflineStorage.syncLease(currentUser.id, owner)) return { processed: 0, succeeded: 0, failed: 0 };
    let stopping = false;
    let heartbeatInFlight: Promise<void> = Promise.resolve();
    const heartbeat = setInterval(() => {
      // Serialise renewals, and wait for an in-flight renewal before releasing.
      // Otherwise a delayed renewal could resurrect a released 90-second lock.
      heartbeatInFlight = heartbeatInFlight.then(async () => {
        if (stopping) return;
        try {
          const owned = await OfflineStorage.syncLease(currentUser.id, owner);
          if (!owned && syncEpoch === epoch) isSyncCancelled = true;
        } catch {
          if (syncEpoch === epoch) isSyncCancelled = true;
        }
      });
    }, 10000);
    try {
      if (!sameSyncSession(currentUser.id, epoch)) return noSyncWork();
      return await this.runSyncProcess(currentUser, epoch);
    }
    finally {
      stopping = true;
      clearInterval(heartbeat);
      await heartbeatInFlight;
      await OfflineStorage.syncLease(currentUser.id, owner, true).catch(() => {});
    }
  }

  private static async runSyncProcess(currentUser: UserProfile, epoch: number): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (isSyncInProgress || !sameSyncSession(currentUser.id, epoch)) {
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

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      await this.refreshStatus(currentUser.id);
      if (!sameSyncSession(currentUser.id, epoch)) return noSyncWork();
      const items = await OfflineStorage.getSyncItemsByUser(currentUser.id, { strict: true });
      if (!sameSyncSession(currentUser.id, epoch)) return noSyncWork();
      const currentTime = Date.now();

      // Recover a browser/process interruption only after the stale send window.
      // Web Locks/lease protection has already been acquired for this account.
      for (const item of items) {
        if (!sameSyncSession(currentUser.id, epoch) || isSyncCancelled) break;
        if (item.status === 'SENDING' && currentTime - new Date(item.updatedAt || item.createdAt).getTime() > 120000) {
          item.status = 'PENDING_NETWORK'; item.nextRetryAt = undefined;
          await OfflineStorage.updateSyncItem(item);
        }
      }
      // Only pick items in PENDING_NETWORK whose backoff window has passed
      const eligibleItems = items.filter(
        (i) => i.status === 'PENDING_NETWORK' && (!i.nextRetryAt || i.nextRetryAt <= currentTime)
      );

      for (const item of eligibleItems) {
        if (isSyncCancelled || !sameSyncSession(currentUser.id, epoch)) {
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

          await OfflineStorage.removeSyncItem(item.operationId, { allowSending: true, userId: currentUser.id });
          succeeded++;
          lastSuccessfulSyncAt = new Date().toISOString();
        } catch (err: any) {
          if (isSyncCancelled || !sameSyncSession(currentUser.id, epoch)) {
            // Logout is not a failed delivery attempt. Keep the original work
            // for its owner without consuming retries or requiring manual repair.
            item.status = 'PENDING_NETWORK';
            item.updatedAt = new Date().toISOString();
            await OfflineStorage.updateSyncItem(item);
            break;
          }
          failed++;
          console.error(`[SYNC_QUEUE] Error syncing item ${item.operationId}:`, err);

          const errorMessage = err?.message || String(err);
          const networkFailure = /unavailable|deadline-exceeded|network|Failed to fetch|offline|koneksi|terhubung|timeout|timed out/i.test(`${err?.code || ''} ${errorMessage}`);
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
            if (item.retryCount >= 5 && !networkFailure) {
              item.status = 'NEEDS_ACTION';
              item.lastError = `Batas maksimal 5 kali percobaan tercapai: ${errorMessage}`;
            } else {
              item.status = 'PENDING_NETWORK';
              item.lastError = errorMessage;
              const backoffMs = Math.min(3000 * Math.pow(2, Math.min(item.retryCount, 8)), 60000) + Math.random() * 3000;
              item.nextRetryAt = Date.now() + backoffMs;
            }
          }
          item.updatedAt = new Date().toISOString();
          await OfflineStorage.updateSyncItem(item);
        }
      }
    } finally {
      isSyncInProgress = false;
      if (sameSyncSession(currentUser.id, epoch)) await this.refreshStatus(currentUser.id).catch(error => console.warn('[SYNC_QUEUE] Status akan diperbarui setelah penyimpanan pulih:', error));
    }

    return { processed, succeeded, failed };
  }

  /**
   * Verify user has active permission/role to execute this operation
   */
  private static validateUserAuthority(item: QueueItem, user: UserProfile): string | null {
    if (item.userId !== user.id || item.projectId !== OfflineStorage.getProjectId()) {
      return 'Data antrean berasal dari akun atau proyek berbeda. Sinkronisasi dihentikan.';
    }
    if (user.isActive === false) {
      return 'Akun dinonaktifkan oleh Administrator. Sinkronisasi dihentikan.';
    }

    if (!['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(user.role)) {
      return 'Role akun tidak dikenali. Hubungi administrator.';
    }
    const can = (permission: PermissionKey) => user.role === 'ADMIN' || checkUserPermission(user.permissions, permission);
    // The four additional menu flags are the application's existing grants for
    // these operational forms. Do not invent a GURU_PIKET role or restore revoked grants.
    const allowed = (() => {
      switch (item.operationType) {
        case 'ATTENDANCE_CHECKIN': return can(PERMISSIONS.ATTENDANCE_CREATE) && item.payload?.userId === user.id;
        case 'INCIDENT_REPORT': return can(PERMISSIONS.INCIDENT_CREATE);
        case 'TARDY_REPORT': return can(PERMISSIONS.STUDENT_TARDY_CREATE) || can(PERMISSIONS.STUDENT_TARDY_VIEW);
        case 'PERMIT_REPORT': return can(item.payload?.isUpdate ? PERMISSIONS.STUDENT_PERMITS_RETURN : PERMISSIONS.STUDENT_PERMITS_CREATE) || can(PERMISSIONS.STUDENT_PERMITS_VIEW);
        case 'VISITOR_REPORT': return can(item.payload?.isUpdate ? PERMISSIONS.VISITORS_CHECKOUT : PERMISSIONS.VISITORS_CREATE) || can(PERMISSIONS.VISITORS_VIEW);
        case 'SUBSTITUTION_REPORT': return can(item.payload?.isUpdate ? PERMISSIONS.SUBSTITUTIONS_UPDATE : PERMISSIONS.SUBSTITUTIONS_CREATE) || can(PERMISSIONS.SUBSTITUTIONS_VIEW);
        case 'DUTYBOOK_SUBMIT': return can(PERMISSIONS.DUTYBOOK_CREATE) || can(PERMISSIONS.DUTYBOOK_UPDATE);
        // No production form queues unrestricted collection writes.
        default: return false;
      }
    })();
    return allowed ? null : 'Hak akses operasi tidak tersedia atau telah dicabut. Data tetap tersimpan; hubungi administrator.';
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
      // Keep existing Drive references, photo IDs, captions and capture times.
      // Attachment conversion must not replace the entire photo list.
      const originals = Array.isArray(item.payload.photos) ? item.payload.photos : [];
      const incidentPhotos = originals.length > 0
        ? originals.map((photo: any, index: number) => {
            const key = photo.url?.startsWith('attachment:')
              ? photo.url.slice('attachment:'.length) : `photo_${index}`;
            const converted = item.uploadedAttachmentUrls?.[key];
            return converted && !photo.url?.startsWith('/api/drive/photo/') && !photo.url?.startsWith('http')
              ? { ...photo, url: converted } : photo;
          })
        : Object.entries(item.uploadedAttachmentUrls).map(([key, url]) => ({
            id: key, url, uploadedAt: item.createdAt,
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
        const { AttendanceService } = await import('../firebase/attendanceService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        await AttendanceService.checkIn(item.payload);
        break;
      }

      case 'DUTYBOOK_SUBMIT': {
        const { DutyBookService } = await import('../firebase/dutyBookService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        const { record, isSubmitOnly, originalUpdatedAt } = item.payload;
        if (isSubmitOnly) {
          await DutyBookService.submitJournal(record, user, originalUpdatedAt);
        } else {
          await DutyBookService.saveDraft(record, user, originalUpdatedAt);
        }
        break;
      }

      case 'INCIDENT_REPORT': {
        const { IncidentService } = await import('../firebase/incidentService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        await IncidentService.saveIncident(item.payload, user);
        break;
      }

      case 'TARDY_REPORT': {
        const { StudentTardyService } = await import('../firebase/studentTardyService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        await StudentTardyService.saveTardyStudent(item.payload, user);
        break;
      }

      case 'PERMIT_REPORT': {
        const { StudentPermitService } = await import('../firebase/studentPermitService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await StudentPermitService.updatePermit(record, user);
        } else {
          await StudentPermitService.createPermit(record, user);
        }
        break;
      }

      case 'VISITOR_REPORT': {
        const { VisitorService } = await import('../firebase/visitorService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await VisitorService.updateVisitor(record, user);
        } else {
          await VisitorService.registerVisitor(record, user);
        }
        break;
      }

      case 'SUBSTITUTION_REPORT': {
        const { SubstitutionService } = await import('../firebase/substitutionService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        const { record, isUpdate } = item.payload;
        if (isUpdate) {
          await SubstitutionService.updateSubstitution(record, user);
        } else {
          await SubstitutionService.createSubstitution(record, user);
        }
        break;
      }

      case 'GENERIC_SET': {
        const { FirestoreService } = await import('../firebase/firestoreService');
        if (isSyncCancelled || auth.currentUser?.uid !== user.id) throw new Error('Sesi sinkronisasi berubah. Coba kembali dengan akun pemilik data.');
        await FirestoreService.setDocument(item.collectionName, item.recordId, item.payload);
        break;
      }

      default:
        throw new Error(`Tipe operasi antrean tidak dikenal: ${(item as any).operationType}`);
    }
  }
}
