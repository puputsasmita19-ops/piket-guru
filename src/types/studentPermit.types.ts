export type StudentPermitType =
  | 'SAKIT_PULANG'
  | 'URUSAN_KELUARGA'
  | 'DISPENSASI_LOMBA'
  | 'KELUAR_SEBENTAR'
  | 'LAINNYA';

export type StudentPermitStatus = 'SEDANG_KELUAR' | 'SUDAH_KEMBALI' | 'SELESAI_PULANG';

export interface StudentPermitRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamKeluar: string; // HH:mm WIB
  jamKembali?: string; // HH:mm WIB (if returning)
  namaSiswa: string;
  nisn: string;
  kelas: string; // e.g. "X MIPA 1", "XII IPS 2"
  jenisIzin: StudentPermitType;
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
