import { UserProfile } from '../../types';
import { ROLE_PERMISSIONS } from '../../config/permissions';
import { auth } from '../firebase/firebase';
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';

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
  private currentFirebaseUser: User | null = null;

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

    await this.refreshUsersList();
    this.initialized = true;
  }

  /**
   * Fetches sanitized users list from backend API endpoint (/api/auth/users-summary).
   * Does NOT query Firestore client-side, enforcing zero unauthenticated client access (SEC-06).
   */
  public async refreshUsersList(): Promise<UserSummaryItem[]> {
    try {
      const res = await fetch('/api/auth/users-summary');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        this.usersList = data.users.map((u: any) => ({
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
        return this.usersList;
      }
      return [];
    } catch (err) {
      console.warn('[AUTH] Could not fetch users summary from backend API:', err);
      return [];
    }
  }

  public async getUsersList(): Promise<UserSummaryItem[]> {
    await this.init();
    if (this.usersList.length === 0) {
      await this.refreshUsersList();
    }
    return this.usersList;
  }

  /**
   * Authenticates user via server-side verification:
   * PIN -> Backend scrypt verification -> Firebase Custom Token -> Frontend signInWithCustomToken -> Firebase ID token.
   * Closes SEC-01, SEC-06, SEC-07, and SEC-08.
   */
  public async authenticateWithPin(identifier: string, pin: string): Promise<AuthResult> {
    await this.init();

    try {
      const trimmedId = (identifier || '').trim();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedId,
          loginId: trimmedId,
          nip: trimmedId,
          pin: pin.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'ID Login/NIP atau PIN tidak sesuai.',
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

      try {
        const userCredential = await signInWithCustomToken(auth, data.customToken);
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
        permissions:
          data.user.permissions && data.user.permissions.length > 0
            ? data.user.permissions
            : ROLE_PERMISSIONS[data.user.role as keyof typeof ROLE_PERMISSIONS] || [],
        loginAt: Date.now(),
      };

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(userProfile));
        } catch {
          // ignore
        }
      }

      return { success: true, user: userProfile };
    } catch (err: any) {
      console.error('Authentication network error:', err);
      return {
        success: false,
        error: 'Tidak dapat terhubung ke server autentikasi. Pastikan koneksi server aktif.',
      };
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
   * Clears session, signs out from Firebase Auth, and purges local storage
   */
  public async clearSession(): Promise<void> {
    try {
      if (auth) {
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
  }
}

export const authService = new AuthService();
