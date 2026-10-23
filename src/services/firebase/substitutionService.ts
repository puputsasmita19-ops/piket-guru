import { createAuthenticatedSession } from './sessionGuard';
import { FirestoreService } from './firestoreService';
import { assertRecordOwner } from '../../utils/recordOwnership';
import { TeacherSubstitutionRecord, SubstitutionStatus } from '../../types/substitution.types';
import { UserProfile } from '../../types';

export class SubstitutionService {
  /**
   * Automatic demo substitution seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official substitutions
    return;
  }

  /**
   * Explicit demo substitutions seeder for development/testing environments
   */
  public static async seedDemoSubstitutions(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<TeacherSubstitutionRecord>('substitutions');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seed: TeacherSubstitutionRecord[] = [
        {
          id: `inv-${todayISO}-01`,
          tanggal: todayISO,
          guruBerhalanganId: 'tch-02',
          guruBerhalanganName: 'Budi Santoso, M.Kom.',
          mataPelajaran: 'Informatika & TIK',
          alasan: 'DINAS_LUAR',
          keteranganAlasan: 'Menghadiri Rapat Koordinasi Kurikulum Merdeka di Balai Guru Penggerak',
          kelas: 'XI MIPA 1',
          jamPelajaran: 'JP 3 - 4 (08.45 - 10.15)',
          guruPenggantiId: 'tch-01',
          guruPenggantiName: 'Siti Nurhaliza, S.Pd.',
          materiDanTugasSiswa: 'Mengerjakan Latihan Praktik Pemrograman Algoritma Python pada Modul Bab 3 Halaman 45-48 di Lab Komputer.',
          status: 'TERTUGASKAN',
          catatanPiket: 'Tugas telah dikoordinasikan dengan Ketua Kelas XI MIPA 1.',
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
        await FirestoreService.setDocument('substitutions', item.id, item);
      }
    }
  }

  /**
   * Record a new teacher absence & assign substitute
   */
  public static async createSubstitution(
    data: Omit<TeacherSubstitutionRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & { id?: string },
    user: UserProfile
  ): Promise<TeacherSubstitutionRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      const id = data.id || `inv-${data.tanggal}-${crypto.randomUUID()}`;
      // Idempotency check: jika id sudah tercatat di server (misal retry respons terputus), kembalikan tanpa duplikasi
      session.assertActive();
      const existingDoc = await FirestoreService.getByIdStrict<TeacherSubstitutionRecord>('substitutions', id);
      if (existingDoc) {
        return existingDoc;
      }

      const now = new Date().toISOString();

      const payload: TeacherSubstitutionRecord = {
        ...data,
        id,
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: now,
        createdBy: user.fullName,
        updatedAt: now,
        updatedBy: user.fullName,
      };

