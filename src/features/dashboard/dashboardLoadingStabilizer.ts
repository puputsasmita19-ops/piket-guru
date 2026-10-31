/** R113-B2 — stage non-critical, date-scoped dashboard observers after the first
 * paint opportunity. Does not cache records or change Firestore queries/rules.
 * Cancels both pending setup and active listeners on route/account teardown. */
export interface DashboardWorkScheduler {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export const DASHBOARD_SECONDARY_IDLE_TIMEOUT_MS = 300;

export function stageDashboardSecondaryListeners(
  start: () => Array<() => void>,
  scheduler: DashboardWorkScheduler,
): () => void {
  let cancelled = false;
  let stops: Array<() => void> = [];
  let frame: number | null = null;
  let idle: number | null = null;
  let timer: number | null = null;
  const activate = () => {
    if (cancelled) return;
    idle = null;
    timer = null;
    // Keep one live observer per source; never resubscribe on a re-render.
    stops = start();
    if (cancelled) { stops.forEach(stop => stop()); stops = []; }
  };
  frame = scheduler.requestAnimationFrame(() => {
    frame = null;
    if (cancelled) return;
    if (typeof scheduler.requestIdleCallback === 'function') {
      idle = scheduler.requestIdleCallback(activate, { timeout: DASHBOARD_SECONDARY_IDLE_TIMEOUT_MS });
    } else {
      // Fallback for browsers without requestIdleCallback, after paint.
      timer = scheduler.setTimeout(activate, 0);
    }
  });
  return () => {
    if (cancelled) return;
    cancelled = true;
    if (frame !== null) scheduler.cancelAnimationFrame(frame);
    if (idle !== null) scheduler.cancelIdleCallback?.(idle);
    if (timer !== null) scheduler.clearTimeout(timer);
    stops.forEach(stop => stop());
    stops = [];
  };
}
