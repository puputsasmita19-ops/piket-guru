import { FirestoreService } from '../firebase/firestoreService';
import { UserProfile, UserRole } from '../../types';

export interface BackupManifest {
  formatVersion: string;
  app: string;
  timestamp: string;
  environment: string;
  createdBy: {
    id: string;
    loginId?: string;
    fullName: string;
    nip?: string;
    role: string;
  };
  metadata: {
    schoolName: string;
    npsn: string;
    totalCollections: number;
    totalRecords: number;
    collectionsList: string[];
    credentialsIncluded: boolean;
  };
}

export interface BackupPayload extends BackupManifest {
  data: {
    users: any[];
    teachers: any[];
    staff: any[];
    rooms: any[];
    incidentCategories: any[];
    schedules: any[];
    attendance: any[];
    dutyBooks: any[];
    incidents: any[];
    settings: any[];
    auditLogs: any[];
    announcements?: any[];
    studentTardiness?: any[];
    substitutions?: any[];
    studentPermits?: any[];
    visitors?: any[];
    students?: any[];
    documents?: any[];
    emergencies?: any[];
    emergency_history?: any[];
  };
}

export const FORBIDDEN_COLLECTIONS = new Set([
  'user_credentials',
  'login_ids',
  'database_snapshots',
  'database_snapshots_chunks',
  'secrets',
  'credentials',
]);

export const ALLOWED_RESTORE_COLLECTIONS = new Set([
  'users',
  'teachers',
  'staff',
  'rooms',
  'incidentCategories',
  'schedules',
  'attendance',
  'dutyBooks',
  'incidents',
  'settings',
  'auditLogs',
  'announcements',
  'studentTardiness',
  'substitutions',
  'studentPermits',
  'visitors',
  'students',
  'documents',
  'emergencies',
  'emergency_history',
]);

export const VALID_USER_ROLES = new Set<string>([
  'ADMIN',
  'KEPALA_SEKOLAH',
  'GURU',
  'TENAGA_KEPENDIDIKAN',
  'SATPAM',
]);

export const CREDENTIAL_FIELD_NAMES = new Set([
  'pin',
  'pinHash',
  'pinSalt',
  'scryptHash',
  'hashedPin',
  'password',
  'token',
  'secret',
  'credential',
  'authSecret',
  'privateKey',
]);

/**
 * Validates whether a document ID conforms strictly to Firestore naming constraints.
 * Must be non-empty, <= 1500 bytes, cannot contain '/', cannot equal '.' or '..', and cannot match '__.*__'.
 */
export function isValidFirestoreDocId(id: string): { valid: boolean; error?: string } {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { valid: false, error: 'Document ID must be a non-empty string.' };
  }
  if (id.includes('/')) {
    return { valid: false, error: `Document ID '${id}' contains illegal forward slash '/'.` };
  }
  if (id === '.' || id === '..') {
    return { valid: false, error: `Document ID '${id}' cannot be '.' or '..'.` };
  }
  if (/^__.*__$/.test(id)) {
    return { valid: false, error: `Document ID '${id}' cannot match reserved regex pattern '__.*__'.` };
  }
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(id).length;
  if (byteLength > 1500) {
    return { valid: false, error: `Document ID exceeds maximum 1500 UTF-8 bytes limit (${byteLength} bytes).` };
  }
  return { valid: true };
}

/**
 * Deeply scans an object or array to check if any forbidden credential keys exist.
 */
