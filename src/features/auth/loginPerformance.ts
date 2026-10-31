/** R101 — privacy-safe client login timing markers (no PIN, UID, token, or profile). */
export type LoginPhase = 'pin-api' | 'firebase-signin' | 'pin-end-to-end';

export function loginClockNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** View in DevTools: performance.getEntriesByType('measure').filter(x => x.name.startsWith('piket-login-')). */
export function recordLoginDuration(phase: LoginPhase, started: number): number {
  const elapsed = Math.max(0, loginClockNow() - started);
  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(`piket-login-${phase}`, { start: started, end: loginClockNow() });
      if (phase === 'pin-end-to-end') {
        const latest = (name: string): number | null => {
          const entries = performance.getEntriesByName(`piket-login-${name}`, 'measure')
            .filter(entry => entry.startTime >= started);
          return entries.length ? Math.round(entries[entries.length - 1].duration) : null;
        };
        // Only numeric phase durations; never print any account/credential identifiers.
        console.info('[PIKET LOGIN PERFORMANCE] Mobile (ms):', {
          total: Math.round(elapsed),
          pinApi: latest('pin-api'),
          firebaseSignIn: latest('firebase-signin'),
        });
      }
    } catch { /* Browser may not support numeric measure bounds. */ }
  }
  return elapsed;
}
