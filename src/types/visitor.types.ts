import { BaseEntityMetadata } from './index';

export type VisitorStatus = 'SEDANG_BERKUNJUNG' | 'SELESAI' | 'DITOLAK';

export type VisitorCategory =
  | 'DINAS_INSTANSI'
  | 'ORANG_TUA'
  | 'VENDOR_MITRA'
  | 'ALUMNI'
  | 'UMUM'
  | 'LAINNYA';

export interface VisitorRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jamMasuk: string; // HH:mm WIB
  jamKeluar?: string; // HH:mm WIB
  namaTamu: string;
  instansiAsal: string;
  kategori: VisitorCategory;
  keteranganLainnya?: string; // Wajib diisi jika kategori === 'LAINNYA', maks 300 char
  noHp: string;
  nomorIdentitas: string; // KTP / SIM / NIP
  nomorBadge: string; // No. Badge Tamu (e.g. TAMU-01)
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

export const VISITOR_CATEGORIES: { code: VisitorCategory; label: string; icon: string }[] = [
  { code: 'DINAS_INSTANSI', label: 'Dinas / Instansi Pemerintah', icon: '🏢' },
  { code: 'ORANG_TUA', label: 'Orang Tua / Wali Siswa', icon: '👨‍👩‍👧' },
  { code: 'VENDOR_MITRA', label: 'Mitra / Vendor / Supplier', icon: '🚚' },
  { code: 'ALUMNI', label: 'Alumni Sekolah', icon: '🎓' },
  { code: 'UMUM', label: 'Tamu Umum', icon: '👤' },
  { code: 'LAINNYA', label: 'Lain-lain', icon: '📝' },
];

/**
 * Returns formatted display label for visitor category, including custom note for LAINNYA.
 */
export function getVisitorCategoryDisplay(
  visitorOrCategory?: Partial<VisitorRecord> | VisitorCategory | string | null,
  keterangan?: string
): string {
  if (!visitorOrCategory) return '-';
  let cat: VisitorCategory | string = 'UMUM';
  let ket = keterangan;

  if (typeof visitorOrCategory === 'string') {
    cat = visitorOrCategory;
  } else {
    cat = visitorOrCategory.kategori || 'UMUM';
    if (!ket && visitorOrCategory.keteranganLainnya) {
      ket = visitorOrCategory.keteranganLainnya;
    }
  }

  if (cat === 'LAINNYA') {
    return ket && ket.trim() ? `Lain-lain — ${ket.trim()}` : 'Lain-lain';
  }

  switch (cat) {
    case 'DINAS_INSTANSI':
      return 'Dinas / Instansi';
    case 'ORANG_TUA':
      return 'Orang Tua Siswa';
    case 'VENDOR_MITRA':
      return 'Mitra / Vendor';
    case 'ALUMNI':
      return 'Alumni';
    case 'UMUM':
      return 'Umum';
    default:
      return String(cat).replace(/_/g, ' ');
  }
}
