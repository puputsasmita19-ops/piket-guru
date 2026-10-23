import { createAuthenticatedSession } from './sessionGuard';
import { FirestoreService } from './firestoreService';
import { assertRecordOwner } from '../../utils/recordOwnership';
import { StudentTardyRecord, TardyStatus } from '../../types/studentTardy.types';
import { UserProfile } from '../../types';
import { processPhotoForStorage } from '../drive/photoUploadHelper';
import { where } from 'firebase/firestore';
import { getTodayISODate } from '../../utils/dateUtils';

export class StudentTardyService {
  public static getBatchRecordId(tanggal: string, studentId: string, batchRequestId: string): string {
    return `trd-${tanggal}-${encodeURIComponent(studentId)}-${encodeURIComponent(batchRequestId)}`;
  }
  /**
   * Automatic demo student tardiness seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official student tardiness
    return;
  }

  /**
   * Explicit demo student tardiness seeder for development/testing environments
   */
  public static async seedDemoTardiness(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<StudentTardyRecord>('studentTardiness');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seed: StudentTardyRecord[] = [
        {
          id: `trd-${todayISO}-01`,
          tanggal: todayISO,
          jamDatang: '07:25',
          menitTerlambat: 25,
          namaSiswa: 'Dimas Aditya',
          nisn: '0065412398',
          kelas: 'XI MIPA 3',
          alasan: 'MACET_LALULINTAS',
          keteranganAlasan: 'Terjebak macet perbaikan jalan di simpang jembatan raya',
          pembinaan: 'LITERASI_PERPUSTAKAAN',
          poinPelanggaran: 5,
          frekuensiBulanIni: 1,
          noHpOrangTua: '081298765432',
          status: 'SELESAI_MASUK_KELAS',
          catatanPetugas: 'Telah menyelesaikan literasi dan diberikan slip izin masuk kelas jam ke-2.',
          petugasPiketName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasPiketId: 'usr-admin-01',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
        {
          id: `trd-${todayISO}-02`,
          tanggal: todayISO,
          jamDatang: '07:40',
          menitTerlambat: 40,
          namaSiswa: 'Rendi Pangestu',
          nisn: '0078912344',
          kelas: 'X IPS 2',
          alasan: 'BANGUN_KESIANGAN',
          keteranganAlasan: 'Tidur larut malam menyelesaikan tugas dan alarm tidak bunyi',
          pembinaan: 'PEMBERSIHAN_LINGKUNGAN',
          poinPelanggaran: 10,
          frekuensiBulanIni: 3,
          noHpOrangTua: '081387654321',
          status: 'DALAM_PEMBINAAN',
          catatanPetugas: 'Terlambat ke-3 kali bulan ini, surat panggilan orang tua disiapkan oleh BK.',
          petugasPiketName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasPiketId: 'usr-admin-01',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
      ];

      for (const item of seed) {
        await FirestoreService.setDocument('studentTardiness', item.id, item);
      }
    }
  }

  /**
   * Calculate student tardy frequency for current month
   * - Does NOT count 0 minutes as tardy incidents.
   * - Uses studentId as primary identity when available.
   */
  public static async getStudentTardyCountThisMonth(
    studentIdOrName: string,
    kelas?: string,
    targetDate?: string,
    excludeRecordId?: string
  ): Promise<number> {
    const dateStr = targetDate || getTodayISODate();
    const currentYearMonth = dateStr.substring(0, 7); // YYYY-MM
    const [year, month] = currentYearMonth.split('-').map(Number);
    const nextMonth = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
    const records = await FirestoreService.getAll<StudentTardyRecord>('studentTardiness', [
      where('tanggal', '>=', `${currentYearMonth}-01`), where('tanggal', '<', nextMonth),
    ]);

    const matching = records.filter((r) => {
      if (excludeRecordId && r.id === excludeRecordId) {
        return false;
      }
      if (!r.tanggal.startsWith(currentYearMonth)) {
        return false;
      }
      // Rule: Do NOT count 0-minute records as tardiness incidents
      if (typeof r.menitTerlambat === 'number' && r.menitTerlambat <= 0) {
        return false;
      }
      if (r.studentId && studentIdOrName && r.studentId === studentIdOrName) {
        return true;
      }
      if (!r.studentId && studentIdOrName &&
        r.namaSiswa.trim().toLowerCase() === studentIdOrName.trim().toLowerCase() &&
        (!kelas || !r.kelas || r.kelas.trim().toLowerCase() === kelas.trim().toLowerCase())
      ) {
        return true;
      }
      return false;
    });

    return matching.length;
  }

  /**
   * Save (create or update) a tardy student record atomically.
   * Uploads attached photo to Google Drive when Drive storage is active.
   */
  public static async saveTardyStudent(
    data: Partial<StudentTardyRecord>,
    user: UserProfile,
    isEdit: boolean = false
  ): Promise<StudentTardyRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      const id = data.id && !data.id.startsWith('temp-')
        ? data.id
        : `trd-${data.tanggal || new Date().toISOString().split('T')[0]}-${crypto.randomUUID()}`;

      // Idempotency check: jika id sudah tercatat di server (misal retry respons terputus), kembalikan tanpa duplikasi
      session.assertActive();
      const existingDoc = await FirestoreService.getByIdStrict<StudentTardyRecord>('studentTardiness', id);
      const isNew = !existingDoc;
      if (existingDoc) assertRecordOwner(user, existingDoc as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!isEdit && existingDoc && data.batchRequestId && existingDoc.batchRequestId === data.batchRequestId) {
        return existingDoc;
      }
      if (existingDoc && data.updatedAt && existingDoc.updatedAt && existingDoc.updatedAt !== data.updatedAt) {
        throw new Error(`Konflik pembaruan: Catatan keterlambatan telah diperbarui di server oleh ${existingDoc.updatedBy || 'pengguna lain'}. Buka data terbaru untuk meninjau.`);
      }

      const now = FirestoreService.nextUpdatedAt(existingDoc);

      // Process photo upload to Google Drive if Drive storage is enabled
      let finalFotoUrl: string | undefined = data.fotoUrl || undefined;
      if (finalFotoUrl?.startsWith('data:image/')) {
          try {
            // Same record/photo retries reuse the upload; a replacement photo gets
            // a different identity instead of incorrectly reusing the old image.
            session.assertActive();
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}\0${finalFotoUrl}`));
            const photoHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
            const clientPhotoId = `tardy-${photoHash}`;
            session.assertActive();
            const processed = await processPhotoForStorage(
              finalFotoUrl,
              'studentTardiness',
              clientPhotoId,
              id
            );
            if (processed.photoUrl) {
              finalFotoUrl = processed.photoUrl;
            }
          } catch (err: any) {
            if (err?.code === 'SESSION_CHANGED') throw err;
            console.error('[STUDENT_TARDY_SERVICE] Google Drive photo upload failed:', err);
            throw new Error(`Gagal menyimpan foto siswa terlambat ke Google Drive: ${err?.message || 'Kesalahan koneksi'}`);
          }
      }

      const rawPayload: StudentTardyRecord = {
        id,
        tanggal: data.tanggal || now.split('T')[0],
        jamDatang: data.jamDatang || '07:15',
        menitTerlambat: typeof data.menitTerlambat === 'number' ? data.menitTerlambat : 15,
        menitTerlambatAsli: typeof data.menitTerlambatAsli === 'number'
          ? data.menitTerlambatAsli
          : (existingDoc?.menitTerlambatAsli ?? (typeof data.menitTerlambat === 'number' ? data.menitTerlambat : 15)),
        studentId: data.studentId || undefined,
        namaSiswa: (data.namaSiswa || '').trim(),
        nisn: (data.nisn || '-').trim(),
        kelas: (data.kelas || '').trim(),
        alasan: data.alasan || 'BANGUN_KESIANGAN',
        keteranganAlasan: data.alasan === 'LAINNYA' && data.keteranganAlasan ? data.keteranganAlasan.trim() : undefined,
        pembinaan: data.pembinaan || 'LITERASI_PERPUSTAKAAN',
        keteranganPembinaan: data.pembinaan === 'LAINNYA' && data.keteranganPembinaan ? data.keteranganPembinaan.trim() : undefined,
        poinPelanggaran: typeof data.poinPelanggaran === 'number' ? data.poinPelanggaran : 5,
        frekuensiBulanIni: typeof data.frekuensiBulanIni === 'number' ? data.frekuensiBulanIni : 1,
        fotoUrl: finalFotoUrl,
        noHpOrangTua: (data.noHpOrangTua || '').trim(),
        status: data.status || 'DALAM_PEMBINAAN',
        catatanPetugas: data.catatanPetugas ? data.catatanPetugas.trim() : undefined,
        petugasPiketName: existingDoc?.petugasPiketName || user.fullName,
        petugasPiketId: existingDoc?.petugasPiketId || user.id,
        ruleSnapshot: data.ruleSnapshot || existingDoc?.ruleSnapshot,
        isCorrectedByAdmin: data.isCorrectedByAdmin ?? existingDoc?.isCorrectedByAdmin ?? false,
        adminCorrection: data.adminCorrection || existingDoc?.adminCorrection,
        batchRequestId: data.batchRequestId || existingDoc?.batchRequestId,
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: existingDoc?.createdAt || data.createdAt || now,
        createdBy: existingDoc?.createdBy || data.createdBy || user.fullName,
        updatedAt: now,
        updatedBy: user.fullName,
      };

      const payload = FirestoreService.sanitizeFirestorePayload(rawPayload);

      session.assertActive();
      await FirestoreService.setDocument('studentTardiness', id, payload, { expectedState: existingDoc });
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: isNew ? 'CREATE' : 'UPDATE',
        module: 'TARDINESS',
        recordId: id,
        details: `${isNew ? 'Mencatat' : 'Memperbarui'} siswa terlambat: ${payload.namaSiswa} (${payload.kelas}) - Terlambat ${payload.menitTerlambat} menit (${payload.pembinaan})`,
      });

      return payload;
    } finally {
      session.close();
    }
  }

  /**
   * Save multiple tardy students in a single batch with idempotent retry support.
   * - Saves one individual record per student.
   * - Prevents duplicate events on the same date for the same studentId.
   * - Returns per-student status (success / failure) and supports selective retry.
   */
  public static async saveBatchTardyStudents(
    studentsData: Array<Partial<StudentTardyRecord> & { studentId: string; namaSiswa: string; kelas: string }>,
    user: UserProfile,
    batchRequestId: string
  ): Promise<{
    results: Array<{
      studentId: string;
      namaSiswa: string;
      kelas: string;
      success: boolean;
      record?: StudentTardyRecord;
      error?: string;
    }>;
    allSuccessful: boolean;
  }> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existingRecords = await FirestoreService.getForDates<StudentTardyRecord>(
        'studentTardiness', studentsData.map(item => item.tanggal || getTodayISODate())
      );
      const results: Array<{
        studentId: string;
        namaSiswa: string;
        kelas: string;
        success: boolean;
        record?: StudentTardyRecord;
        error?: string;
      }> = [];

      for (const item of studentsData) {
        try {
          const itemTanggal = item.tanggal || getTodayISODate();

          // Check for duplicate on the same date
          const duplicate = existingRecords.find(
            (r) =>
              r.tanggal === itemTanggal &&
              r.studentId === item.studentId
          );

          // If duplicate has the exact same batchRequestId, treat as already saved (idempotent retry)
          if (duplicate && duplicate.batchRequestId === batchRequestId) {
            results.push({
              studentId: item.studentId,
              namaSiswa: item.namaSiswa,
              kelas: item.kelas,
              success: true,
              record: duplicate,
            });
            continue;
          }

          // If duplicate exists under another entry ID on the same date, reject duplicate
          if (duplicate && (!item.id || duplicate.id !== item.id)) {
            results.push({
              studentId: item.studentId,
              namaSiswa: item.namaSiswa,
              kelas: item.kelas,
              success: false,
              error: `Siswa ini sudah memiliki catatan pada tanggal ${itemTanggal} (ID: ${duplicate.id}).`,
            });
            continue;
          }

          // Generate deterministic document ID based on batchRequestId + studentId for safe retry
          const deterministicId = item.id || this.getBatchRecordId(itemTanggal, item.studentId, batchRequestId);

          session.assertActive();
          const savedRecord = await this.saveTardyStudent(
            {
              ...item,
              id: deterministicId,
              batchRequestId,
            },
            user,
            false
          );

          results.push({
            studentId: item.studentId,
            namaSiswa: item.namaSiswa,
            kelas: item.kelas,
            success: true,
            record: savedRecord,
          });
        } catch (err: any) {
          results.push({
            studentId: item.studentId,
            namaSiswa: item.namaSiswa,
            kelas: item.kelas,
            success: false,
            error: err?.message || 'Gagal menyimpan catatan siswa ini.',
          });
        }
      }

      const allSuccessful = results.every((r) => r.success);
      return { results, allSuccessful };
    } finally {
      session.close();
    }
  }

  /**
   * Admin-only correction of tardiness record.
   * - Strict ADMIN RBAC verification.
   * - Mandatory reason.
   * - Preserves original calculated minutes (menitTerlambatAsli).
   * - Stores correction metadata and logs detailed audit entry.
   */
  public static async correctTardyRecord(params: {
    tardyId: string;
    adminUser: UserProfile;
    newJamDatang?: string;
    manualMinutesLate?: number;
    reason: string;
    ruleSnapshot?: { entryLimit: string; toleranceMinutes: number };
  }): Promise<StudentTardyRecord> {
    const session = createAuthenticatedSession(params.adminUser.id);
    try {
      const { tardyId, adminUser, newJamDatang, manualMinutesLate, reason, ruleSnapshot } = params;

      // RBAC validation: Only ADMIN can correct tardiness records
      if (adminUser.role !== 'ADMIN') {
        throw new Error('Akses ditolak: Hanya peran ADMINISTRATOR yang berwenang melakukan koreksi keterlambatan.');
      }

      if (!reason || !reason.trim()) {
        throw new Error('Koreksi keterlambatan oleh admin wajib disertai alasan yang jelas.');
      }

      if (manualMinutesLate !== undefined) {
        if (!Number.isInteger(manualMinutesLate) || manualMinutesLate < 0) {
          throw new Error('Koreksi menit keterlambatan hanya menerima bilangan bulat tidak negatif (>= 0).');
        }
      }

      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<StudentTardyRecord>('studentTardiness', tardyId);
      if (!existing) {
        throw new Error(`Catatan siswa terlambat dengan ID ${tardyId} tidak ditemukan.`);
      }

      const previousJam = existing.jamDatang;
      const previousMinutes = existing.menitTerlambat;
      const previousPoints = existing.poinPelanggaran;
      const originalMinutes = existing.menitTerlambatAsli ?? existing.menitTerlambat;

      const finalJamDatang = newJamDatang && newJamDatang.trim() ? newJamDatang.trim() : existing.jamDatang;
      let finalMinutesLate = previousMinutes;

      if (manualMinutesLate !== undefined) {
        finalMinutesLate = manualMinutesLate;
      } else if (newJamDatang && newJamDatang !== previousJam) {
        // Recalculate based on rule snapshot or current school settings
        const limit = existing.ruleSnapshot?.entryLimit || ruleSnapshot?.entryLimit || '07:00';
        const tolerance = existing.ruleSnapshot?.toleranceMinutes ?? ruleSnapshot?.toleranceMinutes ?? 0;
        const [arrH, arrM] = finalJamDatang.split(':').map(Number);
        const [limH, limM] = limit.split(':').map(Number);
        const diff = (arrH * 60 + arrM) - (limH * 60 + limM);
        finalMinutesLate = diff <= tolerance ? 0 : Math.max(0, diff);
      }

      // Points recalculation
      let finalPoints = 0;
      if (finalMinutesLate > 0) {
        if (finalMinutesLate <= 15) finalPoints = 5;
        else if (finalMinutesLate <= 30) finalPoints = 10;
        else finalPoints = 15;
      }

      const correctionDetails = {
        correctedAt: new Date().toISOString(),
        correctedByAdminId: adminUser.id,
        correctedByAdminName: adminUser.fullName,
        reason: reason.trim(),
        previousJamDatang: previousJam,
        newJamDatang: finalJamDatang,
        previousMenitTerlambat: previousMinutes,
        newMenitTerlambat: finalMinutesLate,
        previousPoinPelanggaran: previousPoints,
        newPoinPelanggaran: finalPoints,
      };

      const updatedRecord: StudentTardyRecord = {
        ...existing,
        jamDatang: finalJamDatang,
        menitTerlambat: finalMinutesLate,
        menitTerlambatAsli: originalMinutes,
        poinPelanggaran: finalPoints,
        isCorrectedByAdmin: true,
        adminCorrection: correctionDetails,
        ruleSnapshot: existing.ruleSnapshot || ruleSnapshot,
        updatedAt: FirestoreService.nextUpdatedAt(existing),
        updatedBy: adminUser.fullName,
      };

      session.assertActive();
      await FirestoreService.setDocument('studentTardiness', tardyId, updatedRecord, { expectedState: existing });

      await FirestoreService.logAudit({
        userId: adminUser.id,
        userName: adminUser.fullName,
        role: adminUser.role,
        action: 'UPDATE',
        module: 'TARDINESS',
        recordId: tardyId,
        details: `Koreksi Keterlambatan oleh Admin: ${existing.namaSiswa} (${existing.kelas}). Sebelum: [Jam ${previousJam}, ${previousMinutes} mnt], Sesudah: [Jam ${finalJamDatang}, ${finalMinutesLate} mnt]. Alasan: "${reason.trim()}"`,
      });

      return updatedRecord;
    } finally {
      session.close();
    }
  }


  /**
   * Register a new tardy student (backward-compatible wrapper)
   */
  public static async registerTardyStudent(
    data: Omit<StudentTardyRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    user: UserProfile
  ): Promise<StudentTardyRecord> {
    return this.saveTardyStudent(data, user, false);
  }

  /**
   * Complete discipline action & admit student to class
   */
  public static async admitToClass(
    tardyId: string,
    user: UserProfile
  ): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<StudentTardyRecord>('studentTardiness', tardyId);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!existing) return;

      const updated: StudentTardyRecord = {
        ...existing,
        status: 'SELESAI_MASUK_KELAS',
        updatedAt: FirestoreService.nextUpdatedAt(existing),
        updatedBy: user.fullName,
      };

      session.assertActive();
      await FirestoreService.setDocument('studentTardiness', tardyId, updated, { expectedState: existing });
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'STATUS_CHANGE',
        module: 'TARDINESS',
        recordId: tardyId,
        details: `Siswa terlambat ${existing.namaSiswa} (${existing.kelas}) selesai pembinaan & diizinkan masuk kelas`,
      });
    } finally {
      session.close();
    }
  }

  /**
   * Delete tardy record
   */
  public static async deleteTardyRecord(tardyId: string, user: UserProfile): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      await FirestoreService.deleteDocument('studentTardiness', tardyId);
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'DELETE',
        module: 'TARDINESS',
        recordId: tardyId,
        details: `Menghapus catatan siswa terlambat ID: ${tardyId}`,
      });
    } finally {
      session.close();
    }
  }
}
