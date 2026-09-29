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
import { SEED_USERS } from '../auth/authService';

export class MasterDataService {
  /**
   * Initialize and seed database if empty
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    try {
      // 1. Check Settings
      const currentSettings = await FirestoreService.getById<SchoolSettings>('settings', 'school_config');
      if (!currentSettings) {
        await FirestoreService.setDocument('settings', 'school_config', {
          ...DEFAULT_SCHOOL_SETTINGS,
          id: 'school_config',
        });
      }

      // 2. Check Rooms
      const rooms = await FirestoreService.getAll<RoomRecord>('rooms');
      if (rooms.length === 0) {
        const seedRooms: RoomRecord[] = [
          {
            id: 'room-01',
            code: 'LOBBY-01',
            name: 'Pos Utama & Gerbang Depan',
            building: 'Gedung Utama',
            floor: 1,
            capacity: 5,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'room-02',
            code: 'GEDA-LT1',
            name: 'Gedung A (Lantai 1 - Kelas X)',
            building: 'Gedung A',
            floor: 1,
            capacity: 350,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'room-03',
            code: 'GEDB-LAB',
            name: 'Gedung B (Lab Komputer & Perpustakaan)',
            building: 'Gedung B',
            floor: 2,
            capacity: 120,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'room-04',
            code: 'GEDC-LT2',
            name: 'Gedung C (Lantai 2 - Kelas XI & XII)',
            building: 'Gedung C',
            floor: 2,
            capacity: 400,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'room-05',
            code: 'KANTIN-LAP',
            name: 'Area Kantin & Lapangan Olahraga',
            building: 'Area Terbuka',
            floor: 1,
            capacity: 500,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
        ];

        for (const room of seedRooms) {
          await FirestoreService.setDocument('rooms', room.id, room);
        }
      }

      // 3. Check Incident Categories
      const categories = await FirestoreService.getAll<IncidentCategoryRecord>('incidentCategories');
      if (categories.length === 0) {
        const seedCategories: IncidentCategoryRecord[] = [
          {
            id: 'cat-01',
            code: 'SISWA',
            name: 'Kesiswaan & Perilaku',
            description: 'Pelanggaran tata tertib, keterlambatan, perkelahian, atau insiden siswa.',
            severity: 'SEDANG',
            isActive: true,
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
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
        ];

        for (const cat of seedCategories) {
          await FirestoreService.setDocument('incidentCategories', cat.id, cat);
        }
      }

      // 4. Check Teachers
      const teachers = await FirestoreService.getAll<TeacherRecord>('teachers');
      if (teachers.length === 0) {
        const seedTeachers: TeacherRecord[] = [
          {
            id: 'tch-01',
            userId: 'usr-admin-01',
            nip: '198503152010011002',
            fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
            mataPelajaran: 'Pendidikan Agama Islam',
            pangkatGolongan: 'Pembina / IVa',
            statusKepegawaian: 'PNS',
            phone: '081234567890',
            email: 'ahmad.fauzi@sekolah.sch.id',
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'tch-02',
            userId: 'usr-guru-01',
            nip: '199008212015022003',
            fullName: 'Siti Nurhaliza, S.Pd.',
            mataPelajaran: 'Bahasa Indonesia',
            pangkatGolongan: 'Penata Muda Tk. I / IIIb',
            statusKepegawaian: 'PNS',
            phone: '081345678901',
            email: 'siti.nurhaliza@sekolah.sch.id',
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'tch-03',
            userId: 'usr-guru-02',
            nip: '198711042012011005',
            fullName: 'Budi Santoso, M.Kom.',
            mataPelajaran: 'Informatika & TIK',
            pangkatGolongan: 'Penata / IIIc',
            statusKepegawaian: 'PNS',
            phone: '081456789012',
            email: 'budi.santoso@sekolah.sch.id',
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
        ];

        for (const t of seedTeachers) {
          await FirestoreService.setDocument('teachers', t.id, t);
        }
      }

      // 5. Check Staff
      const staffList = await FirestoreService.getAll<StaffRecord>('staff');
      if (staffList.length === 0) {
        const seedStaff: StaffRecord[] = [
          {
            id: 'stf-01',
            userId: 'usr-tendik-01',
            nip: '198902142014031002',
            fullName: 'Mulyadi, S.AP.',
            divisi: 'Tata Usaha',
            jabatan: 'Kepala Bagian Tata Usaha',
            statusKepegawaian: 'PNS',
            phone: '081567890123',
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
          {
            id: 'stf-02',
            nip: '199205102018011004',
            fullName: 'Agus Setiawan',
            divisi: 'Keamanan/Satpam',
            jabatan: 'Koordinator Keamanan Gerbang',
            statusKepegawaian: 'HONORER',
            phone: '081678901234',
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM',
            updatedAt: new Date().toISOString(),
            updatedBy: 'SYSTEM',
          },
        ];

        for (const s of seedStaff) {
          await FirestoreService.setDocument('staff', s.id, s);
        }
      }
    } catch (err) {
      console.warn('Bootstrap seeding failed (continuing with offline storage):', err);
    }
  }
}
