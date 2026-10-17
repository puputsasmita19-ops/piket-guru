import { AuditLogAction, AuditLogModule, AuditLogStatus } from '../../types/master.types';

export interface AuditModuleMeta {
  id: AuditLogModule;
  label: string;
  category: 'AUTENTIKASI' | 'OPERASIONAL' | 'MASTER' | 'SISTEM' | 'KEAMANAN';
  description: string;
}

export interface AuditActionMeta {
  id: AuditLogAction;
  label: string;
  description: string;
  colorVariant: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export interface AuditStatusMeta {
  id: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  aliases: AuditLogStatus[];
  label: string;
  colorVariant: 'success' | 'danger' | 'warning';
  badgeClass: string;
  description: string;
}

export const AUDIT_MODULE_REGISTRY: Record<AuditLogModule, AuditModuleMeta> = {
  USERS: {
    id: 'USERS',
    label: 'Master Pengguna & Akun',
    category: 'MASTER',
    description: 'Pendaftaran, pembaruan profil, hak akses 4 permission, aktivasi/deaktivasi akun, dan penghapusan pengguna.',
  },
  AUTH: {
    id: 'AUTH',
    label: 'Autentikasi & Sesi',
    category: 'AUTENTIKASI',
    description: 'Login PIN, Google Authentication, logout manual/timeout, dan pemutusan sesi.',
  },
  ATTENDANCE: {
    id: 'ATTENDANCE',
    label: 'Presensi Guru & Staf',
    category: 'OPERASIONAL',
    description: 'Presensi masuk geofence, presensi pulang, dan koreksi kehadiran oleh piket/admin.',
  },
  DUTY_BOOK: {
    id: 'DUTY_BOOK',
    label: 'Buku Piket & Jurnal',
    category: 'OPERASIONAL',
    description: 'Pencatatan jurnal piket harian, catatan kejadian lapangan, dan rekap piket.',
  },
  TARDINESS: {
    id: 'TARDINESS',
    label: 'Keterlambatan Siswa',
    category: 'OPERASIONAL',
    description: 'Pencatatan siswa terlambat, cetak surat pembinaan, dan tindak lanjut piket.',
  },
  PERMITS: {
    id: 'PERMITS',
    label: 'Izin Siswa & Gerbang',
    category: 'OPERASIONAL',
    description: 'Penerbitan surat izin keluar/kembali, verifikasi gerbang pos satpam, dan pembatalan.',
  },
  SUBSTITUTIONS: {
    id: 'SUBSTITUTIONS',
    label: 'Guru Inval / Pengganti',
    category: 'OPERASIONAL',
    description: 'Penugasan guru inval untuk kelas kosong, konfirmasi kehadiran, dan penyelesaian tugas.',
  },
  VISITORS: {
    id: 'VISITORS',
    label: 'Buku Tamu Digital',
    category: 'OPERASIONAL',
    description: 'Registrasi tamu masuk, pencarian pihak dituju, check-out keluar, dan penyelesaian kunjungan.',
  },
  INCIDENTS: {
    id: 'INCIDENTS',
    label: 'Insiden & Pelanggaran',
    category: 'OPERASIONAL',
    description: 'Pelaporan insiden sekolah, penanganan kasus, dan dokumentasi ketertiban.',
  },
  SCHEDULES: {
    id: 'SCHEDULES',
    label: 'Jadwal & Agenda',
    category: 'OPERASIONAL',
    description: 'Penyusunan jadwal piket guru mingguan, rotasi petugas, dan hari dinas.',
  },
  SETTINGS: {
    id: 'SETTINGS',
    label: 'Pengaturan Sekolah & Sistem',
    category: 'SISTEM',
    description: 'Konfigurasi GPS geofence, profil sekolah, jam pelajaran (JP), TV Lobi, tema warna.',
  },
  SYSTEM: {
    id: 'SYSTEM',
    label: 'Operasional Sistem & Backup',
    category: 'SISTEM',
    description: 'Pencadangan database (Backup), restore file, snapshot darurat, dan reset operasional.',
  },
  SECURITY: {
    id: 'SECURITY',
    label: 'Keamanan, Kredensial & Darurat',
    category: 'KEAMANAN',
    description: 'Reset PIN oleh admin, ganti PIN mandiri, penolakan akses, alarm/darurat panic alert.',
  },
  REPORTS: {
    id: 'REPORTS',
    label: 'Laporan & Rekapitulasi',
    category: 'OPERASIONAL',
    description: 'Penyusunan, pratinjau, dan ekspor laporan periodik presensi dan piket.',
  },
  ANNOUNCEMENTS: {
    id: 'ANNOUNCEMENTS',
    label: 'Pengumuman Piket',
    category: 'OPERASIONAL',
    description: 'Penerbitan pengumuman piket penting dan pengumuman prioritas.',
  },
  BELL: {
    id: 'BELL',
    label: 'Bel Sekolah Otomatis',
    category: 'SISTEM',
    description: 'Jadwal bel pergantian jam pelajaran dan pemutaran audio otomatis.',
  },
  TEACHERS: {
    id: 'TEACHERS',
    label: 'Master Guru',
    category: 'MASTER',
    description: 'Manajemen data guru, NIP/NUPTK, status mengajar aktif.',
  },
  STUDENTS: {
    id: 'STUDENTS', label: 'Master Siswa', category: 'MASTER',
    description: 'Penambahan, pembaruan, impor, dan penghapusan data master siswa.',
  },
  STAFF: {
    id: 'STAFF',
    label: 'Master Tenaga Kependidikan',
    category: 'MASTER',
    description: 'Manajemen data staf administrasi dan tata usaha sekolah.',
  },
  ROOMS: {
    id: 'ROOMS',
    label: 'Master Ruang & Kelas',
    category: 'MASTER',
    description: 'Manajemen inventaris ruang kelas, laboratorium, dan fasilitas sekolah.',
  },
  CATEGORIES: {
    id: 'CATEGORIES',
    label: 'Master Kategori',
    category: 'MASTER',
    description: 'Kategori insiden, jenis pelanggaran, dan tingkat keparahan.',
  },
};

export const AUDIT_ACTION_REGISTRY: Record<AuditLogAction, AuditActionMeta> = {
  LOGIN: {
    id: 'LOGIN',
    label: 'Masuk (Login)',
    description: 'Autentikasi sesi melalui PIN Kredensial atau Google Auth.',
    colorVariant: 'info',
  },
  LOGOUT: {
    id: 'LOGOUT',
    label: 'Keluar (Logout)',
    description: 'Pengakhiran sesi pengguna (manual atau timeout inaktivitas).',
    colorVariant: 'info',
  },
  CREATE: {
    id: 'CREATE',
    label: 'Tambah Data',
    description: 'Pembuatan data rekaman baru ke dalam sistem.',
    colorVariant: 'success',
  },
  UPDATE: {
    id: 'UPDATE',
    label: 'Ubah Data',
    description: 'Pembaruan isi rekaman atau pengaturan yang sudah ada.',
    colorVariant: 'warning',
  },
  DELETE: {
    id: 'DELETE',
    label: 'Hapus Data',
    description: 'Penghapusan permanen rekaman dari database.',
    colorVariant: 'danger',
  },
  STATUS_CHANGE: {
    id: 'STATUS_CHANGE',
    label: 'Perubahan Status',
    description: 'Persetujuan izin, penyelesaian tugas, aktivasi akun, check-out tamu.',
    colorVariant: 'warning',
  },
  ATTENDANCE: {
    id: 'ATTENDANCE',
    label: 'Presensi Masuk/Pulang',
    description: 'Perekaman kehadiran guru/staf dengan koordinat GPS terverifikasi.',
    colorVariant: 'success',
  },
  SECURITY: {
    id: 'SECURITY',
    label: 'Keamanan / Kredensial',
    description: 'Perubahan PIN, reset PIN admin, hak akses dibatasi atau ditolak.',
    colorVariant: 'danger',
  },
  EMERGENCY: {
    id: 'EMERGENCY',
    label: 'Aksi Darurat',
    description: 'Pemicuan sinyal darurat bencana/bahaya atau pembatalan status darurat.',
    colorVariant: 'danger',
  },
  IMPORT: {
    id: 'IMPORT',
    label: 'Impor Massal',
    description: 'Pemasukan data dalam jumlah banyak via Excel/CSV.',
    colorVariant: 'primary',
  },
  EXPORT: {
    id: 'EXPORT',
    label: 'Ekspor Data',
    description: 'Pengunduhan arsip data, rekap laporan, atau log audit.',
    colorVariant: 'primary',
  },
  BACKUP: {
    id: 'BACKUP',
    label: 'Pencadangan Sistem',
    description: 'Pembuatan file cadangan atau database snapshot.',
    colorVariant: 'primary',
  },
  RESTORE: {
    id: 'RESTORE',
    label: 'Pemulihan Sistem',
    description: 'Restorasi database dari berkas backup sebelumnya.',
    colorVariant: 'danger',
  },
  UPLOAD: {
    id: 'UPLOAD',
    label: 'Unggah Berkas',
    description: 'Pengunggahan foto bukti atau lampiran berkas dokumen.',
    colorVariant: 'info',
  },
};

export const AUDIT_STATUS_REGISTRY: Record<'SUCCESS' | 'FAILED' | 'BLOCKED', AuditStatusMeta> = {
  SUCCESS: {
    id: 'SUCCESS',
    aliases: ['SUCCESS', 'BERHASIL'],
    label: 'Berhasil',
    colorVariant: 'success',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    description: 'Operasi diproses dan selesai tanpa kendala.',
  },
  FAILED: {
    id: 'FAILED',
    aliases: ['FAILED', 'GAGAL'],
    label: 'Gagal',
    colorVariant: 'danger',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    description: 'Operasi gagal diproses (salah kredensial, format salah, gangguan jaringan).',
  },
  BLOCKED: {
    id: 'BLOCKED',
    aliases: ['BLOCKED', 'DITOLAK'],
    label: 'Ditolak / Dibatasi',
    colorVariant: 'warning',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    description: 'Operasi ditolak sistem (hak akses tidak cukup, akun terkunci, akun nonaktif).',
  },
};

/**
 * Normalizes any status representation into standard 'SUCCESS' | 'FAILED' | 'BLOCKED'
 */
export function normalizeAuditStatus(status?: string | null): 'SUCCESS' | 'FAILED' | 'BLOCKED' {
  if (!status) return 'SUCCESS';
  const s = String(status).toUpperCase();
  if (s === 'FAILED' || s === 'GAGAL') return 'FAILED';
  if (s === 'BLOCKED' || s === 'DITOLAK' || s === 'FORBIDDEN' || s === 'LOCKED') return 'BLOCKED';
  return 'SUCCESS';
}

/**
 * Returns human-readable label for module
 */
export function normalizeAuditModule(module: string): string {
  const key = String(module || '').toUpperCase();
  const aliases: Record<string, string> = { DUTYBOOKS: 'DUTY_BOOK', DUTYBOOK: 'DUTY_BOOK', STUDENTTARDINESS: 'TARDINESS', STUDENTPERMITS: 'PERMITS', INCIDENTCATEGORIES: 'CATEGORIES' };
  return aliases[key] || key;
}

export function getAuditModuleLabel(mod: string): string {
  const meta = AUDIT_MODULE_REGISTRY[normalizeAuditModule(mod) as AuditLogModule];
  return meta ? meta.label : mod;
}

/**
 * Returns human-readable label for action
 */
export function getAuditActionLabel(act: string): string {
  const meta = AUDIT_ACTION_REGISTRY[act as AuditLogAction];
  return meta ? meta.label : act;
}

/**
 * Returns localized status meta
 */
export function getAuditStatusMeta(status?: string | null): AuditStatusMeta {
  const normalized = normalizeAuditStatus(status);
  return AUDIT_STATUS_REGISTRY[normalized];
}
