import { FirestoreService } from '../firebase/firestoreService';
import { UserProfile, UserRole } from '../../types';
import { SEED_USERS } from './authService';
import { hashPinWithSalt, generateSalt } from '../../utils/cryptoUtils';

export class UserService {
  /**
   * Bootstrap seed users into Firestore if collection is empty
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    const users = await FirestoreService.getAll<UserProfile>('users');
    if (users.length === 0) {
      for (const u of SEED_USERS) {
        const pinSalt = u.pinSalt || generateSalt();
        const pinHash = u.pinHash || (await hashPinWithSalt('123456', pinSalt));

        const userProfile: UserProfile = {
          id: u.userId,
          nip: u.nip,
          fullName: u.fullName,
          role: u.role,
          email: u.email,
          phone: u.phone,
          pinSalt,
          pinHash,
          isActive: u.isActive,
          permissions: ['*'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await FirestoreService.setDocument('users', userProfile.id, userProfile);
      }
    }
  }

  /**
   * Create a new user profile with salted SHA-256 PIN hash
   */
  public static async createUser(
    userData: {
      nip: string;
      fullName: string;
      role: UserRole;
      email: string;
      phone: string;
      pin?: string;
      permissions: string[];
      isActive: boolean;
    },
    adminUser: UserProfile
  ): Promise<UserProfile> {
    const id = `usr-${userData.role.toLowerCase()}-${Date.now().toString(36)}`;
    const rawPin = userData.pin || '123456';
    const pinSalt = generateSalt();
    const pinHash = await hashPinWithSalt(rawPin, pinSalt);

    const newUser: UserProfile = {
      id,
      nip: userData.nip,
      fullName: userData.fullName,
      role: userData.role,
      email: userData.email,
      phone: userData.phone,
      pinSalt,
      pinHash,
      isActive: userData.isActive,
      permissions: userData.permissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.setDocument('users', id, newUser);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'CREATE',
      module: 'USERS',
      recordId: id,
      details: `Menambahkan pengguna baru: ${newUser.fullName} (${newUser.nip}) sebagai ${newUser.role}`,
    });

    return newUser;
  }

  /**
   * Update existing user profile
   */
  public static async updateUser(
    userId: string,
    updates: Partial<UserProfile>,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    const payload: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.setDocument('users', userId, payload);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'UPDATE',
      module: 'USERS',
      recordId: userId,
      details: `Memperbarui data pengguna: ${payload.fullName} (${payload.nip})`,
    });
  }

  /**
   * Reset user's 6-digit security PIN with salted SHA-256 hash
   */
  public static async resetPin(
    userId: string,
    newPin: string,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    const pinSalt = generateSalt();
    const pinHash = await hashPinWithSalt(newPin, pinSalt);

    const payload: UserProfile = {
      ...existing,
      pinSalt,
      pinHash,
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.setDocument('users', userId, payload);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'UPDATE',
      module: 'USERS',
      recordId: userId,
      details: `Melakukan Reset PIN Keamanan untuk pengguna: ${existing.fullName} (${existing.nip})`,
    });
  }

  /**
   * Toggle active/inactive status
   */
  public static async toggleActiveStatus(
    userId: string,
    isActive: boolean,
    adminUser: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<UserProfile>('users', userId);
    if (!existing) return;

    const payload: UserProfile = {
      ...existing,
      isActive,
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.setDocument('users', userId, payload);

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'STATUS_CHANGE',
      module: 'USERS',
      recordId: userId,
      details: `Mengubah status akun ${existing.fullName} menjadi ${isActive ? 'AKTIF' : 'NONAKTIF'}`,
    });
  }

  /**
   * Delete user
   */
  public static async deleteUser(userId: string, adminUser: UserProfile): Promise<void> {
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

