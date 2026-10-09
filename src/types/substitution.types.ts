import { BaseEntityMetadata } from './index';

export type AbsenceReason =
  | 'SAKIT'
  | 'DINAS_LUAR'
  | 'CUTI_TAHUNAN'
  | 'CUTI_MELAHIRKAN'
  | 'IZIN_MENDESAK'
  | 'TANPA_KETERANGAN'
  | 'LAINNYA';

export const ABSENCE_REASONS: { code: AbsenceReason; label: string; icon: string }[] = [
  { code: 'SAKIT', label: 'Sakit (Surat Dokter / Izin)', icon: '🩺' },
  { code: 'DINAS_LUAR', label: 'Tugas Kedinasan Luar / Pelatihan', icon: '🏛️' },
  { code: 'CUTI_TAHUNAN', label: 'Cuti Tahunan / Resmi', icon: '📅' },
  { code: 'CUTI_MELAHIRKAN', label: 'Cuti Melahirkan', icon: '👶' },
  { code: 'IZIN_MENDESAK', label: 'Izin Keperluan Mendesak', icon: '👨‍👩‍👧' },
  { code: 'TANPA_KETERANGAN', label: 'Tanpa Keterangan (Alpha)', icon: '⚠️' },
  { code: 'LAINNYA', label: 'Lain-lain', icon: '📝' },
];

export function getSubstitutionReasonDisplay(item: {
  alasan: AbsenceReason | string;
  keteranganAlasan?: string;
}): string {
  if (!item) return '-';
  if (item.alasan === 'LAINNYA') {
    return item.keteranganAlasan && item.keteranganAlasan.trim()
      ? `Lain-lain — ${item.keteranganAlasan.trim()}`
      : 'Lain-lain';
  }
  const found = ABSENCE_REASONS.find((r) => r.code === item.alasan);
  const baseLabel = found ? found.label.replace(/\s*\([^)]*\)/g, '') : item.alasan?.replace(/_/g, ' ') || '-';
  if (item.keteranganAlasan && item.keteranganAlasan.trim()) {
    return `${baseLabel} (${item.keteranganAlasan.trim()})`;
  }
  return baseLabel;
}

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
