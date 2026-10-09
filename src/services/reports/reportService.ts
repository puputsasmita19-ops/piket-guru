import { ScheduleItem, AttendanceRecord, isOperationalRecord } from '../../types';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { IncidentRecord } from '../../types/incident.types';
import { TeacherRecord, IncidentCategoryRecord } from '../../types/master.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';

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

export interface StudentTardySummary {
  totalTardy: number;
  repeatOffenders: number; // frekuensi > 1
  totalPoints: number;
  avgMinutesTardy: number;
  reasonBreakdown: Record<string, number>;
  actionBreakdown: Record<string, number>;
  classBreakdown: Record<string, number>;
}

export interface StudentPermitSummary {
  totalPermits: number;
  currentlyOut: number;
  returned: number;
  leftSchool: number;
  typeBreakdown: Record<string, number>;
  classBreakdown: Record<string, number>;
}

export interface SubstitutionSummary {
  totalSubstitutions: number;
  completed: number;
  inProgress: number;
  pending: number;
  reasonBreakdown: Record<string, number>;
  topSubstitutedTeachers: Array<{ name: string; count: number }>;
}

export interface VisitorSummary {
  totalVisitors: number;
  currentlyVisiting: number;
  completed: number;
  rejected: number;
  categoryBreakdown: Record<string, number>;
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
    const operationalTeachers = teachers.filter(isOperationalRecord);
    const operationalAttendance = attendance.filter(isOperationalRecord);

    const filteredAttendance = operationalAttendance.filter(
      (a) => a.tanggal >= startDate && a.tanggal <= endDate
    );

    const operationalSchedules = schedules.filter(isOperationalRecord);
    const filteredSchedules = operationalSchedules.filter(
      (s) => s.tanggal >= startDate && s.tanggal <= endDate
    );

