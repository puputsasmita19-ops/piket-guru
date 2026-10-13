import { BaseEntityMetadata } from './index';

export type TardyReason =
  | 'BANGUN_KESIANGAN'
  | 'MACET_LALULINTAS'
  | 'KENDARAAN_MOGOK'
  | 'HUJAN_LEBAT'
  | 'MEMBANTU_ORANG_TUA'
  | 'LAINNYA';

export type DisciplineAction =
  | 'PEMBERSIHAN_LINGKUNGAN'
  | 'LITERASI_PERPUSTAKAAN'
  | 'LITERASI_ROHANI_IBADAH'
  | 'IKRAR_KEDISIPLINAN'
  | 'PEMBINAAN_GURU_BK'
  | 'SURAT_PERINGATAN_ORTU'
  | 'LAINNYA';

export type TardyStatus = 'DALAM_PEMBINAAN' | 'SELESAI_MASUK_KELAS' | 'PEMANGGILAN_ORTU';

export interface TardyRuleSnapshot {
  entryLimit: string; // e.g. "07:00" WIB
  toleranceMinutes: number; // e.g. 5 menit
}

export interface TardyAdminCorrection {
  correctedAt: string; // ISO Date String
  correctedByAdminId: string;
  correctedByAdminName: string;
  reason: string;
  previousJamDatang?: string;
  newJamDatang?: string;
  previousMenitTerlambat: number;
  newMenitTerlambat: number;
  previousPoinPelanggaran?: number;
  newPoinPelanggaran?: number;
}

export interface StudentTardyRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamDatang: string; // HH:mm WIB
  menitTerlambat: number; // Durasi keterlambatan dalam menit (koreksi atau hasil hitung)
  menitTerlambatAsli?: number; // Hasil perhitungan otomatis asli sebelum koreksi admin
  studentId?: string; // ID unik siswa dari master data (student.id)
  namaSiswa: string;
  nisn: string;
  kelas: string; // e.g. "X MIPA 1"
  alasan: TardyReason;
  keteranganAlasan?: string;
  pembinaan: DisciplineAction;
  keteranganPembinaan?: string;
  poinPelanggaran: number; // e.g. 5, 10, 15
  frekuensiBulanIni: number; // Berapa kali sudah terlambat bulan ini
  fotoUrl?: string; // Dokumentasi kamera saat tiba di gerbang (data URL / string base64)
  noHpOrangTua: string;
  status: TardyStatus;
  catatanPetugas?: string;
  petugasPiketName: string;
  petugasPiketId: string;
  ruleSnapshot?: TardyRuleSnapshot; // Snapshot aturan sekolah saat pencatatan
  isCorrectedByAdmin?: boolean; // Flag penanda apakah catatan ini telah dikoreksi admin
  adminCorrection?: TardyAdminCorrection; // Rincian audit koreksi admin
  batchRequestId?: string; // ID unik batch input multi siswa untuk idempotensi & retry
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export const TARDY_REASON_LABELS: Record<TardyReason, string> = {
  BANGUN_KESIANGAN: 'Bangun Kesiangan',
  MACET_LALULINTAS: 'Macet Lalu Lintas',
  KENDARAAN_MOGOK: 'Kendaraan Mogok / Rusak',
  HUJAN_LEBAT: 'Cuaca Buruk / Hujan Lebat',
  MEMBANTU_ORANG_TUA: 'Membantu Urusan Orang Tua',
  LAINNYA: 'Lain-lain',
};

export const DISCIPLINE_ACTION_LABELS: Record<DisciplineAction, string> = {
  LITERASI_PERPUSTAKAAN: 'Literasi Membaca Buku di Perpustakaan',
  PEMBERSIHAN_LINGKUNGAN: 'Kerja Bakti / Kebersihan Lingkungan Sekolah',
  LITERASI_ROHANI_IBADAH: 'Tadarus / Doa & Pembinaan Rohani',
  IKRAR_KEDISIPLINAN: 'Pengucapan Ikrar Kedisiplinan & Hormat Bendera',
  PEMBINAAN_GURU_BK: 'Konseling Khusus Guru Bimbingan Konseling',
  SURAT_PERINGATAN_ORTU: 'Penerbitan Surat Panggilan Orang Tua',
  LAINNYA: 'Lain-lain',
};

/**
 * Formats structured tardy reason. Returns "Lain-lain — [keterangan]" if LAINNYA.
 */
