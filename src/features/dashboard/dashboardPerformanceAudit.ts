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
  personalSourcesReadyMs: number | null;
  secondarySubscriptionsStartedMs: number | null;
  allInitialSourcesReadyMs: number | null;
  activeListeners: number;
  totalSnapshots: number;
  latestDocuments: number;
  rows: DashboardAuditRow[];
}

// Preserve R113-A's original three-source timing for apples-to-apples comparison.
export const DASHBOARD_CORE_SOURCES = ['settings/school_config', 'schedules', 'announcements'] as const;
// Personal-duty readiness does not require bulletin and secondary operational widgets.
export const DASHBOARD_PERSONAL_SOURCES = ['settings/school_config', 'schedules', 'teachers:linked'] as const;
export const DASHBOARD_INITIAL_SOURCES = [...DASHBOARD_CORE_SOURCES, 'teachers:linked', 'staff:linked',
  'attendance', 'dutyBooks', 'incidents', 'studentTardiness', 'studentPermits', 'visitors'] as const;

export function createDashboardPerformanceAudit(clock: () => number = () => performance.now()) {
  const started = clock();
  const rows = new Map<string, DashboardAuditRow>();
  let firstFrameMs: number | null = null;
  let secondarySubscriptionsStartedMs: number | null = null;
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
    markSecondaryStart() {
      if (secondarySubscriptionsStartedMs === null) secondarySubscriptionsStartedMs = Math.max(0, clock() - started);
    },
    markFirstFrame() {
      if (firstFrameMs === null) firstFrameMs = Math.max(0, clock() - started);
    },
    summary(): DashboardAuditSummary {
      const all = [...rows.values()].map(row => ({ ...row }));
      const firsts = all.flatMap(row => row.firstMs === null ? [] : [row.firstMs]);
      const coreFirsts = DASHBOARD_CORE_SOURCES.map(name => rows.get(name)?.firstMs);
      const personalFirsts = DASHBOARD_PERSONAL_SOURCES.map(name => rows.get(name)?.firstMs);
      const allFirsts = DASHBOARD_INITIAL_SOURCES.map(name => rows.get(name)?.firstMs);
      const readyAt = (times: Array<number | null | undefined>) =>
        times.every(ms => ms !== null && ms !== undefined) ? Math.max(...times as number[]) : null;
      return {
        elapsedMs: Math.max(0, clock() - started), firstFrameMs,
        firstSnapshotMs: firsts.length ? Math.min(...firsts) : null,
        coreSourcesReadyMs: readyAt(coreFirsts),
        personalSourcesReadyMs: readyAt(personalFirsts),
        secondarySubscriptionsStartedMs,
        allInitialSourcesReadyMs: readyAt(allFirsts),
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
    'Diagnostik Dashboard Piket Guru R113-B2 (tanpa data pengguna)',
    `Kerangka awal (frame): ${ms(summary.firstFrameMs)}`,
    `Snapshot pertama (cache/server belum dibedakan): ${ms(summary.firstSnapshotMs)}`,
    `Snapshot 3 sumber historis (konfig/jadwal/pengumuman): ${ms(summary.coreSourcesReadyMs)}`,
    `Snapshot 3 sumber personal (konfig/jadwal/master akun): ${ms(summary.personalSourcesReadyMs)}`,
    `Observer sekunder mulai: ${ms(summary.secondarySubscriptionsStartedMs)}`,
    `Semua sumber dashboard siap: ${ms(summary.allInitialSourcesReadyMs)}`,
    `Listener aktif di DashboardView: ${summary.activeListeners}`,
    `Total callback snapshot: ${summary.totalSnapshots}`,
    `Jumlah dokumen pada snapshot terakhir (semua sumber aktif): ${summary.latestDocuments}`,
    ...summary.rows.map(row => `${row.name}: ${row.active ? 'aktif' : 'nonaktif'} | awal ${ms(row.firstMs)} | ` +
      `dokumen ${row.lastDocuments ?? '—'} | callback ${row.snapshots} | error ${row.errors} | subscription ${row.subscriptions}`),
    'Catatan: callback snapshot mencakup cache/offline dan realtime; angka ini BUKAN jumlah read berbayar Firebase.',
    'Pengukuran dimulai saat DashboardView mount, bukan dari awal permintaan masuk.',
    'Tidak dapat membedakan SDK cache, offline cache, dan server dari callback bersama; bandingkan uji dengan kondisi jaringan sama.',
    'Audit hanya mencakup DashboardView, belum listener Header, Notifikasi, dan SmartCheckoutReminder.',
  ];
  return lines.join('\n');
}
