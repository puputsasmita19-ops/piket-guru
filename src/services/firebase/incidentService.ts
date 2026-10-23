import { createAuthenticatedSession } from './sessionGuard';
import { FirestoreService } from './firestoreService';
import { assertRecordOwner } from '../../utils/recordOwnership';
import { IncidentRecord, IncidentStatus } from '../../types/incident.types';
import { UserProfile } from '../../types';
import { processMultiplePhotosForStorage } from '../drive/photoUploadHelper';

export class IncidentService {
  /**
   * Automatic demo incident seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(): Promise<void> {
    // No-op in operational mode: empty database remains clean for official school incident reports
    return;
  }

  /**
   * Explicit demo incidents seeder for development/testing environments
   */
  public static async seedDemoIncidents(): Promise<void> {
    const existing = await FirestoreService.getAllRaw<IncidentRecord>('incidents');
    if (existing.length === 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seedIncidents: IncidentRecord[] = [
        {
          id: `inc-${todayISO}-01`,
          tanggal: todayISO,
          waktu: '07:15',
          kategori: 'SISWA',
          kategoriName: 'Kesiswaan & Perilaku',
          tingkatKeparahan: 'SEDANG',
          lokasi: 'Gerbang Depan Sekolah',
          pihakTerlibat: '3 Siswa Kelas XI (Riko, Dimas, Bayu)',
          uraian: 'Terlambat lebih dari 20 menit saat upacara bendera dan mencoba melompati pagar samping pos satpam.',
          tindakanAwal: 'Petugas piket dan satpam mengarahkan siswa ke pos piket, mendata nama, serta menyita atribut yang tidak sesuai.',
          tindakLanjut: 'Diserahkan kepada Guru BK untuk pencatatan poin pelanggaran dan pembinaan disiplin.',
          penanggungJawab: 'Drs. H. Ahmad Fauzi, M.Pd.',
          status: 'PENANGANAN',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Drs. H. Ahmad Fauzi, M.Pd.',
        },
        {
          id: `inc-${todayISO}-02`,
          tanggal: todayISO,
          waktu: '09:45',
          kategori: 'KESEHATAN',
          kategoriName: 'Kesehatan & Medis',
          tingkatKeparahan: 'TINGGI',
          lokasi: 'Lapangan Olahraga',
          pihakTerlibat: '1 Siswi Kelas X (Anisa - X MIPA 1)',
          uraian: 'Pingsan dan mengeluh sesak nafas ringan saat mengikuti pemanasan pelajaran PJOK.',
          tindakanAwal: 'Evakuasi cepat ke Ruang UKS, diberikan pertolongan pertama oksigen dan minyak angin oleh petugas PMR & Guru Piket.',
          tindakLanjut: 'Kondisi telah membaik dan stabil, orang tua telah dihubungi untuk penjemputan istirahat di rumah.',
          penanggungJawab: 'Siti Nurhaliza, S.Pd.',
          status: 'SELESAI',
          resolvedAt: new Date().toISOString(),
          resolvedBy: 'Siti Nurhaliza, S.Pd.',
          resolutionNote: 'Siswi dijemput orang tua pukul 10.30 WIB dalam keadaan sadar dan sehat.',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Siti Nurhaliza, S.Pd.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Siti Nurhaliza, S.Pd.',
        },
        {
          id: `inc-${todayISO}-03`,
          tanggal: todayISO,
          waktu: '11:20',
          kategori: 'FASILITAS',
          kategoriName: 'Sarana & Prasarana',
          tingkatKeparahan: 'SEDANG',
          lokasi: 'Toilet Siswa Lantai 2 Gedung B',
          pihakTerlibat: 'Fasilitas Umum',
          uraian: 'Kran air utama patah menyebabkan air mengalir deras ke koridor kelas XI.',
          tindakanAwal: 'Mematikan stop kran induk di bawah tangga dan memasang tanda lantai licin.',
          tindakLanjut: 'Sudah dilaporkan ke bagian Sarpras (Pak Mulyadi) untuk penggantian kran baru.',
          penanggungJawab: 'Budi Santoso, M.Kom.',
          status: 'PENANGANAN',
          dataSource: 'SEED',
          isDemo: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Budi Santoso, M.Kom.',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Budi Santoso, M.Kom.',
        },
      ];

      for (const inc of seedIncidents) {
        await FirestoreService.setDocument('incidents', inc.id, inc);
      }
    }
  }

