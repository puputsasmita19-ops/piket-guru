import { useEffect, useRef, useState } from 'react';
import { canR86E2SuspendReport, startR86E2ReportPeerProbe } from './r86e2ReportPilot';

// Experimental. Requires both build flag and URL consent. Production default: OFF.
const PILOT_ENABLED = typeof window !== 'undefined' &&
  import.meta.env.VITE_R86E2_REPORTS_PILOT === 'enabled' &&
  new URLSearchParams(window.location.search).get('r86_e2_pilot') === '1';
const HIDDEN_GRACE_MS = 120_000;

/** Pauses only reports' read-only *view* subscriptions; never affects operational writes. */
export function useR86E2ReportLive(importantWorkInProgress: boolean): boolean {
  const [listening, setListening] = useState(true);
  const protectedRef = useRef(importantWorkInProgress);
  useEffect(() => { protectedRef.current = importantWorkInProgress; if (importantWorkInProgress) setListening(true); }, [importantWorkInProgress]);

  useEffect(() => {
    if (!PILOT_ENABLED) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let probe: ReturnType<typeof startR86E2ReportPeerProbe> | null = null;
    const cancel = () => { if (timeout) clearTimeout(timeout); timeout = null; };
    const reconcile = () => {
      if (closed) return;
      const eligible = canR86E2SuspendReport(
        document.visibilityState === 'hidden', probe?.hasVisiblePeer() ?? false, protectedRef.current
      );
      if (!eligible) { cancel(); setListening(true); return; }
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        if (!closed && canR86E2SuspendReport(
          document.visibilityState === 'hidden', probe?.hasVisiblePeer() ?? false, protectedRef.current
        )) setListening(false);
      }, HIDDEN_GRACE_MS);
    };
    probe = startR86E2ReportPeerProbe(reconcile);
    reconcile();
    return () => { closed = true; cancel(); probe?.stop(); };
  }, []);
  return listening;
}
