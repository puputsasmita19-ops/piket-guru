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
  nip: string;
  fullName: string;
  mataPelajaran: string;
  pangkatGolongan: string;
  statusKepegawaian: 'PNS' | 'PPPK' | 'GTT' | 'HONORER' | 'LAINNYA' | string;
  phone: string;
  email: string;
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
  nisn: string;
  nama: string;
  kelas: string;
  jenisKelamin: 'L' | 'P';
  noHpOrangTua: string;
  alamat?: string;
  isActive: boolean;
}

export interface IncidentCategoryRecord extends BaseRecord {
  code: string;
  name: string;
  description: string;
  severity: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
  isActive: boolean;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action:
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
  module:
    | 'USERS'
    | 'TEACHERS'
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
  recordId?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}
