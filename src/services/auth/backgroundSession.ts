import { sanitizeSessionPolicy, sessionPolicyForDevice, type SessionPolicy } from '../../types/sessionPolicy.types';

const STORAGE_KEY = 'piket_background_session_v1';
const ACTIVITY_EVENT = 'piket-session-activity';
interface State {
  uid: string;
  policy: SessionPolicy;
  hiddenAt?: number;
  required?: boolean;
  exemptUntil?: number;
}
let memory: State | null = null;
function read(): State | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (value && typeof value.uid === 'string' && value.uid && value.policy) {
      memory = { uid: value.uid, policy: sanitizeSessionPolicy(value.policy), required: value.required === true,
        ...(Number.isFinite(value.hiddenAt) && value.hiddenAt >= 0 ? { hiddenAt: value.hiddenAt } : {}),
        ...(Number.isFinite(value.exemptUntil) && value.exemptUntil >= 0 ? { exemptUntil: value.exemptUntil } : {}) };
    }
  } catch { /* Memory still protects the current page when storage is blocked. */ }
  return memory;
}
function write(value: State) {
  memory = value;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* No credentials are stored here. */ }
}
export function cachedSessionPolicy(uid: string): SessionPolicy {
  const state = read();
  return state?.uid === uid ? state.policy : sanitizeSessionPolicy();
}
export function hasBackgroundLoginRequirement(): boolean {
  const state = read();
  return !!state && requiresBackgroundLogin(state.uid);
}
export function requiresBackgroundLogin(uid: string, now = Date.now()): boolean {
  const state = read();
  if (!state || state.uid !== uid) return false;
  if (state.required) return true;
  const policy = sessionPolicyForDevice(state.policy);
  if (!policy.backgroundLogoutEnabled || state.hiddenAt === undefined) return false;
  if (state.exemptUntil && now < state.exemptUntil && now >= state.hiddenAt) return false;
  return now < state.hiddenAt || now - state.hiddenAt >= policy.backgroundDelaySeconds * 1000;
}
export function markBackgroundLoginRequired(uid: string) {
  const state = read();
  write({ ...(state?.uid === uid ? state : { uid, policy: sanitizeSessionPolicy() }), required: true });
}
/** Only call after a successful explicit PIN/Google login, never on SDK restore. */
export function completeBackgroundLogin(uid: string) {
  write({ uid, policy: cachedSessionPolicy(uid), required: false });
}
export const BACKGROUND_SESSION_NOTICE = 'Sesi berakhir karena aplikasi ditinggalkan. Silakan masuk kembali. Data antrean dan draf yang tersimpan tetap dipertahankan.';

/** Bounded exceptions for a native file picker/print or an intentional Drive OAuth redirect. */
export function beginSessionActivity(durationMs = 180_000): () => void {
  const state = read();
  if (!state || state.required) return () => {};
  const deadline = Math.max(state.exemptUntil || 0, Date.now() + Math.min(300_000, Math.max(0, durationMs)));
  write({ ...state, exemptUntil: deadline });
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
  return () => {
    const latest = read();
    if (latest?.uid !== state.uid || latest.exemptUntil !== deadline) return;
    write({ ...latest, exemptUntil: undefined });
    window.dispatchEvent(new Event(ACTIVITY_EVENT));
  };
}

/** Timestamps survive refresh/BFCache. Foreground checks do not trust frozen timers. */
export function monitorBackgroundSession(uid: string, onExpire: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false, stopped = false;
  let nativeRelease: (() => void) | undefined;
  let nativeInput: HTMLInputElement | undefined;
  const configure = (policy: SessionPolicy) => {
    const old = read();
    write({ ...(old?.uid === uid ? old : { uid }), policy: sanitizeSessionPolicy(policy) });
  };
  configure(cachedSessionPolicy(uid));
  const expire = () => {
    if (expired || stopped) return;
    expired = true;
    clearTimeout(timer);
    markBackgroundLoginRequired(uid);
    onExpire();
  };
  const check = () => {
    clearTimeout(timer);
    const state = read();
    if (stopped || expired || state?.uid !== uid) return;
    if (requiresBackgroundLogin(uid)) { expire(); return; }
    const policy = sessionPolicyForDevice(state.policy);
    if (policy.backgroundLogoutEnabled && state.hiddenAt !== undefined) {
      const remaining = Math.max(state.hiddenAt + policy.backgroundDelaySeconds * 1000, state.exemptUntil || 0) - Date.now();
      timer = setTimeout(check, Math.max(1, remaining));
    }
  };
  const hide = () => {
    const state = read();
    if (stopped || expired || state?.uid !== uid || !sessionPolicyForDevice(state.policy).backgroundLogoutEnabled) return;
    // Do not extend the deadline when visibilitychange is followed by pagehide.
    if (state.hiddenAt === undefined) write({ ...state, hiddenAt: Date.now() });
    check();
  };
  const releaseNative = () => {
    nativeInput?.removeEventListener('change', finishNative);
    nativeInput?.removeEventListener('cancel', finishNative);
    nativeInput = undefined;
    const release = nativeRelease; nativeRelease = undefined;
    release?.();
  };
  const show = () => {
    if (document.hidden || stopped) return;
    check();
    const state = read();
    if (!expired && state?.uid === uid) write({ ...state, hiddenAt: undefined, exemptUntil: undefined });
    clearTimeout(timer);
    releaseNative();
  };
  function finishNative() { if (!document.hidden) show(); }
  const nativePicker = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    releaseNative();
    nativeRelease = beginSessionActivity(); nativeInput = input;
    input.addEventListener('change', finishNative); input.addEventListener('cancel', finishNative);
  };
  const beforePrint = () => { releaseNative(); nativeRelease = beginSessionActivity(); };
  const visibility = () => document.hidden ? hide() : show();
  const onPageHide = () => hide();
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('click', nativePicker, true);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', show);
  window.addEventListener('focus', show);
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', finishNative);
  window.addEventListener(ACTIVITY_EVENT, check);
  visibility();
  return {
    update(policy: SessionPolicy) { if (stopped || expired) return; configure(policy); visibility(); },
    stop() {
      stopped = true; clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('click', nativePicker, true);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('focus', show);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', finishNative);
      window.removeEventListener(ACTIVITY_EVENT, check);
      releaseNative();
    },
  };
}
