import { FirestoreService } from './firestoreService';
import { IncidentRecord, IncidentStatus } from '../../types/incident.types';
import { UserProfile } from '../../types';

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
   * Save or update an incident
   */
  public static async saveIncident(
    record: IncidentRecord,
    user: UserProfile
  ): Promise<void> {
    const isNew = !record.id || record.id.startsWith('temp-');
    const id = isNew ? `inc-${record.tanggal}-${Date.now()}` : record.id;

    const payload: IncidentRecord = {
      ...record,
      id,
      dataSource: 'PRODUCTION',
      isDemo: false,
      updatedAt: new Date().toISOString(),
      updatedBy: user.fullName,
      createdAt: record.createdAt || new Date().toISOString(),
      createdBy: record.createdBy || user.fullName,
    };

    await FirestoreService.setDocument('incidents', id, payload);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: isNew ? 'CREATE' : 'UPDATE',
      module: 'INCIDENTS',
      recordId: id,
      details: `${isNew ? 'Melaporkan' : 'Memperbarui'} kejadian: [${payload.kategori}] ${payload.uraian.substring(0, 40)}... (${payload.tingkatKeparahan})`,
    });
  }

  /**
   * Update status of an incident
   */
  public static async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    user: UserProfile,
    resolutionNote?: string
  ): Promise<void> {
    const existing = await FirestoreService.getById<IncidentRecord>('incidents', incidentId);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: IncidentRecord = {
      ...existing,
      status: newStatus,
      updatedAt: now,
      updatedBy: user.fullName,
    };

    if (newStatus === 'SELESAI') {
      updated.resolvedAt = now;
      updated.resolvedBy = user.fullName;
      if (resolutionNote) updated.resolutionNote = resolutionNote;
    }

    await FirestoreService.setDocument('incidents', incidentId, updated);
    await FirestoreService.logAudit({
      userId: user.id,
      userName: user.fullName,
      role: user.role,
      action: 'STATUS_CHANGE',
      module: 'INCIDENTS',
      recordId: incidentId,
      details: `Mengubah status kejadian ID ${incidentId} menjadi ${newStatus}${resolutionNote ? ` (Catatan: ${resolutionNote})` : ''}`,
    });
  }

  /**
   * Delete an incident
   */
  public static async deleteIncident(incidentId: string, user: UserProfile): Promise<void> {
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
  }
}
