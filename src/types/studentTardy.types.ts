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

export interface StudentTardyRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamDatang: string; // HH:mm WIB
  menitTerlambat: number; // Durasi keterlambatan dalam menit
  studentId?: string; // ID unik siswa dari master data
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
