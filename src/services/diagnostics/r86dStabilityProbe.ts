/**
 * R86-D — read-only staging probe for page resume and multi-tab performance.
 * Zero Firebase imports, no identifiers, no storage, no external calls, and no
 * modification to session policy, sync queue, subscriptions or visibility.
 */

type ProbeCounts = {
  visibilityChanges: number;
  hiddenEpisodes: number;
  resumes: number;
  pageshow: number;
  bfcacheRestores: number;
  pagehide: number;
  online: number;
  offline: number;
  focus: number;
};
type ListenerCounts = { opened: number; active: number; closed: number; emissions: number; errors: number };
type ListenerCategory = 'collection' | 'document' | 'notification' | 'announcement';

export interface R86DSnapshot {
  version: 'R86-D';
  enabled: true;
  recordedAt: number;
  uptimeMs: number;
  currentVisibility: DocumentVisibilityState;
  online: boolean;
  currentHiddenMs: number | null;
  lastHiddenDurationMs: number | null;
  longestHiddenDurationMs: number;
  backgroundThresholdExceeded: number;
  counts: Readonly<ProbeCounts>;
  navigation: Readonly<{
    type: string | 'UNAVAILABLE';
    domContentLoadedMs: number | 'UNAVAILABLE';
    loadEventMs: number | 'UNAVAILABLE';
  }>;
  heapBytes: number | 'UNAVAILABLE';
  otherProbes: {
    r86a: 'ENABLED' | 'NOT_ENABLED';
    r86b: 'ENABLED' | 'NOT_ENABLED';
    r86c: 'ENABLED' | 'NOT_ENABLED';
  };
  r86a: Readonly<BaseAuditSnapshot> | null;
  r86b: Readonly<TabOptimizationSnapshot> | null;
  r86cCounters: Readonly<Record<ListenerCategory, Readonly<ListenerCounts>>> | null;
  doesNotCheckSessionValidity: true;
  doesNotMeasureBillableFirestoreReads: true;
  doesNotModifyLoginOrData: true;
}

interface R86DGlobal {
  snapshot(): R86DSnapshot;
  report(): string;
  stop(): void;
}

declare global {
  interface Window {
    __PIKET_R86D__?: R86DGlobal;
  }
}

const BACKGROUND_SAMPLE_THRESHOLD_MS = 60_000;
let activeStop: (() => void) | undefined;

function finiteMilliseconds(value: unknown): number | 'UNAVAILABLE' {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 'UNAVAILABLE';
}

function readProbes() {
  const safe = <T>(f: (() => T) | undefined): T | null => {
    if (!f) return null;
    try { return f(); } catch { return null; }
  };
  // Snapshot only aggregates from the explicitly opted-in earlier R86 probes.
  const a = safe(window.__PIKET_R86_AUDIT__?.snapshot);
  const b = safe(window.__PIKET_R86B__?.snapshot);
  const c = safe(window.__PIKET_R86C__?.snapshot);
  const metric = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
  const optionalMetric = (n: unknown): number | undefined => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
  const counters = c?.counters;
  const cleanCounts = counters ? Object.fromEntries(
    (['collection', 'document', 'notification', 'announcement'] as const).map(kind => {
      const current = counters[kind];
      return [kind, {
        opened: metric(current?.opened),
        active: metric(current?.active),
        closed: metric(current?.closed),
        emissions: metric(current?.emissions),
        errors: metric(current?.errors),
      }];
    }),
  ) as Record<ListenerCategory, ListenerCounts> : null;
  return {
    otherProbes: {
      r86a: a ? 'ENABLED' as const : 'NOT_ENABLED' as const,
      r86b: b ? 'ENABLED' as const : 'NOT_ENABLED' as const,
      r86c: c ? 'ENABLED' as const : 'NOT_ENABLED' as const,
    },
    r86a: a ? { observedPeers: optionalMetric(a.observedPeers), observedVisiblePeers: optionalMetric(a.observedVisiblePeers) } : null,
    r86b: b ? { observedPeers: optionalMetric(b.observedPeers), observedVisiblePeers: optionalMetric(b.observedVisiblePeers), visualQuiet: b.visualQuiet === true } : null,
    r86cCounters: cleanCounts,
  };
}

/** Starts only when called by the explicit DEV/staging AND URL opt-in. */
export function startR86DStabilityProbe(): () => void {
  if (activeStop) return activeStop;
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const startedAt = Date.now();
  let hiddenAt: number | null = document.visibilityState === 'hidden' ? startedAt : null;
  let lastHiddenDurationMs: number | null = null;
  let longestHiddenDurationMs = 0;
  let backgroundThresholdExceeded = 0;
  let stopped = false;
  const counts: ProbeCounts = {
    visibilityChanges: 0, hiddenEpisodes: hiddenAt === null ? 0 : 1,
    resumes: 0, pageshow: 0, bfcacheRestores: 0, pagehide: 0,
    online: 0, offline: 0, focus: 0,
  };
  const hidden = () => {
    if (hiddenAt === null) {
      hiddenAt = Date.now();
      counts.hiddenEpisodes++;
    }
  };
  const resume = () => {
    if (document.visibilityState !== 'visible' || hiddenAt === null) return;
    const duration = Math.max(0, Date.now() - hiddenAt);
    lastHiddenDurationMs = duration;
    longestHiddenDurationMs = Math.max(longestHiddenDurationMs, duration);
    if (duration >= BACKGROUND_SAMPLE_THRESHOLD_MS) backgroundThresholdExceeded++;
    hiddenAt = null;
    counts.resumes++;
  };
  const onVisibility = () => {
    counts.visibilityChanges++;
    if (document.visibilityState === 'visible') resume(); else hidden();
  };
  const onPageHide = () => { counts.pagehide++; hidden(); };
  const onPageShow = (e: PageTransitionEvent) => {
    counts.pageshow++;
    if (e.persisted) counts.bfcacheRestores++;
    resume();
  };
  const onOnline = () => { counts.online++; };
  const onOffline = () => { counts.offline++; };
  const onFocus = () => { counts.focus++; resume(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  const snapshot = (): R86DSnapshot => {
    const nav = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined : undefined;
    const heapCandidate = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
    return {
      version: 'R86-D', enabled: true,
      recordedAt: Date.now(), uptimeMs: Math.max(0, Date.now() - startedAt),
      currentVisibility: document.visibilityState,
      online: navigator.onLine,
      currentHiddenMs: hiddenAt === null ? null : Math.max(0, Date.now() - hiddenAt),
      lastHiddenDurationMs, longestHiddenDurationMs, backgroundThresholdExceeded,
      counts: Object.freeze({ ...counts }),
      navigation: {
        type: nav?.type || 'UNAVAILABLE',
        domContentLoadedMs: finiteMilliseconds(nav?.domContentLoadedEventEnd),
        loadEventMs: finiteMilliseconds(nav?.loadEventEnd),
      },
      heapBytes: typeof heapCandidate === 'number' && Number.isFinite(heapCandidate)
        ? Math.max(0, Math.round(heapCandidate)) : 'UNAVAILABLE',
      ...readProbes(),
      doesNotCheckSessionValidity: true,
      doesNotMeasureBillableFirestoreReads: true,
      doesNotModifyLoginOrData: true,
    };
  };
  const api: R86DGlobal = {
    snapshot,
    report: () => JSON.stringify(snapshot(), null, 2),
    stop: () => activeStop?.(),
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (window.__PIKET_R86D__ === api) delete window.__PIKET_R86D__;
    if (activeStop === stop) activeStop = undefined;
  };
  activeStop = stop;
  window.__PIKET_R86D__ = api;
  return stop;
}
