/**
 * R86-E3: staged, locally-exported performance comparison probe.
 * Read-only: no Firebase calls, no storage, no authentication/session/presence change.
 * API exists ONLY after explicit DEV/Preview + URL opt-in in main.tsx.
 * Never collect users, IDs, document paths, tokens, form data, photo, URLs or queue.
 */

type Arm = 'baseline' | 'pilot';
type Source = 'collection' | 'document' | 'notification' | 'announcement';
type Counts = { opened: number; active: number; closed: number; emissions: number; errors: number };
type CounterSet = Record<Source, Counts>;

export interface R86E3Sample {
  readonly elapsedMs: number;
  readonly hidden: boolean;
  readonly online: boolean;
  readonly counters: CounterSet;
  readonly heapBytes: number | null;
  readonly peersVisible: number | null;
  readonly resumes: number | null;
}
export interface R86E3Export {
  schema: 'piket-r86e3-v1';
  release: 'R86-E3';
  arm: Arm;
  tabCount: 1 | 2 | 3 | 5;
  tabIndex: number;
  environment: 'DEV' | 'PREVIEW';
  r86cPresent: true;
  r86dPresent: true;
  pilotFlagActive: boolean;
  intervalMs: number;
  durationMs: number;
  samples: R86E3Sample[];
  caveat: 'listener-counters-are-not-billed-firestore-reads';
}
interface API {
  begin(arm: Arm, tabCount: 1 | 2 | 3 | 5, tabIndex: number): { ok: boolean; message: string };
  snapshot(): { recording: boolean; samples: number; durationMs: number; arm: Arm | null };
  exportJSON(): string;
  download(): void;
  stop(): void;
}
declare global {
  interface Window {
    __PIKET_R86E3__?: API;
  }
}

const SOURCES: Source[] = ['collection', 'document', 'notification', 'announcement'];
const FIELDS: (keyof Counts)[] = ['opened', 'active', 'closed', 'emissions', 'errors'];
const SAMPLE_INTERVAL_MS = 3000;
const MAX_SAMPLES = 900;
const validNumber = (x: unknown): number => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
const optionalNumber = (x: unknown): number | null => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null;

let active: API | null = null;
export function startR86E3PerformanceCapture(): () => void {
  if (active) return () => active?.stop();
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let startedAt = 0;
  let arm: Arm | null = null;
  let expectedTabs: 1 | 2 | 3 | 5 = 1;
  let tabIndex = 1;
  let timer: ReturnType<typeof setInterval> | null = null;
  let samples: R86E3Sample[] = [];
  let stopped = false;
  const enabledPilot = () => import.meta.env.VITE_R86E2_REPORTS_PILOT === 'enabled' &&
    new URLSearchParams(window.location.search).get('r86_e2_pilot') === '1';
  const capture = (): void => {
    if (stopped || arm === null || !startedAt || samples.length >= MAX_SAMPLES) return;
    const reported = window.__PIKET_R86C__?.snapshot()?.counters;
    const stability = window.__PIKET_R86D__?.snapshot();
    // Guard against probe stops: do not invent zeros and produce false comparisons.
    if (!reported || !stability) return;
    const counters = Object.create(null) as CounterSet;
    for (const source of SOURCES) {
      const count = Object.create(null) as Counts;
      for (const field of FIELDS) count[field] = validNumber(reported[source]?.[field]);
      counters[source] = count;
    }
    const peers = window.__PIKET_R86B__?.snapshot();
    samples.push({
      elapsedMs: Math.max(0, Date.now() - startedAt),
      hidden: document.visibilityState !== 'visible', online: navigator.onLine,
      counters, heapBytes: optionalNumber(stability.heapBytes),
      peersVisible: optionalNumber(peers?.observedVisiblePeers),
      resumes: optionalNumber(stability.counts?.resumes),
    });
    if (samples.length >= MAX_SAMPLES && timer !== null) { clearInterval(timer); timer = null; }
  };
  const onVisibility = () => capture();
  const onPageShow = () => capture();
  const getExport = (): R86E3Export => {
    if (arm === null) throw new Error('Mulai pengukuran terlebih dahulu: begin(arm, tabCount, tabIndex).');
    capture();
    return {
      schema: 'piket-r86e3-v1', release: 'R86-E3', arm,
      tabCount: expectedTabs, tabIndex,
      environment: import.meta.env.DEV ? 'DEV' : 'PREVIEW',
      r86cPresent: true, r86dPresent: true, pilotFlagActive: enabledPilot(),
      intervalMs: SAMPLE_INTERVAL_MS,
      durationMs: Date.now() - startedAt,
      samples: samples.slice(),
      caveat: 'listener-counters-are-not-billed-firestore-reads',
    };
  };
  const api: API = {
    begin(nextArm, nextTabs, nextIndex) {
      if (stopped) return { ok: false, message: 'Probe sudah dihentikan; reload untuk pengukuran baru.' };
      if (arm !== null) return { ok: false, message: 'Sudah merekam. Download kemudian reload halaman untuk pengujian baru.' };
      if (!['baseline', 'pilot'].includes(nextArm) || ![1, 2, 3, 5].includes(nextTabs) ||
          !Number.isInteger(nextIndex) || nextIndex < 1 || nextIndex > nextTabs) return { ok: false, message: 'Parameter salah.' };
      if (!window.__PIKET_R86C__?.snapshot || !window.__PIKET_R86D__?.snapshot) {
        return { ok: false, message: 'Aktifkan R86-C dan R86-D pada tab ini terlebih dahulu.' };
      }
      if (nextArm === 'pilot' && !enabledPilot()) return { ok: false, message: 'Pilot E2 tidak aktif. Periksa build flag dan ?r86_e2_pilot=1.' };
      if (nextArm === 'baseline' && enabledPilot()) return { ok: false, message: 'Nonaktifkan parameter r86_e2_pilot untuk baseline.' };
      arm = nextArm; expectedTabs = nextTabs; tabIndex = nextIndex;
      startedAt = Date.now(); samples = [];
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pageshow', onPageShow);
      capture();
      timer = setInterval(capture, SAMPLE_INTERVAL_MS);
      return { ok: true, message: 'Pengukuran dimulai. Biarkan semua tab pada menu Laporan setidaknya 4 menit.' };
    },
    snapshot() { return { recording: arm !== null && !stopped, samples: samples.length,
      durationMs: startedAt ? Date.now() - startedAt : 0, arm }; },
    exportJSON: () => JSON.stringify(getExport(), null, 2),
    download() {
      const file = getExport();
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url; a.download = `r86e3_${file.arm}_${file.tabCount}_${file.tabIndex}.json`;
        a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 30_000); }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) { clearInterval(timer); timer = null; }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      if (window.__PIKET_R86E3__ === api) delete window.__PIKET_R86E3__;
      if (active === api) active = null;
    },
  };
  active = api;
  window.__PIKET_R86E3__ = api;
  return () => api.stop();
}
