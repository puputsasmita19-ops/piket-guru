import { StudentRecord } from '../../types/master.types';
import { FirestoreService } from './firestoreService';

export const SEED_STUDENTS: StudentRecord[] = [
  {
    id: 'std-001',
    nisn: '0081234561',
    nama: 'Ahmad Rizky Pratama',
    kelas: 'X MIPA 1',
    jenisKelamin: 'L',
    noHpOrangTua: '081234567890',
    alamat: 'Jl. Melati No. 12',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-002',
    nisn: '0081234562',
    nama: 'Annisa Putri Rahmawati',
    kelas: 'X MIPA 2',
    jenisKelamin: 'P',
    noHpOrangTua: '081234567891',
    alamat: 'Jl. Kenanga No. 4',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-003',
    nisn: '0081234563',
    nama: 'Bagus Setiawan',
    kelas: 'X IPS 1',
    jenisKelamin: 'L',
    noHpOrangTua: '081234567892',
    alamat: 'Jl. Mawar No. 7',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-004',
    nisn: '0071234564',
    nama: 'Dewi Lestari',
    kelas: 'XI MIPA 1',
    jenisKelamin: 'P',
    noHpOrangTua: '081234567893',
    alamat: 'Jl. Anggrek No. 18',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-005',
    nisn: '0071234565',
    nama: 'Fajar Nugraha',
    kelas: 'XI IPS 2',
    jenisKelamin: 'L',
    noHpOrangTua: '081234567894',
    alamat: 'Jl. Cempaka No. 21',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-006',
    nisn: '0061234566',
    nama: 'Muhammad Ilham Maulana',
    kelas: 'XII MIPA 2',
    jenisKelamin: 'L',
    noHpOrangTua: '081234567895',
    alamat: 'Jl. Dahlia No. 5',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
  {
    id: 'std-007',
    nisn: '0061234567',
    nama: 'Siti Aisyah Azzahra',
    kelas: 'XII IPS 1',
    jenisKelamin: 'P',
    noHpOrangTua: '081234567896',
    alamat: 'Jl. Flamboyan No. 9',
    isActive: true,
    dataSource: 'SEED',
    isDemo: true,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
];

export class StudentService {
  /**
   * Automatic demo student seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official school data
    return;
  }

  /**
   * Explicit demo student seeder for development/testing environments
   */
  public static async seedDemoStudents(): Promise<void> {
    try {
      const existing = await FirestoreService.getAllRaw<StudentRecord>('students');
      if (!existing || existing.length === 0) {
        for (const std of SEED_STUDENTS) {
          await FirestoreService.setDocument('students', std.id, std);
        }
      }
    } catch (err) {
      console.warn('Error seeding demo students:', err);
    }
  }

  public static async getAllStudents(): Promise<StudentRecord[]> {
    return FirestoreService.getAll<StudentRecord>('students');
  }

  public static async saveStudent(student: StudentRecord): Promise<void> {
    const payload = {
      ...student,
      dataSource: student.dataSource || 'PRODUCTION',
      isDemo: student.isDemo !== undefined ? student.isDemo : false,
    };
    await FirestoreService.setDocument('students', student.id, payload);
  }

  public static async deleteStudent(id: string): Promise<void> {
    await FirestoreService.deleteDocument('students', id);
  }
}
