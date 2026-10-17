import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { EmergencyBanner } from './EmergencyBanner';
import { ScrollToTop } from '../common/ScrollToTop';

import { AppUpdateBanner } from './AppUpdateBanner';
import { InteractiveGuideTour } from '../guide/InteractiveGuideTour';
import { useNavigation } from '../../contexts/NavigationContext';
import { ModuleAppearanceProvider } from '../../contexts/ModuleAppearanceContext';
import { getModuleStyle } from '../../config/moduleAppearance';

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_PREFS_KEY = 'piket_sidebar_prefs_v1';

interface SidebarPreferences {
  isDesktopHidden: boolean;
  isPinned: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { activeTab } = useNavigation();
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
    <ModuleAppearanceProvider value={activeTab}>
    <div
      data-module={activeTab}
      className={`app-shell text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150 min-h-dvh ${
        isPinned ? 'lg:h-dvh lg:max-h-dvh lg:overflow-hidden' : ''
      }`}
      style={{ ...getModuleStyle(activeTab), backgroundColor: 'var(--theme-bg-app)' }}
    >
      <AppUpdateBanner />
      <EmergencyBanner />
      <InteractiveGuideTour />
      <Header
        onToggleSidebar={() => setSidebarOpen(true)}
        isDesktopSidebarHidden={isDesktopHidden}
        onToggleDesktopSidebar={handleToggleDesktopHide}
      />

      <div
        className={`flex-1 flex relative ${
          isPinned ? 'lg:min-h-0 lg:overflow-hidden' : ''
        }`}
      >
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isDesktopHidden={isDesktopHidden}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
        />

        <main
          data-module={activeTab}
          id="main-content-scroll"
          className={`app-content min-w-0 flex-1 max-w-7xl mx-auto w-full transition-all duration-200 pb-20 lg:pb-8 p-3 sm:p-6 md:p-8 ${
            isPinned
              ? 'lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain'
              : 'overflow-visible'
          }`}
        >
          {children}
        </main>
      </div>

      <ScrollToTop targetSelector="#main-content-scroll" />
      <MobileNav onOpenMore={() => setSidebarOpen(true)} isMoreOpen={sidebarOpen} />
    </div>
    </ModuleAppearanceProvider>
  );
};

