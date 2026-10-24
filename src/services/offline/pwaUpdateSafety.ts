/**
 * R57 — Gate a user-requested PWA reload on *durable* offline state.
 * A browser refresh never guarantees that in-memory drafts/attachments survive.
 * No bulk cache, localStorage or IndexedDB deletion occurs here.
 */
import { auth } from '../firebase/firebaseAuth';
import { DraftService } from './draftService';
import { OfflineStorage } from './offlineStorage';

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
export async function ensurePwaUpdateSafe(): Promise<void> {
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

    // The IndexedDB queue/drafts belong to the current account, and are not
    // deleted by appUpdateManager. Still require an explicit informed choice.
    if (typeof window === 'undefined' || !window.confirm(
      `Masih ada ${counts.syncQueueCount} kiriman dan ${counts.draftsCount} draf lokal. `
      + 'Data di perangkat tepercaya tersimpan, tetapi belum semuanya diterima server. '
      + 'Perbarui aplikasi sekarang?',
    )) {
      throw new Error('Pembaruan ditunda. Selesaikan antrean melalui ikon sinkronisasi.');
    }
  } catch (error) {
    // Preserve concrete validation/blocking messages; storage errors fail safe.
    if (error instanceof Error && /^(Akun berubah|Sedang mengirim|\d+ data\/draf|Pembaruan ditunda)/.test(error.message)) {
      throw error;
    }
    throw new Error('Penyimpanan draf/antrean belum dapat diverifikasi. Jangan perbarui sebelum data aman.');
  }
}
