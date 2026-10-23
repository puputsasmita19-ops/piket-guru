import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from '../icons';
import { AppUpdateManager } from '../../services/offline/appUpdateManager';

export const AppUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    AppUpdateManager.init();
    return AppUpdateManager.subscribe((available) => {
      setHasUpdate(available);
      if (!available) { setDismissed(false); setError(''); }
    });
  }, []);

  const update = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await AppUpdateManager.applyUpdate();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Update gagal. Silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="relative z-40 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white px-2.5 sm:px-4 py-2 shadow-sm animate-fadeIn" role="region" aria-label="Pembaruan aplikasi tersedia">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-200" aria-hidden="true" />
          <span className="font-semibold text-xs sm:text-sm min-w-0 truncate">
            <span className="sm:hidden">Update tersedia</span>
            <span className="hidden sm:inline">Update Piket Guru tersedia</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { void update(); }}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex min-h-10 sm:min-h-9 items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 sm:px-3 font-bold text-[11px] sm:text-xs text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70 disabled:cursor-wait"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${busy ? 'animate-spin' : ''}`} />
            <span className="sm:hidden">{busy ? 'Memuat…' : 'Perbarui'}</span>
            <span className="hidden sm:inline">{busy ? 'Memperbarui…' : 'Perbarui sekarang'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={busy}
            className="inline-flex items-center justify-center min-h-10 min-w-9 sm:min-h-9 rounded-lg hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60"
            title="Nanti"
            aria-label="Tutup pemberitahuan update"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-1.5 text-[11px] sm:text-xs text-white">{error}</p>}
    </div>
  );
};
