import React, { useEffect, useState } from 'react';
import { createDashboardPerformanceAudit, formatDashboardAudit } from './dashboardPerformanceAudit';

type Audit = ReturnType<typeof createDashboardPerformanceAudit>;

/** Hidden unless ?dashboard_diag=1. No network calls, no Firestore reads. */
export function DashboardAuditPanel({ audit }: { audit: Audit }) {
  const [summary, setSummary] = useState(() => audit.summary());
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    setSummary(audit.summary());
    const interval = window.setInterval(() => setSummary(audit.summary()), 1000);
    return () => window.clearInterval(interval);
  }, [audit]);
  const ms = (value: number | null) => value === null ? '—' : `${Math.round(value)} ms`;
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(formatDashboardAudit(audit.summary()));
      setCopyStatus('Ringkasan tersalin');
    } catch { setCopyStatus('Salin teks laporan secara manual dari panel'); }
  };
  return <details className="fixed bottom-3 right-3 z-[90] w-[min(94vw,440px)] rounded-xl border border-slate-300 bg-white/95 text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100" aria-label="Diagnostik performa dashboard">
    <summary className="cursor-pointer select-none p-3 text-xs font-semibold">Diagnostik Dashboard · R113-A</summary>
    <div className="max-h-[65vh] overflow-y-auto border-t border-slate-200 p-3 text-xs dark:border-slate-700">
      <dl className="grid grid-cols-2 gap-2">
        <div><dt>Kerangka awal (frame)</dt><dd className="font-semibold">{ms(summary.firstFrameMs)}</dd></div>
        <div><dt>Snapshot pertama</dt><dd className="font-semibold">{ms(summary.firstSnapshotMs)}</dd></div>
        <div><dt>3 sumber inti siap</dt><dd className="font-semibold">{ms(summary.coreSourcesReadyMs)}</dd></div>
        <div><dt>Listener aktif</dt><dd className="font-semibold">{summary.activeListeners}</dd></div>
        <div><dt>Callback data</dt><dd className="font-semibold">{summary.totalSnapshots}</dd></div>
        <div><dt>Dokumen snapshot terkini</dt><dd className="font-semibold">{summary.latestDocuments}</dd></div>
      </dl>
      <div className="mt-3 space-y-1" role="list" aria-label="Sumber data dashboard">
        {summary.rows.map(row => <div role="listitem" key={row.name} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-1 dark:border-slate-700">
          <span>{row.name}{row.errors > 0 ? ` (error ${row.errors})` : ''}</span>
          <span className="font-mono">{ms(row.firstMs)} · {row.lastDocuments ?? '—'} dok · {row.snapshots}×</span>
        </div>)}
      </div>
      <p className="mt-3 text-[11px] text-slate-600 dark:text-slate-300">Snapshot dapat berasal dari cache/offline. Ini bukan hitungan biaya pembacaan Firebase. Tidak menyertakan nama akun atau isi dokumen.</p>
      <button type="button" onClick={() => { void copyReport(); }} className="mt-2 min-h-10 rounded-lg bg-slate-800 px-3 py-2 font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Salin ringkasan</button>
      {copyStatus && <p role="status" className="mt-2">{copyStatus}</p>}
    </div>
  </details>;
}
