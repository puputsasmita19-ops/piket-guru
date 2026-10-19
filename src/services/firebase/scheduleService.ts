import { FirestoreService } from './firestoreService';
import { auth, db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { OfflineStorage } from '../offline/offlineStorage';
import { operationalEventFromAudit } from '../../types/notification.types';
import { schedulePeriodsOverlap, scheduleSlotId, getScheduleRecurrence } from '../../utils/scheduleUtils';
import { DAYS_LIST } from '../../config/constants';
import { getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import { ScheduleItem, DayOfWeek, ScheduleStatus, UserProfile, UserRole } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';

export class ScheduleService {
  /**
   * Updates an existing schedule strictly preserving the same ID and existing metadata.
   * Resolves officer and room details from authoritative server/master data.
   * Rejects if the document does not exist (prevents reviving deleted schedules or creating duplicates).
   */
  public static async updateSchedule(
    id: string,
    payload: {
      hari: DayOfWeek;
      tanggal: string;
      jamMulai: string;
      jamSelesai: string;
      petugasId: string;
      ruangId: string;
      status: ScheduleStatus;
      keterangan?: string;
    },
    users: UserProfile[],
    rooms: RoomRecord[],
    actor: { id: string; name: string; role: UserRole }
  ): Promise<ScheduleItem> {
    const existing = await FirestoreService.getById<ScheduleItem>('schedules', id);
    if (!existing) {
      throw new Error('Jadwal piket tidak ditemukan atau telah dihapus sebelumnya. Pembaruan dibatalkan.');
    }

    // Resolve authoritative user and room from server master records
    const targetUser = users.find((u) => u.id === payload.petugasId);
    if (!targetUser) {
      throw new Error('Petugas yang dipilih tidak ditemukan dalam daftar pengguna aktif.');
    }
    if (targetUser.isActive === false) {
      throw new Error('Petugas yang dipilih sedang berstatus nonaktif.');
    }

    const targetRoom = rooms.find((r) => r.id === payload.ruangId);
    if (!targetRoom) {
      throw new Error('Pos/ruangan yang dipilih tidak valid.');
    }

    const nowIso = new Date().toISOString();
    const updated: ScheduleItem = {
      ...existing,
      id,
      hari: payload.hari,
      tanggal: payload.tanggal,
      jamMulai: payload.jamMulai,
      jamSelesai: payload.jamSelesai,
      petugasId: targetUser.id,
      petugasName: targetUser.fullName,
      petugasRole: targetUser.role,
      ruangId: targetRoom.id,
      ruangName: targetRoom.name,
      status: payload.status,
      keterangan: payload.keterangan || '',
      updatedAt: nowIso,
    };

    await FirestoreService.setDocument('schedules', id, updated);

    await FirestoreService.logAudit({
      userId: actor.id,
      userName: actor.name,
      role: actor.role,
      action: 'UPDATE',
      module: 'SCHEDULES',
      recordId: id,
      details: `Memperbarui jadwal piket: ${updated.petugasName} (${updated.hari} di ${updated.ruangName})`,
    });

    return updated;
  }

  /** Multiple officers may share a post. Only an officer's overlapping duties conflict. */
  public static checkConflict(
    newSchedule: { id?: string; hari: DayOfWeek; tanggal?: string; recurrence?: 'WEEKLY' | 'ONCE'; jamMulai: string; jamSelesai: string; petugasId: string; ruangId: string },
    existingSchedules: ScheduleItem[]
  ): { hasConflict: boolean; reason?: string } {
    for (const item of existingSchedules) {
      if ((newSchedule.id && item.id === newSchedule.id) || item.status === 'DIBATALKAN' || item.petugasId !== newSchedule.petugasId) continue;
      if (schedulePeriodsOverlap({ ...newSchedule, tanggal: newSchedule.tanggal || '' }, item) &&
          newSchedule.jamMulai < item.jamSelesai && newSchedule.jamSelesai > item.jamMulai) {
        return { hasConflict: true, reason: `Petugas "${item.petugasName}" sudah dijadwalkan ${getScheduleRecurrence(item) === 'ONCE' ? item.tanggal : 'setiap ' + item.hari} (${item.jamMulai} - ${item.jamSelesai}) di ${item.ruangName}. Ubah jadwal yang sudah ada atau pilih jam lain.` };
      }
    }
    return { hasConflict: false };
  }

  /** One transaction saves all selected days/officers and its audit, or saves none. */
  public static async createSchedules(schedules: ScheduleItem[], actor: UserProfile): Promise<void> {
    if (!schedules.length || schedules.length > 400) throw new Error('Pilih 1–400 jadwal dalam satu penyimpanan.');
    if (actor.role !== 'ADMIN' || actor.isActive === false || auth.currentUser?.uid !== actor.id) throw new Error('Hanya administrator aktif yang dapat mengatur jadwal.');
    const uid = actor.id;
    let active = true;
    const release = OfflineStorage.registerListener(() => { active = false; });
    const assertSession = () => {
      if (!active || auth.currentUser?.uid !== uid) throw new Error('Sesi berubah. Buka kembali formulir jadwal.');
    };
    try {
      assertSession();
      for (const item of schedules) {
        const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!validTime.test(item.jamMulai) || !validTime.test(item.jamSelesai) || item.jamMulai >= item.jamSelesai) throw new Error('Jam selesai harus setelah jam mulai.');
        if (!DAYS_LIST.includes(item.hari)) throw new Error('Hari jadwal tidak valid.');
        if (!item.petugasId || !item.ruangId) throw new Error('Petugas dan pos piket wajib dipilih.');
        if (getScheduleRecurrence(item) === 'ONCE' && (!/^\d{4}-\d{2}-\d{2}$/.test(item.tanggal) || getTodayISODate(`${item.tanggal}T12:00:00+07:00`) !== item.tanggal || getCurrentDayName(`${item.tanggal}T12:00:00+07:00`) !== item.hari)) throw new Error('Tanggal dan hari jadwal tidak sesuai.');
      }
      const ids = schedules.map(scheduleSlotId);
      if (new Set(ids).size !== ids.length) throw new Error('Terdapat pilihan jadwal ganda dalam formulir.');
      const latest = await FirestoreService.getAllStrict<ScheduleItem>('schedules');
      assertSession();
      schedules.forEach((item, i) => {
        const check = this.checkConflict({ ...item, id: ids[i] }, [...latest, ...schedules.slice(0, i)]);
        if (item.status !== 'DIBATALKAN' && check.hasConflict) throw new Error(check.reason);
      });
      const refs = ids.map(id => doc(db, 'schedules', id));
      const officerIds = [...new Set(schedules.map(s => s.petugasId))];
      const roomIds = [...new Set(schedules.map(s => s.ruangId))];
      const now = new Date().toISOString();
      const auditId = `audit-schedule-${crypto.randomUUID()}`;
      const audit = { id: auditId, timestamp: now, userId: uid, userName: actor.fullName, role: actor.role,
        action: 'CREATE' as const, module: 'SCHEDULES' as const, status: 'SUCCESS' as const,
        recordId: ids[0], target: 'Jadwal piket', details: `Menambahkan ${schedules.length} jadwal piket: ${[...new Set(schedules.map(s => s.hari))].join(', ')}.` };
      await runTransaction(db, async transaction => {
        assertSession();
        const existing = await Promise.all(refs.map(ref => transaction.get(ref)));
        const officers = await Promise.all(officerIds.map(id => transaction.get(doc(db, 'users', id))));
        const rooms = await Promise.all(roomIds.map(id => transaction.get(doc(db, 'rooms', id))));
        assertSession();
        if (existing.some(s => s.exists())) throw new Error('Jadwal ini sudah tersimpan. Muat data terbaru lalu gunakan menu Ubah Jadwal bila ingin memperbaruinya.');
        if (officers.some(s => !s.exists() || s.data()?.isActive === false)) throw new Error('Ada petugas yang sudah dihapus atau dinonaktifkan. Periksa kembali pilihan.');
        if (rooms.some(s => !s.exists() || s.data()?.isActive === false)) throw new Error('Ada pos yang sudah dihapus atau dinonaktifkan. Periksa kembali pilihan.');
        schedules.forEach((item, i) => {
          const officer = officers[officerIds.indexOf(item.petugasId)].data()!;
          const room = rooms[roomIds.indexOf(item.ruangId)].data()!;
          transaction.set(refs[i], FirestoreService.sanitizeFirestorePayload({ ...item, id: ids[i],
            petugasName: officer.fullName, petugasRole: officer.role, ruangName: room.name,
            recurrence: getScheduleRecurrence(item), tanggal: getScheduleRecurrence(item) === 'ONCE' ? item.tanggal : '',
            createdAt: now, updatedAt: now, updatedBy: uid, dataSource: 'PRODUCTION', isDemo: false }));
        });
        transaction.set(doc(db, 'auditLogs', auditId), audit);
      });
      const event = operationalEventFromAudit(audit);
      if (event) void import('../notifications/notificationPublisher').then(m => m.publishNotificationEvent(event)).catch(() => {});
    } finally { release(); }
  }

  /**
   * Automatic demo schedule seeding is disabled in production to protect data integrity.
   */
  public static async bootstrapIfEmpty(teachers: TeacherRecord[], rooms: RoomRecord[]): Promise<void> {
    // No-op in operational mode: empty database remains clean for official school schedules
    return;
  }

  /**
   * Explicit demo schedules seeder for development/testing environments
   */
  public static async seedDemoSchedules(teachers: TeacherRecord[], rooms: RoomRecord[]): Promise<void> {
    const existing = await FirestoreService.getAllRaw<ScheduleItem>('schedules');
    if (existing.length === 0 && teachers.length > 0 && rooms.length > 0) {
      const todayISO = new Date().toISOString().split('T')[0];

      const seedSchedules: ScheduleItem[] = [
        {
          id: 'sch-001',
          tanggal: todayISO,
          hari: 'SENIN',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: teachers[0]?.id || 'tch-01',
          petugasName: teachers[0]?.fullName || 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasRole: 'GURU',
          ruangId: rooms[0]?.id || 'room-01',
          ruangName: rooms[0]?.name || 'Pos Utama & Gerbang Depan',
          status: 'BERJALAN',
          keterangan: 'Piket Gerbang Pagi & Penerimaan Tamu',
          dataSource: 'SEED',
          isDemo: true,
        },
        {
          id: 'sch-002',
          tanggal: todayISO,
          hari: 'SENIN',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: teachers[1]?.id || 'tch-02',
          petugasName: teachers[1]?.fullName || 'Siti Nurhaliza, S.Pd.',
          petugasRole: 'GURU',
          ruangId: rooms[1]?.id || 'room-02',
          ruangName: rooms[1]?.name || 'Gedung A (Lantai 1 - Kelas X)',
          status: 'BERJALAN',
          keterangan: 'Pengawasan KBM Kelas X & Koridor Depan',
          dataSource: 'SEED',
          isDemo: true,
        },
        {
          id: 'sch-003',
          tanggal: todayISO,
          hari: 'SENIN',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: teachers[2]?.id || 'tch-03',
          petugasName: teachers[2]?.fullName || 'Budi Santoso, M.Kom.',
          petugasRole: 'GURU',
          ruangId: rooms[2]?.id || 'room-02',
          ruangName: rooms[2]?.name || 'Gedung B (Lab & Perpustakaan)',
          status: 'BERJALAN',
          keterangan: 'Monitoring Lab Komputer dan Perpustakaan',
          dataSource: 'SEED',
          isDemo: true,
        },
        {
          id: 'sch-004',
          tanggal: todayISO,
          hari: 'SELASA',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: teachers[0]?.id || 'tch-01',
          petugasName: teachers[0]?.fullName || 'Drs. H. Ahmad Fauzi, M.Pd.',
          petugasRole: 'GURU',
          ruangId: rooms[1]?.id || 'room-02',
          ruangName: rooms[1]?.name || 'Gedung A (Lantai 1 - Kelas X)',
          status: 'TERJADWAL',
          dataSource: 'SEED',
          isDemo: true,
        },
        {
          id: 'sch-005',
          tanggal: todayISO,
          hari: 'RABU',
          jamMulai: '06:30',
          jamSelesai: '15:30',
          petugasId: teachers[1]?.id || 'tch-02',
          petugasName: teachers[1]?.fullName || 'Siti Nurhaliza, S.Pd.',
          petugasRole: 'GURU',
          ruangId: rooms[0]?.id || 'room-01',
          ruangName: rooms[0]?.name || 'Pos Utama & Gerbang Depan',
          status: 'TERJADWAL',
          dataSource: 'SEED',
          isDemo: true,
        },
      ];

      for (const s of seedSchedules) {
        await FirestoreService.setDocument('schedules', s.id, s);
      }
    }
  }
}
