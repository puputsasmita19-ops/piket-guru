import React, { useRef, useEffect } from 'react';
import { HelpCircle, Play, X, Sparkles, BookOpen } from '../icons';
import { useGuide } from '../../contexts/GuideContext';
import { Tooltip } from '../common/Tooltip';

interface GuideHelpButtonProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export const GuideHelpButton: React.FC<GuideHelpButtonProps> = ({
  isOpen: controlledIsOpen,
  onToggle,
  onClose: controlledOnClose,
}) => {
  const {
    showOnLogin,
    setShowOnLogin,
    isGuideMenuOpen: contextIsGuideMenuOpen,
    toggleGuideMenu,
    closeGuideMenu,
    startGuideTour,
  } = useGuide();
  const containerRef = useRef<HTMLDivElement>(null);

  const isGuideMenuOpen = controlledIsOpen !== undefined ? controlledIsOpen : contextIsGuideMenuOpen;

  const handleClose = () => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      closeGuideMenu();
    }
  };

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      toggleGuideMenu();
    }
  };

  const launchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup launch timer on unmount
  useEffect(() => {
    return () => {
      if (launchTimerRef.current) {
        clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isGuideMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGuideMenuOpen]);

  return (
    <div ref={containerRef} data-tour="guide-help-button" className="relative z-40 shrink-0 inline-block">
      {/* Help Icon Header Button */}
      <Tooltip content="Panduan Penggunaan" position="bottom">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isGuideMenuOpen}
          aria-haspopup="true"
          aria-label="Panduan penggunaan"
          title="Panduan penggunaan"
          className="header-icon-button flex"
        >
          <HelpCircle className="w-5 h-5 shrink-0" />
        </button>
      </Tooltip>

      {/* Popover Menu: Panduan Penggunaan */}
      {isGuideMenuOpen && (
        <div
          role="dialog"
          aria-label="Menu Panduan Penggunaan"
          onClick={(e) => e.stopPropagation()}
          className="fixed top-16 right-3.5 left-3.5 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 w-auto sm:w-[320px] max-w-[calc(100vw-28px)] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-[var(--theme-card-border)] z-50 animate-in fade-in zoom-in-95 duration-150 p-4 space-y-4"
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[var(--theme-card-border)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary)] flex items-center justify-center shrink-0 border border-[var(--theme-primary-border)]/50">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  Panduan Penggunaan
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Opsi & tur interaktif aplikasi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
              aria-label="Tutup menu panduan"
              title="Tutup (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-Guide Toggle Control Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/60 border border-slate-200/80 dark:border-[var(--theme-card-border)] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="auto-guide-toggle"
                className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug cursor-pointer select-none"
              >
                Tampilkan panduan otomatis saat masuk
              </label>

              {/* Switch Toggle */}
              <button
                id="auto-guide-toggle"
                type="button"
                role="switch"
                aria-checked={showOnLogin}
                onClick={() => setShowOnLogin(!showOnLogin)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
                  showOnLogin
                    ? 'bg-[var(--theme-primary)]'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    showOnLogin ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Jika aktif, panduan muncul setiap kali Anda login.
            </p>
          </div>

          {/* Manual Launch Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClose();
                if (launchTimerRef.current) clearTimeout(launchTimerRef.current);
                launchTimerRef.current = setTimeout(() => {
                  startGuideTour();
                }, 50);
              }}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[var(--theme-primary)] hover:opacity-90 active:scale-[0.98] text-[var(--theme-primary-contrast)] font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[var(--theme-ring)] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Mulai Panduan</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 font-medium">
              Jelajahi fitur utama aplikasi langkah demi langkah
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


