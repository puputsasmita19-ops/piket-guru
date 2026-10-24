import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from '../icons';
import { Modal } from '../common/Modal';
import { AppUpdateManager, type UpdateStage } from '../../services/offline/appUpdateManager';
import { ensurePwaUpdateSafe, PwaUpdateCancelledError, type PwaPendingSummary } from '../../services/offline/pwaUpdateSafety';

type BannerStage = 'idle' | 'safety' | 'confirmation' | UpdateStage;

export const AppUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stage, setStage] = useState<BannerStage>('idle');
  const [error, setError] = useState('');
  const [pendingSummary, setPendingSummary] = useState<PwaPendingSummary | null>(null);
  const confirmationRef = useRef<((confirmed: boolean) => void) | null>(null);
  const updatingRef = useRef(false);
  const busy = stage !== 'idle';

  useEffect(() => {
    AppUpdateManager.init();
    return AppUpdateManager.subscribe((available) => {
      setHasUpdate(available);
      if (!available) {
        confirmationRef.current?.(false);
        confirmationRef.current = null;
        setPendingSummary(null);
        setDismissed(false);
        setError('');
      }
    });
  }, []);

  useEffect(() => () => {
    // Never leave an unresolved Promise if navigating away while a dialog is open.
    confirmationRef.current?.(false);
    confirmationRef.current = null;
  }, []);

  const answerConfirmation = (confirmed: boolean) => {
    const resolve = confirmationRef.current;
    confirmationRef.current = null;
    setPendingSummary(null);
    resolve?.(confirmed);
  };

  const askBeforeUpdate = (summary: PwaPendingSummary): Promise<boolean> => new Promise((resolve) => {
    confirmationRef.current = resolve;
    setPendingSummary(summary);
    setStage('confirmation');
  });

  const update = async () => {
    // Ref prevents rapid double-taps before React has re-rendered.
    if (updatingRef.current) return;
    updatingRef.current = true;
    setStage('safety'); // Immediate feedback while checking local storage.
    setError('');
    // Allow the loading state to paint before the service worker is activated.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    let reloadStarted = false;
    try {
      // Keep R57/R68 fail-closed checks; only this React dialog can approve.
      await ensurePwaUpdateSafe(askBeforeUpdate);
      await AppUpdateManager.applyUpdate(setStage);
      reloadStarted = true;
    } catch (reason) {
      if (!(reason instanceof PwaUpdateCancelledError)) {
        setError(reason instanceof Error ? reason.message : 'Pembaruan gagal. Coba lagi.');
      }
    } finally {
      if (!reloadStarted) {
        updatingRef.current = false;
        setStage('idle');
      }
    }
  };

  if (!hasUpdate || dismissed) return null;

  const status = stage === 'safety' ? 'Memeriksa data lokal…'
    : stage === 'confirmation' ? 'Menunggu pilihan Anda…'
    : stage === 'checking' ? 'Memeriksa update…'
    : stage === 'activating' ? 'Mengaktifkan…'
    : stage === 'reloading' ? 'Memuat versi baru…'
    : '';

  return (
    <>
    <div
      className="relative z-40 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-3 py-2 text-white shadow-sm"
      role="region"
      aria-label="Pembaruan aplikasi tersedia"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
          <span className="min-w-0 truncate text-xs font-semibold sm:text-sm" aria-live="polite">
            {busy ? (
              <>{status}</>
            ) : (
              <><span className="sm:hidden">Update tersedia</span><span className="hidden sm:inline">Versi baru Piket Guru tersedia</span></>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => { void update(); }}
            disabled={busy}
            aria-busy={busy}
            aria-label={busy ? status : 'Perbarui aplikasi sekarang'}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-bold text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-90 sm:min-h-9 sm:text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${busy ? 'animate-spin' : ''}`} />
            <span className="sm:hidden">{busy ? 'Proses…' : 'Perbarui'}</span>
            <span className="hidden sm:inline">{busy ? 'Memproses…' : 'Perbarui sekarang'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={busy}
            className="inline-flex min-h-10 min-w-9 items-center justify-center rounded-lg hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50 sm:min-h-9"
            title="Nanti"
            aria-label="Tutup pemberitahuan update"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] text-white sm:text-xs">{error}</p>}
    </div>
    <Modal
      isOpen={pendingSummary !== null}
      onClose={() => answerConfirmation(false)}
      title="Data Belum Selesai Dikirim"
      maxWidth="md"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => answerConfirmation(false)}
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-sky-500">
          Nanti Saja
        </button>
        <button type="button" onClick={() => answerConfirmation(true)}
          className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700 focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2">
          Perbarui Sekarang
        </button>
      </div>}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3l8-14Z" />
            <path d="M12 9v4.5" /><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="min-w-0 space-y-3">
          <p className="leading-relaxed">Masih ada data yang tersimpan di perangkat ini. Sebagian belum dikirim ke server. Pastikan data penting sudah diselesaikan sebelum memperbarui aplikasi.</p>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {!!pendingSummary?.draftsCount && <li><strong>{pendingSummary.draftsCount}</strong> draf lokal tersimpan</li>}
            {!!pendingSummary?.syncQueueCount && <li><strong>{pendingSummary.syncQueueCount}</strong> kiriman menunggu sinkronisasi</li>}
          </ul>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Draf pada perangkat tepercaya tetap disimpan secara lokal. Memperbarui aplikasi tidak berarti data sudah diterima server.</p>
        </div>
      </div>
    </Modal>
    </>
  );
};
