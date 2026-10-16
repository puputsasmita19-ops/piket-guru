import React from 'react';

export function PageLoading({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${fullScreen ? 'min-h-screen' : 'min-h-[35vh]'}`} style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text-primary)' }}>
      <span aria-hidden="true" className="h-8 w-8 rounded-full border-[3px] border-[var(--theme-ring)] border-t-[var(--theme-primary)] animate-spin motion-reduce:animate-none" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
