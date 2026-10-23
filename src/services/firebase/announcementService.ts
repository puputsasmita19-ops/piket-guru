import { FirestoreService } from './firestoreService';
import { assertRecordOwner } from '../../utils/recordOwnership';
import { AnnouncementRecord, AnnouncementSaveInput, sanitizeAnnouncementConfig } from '../../types/announcement.types';
import { SchoolSettings, UserProfile } from '../../types';
import { auth } from './firebaseAuth';
import { getTodayISODate } from '../../utils/dateUtils';

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

  private static assertSession(userId: string): void {
    if (auth.currentUser?.uid !== userId) throw new Error('Sesi berubah. Silakan masuk kembali sebelum menyimpan pengumuman.');
  }

  private static async manager(userId: string): Promise<UserProfile> {
    this.assertSession(userId);
    const profile = await FirestoreService.getByIdStrict<UserProfile>('users', userId);
    this.assertSession(userId);
    if (!profile?.isActive || profile.requiresActivation || !['ADMIN', 'KEPALA_SEKOLAH'].includes(profile.role)) {
      throw new Error('Hanya admin atau kepala sekolah aktif yang dapat mengelola pengumuman.');
    }
    return profile;
  }

  /** Edit the same record, preserve its publication identity, and reject stale forms. */
  public static async saveAnnouncement(
    data: AnnouncementSaveInput,
    user: UserProfile
  ): Promise<void> {
    const isNew = !data.id;
    const title = data.title.trim(), content = data.content.trim();
    const targetRole = data.targetRole || 'SEMUA';
    if (!title || title.length > 200 || !content || content.length > 10000) {
      throw new Error('Isi judul (maksimal 200 karakter) dan keterangan (maksimal 10.000 karakter).');
    }
    if (!['INFO', 'PENTING', 'DARURAT'].includes(data.priority) || !['SEMUA', 'GURU', 'TENDIK', 'SATPAM'].includes(targetRole)) {
      throw new Error('Prioritas atau sasaran pengumuman tidak valid.');
    }
    if (!isNew && (!data.expectedState || !data.id || data.id.includes('/'))) {
      throw new Error('Buka kembali menu edit pengumuman untuk memuat versi yang benar.');
    }
    const manager = await this.manager(user.id);
    const id = data.id || `ann-${crypto.randomUUID()}`;
    let existing: AnnouncementRecord | null = null;
    if (!isNew) {
      const [record, settings] = await Promise.all([
        FirestoreService.getByIdStrict<AnnouncementRecord>('announcements', id),
        FirestoreService.getByIdStrict<SchoolSettings>('settings', 'school_config'),
      ]);
      this.assertSession(user.id);
      if (!sanitizeAnnouncementConfig(settings?.announcementConfig).allowPublishedEditing) {
        throw new Error('Edit pengumuman dinonaktifkan oleh admin. Aktifkan melalui Pengaturan → Notifikasi & Pengumuman.');
      }
      if (!record || record.updatedAt !== data.expectedState?.updatedAt) {
        throw new Error('Pengumuman telah berubah atau dihapus. Tutup formulir, lalu buka Edit lagi untuk melihat data terbaru.');
      }
      assertRecordOwner(user, { pelaporId: record.authorId } as Record<string, unknown>, 'pelaporId');
      existing = record;
      if (title === record.title && content === record.content && data.priority === record.priority && targetRole === (record.targetRole || 'SEMUA')) return;
    }
    const now = FirestoreService.nextUpdatedAt(existing);

    const payload: AnnouncementRecord = {
      ...(existing || {
        authorName: manager.fullName, authorId: user.id, authorRole: manager.role,
        date: getTodayISODate(), isActive: true, dataSource: 'PRODUCTION', isDemo: false,
        createdAt: now, createdBy: manager.fullName,
      }),
      // Publication date/author/visibility stay unchanged on edits.
      id, title, content, priority: data.priority, targetRole, updatedAt: now,
      ...(!isNew ? { updatedBy: user.id, updatedByName: manager.fullName } : {}),
    };

    this.assertSession(user.id);
    await FirestoreService.setDocumentWithAudit('announcements', id, payload, {
      userId: user.id,
      userName: manager.fullName,
      role: manager.role,
      action: isNew ? 'CREATE' : 'UPDATE',
      module: 'SETTINGS',
      recordId: id,
      details: `${isNew ? 'Membuat' : 'Memperbarui'} pengumuman papan informasi piket: "${payload.title}"`,
    }, { expectedState: isNew ? null : data.expectedState });
  }

  /**
   * Delete announcement
   */
  public static async deleteAnnouncement(id: string, user: UserProfile): Promise<void> {
    await this.manager(user.id);
    this.assertSession(user.id);
    const existing = await FirestoreService.getByIdStrict<AnnouncementRecord>('announcements', id);
    if (!existing) return;
    assertRecordOwner(user, { pelaporId: existing.authorId } as Record<string, unknown>, 'pelaporId');
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
