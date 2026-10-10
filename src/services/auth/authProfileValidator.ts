import { UserProfile, UserRole } from '../../types';
import { FirestoreService } from '../firebase/firestoreService';
import { authService } from './authService';
import { OfflineStorage } from '../offline/offlineStorage';

export interface AuthProfileValidationResult {
  success: boolean;
  profile: UserProfile | null;
  error?: string;
  code?: string;
  isOfflineSession?: boolean;
}

export interface FirebaseUserLike {
  uid: string;
  email?: string | null;
  getIdTokenResult: () => Promise<{ authTime: string; claims: Record<string, any> }>;
}

/**
 * Server-authoritative profile validator for Firebase authenticated sessions (R21-03, R21-04).
 * Strictly requires an authoritative UID-bound profile via FirestoreService.getByIdStrict.
 * Distinguishes network failures from security/permission rejections:
 * Network failure alone does NOT wipe previously verified sessions if a verified snapshot exists.
 */
export async function validateFirebaseUserProfile(
  fbUser: FirebaseUserLike | null,
  options: { isLoginWithGoogle?: boolean } = {}
): Promise<AuthProfileValidationResult> {
  if (!fbUser) {
    await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Sesi autentikasi Firebase tidak ditemukan.',
      code: 'NO_FIREBASE_USER',
    };
  }

  let profile: UserProfile | null = null;
  let isOfflineFallback = false;

  try {
    // 1. Strict UID-bound lookup from server
    profile = await FirestoreService.getByIdStrict<UserProfile>('users', fbUser.uid);
  } catch (readErr: any) {
    const errorMsg = readErr?.message || String(readErr);
    const errorCode = readErr?.code || '';
    const isNetworkError =
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      errorCode === 'unavailable' ||
      errorCode === 'failed-precondition' ||
      errorMsg.includes('offline') ||
      errorMsg.includes('network') ||
      errorMsg.includes('Failed to fetch') ||
      errorMsg.includes('client is offline');

    // If genuine network loss, check if an existing verified profile snapshot exists for this exact UID
    if (isNetworkError) {
      const cachedVerified = await OfflineStorage.getVerifiedProfile(fbUser.uid);
      if (cachedVerified && cachedVerified.id === fbUser.uid) {
        console.warn('[AUTH_VALIDATOR] Operating in offline mode with verified session snapshot for UID:', fbUser.uid);
        profile = cachedVerified;
        isOfflineFallback = true;
      } else {
        return {
          success: false,
          profile: null,
          error: 'Koneksi internet diperlukan untuk memverifikasi profil akun ini pertama kali.',
          code: 'OFFLINE_NO_CACHE',
        };
      }
    } else {
      // Definite security or permission rejection by Firestore
      console.error('[AUTH_VALIDATOR] Strict profile lookup error (permission/security):', errorMsg);
      await authService.clearSession();
      return {
        success: false,
        profile: null,
        error: options.isLoginWithGoogle
          ? 'Gagal memverifikasi profil sekolah. Akses database ditolak.'
          : 'Gagal membaca profil pengguna dari database sekolah.',
        code: 'DB_READ_ERROR',
      };
    }
  }

  // 2. Strict ID binding check & lifecycle status validation
  if (!profile || profile.id !== fbUser.uid) {
    await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: options.isLoginWithGoogle
        ? 'Akun Google ini tidak terdaftar atau belum diaktifkan dalam database sekolah.'
        : 'Profil pengguna tidak ditemukan dalam database sekolah.',
      code: 'PROFILE_NOT_FOUND',
    };
  }

  if (profile.isActive !== true) {
    await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Akun Anda dinonaktifkan oleh administrator.',
      code: 'ACCOUNT_DISABLED',
    };
  }

  if (profile.requiresActivation === true) {
    await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Akun Anda memerlukan aktivasi PIN baru oleh Administrator.',
      code: 'ACCOUNT_REQUIRES_ACTIVATION',
    };
  }

  // 3. Enforce session revocation: authTime <= sessionRevokedAtSeconds means session is revoked
  try {
    const idTokenResult = await fbUser.getIdTokenResult();
    const authTimeSeconds = Math.floor(new Date(idTokenResult.authTime).getTime() / 1000);
    const revokedAt = profile.sessionRevokedAtSeconds || 0;

    if (revokedAt > 0 && authTimeSeconds <= revokedAt) {
      await authService.clearSession();
      return {
        success: false,
        profile: null,
        error: 'Sesi akun Anda telah dicabut oleh Administrator.',
        code: 'SESSION_REVOKED',
      };
    }

    // 4. Document role takes absolute authority; claims or client emails cannot elevate role
    const authoritativeRole = profile.role || (idTokenResult.claims?.role as UserRole) || 'GURU';
    const activeProfile: UserProfile = {
      ...profile,
      role: authoritativeRole,
    };

    if (!isOfflineFallback) {
      await OfflineStorage.saveVerifiedProfile(activeProfile);
    }

    return {
      success: true,
      profile: activeProfile,
      isOfflineSession: isOfflineFallback,
    };
  } catch (tokenErr: any) {
    if (isOfflineFallback && profile) {
      return {
        success: true,
        profile,
        isOfflineSession: true,
      };
    }
    authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Gagal memverifikasi stempel waktu sesi autentikasi.',
      code: 'TOKEN_VERIFY_ERROR',
    };
  }
}
