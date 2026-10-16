import { UserProfile } from '../../types';
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
  options: { isLoginWithGoogle?: boolean; clearInvalidSession?: boolean } = {}
): Promise<AuthProfileValidationResult> {
  if (!fbUser) {
    if (options.clearInvalidSession !== false) await authService.clearSession();
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
    profile = await withVerificationTimeout(FirestoreService.getByIdStrict<UserProfile>('users', fbUser.uid));
  } catch (readErr: any) {
    const errorMsg = readErr?.message || String(readErr);
    const errorCode = readErr?.code || '';
    const isNetworkError =
      errorCode === 'unavailable' ||
      errorCode === 'deadline-exceeded' ||
      (!errorCode && (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errorMsg.includes('offline') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')
      ));

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
      // Definite security or permission rejection by Firestore (gracefully handled)
      console.warn('[AUTH_VALIDATOR] Strict profile lookup rejected (permission/security):', errorMsg);
      if (options.clearInvalidSession !== false) await authService.clearSession();
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
    if (options.clearInvalidSession !== false) await authService.clearSession();
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
    if (options.clearInvalidSession !== false) await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Akun Anda dinonaktifkan oleh administrator.',
      code: 'ACCOUNT_DISABLED',
    };
  }

  if (profile.requiresActivation === true) {
    if (options.clearInvalidSession !== false) await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Akun Anda memerlukan aktivasi PIN baru oleh Administrator.',
      code: 'ACCOUNT_REQUIRES_ACTIVATION',
    };
  }

  // 3. Enforce session revocation: authTime <= sessionRevokedAtSeconds means session is revoked
  try {
    const idTokenResult = await withVerificationTimeout(fbUser.getIdTokenResult());
    const authTimeSeconds = Math.floor(new Date(idTokenResult.authTime).getTime() / 1000);
    if (!Number.isFinite(authTimeSeconds)) throw Object.assign(new Error('Stempel waktu autentikasi tidak valid.'), { code: 'INVALID_AUTH_TIME' });
    const revokedAt = profile.sessionRevokedAtSeconds || 0;

    if (revokedAt > 0 && authTimeSeconds <= revokedAt) {
      if (options.clearInvalidSession !== false) await authService.clearSession();
      return {
        success: false,
        profile: null,
        error: 'Sesi akun Anda telah dicabut oleh Administrator.',
        code: 'SESSION_REVOKED',
      };
    }

    // 4. Document role takes absolute authority; claims or client emails cannot elevate role
    const authoritativeRole = profile.role;
    if (!['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(authoritativeRole)) {
      throw Object.assign(new Error('Peran akun belum dikonfigurasi dengan benar.'), { code: 'INVALID_ROLE' });
    }
    const activeProfile: UserProfile = {
      ...profile,
      role: authoritativeRole,
    };

    if (!isOfflineFallback) {
      void OfflineStorage.saveVerifiedProfile(activeProfile).catch(() => {});
    }

    return {
      success: true,
      profile: activeProfile,
      isOfflineSession: isOfflineFallback,
    };
  } catch (tokenErr: any) {
    const networkFailure = tokenErr?.code === 'unavailable' || tokenErr?.code === 'deadline-exceeded' || tokenErr?.code === 'auth/network-request-failed' || (!tokenErr?.code && typeof navigator !== 'undefined' && !navigator.onLine);
    if (isOfflineFallback && profile && networkFailure) {
      return {
        success: true,
        profile,
        isOfflineSession: true,
      };
    }
    if (options.clearInvalidSession !== false) await authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Gagal memverifikasi stempel waktu sesi autentikasi.',
      code: 'TOKEN_VERIFY_ERROR',
    };
  }
}

// Bound stalled verification without treating an unverified profile as a session.
function withVerificationTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Verifikasi sesi melewati batas waktu. Periksa koneksi internet.'), { code: 'deadline-exceeded' })), 10_000);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
