import { FirestoreService } from './firestoreService';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { DutyBookStatus, UserProfile } from '../../types';
import { PERMISSIONS, checkUserPermission } from '../../config/permissions';

export class DutyBookService {
  /**
   * Validates all mandatory sections required when submitting a journal.
   * Drafts bypass this validation, allowing partial saves.
   */
  public static validateMandatorySections(record: Partial<DutyBookRecord>): void {
    const missing: string[] = [];
    if (!record.petugasName?.trim()) missing.push('Nama Petugas');
    if (!record.ruangName?.trim()) missing.push('Pos / Ruang Piket');
    if (!record.kondisiKeamanan?.trim()) missing.push('Kondisi Keamanan & Ketertiban');
    if (!record.kondisiKebersihan?.trim()) missing.push('Kondisi Kebersihan & Lingkungan');
    if (!record.kondisiKelas?.trim()) missing.push('Kondisi KBM & Kehadiran Kelas');
    if (!record.kondisiFasilitas?.trim()) missing.push('Kondisi Sarana & Prasarana');
    if (!record.kondisiSiswa?.trim()) missing.push('Kedisiplinan & Perilaku Siswa');
    if (!record.catatanPiket?.trim()) missing.push('Catatan Kesimpulan Piket');

    if (missing.length > 0) {
      throw new Error(
        `Bagian wajib jurnal belum lengkap (${missing.join(', ')}). Harap lengkapi seluruh 5 kondisi dan kesimpulan sebelum mengirim.`
      );
    }
  }

  /**
   * Deterministic ID generator to prevent double submission
   */
  public static getDeterministicId(record: Partial<DutyBookRecord>, fallbackUserId: string): string {
    if (record.id && !record.id.startsWith('temp-')) {
      return record.id;
    }
    const tanggal = record.tanggal || new Date().toISOString().split('T')[0];
    const petugasId = record.petugasId || fallbackUserId;
    return `book-${tanggal}-${petugasId}`;
  }

  /**
   * Checks whether the user has write permissions for duty books.
   * View-only permissions (DUTYBOOK_VIEW) strictly do not grant write access.
   */
  public static checkWriteAuthority(user: UserProfile, isNew: boolean): void {
    if (user.role === 'ADMIN') return;
    const requiredPermission = isNew ? PERMISSIONS.DUTYBOOK_CREATE : PERMISSIONS.DUTYBOOK_UPDATE;
    const hasWrite = checkUserPermission(user.permissions, requiredPermission) ||
      checkUserPermission(user.permissions, PERMISSIONS.DUTYBOOK_CREATE) ||
      user.permissions?.includes('input_duty_book');
    if (!hasWrite) {
      throw new Error('Akses ditolak: Anda hanya memiliki izin melihat dan tidak dapat menyimpan atau mengirim buku piket.');
    }
  }

