import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, MapPin, BookOpenCheck, Wifi, ShieldCheck, X } from 'lucide-react';

export const GuideHelpButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Guide Help Icon Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Panduan penggunaan"
        title="Panduan penggunaan"
        className="p-2 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors relative cursor-pointer min-w-[40px] xs:min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95"
      >
        <HelpCircle className="w-5 h-5 shrink-0" />
      </button>

      {/* Manual Guide Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panduan Penggunaan Aplikasi"
          className="fixed top-16 left-3.5 right-3.5 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-28px)] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-[var(--theme-card-border)] z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 select-none text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[var(--theme-card-border)] pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center shrink-0 border border-[var(--theme-primary-border)]/50">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  Panduan Penggunaan
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  Petunjuk singkat operasional Piket Guru
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Tutup (Esc)"
              aria-label="Tutup Panduan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Guidelines Points */}
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block text-[11px]">
                  Presensi Mandiri GPS
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  Lakukan swafoto selfie langsung di lokasi sekolah. Presensi valid jika dalam radius geofence.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <BookOpenCheck className="w-4 h-4 text-[var(--theme-primary)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block text-[11px]">
                  Buku Piket Digital
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  Isi laporan harian, kondisi KBM, kebersihan, dan jurnal kejadian selama bertugas.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <Wifi className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block text-[11px]">
                  Ketahanan Mode Offline
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  Jika jaringan terputus, data otomatis tersimpan di draf dan terkirim saat internet kembali online.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