export function getTardyReasonDisplay(
  tardy: Partial<StudentTardyRecord> | { alasan?: TardyReason | string; keteranganAlasan?: string } | null | undefined
): string {
  if (!tardy) return '';
  const reason = (tardy.alasan || 'LAINNYA') as TardyReason;
  const isLainnya = reason === 'LAINNYA';
  if (isLainnya && tardy.keteranganAlasan && tardy.keteranganAlasan.trim().length > 0) {
    return `Lain-lain — ${tardy.keteranganAlasan.trim()}`;
  }
  return TARDY_REASON_LABELS[reason] || reason.replace(/_/g, ' ');
}

/**
 * Formats structured discipline action. Returns "Lain-lain — [keterangan]" if LAINNYA.
 */
export function getDisciplineActionDisplay(
  tardy: Partial<StudentTardyRecord> | { pembinaan?: DisciplineAction | string; keteranganPembinaan?: string } | null | undefined
): string {
  if (!tardy) return '';
  const action = (tardy.pembinaan || 'LITERASI_PERPUSTAKAAN') as DisciplineAction;
  const isLainnya = action === 'LAINNYA';
  if (isLainnya && tardy.keteranganPembinaan && tardy.keteranganPembinaan.trim().length > 0) {
    return `Lain-lain — ${tardy.keteranganPembinaan.trim()}`;
  }
  return DISCIPLINE_ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

export interface TardyCalculationResult {
  minutesLate: number | null;
  isLate: boolean;
  displayText: string;
  entryLimitUsed: string;
  toleranceUsed: number;
}

/**
 * Calculates student tardiness minutes and status consistently according to school rules.
 * - Minimum output 0 minutes.
 * - If arrival time is empty, returns null with displayText "Isi jam tiba untuk menghitung".
 * - Checks arrival time against entry limit (WIB) and tolerance minutes.
 */
export function calculateStudentTardiness(
  jamDatang: string | undefined | null,
  entryLimit: string = '07:00',
  toleranceMinutes: number = 0
): TardyCalculationResult {
  const cleanLimit = (entryLimit || '07:00').trim();
  const tolerance = Math.max(0, Math.floor(Number(toleranceMinutes) || 0));

  if (!jamDatang || !jamDatang.trim() || !jamDatang.includes(':')) {
    return {
      minutesLate: null,
      isLate: false,
      displayText: 'Isi jam tiba untuk menghitung',
      entryLimitUsed: cleanLimit,
      toleranceUsed: tolerance,
    };
  }

  const [arrivalHStr, arrivalMStr] = jamDatang.trim().split(':');
  const arrivalH = parseInt(arrivalHStr, 10);
  const arrivalM = parseInt(arrivalMStr, 10);

  if (isNaN(arrivalH) || isNaN(arrivalM)) {
    return {
      minutesLate: null,
      isLate: false,
      displayText: 'Isi jam tiba untuk menghitung',
      entryLimitUsed: cleanLimit,
      toleranceUsed: tolerance,
    };
  }

  const [limitHStr, limitMStr] = cleanLimit.split(':');
  const limitH = parseInt(limitHStr, 10) || 7;
  const limitM = parseInt(limitMStr, 10) || 0;

  const arrivalTotalMinutes = arrivalH * 60 + arrivalM;
  const limitTotalMinutes = limitH * 60 + limitM;

  const diff = arrivalTotalMinutes - limitTotalMinutes;

  if (diff <= 0) {
    return {
      minutesLate: 0,
      isLate: false,
      displayText: '0 Menit (Tepat Waktu)',
      entryLimitUsed: cleanLimit,
      toleranceUsed: tolerance,
    };
  }

  if (diff <= tolerance) {
    return {
      minutesLate: 0,
      isLate: false,
      displayText: `0 Menit (Dalam Toleransi ${tolerance} Mnt)`,
      entryLimitUsed: cleanLimit,
      toleranceUsed: tolerance,
    };
  }

  // Arrival exceeded both limit and tolerance
  const actualMinutesLate = diff;
  return {
    minutesLate: actualMinutesLate,
    isLate: true,
    displayText: `${actualMinutesLate} Menit Terlambat`,
    entryLimitUsed: cleanLimit,
    toleranceUsed: tolerance,
  };
}

/**
 * Standard violation points scale based on minutes late
 */
export function calculateTardyViolationPoints(minutesLate: number): number {
  if (minutesLate <= 0) return 0;
  if (minutesLate <= 15) return 5;
  if (minutesLate <= 30) return 10;
  return 15;
}
