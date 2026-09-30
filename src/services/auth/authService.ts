import { UserProfile, UserRole } from '../../types';
import { ROLE_PERMISSIONS } from '../../config/permissions';
import { hashPinWithSalt, generateSalt } from '../../utils/cryptoUtils';
import { FirestoreService } from '../firebase/firestoreService';
import { ensureFirebaseAuth } from '../firebase/firebase';

export interface StoredUserCredential {
  userId: string;
  nip: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  pinSalt: string;
  pinHash: string;
  permissions?: string[];
  failedAttempts: number;
  lockedUntil: number | null; // timestamp ms
  isActive: boolean;
}

const STORAGE_USERS_KEY = 'piket_guru_users_db_v1';
const STORAGE_SESSION_KEY = 'piket_guru_active_session';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_SALT = 'e4d7a892b1c3f6e5';

export const SEED_USERS: StoredUserCredential[] = [
  {
    userId: 'usr-admin-01',
    nip: '198503152010011002',
    fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
    role: 'ADMIN',
    email: 'ahmad.fauzi@sekolah.sch.id',
    phone: '081234567890',
    pinSalt: DEFAULT_SALT,
    pinHash: '', // computed on initialize
    failedAttempts: 0,
    lockedUntil: null,
    isActive: true,
  },
  {
    userId: 'usr-kepsek-01',
    nip: '197605122000032001',
    fullName: 'Dr. Hj. Siti Rohmah, M.Pd.',
    role: 'KEPALA_SEKOLAH',
    email: 'kepsek@sekolah.sch.id',
    phone: '081298765432',
    pinSalt: DEFAULT_SALT,
    pinHash: '',
    failedAttempts: 0,
    lockedUntil: null,
    isActive: true,
  },
  {
    userId: 'usr-guru-01',
    nip: '199008212015022003',
    fullName: 'Siti Nurhaliza, S.Pd.',
    role: 'GURU',
    email: 'siti.nurhaliza@sekolah.sch.id',
    phone: '081345678901',
    pinSalt: DEFAULT_SALT,
    pinHash: '',
    failedAttempts: 0,
    lockedUntil: null,
    isActive: true,
  },
  {
    userId: 'usr-guru-02',
    nip: '198711042012011005',
    fullName: 'Budi Santoso, M.Kom.',
    role: 'GURU',
    email: 'budi.santoso@sekolah.sch.id',
    phone: '081456789012',
    pinSalt: DEFAULT_SALT,
    pinHash: '',
    failedAttempts: 0,
    lockedUntil: null,
    isActive: true,
  },
  {
    userId: 'usr-tendik-01',
    nip: '198902142014031002',
    fullName: 'Mulyadi, S.AP.',
    role: 'TENAGA_KEPENDIDIKAN',
    email: 'mulyadi.tu@sekolah.sch.id',
    phone: '081567890123',
    pinSalt: DEFAULT_SALT,
    pinHash: '',
    failedAttempts: 0,
    lockedUntil: null,
    isActive: true,
  },
];

class AuthService {
  private users: StoredUserCredential[] = [];
  private initialized = false;

  public async init() {
    if (this.initialized) return;

    try {
      await ensureFirebaseAuth();
    } catch (e) {
      console.warn('Firebase Auth initialization warning:', e);
    }

    // Try fetching from Firestore users collection first
    try {
      const firestoreUsers = await FirestoreService.getAll<UserProfile>('users');
      if (firestoreUsers && firestoreUsers.length > 0) {
        const credentials: StoredUserCredential[] = await Promise.all(
          firestoreUsers.map(async (u) => {
            const salt = u.pinSalt || DEFAULT_SALT;
            const hash =
              u.pinHash ||
              (u.pin ? await hashPinWithSalt(u.pin, salt) : await hashPinWithSalt('123456', salt));

            return {
              userId: u.id,
              nip: u.nip,
              fullName: u.fullName,
              role: u.role,
              email: u.email,
              phone: u.phone,
              pinSalt: salt,
              pinHash: hash,
              failedAttempts: 0,
              lockedUntil: null,
              isActive: u.isActive !== false,
            };
          })
        );
        this.users = credentials;
        this.saveUsers();
        this.initialized = true;
        return;
      }
    } catch (err) {
      console.warn('Could not read users from Firestore on boot, checking local cache:', err);
    }

    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    if (stored) {
      try {
        this.users = JSON.parse(stored);
      } catch {
        await this.resetToDefaults();
      }
    } else {
      await this.resetToDefaults();
    }
    this.initialized = true;
  }

  private async resetToDefaults() {
    const defaultPin = '123456';
    const computedUsers = await Promise.all(
      SEED_USERS.map(async (u) => {
        const hash = await hashPinWithSalt(defaultPin, u.pinSalt);
        return { ...u, pinHash: hash };
      })
    );
    this.users = computedUsers;
    this.saveUsers();
  }

