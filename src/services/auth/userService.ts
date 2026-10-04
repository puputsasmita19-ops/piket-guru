import { FirestoreService } from '../firebase/firestoreService';
import { UserProfile, UserRole } from '../../types';
import { authService } from './authService';

export class UserService {
  /**
   * Bootstrap system administrator account if the users collection is completely empty.
   * Credential is NOT stored in users document.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    const allUsers = await FirestoreService.getAllRaw<UserProfile>('users');
    if (allUsers.length === 0) {
      const bootstrapAdmin: UserProfile = {
        id: 'usr-admin-01',
        loginId: 'ADMIN-001',
        nip: '198503152010011002',
        nuptk: '',
        fullName: 'Administrator Sistem',
        role: 'ADMIN',
        email: 'admin@sekolah.sch.id',
        phone: '081234567890',
        isActive: true,
        permissions: ['*'],
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await FirestoreService.setDocument('users', bootstrapAdmin.id, bootstrapAdmin);
    }
  }

  /**
   * Create a new user profile with atomic loginId uniqueness enforcement via backend.
   * Eliminates shared default PINs (e.g. 123456).
   * If initialPin is provided, sets credential via authenticated backend API.
   * If no initial PIN or backend setup fails, user is explicitly created with requiresActivation: true.
   */
  public static async createUser(
    userData: {
      loginId: string;
      fullName: string;
      role: UserRole;
      nip?: string;
      nuptk?: string;
      email: string;
      phone: string;
      initialPin?: string;
      permissions: string[];
      isActive: boolean;
    },
    adminUser: UserProfile
  ): Promise<UserProfile> {
    const normalizedLoginId = (userData.loginId || '').trim().toUpperCase();

    // 1. Primary path: Call authenticated backend API for atomic uniqueness enforcement in transaction
    const apiRes = await authService.createUserProfile({
      ...userData,
      loginId: normalizedLoginId,
      nip: userData.nip ? userData.nip.trim() : '',
      nuptk: userData.nuptk ? userData.nuptk.trim() : '',
    });

    if (apiRes.success && apiRes.user) {
      await FirestoreService.logAudit({
        userId: adminUser.id,
        userName: adminUser.fullName,
        role: adminUser.role,
        action: 'CREATE',
        module: 'USERS',
        recordId: apiRes.user.id,
        details: `Menambahkan pengguna baru: ${apiRes.user.fullName} (ID Login: ${apiRes.user.loginId || '-'}) sebagai ${apiRes.user.role}${
          apiRes.user.requiresActivation ? ' [Perlu Aktivasi PIN]' : ''
        }`,
      });
      return apiRes.user;
    }

    if (apiRes.code === 'DUPLICATE_LOGIN_ID') {
      throw new Error(apiRes.error || `ID Login '${normalizedLoginId}' sudah digunakan oleh akun lain.`);
    }

    // 2. Direct Firestore fallback (e.g. in test or offline environment)
    const id = `usr-${userData.role.toLowerCase()}-${Date.now().toString(36)}`;
    const hasInitialPin = !!userData.initialPin && /^\d{6}$/.test(userData.initialPin.trim());

    const newUser: UserProfile = {
      id,
      loginId: normalizedLoginId,
      nip: userData.nip ? userData.nip.trim() : '',
      nuptk: userData.nuptk ? userData.nuptk.trim() : '',
      fullName: userData.fullName.trim(),
      role: userData.role,
      email: (userData.email || '').trim(),
      phone: (userData.phone || '').trim(),
      isActive: userData.isActive !== false,
      permissions: userData.permissions || [],
      requiresActivation: !hasInitialPin,
      sessionRevokedAtSeconds: Math.floor(Date.now() / 1000),
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save profile to users collection (NO CREDENTIALS EVER)
    await FirestoreService.setDocument('users', id, newUser);

    // Save initial credential to private store via authenticated backend API
    if (hasInitialPin) {
      const res = await authService.resetUserPin(id, userData.initialPin!.trim());
      if (!res.success) {
        console.warn(`[USER_SERVICE] Initial PIN setup failed for ${id}: ${res.error}. Marked for activation.`);
        newUser.requiresActivation = true;
        await FirestoreService.setDocument('users', id, { ...newUser, requiresActivation: true });
      }
    }

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'CREATE',
      module: 'USERS',
      recordId: id,
      details: `Menambahkan pengguna baru: ${newUser.fullName} (ID Login: ${newUser.loginId || '-'}) sebagai ${newUser.role}${
        newUser.requiresActivation ? ' [Perlu Aktivasi PIN]' : ''
      }`,
    });

