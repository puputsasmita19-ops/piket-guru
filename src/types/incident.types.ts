import { BaseEntityMetadata } from './index';

export type IncidentSeverity = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
export type IncidentStatus = 'BARU' | 'INVESTIGASI' | 'PENANGANAN' | 'SELESAI';

export interface IncidentPhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
}

export interface IncidentRecord extends BaseEntityMetadata {
  id: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string;   // HH:mm WIB
  kategori: string; // SISWA, FASILITAS, KEAMANAN, KEBERSIHAN, KESEHATAN, dll
  kategoriName: string;
  tingkatKeparahan: IncidentSeverity;
  lokasi: string;
  pihakTerlibat: string;
  uraian: string;
  tindakanAwal: string;
  tindakLanjut?: string;
  penanggungJawab: string;
  status: IncidentStatus;
  photos?: IncidentPhoto[];
  
  // Resolution metadata
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