  /**
   * Save or update duty book as DRAFT (Guru or Admin)
   * Drafts may be incomplete; mandatory validation is skipped.
   */
  public static async saveDraft(
    record: DutyBookRecord,
    user: UserProfile,
    originalUpdatedAt?: string
  ): Promise<DutyBookRecord> {
    const isNew = !record.id || record.id.startsWith('temp-');
    const id = this.getDeterministicId(record, user.id);

    this.checkWriteAuthority(user, isNew);

    const now = new Date().toISOString();
    const existing = await FirestoreService.getById<DutyBookRecord>('dutyBooks', id);

    if (existing) {
      if (user.role === 'GURU' && existing.petugasId !== user.id) {
        throw new Error('Akses ditolak: Anda hanya dapat mengubah buku piket yang menjadi tanggung jawab Anda.');
      }
      if (existing.status === 'DIKUNCI' || existing.status === 'DISETUJUI') {
        throw new Error('Akses ditolak: Buku piket telah disahkan & selesai (terkunci), tidak dapat diubah.');
      }
      if (user.role === 'GURU' && (existing.status === 'DIAJUKAN' || existing.status === 'DIVERIFIKASI')) {
        throw new Error('Akses ditolak: Buku piket telah terkirim dan sedang menunggu pengesahan.');
      }
      if (originalUpdatedAt && existing.updatedAt && existing.updatedAt !== originalUpdatedAt) {
        throw new Error(
          `Konflik revisi: Jurnal telah diperbarui dari sesi/tab lain oleh ${existing.updatedBy || 'pengguna lain'}. Muat ulang data terbaru sebelum menyimpan.`
        );
      }
    }

    const payload: DutyBookRecord = {
      ...record,
      id,
      petugasId: record.petugasId || user.id,
      petugasName: record.petugasName || user.fullName,
      status: 'DRAFT',
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: existing?.createdAt || record.createdAt || now,
      createdBy: existing?.createdBy || record.createdBy || user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocumentWithAudit('dutyBooks', id, payload, {
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: isNew ? 'CREATE' : 'UPDATE',
      module: 'DUTY_BOOK',
      recordId: id,
      details: `${isNew ? 'Membuat draft baru' : 'Menyimpan draft'} buku piket tanggal ${payload.tanggal}`,
      metadata: {
        tanggal: payload.tanggal,
        stage: 'DRAFT',
        status: 'DRAFT',
        petugasId: payload.petugasId,
        petugasName: payload.petugasName,
        isNew,
      },
    });

    return payload;
  }

  /**
   * Submit journal directly (Stage 2: Terkirim / DIAJUKAN).
   * Guru presses "Kirim Jurnal" once without requiring a prior Draft save.
   * Validates mandatory sections and commits atomically with audit log.
   */
  public static async submitJournal(
    record: DutyBookRecord,
    user: UserProfile,
    originalUpdatedAt?: string
  ): Promise<DutyBookRecord> {
    const isNew = !record.id || record.id.startsWith('temp-');
    const id = this.getDeterministicId(record, user.id);

    this.checkWriteAuthority(user, isNew);
    this.validateMandatorySections(record);

    const now = new Date().toISOString();
    const existing = await FirestoreService.getById<DutyBookRecord>('dutyBooks', id);

    if (existing) {
      if (user.role === 'GURU' && existing.petugasId !== user.id) {
        throw new Error('Akses ditolak: Anda hanya dapat mengirim buku piket milik Anda sendiri.');
      }
      if (existing.status === 'DIKUNCI' || existing.status === 'DISETUJUI') {
        throw new Error('Akses ditolak: Buku piket telah disahkan & selesai (terkunci).');
      }
      if (user.role === 'GURU' && (existing.status === 'DIAJUKAN' || existing.status === 'DIVERIFIKASI')) {
        if (existing.petugasId === user.id) {
          // Idempotent retry: Jurnal sudah berhasil diterima oleh server sebelumnya
          return existing;
        }
        throw new Error('Akses ditolak: Buku piket ini sudah terkirim sebelumnya.');
      }
      if (originalUpdatedAt && existing.updatedAt && existing.updatedAt !== originalUpdatedAt) {
        throw new Error(
          `Konflik revisi: Jurnal telah diperbarui dari sesi/tab lain oleh ${existing.updatedBy || 'pengguna lain'}. Muat ulang data terbaru sebelum mengirim.`
        );
      }
    }

    const payload: DutyBookRecord = {
      ...record,
      id,
      petugasId: record.petugasId || user.id,
      petugasName: record.petugasName || user.fullName,
      status: 'DIAJUKAN',
      submittedAt: now,
      submittedBy: user.fullName,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: existing?.createdAt || record.createdAt || now,
      createdBy: existing?.createdBy || record.createdBy || user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocumentWithAudit('dutyBooks', id, payload, {
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: isNew ? 'CREATE' : 'STATUS_CHANGE',
      module: 'DUTY_BOOK',
      recordId: id,
      details: `Mengirim jurnal buku piket resmi tanggal ${payload.tanggal} (Status: Terkirim)`,
      metadata: {
        tanggal: payload.tanggal,
        stage: 'TERKIRIM',
        status: 'DIAJUKAN',
        petugasId: payload.petugasId,
        petugasName: payload.petugasName,
        submittedAt: now,
        isNew,
      },
    });

    return payload;
  }

  /**
   * One-step Sahkan & Selesaikan (Admin or Kepala Sekolah).
   * Advances status to DIKUNCI in a single click, recording both approval and lock metadata.
   */
  public static async approveAndComplete(
    dutyBook: DutyBookRecord,
    user: UserProfile
  ): Promise<DutyBookRecord> {
    const isAuthorized =
      user.role === 'ADMIN' ||
      user.role === 'KEPALA_SEKOLAH' ||
      checkUserPermission(user.permissions, PERMISSIONS.DUTYBOOK_UNLOCK) ||
      checkUserPermission(user.permissions, PERMISSIONS.DUTYBOOK_VERIFY);

    if (!isAuthorized) {
      throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk mengesahkan dan menyelesaikan buku piket.');
    }

    const existing = await FirestoreService.getById<DutyBookRecord>('dutyBooks', dutyBook.id);
    if (!existing) {
      throw new Error('Dokumen buku piket tidak ditemukan.');
    }
    if (existing.status === 'DIKUNCI') {
      throw new Error('Buku piket sudah berstatus Selesai dan terkunci.');
    }

    const now = new Date().toISOString();
    const updated: DutyBookRecord = {
      ...existing,
      status: 'DIKUNCI',
      lockedAt: now,
      lockedBy: user.fullName,
      approvedAt: now,
      approvedBy: user.fullName,
      verifiedAt: now,
      verifiedBy: user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocumentWithAudit('dutyBooks', dutyBook.id, updated, {
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'DUTY_BOOK',
      recordId: dutyBook.id,
      details: `Mengesahkan dan menyelesaikan buku piket tanggal ${dutyBook.tanggal} dalam satu tahap (Status: Selesai / Terkunci)`,
      metadata: {
        tanggal: dutyBook.tanggal,
        stage: 'SELESAI',
        status: 'DIKUNCI',
        petugasId: dutyBook.petugasId,
        petugasName: dutyBook.petugasName,
        approvedBy: user.fullName,
        lockedBy: user.fullName,
      },
    });

    return updated;
  }

  /**
   * Admin/Kepala Sekolah returns submitted journal to DRAFT with mandatory reason.
   */
  public static async requestRevision(
    dutyBook: DutyBookRecord,
    user: UserProfile,
    reason: string
  ): Promise<DutyBookRecord> {
    const isAuthorized =
      user.role === 'ADMIN' ||
      user.role === 'KEPALA_SEKOLAH' ||
      checkUserPermission(user.permissions, PERMISSIONS.DUTYBOOK_VERIFY);

    if (!isAuthorized) {
      throw new Error('Akses ditolak: Hanya Administrator atau Kepala Sekolah yang dapat meminta revisi buku piket.');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Alasan pengembalian jurnal ke draft wajib diisi.');
    }

    const existing = await FirestoreService.getById<DutyBookRecord>('dutyBooks', dutyBook.id);
    if (!existing) {
      throw new Error('Dokumen buku piket tidak ditemukan.');
    }
    if (existing.status === 'DIKUNCI' && user.role !== 'ADMIN') {
      throw new Error('Akses ditolak: Buku piket berstatus Selesai hanya dapat dibuka kunci oleh Administrator.');
    }

    const now = new Date().toISOString();
    const updated: DutyBookRecord = {
      ...existing,
      status: 'DRAFT',
      revisionReason: reason.trim(),
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocumentWithAudit('dutyBooks', dutyBook.id, updated, {
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'DUTY_BOOK',
      recordId: dutyBook.id,
      details: `Mengembalikan jurnal buku piket (${dutyBook.tanggal}) ke status Draft untuk revisi. Alasan: ${reason.trim()}`,
      metadata: {
        tanggal: dutyBook.tanggal,
        targetStatus: 'DRAFT',
        petugasId: dutyBook.petugasId,
        petugasName: dutyBook.petugasName,
        revisionReason: reason.trim(),
      },
    });

    return updated;
  }

  /**
   * Admin-only unlock of a completed (Selesai/DIKUNCI) duty book for correction, with mandatory reason.
   */
  public static async unlockDutyBook(
    dutyBook: DutyBookRecord,
    user: UserProfile,
    reason: string
  ): Promise<DutyBookRecord> {
    if (user.role !== 'ADMIN') {
      throw new Error('Akses ditolak: Hanya Administrator yang berwenang membuka kunci buku piket berstatus Selesai.');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Alasan pembukaan kunci untuk koreksi wajib diisi.');
    }

    const existing = await FirestoreService.getById<DutyBookRecord>('dutyBooks', dutyBook.id);
    if (!existing) {
      throw new Error('Dokumen buku piket tidak ditemukan.');
    }

    const now = new Date().toISOString();
    const { lockedAt, lockedBy, ...rest } = existing;
    const updated: DutyBookRecord = {
      ...rest,
      status: 'DRAFT',
      unlockReason: reason.trim(),
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocumentWithAudit('dutyBooks', dutyBook.id, updated, {
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'UPDATE',
      module: 'DUTY_BOOK',
      recordId: dutyBook.id,
      details: `Admin membuka kunci buku piket (${dutyBook.tanggal}) untuk koreksi. Alasan: ${reason.trim()}`,
      metadata: {
        tanggal: dutyBook.tanggal,
        targetStatus: 'DRAFT',
        petugasId: dutyBook.petugasId,
        petugasName: dutyBook.petugasName,
        unlockReason: reason.trim(),
      },
    });

    return updated;
  }

  // --- BACKWARD COMPATIBLE WRAPPERS ---

  public static async saveDutyBook(
    record: DutyBookRecord,
    user: UserProfile,
    options?: { isSubmit?: boolean; originalUpdatedAt?: string }
  ): Promise<void> {
    if (options?.isSubmit || record.status === 'DIAJUKAN') {
      await this.submitJournal(record, user, options?.originalUpdatedAt);
    } else {
      await this.saveDraft(record, user, options?.originalUpdatedAt);
    }
  }

  public static async updateWorkflowStatus(
    dutyBook: DutyBookRecord,
    newStatus: DutyBookStatus,
    user: UserProfile,
    note?: string
  ): Promise<void> {
    if (newStatus === 'DIKUNCI' || newStatus === 'DISETUJUI') {
      await this.approveAndComplete(dutyBook, user);
    } else if (newStatus === 'DIAJUKAN') {
      await this.submitJournal(dutyBook, user);
    } else if (newStatus === 'DRAFT') {
      await this.requestRevision(dutyBook, user, note || 'Revisi jurnal buku piket');
    } else {
      // Legacy transition DIVERIFIKASI
      await this.approveAndComplete(dutyBook, user);
    }
  }

  public static async bootstrapIfEmpty(): Promise<void> {
    return;
  }

  public static async seedDemoDutyBook(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<DutyBookRecord>('dutyBooks');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];
      const record: DutyBookRecord = {
        id: `book-${todayISO}-usr-admin-01`,
        scheduleId: 'sch-001',
        tanggal: todayISO,
        hari: 'SENIN',
        jamMulai: '06:30',
        jamSelesai: '15:30',
        petugasId: 'usr-admin-01',
        petugasName: 'Drs. H. Ahmad Fauzi, M.Pd.',
        petugasRole: 'GURU',
        ruangName: 'Pos Utama & Gerbang Depan',
        kondisiKeamanan: 'Situasi gerbang utama terpantau kondusif dan tertib.',
        kondisiKebersihan: 'Halaman depan, koridor lobby, dan area kantin bersih.',
        kondisiKelas: 'KBM jam 1 s.d 8 berjalan lancar.',
        kondisiFasilitas: 'Fasilitas listrik dan bel sekolah berfungsi normal.',
        kondisiSiswa: 'Kedisiplinan siswa terpantau baik.',
        kegiatanKhusus: 'Upacara Bendera Hari Senin pukul 07.00 WIB.',
        catatanPiket: 'Operasional dan ketertiban sekolah hari ini berjalan sesuai SOP.',
        tindakLanjut: 'Lanjutkan pengawasan seragam untuk hari esok.',
        status: 'DRAFT',
        dataSource: 'SEED',
        isDemo: true,
        createdAt: new Date().toISOString(),
        createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
      };
      await FirestoreService.setDocument('dutyBooks', record.id, record);
    }
  }
}

