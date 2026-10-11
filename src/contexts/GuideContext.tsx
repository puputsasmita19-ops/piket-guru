import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface GuideContextType {
  showOnLogin: boolean;
  setShowOnLogin: (val: boolean) => void;
  isGuideTourActive: boolean;
  startGuideTour: () => void;
  stopGuideTour: () => void;
  isGuideMenuOpen: boolean;
  openGuideMenu: () => void;
  closeGuideMenu: () => void;
  toggleGuideMenu: () => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
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

  // Sync preference state when currentUser changes
  useEffect(() => {
    if (!currentUser?.id) return;
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
    const alreadyShownInSession = sessionStorage.getItem(sessionKey);

    if (showOnLogin && !alreadyShownInSession) {
      // Delay briefly to allow main dashboard and DOM to render cleanly
      const timer = setTimeout(() => {
        setIsGuideTourActive(true);
        try {
          sessionStorage.setItem(sessionKey, 'true');
        } catch {}
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentUser?.id, showOnLogin]);

  const startGuideTour = useCallback(() => {
    setIsGuideMenuOpen(false);
    setIsGuideTourActive(true);
  }, []);

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
      stopGuideTour: () => {},
      isGuideMenuOpen: false,
      openGuideMenu: () => {},
      closeGuideMenu: () => {},
      toggleGuideMenu: () => {},
    };
  }
  return context;
};

