import { UserProfile } from '../../types';
import { auth } from '../firebase/firebaseAuth';
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { OfflineStorage } from '../offline/offlineStorage';

const STORAGE_SESSION_KEY = 'piket_guru_active_session';

export interface UserSummaryItem {
  id: string;
  userId: string;
  loginId?: string;
  nip: string;
  nuptk?: string;
  fullName: string;
  role: UserProfile['role'];
  email?: string;
  phone?: string;
  isActive: boolean;
  avatarUrl?: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  remainingAttempts?: number;
  isLocked?: boolean;
  remainingSeconds?: number;
  dependencyBlocker?: {
    code: string;
    message: string;
    targetUid: string;
    requiredRole: string;
    requiredApi?: string;
    targetProjectId?: string;
    remediation?: string;
  };
}

class AuthService {
  private usersList: UserSummaryItem[] = [];
  private initialized = false;
  private usersRequest: Promise<UserSummaryItem[]> | null = null;
  private currentFirebaseUser: User | null = null;
  private usersVerified = false;
  private usersUpdatedAt = 0;

  public getUsersListStatus() { return { verified: this.usersVerified, updatedAt: this.usersUpdatedAt }; }

  constructor() {
    if (typeof window !== 'undefined' && auth) {
      onAuthStateChanged(auth, (user) => {
        this.currentFirebaseUser = user;
      });
    }
  }

  /**
   * Initializes auth service and purges any legacy plaintext/hash credential caches
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    // Purge legacy client credential caches (SEC-07 mitigation)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('piket_guru_users_db_v1');
        localStorage.removeItem('piket_guru_session_token');
        // Clean legacy pin field from cached firestore users
        const cachedUsers = localStorage.getItem('piket_firestore_users');
        if (cachedUsers) {
          try {
            const parsed = JSON.parse(cachedUsers);
            if (Array.isArray(parsed)) {
              const sanitized = parsed.map(({ pin, pinHash, pinSalt, password, ...rest }: any) => rest);
              localStorage.setItem('piket_firestore_users', JSON.stringify(sanitized));
            }
          } catch {
            localStorage.removeItem('piket_firestore_users');
          }
        }
      } catch {
        // ignore
      }
    }

    this.initialized = true;
  }

  /**
   * Fetches sanitized users list from backend API endpoint (/api/auth/users-summary).
   * Does NOT query Firestore client-side, enforcing zero unauthenticated client access (SEC-06).
   */
  public async refreshUsersList(): Promise<UserSummaryItem[]> {
    if (this.usersRequest) return this.usersRequest;
    const request = this.fetchUsersList();
    this.usersRequest = request;
    try { return await request; }
    finally { if (this.usersRequest === request) this.usersRequest = null; }
  }

