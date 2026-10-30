/** R104-C: mobile PWA foreground GPS refresh policy (no network/side effects). */
export const GPS_FOREGROUND_REUSE_MS = 8_000;
export const GPS_FOREGROUND_DEDUPE_MS = 1_500;

export interface GpsForegroundSnapshot {
  now: number;
  lastAttemptAt: number;
  visible: boolean;
  activeTab: 'presensi' | 'riwayat';
  settingsReady: boolean;
  validSchoolLocation: boolean;
  locating: boolean;
  busy: boolean;
  position: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
}

/**
 * Resume only if the visible Presensi screen needs another fix. A fix is
 * reusable for a short period (<8s), but is never a substitute for shutter/
 * submission-time GPS revalidation. The 1.5s guard coalesces overlapping
 * `focus` + `pageshow` + `visibilitychange` events from Android browsers.
 */
export function shouldRefreshGpsOnForeground(state: GpsForegroundSnapshot): boolean {
  if (!state.visible || state.activeTab !== 'presensi' ||
      !state.settingsReady || !state.validSchoolLocation ||
      state.locating || state.busy || !Number.isFinite(state.now)) return false;
  if (state.lastAttemptAt > 0 && state.now - state.lastAttemptAt >= 0 &&
      state.now - state.lastAttemptAt < GPS_FOREGROUND_DEDUPE_MS) return false;
  const reading = state.position;
  if (!reading) return true;
  const age = state.now - reading.timestamp;
  const valid = Number.isFinite(reading.latitude) && Math.abs(reading.latitude) <= 90 &&
    Number.isFinite(reading.longitude) && Math.abs(reading.longitude) <= 180 &&
    Number.isFinite(reading.accuracy) && reading.accuracy > 0 && reading.accuracy <= 50 &&
    Number.isFinite(reading.timestamp) && age >= -5_000 && age <= GPS_FOREGROUND_REUSE_MS;
  return !valid;
}
