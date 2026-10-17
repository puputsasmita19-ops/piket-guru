import { UserRole, BaseEntityMetadata } from './index';

export interface BaseRecord extends BaseEntityMetadata {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeacherRecord extends BaseRecord {
  userId?: string;
  nip: string; // NIP (opsional, string)
  nuptk?: string; // NUPTK (opsional, string)
  nik?: string; // NIK (opsional, string)
  idGuru?: string; // ID Guru unik & stabil (string)
  fullName: string;
  mataPelajaran: string;
  pangkatGolongan: string;
  statusKepegawaian: 'PNS' | 'PPPK' | 'GTT' | 'HONORER' | 'LAINNYA' | string;
  phone: string;
  email: string;
}

/**
 * Returns primary accompanying identity for teacher: NIP -> NUPTK -> ID Guru.
 */
export function getTeacherDisplayIdentifier(teacher?: Partial<TeacherRecord> | null): {
  label: string;
  value: string;
  displayBadge: string;
} {
  if (!teacher) return { label: 'ID Guru', value: '-', displayBadge: '-' };
  if (teacher.nip && teacher.nip.trim() !== '' && teacher.nip !== '-') {
    return { label: 'NIP', value: teacher.nip.trim(), displayBadge: `NIP. ${teacher.nip.trim()}` };
  }
  if (teacher.nuptk && teacher.nuptk.trim() !== '' && teacher.nuptk !== '-') {
    return { label: 'NUPTK', value: teacher.nuptk.trim(), displayBadge: `NUPTK. ${teacher.nuptk.trim()}` };
  }
  const idVal = (teacher.idGuru && teacher.idGuru.trim()) || teacher.id || '-';
  return { label: 'ID Guru', value: idVal, displayBadge: `ID: ${idVal}` };
}

/**
 * Safely masks a 16-digit NIK (showing first 4 and last 4 digits).
 */
export function maskNik(nik?: string): string {
  if (!nik || nik.trim() === '' || nik === '-') return '-';
  const clean = nik.trim();
  if (clean.length <= 8) return '********';
  return `${clean.substring(0, 4)}********${clean.substring(clean.length - 4)}`;
}

export interface StaffRecord extends BaseRecord {
  userId?: string;
  nip: string;
  fullName: string;
  divisi: 'Tata Usaha' | 'Keamanan/Satpam' | 'Kebersihan' | 'Sarpras' | 'Perpustakaan' | 'Laboratorium';
  jabatan: string;
  statusKepegawaian: 'PNS' | 'PPPK' | 'PTT' | 'HONORER' | 'LAINNYA' | string;
  phone: string;
}

export interface RoomRecord extends BaseRecord {
  code: string;
  name: string;
  building: string;
  floor: number;
  capacity?: number;
  isActive: boolean;
}

export interface StudentRecord extends BaseRecord {
  studentId?: string; // ID unik internal sistem (e.g. std-001)
  nis?: string;       // Nomor Induk Siswa internal sekolah (dapat mengandung '/', '-', '.')
  nisn?: string;      // Nomor Induk Siswa Nasional (10 digit angka jika ada)
  nama: string;
  kelas: string;
  jenisKelamin: 'L' | 'P';
  noHpOrangTua: string;
  noHpSiswa?: string;
  alamat?: string;
  isActive: boolean;
}

/**
 * Helper to get clean student identifier badge & display label (NIS / NISN / ID)
 */
export function getStudentIdentifierInfo(student?: Partial<StudentRecord>): {
  label: string;
  value: string;
  displayBadge: string;
} {
  if (!student) return { label: 'ID Siswa', value: '-', displayBadge: '-' };
  if (student.nisn && student.nisn.trim() !== '' && student.nisn !== '-') {
    return { label: 'NISN', value: student.nisn.trim(), displayBadge: `NISN. ${student.nisn.trim()}` };
  }
  if (student.nis && student.nis.trim() !== '' && student.nis !== '-') {
    return { label: 'NIS', value: student.nis.trim(), displayBadge: `NIS. ${student.nis.trim()}` };
  }
  const idVal = student.studentId || student.id || '-';
  return { label: 'ID Siswa', value: idVal, displayBadge: `ID: ${idVal}` };
}

export interface IncidentCategoryRecord extends BaseRecord {
  code: string;
  name: string;
  description: string;
  severity: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
  isActive: boolean;
}

export type AuditLogAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'IMPORT'
  | 'EXPORT'
  | 'UPLOAD'
  | 'BACKUP'
  | 'RESTORE'
  | 'ATTENDANCE'
  | 'STATUS_CHANGE'
  | 'SECURITY'
  | 'EMERGENCY';

export type AuditLogModule =
  | 'USERS'
  | 'AUTH'
  | 'TEACHERS'
  | 'STUDENTS'
  | 'STAFF'
  | 'ROOMS'
  | 'CATEGORIES'
  | 'SCHEDULES'
  | 'ATTENDANCE'
  | 'DUTY_BOOK'
  | 'INCIDENTS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'SYSTEM'
  | 'PERMITS'
  | 'TARDINESS'
  | 'SUBSTITUTIONS'
  | 'VISITORS'
  | 'ANNOUNCEMENTS'
  | 'SECURITY'
  | 'BELL';

export type AuditLogStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'BERHASIL' | 'GAGAL' | 'DITOLAK';

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  loginId?: string;
  action: AuditLogAction;
  module: AuditLogModule;
  status?: AuditLogStatus;
  target?: string;
  recordId?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}
