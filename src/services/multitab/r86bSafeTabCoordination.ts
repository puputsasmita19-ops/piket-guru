/**
 * R86-B: cooperative, non-authoritative tab presence for **decorative visuals only**.
 *
 * NEVER arbitrate authentication, presences, attendance submissions, Firestore
 * subscriptions, service workers, notification delivery, drafts or offline queues.
 * Enabled only behind a development/staging AND explicit URL opt-in in main.tsx.
 * Does not inspect identity, storage or business data, and does not fetch anything.
 */
import './r86bDecorative.css';

type Signal = 'HELLO' | 'STATE' | 'LEAVE';
type WireMessage = {
  schema: 1;
  signal: Signal;
  tab: string;
  visible: boolean;
};
type Peer = { seenAt: number; visible: boolean };

export interface R86BTabSnapshot {
  version: 'R86-B';
  channelSupported: boolean;
  visibility: DocumentVisibilityState;
  observedPeers: number;
  observedVisiblePeers: number;
  /** Only visual animations are affected; does not imply tab ownership. */
  visualQuiet: boolean;
  messagesReceived: number;
  stateChanges: number;
  storageRead: false;
  firebaseListenersTouched: false;
}

interface R86BApi {
  snapshot(): R86BTabSnapshot;
  stop(): void;
}

declare global {
  interface Window { __PIKET_R86B__?: R86BApi }
}

// Idle peers eventually expire even when browsers throttle background timers.
const CHANNEL_NAME = 'piket-guru-r86b-visual-only-v1';
const PEER_TTL_MS = 90_000;
const FOREGROUND_PULSE_MS = 15_000;
const BACKGROUND_PULSE_MS = 40_000;
const ROOT_ATTRIBUTE = 'data-r86b-visual-quiet';

let runningTeardown: (() => void) | null = null;

export function startR86BSafeTabCoordination(): () => void {
  if (runningTeardown) return runningTeardown;
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const localTab = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const peers = new Map<string, Peer>();
  let channel: BroadcastChannel | null = null;
  let pulse: ReturnType<typeof setTimeout> | null = null;
  let visualQuiet = false;
  let stopped = false;
  let inPageCache = false;
  let messagesReceived = 0;
  let stateChanges = 0;

  const visible = () => document.visibilityState === 'visible';
  const prune = () => {
    const now = Date.now();
    for (const [key, peer] of peers) {
      if (now - peer.seenAt > PEER_TTL_MS) peers.delete(key);
    }
  };
  const clearVisualQuiet = () => {
    // Only undo the attribute that *this* instance set.
    if (visualQuiet) {
      document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
      visualQuiet = false;
      stateChanges++;
    }
  };
  const reconcile = () => {
    if (stopped || inPageCache || !channel) { clearVisualQuiet(); return; }
    prune();
    // Never demote a visible tab; no 'leader' is elected and writes are untouched.
    const anotherVisible = [...peers.values()].some(peer => peer.visible);
    const next = !visible() && anotherVisible;
    if (next === visualQuiet) return;
    visualQuiet = next;
    stateChanges++;
    if (next) document.documentElement.setAttribute(ROOT_ATTRIBUTE, 'true');
    else document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
  };
  const send = (signal: Signal) => {
    if (!channel || stopped) return;
    const message: WireMessage = { schema: 1, signal, tab: localTab, visible: visible() };
    try { channel.postMessage(message); } catch { /* No impact on business flow. */ }
  };
  const receive = (event: MessageEvent<unknown>) => {
    if (stopped || inPageCache) return;
    const value = event.data;
    if (!value || typeof value !== 'object') return;
    const message = value as Partial<WireMessage>;
    if (message.schema !== 1 || (message.signal !== 'HELLO' && message.signal !== 'STATE' && message.signal !== 'LEAVE') ||
      typeof message.tab !== 'string' || message.tab.length > 100 || message.tab === localTab ||
      typeof message.visible !== 'boolean') return;
    messagesReceived++;
    if (message.signal === 'LEAVE') peers.delete(message.tab);
    else peers.set(message.tab, { seenAt: Date.now(), visible: message.visible });
    if (message.signal === 'HELLO') send('STATE');
    reconcile();
  };
  const clearPulse = () => {
    if (pulse !== null) { clearTimeout(pulse); pulse = null; }
  };
  const schedulePulse = () => {
    clearPulse();
    if (!channel || stopped || inPageCache) return;
    pulse = setTimeout(() => {
      pulse = null;
      if (stopped || inPageCache) return;
      send('STATE');
      reconcile(); // handles TTL even if no messages arrive
      schedulePulse();
    }, visible() ? FOREGROUND_PULSE_MS : BACKGROUND_PULSE_MS);
  };
  const enter = () => {
    if (stopped || channel || typeof BroadcastChannel === 'undefined') return;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = receive;
      send('HELLO');
      schedulePulse();
      reconcile();
    } catch { channel = null; clearVisualQuiet(); }
  };
  const leave = () => {
    clearPulse();
    if (channel) {
      send('LEAVE');
      channel.onmessage = null;
      channel.close();
      channel = null;
    }
    peers.clear();
    clearVisualQuiet();
  };
  const onVisibility = () => { send('STATE'); reconcile(); schedulePulse(); };
  const onFocus = () => { send('STATE'); reconcile(); };
  const onPageHide = () => { inPageCache = true; leave(); };
  const onPageShow = () => { inPageCache = false; enter(); onVisibility(); };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  enter();

  const snapshot = (): R86BTabSnapshot => {
    reconcile();
    return Object.freeze({
      version: 'R86-B' as const,
      channelSupported: typeof BroadcastChannel !== 'undefined' && channel !== null,
      visibility: document.visibilityState,
      observedPeers: peers.size,
      observedVisiblePeers: [...peers.values()].filter(peer => peer.visible).length,
      visualQuiet,
      messagesReceived,
      stateChanges,
      storageRead: false as const,
      firebaseListenersTouched: false as const,
    });
  };
  const api: R86BApi = Object.freeze({ snapshot, stop: () => runningTeardown?.() });
  window.__PIKET_R86B__ = api;
  runningTeardown = () => {
    if (stopped) return;
    leave();
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    if (window.__PIKET_R86B__ === api) delete window.__PIKET_R86B__;
    runningTeardown = null;
  };
  console.info('[R86-B] Safe visual-only tab coordination enabled for this test tab.');
  return runningTeardown;
}
