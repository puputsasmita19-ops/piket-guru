import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { EmergencyBanner } from './EmergencyBanner';
import { ScrollToTop } from '../common/ScrollToTop';
import { PanelLeftOpen } from 'lucide-react';

import { AppUpdateBanner } from './AppUpdateBanner';

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_PREFS_KEY = 'piket_sidebar_prefs_v1';

interface SidebarPreferences {
  isDesktopHidden: boolean;
  isPinned: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Mobile drawer state (always starts closed on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop sidebar preferences stored in localStorage
  const [preferences, setPreferences] = useState<SidebarPreferences>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SIDEBAR_PREFS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            isDesktopHidden: typeof parsed.isDesktopHidden === 'boolean' ? parsed.isDesktopHidden : false,
            isPinned: typeof parsed.isPinned === 'boolean' ? parsed.isPinned : true,
          };
        }
      }
    } catch {}
    return {
      isDesktopHidden: false,
      isPinned: true,
    };
  });

  const { isDesktopHidden, isPinned } = preferences;

  // Persist preference to localStorage
  const updatePreferences = (newPrefs: Partial<SidebarPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleToggleDesktopHide = () => {
    updatePreferences({ isDesktopHidden: !isDesktopHidden });
  };

  const handleTogglePin = () => {
    updatePreferences({ isPinned: !isPinned });
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
        e.preventDefault();
        handleToggleDesktopHide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktopHidden]);

  return (
    <div
      className={`text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150 ${
        isPinned ? 'min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden' : 'min-h-screen'
      }`}
      style={{ backgroundColor: 'var(--theme-bg-app)' }}
    >
      <AppUpdateBanner />
      <EmergencyBanner />
      <Header
        onToggleSidebar={() => setSidebarOpen(true)}
        isDesktopSidebarHidden={isDesktopHidden}
        onToggleDesktopSidebar={handleToggleDesktopHide}
      />

      <div
        className={`flex-1 flex relative ${
          isPinned ? 'min-h-0 overflow-hidden' : ''
        }`}
      >
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isDesktopHidden={isDesktopHidden}
          onToggleDesktopHide={handleToggleDesktopHide}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
        />

        {/* Floating reopen button on desktop when sidebar is hidden */}
        {isDesktopHidden && (
          <button
            type="button"
            onClick={handleToggleDesktopHide}
            className="hidden lg:flex fixed left-4 top-20 z-30 items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 dark:bg-[var(--theme-card-bg)]/95 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[var(--theme-card-border)] shadow-md hover:shadow-lg hover:text-[var(--theme-primary)] dark:hover:text-[var(--theme-primary-text)] backdrop-blur-md transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95 text-xs font-semibold print:hidden"
            aria-label="Tampilkan panel navigasi (Ctrl+B)"
            title="Tampilkan panel navigasi (Ctrl+B)"
          >
            <PanelLeftOpen className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
            <span>Buka Menu</span>
          </button>
        )}

        <main
          id="main-content-scroll"
          className={`flex-1 max-w-7xl mx-auto w-full transition-all duration-200 pb-20 lg:pb-8 p-3 sm:p-6 md:p-8 ${
            isPinned
              ? 'min-h-0 overflow-y-auto overscroll-contain'
              : 'overflow-visible'
          }`}
        >
          {children}
        </main>
      </div>

      <ScrollToTop targetSelector="#main-content-scroll" />
      <MobileNav onOpenMore={() => setSidebarOpen(true)} />
    </div>
  );
};