  private async fetchUsersList(): Promise<UserSummaryItem[]> {
    this.usersVerified = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/auth/users-summary', { cache: 'no-store', signal: controller.signal, priority: 'low' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        this.usersList = data.users.filter((u: any) => u && typeof u.id === 'string' && u.id && u.isActive === true && typeof u.fullName === 'string').map((u: any) => ({
          id: u.id,
          userId: u.id,
          loginId: u.loginId || '',
          nip: u.nip || '',
          nuptk: u.nuptk || '',
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive !== false,
          avatarUrl: u.avatarUrl,
        }));
        this.usersVerified = true;
        this.usersUpdatedAt = Date.now();
        return this.usersList;
      }
      return [];
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[AUTH] Request users-summary timed out.');
      } else {
        console.warn('[AUTH] Could not fetch users summary from backend API:', err);
      }
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async getUsersList(options: { forceRefresh?: boolean } = {}): Promise<UserSummaryItem[]> {
    await this.init();
    const age = Date.now() - this.usersUpdatedAt;
    if (options.forceRefresh || !this.usersVerified || age < 0 || age >= 15000) return this.refreshUsersList();
    return this.usersList;
  }

  /**
   * Authenticates user via server-side verification:
   * PIN -> Backend scrypt verification -> Firebase Custom Token -> Frontend signInWithCustomToken -> Firebase ID token.
   * Closes SEC-01, SEC-06, SEC-07, and SEC-08.
   */
  public async authenticateWithPin(identifier: string, pin: string, options: { isCurrent?: () => boolean } = {}): Promise<AuthResult> {
    await this.init();
    const isCurrent = options.isCurrent || (() => true);
    const cancelled = () => ({ success: false, error: 'Sesi autentikasi dibatalkan.' });
    if (!isCurrent()) return cancelled();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const trimmedId = (identifier || '').trim();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        priority: 'high',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedId,
          loginId: trimmedId,
          nip: trimmedId,
          pin: pin.trim(),
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!isCurrent()) return cancelled();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'ID Login/NIP atau PIN tidak sesuai.',
          remainingAttempts: data.remainingAttempts,
          isLocked: data.isLocked,
          remainingSeconds: data.remainingSeconds,
          dependencyBlocker: data.dependencyBlocker,
        };
      }

      // R21-02: Require valid customToken from server; failure to mint or sign in must reject before caching
      if (!data.customToken || typeof data.customToken !== 'string' || data.customToken.trim() === '') {
        return {
          success: false,
          error: 'Autentikasi gagal: Sesi token Firebase tidak tersedia dari server.',
        };
      }

      if (!data.user || data.user.isActive !== true || data.user.requiresActivation === true || !data.user.id) {
        return { success: false, error: 'Profil akun tidak aktif atau belum dapat diverifikasi.' };
      }

      try {
        const userCredential = await signInWithCustomToken(auth, data.customToken);
        if (!isCurrent()) {
          if (auth.currentUser === userCredential.user) await signOut(auth);
          return cancelled();
        }
        if (userCredential.user.uid !== data.user.id) {
          if (auth.currentUser === userCredential.user) await signOut(auth);
          return { success: false, error: 'Identitas sesi Firebase tidak sesuai dengan profil akun.' };
        }
        this.currentFirebaseUser = userCredential.user;
      } catch (fbAuthErr: any) {
        console.error('[AUTH] signInWithCustomToken failed on client:', fbAuthErr);
        return {
          success: false,
          error: `Gagal menyelesaikan autentikasi Firebase: ${fbAuthErr.message}`,
        };
      }

      const userProfile: UserProfile = {
        ...data.user,
        // An explicit empty list is an intentional access restriction, not a default.
        permissions: Array.isArray(data.user.permissions) ? data.user.permissions : [],
        loginAt: Date.now(),
      };
      void OfflineStorage.saveVerifiedProfile(userProfile).catch(() => {});

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(userProfile));
        } catch {
          // ignore
        }
      }

      return { success: true, user: userProfile };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'Permintaan autentikasi memakan waktu terlalu lama. Silakan periksa koneksi internet Anda lalu coba lagi.',
        };
      }
      console.error('Authentication network error:', err);
      return {
        success: false,
        error: 'Tidak dapat terhubung ke server autentikasi. Pastikan koneksi server aktif.',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Helper to retrieve current Firebase ID token for Authorization headers
   */
  public async getIdToken(): Promise<string> {
    if (auth && auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch {
        return '';
      }
    }
    return '';
  }

  /**
   * Re-authenticates sensitive admin action (e.g. database rollback).
   * Verifies against server-side adaptive hash with Bearer authorization.
   */
  public async verifyAdminPin(userId: string, pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, pin }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'PIN Keamanan salah.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Gagal menghubungi server verifikasi PIN.' };
    }
  }

  /**
   * Changes user's PIN via secure backend endpoint with Bearer authorization
   */
  public async changeUserPin(
    userId: string,
    oldPin: string,
    newPin: string
  ): Promise<{
    success: boolean;
    error?: string;
    refreshRevocation?: { status: 'REVOKED' | 'PENDING_RETRY'; attempts: number; error?: string };
  }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, oldPin, newPin }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mengubah PIN.' };
      }

      return {
        success: true,
        refreshRevocation: data.refreshRevocation,
      };
    } catch (err: any) {
      return { success: false, error: 'Terjadi kesalahan jaringan saat mengubah PIN.' };
    }
  }

  /**
   * Admin-initiated PIN reset via secure backend endpoint with Bearer authorization
   */
  public async resetUserPin(
    targetUserId: string,
    newPin: string
  ): Promise<{
    success: boolean;
    error?: string;
    refreshRevocation?: { status: 'REVOKED' | 'PENDING_RETRY'; attempts: number; error?: string };
  }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId, newPin }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mereset PIN pengguna.' };
      }

      return {
        success: true,
        refreshRevocation: data.refreshRevocation,
      };
    } catch (err: any) {
      return { success: false, error: 'Terjadi kesalahan jaringan saat mereset PIN.' };
    }
  }

  /**
   * Registers a new user with atomic loginId uniqueness enforcement via backend endpoint
   */
  public async createUserProfile(userData: {
    id?: string;
    loginId: string;
    fullName: string;
    role: UserProfile['role'];
    nip?: string;
    nuptk?: string;
    email?: string;
    phone?: string;
    initialPin?: string;
    permissions?: string[];
    isActive?: boolean;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string; code?: string }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Gagal mendaftarkan pengguna baru.',
          code: data.code,
        };
      }

      await this.refreshUsersList();
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Terjadi kesalahan jaringan saat mendaftarkan pengguna.' };
    }
  }

  /**
   * Updates user profile with atomic loginId uniqueness check via backend endpoint
   */
  public async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; user?: UserProfile; error?: string; code?: string }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, updates }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Gagal memperbarui pengguna.',
          code: data.code,
        };
      }

      await this.refreshUsersList();
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Terjadi kesalahan jaringan saat memperbarui pengguna.' };
    }
  }

  /**
   * Deletes user profile, credentials, and loginId reservation via backend endpoint (CR-LIFECYCLE-LOGINID)
   */
  public async deleteUser(
    userId: string
  ): Promise<{ success: boolean; message?: string; error?: string; code?: string; partial?: boolean }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Gagal menghapus pengguna dari server.',
          code: data.code,
        };
      }

      await this.refreshUsersList();
      return {
        success: true,
        message: data.message,
        partial: data.partial,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Terjadi kesalahan jaringan saat menghapus pengguna.' };
    }
  }

  /**
   * Scans orphan loginId reservations (dry run inspection)
   */
  public async getOrphanReservations(): Promise<{
    success: boolean;
    count: number;
    orphans: Array<{ loginId: string; userId: string; createdAt?: string; reason: string }>;
    error?: string;
  }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/orphan-reservations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          count: 0,
          orphans: [],
          error: data.error || 'Gagal memeriksa reservasi yatim.',
        };
      }

      return {
        success: true,
        count: data.count || 0,
        orphans: data.orphans || [],
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        orphans: [],
        error: err?.message || 'Terjadi kesalahan jaringan saat memeriksa reservasi yatim.',
      };
    }
  }

  /**
   * Atomically releases an orphan loginId reservation
   */
  public async cleanOrphanReservation(
    loginId: string
  ): Promise<{ success: boolean; message?: string; error?: string; code?: string }> {
    try {
      const token = await this.getIdToken();
      const response = await fetch('/api/auth/clean-orphan-reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ loginId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Gagal membersihkan reservasi yatim.',
          code: data.code,
        };
      }

      return {
        success: true,
        message: data.message,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Terjadi kesalahan jaringan saat membersihkan reservasi yatim.' };
    }
  }

  /**
   * Retrieves active session from secure storage (expires after 24h)
   */
  public getSavedSession(): UserProfile | null {
    if (typeof localStorage === 'undefined') return null;
    const session = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!session) return null;
    try {
      const parsed: UserProfile = JSON.parse(session);
      const now = Date.now();
      if (parsed.loginAt && now - parsed.loginAt > 24 * 60 * 60 * 1000) {
        this.clearSession();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Clears session, signs out from Firebase Auth, and purges local storage.
   * Gracefully tears down all active Firestore listeners.
   */
  public async clearSession(options?: { purgeUserData?: boolean; userId?: string; signOutFirebase?: boolean }): Promise<void> {
    // 1. Immediately disconnect all active Firestore real-time listeners
    OfflineStorage.teardownActiveListeners();

    const targetUid = options?.userId || this.currentFirebaseUser?.uid || auth?.currentUser?.uid;

    try {
      if (auth && options?.signOutFirebase !== false) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('[AUTH] Error during signOut:', err);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        localStorage.removeItem('piket_guru_session_token');
        localStorage.removeItem('piket_guru_users_db_v1');
      } catch {
        // ignore
      }
    }

    // Always clear read display cache on logout to avoid leaking read data on shared devices
    if (targetUid) {
      OfflineStorage.clearDisplayCacheOnly(targetUid).catch(() => {});
    }

    // Purge queue & drafts ONLY if explicitly confirmed or if there are zero pending items
    if (targetUid) {
      if (options?.purgeUserData === true) {
        OfflineStorage.purgeUserData(targetUid).catch(() => {});
      } else if (options?.purgeUserData !== false) {
        // Safe check: if 0 pending items, okay to purge user data on untrusted device
        OfflineStorage.getPendingCount(targetUid).then((counts) => {
          if (counts.total === 0 && !OfflineStorage.isTrustedDevice()) {
            OfflineStorage.purgeUserData(targetUid).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }
}

export const authService = new AuthService();
