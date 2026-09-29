import { ScheduleItem, AttendanceRecord } from '../../types';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { IncidentRecord } from '../../types/incident.types';
import { TeacherRecord, IncidentCategoryRecord } from '../../types/master.types';

export interface TeacherAttendanceSummary {
  teacherId: string;
  nip: string;
  fullName: string;
  totalShift: number;
  hadir: number;
  terlambatOrOutside: number;
  tidakHadir: number;
  percentage: number;
}

export interface IncidentCategorySummary {
  categoryCode: string;
  categoryName: string;
  total: number;
  kritis: number;
  selesai: number;
  penanganan: number;
}

export class ReportService {
  /**
   * Calculates attendance summary aggregated by teacher
   */
  public static getTeacherAttendanceSummary(
    schedules: ScheduleItem[],
    attendance: AttendanceRecord[],
    teachers: TeacherRecord[],
    startDate: string,
    endDate: string
  ): TeacherAttendanceSummary[] {
    const filteredAttendance = attendance.filter(
      (a) => a.tanggal >= startDate && a.tanggal <= endDate
    );

    return teachers.map((teacher) => {
      // Find all attendances for this teacher
      const teacherAtts = filteredAttendance.filter(
        (a) => a.userId === teacher.id || a.userName.includes(teacher.fullName.split(' ')[0])
      );

      const hadirCount = teacherAtts.filter((a) => a.status === 'DALAM_LOKASI').length;
      const outsideCount = teacherAtts.filter((a) => a.status === 'DI_LUAR_LOKASI' || a.status === 'AKURASI_RENDAH').length;
      const totalRecorded = hadirCount + outsideCount;
      const totalShift = Math.max(totalRecorded, 4); // Minimum expected baseline for month
      const tidakHadir = Math.max(0, totalShift - totalRecorded);

      const percentage = totalShift > 0 ? Math.round((hadirCount / totalShift) * 100) : 100;

      return {
        teacherId: teacher.id,
        nip: teacher.nip,
        fullName: teacher.fullName,
        totalShift,
        hadir: hadirCount,
        terlambatOrOutside: outsideCount,
        tidakHadir,
        percentage,
      };
    });
  }

  /**
   * Calculates incident statistics by category
   */
  public static getIncidentCategorySummary(
    incidents: IncidentRecord[],
    categories: IncidentCategoryRecord[],
    startDate: string,
    endDate: string
  ): IncidentCategorySummary[] {
    const filtered = incidents.filter((i) => i.tanggal >= startDate && i.tanggal <= endDate);

    return categories.map((cat) => {
      const catIncidents = filtered.filter((i) => i.kategori === cat.code);
      return {
        categoryCode: cat.code,
        categoryName: cat.name,
        total: catIncidents.length,
        kritis: catIncidents.filter((i) => i.tingkatKeparahan === 'KRITIS' || i.tingkatKeparahan === 'TINGGI').length,
        selesai: catIncidents.filter((i) => i.status === 'SELESAI').length,
        penanganan: catIncidents.filter((i) => i.status !== 'SELESAI').length,
      };
    });
  }
}
