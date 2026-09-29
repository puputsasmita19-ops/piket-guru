import { FirestoreService } from '../firebase/firestoreService';
import { UserProfile, SchoolSettings } from '../../types';

export interface BackupPayload {
  version: string;
  app: string;
  timestamp: string;
  createdBy: {
    id: string;
    fullName: string;
    nip: string;
    role: string;
  };
  metadata: {
    schoolName: string;
    npsn: string;
    totalCollections: number;
    totalRecords: number;
  };
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
  };
}

export class BackupService {
  /**
   * Generates a complete JSON snapshot of all Firestore collections
   */
  public static async createFullBackup(adminUser: UserProfile): Promise<BackupPayload> {
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
    ] = await Promise.all([
      FirestoreService.getAll('users'),
      FirestoreService.getAll('teachers'),
      FirestoreService.getAll('staff'),
      FirestoreService.getAll('rooms'),
      FirestoreService.getAll('incidentCategories'),
      FirestoreService.getAll('schedules'),
      FirestoreService.getAll('attendance'),
      FirestoreService.getAll('dutyBooks'),
      FirestoreService.getAll('incidents'),
      FirestoreService.getAll('settings'),
      FirestoreService.getAll('auditLogs'),
    ]);

    const schoolSetting: any = settingsList.find((s: any) => s.id === 'school_config') || {};

    const totalRecords =
      users.length +
      teachers.length +
      staff.length +
      rooms.length +
      incidentCategories.length +
      schedules.length +
      attendance.length +
      dutyBooks.length +
      incidents.length +
      settingsList.length +
      auditLogs.length;

    const payload: BackupPayload = {
      version: '1.0.0',
      app: 'PIKET_GURU_DIGITAL',
      timestamp: new Date().toISOString(),
      createdBy: {
        id: adminUser.id,
        fullName: adminUser.fullName,
        nip: adminUser.nip,
        role: adminUser.role,
      },
      metadata: {
        schoolName: schoolSetting.schoolName || 'SMA Negeri 1 Prestasi Bangsa',
        npsn: schoolSetting.npsn || '20109988',
        totalCollections: 11,
        totalRecords,
      },
      data: {
        users,
        teachers,
        staff,
        rooms,
        incidentCategories,
        schedules,
        attendance,
        dutyBooks,
        incidents,
        settings: settingsList,
        auditLogs,
      },
    };

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'BACKUP',
      module: 'SETTINGS',
      details: `Membuat full backup database (${totalRecords} dokumen data)`,
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
   * Validates schema of uploaded backup JSON file
   */
  public static validateBackupSchema(json: any): { isValid: boolean; error?: string } {
    if (!json || typeof json !== 'object') {
      return { isValid: false, error: 'Format berkas JSON tidak valid.' };
    }
    if (json.app !== 'PIKET_GURU_DIGITAL') {
      return { isValid: false, error: 'Berkas ini bukan arsip cadangan resmi aplikasi Piket Guru.' };
    }
    if (!json.data || typeof json.data !== 'object') {
      return { isValid: false, error: 'Struktur payload data cadangan tidak ditemukan atau rusak.' };
    }
    return { isValid: true };
  }

  /**
   * Restores all collections from backup payload to Firestore
   */
  public static async restoreFullBackup(
    payload: BackupPayload,
    adminUser: UserProfile
  ): Promise<{ restoredCount: number }> {
    let restoredCount = 0;
    const collections = Object.keys(payload.data) as Array<keyof BackupPayload['data']>;

    for (const collName of collections) {
      const items = payload.data[collName];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            await FirestoreService.setDocument(collName, item.id, item);
            restoredCount++;
          }
        }
      }
    }

    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'RESTORE',
      module: 'SETTINGS',
      details: `Memulihkan database dari arsip cadangan (${restoredCount} dokumen berhasil dipulihkan)`,
    });

    return { restoredCount };
  }
}
