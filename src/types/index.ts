export type UserRole = 'ADMIN' | 'KEPALA_SEKOLAH' | 'GURU' | 'TENAGA_KEPENDIDIKAN' | 'SATPAM';

export interface UserProfile {
  id: string;
  nip: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  avatarUrl?: string;
  pin?: string;
  pinSalt?: string;
  pinHash?: string;
  loginAt?: number;
  isActive: boolean;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type DayOfWeek = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';

export type ScheduleStatus = 'TERJADWAL' | 'BERJALAN' | 'SELESAI' | 'DIGANTIKAN' | 'DIBATALKAN';

export interface ScheduleItem {
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

export interface AttendanceRecord {
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

export interface DutyBookItem {
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

export interface SchoolSettings {
  id?: string;
  schoolName: string;
  npsn: string;
  address: string;
  appName?: string;
  appSubtitle?: string;
  appCreator?: string;
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
