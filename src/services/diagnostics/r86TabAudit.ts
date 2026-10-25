/**
 * R86-A, opt-in observation only. This module MUST NOT own authentication,
 * Firebase listeners, queue/drafts, storage, or tab leadership.
 * It is dynamically loaded by main.tsx only in DEV or an explicitly enabled
 * staging build, and only after ?r86_audit=1 has been supplied.
 * No user identity, form content, tokens, photos or payloads are observed.
 */

type AuditMessageType = 'HELLO' | 'SEEN' | 'STATE' | 'LEAVING';
type AuditMessage = { version: 1; type: AuditMessageType; tab: string; visible: boolean };
type Peer = { lastSeen: number; visible: boolean };

type CounterName = 'visibilityChanges' | 'focusEvents' | 'blurEvents' | 'pageHideEvents' |
  'pageShowEvents' | 'onlineEvents' | 'offlineEvents' | 'messagesReceived';

export interface R86AuditSnapshot {
  readonly version: 'R86-A';
  readonly channelSupported: boolean;
  readonly startedAt: number;
  readonly sampledAt: number;
  readonly visibility: DocumentVisibilityState;
  readonly online: boolean;
  /** Only instrumented tabs in this browser/origin; not a security assertion. */
  readonly observedPeers: number;
  readonly observedVisiblePeers: number;
  readonly maxObservedPeers: number;
  readonly counts: Readonly<Record<CounterName, number>>;
  readonly listenerCount: 'NOT_INSTRUMENTED';
  readonly offlineDraftCount: 'NOT_READ';
  readonly offlineQueueCount: 'NOT_READ';
}

interface AuditConsole {
  snapshot(): R86AuditSnapshot;
  stop(): void;
}

declare global {
  interface Window { __PIKET_R86_AUDIT__?: AuditConsole }
}

/** Must never be confused with a distributed lease or presence authority. */
const PEER_EXPIRY_MS = 90_000;
const PULSE_MS = 15_000;
const CHANNEL = 'piket-guru-r86a-observation-v1';
let teardown: (() => void) | null = null;

export function startR86TabAudit(): () => void {
  if (teardown) return teardown;
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const startedAt = Date.now();
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `${startedAt}-${Math.random().toString(36).slice(2)}`;
  const peers = new Map<string, Peer>();
  const counts: Record<CounterName, number> = {
    visibilityChanges: 0, focusEvents: 0, blurEvents: 0, pageHideEvents: 0,
    pageShowEvents: 0, onlineEvents: 0, offlineEvents: 0, messagesReceived: 0,
  };
  let maxObservedPeers = 0;
  let channel: BroadcastChannel | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let suspended = false;
  let stopped = false;

  const prune = () => {
    const now = Date.now();
    for (const [key, peer] of peers) if (now - peer.lastSeen > PEER_EXPIRY_MS) peers.delete(key);
    maxObservedPeers = Math.max(maxObservedPeers, peers.size);
  };
  const isVisible = () => document.visibilityState === 'visible';
  const send = (type: AuditMessageType) => {
    if (!channel || stopped) return;
    const data: AuditMessage = { version: 1, type, tab: id, visible: isVisible() };
    try { channel.postMessage(data); } catch { /* No effect on app functionality. */ }
  };
  const receive = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    const data = message as Partial<AuditMessage>;
    if (data.version !== 1 || !['HELLO', 'SEEN', 'STATE', 'LEAVING'].includes(String(data.type)) ||
      typeof data.tab !== 'string' || data.tab.length > 100 || data.tab === id || typeof data.visible !== 'boolean') return;
    counts.messagesReceived++;
    if (data.type === 'LEAVING') { peers.delete(data.tab); return; }
    const fresh = !peers.has(data.tab);
    peers.set(data.tab, { lastSeen: Date.now(), visible: data.visible });
    prune();
    if (data.type === 'HELLO' && fresh) send('SEEN');
  };
  const startChannel = () => {
    if (stopped || channel || typeof BroadcastChannel === 'undefined') return;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = receive;
      send('HELLO');
    } catch { channel = null; }
  };
  const pauseChannel = () => {
    if (interval !== null) { clearInterval(interval); interval = null; }
    if (channel) { send('LEAVING'); channel.close(); channel = null; }
    peers.clear();
  };
  const resume = () => {
    if (stopped) return;
    suspended = false;
    startChannel();
    if (interval === null) interval = setInterval(() => { prune(); send('STATE'); }, PULSE_MS);
  };
  const visibility = () => { counts.visibilityChanges++; if (!suspended) send('STATE'); };
  const focus = () => { counts.focusEvents++; if (!suspended) send('STATE'); };
  const blur = () => { counts.blurEvents++; if (!suspended) send('STATE'); };
  const online = () => { counts.onlineEvents++; };
  const offline = () => { counts.offlineEvents++; };
  const pagehide = () => { counts.pageHideEvents++; suspended = true; pauseChannel(); };
  const pageshow = () => { counts.pageShowEvents++; resume(); };

  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', focus);
  window.addEventListener('blur', blur);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  resume();

  const snapshot = (): R86AuditSnapshot => {
    prune();
    return Object.freeze({
      version: 'R86-A' as const, channelSupported: typeof BroadcastChannel !== 'undefined',
      startedAt, sampledAt: Date.now(), visibility: document.visibilityState,
      online: navigator.onLine, observedPeers: peers.size,
      observedVisiblePeers: [...peers.values()].filter(p => p.visible).length,
      maxObservedPeers, counts: Object.freeze({ ...counts }),
      listenerCount: 'NOT_INSTRUMENTED' as const,
      offlineDraftCount: 'NOT_READ' as const,
      offlineQueueCount: 'NOT_READ' as const,
    });
  };
  const api: AuditConsole = Object.freeze({ snapshot, stop: () => teardown?.() });
  window.__PIKET_R86_AUDIT__ = api;
  teardown = () => {
    if (stopped) return;
    pauseChannel(); // announce LEAVING before marking this diagnostic stopped
    stopped = true;
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('focus', focus);
    window.removeEventListener('blur', blur);
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', pageshow);
    if (window.__PIKET_R86_AUDIT__ === api) delete window.__PIKET_R86_AUDIT__;
    teardown = null;
  };
  console.info('[R86-A] Audit tab aktif (observasi lokal saja). Buka console dan jalankan window.__PIKET_R86_AUDIT__.snapshot()');
  return teardown;
}
