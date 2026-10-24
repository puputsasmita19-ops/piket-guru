/**
 * R57 — Gate a user-requested PWA reload on *durable* offline state.
 * A browser refresh never guarantees that in-memory drafts/attachments survive.
 * No bulk cache, localStorage or IndexedDB deletion occurs here.
 */
import { auth } from '../firebase/firebaseAuth';
import { DraftService } from './draftService';
import { OfflineStorage } from './offlineStorage';

export interface PwaPendingSummary {
  syncQueueCount: number;
  draftsCount: number;
}

/** User intentionally postponed the update; this is not an application error. */
export class PwaUpdateCancelledError extends Error {
  constructor() { super('Pembaruan ditunda. Data Anda tetap tersimpan di perangkat.'); this.name = 'PwaUpdateCancelledError'; }
}

/** Injected by a React dialog; never use browser confirm or silently allow missing consent. */
export type PwaUpdateConfirm = (summary: PwaPendingSummary) => Promise<boolean>;

function hasActiveEditor(): boolean {
  if (typeof document === 'undefined') return false;
  // Refuse to interrupt an open form/modal. A missing autosave is otherwise
  // impossible to recover from after a navigation.
  const nodes = document.querySelectorAll<HTMLElement>(
    '[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, '
    + '[aria-modal="true"] input, [aria-modal="true"] textarea, '
    + '[data-pwa-update-block="true"]',
  );
  return Array.from(nodes).some(node => node.getClientRects().length > 0);
}

/** Throws a user-facing message if an update would risk losing work. */
export async function ensurePwaUpdateSafe(confirmPending?: PwaUpdateConfirm): Promise<void> {
  if (hasActiveEditor()) {
    throw new Error('Tutup atau simpan formulir yang sedang dibuka sebelum memperbarui aplikasi.');
  }
  const uid = auth.currentUser?.uid;
  if (!uid) return; // Login screen; there is no account-owned offline queue.

  // Wait for debounced draft saves before allowing the page to navigate away.
  // Fail closed on storage errors: unknown cannot be interpreted as empty.
  try {
    await DraftService.flushPending(uid);
    if (auth.currentUser?.uid !== uid) {
      throw new Error('Akun berubah. Masuk kembali sebelum memperbarui aplikasi.');
    }
    const [counts, items] = await Promise.all([
      OfflineStorage.getPendingCount(uid),
      OfflineStorage.getSyncItemsByUser(uid, { strict: true }),
    ]);
    if (auth.currentUser?.uid !== uid) {
      throw new Error('Akun berubah. Masuk kembali sebelum memperbarui aplikasi.');
    }
    if (items.some(item => item.status === 'SENDING')) {
      throw new Error('Sedang mengirim data. Tunggu sinkronisasi selesai sebelum memperbarui.');
    }
    if (!counts.total) return;

    if (!OfflineStorage.isTrustedDevice()) {
      throw new Error(`${counts.total} data/draf belum selesai. Perangkat bersama tidak menyimpan antrean secara permanen. Kirim atau selesaikan data dahulu.`);
    }

    // Trusted storage survives reload, but an explicit informed decision is
    // still required. Absence of a dialog callback MUST fail closed.
    if (!confirmPending) throw new Error('Konfirmasi update tidak tersedia. Coba lagi.');
    const approved = await confirmPending({
      syncQueueCount: counts.syncQueueCount,
      draftsCount: counts.draftsCount,
    });
    if (!approved) throw new PwaUpdateCancelledError();

    // A different tab may enqueue data or change accounts while the dialog is
    // open. Revalidate *after* consent before calling SKIP_WAITING.
    if (hasActiveEditor()) throw new Error('Tutup atau simpan formulir yang sedang dibuka sebelum memperbarui aplikasi.');
    if (auth.currentUser?.uid !== uid) throw new Error('Akun berubah. Masuk kembali sebelum memperbarui aplikasi.');
    await DraftService.flushPending(uid);
    const [latestCounts, latestItems] = await Promise.all([
      OfflineStorage.getPendingCount(uid),
      OfflineStorage.getSyncItemsByUser(uid, { strict: true }),
    ]);
    if (auth.currentUser?.uid !== uid) throw new Error('Akun berubah. Masuk kembali sebelum memperbarui aplikasi.');
    if (latestItems.some(item => item.status === 'SENDING')) {
      throw new Error('Sedang mengirim data. Tunggu sinkronisasi selesai sebelum memperbarui.');
    }
    if (!OfflineStorage.isTrustedDevice()) {
      throw new Error('Perangkat bukan lagi perangkat tepercaya. Selesaikan data terlebih dahulu.');
    }
    if (latestCounts.syncQueueCount !== counts.syncQueueCount || latestCounts.draftsCount !== counts.draftsCount) {
      throw new Error('Jumlah data lokal berubah. Periksa antrean, lalu coba perbarui lagi.');
    }
    const queueIds = (entries: typeof items) => entries.map(entry => entry.operationId).sort().join('|');
    if (queueIds(latestItems) !== queueIds(items)) {
      throw new Error('Antrean lokal berubah. Periksa kiriman, lalu coba perbarui lagi.');
    }
  } catch (error) {
    if (error instanceof PwaUpdateCancelledError) throw error;
    // Blocking/validation messages are actionable; unexpected storage failures
    // are reported as unknown and MUST NOT be interpreted as an empty queue.
    if (error instanceof Error && /^(Akun berubah|Sedang mengirim|\d+ data\/draf|Tutup atau simpan|Konfirmasi update|Perangkat bukan|Jumlah data lokal|Antrean lokal)/.test(error.message)) {
      throw error;
    }
    throw new Error('Penyimpanan draf/antrean belum dapat diverifikasi. Jangan perbarui sebelum data aman.');
  }
}