      session.assertActive();
      await FirestoreService.setDocument('substitutions', id, payload, { expectedState: null });
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'CREATE',
        module: 'SUBSTITUTIONS',
        recordId: id,
        details: `Mencatat guru berhalangan: ${payload.guruBerhalanganName} (${payload.kelas} - ${payload.mataPelajaran}), Inval: ${payload.guruPenggantiName || 'Belum Ditugaskan'}`,
      });

      return payload;
    } finally {
      session.close();
    }
  }

  /**
   * Update entire teacher substitution record (Edit modal)
   * Preserves existing ID, createdAt, createdBy.
   */
  public static async updateSubstitution(
    data: Partial<TeacherSubstitutionRecord> & { id: string },
    user: UserProfile
  ): Promise<TeacherSubstitutionRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<TeacherSubstitutionRecord>('substitutions', data.id);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!existing) {
        throw new Error(`Catatan penugasan inval ID ${data.id} tidak ditemukan.`);
      }

      if (data.updatedAt && existing.updatedAt && existing.updatedAt !== data.updatedAt) {
        throw new Error(`Konflik pembaruan: Catatan guru inval telah diperbarui di server oleh ${existing.updatedBy || 'pengguna lain'}. Buka data terbaru untuk meninjau.`);
      }

      const now = FirestoreService.nextUpdatedAt(existing);
      const updated: TeacherSubstitutionRecord = {
        ...existing,
        ...data,
        id: existing.id,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        petugasPiketId: existing.petugasPiketId,
        petugasPiketName: existing.petugasPiketName,
        updatedAt: now,
        updatedBy: user.fullName,
      };

      session.assertActive();
      // Full snapshot already includes existing fields. Replace it so an edit
      // switched to manual input can remove its previous lesson-source metadata.
      await FirestoreService.setDocument('substitutions', existing.id, updated, { controlledReplace: true, expectedState: existing });
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'UPDATE',
        module: 'SUBSTITUTIONS',
        recordId: existing.id,
        details: `Memperbarui data guru berhalangan: ${updated.guruBerhalanganName} (${updated.kelas} - ${updated.mataPelajaran}), Inval: ${updated.guruPenggantiName || 'Belum Ditugaskan'}`,
      });

      return updated;
    } finally {
      session.close();
    }
  }

  /**
   * Update substitute teacher status (e.g. In progress, completed)
   */
  public static async updateStatus(
    substitutionId: string,
    status: SubstitutionStatus,
    guruPenggantiId?: string,
    guruPenggantiName?: string,
    user?: UserProfile
  ): Promise<void> {
    const session = createAuthenticatedSession(user?.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<TeacherSubstitutionRecord>('substitutions', substitutionId);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!existing) return;

      const updated: TeacherSubstitutionRecord = {
        ...existing,
        status,
        ...(guruPenggantiId && { guruPenggantiId }),
        ...(guruPenggantiName && { guruPenggantiName }),
        updatedAt: FirestoreService.nextUpdatedAt(existing),
        updatedBy: user?.fullName || 'Petugas Piket',
      };

      session.assertActive();
      await FirestoreService.setDocument('substitutions', substitutionId, updated, { expectedState: existing });
      if (user) {
        await FirestoreService.logAudit({
          userId: user.id,
          userName: user.fullName,
          role: user.role,
          action: 'UPDATE',
          module: 'SUBSTITUTIONS',
          recordId: substitutionId,
          details: `Mengubah status jadwal inval kelas ${existing.kelas} menjadi ${status}`,
        });
      }
    } finally {
      session.close();
    }
  }

  /**
   * Deteksi apakah guru pengganti sudah memiliki penugasan lain pada tanggal dan JP yang bertabrakan.
   */
  public static checkSubstituteConflict(params: {
    tanggal: string;
    substituteId: string;
    periodNumbers?: number[];
    jamPelajaran?: string;
    excludeSubstitutionId?: string;
    existingSubstitutions: TeacherSubstitutionRecord[];
  }): { hasConflict: boolean; conflictingRecord?: TeacherSubstitutionRecord; reason?: string } {
    const { tanggal, substituteId, periodNumbers = [], jamPelajaran, excludeSubstitutionId, existingSubstitutions } = params;

    if (!substituteId || substituteId.trim() === '') {
      return { hasConflict: false };
    }

    for (const sub of existingSubstitutions) {
      if (excludeSubstitutionId && sub.id === excludeSubstitutionId) continue;
      if (sub.tanggal !== tanggal) continue;

      // Cek apakah guru ini ditugaskan sebagai guru pengganti di catatan lain
      if (sub.guruPenggantiId === substituteId) {
        // Cek overlap JP
        const subPeriods = sub.selectedPeriodNumbers || [];
        const hasPeriodOverlap =
          periodNumbers.length > 0 && subPeriods.length > 0
            ? periodNumbers.some((p) => subPeriods.includes(p))
            : sub.jamPelajaran === jamPelajaran;

        if (hasPeriodOverlap) {
          return {
            hasConflict: true,
            conflictingRecord: sub,
            reason: `Guru pengganti sudah ditugaskan di Kelas ${sub.kelas} pada ${sub.jamPelajaran} (menggantikan ${sub.guruBerhalanganName}).`,
          };
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * Menyimpan sekumpulan penugasan guru berhalangan dan inval secara massal (Batch).
   * - Menghubungkan semua rincian input dengan satu groupId
   * - Mencegah penugasan duplikat pada guru, tanggal, kelas, dan JP yang sama
   * - Memastikan guru pengganti tidak sama dengan guru berhalangan
   * - Mendeteksi bentrok jadwal guru pengganti
   * - Mendukung status 'MENUNGGU_GURU_INVAL' jika pengganti belum dipilih
   * - Menggunakan batchRequestId tetap untuk memastikan idempotensi saat retry
   * - Menghasilkan laporan sukses/gagal per rincian
   */
  public static async saveBatchSubstitutions(params: {
    items: Array<Omit<TeacherSubstitutionRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'id'> & { id?: string }>;
    user: UserProfile;
    batchRequestId: string;
    groupId?: string;
  }): Promise<import('../../types/substitution.types').BatchSubstitutionResponse> {
    const session = createAuthenticatedSession(params.user.id);
    try {
      const { items, user, batchRequestId } = params;
      const groupId = params.groupId || `grp-${new Date().toISOString().split('T')[0]}-${batchRequestId.slice(0, 8)}`;

      session.assertActive();
      const existingRecords = await FirestoreService.getForDates<TeacherSubstitutionRecord>(
        'substitutions', items.map(item => item.tanggal)
      );
      const results: import('../../types/substitution.types').BatchSubstitutionItemResult[] = [];

      // Lacak penugasan yang baru saja berhasil disimpan dalam batch ini untuk mendeteksi konflik internal antar rincian
      const savedInBatch: TeacherSubstitutionRecord[] = [];

      for (const item of items) {
        try {
          // 1. Validasi: Guru pengganti tidak boleh sama dengan guru yang berhalangan
          if (item.guruPenggantiId && item.guruPenggantiId === item.guruBerhalanganId) {
            results.push({
              substitutionId: item.id,
              guruBerhalanganId: item.guruBerhalanganId,
              guruBerhalanganName: item.guruBerhalanganName,
              kelas: item.kelas,
              jamPelajaran: item.jamPelajaran,
              guruPenggantiName: item.guruPenggantiName,
              success: false,
              error: `Guru pengganti tidak boleh sama dengan guru yang berhalangan (${item.guruBerhalanganName}).`,
            });
            continue;
          }

          // 2. Deteksi duplikasi: Guru yang sama sudah tercatat berhalangan di tanggal, kelas, dan JP yang sama
          const duplicate = existingRecords.find((r) => {
            if (r.tanggal !== item.tanggal) return false;
            if (r.guruBerhalanganId !== item.guruBerhalanganId) return false;
            if (r.kelas !== item.kelas) return false;

            const rPeriods = r.selectedPeriodNumbers || [];
            const itemPeriods = item.selectedPeriodNumbers || [];
            if (itemPeriods.length > 0 && rPeriods.length > 0) {
              return itemPeriods.some((p) => rPeriods.includes(p));
            }
            return r.jamPelajaran === item.jamPelajaran;
          });

          // Jika duplikat memiliki batchRequestId yang sama persis, ini adalah retry sukses sebelumnya (idempotent)
          if (duplicate && duplicate.batchRequestId === batchRequestId) {
            results.push({
              substitutionId: duplicate.id,
              guruBerhalanganId: item.guruBerhalanganId,
              guruBerhalanganName: item.guruBerhalanganName,
              kelas: item.kelas,
              jamPelajaran: item.jamPelajaran,
              guruPenggantiName: item.guruPenggantiName,
              success: true,
              record: duplicate,
            });
            savedInBatch.push(duplicate);
            continue;
          }

          // Jika duplikat ada pada catatan ID lain yang sudah tersimpan sebelumnya
          if (duplicate && (!item.id || duplicate.id !== item.id)) {
            results.push({
              substitutionId: item.id,
              guruBerhalanganId: item.guruBerhalanganId,
              guruBerhalanganName: item.guruBerhalanganName,
              kelas: item.kelas,
              jamPelajaran: item.jamPelajaran,
              guruPenggantiName: item.guruPenggantiName,
              success: false,
              error: `Penugasan untuk guru ${item.guruBerhalanganName} di Kelas ${item.kelas} pada ${item.jamPelajaran} sudah tercatat sebelumnya.`,
            });
            continue;
          }

          // 3. Deteksi bentrok jadwal guru pengganti (baik terhadap catatan server maupun antar item dalam batch)
          if (item.guruPenggantiId) {
            const allToCheck = [...existingRecords, ...savedInBatch];
            const conflict = this.checkSubstituteConflict({
              tanggal: item.tanggal,
              substituteId: item.guruPenggantiId,
              periodNumbers: item.selectedPeriodNumbers,
              jamPelajaran: item.jamPelajaran,
              excludeSubstitutionId: item.id,
              existingSubstitutions: allToCheck,
            });

            if (conflict.hasConflict) {
              results.push({
                substitutionId: item.id,
                guruBerhalanganId: item.guruBerhalanganId,
                guruBerhalanganName: item.guruBerhalanganName,
                kelas: item.kelas,
                jamPelajaran: item.jamPelajaran,
                guruPenggantiName: item.guruPenggantiName,
                success: false,
                error: `Bentrok penugasan: Guru pengganti ${item.guruPenggantiName} sudah memiliki tugas lain pada waktu yang sama (${conflict.reason || 'jadwal bertabrakan'}).`,
              });
              continue;
            }
          }

          // 4. Generate deterministic ID berdasarkan kombinasi stabil untuk idempotent retry
          const cleanClass = item.kelas.replace(/[^a-zA-Z0-9]/g, '');
          const periodKey = (item.selectedPeriodNumbers || []).join('-') || 'all';
          const deterministicId =
            item.id || `inv-${item.tanggal}-${item.guruBerhalanganId}-${cleanClass}-${periodKey}-${batchRequestId.slice(0, 8)}`;

          const status: SubstitutionStatus = item.guruPenggantiId
            ? (item.status || 'TERTUGASKAN')
            : 'MENUNGGU_GURU_INVAL';

          session.assertActive();
          const savedRecord = await this.createSubstitution(
            {
              ...item,
              id: deterministicId,
              groupId,
              batchRequestId,
              status,
            },
            user
          );

          savedInBatch.push(savedRecord);
          results.push({
            substitutionId: savedRecord.id,
            guruBerhalanganId: item.guruBerhalanganId,
            guruBerhalanganName: item.guruBerhalanganName,
            kelas: item.kelas,
            jamPelajaran: item.jamPelajaran,
            guruPenggantiName: item.guruPenggantiName,
            success: true,
            record: savedRecord,
          });
        } catch (err: any) {
          results.push({
            substitutionId: item.id,
            guruBerhalanganId: item.guruBerhalanganId,
            guruBerhalanganName: item.guruBerhalanganName,
            kelas: item.kelas,
            jamPelajaran: item.jamPelajaran,
            guruPenggantiName: item.guruPenggantiName,
            success: false,
            error: err?.message || 'Gagal menyimpan penugasan rincian ini.',
          });
        }
      }

      const allSuccessful = results.length > 0 && results.every((r) => r.success);
      return {
        results,
        allSuccessful,
        groupId,
      };
    } finally {
      session.close();
    }
  }

  /**
   * Delete substitution record
   */
  public static async deleteSubstitution(substitutionId: string, user: UserProfile): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      await FirestoreService.deleteDocument('substitutions', substitutionId);
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'DELETE',
        module: 'SUBSTITUTIONS',
        recordId: substitutionId,
        details: `Menghapus catatan guru inval ID: ${substitutionId}`,
      });
    } finally {
      session.close();
    }
  }
}

