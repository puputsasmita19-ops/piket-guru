/** R60 browser diagnostics: local aggregated counters only; no data leaves device. */
export type R60ClientCode = 'JS_ERROR' | 'UNHANDLED_REJECTION' | 'RESOURCE_LOAD'
  | 'NETWORK_OFFLINE' | 'NETWORK_ONLINE' | 'SLOW_LCP' | 'HIGH_CLS';

const counters: Partial<Record<R60ClientCode, number>> = {};
const MAX_EVENTS = 50;
let total = 0;
let installed = false;
let lcp = 0;
let cls = 0;
let clsWindow = 0;
let clsWindowStart = 0;
let clsLastShift = 0;

function record(code: R60ClientCode): void {
  if (total >= MAX_EVENTS) return;
  counters[code] = (counters[code] || 0) + 1;
  total++;
}

/** Returns no names, error strings, GPS, URLs, stack traces, user IDs or form data. */
export function r60ClientSnapshot(): Readonly<{
  schema: string; counters: Readonly<Partial<Record<R60ClientCode, number>>>;
}> {
  return { schema: 'R60_CLIENT_V1', counters: { ...counters } };
}

export function installR60BrowserDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event: Event) => {
    // Error event may arise from a script or from an image/link load failure.
    // Do not inspect event.message, filename, target.src or the exception.
    if (event.defaultPrevented) return; // Firebase SDK suppressed false positives.
    record(event instanceof ErrorEvent ? 'JS_ERROR' : 'RESOURCE_LOAD');
  }, { capture: true });
  window.addEventListener('unhandledrejection', event => {
    if (!event.defaultPrevented) record('UNHANDLED_REJECTION');
  });
  window.addEventListener('offline', () => record('NETWORK_OFFLINE'));
  window.addEventListener('online', () => record('NETWORK_ONLINE'));

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    } catch { /* Older browser: unsupported Web Vital is skipped. */ }
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          // Exclude layout shifts following recent user input when supported.
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (shift.hadRecentInput) continue;
          // Real CLS session windows: gap <= 1s and maximum duration <= 5s.
          if (entry.startTime - clsLastShift > 1000 || entry.startTime - clsWindowStart > 5000) {
            clsWindow = shift.value || 0;
            clsWindowStart = entry.startTime;
          } else {
            clsWindow += shift.value || 0;
          }
          clsLastShift = entry.startTime;
          cls = Math.max(cls, clsWindow);
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    } catch { /* Older browser: unsupported Web Vital is skipped. */ }
  }

  window.addEventListener('pagehide', () => {
    if (lcp > 2500) record('SLOW_LCP');
    if (cls > 0.1) record('HIGH_CLS');
    if (total > 0) {
      // A debugging aid on the device only. No Firestore or API writes.
      console.info('[R60_CLIENT]', JSON.stringify(r60ClientSnapshot()));
    }
  });
}
