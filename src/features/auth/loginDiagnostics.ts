import { loginClockNow } from './loginPerformance';

export type LoginDiagnostics = {
  startedAt: number;
  updatedAt: number;
  pinApiMs?: number;
  firebaseMs?: number;
  totalMs?: number;
  shellVisibleMs?: number;
  serverMs?: Partial<Record<'gate' | 'lookup' | 'lock' | 'pin' | 'rateReset' | 'signer' | 'total', number>>;
};

const STORE_KEY = 'piket_login_perf_numbers_v1';
const EVENT_NAME = 'piket-login-perf-update';
const MAX_STORED_AGE_MS = 10 * 60 * 1000;
let diagnostics: LoginDiagnostics | null = null;

/** Opt-in per browser tab: /?login_diag=1. Never collects PIN, user ID or tokens. */
export function loginDiagnosticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('login_diag') === '1';
}

export function getLoginDiagnosticsEventName(): string { return EVENT_NAME; }

function publish(): void {
  if (!diagnostics || !loginDiagnosticsEnabled()) return;
  try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(diagnostics)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function readLoginDiagnostics(): LoginDiagnostics | null {
  if (!loginDiagnosticsEnabled()) return null;
  if (diagnostics) return { ...diagnostics, serverMs: { ...diagnostics.serverMs } };
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORE_KEY) || 'null') as LoginDiagnostics | null;
    if (stored && Number.isFinite(stored.updatedAt) && Date.now() - stored.updatedAt < MAX_STORED_AGE_MS) {
      return { ...stored, serverMs: { ...stored.serverMs } };
    }
  } catch { /* invalid or unavailable session storage */ }
  return null;
}

/** Exactly one trace per PIN submit. Performance.now is relative to this page only. */
export function beginLoginDiagnostics(startedAt: number): void {
  if (!loginDiagnosticsEnabled()) return;
  diagnostics = { startedAt, updatedAt: Date.now() };
  publish();
}

/** Only trusted, numeric server timing phase names; all other header content is discarded. */
export function captureLoginServerTiming(header: string | null): void {
  if (!loginDiagnosticsEnabled() || !diagnostics || !header) return;
  const accepted = new Set(['gate', 'lookup', 'lock', 'pin', 'rateReset', 'signer', 'total']);
  const serverMs: NonNullable<LoginDiagnostics['serverMs']> = {};
  for (const part of header.split(',')) {
    const match = /^\s*([a-zA-Z]+);dur=(\d+(?:\.\d+)?)\s*$/.exec(part);
    if (!match || !accepted.has(match[1])) continue;
    const value = Number(match[2]);
    if (!Number.isFinite(value) || value > 60000) continue;
    serverMs[match[1] as keyof typeof serverMs] = Math.round(value);
  }
  if (Object.keys(serverMs).length) {
    diagnostics.serverMs = serverMs;
    diagnostics.updatedAt = Date.now();
    publish();
  }
}

/** Called only after lazy authenticated shell renders; not a dashboard-data-complete signal. */
export function markAuthenticatedShellVisible(): void {
  if (!loginDiagnosticsEnabled() || !diagnostics || diagnostics.shellVisibleMs != null) return;
  diagnostics.shellVisibleMs = Math.max(0, Math.round(loginClockNow() - diagnostics.startedAt));
  diagnostics.updatedAt = Date.now();
  publish();
}


export function captureClientLoginPhase(phase: 'pinApi' | 'firebase' | 'total', duration: number): void {
  if (!loginDiagnosticsEnabled() || !diagnostics || !Number.isFinite(duration)) return;
  const value = Math.max(0, Math.round(duration));
  if (phase === 'pinApi') diagnostics.pinApiMs = value;
  if (phase === 'firebase') diagnostics.firebaseMs = value;
  if (phase === 'total') diagnostics.totalMs = value;
  diagnostics.updatedAt = Date.now();
  publish();
}
