import { BaseEntityMetadata } from './index';

export type VisitorStatus = 'SEDANG_BERKUNJUNG' | 'SELESAI' | 'DITOLAK';

export type VisitorCategory = 'ORANG_TUA' | 'DINAS_INSTANSI' | 'VENDOR_MITRA' | 'ALUMNI' | 'UMUM';

export interface VisitorRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamMasuk: string; // HH:mm WIB
  jamKeluar?: string; // HH:mm WIB
  namaTamu: string;
  instansiAsal: string;
  kategori: VisitorCategory;
  noHp: string;
  nomorIdentitas: string; // KTP / SIM / NIP
  nomorBadge: string; // No. Badge Tamu (e.g. VISITOR-01)
  tujuanBertemu: string; // Nama Guru / Kepala Sekolah / Staf
  tujuanUserId?: string;
  keperluan: string; // Alasan kunjungan
  fotoUrl?: string; // Foto Tamu / Dokumen
  status: VisitorStatus;
  catatanPetugas?: string;
  petugasPiketName: string;
  petugasPiketId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
