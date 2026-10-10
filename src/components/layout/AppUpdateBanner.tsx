import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { AppUpdateManager } from '../../services/offline/appUpdateManager';

export const AppUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [applyFn, setApplyFn] = useState<(() => void) | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    AppUpdateManager.init();
    const unsub = AppUpdateManager.subscribe((updateAvailable, apply) => {
      setHasUpdate(updateAvailable);
      setApplyFn(() => apply);
    });
    return () => unsub();
  }, []);

  if (!hasUpdate || dismissed || !applyFn) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm animate-fadeIn z-40">
      <div className="flex items-center gap-2.5 min-w-0">
        <Sparkles className="w-4 h-4 shrink-0 text-amber-300 animate-pulse" />
        <span className="font-semibold truncate">
          Pembaruan versi aplikasi Piket Guru tersedia.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            applyFn();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-all shadow-xs cursor-pointer active:scale-95 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Perbarui Sekarang</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
          title="Nanti"
          aria-label="Tutup pemberitahuan pembaruan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
