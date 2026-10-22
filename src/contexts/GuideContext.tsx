import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';

export type GuideTourMode = 'full' | 'quick';

interface GuideContextType {
  showOnLogin: boolean;
  setShowOnLogin: (val: boolean) => void;
  isGuideTourActive: boolean;
  startGuideTour: (mode?: GuideTourMode) => void;
  guideTourMode: GuideTourMode;
  isWelcomeGuideOpen: boolean;
  dismissWelcomeGuide: () => void;
  stopGuideTour: () => void;
  isGuideMenuOpen: boolean;
  openGuideMenu: () => void;
  closeGuideMenu: () => void;
  toggleGuideMenu: () => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { activeTab } = useNavigation();
  const userId = currentUser?.id || 'guest';

  // Preference for auto-showing guide on login (stored in localStorage per user ID)
  // DEFAULT: false (OFF) if not set yet per requirements
  const [showOnLogin, setShowOnLoginState] = useState<boolean>(() => {
    try {
      if (!userId || userId === 'guest') return false;
      const saved = localStorage.getItem(`piket_guide_show_on_login_${userId}`);
      return saved === null ? false : saved === 'true';
    } catch {
      return false;
    }
  });

  const [isGuideMenuOpen, setIsGuideMenuOpen] = useState<boolean>(false);
  const [isGuideTourActive, setIsGuideTourActive] = useState<boolean>(false);
  const [guideTourMode, setGuideTourMode] = useState<GuideTourMode>('full');
  const [isWelcomeGuideOpen, setIsWelcomeGuideOpen] = useState(false);
  const previousUserId = useRef<string | null>(null);

  // Sync preference state when currentUser changes
  useEffect(() => {
    if (!currentUser?.id || (previousUserId.current && previousUserId.current !== currentUser.id)) {
      setIsGuideMenuOpen(false);
      setIsGuideTourActive(false);
      setIsWelcomeGuideOpen(false);
    }
    if (!currentUser?.id && previousUserId.current) {
      try { sessionStorage.removeItem(`piket_guide_shown_session_${previousUserId.current}`); } catch {}
    }
    previousUserId.current = currentUser?.id || null;
    if (!currentUser?.id) {
      setShowOnLoginState(false);
      return;
    }
    try {
      const saved = localStorage.getItem(`piket_guide_show_on_login_${currentUser.id}`);
      setShowOnLoginState(saved === null ? false : saved === 'true');
    } catch {
      setShowOnLoginState(false);
    }
  }, [currentUser?.id]);

  const setShowOnLogin = useCallback((val: boolean) => {
    setShowOnLoginState(val);
    if (currentUser?.id) {
      try {
        localStorage.setItem(`piket_guide_show_on_login_${currentUser.id}`, String(val));
      } catch (err) {
        console.warn('Failed to save guide preference to localStorage:', err);
      }
    }
  }, [currentUser?.id]);

  // Trigger guide ONCE after successful login if showOnLogin is enabled
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const sessionKey = `piket_guide_shown_session_${currentUser.id}`;
    let alreadyShownInSession: string | null = null;
    try { alreadyShownInSession = sessionStorage.getItem(sessionKey); } catch {}

    if (showOnLogin && !alreadyShownInSession) {
      // Delay briefly to allow main dashboard and DOM to render cleanly
      const timer = setTimeout(() => {
        setGuideTourMode('full');
        setIsWelcomeGuideOpen(false);
        try { localStorage.setItem(`piket_guide_welcome_v1_${currentUser.id}`, 'seen'); } catch {}
        setIsGuideTourActive(true);
        try {
          sessionStorage.setItem(sessionKey, 'true');
        } catch {}
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentUser?.id, showOnLogin]);

  // Show only a small invitation on a user's first visit on this device.
  // Never start a tour without consent or interrupt a manual/full tour.
  useEffect(() => {
    if (activeTab !== 'dashboard') setIsWelcomeGuideOpen(false);
    if (!isAuthenticated || !currentUser?.id || activeTab !== 'dashboard' || showOnLogin || isGuideTourActive) return;
    const key = `piket_guide_welcome_v1_${currentUser.id}`;
    try { if (localStorage.getItem(key)) return; } catch { return; }
    const timer = setTimeout(() => {
      try { if (!localStorage.getItem(key)) setIsWelcomeGuideOpen(true); } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [isAuthenticated, currentUser?.id, activeTab, showOnLogin, isGuideTourActive]);

  const dismissWelcomeGuide = useCallback(() => {
    setIsWelcomeGuideOpen(false);
    if (currentUser?.id) {
      try { localStorage.setItem(`piket_guide_welcome_v1_${currentUser.id}`, 'seen'); } catch {}
    }
  }, [currentUser?.id]);

  const startGuideTour = useCallback((mode: GuideTourMode = 'full') => {
    dismissWelcomeGuide();
    setIsGuideMenuOpen(false);
    setGuideTourMode(mode);
    setIsGuideTourActive(true);
  }, [dismissWelcomeGuide]);

  const stopGuideTour = useCallback(() => {
    setIsGuideTourActive(false);
    if (currentUser?.id) {
      try {
        sessionStorage.setItem(`piket_guide_shown_session_${currentUser.id}`, 'true');
      } catch {}
    }
  }, [currentUser?.id]);

  const openGuideMenu = useCallback(() => setIsGuideMenuOpen(true), []);
  const closeGuideMenu = useCallback(() => setIsGuideMenuOpen(false), []);
  const toggleGuideMenu = useCallback(() => setIsGuideMenuOpen((prev) => !prev), []);

  return (
    <GuideContext.Provider
      value={{
        showOnLogin,
        setShowOnLogin,
        isGuideTourActive,
        startGuideTour,
        guideTourMode,
        isWelcomeGuideOpen,
        dismissWelcomeGuide,
        stopGuideTour,
        isGuideMenuOpen,
        openGuideMenu,
        closeGuideMenu,
        toggleGuideMenu,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = (): GuideContextType => {
  const context = useContext(GuideContext);
  if (!context) {
    return {
      showOnLogin: false,
      setShowOnLogin: () => {},
      isGuideTourActive: false,
      startGuideTour: () => {},
      guideTourMode: 'full',
      isWelcomeGuideOpen: false,
      dismissWelcomeGuide: () => {},
      stopGuideTour: () => {},
      isGuideMenuOpen: false,
      openGuideMenu: () => {},
      closeGuideMenu: () => {},
      toggleGuideMenu: () => {},
    };
  }
  return context;
};

