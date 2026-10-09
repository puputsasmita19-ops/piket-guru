import { BaseEntityMetadata } from './index';

export type StudentPermitType =
  | 'SAKIT_PULANG'
  | 'URUSAN_KELUARGA'
  | 'DISPENSASI_LOMBA'
  | 'KELUAR_SEBENTAR'
  | 'LAINNYA';

export type StudentPermitStatus = 'SEDANG_KELUAR' | 'SUDAH_KEMBALI' | 'SELESAI_PULANG';

export interface StudentPermitRecord extends BaseEntityMetadata {
  id: string;
  studentId?: string; // ID siswa terhubung dari master students
  tanggal: string; // YYYY-MM-DD
  jamKeluar: string; // HH:mm WIB
  jamKembali?: string; // HH:mm WIB (if returning)
  namaSiswa: string;
  nisn: string;
  kelas: string; // e.g. "X MIPA 1", "XII IPS 2"
  jenisIzin: StudentPermitType;
  keteranganLainnya?: string; // Wajib diisi jika jenisIzin === 'LAINNYA', maks 300 char
  alasan: string;
  penjemput: 'ORANG_TUA' | 'SENDIRI' | 'GURU_PEMBINA' | 'WALI';
  namaPenjemput?: string;
  noHpOrangTua: string;
  guruPengajarName?: string; // Guru mapel jam berlangsung
  petugasPiketName: string;
  petugasPiketId: string;
  status: StudentPermitStatus;
  catatanPetugas?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export const STUDENT_PERMIT_TYPES: { code: StudentPermitType; label: string; icon: string }[] = [
  { code: 'SAKIT_PULANG', label: 'Sakit (Pulang / Rujukan UKS)', icon: '🩺' },
  { code: 'URUSAN_KELUARGA', label: 'Urusan Keluarga Mendesak', icon: '👨‍👩‍👧' },
  { code: 'DISPENSASI_LOMBA', label: 'Dispensasi Lomba / Tugas Sekolah', icon: '🏆' },
  { code: 'KELUAR_SEBENTAR', label: 'Izin Keluar Sebentar (Kembali Lagi)', icon: '⏳' },
  { code: 'LAINNYA', label: 'Lain-lain', icon: '📝' },
];

/**
 * Returns formatted display label for student permit type, including custom note for LAINNYA.
 */
export function getStudentPermitTypeDisplay(
  permitOrType?: Partial<StudentPermitRecord> | StudentPermitType | null,
  keterangan?: string
): string {
  if (!permitOrType) return '-';
  let type: StudentPermitType = 'SAKIT_PULANG';
  let ket = keterangan;

  if (typeof permitOrType === 'string') {
    type = permitOrType;
  } else {
    type = permitOrType.jenisIzin || 'SAKIT_PULANG';
    if (!ket && permitOrType.keteranganLainnya) {
      ket = permitOrType.keteranganLainnya;
    }
  }

  if (type === 'LAINNYA') {
    return ket && ket.trim() ? `Lain-lain — ${ket.trim()}` : 'Lain-lain';
  }

  switch (type) {
    case 'SAKIT_PULANG':
      return 'Sakit (Pulang / UKS)';
    case 'URUSAN_KELUARGA':
      return 'Urusan Keluarga';
    case 'DISPENSASI_LOMBA':
      return 'Dispensasi Lomba';
    case 'KELUAR_SEBENTAR':
      return 'Keluar Sebentar';
    default:
      return String(type).replace('_', ' ');
  }
}
