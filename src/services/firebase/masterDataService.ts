import { FirestoreService } from './firestoreService';
import {
  TeacherRecord,
  StaffRecord,
  RoomRecord,
  IncidentCategoryRecord,
  AuditLogRecord,
} from '../../types/master.types';
import { UserProfile, SchoolSettings } from '../../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';

export class MasterDataService {
  /**
   * Initialize and seed database if empty
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    try {
      // 1. Check Settings (System Record)
      const currentSettings = await FirestoreService.getById<SchoolSettings>('settings', 'school_config');
      if (!currentSettings) {
        await FirestoreService.setDocument('settings', 'school_config', {
          ...DEFAULT_SCHOOL_SETTINGS,
          id: 'school_config',
        });
      }

      // 2. Check Incident Categories (System Reference Data)
      const categories = await FirestoreService.getAllRaw<IncidentCategoryRecord>('incidentCategories');
      if (categories.length === 0) {
        const standardCategories: IncidentCategoryRecord[] = [
          {
            id: 'cat-01',
            code: 'SISWA',
            name: 'Kesiswaan & Perilaku',
            description: 'Pelanggaran tata tertib, keterlambatan, perkelahian, atau insiden siswa.',
            severity: 'SEDANG',
            isActive: true,
            dataSource: 'PRODUCTION',
            isDemo: false,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'cat-02',
            code: 'KESEHATAN',
            name: 'Kesehatan & Medis',
            description: 'Siswa atau guru sakit, pingsan, cedera saat olahraga/upacara.',
            severity: 'TINGGI',
            isActive: true,
            dataSource: 'PRODUCTION',
            isDemo: false,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'cat-03',
            code: 'FASILITAS',
            name: 'Sarana & Prasarana',
            description: 'Kerusakan meja/kursi, proyektor, kran air, lampu, atau fasilitas umum.',
            severity: 'SEDANG',
            isActive: true,
            dataSource: 'PRODUCTION',
            isDemo: false,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'cat-04',
            code: 'KEAMANAN',
            name: 'Keamanan & Ketertiban',
            description: 'Tamu mencurigakan, kehilangan barang, pencurian, atau gangguan keamanan.',
            severity: 'KRITIS',
            isActive: true,
            dataSource: 'PRODUCTION',
            isDemo: false,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'cat-05',
            code: 'KEBERSIHAN',
            name: 'Kebersihan Lingkungan',
            description: 'Sampah menumpuk, saluran tersumbat, toilet kotor.',
            severity: 'RENDAH',
            isActive: true,
            dataSource: 'PRODUCTION',
            isDemo: false,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
        ];

        for (const cat of standardCategories) {
          await FirestoreService.setDocument('incidentCategories', cat.id, cat);
        }
      }
      // Note: Automatic demo seeding for rooms, teachers, and staff has been disabled
      // to ensure operational database integrity in PIKET GURU v1.0.1
    } catch (err) {
      console.warn('Bootstrap initialization warning (continuing with offline storage):', err);
    }
  }
}
