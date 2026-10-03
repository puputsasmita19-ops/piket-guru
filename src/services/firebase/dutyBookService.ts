import { FirestoreService } from './firestoreService';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { DutyBookStatus, UserProfile } from '../../types';

export class DutyBookService {
  /**
   * Automatic demo duty book seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official duty books
    return;
  }

  /**
   * Explicit demo duty book seeder for development/testing environments
   */
  public static async seedDemoDutyBook(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<DutyBookRecord>('dutyBooks');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seedRecords: DutyBookRecord[] = [
        {
          id: `book-${todayISO}-01`,
          scheduleId: 'sch-001',
          tanggal: todayISO,
          hari: 'SENIN',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: 'usr-admin-01',
          petugasName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasRole: 'GURU',
          ruangName: 'Pos Utama & Gerbang Depan',
          kondisiKeamanan: 'Situasi gerbang utama terpantau kondusif dan tertib. Seluruh tamu sekolah melapor dan mengisi buku tamu di pos satpam.',
          kondisiKebersihan: 'Halaman depan, koridor lobby, dan area kantin bersih. Pengangkutan sampah berjalan lancar sebelum jam masuk.',
          kondisiKelas: 'KBM jam 1 s.d 4 berjalan lancar. Kelas XI MIPA 2 guru izin sakit, tugas mandiri telah dikoordinasikan oleh guru piket.',
          kondisiFasilitas: 'Fasilitas listrik, AC ruang guru, dan bel sekolah berfungsi normal tanpa kendala.',
          kondisiSiswa: 'Terdapat 4 siswa terlambat pada jam masuk pertama, telah diberikan pembinaan dan pencatatan poin kedisiplinan.',
          kegiatanKhusus: 'Pelaksanaan Upacara Bendera Hari Senin pukul 07.00 - 07.45 WIB berjalan khidmat.',
          catatanPiket: 'Secara umum kegiatan operasional dan ketertiban sekolah hari ini berjalan sesuai SOP.',
          tindakLanjut: 'Perketat pengawasan area belakang parkir saat jam istirahat kedua.',
          status: 'DRAFT',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
      ];

      for (const record of seedRecords) {
        await FirestoreService.setDocument('dutyBooks', record.id, record);
      }
    }
  }

  /**
   * Save or update duty book draft
   */
  public static async saveDutyBook(
    record: DutyBookRecord,
    user: UserProfile
  ): Promise<void> {
    const isNew = !record.id || record.id.startsWith('temp-');
    const id = isNew ? `book-${record.tanggal}-${Date.now()}` : record.id;

    const payload: DutyBookRecord = {
      ...record,
      id,
      dataSource: 'PRODUCTION',
      isDemo: false,
      updatedAt: new Date().toISOString(),
      updatedBy: user.fullName,
      createdAt: record.createdAt || new Date().toISOString(),
      createdBy: record.createdBy || user.fullName,
    };

    await FirestoreService.setDocument('dutyBooks', id, payload);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: isNew ? 'CREATE' : 'UPDATE',
      module: 'DUTY_BOOK',
      recordId: id,
      details: `${isNew ? 'Membuat' : 'Menyimpan draft'} buku piket harian tanggal ${record.tanggal}`,
    });
  }

  /**
   * Advance workflow status (DRAFT -> DIAJUKAN -> DIVERIFIKASI -> DISETUJUI -> DIKUNCI)
   */
  public static async updateWorkflowStatus(
    dutyBook: DutyBookRecord,
    newStatus: DutyBookStatus,
    user: UserProfile,
    note?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updated: DutyBookRecord = {
      ...dutyBook,
      status: newStatus,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    if (newStatus === 'DIAJUKAN') {
      updated.submittedAt = now;
      updated.submittedBy = user.fullName;
    } else if (newStatus === 'DIVERIFIKASI') {
      updated.verifiedAt = now;
      updated.verifiedBy = user.fullName;
    } else if (newStatus === 'DISETUJUI') {
      updated.approvedAt = now;
      updated.approvedBy = user.fullName;
    } else if (newStatus === 'DIKUNCI') {
      updated.lockedAt = now;
      updated.lockedBy = user.fullName;
    }

    await FirestoreService.setDocument('dutyBooks', dutyBook.id, updated);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'DUTY_BOOK',
      recordId: dutyBook.id,
      details: `Mengubah status Buku Piket (${dutyBook.tanggal}) dari ${dutyBook.status} menjadi ${newStatus}${note ? ` - Catatan: ${note}` : ''}`,
    });
  }

  /**
   * Admin unlock duty book
   */
  public static async unlockDutyBook(
    dutyBook: DutyBookRecord,
    user: UserProfile,
    reason: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const { lockedAt, lockedBy, ...rest } = dutyBook;
    const updated: DutyBookRecord = {
      ...rest,
      status: 'DRAFT',
      updatedAt: now,
      updatedBy: user.fullName,
    };

    await FirestoreService.setDocument('dutyBooks', dutyBook.id, updated);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'UPDATE',
      module: 'DUTY_BOOK',
      recordId: dutyBook.id,
      details: `Admin membuka kunci buku piket (${dutyBook.tanggal}). Alasan: ${reason}`,
    });
  }
}
