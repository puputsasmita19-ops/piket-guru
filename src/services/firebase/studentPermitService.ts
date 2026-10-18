import { FirestoreService } from './firestoreService';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { UserProfile } from '../../types';
import { formatTime } from '../../utils/dateUtils';

export class StudentPermitService {
  /**
   * Automatic demo student permit seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official student permits
    return;
  }

  /**
   * Explicit demo student permits seeder for development/testing environments
   */
  public static async seedDemoPermits(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<StudentPermitRecord>('studentPermits');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seed: StudentPermitRecord[] = [
        {
          id: `pmt-${todayISO}-01`,
          tanggal: todayISO,
          jamKeluar: '09:45',
          namaSiswa: 'Muhammad Rizky Pratama',
          nisn: '0067829102',
          kelas: 'XI MIPA 2',
          jenisIzin: 'SAKIT_PULANG',
          alasan: 'Demam tinggi dan pusing saat jam pelajaran Fisika (telah diobservasi di UKS)',
          penjemput: 'ORANG_TUA',
          namaPenjemput: 'Bapak Suryanto (Ayah Kandung)',
          noHpOrangTua: '081234567899',
          guruPengajarName: 'Budi Santoso, M.Kom.',
          petugasPiketName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasPiketId: 'usr-admin-01',
          status: 'SELESAI_PULANG',
          catatanPetugas: 'Siswa telah dijemput orang tua di pos piket gerbang depan.',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
        {
          id: `pmt-${todayISO}-02`,
          tanggal: todayISO,
          jamKeluar: '10:30',
          namaSiswa: 'Anisa Rahmawati',
          nisn: '0071293841',
          kelas: 'X IPS 1',
          jenisIzin: 'DISPENSASI_LOMBA',
          alasan: 'Mewakili sekolah dalam Technical Meeting Olimpiade Sains Tingkat Kota',
          penjemput: 'GURU_PEMBINA',
          namaPenjemput: 'Drs. H. Ahmad Fauzi, M.Pd.',
          noHpOrangTua: '081398765411',
          guruPengajarName: 'Siti Nurhaliza, S.Pd.',
          petugasPiketName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasPiketId: 'usr-admin-01',
          status: 'SEDANG_KELUAR',
          catatanPetugas: 'Dispensasi resmi surat tugas No. 421/108/SMA/2026',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
      ];

      for (const item of seed) {
        await FirestoreService.setDocument('studentPermits', item.id, item);
      }
    }
  }

  /**
   * Create a new student permit / gate pass
   */
  public static async createPermit(
    data: Omit<StudentPermitRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & { id?: string },
    user: UserProfile
  ): Promise<StudentPermitRecord> {
    const id = data.id || `pmt-${data.tanggal}-${crypto.randomUUID()}`;
    // Idempotency check: jika dokumen telah tercatat di server (misal kegagalan respons jaringan), kembalikan tanpa duplikasi audit log
    const existingDoc = await FirestoreService.getByIdStrict<StudentPermitRecord>('studentPermits', id);
    if (existingDoc) {
      return existingDoc;
    }

    const now = new Date().toISOString();

    const cleanData = { ...data };
    if (cleanData.jenisIzin !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    }

    const payload: StudentPermitRecord = {
      ...cleanData,
      id,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: now,
      createdBy: user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('studentPermits', id, payload, { expectedState: null });
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'CREATE',
      module: 'PERMITS',
      recordId: id,
      details: `Menerbitkan surat izin keluar gerbang untuk siswa: ${payload.namaSiswa} (${payload.kelas}) - Alasan: ${payload.jenisIzin}`,
    });

    return payload;
  }

  /**
   * Update an existing student permit record (Edit)
   * Preserves existing ID, createdAt, createdBy, dataSource, isDemo.
   */
  public static async updatePermit(
    data: Partial<StudentPermitRecord> & { id: string },
    user: UserProfile
  ): Promise<StudentPermitRecord> {
    const existing = await FirestoreService.getByIdStrict<StudentPermitRecord>('studentPermits', data.id);
    if (!existing) {
      throw new Error(`Data surat izin siswa dengan ID ${data.id} tidak ditemukan.`);
    }

    if (data.updatedAt && existing.updatedAt && existing.updatedAt !== data.updatedAt) {
      throw new Error(`Konflik pembaruan: Surat izin telah diperbarui di server oleh ${existing.updatedBy || 'pengguna lain'}. Buka data terbaru untuk meninjau.`);
    }

    const now = FirestoreService.nextUpdatedAt(existing);
    const cleanData = { ...data };

    // If jenisIzin is not LAINNYA, delete keteranganLainnya
    if (cleanData.jenisIzin && cleanData.jenisIzin !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    } else if (!cleanData.jenisIzin && existing.jenisIzin !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    }

    const updated: StudentPermitRecord = {
      ...existing,
      ...cleanData,
      id: existing.id,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      dataSource: existing.dataSource,
      isDemo: existing.isDemo,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    // If jenisIzin changed from LAINNYA to another, remove field if controlledReplace
    if (updated.jenisIzin !== 'LAINNYA') {
      delete updated.keteranganLainnya;
    }

    await FirestoreService.setDocument('studentPermits', existing.id, updated, { controlledReplace: true, expectedState: existing });
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'UPDATE',
      module: 'PERMITS',
      recordId: existing.id,
      details: `Memperbarui data izin keluar siswa: ${updated.namaSiswa} (${updated.kelas}) - ${updated.jenisIzin}`,
    });

