/**
 * R86-E2: EXPERIMENTAL report-only visible-peer detector.
 * This is advisory UI telemetry, NOT auth, not an ownership lock, not a queue leader.
 * Does not read storage or user data. If messaging is unavailable, default to listening.
 */
export type R86E2PresenceSignal = 'HELLO' | 'STATE' | 'LEAVE';
interface PresenceMessage {
  schema: 1;
  type: R86E2PresenceSignal;
  tab: string;
  visible: boolean;
}

const CHANNEL = 'piket-guru-r86e2-report-pilot-v1';
const PEER_MAX_AGE = 45_000;
const PULSE_INTERVAL = 12_000;

/** Explicit fail-open rule: missing peer evidence or ongoing work => keep reports live. */
export function canR86E2SuspendReport(hidden: boolean, hasVisiblePeer: boolean, protectedWork: boolean): boolean {
  return hidden && hasVisiblePeer && !protectedWork;
}

export interface R86E2ReportPeerProbe {
  hasVisiblePeer(): boolean;
  stop(): void;
}

export function startR86E2ReportPeerProbe(onChange: () => void): R86E2ReportPeerProbe {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return { hasVisiblePeer: () => false, stop: () => {} };
  }
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const peers = new Map<string, { visible: boolean; seen: number }>();
  let channel: BroadcastChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let suspended = false;
  const visible = () => document.visibilityState === 'visible';
  const prune = () => {
    const now = Date.now();
    for (const [key, peer] of peers) if (now - peer.seen > PEER_MAX_AGE) peers.delete(key);
  };
  const hasVisiblePeer = () => {
    if (stopped || suspended || !channel) return false;
    prune();
    return [...peers.values()].some(peer => peer.visible);
  };
  const send = (type: R86E2PresenceSignal) => {
    if (!channel || stopped || suspended) return;
    const msg: PresenceMessage = { schema: 1, type, tab: id, visible: visible() };
    try { channel.postMessage(msg); } catch { /* fail open: never suspend on message failure */ }
  };
  const cancelPulse = () => { if (timer) clearTimeout(timer); timer = null; };
  const pulse = () => {
    cancelPulse();
    if (stopped || suspended || !channel) return;
    timer = setTimeout(() => { timer = null; if (stopped || suspended) return; send('STATE'); prune(); onChange(); pulse(); }, PULSE_INTERVAL);
  };
  const receive = (evt: MessageEvent<unknown>) => {
    if (stopped || suspended || !evt.data || typeof evt.data !== 'object') return;
    const msg = evt.data as Partial<PresenceMessage>;
    if (msg.schema !== 1 || !['HELLO','STATE','LEAVE'].includes(msg.type || '') ||
        typeof msg.tab !== 'string' || msg.tab.length > 100 || msg.tab === id || typeof msg.visible !== 'boolean') return;
    if (msg.type === 'LEAVE') peers.delete(msg.tab);
    else peers.set(msg.tab, { visible: msg.visible, seen: Date.now() });
    if (msg.type === 'HELLO') send('STATE');
    onChange();
  };
  const open = () => {
    if (stopped || suspended || channel) return;
    try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = receive; send('HELLO'); pulse(); }
    catch { channel = null; peers.clear(); onChange(); }
  };
  const close = () => {
    cancelPulse();
    if (channel) { send('LEAVE'); channel.onmessage = null; channel.close(); channel = null; }
    peers.clear();
    onChange();
  };
  const onVisibility = () => { send('STATE'); onChange(); pulse(); };
  const onPageHide = () => { suspended = true; close(); };
  const onPageShow = () => { suspended = false; open(); onVisibility(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pagehide', onPageHide);
  open();
  return {
    hasVisiblePeer,
    stop: () => {
      if (stopped) return;
      close(); stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}