  private saveUsers() {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(this.users));
  }

  public async getUsersList(): Promise<Array<Omit<StoredUserCredential, 'pinHash' | 'pinSalt'>>> {
    await this.init();
    return this.users.map(({ pinHash, pinSalt, ...rest }) => rest);
  }

  public async authenticateWithPin(
    nipOrUserId: string,
    pin: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    await this.init();

    // Check directly in Firestore for real-time changes
    try {
      const firestoreUsers = await FirestoreService.getAll<UserProfile>('users');
      if (firestoreUsers && firestoreUsers.length > 0) {
        const target = firestoreUsers.find((u) => u.nip === nipOrUserId || u.id === nipOrUserId);
        if (target) {
          const salt = target.pinSalt || DEFAULT_SALT;
          const hash =
            target.pinHash ||
            (target.pin
              ? await hashPinWithSalt(target.pin, salt)
              : await hashPinWithSalt('123456', salt));

          const existingIndex = this.users.findIndex((u) => u.userId === target.id);
          const cred: StoredUserCredential = {
            userId: target.id,
            nip: target.nip,
            fullName: target.fullName,
            role: target.role,
            email: target.email,
            phone: target.phone,
            pinSalt: salt,
            pinHash: hash,
            permissions: target.permissions,
            failedAttempts: existingIndex >= 0 ? this.users[existingIndex].failedAttempts : 0,
            lockedUntil: existingIndex >= 0 ? this.users[existingIndex].lockedUntil : null,
            isActive: target.isActive !== false,
          };

          if (existingIndex >= 0) {
            this.users[existingIndex] = cred;
          } else {
            this.users.push(cred);
          }
          this.saveUsers();
        }
      }
    } catch (e) {
      console.warn('Realtime Firestore user lookup warning, using local state:', e);
    }

    const user = this.users.find(
      (u) => u.nip === nipOrUserId || u.userId === nipOrUserId
    );

    if (!user) {
      return { success: false, error: 'Pengguna dengan NIP tersebut tidak ditemukan.' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Akun Anda dinonaktifkan oleh administrator.' };
    }

    // Check lockouts
    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingMin = Math.ceil((user.lockedUntil - now) / 60000);
      return {
        success: false,
        error: `Akun terkunci sementara karena 5x salah PIN. Coba lagi dalam ${remainingMin} menit.`,
      };
    }

    // Verify PIN
    const computedHash = await hashPinWithSalt(pin, user.pinSalt);
    if (computedHash !== user.pinHash) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= MAX_ATTEMPTS) {
        user.lockedUntil = now + LOCKOUT_DURATION_MS;
        this.saveUsers();
        return {
          success: false,
          error: `PIN Salah! Akun telah terkunci selama 15 menit karena ${MAX_ATTEMPTS}x percobaan gagal.`,
        };
      }
      this.saveUsers();
      const sisa = MAX_ATTEMPTS - user.failedAttempts;
      return {
        success: false,
        error: `PIN Salah! Sisa percobaan: ${sisa} kali.`,
      };
    }

    // Success -> Reset failed attempts
    user.failedAttempts = 0;
    user.lockedUntil = null;
    this.saveUsers();

    const userProfile: UserProfile = {
      id: user.userId,
      nip: user.nip,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      permissions: user.permissions && user.permissions.length > 0 ? user.permissions : ROLE_PERMISSIONS[user.role],
      loginAt: now,
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(userProfile));
    return { success: true, user: userProfile };
  }

  public async changeUserPin(
    userId: string,
    oldPin: string,
    newPin: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.init();
    const user = this.users.find((u) => u.userId === userId);
    if (!user) return { success: false, error: 'Pengguna tidak ditemukan.' };

    const oldHash = await hashPinWithSalt(oldPin, user.pinSalt);
    if (oldHash !== user.pinHash) {
      return { success: false, error: 'PIN lama yang Anda masukkan salah.' };
    }

    if (newPin.length < 6 || !/^\d+$/.test(newPin)) {
      return { success: false, error: 'PIN baru harus terdiri dari 6 digit angka.' };
    }

    const newSalt = generateSalt();
    const newHash = await hashPinWithSalt(newPin, newSalt);

    user.pinSalt = newSalt;
    user.pinHash = newHash;
    this.saveUsers();

    // Also update Firestore
    try {
      await FirestoreService.setDocument<UserProfile>('users', userId, {
        id: userId,
        pinSalt: newSalt,
        pinHash: newHash,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to sync new PIN hash to Firestore:', err);
    }

    return { success: true };
  }

  public getSavedSession(): UserProfile | null {
    const session = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!session) return null;
    try {
      const parsed: UserProfile = JSON.parse(session);
      // Validate 24 hours max session duration
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

  public clearSession(): void {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  }
}

export const authService = new AuthService();

