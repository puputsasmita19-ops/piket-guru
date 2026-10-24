/**
 * R53 — Perbarui PWA dengan respons klik langsung.
 *
 * Prioritaskan worker yang SUDAH menunggu: mengirim SKIP_WAITING tidak perlu
 * menunggu pemeriksaan jaringan kedua. Jangan otomatis reload selain saat
 * pengguna secara eksplisit menekan tombol Perbarui.
 */
export interface UpdateManagerListener {
  (hasUpdate: boolean, applyUpdate: () => Promise<void>): void;
}

export type UpdateStage = 'checking' | 'activating' | 'reloading';
export type UpdateProgressCallback = (stage: UpdateStage) => void;

const listeners = new Set<UpdateManagerListener>();
let isUpdateAvailable = false;
let waitingWorker: ServiceWorker | null = null;
let updateApproved = false;
let lastUpdateCheck = 0;
let applyInProgress = false;
let refreshing = false;

const UPDATE_CHECK_INTERVAL_MS = 60_000;
const ACTIVATE_TIMEOUT_MS = 10_000;
const REGISTRATION_TIMEOUT_MS = 1_200;

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
      // Pemeriksaan jaringan dilakukan DI LATAR BELAKANG, bukan di tombol update.
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        this.setUpdateAvailable(registration.waiting);
      }
    } catch (error) {
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
    // Cache-busting navigation; preserve route hash and other query params.
    const url = new URL(window.location.href);
    url.searchParams.set('_pg_update', String(Date.now()));
    window.location.replace(url.toString());
  }

  private static async registrationWithDeadline(): Promise<ServiceWorkerRegistration | undefined> {
    // Browser dengan SW lambat tidak boleh menahan tombol selama belasan detik.
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(undefined); }
      }, REGISTRATION_TIMEOUT_MS);
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(registration);
      }).catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(undefined);
      });
    });
  }

  public static async applyUpdate(onProgress?: UpdateProgressCallback): Promise<void> {
    if (applyInProgress) return;
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator)) {
      onProgress?.('reloading');
      window.location.reload();
      return;
    }
    if (!navigator.onLine) {
      throw new Error('Tidak terhubung internet. Coba lagi saat online.');
    }

    applyInProgress = true;
    updateApproved = false;
    try {
      // Respons tercepat: worker waiting sudah disimpan ketika banner muncul.
      // Tidak memanggil registration.update() di jalur klik ini.
      let worker = waitingWorker?.state === 'installed' ? waitingWorker : null;
      if (!worker) {
        onProgress?.('checking');
        const registration = await this.registrationWithDeadline();
        worker = registration?.waiting?.state === 'installed' ? registration.waiting : null;
      }

      if (!worker) {
        // Worker bisa sudah aktif di tab lain. Memuat shell melalui network-first.
        updateApproved = true;
        refreshing = true;
        onProgress?.('reloading');
        this.reloadFresh();
        return;
      }

      onProgress?.('activating');
      const activeWorker = worker;
      updateApproved = true;
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
          onProgress?.('reloading');
          resolve();
          if (!refreshing) {
            refreshing = true;
            AppUpdateManager.reloadFresh();
          }
        };
        const fail = (message: string) => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(new Error(message));
        };
        const onControllerChange = () => complete();
        const onWorkerStateChange = () => {
          if (activeWorker.state === 'activated') complete();
          if (activeWorker.state === 'redundant') {
            waitingWorker = null;
            fail('Versi berubah. Coba Perbarui lagi.');
          }
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        activeWorker.addEventListener('statechange', onWorkerStateChange);
        timeoutId = setTimeout(() => {
          // A SW may activate without controllerchange, e.g. during tab races.
          if (activeWorker.state === 'activated') complete();
          else fail('Update belum aktif. Coba lagi atau muat ulang halaman.');
        }, ACTIVATE_TIMEOUT_MS);
        try { activeWorker.postMessage({ type: 'SKIP_WAITING' }); }
        catch { fail('Gagal mengaktifkan update. Silakan coba lagi.'); }
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
