import { DutyBookStatus, BaseEntityMetadata } from './index';

export type SimplifiedDutyBookStage = 'DRAFT' | 'TERKIRIM' | 'SELESAI';

export interface DutyBookDisplayStatus {
  stage: SimplifiedDutyBookStage;
  label: 'Draft' | 'Terkirim' | 'Selesai';
  variant: 'primary' | 'warning' | 'success';
}

/**
 * Maps raw storage status to the streamlined 3-stage user display:
 * - DRAFT -> 'Draft'
 * - DIAJUKAN, DIVERIFIKASI -> 'Terkirim'
 * - DISETUJUI, DIKUNCI -> 'Selesai'
 */
export function getDutyBookDisplayStatus(status: DutyBookStatus | string): DutyBookDisplayStatus {
  switch (status) {
    case 'DRAFT':
      return { stage: 'DRAFT', label: 'Draft', variant: 'primary' };
    case 'DIAJUKAN':
    case 'DIVERIFIKASI':
      return { stage: 'TERKIRIM', label: 'Terkirim', variant: 'warning' };
    case 'DISETUJUI':
    case 'DIKUNCI':
      return { stage: 'SELESAI', label: 'Selesai', variant: 'success' };
    default:
      return { stage: 'DRAFT', label: 'Draft', variant: 'primary' };
  }
}

export interface DutyBookSection {
  kondisiKeamanan: string;
  kondisiKebersihan: string;
  kondisiKelas: string;
  kondisiFasilitas: string;
  kondisiSiswa: string;
  kegiatanKhusus?: string;
  catatanPiket: string;
  tindakLanjut?: string;
}

export interface DutyBookRecord extends DutyBookSection, BaseEntityMetadata {
  id: string;
  scheduleId: string;
  tanggal: string; // YYYY-MM-DD
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  
  // Petugas details
  petugasId: string;
  petugasName: string;
  petugasRole: string;
  ruangName: string;

  // Workflow status
  status: DutyBookStatus;

  // Revision & Unlock Reasons
  revisionReason?: string;
  unlockReason?: string;

  // Approval & Verification metadata
  submittedAt?: string;
  submittedBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  lockedAt?: string;
  lockedBy?: string;

  // Timestamps
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