    return operationalTeachers.map((teacher) => {
      // Find all schedules and attendances for this teacher within the period
      const teacherSchedules = filteredSchedules.filter(
        (s) => s.petugasId === teacher.id || (s.petugasName && s.petugasName.includes(teacher.fullName.split(' ')[0]))
      );

      const teacherAtts = filteredAttendance.filter(
        (a) => a.userId === teacher.id || (a.userName && a.userName.includes(teacher.fullName.split(' ')[0]))
      );

      const hadirCount = teacherAtts.filter((a) => a.status === 'DALAM_LOKASI').length;
      const outsideCount = teacherAtts.filter((a) => a.status === 'DI_LUAR_LOKASI' || a.status === 'AKURASI_RENDAH').length;
      const totalRecorded = hadirCount + outsideCount;
      const totalShift = teacherSchedules.length > 0 ? teacherSchedules.length : Math.max(totalRecorded, 1);
      const tidakHadir = Math.max(0, totalShift - totalRecorded);

      const percentage = totalShift > 0 ? Math.min(100, Math.round((hadirCount / totalShift) * 100)) : 100;

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
    const operationalIncidents = incidents.filter(isOperationalRecord);
    const filtered = operationalIncidents.filter((i) => i.tanggal >= startDate && i.tanggal <= endDate);

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

  /**
   * Aggregates Student Tardiness metrics
   */
  public static getStudentTardyAnalytics(
    records: StudentTardyRecord[],
    startDate: string,
    endDate: string
  ): StudentTardySummary {
    const operationalRecords = records.filter(isOperationalRecord);
    const filtered = operationalRecords.filter((r) => r.tanggal >= startDate && r.tanggal <= endDate);
    const totalTardy = filtered.length;
    const repeatOffenders = filtered.filter((r) => (r.frekuensiBulanIni || 1) > 1).length;
    const totalPoints = filtered.reduce((acc, curr) => acc + (curr.poinPelanggaran || 0), 0);
    const totalMinutes = filtered.reduce((acc, curr) => acc + (curr.menitTerlambat || 0), 0);
    const avgMinutesTardy = totalTardy > 0 ? Math.round(totalMinutes / totalTardy) : 0;

    const reasonBreakdown: Record<string, number> = {};
    const actionBreakdown: Record<string, number> = {};
    const classBreakdown: Record<string, number> = {};

    filtered.forEach((r) => {
      reasonBreakdown[r.alasan] = (reasonBreakdown[r.alasan] || 0) + 1;
      actionBreakdown[r.pembinaan] = (actionBreakdown[r.pembinaan] || 0) + 1;
      if (r.kelas) {
        classBreakdown[r.kelas] = (classBreakdown[r.kelas] || 0) + 1;
      }
    });

    return {
      totalTardy,
      repeatOffenders,
      totalPoints,
      avgMinutesTardy,
      reasonBreakdown,
      actionBreakdown,
      classBreakdown,
    };
  }

  /**
   * Aggregates Student Permits metrics
   */
  public static getStudentPermitAnalytics(
    records: StudentPermitRecord[],
    startDate: string,
    endDate: string
  ): StudentPermitSummary {
    const operationalRecords = records.filter(isOperationalRecord);
    const filtered = operationalRecords.filter((r) => r.tanggal >= startDate && r.tanggal <= endDate);
    const totalPermits = filtered.length;
    const currentlyOut = filtered.filter((r) => r.status === 'SEDANG_KELUAR').length;
    const returned = filtered.filter((r) => r.status === 'SUDAH_KEMBALI').length;
    const leftSchool = filtered.filter((r) => r.status === 'SELESAI_PULANG').length;

    const typeBreakdown: Record<string, number> = {};
    const classBreakdown: Record<string, number> = {};

    filtered.forEach((r) => {
      typeBreakdown[r.jenisIzin] = (typeBreakdown[r.jenisIzin] || 0) + 1;
      if (r.kelas) {
        classBreakdown[r.kelas] = (classBreakdown[r.kelas] || 0) + 1;
      }
    });

    return {
      totalPermits,
      currentlyOut,
      returned,
      leftSchool,
      typeBreakdown,
      classBreakdown,
    };
  }

  /**
   * Aggregates Teacher Substitution metrics
   */
  public static getSubstitutionAnalytics(
    records: TeacherSubstitutionRecord[],
    startDate: string,
    endDate: string
  ): SubstitutionSummary {
    const operationalRecords = records.filter(isOperationalRecord);
    const filtered = operationalRecords.filter((r) => r.tanggal >= startDate && r.tanggal <= endDate);
    const totalSubstitutions = filtered.length;
    const completed = filtered.filter((r) => r.status === 'SELESAI_INVAL').length;
    const inProgress = filtered.filter((r) => r.status === 'SEDANG_BERLANGSUNG').length;
    const pending = filtered.filter((r) => r.status === 'MENUNGGU_GURU_INVAL' || r.status === 'TERTUGASKAN').length;

    const reasonBreakdown: Record<string, number> = {};
    const teacherCountMap: Record<string, number> = {};

    filtered.forEach((r) => {
      reasonBreakdown[r.alasan] = (reasonBreakdown[r.alasan] || 0) + 1;
      if (r.guruBerhalanganName) {
        teacherCountMap[r.guruBerhalanganName] = (teacherCountMap[r.guruBerhalanganName] || 0) + 1;
      }
    });

    const topSubstitutedTeachers = Object.entries(teacherCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSubstitutions,
      completed,
      inProgress,
      pending,
      reasonBreakdown,
      topSubstitutedTeachers,
    };
  }

  /**
   * Aggregates Visitor metrics
   */
  public static getVisitorAnalytics(
    records: VisitorRecord[],
    startDate: string,
    endDate: string
  ): VisitorSummary {
    const operationalRecords = records.filter(isOperationalRecord);
    const filtered = operationalRecords.filter((r) => r.tanggal >= startDate && r.tanggal <= endDate);
    const totalVisitors = filtered.length;
    const currentlyVisiting = filtered.filter((r) => r.status === 'SEDANG_BERKUNJUNG').length;
    const completed = filtered.filter((r) => r.status === 'SELESAI').length;
    const rejected = filtered.filter((r) => r.status === 'DITOLAK').length;

    const categoryBreakdown: Record<string, number> = {};
    filtered.forEach((r) => {
      categoryBreakdown[r.kategori] = (categoryBreakdown[r.kategori] || 0) + 1;
    });

    return {
      totalVisitors,
      currentlyVisiting,
      completed,
      rejected,
      categoryBreakdown,
    };
  }
}