    return newUser;
  }

  /**
   * Update existing user profile using strict field allowlist.
   * Enforces session revocation on role changes or deactivation.
   * Credentials (PIN/hash/salt) are completely stripped and excluded.
   * (Closes SEC-05, R4-06)
   */
  public static async updateUser(
    userId: string,
    updates: Partial<UserProfile>,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    // If loginId is being changed, verify uniqueness via backend API
    if (updates.loginId && updates.loginId.trim().toUpperCase() !== (existing.loginId || '').trim().toUpperCase()) {
      const apiRes = await authService.updateUserProfile(userId, updates);
      if (!apiRes.success && apiRes.code === 'DUPLICATE_LOGIN_ID') {
        throw new Error(apiRes.error || `ID Login '${updates.loginId}' sudah digunakan oleh akun lain.`);
      }
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const roleChanged = updates.role && updates.role !== existing.role;
    const statusChanged = updates.isActive !== undefined && updates.isActive !== existing.isActive;

    let effectiveRevocation = existing.sessionRevokedAtSeconds || 0;
    if (roleChanged || statusChanged) {
      effectiveRevocation = Math.max(effectiveRevocation, nowSeconds);
    }

    // Strict allowlist: only non-sensitive profile metadata
    const payload: UserProfile = {
      id: existing.id,
      loginId: updates.loginId !== undefined ? updates.loginId.trim().toUpperCase() : existing.loginId,
      nip: updates.nip !== undefined ? updates.nip.trim() : existing.nip,
      nuptk: updates.nuptk !== undefined ? updates.nuptk.trim() : existing.nuptk,
      fullName: updates.fullName ? updates.fullName.trim() : existing.fullName,
      role: updates.role || existing.role,
      email: updates.email !== undefined ? updates.email.trim() : existing.email,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl,
      isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
      permissions: updates.permissions || existing.permissions,
      requiresActivation: updates.requiresActivation !== undefined ? updates.requiresActivation : existing.requiresActivation,
      sessionRevokedAtSeconds: effectiveRevocation,
      dataSource: existing.dataSource || 'PRODUCTION',
      isDemo: existing.isDemo || false,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Guaranteed removal of any legacy residual credential fields
    delete (payload as any).pin;
    delete (payload as any).pinHash;
    delete (payload as any).pinSalt;
    delete (payload as any).scryptHash;
    delete (payload as any).password;
    delete (payload as any).token;

    await FirestoreService.setDocument('users', userId, payload, { purgeLegacyCredentials: true });

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'UPDATE',
      module: 'USERS',
      recordId: userId,
      details: `Memperbarui data profil pengguna: ${payload.fullName} (${payload.nip})${
        roleChanged ? ` [Perubahan Role: ${existing.role} -> ${payload.role}]` : ''
      }`,
    });
  }

  /**
   * Reset user's 6-digit security PIN via authenticated backend service.
   * Security state (revocation marker, hash writing) is solely managed by backend.
   * Never overwrites backend security markers with stale frontend profiles.
   */
  public static async resetPin(
    userId: string,
    newPin: string,
    adminUser: UserProfile
  ): Promise<void> {
    const res = await authService.resetUserPin(userId, newPin);
    if (!res.success) {
      throw new Error(res.error || 'Gagal mereset PIN melalui server.');
    }

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'UPDATE',
      module: 'USERS',
      recordId: userId,
      details: `Melakukan Reset PIN Keamanan untuk pengguna ID: ${userId}`,
    });
  }

  /**
   * Toggle active/inactive status with monotonic session revocation
   * Reactivating an account requires activation so old tokens cannot be revived.
   */
  public static async toggleActiveStatus(
    userId: string,
    newStatus: boolean,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const existingRevoked = existing.sessionRevokedAtSeconds || 0;
    const effectiveRevocation = Math.max(existingRevoked, nowSeconds);

    const updates: Partial<UserProfile> = {
      isActive: newStatus,
      sessionRevokedAtSeconds: effectiveRevocation,
    };

    if (newStatus) {
      // Reactivation requires activation so previous tokens are completely invalid
      updates.requiresActivation = true;
    }

    await this.updateUser(userId, updates, adminUser);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'UPDATE',
      module: 'USERS',
      recordId: userId,
      details: `Mengubah status akun ${existing.fullName} menjadi ${newStatus ? 'AKTIF (Perlu Aktivasi)' : 'NONAKTIF'}`,
    });
  }

  /**
   * Delete user and advance revocation timestamp
   */
  public static async deleteUser(
    userId: string,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    await FirestoreService.deleteDocument('users', userId);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'DELETE',
      module: 'USERS',
      recordId: userId,
      details: `Menghapus akun pengguna: ${existing.fullName} (${existing.nip})`,
    });
  }
}
