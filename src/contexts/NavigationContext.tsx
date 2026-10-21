import React, { createContext, useContext, useState, useEffect } from 'react';
import { NavigationTab } from '../types';

interface NavigationContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  navigateTo: (tab: NavigationTab, view?: string) => void;
  subView: string | null;
  setSubView: (view: string | null) => void;
}

const VALID_TABS: NavigationTab[] = [
  'dashboard',
  'command-center',
  'kiosk',
  'schedules',
  'attendance',
  'attendance-monitor',
  'duty-book',
  'incidents',
  'student-tardiness',
  'substitutions',
  'student-permits',
  'visitors',
  'reports',
  'users',
  'settings',
];

const getTabFromHash = (): NavigationTab => {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash.replace('#', '').trim();
  if (VALID_TABS.includes(hash as NavigationTab)) {
    return hash as NavigationTab;
  }
  return 'dashboard';
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<NavigationTab>(getTabFromHash);
  const [subView, setSubView] = useState<string | null>(null);

  // Sync state when browser back/forward or hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromHash();
      setActiveTabState(tab);
      setSubView(null);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigateTo = (tab: NavigationTab, view?: string) => {
    setActiveTabState(tab);
    setSubView(view || null);
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState(
          { ...window.history.state, tab },
          document.title,
          `#${tab}`
        );
      } catch {
        window.location.hash = `#${tab}`;
      }
    }
  };

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab: (tab) => handleNavigateTo(tab),
        navigateTo: handleNavigateTo,
        subView,
        setSubView,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