export function containsCredentialFields(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) {
    return obj.some((item) => containsCredentialFields(item));
  }
  for (const key of Object.keys(obj)) {
    if (CREDENTIAL_FIELD_NAMES.has(key)) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return true;
      }
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (containsCredentialFields(obj[key])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Recursively strips any credential keys from a record object and sanitizes Date/Timestamp values.
 */
export function stripCredentialsDeep<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle Date objects cleanly
  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  // Handle Firestore Timestamp objects cleanly
  if (typeof (obj as any).toDate === 'function') {
    return (obj as any).toDate().toISOString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripCredentialsDeep(item)) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (CREDENTIAL_FIELD_NAMES.has(key)) {
      continue;
    }
    if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else if (value && typeof (value as any).toDate === 'function') {
      clean[key] = (value as any).toDate().toISOString();
    } else if (value && typeof value === 'object') {
      clean[key] = stripCredentialsDeep(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

export class BackupService {
  /**
   * Generates a complete sanitized JSON snapshot of all 20 operational Firestore collections.
   * Uses getAllStrict: fails closed if any mandatory operational collection cannot be read.
   * Strips all credential fields (including scryptHash) and verifies absence before setting credentialsIncluded: false.
   */
  public static async createFullBackup(adminUser: UserProfile): Promise<BackupPayload> {
    // 1. Strictly fetch all 20 operational collections. Throws immediately on error.
    const [
      users,
      teachers,
      staff,
      rooms,
      incidentCategories,
      schedules,
      attendance,
      dutyBooks,
      incidents,
      settingsList,
      auditLogs,
      announcements,
      studentTardiness,
      substitutions,
      studentPermits,
      visitors,
      students,
      documents,
      emergencies,
      emergency_history,
    ] = await Promise.all([
      FirestoreService.getAllStrict('users'),
      FirestoreService.getAllStrict('teachers'),
      FirestoreService.getAllStrict('staff'),
      FirestoreService.getAllStrict('rooms'),
      FirestoreService.getAllStrict('incidentCategories'),
      FirestoreService.getAllStrict('schedules'),
      FirestoreService.getAllStrict('attendance'),
      FirestoreService.getAllStrict('dutyBooks'),
      FirestoreService.getAllStrict('incidents'),
      FirestoreService.getAllStrict('settings'),
      FirestoreService.getAllStrict('auditLogs'),
      FirestoreService.getAllStrict('announcements'),
      FirestoreService.getAllStrict('studentTardiness'),
      FirestoreService.getAllStrict('substitutions'),
      FirestoreService.getAllStrict('studentPermits'),
      FirestoreService.getAllStrict('visitors'),
      FirestoreService.getAllStrict('students'),
      FirestoreService.getAllStrict('documents'),
      FirestoreService.getAllStrict('emergencies'),
      FirestoreService.getAllStrict('emergency_history'),
    ]);

    // 2. Strict allowlist sanitization for users: strip all credentials completely
    const sanitizedUsers = users.map((u: any) => {
      const clean = stripCredentialsDeep(u);
      return {
        id: clean.id,
        loginId: clean.loginId ? String(clean.loginId).trim().toUpperCase() : undefined,
        nip: clean.nip || '',
        nuptk: clean.nuptk ? String(clean.nuptk).trim() : undefined,
        fullName: clean.fullName || '',
        role: clean.role || 'GURU',
        email: clean.email || '',
        phone: clean.phone || '',
        avatarUrl: clean.avatarUrl || null,
        isActive: clean.isActive === true,
        permissions: clean.permissions || [],
        dataSource: clean.dataSource || 'PRODUCTION',
        isDemo: clean.isDemo || false,
        createdAt: clean.createdAt || '',
        updatedAt: clean.updatedAt || '',
      };
    });

    const dataObj = {
      users: sanitizedUsers,
      teachers: stripCredentialsDeep(teachers),
      staff: stripCredentialsDeep(staff),
      rooms: stripCredentialsDeep(rooms),
      incidentCategories: stripCredentialsDeep(incidentCategories),
      schedules: stripCredentialsDeep(schedules),
      attendance: stripCredentialsDeep(attendance),
      dutyBooks: stripCredentialsDeep(dutyBooks),
      incidents: stripCredentialsDeep(incidents),
      settings: stripCredentialsDeep(settingsList),
      auditLogs: stripCredentialsDeep(auditLogs),
      announcements: stripCredentialsDeep(announcements),
      studentTardiness: stripCredentialsDeep(studentTardiness),
      substitutions: stripCredentialsDeep(substitutions),
      studentPermits: stripCredentialsDeep(studentPermits),
      visitors: stripCredentialsDeep(visitors),
      students: stripCredentialsDeep(students),
      documents: stripCredentialsDeep(documents),
      emergencies: stripCredentialsDeep(emergencies),
      emergency_history: stripCredentialsDeep(emergency_history),
    };

    // 3. Verification scan: ensure NO credential fields exist anywhere in output
    const hasAnyCreds = containsCredentialFields(dataObj);
    if (hasAnyCreds) {
      throw new Error('Integritas keamanan gagal: Field kredensial terdeteksi dalam payload cadangan!');
    }

    const collectionsList = Object.keys(dataObj);
    const totalRecords = Object.values(dataObj).reduce((acc, arr) => acc + (arr?.length || 0), 0);
    const schoolSetting: any = settingsList.find((s: any) => s.id === 'school_config') || {};

    const payload: BackupPayload = {
      formatVersion: '1.3.0',
      app: 'PIKET_GURU_DIGITAL',
      timestamp: new Date().toISOString(),
      environment: 'PRODUCTION',
      createdBy: {
        id: adminUser.id,
        loginId: adminUser.loginId || '',
        fullName: adminUser.fullName,
        nip: adminUser.nip || '',
        role: adminUser.role,
      },
      metadata: {
        schoolName: schoolSetting.schoolName || 'SMK dr. SOEBANDI',
        npsn: schoolSetting.npsn || '20109988',
        totalCollections: collectionsList.length,
        totalRecords,
        collectionsList,
        credentialsIncluded: false, // Proven by scan
      },
      data: dataObj,
    };

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'BACKUP',
      module: 'SETTINGS',
      details: `Membuat full backup tersanitasi (${totalRecords} dokumen data dari ${collectionsList.length} koleksi)`,
    });

    return payload;
  }

  /**
   * Triggers download of backup file to browser
   */
  public static downloadBackupFile(payload: BackupPayload): void {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BACKUP_PIKETGURU_${dateStr}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates schema of uploaded backup JSON file before touching database.
   * Performs exhaustive preflight schema and type checking across ALL records in ALL collections (R5-03).
   */
  public static validateBackupSchema(json: any): {
    isValid: boolean;
    error?: string;
    warning?: string;
    hasLegacyCredentials?: boolean;
    totalRecords?: number;
    collectionsFound?: string[];
  } {
    if (!json || typeof json !== 'object') {
      return { isValid: false, error: 'Format berkas JSON tidak valid.' };
    }
    if (json.app !== 'PIKET_GURU_DIGITAL') {
      return { isValid: false, error: 'Berkas ini bukan arsip cadangan resmi aplikasi Piket Guru.' };
    }
    if (!['1.0.0', '1.1.0', '1.2.0', '1.3.0'].includes(json.formatVersion)) {
      return { isValid: false, error: `Versi format cadangan '${json.formatVersion}' tidak didukung.` };
    }
    if (!json.data || typeof json.data !== 'object' || Array.isArray(json.data)) {
      return { isValid: false, error: 'Struktur payload data cadangan tidak ditemukan atau rusak.' };
    }

    const collectionsFound = Object.keys(json.data);

    // Reject unknown or strictly forbidden collections before write
    for (const col of collectionsFound) {
      if (FORBIDDEN_COLLECTIONS.has(col)) {
        return {
          isValid: false,
          error: `Arsip cadangan memuat koleksi terlarang '${col}'. Proses restore ditolak demi keamanan.`,
        };
      }
      if (!ALLOWED_RESTORE_COLLECTIONS.has(col)) {
        return {
          isValid: false,
          error: `Koleksi tidak dikenal '${col}' terdeteksi dalam arsip.`,
        };
      }

      // Check collection is strictly an array
      const items = json.data[col];
      if (!Array.isArray(items)) {
        return {
          isValid: false,
          error: `Koleksi '${col}' dalam cadangan bukan merupakan array data yang valid.`,
        };
      }

      // Preflight validation: check each record ID and field types
      const idSet = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return {
            isValid: false,
            error: `Record #${i} dalam koleksi '${col}' bukan objek valid.`,
          };
        }
        if (!item.id || typeof item.id !== 'string') {
          return {
            isValid: false,
            error: `Record #${i} dalam koleksi '${col}' tidak memiliki ID string yang valid.`,
          };
        }

        const idCheck = isValidFirestoreDocId(item.id);
        if (!idCheck.valid) {
          return {
            isValid: false,
            error: `Record #${i} dalam koleksi '${col}' memiliki ID tidak valid: ${idCheck.error}`,
          };
        }

        if (idSet.has(item.id)) {
          return {
            isValid: false,
            error: `Duplikasi ID '${item.id}' terdeteksi pada koleksi '${col}'.`,
          };
        }
        idSet.add(item.id);

        // Exhaustive per-collection schema validation (R5-03, R6-04)
        if (col === 'users') {
          if (item.loginId !== undefined && (typeof item.loginId !== 'string' || item.loginId.trim().length === 0)) {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki loginId bukan string yang valid.`,
            };
          }
          if (item.nip !== undefined && typeof item.nip !== 'string') {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki nip bukan string.`,
            };
          }
          if (item.nuptk !== undefined && typeof item.nuptk !== 'string') {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki nuptk bukan string.`,
            };
          }
          if (item.role !== undefined) {
            if (typeof item.role !== 'string') {
              return {
                isValid: false,
                error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki role bukan string (ditemukan tipe: ${typeof item.role}).`,
              };
            }
            if (!VALID_USER_ROLES.has(item.role)) {
              return {
                isValid: false,
                error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki role '${item.role}' yang tidak valid.`,
              };
            }
          }
          if (item.permissions !== undefined) {
            if (!Array.isArray(item.permissions) || item.permissions.some((p: any) => typeof p !== 'string')) {
              return {
                isValid: false,
                error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki permissions yang bukan array string.`,
              };
            }
          }
          if (item.isActive !== undefined && typeof item.isActive !== 'boolean') {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki isActive yang bukan boolean.`,
            };
          }
          if (item.requiresActivation !== undefined && typeof item.requiresActivation !== 'boolean') {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki requiresActivation yang bukan boolean.`,
            };
          }
          if (item.sessionRevokedAtSeconds !== undefined) {
            if (
              typeof item.sessionRevokedAtSeconds !== 'number' ||
              !Number.isFinite(item.sessionRevokedAtSeconds) ||
              !Number.isInteger(item.sessionRevokedAtSeconds) ||
              item.sessionRevokedAtSeconds < 0
            ) {
              return {
                isValid: false,
                error: `Record #${i} dalam koleksi 'users' (${item.id}) memiliki sessionRevokedAtSeconds yang tidak valid (harus finite non-negative integer detik).`,
              };
            }
          }
        } else {
          // General record validation across all restore collections
          if (item.days !== undefined && !Array.isArray(item.days)) {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi '${col}' (${item.id}) memiliki field 'days' yang bukan array.`,
            };
          }
          if (item.classes !== undefined && !Array.isArray(item.classes)) {
            return {
              isValid: false,
              error: `Record #${i} dalam koleksi '${col}' (${item.id}) memiliki field 'classes' yang bukan array.`,
            };
          }
        }
      }
    }

    const hasLegacyCredentials = containsCredentialFields(json.data);
    const totalRecords = collectionsFound.reduce(
      (acc, k) => acc + (Array.isArray(json.data[k]) ? json.data[k].length : 0),
      0
    );

    return {
      isValid: true,
      hasLegacyCredentials,
      warning: hasLegacyCredentials
        ? 'Arsip cadangan lawas terdeteksi memuat field kredensial. Seluruh field kredensial akan dihapus secara otomatis dan akun akan memerlukan aktivasi PIN baru.'
        : undefined,
      totalRecords,
      collectionsFound,
    };
  }

  /**
   * Restores all collections from backup payload to Firestore with strict security state enforcement:
   * 1. Schema, arrays, IDs, and collections validated completely before any write.
   * 2. Completely strips any credentials from users via deleteField().
   * 3. Prevents privilege escalation: non-admin users in backup file cannot gain ADMIN role or permissions.
   * 4. Acting Admin Session Safety: Acting admin's session marker is NOT revoked during active restore,
   *    ensuring the active Firebase auth token remains authorized for subsequent writes.
   * 5. Other restored users require activation (requiresActivation: true) and have monotonic revocation markers.
   * 6. Strict error propagation on getByIdStrict (no silent error swallowing).
   * 7. Treats auditLogs as append-only.
   */
  public static async restoreFullBackup(
    payload: BackupPayload,
    adminUser: UserProfile
  ): Promise<{ restoredCount: number; sanitizedUsersCount: number }> {
    // 1. Validation check before first write (all IDs and schemas verified)
    const validation = this.validateBackupSchema(payload);
    if (!validation.isValid) {
      throw new Error(`Validasi berkas cadangan gagal: ${validation.error}`);
    }

    let restoredCount = 0;
    let sanitizedUsersCount = 0;
    const nowSeconds = Math.floor(Date.now() / 1000);

    const collections = Object.keys(payload.data) as Array<keyof BackupPayload['data']>;

    for (const collName of collections) {
      if (!ALLOWED_RESTORE_COLLECTIONS.has(collName)) {
        console.warn(`[RESTORE] Skipping unauthorized collection: ${collName}`);
        continue;
      }

      const items = payload.data[collName];
      if (Array.isArray(items)) {
        for (const rawItem of items) {
          if (!rawItem || !rawItem.id) continue;

          let safeItem = stripCredentialsDeep({ ...rawItem });

          // Specific collection handlers
          if (collName === 'auditLogs') {
            // Audit logs are append-only: check if already exists to avoid overwriting
            const existing = await FirestoreService.getById('auditLogs', safeItem.id);
            if (existing) {
              continue; // Do not overwrite existing audit logs
            }
          } else if (collName === 'users') {
            // Fetch existing profile in database strictly to ensure monotonic revocation marker
            // getByIdStrict returns null if document does not exist, and throws on permission/network error
            const existingProfile = await FirestoreService.getByIdStrict<UserProfile>('users', safeItem.id);
            const existingRevoked = existingProfile?.sessionRevokedAtSeconds || 0;

            // Security state policy for restored users:
            if (safeItem.id === adminUser.id) {
              // Acting admin executing the restore:
              // Retain current session marker so the acting admin's session is NOT severed mid-restore!
              safeItem.role = 'ADMIN';
              safeItem.isActive = true;
              safeItem.permissions = ['*'];
              safeItem.requiresActivation = false;
              safeItem.sessionRevokedAtSeconds = existingRevoked; // Preserve active session
            } else if (safeItem.id === 'usr-admin-01') {
              // Primary bootstrap admin
              safeItem.role = 'ADMIN';
              safeItem.isActive = true;
              safeItem.permissions = ['*'];
              safeItem.requiresActivation = false;
              safeItem.sessionRevokedAtSeconds = Math.max(existingRevoked, nowSeconds);
            } else {
              // Non-primary users restored from backup:
              // Strictly governed by server policy - cannot gain ADMIN role or wildcard permissions from file
              if (existingProfile && existingProfile.role) {
                // If user already exists in database, preserve their database-authoritative role
                safeItem.role = existingProfile.role;
              } else if (safeItem.role === 'ADMIN') {
                safeItem.role = 'GURU'; // Downgrade injected admin role in backup file
              }
              const rawPerms = Array.isArray(safeItem.permissions) ? safeItem.permissions : [];
              safeItem.permissions = rawPerms.filter((p: any) => typeof p === 'string' && p !== '*');
              safeItem.requiresActivation = true;
              safeItem.sessionRevokedAtSeconds = Math.max(existingRevoked, nowSeconds);
            }

            sanitizedUsersCount++;
            if (safeItem.loginId) {
              safeItem.loginId = String(safeItem.loginId).trim().toUpperCase();
            }
            if (safeItem.nip) {
              safeItem.nip = String(safeItem.nip).trim();
            }
            if (safeItem.nuptk) {
              safeItem.nuptk = String(safeItem.nuptk).trim();
            }
          }

          // Write document with purgeLegacyCredentials to remove any old credentials via deleteField()
          await FirestoreService.setDocument(collName, safeItem.id, safeItem, {
            purgeLegacyCredentials: collName === 'users',
          });
          restoredCount++;
        }
      }
    }

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'RESTORE',
      module: 'SETTINGS',
      details: `Memulihkan database dari arsip cadangan (${restoredCount} dokumen dipulihkan, ${sanitizedUsersCount} profil pengguna diamankan tanpa kredensial)`,
    });

    return { restoredCount, sanitizedUsersCount };
  }
}
