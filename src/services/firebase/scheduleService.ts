import { FirestoreService } from './firestoreService';
import { ScheduleItem, DayOfWeek, ScheduleStatus } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';

export class ScheduleService {
  /**
   * Check for schedule conflicts:
   * 1. Same teacher assigned at same day/date with overlapping hours
   * 2. Same room assigned at same day/date with overlapping hours
   */
  public static checkConflict(
    newSchedule: {
      id?: string;
      hari: DayOfWeek;
      tanggal?: string;
      jamMulai: string;
      jamSelesai: string;
      petugasId: string;
      ruangId: string;
    },
    existingSchedules: ScheduleItem[]
  ): { hasConflict: boolean; reason?: string } {
    for (const item of existingSchedules) {
      if (newSchedule.id && item.id === newSchedule.id) continue;
      if (item.status === 'DIBATALKAN') continue;

      // If both schedules specify a specific calendar date, conflict occurs only if dates match exactly.
      // If either schedule does not specify a specific date (recurring day template), then check day of week match.
      const hasSpecificDates = Boolean(newSchedule.tanggal && item.tanggal);
      const isDateMatching = hasSpecificDates
        ? item.tanggal === newSchedule.tanggal
        : item.hari === newSchedule.hari;

      if (isDateMatching) {
        // Check time overlap: (StartA < EndB) and (EndA > StartB)
        const isTimeOverlap =
          newSchedule.jamMulai < item.jamSelesai && newSchedule.jamSelesai > item.jamMulai;

        if (isTimeOverlap) {
          const dateLabel = item.tanggal ? `tanggal ${item.tanggal}` : `hari ${item.hari}`;
          if (item.petugasId === newSchedule.petugasId) {
            return {
              hasConflict: true,
              reason: `Petugas "${item.petugasName}" sudah memiliki jadwal piket pada ${dateLabel} (${item.jamMulai} - ${item.jamSelesai}) di ${item.ruangName}.`,
            };
          }

          if (item.ruangId === newSchedule.ruangId) {
            return {
              hasConflict: true,
              reason: `Pos/Ruangan "${item.ruangName}" sudah dialokasikan untuk ${item.petugasName} pada ${dateLabel} (${item.jamMulai} - ${item.jamSelesai}).`,
            };
          }
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * Seed default schedules if empty
   */
  public static async bootstrapIfEmpty(teachers: TeacherRecord[], rooms: RoomRecord[]): Promise<void> {
    const existing = await FirestoreService.getAll<ScheduleItem>('schedules');
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
        },
      ];

      for (const s of seedSchedules) {
        await FirestoreService.setDocument('schedules', s.id, s);
      }
    }
  }
}
