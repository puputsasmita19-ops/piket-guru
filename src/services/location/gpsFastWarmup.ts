import { LocationService } from './locationService';

/**
 * One-shot location warm-up for authenticated navigation. It never prompts for
 * location access: the Attendance screen remains the only place that may ask.
 * This only primes a timestamped, <=50m browser fix; no school/geofence check
 * or attendance authorization happens until official settings are available.
 */
let warmupFlight: Promise<void> | null = null;
let lastWarmupAttemptAt = 0;
const RECENT_FIX_MS = 12_000;
const RETRY_GUARD_MS = 20_000;

export function prewarmAttendanceGpsIfGranted(): Promise<void> {
  if (warmupFlight) return warmupFlight;
  if (typeof navigator === 'undefined' || typeof document === 'undefined' ||
      document.visibilityState === 'hidden' || !navigator.geolocation || !navigator.permissions?.query ||
      (typeof window !== 'undefined' && window.isSecureContext === false)) return Promise.resolve();

  // Coalesce dashboard mount, navigation click and StrictMode remount.
  if (Date.now() - lastWarmupAttemptAt < RETRY_GUARD_MS) return Promise.resolve();

  const task = async () => {
    let permission: PermissionStatus;
    try {
      permission = await navigator.permissions.query({ name: 'geolocation' });
    } catch {
      // Browser does not expose permission status. Never trigger a prompt here.
      return;
    }
    if (permission.state !== 'granted' || document.visibilityState === 'hidden') return;
    if (Date.now() - lastWarmupAttemptAt < RETRY_GUARD_MS) return;
    const latest = LocationService.lastValidPosition;
    if (LocationService.isFreshPosition(latest, RECENT_FIX_MS) &&
        latest!.accuracy <= LocationService.MAX_ATTENDANCE_ACCURACY_METERS) return;

    lastWarmupAttemptAt = Date.now();
    try {
      await LocationService.getCurrentPosition({
        timeoutMs: 6_500,
        maxStaleAgeMs: RECENT_FIX_MS,
        desiredAccuracyMeters: LocationService.MAX_ATTENDANCE_ACCURACY_METERS,
      });
    } catch {
      // Warm-up is best effort; the attendance page shows any real GPS errors.
    }
  };
  warmupFlight = task().finally(() => { warmupFlight = null; });
  return warmupFlight;
}
