import React from 'react';
import { Loader2 } from '../icons';
import { useSlowOperation } from '../../hooks/useSlowOperation';

export function PageLoading({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  const slow = useSlowOperation(true);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-800 dark:text-slate-100 ${fullScreen ? 'min-h-dvh' : 'min-h-[35vh]'}`} style={{ backgroundColor: 'var(--theme-bg-app)' }}>
      <Loader2 className="h-8 w-8 text-[var(--theme-primary)] animate-spin motion-reduce:animate-none" />
      <p className="text-sm font-medium">{label}</p>
      {slow && <div className="max-w-xs space-y-3">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Pemuatan masih berlangsung. Periksa koneksi internet Anda.</p>
        {fullScreen && <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]">Muat ulang</button>}
      </div>}
    </div>
  );
}
