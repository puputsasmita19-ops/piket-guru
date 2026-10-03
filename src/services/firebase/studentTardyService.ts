import { FirestoreService } from './firestoreService';
import { StudentTardyRecord, TardyStatus } from '../../types/studentTardy.types';
import { UserProfile } from '../../types';

export class StudentTardyService {
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
   */
  public static async getStudentTardyCountThisMonth(namaSiswa: string, kelas: string): Promise<number> {
    const records = await FirestoreService.getAll<StudentTardyRecord>('studentTardiness');
    const currentYearMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const matching = records.filter(
      (r) =>
        r.namaSiswa.trim().toLowerCase() === namaSiswa.trim().toLowerCase() &&
        r.kelas.trim().toLowerCase() === kelas.trim().toLowerCase() &&
        r.tanggal.startsWith(currentYearMonth)
    );

    return matching.length;
  }

  /**
   * Register a new tardy student
   */
  public static async registerTardyStudent(
    data: Omit<StudentTardyRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>,
    user: UserProfile
  ): Promise<StudentTardyRecord> {
    const id = `trd-${data.tanggal}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const payload: StudentTardyRecord = {
      ...data,
      id,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: now,
      createdBy: user.fullName,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('studentTardiness', id, payload);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'CREATE',
      module: 'TARDINESS',
      recordId: id,
      details: `Mencatat siswa terlambat: ${payload.namaSiswa} (${payload.kelas}) - Terlambat ${payload.menitTerlambat} menit (${payload.pembinaan})`,
    });

    return payload;
  }

  /**
   * Complete discipline action & admit student to class
   */
  public static async admitToClass(
    tardyId: string,
    user: UserProfile
  ): Promise<void> {
    const existing = await FirestoreService.getById<StudentTardyRecord>('studentTardiness', tardyId);
    if (!existing) return;

    const updated: StudentTardyRecord = {
      ...existing,
      status: 'SELESAI_MASUK_KELAS',
      updatedAt: new Date().toISOString(),
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('studentTardiness', tardyId, updated);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'TARDINESS',
      recordId: tardyId,
      details: `Siswa terlambat ${existing.namaSiswa} (${existing.kelas}) selesai pembinaan & diizinkan masuk kelas`,
    });
  }

  /**
   * Delete tardy record
   */
  public static async deleteTardyRecord(tardyId: string, user: UserProfile): Promise<void> {
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
  }
}
