import { FirestoreService } from './firestoreService';
import { TeacherSubstitutionRecord, SubstitutionStatus } from '../../types/substitution.types';
import { UserProfile } from '../../types';

export class SubstitutionService {
  /**
   * Seed default substitution records if collection is empty
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    const existing = await FirestoreService.getAll<TeacherSubstitutionRecord>('substitutions');
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
      module: 'SETTINGS',
      recordId: id,
      details: `Mencatat guru berhalangan: ${payload.guruBerhalanganName} (${payload.kelas} - ${payload.mataPelajaran}), Inval: ${payload.guruPenggantiName || 'Belum Ditugaskan'}`,
    });

    return payload;
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
        module: 'SETTINGS',
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
      module: 'SETTINGS',
      recordId: substitutionId,
      details: `Menghapus catatan guru inval ID: ${substitutionId}`,
    });
  }
}