  /**
   * Save or update an incident atomically with audit log
   */
  public static async saveIncident(
    record: IncidentRecord,
    user: UserProfile
  ): Promise<IncidentRecord> {
    const session = createAuthenticatedSession(user.id);
    try {
      const needsGeneratedId = !record.id || record.id.startsWith('temp-');
      const id = needsGeneratedId ? `inc-${record.tanggal}-${crypto.randomUUID()}` : record.id;
      // Keep generated identity on the pending payload for retry after a lost response.
      record.id = id;

      // Idempotency check: jika id sudah tercatat di server (misal retry respons terputus), kembalikan tanpa duplikasi
      session.assertActive();
      const existingDoc = await FirestoreService.getByIdStrict<IncidentRecord>('incidents', id);
      if (needsGeneratedId && existingDoc) {
        return existingDoc;
      }
      // Forms reserve IDs before saving so retries keep the same photo identity.
      // A reserved ID is still a creation until its document exists on the server.
      const isNew = !existingDoc;
      if (existingDoc) assertRecordOwner(user, existingDoc as unknown as Record<string, unknown>, 'pelaporId');
      if (!isNew && existingDoc && record.updatedAt && existingDoc.updatedAt && existingDoc.updatedAt !== record.updatedAt) {
        throw new Error(`Konflik pembaruan: Laporan kejadian telah diperbarui di server oleh ${existingDoc.updatedBy || 'pengguna lain'}. Buka data terbaru untuk meninjau.`);
      }

      const now = FirestoreService.nextUpdatedAt(existingDoc);
      session.assertActive();
      const photos = await processMultiplePhotosForStorage(record.photos || [], 'incidents', id);

      const rawPayload: IncidentRecord = {
        ...record,
        photos,
        id,
        pelaporId: existingDoc?.pelaporId || user.id,
        pelaporName: record.pelaporName || user.fullName,
        penanggungJawab: record.penanggungJawab || user.fullName,
        status: record.status || 'BARU',
        dataSource: 'PRODUCTION',
        isDemo: false,
        updatedAt: now,
        updatedBy: user.fullName,
        createdAt: existingDoc?.createdAt || record.createdAt || now,
        createdBy: existingDoc?.createdBy || user.fullName,
      };

      const payload = FirestoreService.sanitizeFirestorePayload(rawPayload);

      session.assertActive();
      await FirestoreService.setDocumentWithAudit('incidents', id, payload, {
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: isNew ? 'CREATE' : 'UPDATE',
        module: 'INCIDENTS',
        recordId: id,
        details: `${isNew ? 'Melaporkan' : 'Memperbarui'} kejadian: [${payload.kategori}] ${payload.uraian.substring(0, 40)}... (${payload.tingkatKeparahan})`,
        metadata: {
          kategori: payload.kategori,
          tingkatKeparahan: payload.tingkatKeparahan,
          status: payload.status,
          tanggal: payload.tanggal,
          pelaporId: payload.pelaporId,
        },
      }, { expectedState: existingDoc });

      return payload;
    } finally {
      session.close();
    }
  }

  /**
   * Update status of an incident atomically with audit log
   */
  public static async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    user: UserProfile,
    resolutionNote?: string
  ): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      const existing = await FirestoreService.getByIdStrict<IncidentRecord>('incidents', incidentId);
      if (existing) assertRecordOwner(user, existing as unknown as Record<string, unknown>, 'pelaporId');
      if (!existing) return;

      const now = FirestoreService.nextUpdatedAt(existing);
      const updated: IncidentRecord = {
        ...existing,
        status: newStatus,
        updatedAt: now,
        updatedBy: user.fullName,
      };

      if (newStatus === 'SELESAI') {
        updated.resolvedAt = now;
        updated.resolvedBy = user.fullName;
        if (resolutionNote && resolutionNote.trim()) {
          updated.resolutionNote = resolutionNote.trim();
        }
      }

      const payload = FirestoreService.sanitizeFirestorePayload(updated);

      session.assertActive();
      await FirestoreService.setDocumentWithAudit('incidents', incidentId, payload, {
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'STATUS_CHANGE',
        module: 'INCIDENTS',
        recordId: incidentId,
        details: `Mengubah status kejadian ID ${incidentId} menjadi ${newStatus}${resolutionNote ? ` (Catatan: ${resolutionNote})` : ''}`,
        metadata: {
          oldStatus: existing.status,
          newStatus,
          incidentId,
        },
      }, { expectedState: existing });
    } finally {
      session.close();
    }
  }

  /**
   * Delete an incident
   */
  public static async deleteIncident(incidentId: string, user: UserProfile): Promise<void> {
    const session = createAuthenticatedSession(user.id);
    try {
      session.assertActive();
      await FirestoreService.deleteDocument('incidents', incidentId);
      await FirestoreService.logAudit({
        userId: user.id,
        userName: user.fullName,
        role: user.role,
        action: 'DELETE',
        module: 'INCIDENTS',
        recordId: incidentId,
        details: `Menghapus laporan kejadian ID: ${incidentId}`,
      });
    } finally {
      session.close();
    }
  }
}
