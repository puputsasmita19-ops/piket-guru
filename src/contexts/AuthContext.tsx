import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { authService } from '../services/auth/authService';
import { auth } from '../services/firebase/firebaseAuth';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { validateFirebaseUserProfile } from '../services/auth/authProfileValidator';
import { checkUserPermission, PermissionKey } from '../config/permissions';
import { preloadAuthenticatedShell } from '../appBootstrap';

import { OfflineStorage } from '../services/offline/offlineStorage';
import { SyncQueueService } from '../services/offline/syncQueueService';
import { AlertTriangle } from '../components/icons';
import { AuditService } from '../services/audit/auditService';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  isOfflineSession: boolean;
  isTrustedDevice: boolean;
  setTrustedDevice: (trusted: boolean) => void;
  revalidateSessionOnline: () => Promise<boolean>;
  loginWithPin: (
    nipOrUserId: string,
    pin: string
  ) => Promise<{
    success: boolean;
    error?: string;
    remainingAttempts?: number;
    isLocked?: boolean;
    remainingSeconds?: number;
  }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: (options?: { purgeUserData?: boolean; reason?: 'MANUAL' | 'INACTIVITY_TIMEOUT' | 'ACCOUNT_DEACTIVATED' | 'SESSION_INVALID' }) => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isTrustedDeviceState, setIsTrustedDeviceState] = useState(() => OfflineStorage.isTrustedDevice());

  // Unified authentication tracking to eliminate duplicate validations and race conditions
  const sessionEpochRef = React.useRef<number>(1);
  const manualLoginEpochRef = React.useRef<number | null>(null);
  const logoutInProgressRef = React.useRef(false);

  const setTrustedDevice = useCallback((trusted: boolean) => {
    OfflineStorage.setTrustedDevice(trusted);
    setIsTrustedDeviceState(trusted);
  }, []);

  // State for pending unsynced offline data modal confirmation on logout
  const [pendingLogoutPrompt, setPendingLogoutPrompt] = useState<{
    counts: { syncQueueCount: number; draftsCount: number; total: number };
    options?: { purgeUserData?: boolean; reason?: 'MANUAL' | 'INACTIVITY_TIMEOUT' | 'ACCOUNT_DEACTIVATED' | 'SESSION_INVALID' };
  } | null>(null);

  const execLogout = useCallback(async (options?: { purgeUserData?: boolean; reason?: 'MANUAL' | 'INACTIVITY_TIMEOUT' | 'ACCOUNT_DEACTIVATED' | 'SESSION_INVALID' }) => {
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    const logoutEpoch = ++sessionEpochRef.current;
    const currentUser = currentUserRef.current;

    if (currentUser) {
      if (options?.reason === 'INACTIVITY_TIMEOUT') {
        void AuditService.log({
          action: 'LOGOUT',
          module: 'USERS',
          status: 'SUCCESS',
          details: 'Sesi berakhir otomatis karena inaktivitas pengguna (30 menit)',
          userId: currentUser.id,
          userName: currentUser.fullName,
          role: currentUser.role,
          loginId: currentUser.loginId,
          metadata: { reason: 'INACTIVITY_TIMEOUT' },
        });
      } else if (options?.reason === 'SESSION_INVALID') {
        void AuditService.log({
          action: 'SECURITY', module: 'USERS', status: 'BLOCKED',
          details: 'Sesi berakhir karena verifikasi akun ditolak atau tidak dapat diselesaikan',
          userId: currentUser.id, userName: currentUser.fullName, role: currentUser.role,
          metadata: { reason: 'SESSION_INVALID' },
        });
      } else if (options?.reason === 'ACCOUNT_DEACTIVATED') {
        void AuditService.log({
          action: 'SECURITY',
          module: 'USERS',
          status: 'BLOCKED',
          details: 'Sesi dicabut: Akun dinonaktifkan oleh administrator',
          userId: currentUser.id,
          userName: currentUser.fullName,
          role: currentUser.role,
          loginId: currentUser.loginId,
          metadata: { reason: 'ACCOUNT_DEACTIVATED' },
        });
      } else {
        void AuditService.log({
          action: 'LOGOUT',
          module: 'USERS',
          status: 'SUCCESS',
          details: 'Logout manual dari aplikasi',
          userId: currentUser.id,
          userName: currentUser.fullName,
          role: currentUser.role,
          loginId: currentUser.loginId,
        });
      }
    }

    try {
      await authService.clearSession({ purgeUserData: options?.purgeUserData, userId: currentUser?.id });
    } finally {
      logoutInProgressRef.current = false;
      if (logoutEpoch === sessionEpochRef.current) {
        setCurrentUser(null);
        setIsOfflineSession(false);
        setIsLoading(false);
        setPendingLogoutPrompt(null);
      }
    }
  }, []);

  const logout = useCallback(async (options?: { force?: boolean; purgeUserData?: boolean; reason?: 'MANUAL' | 'INACTIVITY_TIMEOUT' | 'ACCOUNT_DEACTIVATED' | 'SESSION_INVALID' }) => {
    const currentUser = currentUserRef.current;
    if (currentUser?.id && !options?.force && options?.reason !== 'ACCOUNT_DEACTIVATED' && options?.reason !== 'SESSION_INVALID') {
      try {
        const counts = await OfflineStorage.getPendingCount(currentUser.id);
        if (counts.total > 0) {
          setPendingLogoutPrompt({ counts, options });
          return;
        }
      } catch (err) {
        console.warn('[AUTH_CONTEXT] Error inspecting pending counts on logout:', err);
      }
    }
    await execLogout(options);
  }, [execLogout]);

  // Revalidate session with server when network reconnects
  const revalidateSessionOnline = useCallback(async (): Promise<boolean> => {
    if (!auth?.currentUser || manualLoginEpochRef.current !== null || logoutInProgressRef.current) return false;
    const epoch = sessionEpochRef.current;
    const user = auth.currentUser;
    try {
      const valRes = await validateFirebaseUserProfile(user, { clearInvalidSession: false });
      if (epoch !== sessionEpochRef.current || auth.currentUser?.uid !== user.uid) return false;
      if (valRes.success && valRes.profile) {
        setCurrentUser(valRes.profile);
        setIsOfflineSession(!!valRes.isOfflineSession);
        if (valRes.isOfflineSession) return false;
        // Automatically attempt queue sync on revalidation
        SyncQueueService.triggerSync(valRes.profile).catch(() => {});
        return true;
      } else {
        console.warn('[AUTH_CONTEXT] Revalidation online rejected by server:', valRes.error);
        await execLogout({ reason: 'SESSION_INVALID' });
        return false;
      }
    } catch (e) {
      console.error('[AUTH_CONTEXT] Online revalidation error:', e);
      return false;
    }
  }, [execLogout]);

  // Network online/offline event listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      revalidateSessionOnline();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [revalidateSessionOnline]);

  // Listen to Firebase Auth state changes and strictly sync active profile from database (REV-07)
  // Local cache is NEVER the authority for session validity or user roles.
  useEffect(() => {
    let isMounted = true;

    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      // Explicit PIN/Google login owns its verification, including SDK events
      // emitted before signIn resolves. Do not start a second profile request.
      if (manualLoginEpochRef.current !== null || logoutInProgressRef.current) return;
      const activeEpoch = ++sessionEpochRef.current;
      if (!fbUser) {
        if (isMounted && activeEpoch === sessionEpochRef.current) {
          // Firebase is already signed out. Calling signOut here can race login.
          void authService.clearSession({ signOutFirebase: false, userId: currentUserRef.current?.id });
          setCurrentUser(null);
          setIsOfflineSession(false);
          setIsLoading(false);
        }
        return;
      }

      if (currentUserRef.current?.id !== fbUser.uid) {
        const previousUid = currentUserRef.current?.id;
        OfflineStorage.teardownActiveListeners();
        if (previousUid) void OfflineStorage.clearDisplayCacheOnly(previousUid).catch(() => {});
        setCurrentUser(null);
        setIsOfflineSession(false);
        setIsLoading(true);
      }

      // Otherwise (session restore / page refresh), perform strict profile validation
      preloadAuthenticatedShell();
      try {
        const valRes = await validateFirebaseUserProfile(fbUser, { clearInvalidSession: false });
        if (!isMounted || activeEpoch !== sessionEpochRef.current) return;

        if (!valRes.success || !valRes.profile) {
          console.warn('[AUTH_CONTEXT] User profile validation failed:', valRes.error);
          if (isMounted && activeEpoch === sessionEpochRef.current) {
            await execLogout({ reason: 'SESSION_INVALID' });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted && activeEpoch === sessionEpochRef.current) {
          setCurrentUser(valRes.profile);
          setIsOfflineSession(!!valRes.isOfflineSession);
          setIsLoading(false);
          SyncQueueService.refreshStatus(valRes.profile.id).catch(() => {});
        }
      } catch (err) {
        console.error('[AUTH_CONTEXT] Failed to verify active Firebase session:', err);
        if (isMounted && activeEpoch === sessionEpochRef.current) {
          await execLogout({ reason: 'SESSION_INVALID' });
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [execLogout]);

  // Realtime subscription to database-authoritative profile (REV-07, R21-04)
  // Ensures permissions or role changes by Admin apply immediately to the active session.
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void import('../services/firebase/firestoreService').then(({ FirestoreService }) => {
      if (cancelled || auth.currentUser?.uid !== currentUser.id) return;
      unsub = FirestoreService.subscribeToDocument<UserProfile>('users', currentUser.id, (profile) => {
        if (auth.currentUser?.uid !== currentUser.id) return;
        if (!profile || profile.isActive !== true || profile.requiresActivation === true) {
          void logout({ reason: 'ACCOUNT_DEACTIVATED' });
          return;
        }
        if (profile) {
          if ((profile.sessionRevokedAtSeconds || 0) > (currentUserRef.current?.sessionRevokedAtSeconds || 0)) {
            void revalidateSessionOnline();
          }

          setCurrentUser((prev) => {
            if (!prev || prev.id !== profile.id) return prev;
            return {
              ...prev,
              ...profile,
            };
          });
          // Keep the verified offline snapshot current without restarting auth.
          // A new revocation marker must first pass token-time revalidation.
          const verified = currentUserRef.current;
          if (verified?.id === profile.id && (profile.sessionRevokedAtSeconds || 0) <= (verified.sessionRevokedAtSeconds || 0)) {
            void OfflineStorage.saveVerifiedProfile({ ...verified, ...profile }).catch(() => {});
          }
        }
      });
    }).catch((error) => console.warn('[AUTH_CONTEXT] Profile subscription could not load:', error));
    return () => { cancelled = true; unsub?.(); };
  }, [currentUser?.id, isOffline, logout, revalidateSessionOnline]);

  // Inactivity Auto Logout
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout({ reason: 'INACTIVITY_TIMEOUT' });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser?.id, logout]);

  const loginWithPin = async (
    nipOrUserId: string,
    pin: string
  ): Promise<{
    success: boolean;
    error?: string;
    remainingAttempts?: number;
    isLocked?: boolean;
    remainingSeconds?: number;
  }> => {
    if (manualLoginEpochRef.current !== null || logoutInProgressRef.current) return { success: false, error: 'Autentikasi sedang diproses. Tunggu sebentar.' };
    const currentEpoch = ++sessionEpochRef.current;
    manualLoginEpochRef.current = currentEpoch;
    preloadAuthenticatedShell();
    try {
      const res = await authService.authenticateWithPin(nipOrUserId, pin, { isCurrent: () => currentEpoch === sessionEpochRef.current });
      if (currentEpoch !== sessionEpochRef.current) {
        return { success: false, error: 'Sesi autentikasi dibatalkan.' };
      }

      if (res.success && res.user) {
        setCurrentUser(res.user);
        setIsOfflineSession(false);
        setIsLoading(false);
        SyncQueueService.refreshStatus(res.user.id).catch(() => {});
        void AuditService.recordLogin('PIN');
        return { success: true };
      }

      return {
        success: false,
        error: res.error || 'Autentikasi gagal.',
        remainingAttempts: res.remainingAttempts,
        isLocked: res.isLocked,
        remainingSeconds: res.remainingSeconds,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Autentikasi gagal.' };
    } finally {
      if (manualLoginEpochRef.current === currentEpoch) manualLoginEpochRef.current = null;
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (manualLoginEpochRef.current !== null || logoutInProgressRef.current) return { success: false, error: 'Autentikasi sedang diproses. Tunggu sebentar.' };
    const currentEpoch = ++sessionEpochRef.current;
    manualLoginEpochRef.current = currentEpoch;
    preloadAuthenticatedShell();
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      if (currentEpoch !== sessionEpochRef.current) {
        if (auth.currentUser === fbUser) await signOut(auth);
        return { success: false, error: 'Sesi autentikasi dibatalkan.' };
      }

      const valRes = await validateFirebaseUserProfile(fbUser, { isLoginWithGoogle: true, clearInvalidSession: false });
      if (currentEpoch !== sessionEpochRef.current) return { success: false };

      if (!valRes.success || !valRes.profile) {
        await authService.clearSession();
        setCurrentUser(null);
        setIsLoading(false);
        void AuditService.recordLoginFailure({
          method: 'GOOGLE',
          reason: 'UNREGISTERED_ACCOUNT',
          status: 'BLOCKED',
          email: fbUser.email || undefined,
          details: `Login Google ditolak: Akun ${fbUser.email || fbUser.uid} tidak terdaftar atau nonaktif dalam database sekolah`,
        });
        return {
          success: false,
          error: valRes.error || 'Akun Google ini tidak terdaftar atau belum diaktifkan dalam database sekolah.',
        };
      }
      setCurrentUser(valRes.profile);
      setIsOfflineSession(!!valRes.isOfflineSession);
      setIsLoading(false);
      SyncQueueService.refreshStatus(valRes.profile.id).catch(() => {});
      void AuditService.recordLogin('GOOGLE');
      return { success: true };
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';

      // Gracefully handle expected user actions and browser popup restrictions without console.error
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorMessage.includes('auth/popup-closed-by-user') ||
        errorMessage.includes('popup-closed-by-user')
      ) {
        console.info('[AUTH_CONTEXT] Google Sign-In popup ditutup atau dibatalkan oleh pengguna.');
        void AuditService.recordLoginFailure({
          method: 'GOOGLE',
          reason: 'POPUP_CLOSED_BY_USER',
          status: 'FAILED',
          details: 'Login dengan Google dibatalkan: Jendela pop-up ditutup oleh pengguna',
        });
        return {
          success: false,
          error: 'Login dengan Google dibatalkan karena jendela pop-up ditutup.',
        };
      }

      if (errorCode === 'auth/popup-blocked' || errorMessage.includes('popup-blocked')) {
        console.warn('[AUTH_CONTEXT] Google Sign-In popup diblokir oleh peramban.');
        void AuditService.recordLoginFailure({
          method: 'GOOGLE',
          reason: 'POPUP_BLOCKED',
          status: 'FAILED',
          details: 'Login Google dibatalkan: Pop-up diblokir oleh peramban',
        });
        return {
          success: false,
          error: 'Jendela pop-up login Google diblokir oleh peramban Anda. Harap izinkan pop-up untuk situs ini.',
        };
      }

      if (errorCode === 'auth/network-request-failed') {
        console.warn('[AUTH_CONTEXT] Jaringan terputus saat autentikasi Google.');
        void AuditService.recordLoginFailure({
          method: 'GOOGLE',
          reason: 'NETWORK_ERROR',
          status: 'FAILED',
          details: 'Login Google gagal: Terjadi gangguan jaringan koneksi internet',
        });
        return {
          success: false,
          error: 'Gagal terhubung ke layanan Google. Silakan periksa koneksi internet Anda.',
        };
      }

      if (errorCode === 'auth/unauthorized-domain') {
        console.warn('[AUTH_CONTEXT] Domain belum terdaftar di Firebase Auth.');
        void AuditService.recordLoginFailure({
          method: 'GOOGLE',
          reason: 'UNAUTHORIZED_DOMAIN',
          status: 'FAILED',
          details: 'Login Google gagal: Domain belum diizinkan pada konsol Firebase Auth',
        });
        return {
          success: false,
          error: 'Domain aplikasi ini belum diizinkan pada konsol Firebase Authentication sekolah.',
        };
      }

      console.error('[AUTH_CONTEXT] Google Sign-In error:', err);
      void AuditService.recordLoginFailure({
        method: 'GOOGLE',
        reason: errorCode || 'AUTH_ERROR',
        status: 'FAILED',
        details: `Login Google gagal: ${err?.message || 'Kesalahan autentikasi'}`,
      });
      return { success: false, error: err.message || 'Gagal masuk dengan Google.' };
    } finally {
      if (manualLoginEpochRef.current === currentEpoch) manualLoginEpochRef.current = null;
    }
  };

  const refreshProfile = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { FirestoreService } = await import('../services/firebase/firestoreService');
      const fresh = await FirestoreService.getByIdStrict<UserProfile>('users', currentUser.id);
      if (fresh) {
        if (fresh.isActive === false) {
          logout();
          return;
        }
        setCurrentUser((prev) => (prev ? { ...prev, ...fresh } : null));
      }
    } catch (err) {
      console.warn('[AUTH_CONTEXT] Could not refresh authoritative profile:', err);
    }
  }, [currentUser?.id, logout]);

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
        isOffline,
        isOfflineSession,
        isTrustedDevice: isTrustedDeviceState,
        setTrustedDevice,
        revalidateSessionOnline,
        loginWithPin,
        loginWithGoogle,
        logout,
        refreshProfile,
        changePin,
        hasPermission,
        hasRole,
      }}
    >
      {children}

      {/* Pending Unsynced Offline Data Confirmation Modal on Logout */}
      {pendingLogoutPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/80 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Perhatian: Data Unsynced</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Data offline belum tersimpan ke server</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">Sesi logout mendeteksi data yang belum tersinkronisasi:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11.5px] font-medium">
                {pendingLogoutPrompt.counts.syncQueueCount > 0 && (
                  <li><strong>{pendingLogoutPrompt.counts.syncQueueCount}</strong> transaksi antrean pengiriman offline</li>
                )}
                {pendingLogoutPrompt.counts.draftsCount > 0 && (
                  <li><strong>{pendingLogoutPrompt.counts.draftsCount}</strong> draf formulir tersimpan</li>
                )}
              </ul>
              <p className="text-[10.5px] text-amber-700 dark:text-amber-400 pt-1">
                Harap coba sinkronkan data sekarang atau batalkan logout agar transaksi tidak hilang.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (currentUser) {
                    await SyncQueueService.triggerSync(currentUser);
                    const freshCounts = await OfflineStorage.getPendingCount(currentUser.id);
                    if (freshCounts.total === 0) {
                      execLogout(pendingLogoutPrompt.options);
                    } else {
                      setPendingLogoutPrompt((prev) => prev ? { ...prev, counts: freshCounts } : null);
                    }
                  }
                }}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                Coba Sinkronkan Sekarang
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingLogoutPrompt(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal Logout
                </button>
                <button
                  type="button"
                  onClick={() => execLogout({ ...pendingLogoutPrompt.options, purgeUserData: true })}
                  className="flex-1 py-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hapus & Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
