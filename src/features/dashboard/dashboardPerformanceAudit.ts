/**
 * R113-A — Local, opt-in dashboard listener/performance audit.
 * Counts snapshots delivered to this view (including SDK/offline cache), NOT
 * billable Firestore reads or network round-trips. No document contents or UIDs.
 */
export interface DashboardAuditRow {
  name: string;
  active: boolean;
  subscriptions: number;
  snapshots: number;
  errors: number;
  firstMs: number | null;
  latestMs: number | null;
  lastDocuments: number | null;
  peakDocuments: number;
}

export interface DashboardAuditSummary {
  elapsedMs: number;
  firstFrameMs: number | null;
  firstSnapshotMs: number | null;
  coreSourcesReadyMs: number | null;
  activeListeners: number;
  totalSnapshots: number;
  latestDocuments: number;
  rows: DashboardAuditRow[];
}

export const DASHBOARD_CORE_SOURCES = ['settings/school_config', 'schedules', 'announcements'] as const;

export function createDashboardPerformanceAudit(clock: () => number = () => performance.now()) {
  const started = clock();
  const rows = new Map<string, DashboardAuditRow>();
  let firstFrameMs: number | null = null;
  const get = (name: string): DashboardAuditRow => {
    let row = rows.get(name);
    if (!row) {
      row = { name, active: false, subscriptions: 0, snapshots: 0,
        errors: 0, firstMs: null, latestMs: null, lastDocuments: null, peakDocuments: 0 };
      rows.set(name, row);
    }
    return row;
  };
  return {
    subscribe(name: string) {
      const row = get(name);
      row.subscriptions += 1;
      row.active = true;
    },
    snapshot(name: string, count: number) {
      const row = get(name);
      const ms = Math.max(0, clock() - started);
      if (row.firstMs === null) row.firstMs = ms;
      row.latestMs = ms;
      row.snapshots += 1;
      row.lastDocuments = Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
      row.peakDocuments = Math.max(row.peakDocuments, row.lastDocuments || 0);
    },
    failure(name: string) { const row = get(name); row.errors += 1; row.active = false; },
    unsubscribe(name: string) { get(name).active = false; },
    markFirstFrame() {
      if (firstFrameMs === null) firstFrameMs = Math.max(0, clock() - started);
    },
    summary(): DashboardAuditSummary {
      const all = [...rows.values()].map(row => ({ ...row }));
      const firsts = all.flatMap(row => row.firstMs === null ? [] : [row.firstMs]);
      const coreFirsts = DASHBOARD_CORE_SOURCES.map(name => rows.get(name)?.firstMs);
      return {
        elapsedMs: Math.max(0, clock() - started), firstFrameMs,
        firstSnapshotMs: firsts.length ? Math.min(...firsts) : null,
        coreSourcesReadyMs: coreFirsts.every(ms => ms !== undefined && ms !== null)
          ? Math.max(...coreFirsts as number[]) : null,
        activeListeners: all.filter(row => row.active).length,
        totalSnapshots: all.reduce((sum, row) => sum + row.snapshots, 0),
        latestDocuments: all.filter(row => row.active).reduce((sum, row) => sum + (row.lastDocuments || 0), 0),
        rows: all,
      };
    },
  };
}

export function formatDashboardAudit(summary: DashboardAuditSummary): string {
  const ms = (value: number | null) => value === null ? 'belum tersedia' : `${Math.round(value)} ms`;
  const lines = [
    'Diagnostik Dashboard Piket Guru R113-A (tanpa data pengguna)',
    `Kerangka awal (frame): ${ms(summary.firstFrameMs)}`,
    `Snapshot pertama (cache/server belum dibedakan): ${ms(summary.firstSnapshotMs)}`,
    `Snapshot awal 3 sumber inti: ${ms(summary.coreSourcesReadyMs)}`,
    `Listener aktif di DashboardView: ${summary.activeListeners}`,
    `Total callback snapshot: ${summary.totalSnapshots}`,
    `Jumlah dokumen pada snapshot terakhir (semua sumber aktif): ${summary.latestDocuments}`,
    ...summary.rows.map(row => `${row.name}: ${row.active ? 'aktif' : 'nonaktif'} | awal ${ms(row.firstMs)} | ` +
      `dokumen ${row.lastDocuments ?? '—'} | callback ${row.snapshots} | error ${row.errors} | subscription ${row.subscriptions}`),
    'Catatan: callback snapshot mencakup cache/offline dan realtime; angka ini BUKAN jumlah read berbayar Firebase.',
    'Audit hanya mencakup DashboardView, belum listener Header, Notifikasi, dan SmartCheckoutReminder.',
  ];
  return lines.join('\n');
}
