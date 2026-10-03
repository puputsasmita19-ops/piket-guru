import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { authService } from '../services/auth/authService';
import { auth } from '../services/firebase/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { validateFirebaseUserProfile } from '../services/auth/authProfileValidator';
import { checkUserPermission, PermissionKey } from '../config/permissions';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPin: (nipOrUserId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePin: (
    oldPin: string,
    newPin: string
  ) => Promise<{
    success: boolean;
    error?: string;
    refreshRevocation?: { status: 'REVOKED' | 'PENDING_RETRY'; attempts: number; error?: string };
  }>;
  hasPermission: (permission: PermissionKey) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes auto logout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // R21-02: Initial state starts as null; never restore authenticated state from localStorage when fbUser is null
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    authService.clearSession();
    setCurrentUser(null);
  }, []);

  // Listen to Firebase Auth state changes and strictly sync active profile from database (REV-07)
  // Local cache is NEVER the authority for session validity or user roles.
  useEffect(() => {
    let isMounted = true;

    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (!fbUser) {
        if (isMounted) {
          authService.clearSession();
          setCurrentUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const valRes = await validateFirebaseUserProfile(fbUser);
        if (!valRes.success || !valRes.profile) {
          console.warn('[AUTH_CONTEXT] User profile validation failed:', valRes.error);
          if (isMounted) logout();
          return;
        }

        if (isMounted) {
          setCurrentUser(valRes.profile);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[AUTH_CONTEXT] Failed to verify active Firebase session:', err);
        if (isMounted) {
          logout();
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [logout]);

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

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      // R21-04: No client role assignment or client profile creation based on email.
      // Must validate against trusted server-provisioned profile in database via strict validator.
      const valRes = await validateFirebaseUserProfile(fbUser, { isLoginWithGoogle: true });
      if (!valRes.success || !valRes.profile) {
        await signOut(auth);
        authService.clearSession();
        setCurrentUser(null);
        return {
          success: false,
          error: valRes.error || 'Akun Google ini tidak terdaftar atau belum diaktifkan dalam database sekolah.',
        };
      }

      setCurrentUser(valRes.profile);
      return { success: true };
    } catch (err: any) {
      console.error('[AUTH_CONTEXT] Google Sign-In error:', err);
      return { success: false, error: err.message || 'Gagal masuk dengan Google.' };
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
        loginWithGoogle,
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
