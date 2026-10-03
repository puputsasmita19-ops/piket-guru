import { FirestoreService } from './firestoreService';
import { AnnouncementRecord, AnnouncementPriority } from '../../types/announcement.types';
import { UserProfile } from '../../types';

export class AnnouncementService {
  /**
   * Automatic demo announcement seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official school announcements
    return;
  }

  /**
   * Explicit demo announcements seeder for development/testing environments
   */
  public static async seedDemoAnnouncements(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<AnnouncementRecord>('announcements');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seed: AnnouncementRecord[] = [
        {
          id: `ann-${todayISO}-01`,
          title: 'Kunjungan Tim Pengawas Dinas Pendidikan',
          content: 'Diberitahukan kepada seluruh Guru Piket hari ini, akan ada kunjungan pengawas pembina pukul 09.30 WIB. Mohon pastikan buku tamu pos satpam, kelengkapan jurnal, dan ketertiban area gerbang siap.',
          priority: 'PENTING',
          authorName: 'Dr. Hj. Siti Rohmah, M.Pd.',
          authorRole: 'KEPALA_SEKOLAH',
          date: todayISO,
          targetRole: 'SEMUA',
          isActive: true,
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Dr. Hj. Siti Rohmah, M.Pd.',
        },
        {
          id: `ann-${todayISO}-02`,
          title: 'Pemeriksaan Kedisiplinan Seragam Siswa',
          content: 'Mohon petugas piket pos gerbang depan membantu mendata dan menertibkan atribut kelengkapan seragam siswa saat jam masuk pagi.',
          priority: 'INFO',
          authorName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          authorRole: 'ADMIN',
          date: todayISO,
          targetRole: 'SEMUA',
          isActive: true,
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
      ];

      for (const item of seed) {
        await FirestoreService.setDocument('announcements', item.id, item);
      }
    }
  }

  /**
   * Create or update announcement
   */
  public static async saveAnnouncement(
    data: {
      id?: string;
      title: string;
      content: string;
      priority: AnnouncementPriority;
      targetRole?: string;
    },
    user: UserProfile
  ): Promise<void> {
    const isNew = !data.id;
    const id = data.id || `ann-${Date.now()}`;
    const todayISO = new Date().toISOString().split('T')[0];

    const payload: AnnouncementRecord = {
      id,
      title: data.title,
      content: data.content,
      priority: data.priority,
      authorName: user.fullName,
      authorRole: user.role,
      date: todayISO,
      targetRole: data.targetRole || 'SEMUA',
      isActive: true,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: new Date().toISOString(),
      createdBy: user.fullName,
    };

    await FirestoreService.setDocument('announcements', id, payload);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: isNew ? 'CREATE' : 'UPDATE',
      module: 'SETTINGS',
      recordId: id,
      details: `${isNew ? 'Membuat' : 'Memperbarui'} pengumuman papan informasi piket: "${payload.title}"`,
    });
  }

  /**
   * Delete announcement
   */
  public static async deleteAnnouncement(id: string, user: UserProfile): Promise<void> {
    await FirestoreService.deleteDocument('announcements', id);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'DELETE',
      module: 'SETTINGS',
      recordId: id,
      details: `Menghapus pengumuman ID: ${id}`,
    });
  }
}
