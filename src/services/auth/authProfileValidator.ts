import { UserProfile, UserRole } from '../../types';
import { FirestoreService } from '../firebase/firestoreService';
import { authService } from './authService';

export interface AuthProfileValidationResult {
  success: boolean;
  profile: UserProfile | null;
  error?: string;
  code?: string;
}

export interface FirebaseUserLike {
  uid: string;
  email?: string | null;
  getIdTokenResult: () => Promise<{ authTime: string; claims: Record<string, any> }>;
}

/**
 * Server-authoritative profile validator for Firebase authenticated sessions (R21-03, R21-04).
 * Strictly requires an authoritative UID-bound profile via FirestoreService.getByIdStrict.
 * Never falls back to local display caches or email-based profile substitution.
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
  try {
    // 1. Strict UID-bound lookup; throws immediately on error or PERMISSION_DENIED without reading cache
    profile = await FirestoreService.getByIdStrict<UserProfile>('users', fbUser.uid);
  } catch (readErr: any) {
    console.error('[AUTH_VALIDATOR] Strict profile lookup error:', readErr?.message || readErr);
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

    return {
      success: true,
      profile: activeProfile,
    };
  } catch (tokenErr: any) {
    authService.clearSession();
    return {
      success: false,
      profile: null,
      error: 'Gagal memverifikasi stempel waktu sesi autentikasi.',
      code: 'TOKEN_VERIFY_ERROR',
    };
  }
}
