/**
 * R86-C: opt-in, in-tab Firestore subscription diagnostics.
 * Counts SDK registration/callbacks, NOT billable reads or unique backend streams.
 * No UID, record contents, document paths, queue/draft data or credentials captured.
 */
export type R86CSource = 'collection' | 'document' | 'notification' | 'announcement';
type Counts = { opened: number; active: number; closed: number; emissions: number; errors: number };
export interface R86CSnapshot {
  readonly version: 'R86-C';
  readonly enabled: true;
  readonly sampledAt: number;
  readonly hidden: boolean;
  readonly counters: Readonly<Record<R86CSource, Readonly<Counts>>>;
  readonly measuresFirestoreBilling: false;
  readonly modifiesSubscriptions: false;
}
interface R86CApi { snapshot(): R86CSnapshot; stop(): void }
declare global { interface Window { __PIKET_R86C__?: R86CApi } }
const TYPES: readonly R86CSource[] = ['collection', 'document', 'notification', 'announcement'];
let running = false;
let api: R86CApi | null = null;
const counters = Object.create(null) as Record<R86CSource, Counts>;
function reset(): void {
  for (const source of TYPES) counters[source] = { opened: 0, active: 0, closed: 0, emissions: 0, errors: 0 };
}
reset();

export function isR86COptimizationEnabled(): boolean { return running; }
/** Return the exact original stop behavior, called at most once, even if the SDK invokes a stop twice. */
export function trackR86CListener(source: R86CSource, unsubscribe: () => void): () => void {
  const counted = running;
  if (counted) { counters[source].opened++; counters[source].active++; }
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    if (counted && running) {
      counters[source].closed++;
      counters[source].active = Math.max(0, counters[source].active - 1);
    }
    unsubscribe();
  };
}
/** Counts SDK callback invocations, not documents downloaded or paid Firestore reads. */
export function noteR86CEvent(source: R86CSource, error = false): void {
  if (!running) return;
  if (error) counters[source].errors++;
  else counters[source].emissions++;
}
export function startR86CObservation(): R86CApi {
  if (api && running) return api;
  reset(); running = true;
  const instance: R86CApi = Object.freeze({
    snapshot: () => {
      const copy = Object.create(null) as Record<R86CSource, Readonly<Counts>>;
      for (const source of TYPES) copy[source] = Object.freeze({ ...counters[source] });
      return Object.freeze({ version: 'R86-C' as const, enabled: true as const,
        sampledAt: Date.now(), hidden: typeof document !== 'undefined' && document.visibilityState !== 'visible',
        counters: Object.freeze(copy), measuresFirestoreBilling: false as const, modifiesSubscriptions: false as const });
    },
    stop: () => {
      if (!running || api !== instance) return;
      running = false;
      if (typeof window !== 'undefined' && window.__PIKET_R86C__ === instance) delete window.__PIKET_R86C__;
      api = null;
    },
  });
  api = instance;
  if (typeof window !== 'undefined') window.__PIKET_R86C__ = instance;
  return instance;
}
