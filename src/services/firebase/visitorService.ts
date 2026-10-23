import { createAuthenticatedSession } from './sessionGuard';
import { FirestoreService } from './firestoreService';
import { assertRecordOwner } from '../../utils/recordOwnership';
import { VisitorRecord, VisitorStatus } from '../../types/visitor.types';
import { UserProfile } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { isDriveStorageActive, processPhotoForStorage } from '../drive/photoUploadHelper';
import { auth } from './firebase';

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
    data: Omit<VisitorRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & { id?: string },
    user: UserProfile
  ): Promise<VisitorRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      const id = data.id || `vis-${data.tanggal}-${crypto.randomUUID()}`;
      data.id = id;
      // Idempotency check: jika tamu telah tercatat di server (misal respons jaringan terputus), kembalikan tanpa membuat log audit ganda
      session.assertActive();
      const existingDoc = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', id);
      if (existingDoc) {
        return existingDoc;
      }

      // Badge allocation and group writes are committed atomically by the backend.
      // Client-provided badge values are intentionally ignored on new registrations.
      const cleanData = { ...data };
      if (cleanData.kategori !== 'LAINNYA') delete cleanData.keteranganLainnya;
      if (cleanData.fotoUrl) {
        session.assertActive();
        const photo = await processPhotoForStorage(cleanData.fotoUrl, 'visitors', id, id);
        cleanData.fotoUrl = photo.photoUrl;
        cleanData.fotoStorageProvider = photo.provider === 'google_drive' ? 'google_drive' : 'firestore_base64';
      }
      session.assertActive();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sesi Firebase belum siap. Masuk kembali.');
      const response = await fetch('/api/visitor-registration/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ...cleanData, id }),
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Registrasi tamu belum berhasil.');
      session.assertActive();
      const saved = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', id);
      if (!saved) throw new Error('Data tersimpan, tetapi belum dapat dibaca. Muat ulang daftar tamu.');
      return saved;
    } finally {
      session.close();
    }
  }

  /**
   * Update an existing visitor record (Edit)
   * Preserves existing ID, createdAt, createdBy, dataSource, isDemo, and visit status.
   */
  public static async updateVisitor(
    data: Partial<VisitorRecord> & { id: string },
    user: UserProfile
  ): Promise<VisitorRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', data.id);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!existing) {
        throw new Error(`Data buku tamu dengan ID ${data.id} tidak ditemukan.`);
      }

      if (data.updatedAt && existing.updatedAt && existing.updatedAt !== data.updatedAt) {
        throw new Error(`Konflik pembaruan: Data buku tamu telah diperbarui di server oleh ${existing.updatedBy || 'pengguna lain'}. Buka data terbaru untuk meninjau.`);
      }

      const now = FirestoreService.nextUpdatedAt(existing);
      const cleanData = { ...data };
      // Only process an explicitly provided photo; partial edits preserve the old one.
      if (cleanData.fotoUrl) {
        session.assertActive();
        const photo = await processPhotoForStorage(cleanData.fotoUrl, 'visitors', data.id, data.id);
        cleanData.fotoUrl = photo.photoUrl;
        cleanData.fotoStorageProvider = photo.provider === 'google_drive' ? 'google_drive' : 'firestore_base64';
      }

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
        petugasPiketId: existing.petugasPiketId,
        petugasPiketName: existing.petugasPiketName,
        dataSource: existing.dataSource,
        isDemo: existing.isDemo,
        updatedAt: now,
        updatedBy: user.fullName,
      };

      // If kategori is changed from LAINNYA to another, ensure keteranganLainnya is completely removed
      if (updated.kategori !== 'LAINNYA') {
        delete updated.keteranganLainnya;
      }

      session.assertActive();
      await FirestoreService.setDocument('visitors', existing.id, updated, { controlledReplace: true, expectedState: existing });
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
    } finally {
      session.close();
    }
  }

  /** Admin-only, explicit migration of a legacy Firestore Base64 photo to private Drive.
   * Never deletes the old photo until the Drive upload and record update succeed.
   */
  public static async migrateLegacyPhotoToDrive(visitorId: string, user: UserProfile): Promise<VisitorRecord> {
    if (user.role !== 'ADMIN') throw new Error('Hanya Administrator yang dapat memindahkan foto lama.');
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', visitorId);
      if (!existing) throw new Error('Catatan tamu tidak ditemukan.');
      // Older visitor records may use one of the former image-field names. Check
      // the server record again; the report preview must not be trusted as input.
      const legacy = existing as VisitorRecord & { photoUrl?: string; fotoTamu?: string; foto?: string };
      if (existing.fotoUrl?.startsWith('/api/drive/photo/')) {
        throw new Error('Foto ini sudah berada di Google Drive; tidak perlu dipindahkan lagi.');
      }
      const originalPhoto = [legacy.fotoUrl, legacy.photoUrl, legacy.fotoTamu, legacy.foto]
        .find((candidate) => typeof candidate === 'string' && candidate.startsWith('data:image/'));
      if (!originalPhoto) throw new Error('Foto tidak disimpan sebagai Base64 di Firestore, atau sudah berada di Drive.');
      if (!(await isDriveStorageActive())) throw new Error('Aktifkan penyimpanan Google Drive dan uji koneksinya terlebih dahulu.');
      session.assertActive();
      const photo = await processPhotoForStorage(originalPhoto, 'visitors', existing.id, existing.id);
      if (photo.provider !== 'google_drive' || !photo.photoUrl.startsWith('/api/drive/photo/')) {
        throw new Error('Unggah Drive belum dikonfirmasi. Foto lama tidak diubah.');
      }
      session.assertActive();
      const updated: VisitorRecord = { ...existing, fotoUrl: photo.photoUrl, fotoStorageProvider: 'google_drive', updatedAt: FirestoreService.nextUpdatedAt(existing), updatedBy: user.fullName };
      // Remove duplicate legacy Base64 aliases only after the upload succeeded.
      const mutable = updated as VisitorRecord & { photoUrl?: string; fotoTamu?: string; foto?: string };
      for (const key of ['photoUrl', 'fotoTamu', 'foto'] as const) {
        if (mutable[key] === originalPhoto) delete mutable[key];
      }
      await FirestoreService.setDocument('visitors', existing.id, updated, { controlledReplace: true, expectedState: existing });
      // Audit failure should not roll back an already-successful Drive migration.
      await FirestoreService.logAudit({ userId: user.id, userName: user.fullName, role: user.role, action: 'UPDATE', module: 'VISITORS', recordId: existing.id, details: 'Memindahkan foto tamu lama dari Firestore ke penyimpanan Google Drive pribadi.' }).catch(error => console.warn('[VISITOR] Audit foto Drive belum terkirim:', error));
      return updated;
    } finally { session.close(); }
  }

  /**
   * Check out visitor (record exit time)
   */
  public static async checkoutVisitor(
    visitorId: string,
    user: UserProfile
  ): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<VisitorRecord>('visitors', visitorId);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'petugasPiketId');
      if (!existing) return;

      const exitTime = formatTime(new Date());
      const updated: VisitorRecord = {
        ...existing,
        jamKeluar: exitTime,
        status: 'SELESAI',
        updatedAt: FirestoreService.nextUpdatedAt(existing),
        updatedBy: user.fullName,
      };

      session.assertActive();
      await FirestoreService.setDocument('visitors', visitorId, updated, { expectedState: existing });
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'STATUS_CHANGE',
        module: 'VISITORS',
        recordId: visitorId,
        details: `Check-out tamu: ${existing.namaTamu} (Keluar pukul ${exitTime} WIB)`,
      });
    } finally {
      session.close();
    }
  }

  /**
   * Delete visitor record
   */
  public static async deleteVisitor(visitorId: string, user: UserProfile): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
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
    } finally {
      session.close();
    }
  }
}
