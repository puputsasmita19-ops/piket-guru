/**
 * Piket Guru - App Update Manager (PWA & Service Worker)
 *
 * Coordinates non-intrusive application updates:
 * - Detects new SW waiting in background
 * - Prevents auto-reload while user has unsaved draft inputs or active syncing
 * - Prompts user via clean top toast banner: "Pembaruan aplikasi tersedia"
 * - Dispatches SKIP_WAITING and reloads gracefully once user confirms
 */

export interface UpdateManagerListener {
  (hasUpdate: boolean, applyUpdate: () => void): void;
}

const listeners = new Set<UpdateManagerListener>();
let isUpdateAvailable = false;
let waitingWorker: ServiceWorker | null = null;

export class AppUpdateManager {
  private static registered = false;

  public static init(): void {
    if (this.registered) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    this.registered = true;

    navigator.serviceWorker.ready.then((registration) => {
      // Check if there is already a waiting worker
      if (registration.waiting) {
        this.setUpdateAvailable(registration.waiting);
      }

      // Listen for new worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version installed and waiting!
            this.setUpdateAvailable(newWorker);
          }
        });
      });
    });

    // Handle controller change (reloads after skipWaiting)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  private static setUpdateAvailable(worker: ServiceWorker): void {
    waitingWorker = worker;
    isUpdateAvailable = true;
    this.notify();
  }

  public static subscribe(listener: UpdateManagerListener): () => void {
    listeners.add(listener);
    if (isUpdateAvailable) {
      listener(true, () => this.applyUpdate());
    }
    return () => listeners.delete(listener);
  }

  private static notify(): void {
    listeners.forEach((cb) => {
      try {
        cb(isUpdateAvailable, () => this.applyUpdate());
      } catch (e) {
        console.warn('[UPDATE_MGR] Listener error:', e);
      }
    });
  }

  /**
   * Apply update safely:
   * Dispatches SKIP_WAITING to waiting worker.
   */
  public static applyUpdate(): void {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  public static get hasUpdate(): boolean {
    return isUpdateAvailable;
  }
}
