import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { authService } from '../services/auth/authService';
import { checkUserPermission, PermissionKey } from '../config/permissions';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPin: (nipOrUserId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permission: PermissionKey) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes auto logout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    authService.clearSession();
    setCurrentUser(null);
  }, []);

  // Initialize session
  useEffect(() => {
    const initAuth = async () => {
      try {
        await authService.init();
        const session = authService.getSavedSession();
        if (session) {
          setCurrentUser(session);
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Inactivity Auto Logout
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser, logout]);

  const loginWithPin = async (nipOrUserId: string, pin: string) => {
    setIsLoading(true);
    try {
      const res = await authService.authenticateWithPin(nipOrUserId, pin);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Autentikasi gagal.' };
    } finally {
      setIsLoading(false);
    }
  };

  const changePin = async (oldPin: string, newPin: string) => {
    if (!currentUser) return { success: false, error: 'Sesi tidak valid.' };
    return authService.changeUserPin(currentUser.id, oldPin, newPin);
  };

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    return checkUserPermission(currentUser.permissions, permission);
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        loginWithPin,
        logout,
        changePin,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
