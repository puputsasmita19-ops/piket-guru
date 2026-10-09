import { DayOfWeek, UserRole, SchoolSettings, LoginSupportContact, DEFAULT_LOBBY_TV_CONFIG } from '../types';

export const APP_NAME = 'PIKET GURU';
export const APP_SUBTITLE = 'Jadwal & Buku Piket Digital Sekolah';

export const DEFAULT_LOGIN_SUPPORT_CONTACT: LoginSupportContact = {
  enabled: true,
  adminName: 'Admin Piket Sekolah',
  buttonLabel: 'Hubungi Admin',
  contactType: 'whatsapp',
  target: '081234567890',
  initialMessage: 'Halo Admin, saya membutuhkan bantuan terkait akses login akun Piket Guru.',
};

export const DEFAULT_DAILY_SCHEDULES: Record<DayOfWeek, {
  start: string;
  end: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  isActive: boolean;
}> = {
  SENIN: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    isActive: true,
  },
  SELASA: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    isActive: true,
  },
  RABU: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    isActive: true,
  },
  KAMIS: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    isActive: true,
  },
  JUMAT: {
    start: '06:30',
    end: '11:45',
    checkInStart: '06:00',
    checkInEnd: '07:15',
    checkOutStart: '11:30',
    checkOutEnd: '13:00',
    isActive: true,
  },
  SABTU: {
    start: '06:30',
    end: '13:00',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '12:30',
    checkOutEnd: '14:30',
    isActive: true,
  },
  MINGGU: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '08:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    isActive: true,
  },
};

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'SMA Negeri 1 Prestasi Bangsa',
  npsn: '20109988',
  address: 'Jl. Pendidikan No. 45, Kompleks Edukasi, Jakarta',
  phone: '021-78901234',
  email: 'info@sman1prestasibangsa.sch.id',
  website: 'www.sman1prestasibangsa.sch.id',
  appName: 'PIKET GURU',
  appSubtitle: 'Jadwal & Buku Piket Digital Sekolah',
  appCreator: 'Tim Pengembang Sistem Piket',
  logoUrl: '',
  schoolLat: -6.200000,
  schoolLng: 106.816666,
  allowedRadiusMeters: 50,
  attendanceMode: 'TERJADWAL',
  reportCity: 'Jakarta',
  principalName: 'Dr. Hj. Siti Rohmah, M.Pd.',
  principalIdType: 'NIP',
  principalIdNumber: '197605122000032001',
  principalSignatureUrl: '',
  coordinatorName: 'Drs. H. Ahmad Fauzi, M.Pd.',
  coordinatorIdType: 'NIP',
  coordinatorIdNumber: '198503152010011002',
  coordinatorSignatureUrl: '',
  academicSemester: {
    academicYear: '2026/2027',
    oddSemesterStart: '2026-07-01',
    oddSemesterEnd: '2026-12-31',
    evenSemesterStart: '2027-01-01',
    evenSemesterEnd: '2027-06-30',
  },
  loginSupportContact: DEFAULT_LOGIN_SUPPORT_CONTACT,
  lobbyTv: DEFAULT_LOBBY_TV_CONFIG,
  printConfig: {
    paperSize: 'A4',
    f4WidthMm: 215,
    f4HeightMm: 330,
    orientation: 'portrait',
    marginTopMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    marginRightMm: 15,
    showLogo: true,
    showLetterhead: true,
    showSignatures: true,
  },
  workHours: {
    start: '06:30',
    end: '15:30',
    checkInStart: '06:00',
    checkInEnd: '07:30',
    checkOutStart: '14:30',
    checkOutEnd: '17:00',
    activeDays: ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as DayOfWeek[],
    dailySchedules: DEFAULT_DAILY_SCHEDULES,
  },
};

export const DAYS_LIST: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

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
