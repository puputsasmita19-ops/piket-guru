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
  | 'SURAT_PERINGATAN_ORTU';

export type TardyStatus = 'DALAM_PEMBINAAN' | 'SELESAI_MASUK_KELAS' | 'PEMANGGILAN_ORTU';

export interface StudentTardyRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamDatang: string; // HH:mm WIB
  menitTerlambat: number; // Durasi keterlambatan dalam menit
  namaSiswa: string;
  nisn: string;
  kelas: string; // e.g. "X MIPA 1"
  alasan: TardyReason;
  keteranganAlasan?: string;
  pembinaan: DisciplineAction;
  poinPelanggaran: number; // e.g. 5, 10, 15
  frekuensiBulanIni: number; // Berapa kali sudah terlambat bulan ini
  fotoUrl?: string; // Dokumentasi kamera saat tiba di gerbang
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
