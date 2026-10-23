/**
 * R47 — Update PWA tanpa mengganti data/sesi pengguna.
 * Registrasi SW dari index.html. Hanya tampilkan banner untuk worker yang
 * benar-benar waiting; pengecekan diperbarui saat tab kembali aktif.
 */
export interface UpdateManagerListener {
  (hasUpdate: boolean, applyUpdate: () => Promise<void>): void;
}

const listeners = new Set<UpdateManagerListener>();
let isUpdateAvailable = false;
let waitingWorker: ServiceWorker | null = null;
let updateApproved = false;
let lastUpdateCheck = 0;
let applyInProgress = false;
let refreshing = false;

const UPDATE_CHECK_INTERVAL_MS = 60_000;
const ACTIVATE_TIMEOUT_MS = 12_000;

export class AppUpdateManager {
  private static initialized = false;

  public static init(): void {
    if (this.initialized || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    this.initialized = true;

    navigator.serviceWorker.ready.then((registration) => {
      this.observeRegistration(registration);
      void this.checkForUpdates(true);
    }).catch((error) => {
      console.warn('[UPDATE_MGR] Service worker not ready:', error);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateApproved && !refreshing) {
        refreshing = true;
        this.reloadFresh();
      }
    });

    window.addEventListener('focus', () => { void this.checkForUpdates(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.checkForUpdates();
    });
    window.addEventListener('online', () => { void this.checkForUpdates(true); });
  }

  private static observeRegistration(registration: ServiceWorkerRegistration): void {
    if (registration.waiting && navigator.serviceWorker.controller) {
      this.setUpdateAvailable(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.setUpdateAvailable(newWorker);
        }
      });
    });
  }

  public static async checkForUpdates(force = false): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.onLine) return;
    const now = Date.now();
    if (!force && now - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastUpdateCheck = now;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      if (registration.waiting && navigator.serviceWorker.controller) {
        this.setUpdateAvailable(registration.waiting);
      }
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        this.setUpdateAvailable(registration.waiting);
      }
    } catch (error) {
      // Background check should never interrupt forms or force a refresh.
      console.warn('[UPDATE_MGR] Could not check updates:', error);
    }
  }

  private static setUpdateAvailable(worker: ServiceWorker): void {
    if (worker.state === 'redundant') return;
    waitingWorker = worker;
    isUpdateAvailable = true;
    this.notify();
  }

  public static subscribe(listener: UpdateManagerListener): () => void {
    listeners.add(listener);
    listener(isUpdateAvailable, () => this.applyUpdate());
    return () => { listeners.delete(listener); };
  }

  private static notify(): void {
    for (const callback of listeners) {
      try { callback(isUpdateAvailable, () => this.applyUpdate()); }
      catch (error) { console.warn('[UPDATE_MGR] Listener failed:', error); }
    }
  }

  private static reloadFresh(): void {
    // Change query string to prevent stale browser navigation caches.
    // Keep pathname, other query parameters and SPA hash intact.
    const url = new URL(window.location.href);
    url.searchParams.set('_pg_update', String(Date.now()));
    window.location.replace(url.toString());
  }

  public static async applyUpdate(): Promise<void> {
    if (applyInProgress) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }
    if (!navigator.onLine) {
      throw new Error('Tidak ada koneksi internet. Coba lagi saat online.');
    }

    applyInProgress = true;
    try {
      // Always ask the registration: waitingWorker may be stale.
      const registration = await navigator.serviceWorker.getRegistration();
      let worker = registration?.waiting;
      if (!worker) {
        await registration?.update();
        worker = registration?.waiting;
      }
      if (!worker || worker.state === 'redundant') {
        // A newly active worker may already be installed. The button must
        // still respond and fetch the latest HTML through network-first routing.
        updateApproved = true;
        this.reloadFresh();
        return;
      }

      updateApproved = true;
      const activeWorker = worker;
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        let timeoutId: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          clearTimeout(timeoutId);
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          activeWorker.removeEventListener('statechange', onWorkerStateChange);
        };
        const complete = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve();
          if (!refreshing) {
            refreshing = true;
            AppUpdateManager.reloadFresh();
          }
        };
        const onControllerChange = () => complete();
        const onWorkerStateChange = () => {
          if (activeWorker.state === 'activated') complete();
          if (activeWorker.state === 'redundant' && !finished) {
            finished = true;
            cleanup();
            reject(new Error('Versi update berubah. Coba tombol Perbarui sekali lagi.'));
          }
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        activeWorker.addEventListener('statechange', onWorkerStateChange);
        timeoutId = setTimeout(() => {
          if (registration?.active === activeWorker || activeWorker.state === 'activated') {
            complete();
          } else if (!finished) {
            finished = true;
            cleanup();
            reject(new Error('Pembaruan belum berhasil diaktifkan. Periksa koneksi lalu coba lagi.'));
          }
        }, ACTIVATE_TIMEOUT_MS);
        try { activeWorker.postMessage({ type: 'SKIP_WAITING' }); }
        catch (error) {
          finished = true;
          cleanup();
          reject(error);
        }
      });
    } catch (error) {
      updateApproved = false;
      throw error;
    } finally {
      applyInProgress = false;
    }
  }

  public static get hasUpdate(): boolean { return isUpdateAvailable; }
}
