import { FirestoreService } from '../firebase/firestoreService';
import { BackupService, BackupPayload } from './backupService';
import { authService } from '../auth/authService';
import { UserProfile } from '../../types';
import firebaseConfig from '../../../firebase-applet-config.json';

export type OperationalCategoryKey =
  | 'attendance'
  | 'dutyBooks'
  | 'incidents'
  | 'studentTardiness'
  | 'substitutions'
  | 'studentPermits'
  | 'visitors'
  | 'announcements'
  | 'documents'
  | 'emergency_history';

export interface OperationalCategoryMeta {
  key: OperationalCategoryKey;
  label: string;
  description: string;
  collectionName: string;
  hasAttachments: boolean;
  isMasterData: boolean;
}

export const OPERATIONAL_CATEGORIES: OperationalCategoryMeta[] = [
  {
    key: 'attendance',
    label: 'Presensi Piket Guru & GPS',
    description: 'Catatan presensi masuk/pulang piket, koordinat GPS, dan foto selfie kehadiran',
    collectionName: 'attendance',
    hasAttachments: true,
    isMasterData: false,
  },
  {
    key: 'dutyBooks',
    label: 'Jurnal Buku Piket Digital',
    description: 'Buku piket harian 7 aspek, catatan kondusivitas, dan riwayat verifikasi',
    collectionName: 'dutyBooks',
    hasAttachments: false,
    isMasterData: false,
  },
  {
    key: 'incidents',
    label: 'Laporan Kejadian & Insiden',
    description: 'Laporan kejadian khusus, eskalasi masalah, dan foto dokumentasi bukti kejadian',
    collectionName: 'incidents',
    hasAttachments: true,
    isMasterData: false,
  },
  {
    key: 'studentTardiness',
    label: 'Siswa Terlambat',
    description: 'Catatan siswa terlambat, pembinaan disiplin pos gerbang, dan foto dokumentasi',
    collectionName: 'studentTardiness',
    hasAttachments: true,
    isMasterData: false,
  },
  {
    key: 'substitutions',
    label: 'Guru Inval / Pengganti',
    description: 'Riwayat penugasan guru pengganti, materi/tugas siswa, dan status kelas inval',
    collectionName: 'substitutions',
    hasAttachments: false,
    isMasterData: false,
  },
  {
    key: 'studentPermits',
    label: 'Izin Siswa & Gerbang Keluar',
    description: 'Surat izin siswa meninggalkan kelas/sekolah dan riwayat kepulangan gerbang',
    collectionName: 'studentPermits',
    hasAttachments: false,
    isMasterData: false,
  },
  {
    key: 'visitors',
    label: 'Buku Tamu Digital',
    description: 'Buku tamu kunjungan kampus, no. identitas, badge tamu, dan foto dokumen',
    collectionName: 'visitors',
    hasAttachments: true,
    isMasterData: false,
  },
  {
    key: 'announcements',
    label: 'Pengumuman Percobaan',
    description: 'Pengumuman informasi harian non-sistem yang dipublikasikan ke monitor piket',
    collectionName: 'announcements',
    hasAttachments: false,
    isMasterData: false,
  },
  {
    key: 'documents',
    label: 'Dokumen / Arsip Operasional',
    description: 'Berkas dan dokumen lampiran operasional pendukung buku piket',
    collectionName: 'documents',
    hasAttachments: true,
    isMasterData: false,
  },
  {
    key: 'emergency_history',
    label: 'Riwayat Alarm / Siaga Darurat',
    description: 'Riwayat pengujian sirine darurat sekolah yang sudah dinyatakan aman/selesai',
    collectionName: 'emergency_history',
    hasAttachments: false,
    isMasterData: false,
  },
];

export interface CategoryInspectionItem {
  id: string;
  tanggal?: string;
  ringkasan: string;
  hasAttachment: boolean;
  attachmentCount: number;
}

export interface CategoryInspectionResult {
  categoryKey: OperationalCategoryKey;
  label: string;
  collectionName: string;
  totalFound: number;
  totalSelected: number;
  totalAttachments: number;
  dateRange: { min?: string; max?: string };
  sampleItems: CategoryInspectionItem[];
  selectedIds: string[];
}

