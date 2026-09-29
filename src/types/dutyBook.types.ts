import { DutyBookStatus } from './index';

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

export interface DutyBookRecord extends DutyBookSection {
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