    return updated;
  }

  /**
   * Check for currently active outside permits for a list of student IDs on a given date.
   * Only permits with status === 'SEDANG_KELUAR' are considered active conflicts.
   * Students with finished permits (SUDAH_KEMBALI or SELESAI_PULANG) are allowed.
   */
  public static async getActivePermitsForStudents(
    studentIds: string[],
    tanggal: string
  ): Promise<Record<string, StudentPermitRecord>> {
    if (!studentIds || studentIds.length === 0) return {};

    const allPermits = await FirestoreService.getForDates<StudentPermitRecord>('studentPermits', [tanggal]);
    const result: Record<string, StudentPermitRecord> = {};

    for (const p of allPermits) {
      if (p.tanggal === tanggal && p.status === 'SEDANG_KELUAR' && p.studentId && studentIds.includes(p.studentId)) {
        result[p.studentId] = p;
      }
    }

    return result;
  }

  /**
   * Create multiple student permits linked by a common groupId.
   * Handles per-student isolation, validation against active permits, and partial failure reporting.
   */
  public static async createBatchPermits(
    payload: import('../../types/studentPermit.types').BatchStudentPermitPayload,
    user: UserProfile
  ): Promise<import('../../types/studentPermit.types').BatchPermitResult> {
    const {
      groupId,
      tanggal,
      jamKeluarUmum,
      targetReturnTimeUmum,
      jenisIzinUmum,
      keteranganLainnyaUmum,
      alasanUmum,
      penjemputUmum,
      namaPenjemputUmum,
      guruPengajarName,
      catatanPetugas,
      students,
    } = payload;

    const studentIds = students.map((s) => s.studentId).filter(Boolean);
    const activeConflicts = await this.getActivePermitsForStudents(studentIds, tanggal);

    const now = new Date().toISOString();
    const resultItems: import('../../types/studentPermit.types').BatchPermitResultItem[] = [];

    // Tentukan status awal berdasarkan jenis izin
    const initialStatus: import('../../types/studentPermit.types').StudentPermitStatus =
      jenisIzinUmum === 'KELUAR_SEBENTAR' || jenisIzinUmum === 'DISPENSASI_LOMBA'
        ? 'SEDANG_KELUAR'
        : 'SELESAI_PULANG';

    for (const std of students) {
      const permitId = std.requestId || `pmt-${tanggal}-${groupId}-${std.studentId.replace(/[^a-zA-Z0-9]/g, '')}`;

      // Check conflict: Siswa masih berstatus SEDANG_KELUAR
      const activeConflict = activeConflicts[std.studentId];
      if (activeConflict && activeConflict.id !== permitId) {
        resultItems.push({
          studentId: std.studentId,
          namaSiswa: std.namaSiswa,
          kelas: std.kelas,
          success: false,
          error: `Siswa masih memiliki izin aktif (${activeConflict.jamKeluar} WIB) dengan status belum kembali.`,
        });
        continue;
      }

      try {
        // Idempotency: Jika dokumen dengan ID ini sudah tercatat di Firestore, kembalikan tanpa duplikasi
        const existingDoc = await FirestoreService.getByIdStrict<StudentPermitRecord>('studentPermits', permitId);
        if (existingDoc) {
          resultItems.push({
            studentId: std.studentId,
            namaSiswa: std.namaSiswa,
            kelas: std.kelas,
            success: true,
            permitId,
          });
          continue;
        }

        // Resolusi nilai individual vs umum
        const jamKeluar = std.isCustomized && std.jamKeluar ? std.jamKeluar : jamKeluarUmum;
        const targetReturn = std.isCustomized && std.targetReturnTime ? std.targetReturnTime : targetReturnTimeUmum;
        const alasan = std.isCustomized && std.alasan ? std.alasan : alasanUmum;
        const penjemput = std.isCustomized && std.penjemput ? std.penjemput : penjemputUmum;
        const rawNamaPenjemput = std.isCustomized && std.namaPenjemput !== undefined ? std.namaPenjemput : namaPenjemputUmum;
        const resolvedNamaPenjemput =
          rawNamaPenjemput?.trim() ||
          (penjemput === 'SENDIRI'
            ? 'Pulang Mandiri'
            : penjemput === 'GURU_PEMBINA'
            ? 'Guru Pembina'
            : 'Orang Tua / Wali');

        // Nomor kontak tidak boleh disalin dari siswa lain; gunakan data siswa sendiri
        const noHpOrangTua = (std.noHpKhusus || std.noHpOrangTua || '').trim();

        const record: StudentPermitRecord = {
          id: permitId,
          groupId,
          isGroupSubmission: students.length > 1,
          studentId: std.studentId,
          tanggal,
          jamKeluar,
          targetReturnTime: targetReturn || undefined,
          namaSiswa: std.namaSiswa,
          nisn: std.nisn?.trim() || '-',
          kelas: std.kelas,
          jenisIzin: jenisIzinUmum,
          keteranganLainnya: jenisIzinUmum === 'LAINNYA' ? keteranganLainnyaUmum : undefined,
          alasan,
          penjemput,
          namaPenjemput: resolvedNamaPenjemput,
          noHpOrangTua,
          guruPengajarName: guruPengajarName?.trim() || undefined,
          petugasPiketName: user.fullName || 'Petugas Piket',
          petugasPiketId: user.id || 'usr-piket',
          status: initialStatus,
          catatanPetugas: catatanPetugas?.trim() || undefined,
          dataSource: 'PRODUCTION',
          isDemo: false,
          createdAt: now,
          createdBy: user.fullName,
          updatedAt: now,
          updatedBy: user.fullName,
        };

        await FirestoreService.setDocument('studentPermits', permitId, record, { expectedState: null });
        await FirestoreService.logAudit({
          userId: user.id,
          userName: user.fullName,
          role: user.role,
          action: 'CREATE',
          module: 'PERMITS',
          recordId: permitId,
          details: `Penerbitan surat izin (Grup ${groupId}): ${record.namaSiswa} (${record.kelas}) - ${record.jenisIzin}`,
        });

        resultItems.push({
          studentId: std.studentId,
          namaSiswa: std.namaSiswa,
          kelas: std.kelas,
          success: true,
          permitId,
        });
      } catch (err: any) {
        console.warn(`[StudentPermitService] Error creating permit for ${std.namaSiswa}:`, err);
        resultItems.push({
          studentId: std.studentId,
          namaSiswa: std.namaSiswa,
          kelas: std.kelas,
          success: false,
          error: err.message || 'Gagal menyimpan ke basis data.',
        });
      }
    }

    const successCount = resultItems.filter((i) => i.success).length;
    const failureCount = resultItems.length - successCount;

    return {
      groupId,
      total: students.length,
      successCount,
      failureCount,
      items: resultItems,
    };
  }

  /**
   * Mark student as returned to school (check-in back)
   */
  public static async markReturned(
    permitId: string,
    user: UserProfile,
    customReturnTime?: string
  ): Promise<void> {
    const existing = await FirestoreService.getByIdStrict<StudentPermitRecord>('studentPermits', permitId);
    if (!existing) return;

    const returnTime = customReturnTime || formatTime(new Date());

    // Validasi urutan waktu: jam kembali tidak boleh sebelum jam keluar
    if (existing.jamKeluar && returnTime < existing.jamKeluar) {
      throw new Error(
        `Jam kembali (${returnTime} WIB) tidak boleh lebih awal dari jam keluar (${existing.jamKeluar} WIB).`
      );
    }

    const updated: StudentPermitRecord = {
      ...existing,
      jamKembali: returnTime,
      status: 'SUDAH_KEMBALI',
      updatedAt: FirestoreService.nextUpdatedAt(existing),
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('studentPermits', permitId, updated, { expectedState: existing });
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'PERMITS',
      recordId: permitId,
      details: `Siswa ${existing.namaSiswa} (${existing.kelas}) telah kembali masuk sekolah pukul ${returnTime} WIB`,
    });
  }

  /**
   * Mark multiple selected students as returned in bulk.
   * Petugas selects specific students, specifies the return time in WIB, and updates each independently.
   */
  public static async markMultipleReturned(
    permitIds: string[],
    returnTime: string,
    user: UserProfile
  ): Promise<{ successCount: number; errors: string[] }> {
    let successCount = 0;
    const errors: string[] = [];

    for (const id of permitIds) {
      try {
        await this.markReturned(id, user, returnTime);
        successCount++;
      } catch (err: any) {
        errors.push(`ID ${id}: ${err.message || 'Gagal memperbarui'}`);
      }
    }

    return { successCount, errors };
  }

  /**
   * Delete student permit record
   */
  public static async deletePermit(permitId: string, user: UserProfile): Promise<void> {
    await FirestoreService.deleteDocument('studentPermits', permitId);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'DELETE',
      module: 'PERMITS',
      recordId: permitId,
      details: `Menghapus surat izin siswa ID: ${permitId}`,
    });
  }
}
