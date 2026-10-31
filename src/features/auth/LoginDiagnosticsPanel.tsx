import React, { useEffect, useState } from 'react';
import { getLoginDiagnosticsEventName, readLoginDiagnostics, type LoginDiagnostics } from './loginDiagnostics';

const showMs = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? `${(Number(value) / 1000).toFixed(2)} dtk` : '—';

/** Numeric-only opt-in mobile diagnostics. No account name, PIN, UID, or token. */
export default function LoginDiagnosticsPanel() {
  const [report, setReport] = useState<LoginDiagnostics | null>(() => readLoginDiagnostics());
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const handleUpdate = () => {
      const next = readLoginDiagnostics();
      setReport(next);
      if (next?.totalMs != null) setExpanded(true);
    };
    window.addEventListener(getLoginDiagnosticsEventName(), handleUpdate);
    handleUpdate();
    return () => window.removeEventListener(getLoginDiagnosticsEventName(), handleUpdate);
  }, []);

  const server = report?.serverMs;
  const overhead = report?.pinApiMs != null && server?.total != null
    ? Math.max(0, report.pinApiMs - server.total)
    : undefined;
  const breakdown = [
    ['Total PIN → sesi', report?.totalMs],
    ['API + jaringan', report?.pinApiMs],
    ['Backend', server?.total],
    ['Jaringan/API overhead', overhead],
    ['Firebase sign-in', report?.firebaseMs],
    ['Kerangka dashboard tampil', report?.shellVisibleMs],
    ['Server: rate-limit gate', server?.gate],
    ['Server: cari akun', server?.lookup],
    ['Server: lock akun', server?.lock],
    ['Server: cek PIN', server?.pin],
    ['Server: reset rate-limit', server?.rateReset],
    ['Server: tanda tangan token', server?.signer],
  ] as const;
  const shareText = [
    'Diagnostik Login Piket Guru (ms, tanpa data akun)',
    ...breakdown.map(([label, ms]) => `${label}: ${ms ?? 'tidak tersedia'}`),
    'Catatan: server dan jaringan bisa overlap; durasi kerangka dashboard bukan waktu seluruh data selesai.',
  ].join('\n');

  return (
    <aside aria-label="Diagnostik waktu login" className="fixed bottom-3 right-3 z-[120] w-[min(350px,calc(100vw-24px))] rounded-2xl border border-slate-300 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-xl backdrop-blur-md text-xs">
      <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 font-semibold text-left">
        <span>Diagnostik Login · {showMs(report?.totalMs)}</span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-4 pt-2 max-h-[65vh] overflow-y-auto space-y-2">
          <p className="text-slate-500 dark:text-slate-400">Hanya aktif dengan ?login_diag=1. Tidak menyimpan PIN atau identitas akun.</p>
          <dl className="space-y-1.5">
            {breakdown.map(([label, duration]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt>{label}</dt>
                <dd className="font-semibold tabular-nums shrink-0">{showMs(duration)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-slate-500 dark:text-slate-400">Total = tombol Masuk hingga autentikasi selesai. Waktu "kerangka dashboard" sejak tombol Masuk sampai komponen halaman terpasang, bukan sampai seluruh data selesai.</p>
          <button type="button" className="min-h-11 rounded-xl px-4 border border-slate-300 dark:border-slate-600 font-semibold"
            onClick={() => { void navigator.clipboard?.writeText(shareText).then(() => setCopied(true)).catch(() => setCopied(false)); }}>
            {copied ? 'Ringkasan tersalin' : 'Salin ringkasan waktu'}
          </button>
        </div>
      )}
    </aside>
  );
}
