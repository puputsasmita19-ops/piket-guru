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
    data: Omit<StudentPermitRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    user: UserProfile
  ): Promise<StudentPermitRecord> {
    const id = `pmt-${data.tanggal}-${Date.now().toString(36)}`;
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

    await FirestoreService.setDocument('studentPermits', id, payload);
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

    const now = new Date().toISOString();
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

    await FirestoreService.setDocument('studentPermits', existing.id, updated, { controlledReplace: true });
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
   * Mark student as returned to school (check-in back)
   */
  public static async markReturned(
    permitId: string,
    user: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<StudentPermitRecord>('studentPermits', permitId);
    if (!existing) return;

    const returnTime = formatTime(new Date());
    const updated: StudentPermitRecord = {
      ...existing,
      jamKembali: returnTime,
      status: 'SUDAH_KEMBALI',
      updatedAt: new Date().toISOString(),
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('studentPermits', permitId, updated);
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
