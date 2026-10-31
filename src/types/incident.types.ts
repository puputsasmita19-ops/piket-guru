import { BaseEntityMetadata } from './index';
import type { PhotoWatermarkReview } from './watermark.types';

export type IncidentSeverity = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
export type IncidentStatus = 'BARU' | 'INVESTIGASI' | 'PENANGANAN' | 'SELESAI';
export interface IncidentStudentSnapshot { studentId: string; nama: string; kelas: string }

export interface IncidentPhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
  watermarkReview?: PhotoWatermarkReview;
}

export interface IncidentRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string;   // HH:mm WIB
  kategori: string; // SISWA, FASILITAS, KEAMANAN, KEBERSIHAN, KESEHATAN, LAINNYA, dll
  kategoriName: string;
  kategoriLainnya?: string;
  tingkatKeparahan: IncidentSeverity;
  lokasi: string;
  pihakTerlibat: string;
  involvedStudents?: IncidentStudentSnapshot[];
  pihakLainnya?: string;
  uraian: string;
  tindakanAwal: string;
  tindakLanjut?: string;
  penanggungJawab: string;
  pelaporId?: string;
  pelaporName?: string;
  status: IncidentStatus;
  photos?: IncidentPhoto[];
  fotoWatermarkReview?: PhotoWatermarkReview;
  
  // Resolution metadata
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** Exact queued submission already committed to Firestore. */
  offlineSubmissionKey?: string | null;
}

/**
 * Helper to display structured incident category name.
 * Formats "Lain-lain — [keterangan]" if category is LAINNYA with specific keterangan.
 */
export function getIncidentCategoryDisplay(
  incident: Partial<IncidentRecord> | { kategori?: string; kategoriName?: string; kategoriLainnya?: string } | null | undefined
): string {
  if (!incident) return '';
  const isLainnya = incident.kategori === 'LAINNYA' || incident.kategoriName?.toLowerCase().includes('lain-lain');
  if (isLainnya && incident.kategoriLainnya && incident.kategoriLainnya.trim().length > 0) {
    return `Lain-lain — ${incident.kategoriLainnya.trim()}`;
  }
  return incident.kategoriName || incident.kategori || 'Kejadian Umum';
}
