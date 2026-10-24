import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from '../icons';
import { AppUpdateManager, type UpdateStage } from '../../services/offline/appUpdateManager';
import { ensurePwaUpdateSafe } from '../../services/offline/pwaUpdateSafety'; // R57-PWA-SAFETY-GATE

type BannerStage = 'idle' | UpdateStage;

export const AppUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stage, setStage] = useState<BannerStage>('idle');
  const [error, setError] = useState('');
  const updatingRef = useRef(false);
  const busy = stage !== 'idle';

  useEffect(() => {
    AppUpdateManager.init();
    return AppUpdateManager.subscribe((available) => {
      setHasUpdate(available);
      if (!available) { setDismissed(false); setError(''); }
    });
  }, []);

  const update = async () => {
    // Ref prevents rapid double-taps before React has re-rendered.
    if (updatingRef.current) return;
    updatingRef.current = true;
    setStage('activating'); // Visible feedback on the same click, even before SW I/O.
    setError('');
    // Allow the loading state to paint before the service worker is activated.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    let reloadStarted = false;
    try {
      // R57-PWA-SAFETY-GATE: preserve drafts/queue before a user-requested PWA reload.
      await ensurePwaUpdateSafe();
      await AppUpdateManager.applyUpdate(setStage);
      reloadStarted = true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pembaruan gagal. Coba lagi.');
    } finally {
      if (!reloadStarted) {
        updatingRef.current = false;
        setStage('idle');
      }
    }
  };

  if (!hasUpdate || dismissed) return null;

  const status = stage === 'checking' ? 'Memeriksa update…'
    : stage === 'activating' ? 'Mengaktifkan…'
    : stage === 'reloading' ? 'Memuat versi baru…'
    : '';

  return (
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
  );
};
