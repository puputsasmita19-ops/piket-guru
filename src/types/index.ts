export type UserRole = 'ADMIN' | 'KEPALA_SEKOLAH' | 'GURU' | 'TENAGA_KEPENDIDIKAN' | 'SATPAM';

export type DataSourceType = 'PRODUCTION' | 'SEED';

export interface BaseEntityMetadata {
  dataSource?: DataSourceType;
  isDemo?: boolean;
}

/**
 * Checks if a record is operational (production) data.
 * Compatibility rules:
 * - isDemo === true -> false (SEED)
 * - dataSource === 'SEED' -> false (SEED)
 * - isDemo === false -> true (PRODUCTION)
 * - dataSource === 'PRODUCTION' -> true (PRODUCTION)
 * - field is missing/undefined -> true (legacy treated as PRODUCTION)
 */
export const isOperationalRecord = (item: any): boolean => {
  if (!item || typeof item !== 'object') return false;
  if (item.isDemo === true) return false;
  if (item.dataSource === 'SEED') return false;
  return true;
};

export const isSeedRecord = (item: any): boolean => {
  return !isOperationalRecord(item);
};

export interface UserProfile extends BaseEntityMetadata {
  id: string;
  loginId?: string;
  nip?: string;
  nuptk?: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  loginAt?: number;
  isActive: boolean;
  permissions: string[];
  requiresActivation?: boolean;
  sessionRevokedAtSeconds?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DayOfWeek = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'MINGGU';

export type ScheduleStatus = 'TERJADWAL' | 'BERJALAN' | 'SELESAI' | 'DIGANTIKAN' | 'DIBATALKAN';

export interface ScheduleItem extends BaseEntityMetadata {
  id: string;
  tanggal: string;
  hari: DayOfWeek;
  jamMulai: string;
  jamSelesai: string;
  petugasId: string;
  petugasName: string;
  petugasRole: string;
  ruangId: string;
  ruangName: string;
  status: ScheduleStatus;
  keterangan?: string;
}

export type AttendanceStatus = 'DALAM_LOKASI' | 'DI_LUAR_LOKASI' | 'GPS_ERROR' | 'AKURASI_RENDAH';

export interface AttendanceRecord extends BaseEntityMetadata {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  tanggal: string;
  jamMasuk: string;
  jamPulang?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  distance: number;
  status: AttendanceStatus;
  photoUrl?: string;
}

export type DutyBookStatus = 'DRAFT' | 'DIAJUKAN' | 'DIVERIFIKASI' | 'DISETUJUI' | 'DIKUNCI';

export interface DutyBookItem extends BaseEntityMetadata {
  id: string;
  scheduleId: string;
  petugasId: string;
  petugasName: string;
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  kondisiKeamanan: string;
  kondisiKebersihan: string;
  kondisiKelas: string;
  kondisiFasilitas: string;
  kondisiSiswa: string;
  catatanPiket: string;
  status: DutyBookStatus;
}

export type IncidentCategory = 'SISWA' | 'FASILITAS' | 'KEAMANAN' | 'KEBERSIHAN' | 'KEDISIPLINAN' | 'KESEHATAN' | 'LAINNYA';
export type IncidentStatus = 'DILAPORKAN' | 'DALAM_PENANGANAN' | 'SELESAI' | 'DIPERLUKAN_ESKALASI';

export interface IncidentItem {
  id: string;
  tanggal: string;
  waktu: string;
  pelaporId: string;
  pelaporName: string;
  lokasi: string;
  kategori: IncidentCategory;
  uraian: string;
  tindakanAwal: string;
  status: IncidentStatus;
}

export interface DayShiftDetail {
  isActive: boolean;
  start: string;         // Jam Mulai Tugas Shift
  end: string;           // Jam Selesai Tugas Shift
  checkInStart: string;  // Jam Awal Buka Presensi Masuk
  checkInEnd: string;    // Jam Akhir Batas Presensi Masuk
  checkOutStart: string; // Jam Awal Buka Presensi Pulang
  checkOutEnd: string;   // Jam Akhir Batas Presensi Pulang
}

export type DailyScheduleMap = Partial<Record<DayOfWeek, DayShiftDetail>>;

export interface SchoolSettings {
  id?: string;
  schoolName: string;
  npsn: string;
  address: string;
  appName?: string;
  appSubtitle?: string;
  appCreator?: string;
  logoUrl?: string;
  schoolLat: number;
  schoolLng: number;
  allowedRadiusMeters: number;
  workHours: {
    start: string;
    end: string;
    checkInStart?: string;
    checkInEnd?: string;
    checkOutStart?: string;
    checkOutEnd?: string;
    activeDays?: DayOfWeek[];
    dailySchedules?: DailyScheduleMap;
  };
}

export type NavigationTab =
  | 'dashboard'
  | 'command-center'
  | 'kiosk'
  | 'schedules'
  | 'attendance'
  | 'duty-book'
  | 'incidents'
  | 'student-tardiness'
  | 'substitutions'
  | 'student-permits'
  | 'visitors'
  | 'reports'
  | 'users'
  | 'settings';