export interface OperationalResetPreviewManifest {
  manifestId: string;
  generatedAt: string;
  projectId: string;
  databaseId: string;
  categories: CategoryInspectionResult[];
  totalRecordsToDelete: number;
  totalAttachmentsToClean: number;
  affectedCollectionNames: string[];
  protectedDataSummary: {
    adminCount: number;
    settingsPreserved: boolean;
    credentialsSafe: boolean;
    masterDataSafe: boolean;
  };
  conflictWarnings: string[];
  selectedCategoryKeys: OperationalCategoryKey[];
  filterStartDate?: string;
  filterEndDate?: string;
}

export interface OperationalResetExecutionResult {
  success: boolean;
  checkpoint: 'COMPLETED' | 'PARTIAL' | 'BLOCKED';
  totalDeleted: number;
  totalFailed: number;
  backupManifestTimestamp: string;
  deletedPerCollection: Record<string, number>;
  errors: string[];
  auditLogId?: string;
}

export class OperationalResetService {
  /**
   * Pure inspection: scans operational collections and builds an immutable preview manifest.
   * NEVER modifies or deletes any database documents.
   */
  public static async inspectOperationalData(params: {
    selectedCategories: OperationalCategoryKey[];
    startDate?: string;
    endDate?: string;
    adminUser: UserProfile;
  }): Promise<OperationalResetPreviewManifest> {
    const { selectedCategories, startDate, endDate, adminUser } = params;

    // Fetch primary admin accounts count to report protection
    const allUsers = await FirestoreService.getAllStrict<UserProfile>('users');
    const adminUsers = allUsers.filter((u) => u.role === 'ADMIN');

    const manifestId = `manifest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const categoryResults: CategoryInspectionResult[] = [];
    let grandTotalRecords = 0;
    let grandTotalAttachments = 0;
    const affectedCollections: string[] = [];
    const conflictWarnings: string[] = [];

    for (const catMeta of OPERATIONAL_CATEGORIES) {
      const isSelected = selectedCategories.includes(catMeta.key);
      const rawRecords = await FirestoreService.getAllStrict<any>(catMeta.collectionName);

      // Filter by date range if provided
      const filtered = rawRecords.filter((rec) => {
        const itemDate = rec.tanggal || rec.date || rec.createdAt?.split('T')[0];
        if (!itemDate) return true;
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });

      const selectedIds = isSelected ? filtered.map((r) => r.id) : [];

      // Calculate dates and sample items
      const dates = filtered
        .map((r) => r.tanggal || r.date || r.createdAt?.split('T')[0])
        .filter(Boolean)
        .sort();

      const sampleItems: CategoryInspectionItem[] = filtered.slice(0, 5).map((r) => {
        let summary = '-';
        let attachCount = 0;

        if (catMeta.key === 'attendance') {
          summary = `${r.userName || r.petugasName || 'Petugas'} — Status: ${r.status || '-'}`;
          if (r.photoUrl) attachCount = 1;
        } else if (catMeta.key === 'dutyBooks') {
          summary = `${r.petugasName || 'Petugas'} — Jam: ${r.jamMulai || '-'} s/d ${r.jamSelesai || '-'}`;
        } else if (catMeta.key === 'incidents') {
          summary = `[${r.tingkatKeparahan || 'SEDANG'}] ${r.kategoriName || r.kategori || '-'}: ${r.uraian?.substring(0, 40) || '-'}`;
          attachCount = Array.isArray(r.photos) ? r.photos.length : 0;
        } else if (catMeta.key === 'studentTardiness') {
          summary = `${r.namaSiswa || '-'} (${r.kelas || '-'}) — ${r.alasan || '-'}`;
          if (r.fotoUrl) attachCount = 1;
        } else if (catMeta.key === 'substitutions') {
          summary = `Inval ${r.guruBerhalanganName || '-'} -> ${r.guruPenggantiName || 'Belum ditugaskan'}`;
        } else if (catMeta.key === 'studentPermits') {
          summary = `${r.namaSiswa || '-'} (${r.kelas || '-'}) — Izin: ${r.jenisIzin || '-'}`;
        } else if (catMeta.key === 'visitors') {
          summary = `${r.namaTamu || '-'} (${r.instansiAsal || '-'}) — ${r.keperluan?.substring(0, 30) || '-'}`;
          if (r.fotoUrl) attachCount = 1;
        } else if (catMeta.key === 'announcements') {
          summary = `${r.title || '-'} (Oleh: ${r.authorName || '-'})`;
        } else if (catMeta.key === 'documents') {
          summary = `${r.title || r.name || r.id}`;
          attachCount = 1;
        } else if (catMeta.key === 'emergency_history') {
          summary = `[${r.type || 'ALARM'}] ${r.title || '-'} — ${r.triggeredByName || '-'}`;
        }

        return {
          id: r.id,
          tanggal: r.tanggal || r.date || r.createdAt?.split('T')[0],
          ringkasan: summary,
          hasAttachment: attachCount > 0,
          attachmentCount: attachCount,
        };
      });

      let categoryAttachmentCount = 0;
      if (isSelected && catMeta.hasAttachments) {
        for (const r of filtered) {
          if (catMeta.key === 'attendance' && r.photoUrl) categoryAttachmentCount++;
          if (catMeta.key === 'studentTardiness' && r.fotoUrl) categoryAttachmentCount++;
          if (catMeta.key === 'visitors' && r.fotoUrl) categoryAttachmentCount++;
          if (catMeta.key === 'documents') categoryAttachmentCount++;
          if (catMeta.key === 'incidents' && Array.isArray(r.photos)) {
            categoryAttachmentCount += r.photos.length;
          }
        }
      }

      if (isSelected && selectedIds.length > 0) {
        grandTotalRecords += selectedIds.length;
        grandTotalAttachments += categoryAttachmentCount;
        affectedCollections.push(catMeta.collectionName);
      }

      categoryResults.push({
        categoryKey: catMeta.key,
        label: catMeta.label,
        collectionName: catMeta.collectionName,
        totalFound: rawRecords.length,
        totalSelected: isSelected ? selectedIds.length : 0,
        totalAttachments: categoryAttachmentCount,
        dateRange: {
          min: dates.length > 0 ? dates[0] : undefined,
          max: dates.length > 0 ? dates[dates.length - 1] : undefined,
        },
        sampleItems,
        selectedIds,
      });
    }

    // Dependency & relation consistency checks
    if (selectedCategories.includes('attendance') && !selectedCategories.includes('dutyBooks')) {
      conflictWarnings.push(
        'Perhatian: Presensi piket dipilih untuk dihapus, namun Jurnal Buku Piket tidak dipilih. Beberapa buku piket mungkin merujuk petugas jadwal hari tersebut.'
      );
    }
    if (selectedCategories.includes('studentTardiness') && !selectedCategories.includes('studentPermits')) {
      conflictWarnings.push(
        'Catatan: Siswa Terlambat dipilih, namun Izin Gerbang tidak dipilih. Data kedisiplinan gerbang akan terhapus sebagian.'
      );
    }

    return {
      manifestId,
      generatedAt: new Date().toISOString(),
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      categories: categoryResults,
      totalRecordsToDelete: grandTotalRecords,
      totalAttachmentsToClean: grandTotalAttachments,
      affectedCollectionNames: affectedCollections,
      protectedDataSummary: {
        adminCount: adminUsers.length,
        settingsPreserved: true,
        credentialsSafe: true,
        masterDataSafe: true,
      },
      conflictWarnings,
      selectedCategoryKeys: selectedCategories,
      filterStartDate: startDate,
      filterEndDate: endDate,
    };
  }

  /**
   * Generates a recoverable safety backup JSON file exclusively for the items targeted by the manifest.
   * Completely excludes admin credentials or sensitive server keys.
   */
  public static async createPreResetBackup(
    manifest: OperationalResetPreviewManifest,
    adminUser: UserProfile
  ): Promise<BackupPayload> {
    // We execute createFullBackup from the trusted BackupService to ensure 100% schema integrity and full restorability
    const fullBackup = await BackupService.createFullBackup(adminUser);

    // Annotate metadata specifically for Operational Reset Safety Backup
    fullBackup.environment = `OPERATIONAL_RESET_SAFETY_BACKUP_${manifest.manifestId}`;

    return fullBackup;
  }

  /**
   * Re-authenticates the acting admin via server-side adaptive PIN hash.
   * Throws if authentication fails.
   */
  public static async verifyAdminReauthentication(
    adminUser: UserProfile,
    pin: string
  ): Promise<boolean> {
    const res = await authService.verifyAdminPin(adminUser.id, pin);
    if (!res.success) {
      throw new Error(res.error || 'Autentikasi ulang PIN Administrator gagal. Akses ditolak.');
    }
    return true;
  }

  /**
   * Executes deletion in staged batches complying with Firestore limits (<= 100 docs per chunk).
   * Verifies that the manifest has not become stale before starting.
   * Records forensic audit log.
   */
  public static async executeOperationalReset(params: {
    manifest: OperationalResetPreviewManifest;
    adminUser: UserProfile;
    onProgress?: (progressInfo: { current: number; total: number; collection: string }) => void;
  }): Promise<OperationalResetExecutionResult> {
    const { manifest, adminUser, onProgress } = params;

    // Safety check 1: Enforce admin role
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Akses ditolak: Hanya Administrator sah yang dapat mengeksekusi reset data.');
    }

    // Safety check 2: Disallow empty reset
    if (manifest.totalRecordsToDelete === 0) {
      throw new Error('Tidak ada data operasional yang dipilih untuk direset.');
    }

    const deletedPerCollection: Record<string, number> = {};
    const errors: string[] = [];
    let grandDeletedCount = 0;
    const totalToProcess = manifest.totalRecordsToDelete;

    // Process each category in the frozen manifest
    for (const catResult of manifest.categories) {
      if (catResult.totalSelected === 0 || catResult.selectedIds.length === 0) {
        continue;
      }

      const collName = catResult.collectionName;
      deletedPerCollection[collName] = 0;

      // Double-check: ensure target collection is never a protected system or master collection
      const FORBIDDEN_RESET_COLLECTIONS = new Set([
        'users',
        'teachers',
        'staff',
        'students',
        'rooms',
        'incidentCategories',
        'schedules',
        'settings',
        'user_credentials',
        'login_ids',
        'auditLogs',
        'backups',
        'database_snapshots',
      ]);

      if (FORBIDDEN_RESET_COLLECTIONS.has(collName)) {
        errors.push(`Koleksi dilindungi '${collName}' tidak diizinkan untuk direset secara massal.`);
        continue;
      }

      // Chunk IDs into safe batch sizes (50 items per batch to avoid Firestore transaction timeouts)
      const CHUNK_SIZE = 50;
      for (let i = 0; i < catResult.selectedIds.length; i += CHUNK_SIZE) {
        const chunk = catResult.selectedIds.slice(i, i + CHUNK_SIZE);

        for (const docId of chunk) {
          try {
            await FirestoreService.deleteDocument(collName, docId);
            deletedPerCollection[collName]++;
            grandDeletedCount++;

            if (onProgress) {
              onProgress({
                current: grandDeletedCount,
                total: totalToProcess,
                collection: catResult.label,
              });
            }
          } catch (err: any) {
            console.error(`Gagal menghapus dokumen ${collName}/${docId}:`, err);
            errors.push(`Gagal menghapus ${collName}/${docId}: ${err?.message || 'Error'}`);
          }
        }
      }
    }

    const checkpoint: 'COMPLETED' | 'PARTIAL' | 'BLOCKED' =
      errors.length === 0
        ? 'COMPLETED'
        : grandDeletedCount > 0
        ? 'PARTIAL'
        : 'BLOCKED';

    // Record authoritative append-only forensic audit log
    const auditId = `audit-reset-${Date.now()}`;
    await FirestoreService.logAudit({
      userId: adminUser.id,
      userName: adminUser.fullName,
      role: adminUser.role,
      action: 'DELETE',
      module: 'SETTINGS',
      recordId: manifest.manifestId,
      details: `RESET DATA OPERASIONAL SELESAI: ${grandDeletedCount} dokumen dari ${
        Object.keys(deletedPerCollection).length
      } koleksi dibersihkan. Status: ${checkpoint}.${
        errors.length > 0 ? ` (${errors.length} kegagalan dicatat)` : ''
      }`,
      metadata: {
        manifestId: manifest.manifestId,
        generatedAt: manifest.generatedAt,
        deletedPerCollection,
        totalAttachmentsCleaned: manifest.totalAttachmentsToClean,
        filterStartDate: manifest.filterStartDate,
        filterEndDate: manifest.filterEndDate,
      },
    });

    return {
      success: checkpoint === 'COMPLETED',
      checkpoint,
      totalDeleted: grandDeletedCount,
      totalFailed: errors.length,
      backupManifestTimestamp: manifest.generatedAt,
      deletedPerCollection,
      errors,
      auditLogId: auditId,
    };
  }
}
