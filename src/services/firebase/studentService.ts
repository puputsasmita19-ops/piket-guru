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
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM',
  },
];

export class StudentService {
  public static async bootstrapIfEmpty(): Promise<void> {
    try {
      const existing = await FirestoreService.getAll<StudentRecord>('students');
      if (!existing || existing.length === 0) {
        for (const std of SEED_STUDENTS) {
          await FirestoreService.setDocument('students', std.id, std);
        }
      }
    } catch (err) {
      console.warn('Error bootstrapping students:', err);
    }
  }

  public static async getAllStudents(): Promise<StudentRecord[]> {
    return FirestoreService.getAll<StudentRecord>('students');
  }

  public static async saveStudent(student: StudentRecord): Promise<void> {
    await FirestoreService.setDocument('students', student.id, student);
  }

  public static async deleteStudent(id: string): Promise<void> {
    await FirestoreService.deleteDocument('students', id);
  }
}
