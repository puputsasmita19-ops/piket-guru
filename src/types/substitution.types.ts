import { BaseEntityMetadata } from './index';

export type AbsenceReason =
  | 'SAKIT'
  | 'DINAS_LUAR'
  | 'CUTI_TAHUNAN'
  | 'CUTI_MELAHIRKAN'
  | 'IZIN_MENDESAK'
  | 'TANPA_KETERANGAN';

export type SubstitutionStatus =
  | 'MENUNGGU_GURU_INVAL'
  | 'TERTUGASKAN'
  | 'SEDANG_BERLANGSUNG'
  | 'SELESAI_INVAL';

export interface TeacherSubstitutionRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  guruBerhalanganId: string;
  guruBerhalanganName: string;
  mataPelajaran: string;
  alasan: AbsenceReason;
  keteranganAlasan?: string;
  kelas: string; // e.g. "X MIPA 1"
  jamPelajaran: string; // e.g. "JP 1 - 3 (07.15 - 09.30)"
  guruPenggantiId?: string;
  guruPenggantiName?: string; // Guru inval yang ditugaskan
  materiDanTugasSiswa: string; // Tugas atau instruksi yang ditinggalkan
  status: SubstitutionStatus;
  catatanPiket?: string;
  petugasPiketName: string;
  petugasPiketId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
