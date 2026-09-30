import { DayOfWeek, UserRole } from '../types';

export const APP_NAME = 'PIKET GURU';
export const APP_SUBTITLE = 'Jadwal & Buku Piket Digital Sekolah';

export const DEFAULT_SCHOOL_SETTINGS = {
  schoolName: 'SMA Negeri 1 Prestasi Bangsa',
  npsn: '20109988',
  address: 'Jl. Pendidikan No. 45, Kompleks Edukasi, Jakarta',
  appName: 'PIKET GURU',
  appSubtitle: 'Jadwal & Buku Piket Digital Sekolah',
  appCreator: 'Tim Pengembang Sistem Piket',
  schoolLat: -6.200000,
  schoolLng: 106.816666,
  allowedRadiusMeters: 50,
  workHours: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
  },
};

export const DAYS_LIST: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  GURU: 'Guru Pengajar',
  TENAGA_KEPENDIDIKAN: 'Tenaga Kependidikan',
  SATPAM: 'Petugas Keamanan / Satpam',
};

export const MOCK_CURRENT_USER = {
  id: 'usr-001',
  nip: '198503152010011002',
  fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
  role: 'ADMIN' as UserRole,
  email: 'ahmad.fauzi@sekolah.sch.id',
  phone: '081234567890',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  isActive: true,
  permissions: ['*'],
};
