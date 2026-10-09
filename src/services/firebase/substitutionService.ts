import { FirestoreService } from './firestoreService';
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
    data: Omit<TeacherSubstitutionRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    user: UserProfile
  ): Promise<TeacherSubstitutionRecord> {
    const id = `inv-${data.tanggal}-${Date.now().toString(36)}`;
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

    await FirestoreService.setDocument('substitutions', id, payload);
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
  }

  /**
   * Update entire teacher substitution record (Edit modal)
   * Preserves existing ID, createdAt, createdBy.
   */
  public static async updateSubstitution(
    data: Partial<TeacherSubstitutionRecord> & { id: string },
    user: UserProfile
  ): Promise<TeacherSubstitutionRecord> {
    const existing = await FirestoreService.getByIdStrict<TeacherSubstitutionRecord>('substitutions', data.id);
    if (!existing) {
      throw new Error(`Catatan penugasan inval ID ${data.id} tidak ditemukan.`);
    }

    const now = new Date().toISOString();
    const updated: TeacherSubstitutionRecord = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('substitutions', existing.id, updated);
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
    const existing = await FirestoreService.getById<TeacherSubstitutionRecord>('substitutions', substitutionId);
    if (!existing) return;

    const updated: TeacherSubstitutionRecord = {
      ...existing,
      status,
      ...(guruPenggantiId && { guruPenggantiId }),
      ...(guruPenggantiName && { guruPenggantiName }),
      updatedAt: new Date().toISOString(),
      updatedBy: user?.fullName || 'Petugas Piket',
    };

    await FirestoreService.setDocument('substitutions', substitutionId, updated);
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
  }

  /**
   * Delete substitution record
   */
  public static async deleteSubstitution(substitutionId: string, user: UserProfile): Promise<void> {
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
  }
}
