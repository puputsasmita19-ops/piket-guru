/**
 * Piket Guru - non-interruptive PWA update notification.
 *
 * The app banner appears only when a NEW service worker has finished installing
 * and is waiting behind the currently active controller. A new Vercel build
 * stamps dist/sw.js with a unique release ID (scripts/stamp_pwa_release.mjs).
 */

export interface UpdateManagerListener {
  (hasUpdate: boolean, applyUpdate: () => void): void;
}

const listeners = new Set<UpdateManagerListener>();
let isUpdateAvailable = false;
let waitingWorker: ServiceWorker | null = null;
let updateApproved = false;

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export class AppUpdateManager {
  private static initialized = false;
  private static watchedRegistration: ServiceWorkerRegistration | null = null;
  private static watchedInstallingWorkers = new WeakSet<ServiceWorker>();

  public static init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    this.initialized = true;

    // A new worker can already be waiting on refresh, or can finish installing
    // later while a user keeps the dashboard open. Observe both situations.
    void navigator.serviceWorker.ready.then((registration) => {
      this.watchRegistration(registration);
      void this.checkForUpdates();
    }).catch(() => {});

    // In particular, watch existing registrations before `ready` resolves.
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) this.watchRegistration(registration);
    }).catch(() => {});

    // PWA updates are not checked just once at startup: users can leave the
    // dashboard open while a new GitHub -> Vercel deployment finishes.
    const checkIfVisible = () => {
      if (document.visibilityState !== 'hidden') void this.checkForUpdates();
    };
    window.addEventListener('focus', checkIfVisible);
    window.addEventListener('online', checkIfVisible);
    document.addEventListener('visibilitychange', checkIfVisible);
    window.setInterval(checkIfVisible, UPDATE_CHECK_INTERVAL_MS);

    // Only reload after the user explicitly chooses "Perbarui Sekarang".
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateApproved && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  private static watchInstalling(worker: ServiceWorker | null): void {
    if (!worker || this.watchedInstallingWorkers.has(worker)) return;
    this.watchedInstallingWorkers.add(worker);

    const onStateChange = () => {
      // `installed` on first ever PWA visit is NOT an app update.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        this.setUpdateAvailable(worker);
      }
    };
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  }

  private static watchRegistration(registration: ServiceWorkerRegistration): void {
    if (this.watchedRegistration !== registration) {
      this.watchedRegistration = registration;
      registration.addEventListener('updatefound', () => {
        this.watchInstalling(registration.installing);
      });
    }

    this.watchInstalling(registration.installing);
    if (registration.waiting && navigator.serviceWorker.controller) {
      this.setUpdateAvailable(registration.waiting);
    }
  }

  private static async checkForUpdates(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const registration = this.watchedRegistration ?? await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      this.watchRegistration(registration);
      await registration.update();
      // Recheck waiting if another tab/update installed the worker just now.
      if (registration.waiting && navigator.serviceWorker.controller) {
        this.setUpdateAvailable(registration.waiting);
      }
    } catch {
      // Offline / transient Vercel network errors should not block using Piket Guru.
    }
  }

  private static setUpdateAvailable(worker: ServiceWorker): void {
    if (waitingWorker === worker && isUpdateAvailable) return;
    waitingWorker = worker;
    isUpdateAvailable = true;
    this.notify();
  }

  public static subscribe(listener: UpdateManagerListener): () => void {
    listeners.add(listener);
    if (isUpdateAvailable) listener(true, () => this.applyUpdate());
    return () => listeners.delete(listener);
  }

  private static notify(): void {
    listeners.forEach((listener) => {
      try {
        listener(isUpdateAvailable, () => this.applyUpdate());
      } catch (error) {
        console.warn('[UPDATE_MGR] Listener error:', error);
      }
    });
  }

  public static applyUpdate(): void {
    if (waitingWorker) {
      updateApproved = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // No waiting worker: a normal refresh should pick up the current build.
      window.location.reload();
    }
  }

  public static get hasUpdate(): boolean {
    return isUpdateAvailable;
  }
}
