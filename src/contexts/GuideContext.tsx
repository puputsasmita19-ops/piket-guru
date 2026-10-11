import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface GuideContextType {
  showOnLogin: boolean;
  setShowOnLogin: (val: boolean) => void;
  isGuideModalOpen: boolean;
  openGuideModal: () => void;
  closeGuideModal: () => void;
  dismissGuideForSession: () => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const userId = currentUser?.id || 'guest';

  // Preference for auto-showing guide on login (stored in localStorage per user ID)
  const [showOnLogin, setShowOnLoginState] = useState<boolean>(() => {
    try {
      if (!userId || userId === 'guest') return true;
      const saved = localStorage.getItem(`piket_guide_show_on_login_${userId}`);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);

  // Sync preference state when currentUser changes
  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const saved = localStorage.getItem(`piket_guide_show_on_login_${currentUser.id}`);
      setShowOnLoginState(saved === null ? true : saved === 'true');
    } catch {
      setShowOnLoginState(true);
    }
  }, [currentUser?.id]);

  const setShowOnLogin = (val: boolean) => {
    setShowOnLoginState(val);
    if (currentUser?.id) {
      try {
        localStorage.setItem(`piket_guide_show_on_login_${currentUser.id}`, String(val));
      } catch (err) {
        console.warn('Failed to save guide preference to localStorage:', err);
      }
    }
  };

  // Trigger guide ONCE after successful login if showOnLogin is enabled
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const sessionKey = `piket_guide_shown_session_${currentUser.id}`;
    const alreadyShownInSession = sessionStorage.getItem(sessionKey);

    if (showOnLogin && !alreadyShownInSession) {
      // Delay briefly to allow main dashboard to render cleanly
      const timer = setTimeout(() => {
        setIsGuideModalOpen(true);
        try {
          sessionStorage.setItem(sessionKey, 'true');
        } catch {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentUser?.id, showOnLogin]);

  const openGuideModal = () => setIsGuideModalOpen(true);
  const closeGuideModal = () => setIsGuideModalOpen(false);
  const dismissGuideForSession = () => {
    setIsGuideModalOpen(false);
    if (currentUser?.id) {
      try {
        sessionStorage.setItem(`piket_guide_shown_session_${currentUser.id}`, 'true');
      } catch {}
    }
  };

  return (
    <GuideContext.Provider
      value={{
        showOnLogin,
        setShowOnLogin,
        isGuideModalOpen,
        openGuideModal,
        closeGuideModal,
        dismissGuideForSession,
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
      showOnLogin: true,
      setShowOnLogin: () => {},
      isGuideModalOpen: false,
      openGuideModal: () => {},
      closeGuideModal: () => {},
      dismissGuideForSession: () => {},
    };
  }
  return context;
};
