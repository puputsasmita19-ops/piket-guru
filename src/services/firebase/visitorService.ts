import { FirestoreService } from './firestoreService';
import { VisitorRecord, VisitorStatus } from '../../types/visitor.types';
import { UserProfile } from '../../types';
import { formatTime } from '../../utils/dateUtils';

export class VisitorService {
  /**
   * Automatic demo visitor seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official school visitors
    return;
  }

  /**
   * Explicit demo visitors seeder for development/testing environments
   */
  public static async seedDemoVisitors(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<VisitorRecord>('visitors');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seed: VisitorRecord[] = [
        {
          id: `vis-${todayISO}-01`,
          tanggal: todayISO,
          jamMasuk: '08:15',
          jamKeluar: '09:30',
          namaTamu: 'Ir. Hendra Gunawan',
          instansiAsal: 'Dinas Pendidikan Provinsi DKI Jakarta',
          kategori: 'DINAS_INSTANSI',
          noHp: '081234567811',
          nomorIdentitas: '3174051203800002',
          nomorBadge: 'TAMU-01',
          tujuanBertemu: 'Dr. Hj. Siti Rohmah, M.Pd.',
          keperluan: 'Monitoring dan Evaluasi Program Digitalisasi Sekolah',
          status: 'SELESAI',
          catatanPetugas: 'Tamu telah melapor dan selesai bertemu Kepala Sekolah.',
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
          id: `vis-${todayISO}-02`,
          tanggal: todayISO,
          jamMasuk: '10:00',
          namaTamu: 'Ibu Ratna Dewi',
          instansiAsal: 'Orang Tua Siswa (Kelas X MIPA 1)',
          kategori: 'ORANG_TUA',
          noHp: '081398765422',
          nomorIdentitas: '3174086502840003',
          nomorBadge: 'TAMU-02',
          tujuanBertemu: 'Siti Nurhaliza, S.Pd. (Wali Kelas)',
          keperluan: 'Konsultasi Perkembangan Belajar Siswa & Administrasi Beasiswa',
          status: 'SEDANG_BERKUNJUNG',
          catatanPetugas: 'Sedang berada di Ruang Pertemuan Guru Lantai 1.',
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
        await FirestoreService.setDocument('visitors', item.id, item);
      }
    }
  }

  /**
   * Register a new visitor check-in
   */
  public static async registerVisitor(
    data: Omit<VisitorRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    user: UserProfile
  ): Promise<VisitorRecord> {
    const id = `vis-${data.tanggal}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const cleanData = { ...data };
    if (cleanData.kategori !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    }

    const payload: VisitorRecord = {
      ...cleanData,
      id,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: now,
      createdBy: user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('visitors', id, payload);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'CREATE',
      module: 'VISITORS',
      recordId: id,
      details: `Mencatat tamu baru: ${payload.namaTamu} (${payload.instansiAsal}) bertemu dengan ${payload.tujuanBertemu}`,
    });

    return payload;
  }

  /**
   * Update an existing visitor record (Edit)
   * Preserves existing ID, createdAt, createdBy, dataSource, isDemo, and visit status.
   */
  public static async updateVisitor(
    data: Partial<VisitorRecord> & { id: string },
    user: UserProfile
  ): Promise<VisitorRecord> {
    const existing = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', data.id);
    if (!existing) {
      throw new Error(`Data buku tamu dengan ID ${data.id} tidak ditemukan.`);
    }

    const now = new Date().toISOString();
    const cleanData = { ...data };

    // If kategori is not LAINNYA, delete keteranganLainnya
    if (cleanData.kategori && cleanData.kategori !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    } else if (!cleanData.kategori && existing.kategori !== 'LAINNYA') {
      delete cleanData.keteranganLainnya;
    }

    const updated: VisitorRecord = {
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

    // If kategori is changed from LAINNYA to another, ensure keteranganLainnya is completely removed
    if (updated.kategori !== 'LAINNYA') {
      delete updated.keteranganLainnya;
    }

    await FirestoreService.setDocument('visitors', existing.id, updated, { controlledReplace: true });
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'UPDATE',
      module: 'VISITORS',
      recordId: existing.id,
      details: `Memperbarui data buku tamu: ${updated.namaTamu} (${updated.instansiAsal}) - Kategori: ${updated.kategori}`,
    });

    return updated;
  }

  /**
   * Check out visitor (record exit time)
   */
  public static async checkoutVisitor(
    visitorId: string,
    user: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<VisitorRecord>('visitors', visitorId);
    if (!existing) return;

    const exitTime = formatTime(new Date());
    const updated: VisitorRecord = {
      ...existing,
      jamKeluar: exitTime,
      status: 'SELESAI',
      updatedAt: new Date().toISOString(),
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('visitors', visitorId, updated);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'VISITORS',
      recordId: visitorId,
      details: `Check-out tamu: ${existing.namaTamu} (Keluar pukul ${exitTime} WIB)`,
    });
  }

  /**
   * Delete visitor record
   */
  public static async deleteVisitor(visitorId: string, user: UserProfile): Promise<void> {
    await FirestoreService.deleteDocument('visitors', visitorId);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'DELETE',
      module: 'VISITORS',
      recordId: visitorId,
      details: `Menghapus catatan buku tamu ID: ${visitorId}`,
    });
  }
}
