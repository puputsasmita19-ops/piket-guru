import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart2,
  Calendar,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Users,
  BookOpenCheck,
  Search,
  Filter,
  TrendingUp,
  UserX,
  FileText,
  UserCheck,
  Building,
  GraduationCap,
  Clock,
  ShieldAlert,
  CalendarRange,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MonthlyReportPrintModal } from './MonthlyReportPrintModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import {
  ReportService,
  TeacherAttendanceSummary,
  IncidentCategorySummary,
  StudentTardySummary,
  StudentPermitSummary,
  SubstitutionSummary,
  VisitorSummary,
} from '../../services/reports/reportService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import {
  ScheduleItem,
  AttendanceRecord,
  SchoolSettings,
} from '../../types';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { IncidentRecord, getIncidentCategoryDisplay } from '../../types/incident.types';
import { TeacherRecord, IncidentCategoryRecord } from '../../types/master.types';
import { StudentTardyRecord, getTardyReasonDisplay, getDisciplineActionDisplay } from '../../types/studentTardy.types';
import { StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord, getSubstitutionReasonDisplay } from '../../types/substitution.types';
import { VisitorRecord, getVisitorCategoryDisplay } from '../../types/visitor.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';
import {
  ReportPeriodMode,
  INDONESIAN_MONTHS,
  getWeeklyPeriod,
  getMonthlyPeriod,
  getSemesterPeriod,
  getYearlyPeriod,
  validateDateRange,
  formatISODate,
} from '../../utils/reportPeriodUtils';

type ReportTab =
  | 'attendance'
  | 'incidents'
  | 'dutyBooks'
  | 'studentTardiness'
  | 'studentPermits'
  | 'substitutions'
  | 'visitors';

export const ReportsPreview: React.FC = () => {
  const { currentUser } = useAuth();

  // Primary Collections
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);
  const [studentTardiness, setStudentTardiness] = useState<StudentTardyRecord[]>([]);
  const [studentPermits, setStudentPermits] = useState<StudentPermitRecord[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  // Period Mode State: 'monthly' | 'weekly' | 'semester' | 'yearly' | 'custom'
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('monthly');

  // Sub-inputs for each mode
  const [weeklyRefDate, setWeeklyRefDate] = useState<string>(() => getTodayISODate());
  const [monthlyYear, setMonthlyYear] = useState<number>(() => new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [semesterAcademicYear, setSemesterAcademicYear] = useState<string>(
    () => DEFAULT_SCHOOL_SETTINGS.academicSemester?.academicYear || '2026/2027'
  );
  const [semesterType, setSemesterType] = useState<'GANJIL' | 'GENAP'>('GANJIL');
  const [yearlyYear, setYearlyYear] = useState<number>(() => new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Subscriptions to all operational collections
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) {
        setSettings(data);
        if (data.academicSemester?.academicYear) {
          setSemesterAcademicYear(data.academicSemester.academicYear);
        }
      }
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', setAttendanceList);
    const unsubBooks = FirestoreService.subscribeToCollection<DutyBookRecord>('dutyBooks', setDutyBooks);
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>('incidents', setIncidents);
    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubCats = FirestoreService.subscribeToCollection<IncidentCategoryRecord>('incidentCategories', setCategories);
    const unsubTardy = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setStudentTardiness);
    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setStudentPermits);
    const unsubSubs = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', setSubstitutions);
    const unsubVisitors = FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors);

    return () => {
      unsubSched();
      unsubAtt();
      unsubBooks();
      unsubInc();
      unsubTeachers();
      unsubCats();
      unsubTardy();
      unsubPermits();
      unsubSubs();
      unsubVisitors();
    };
  }, []);

  // Compute Active Date Range & Period Description based on periodMode
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (periodMode === 'weekly') {
      const res = getWeeklyPeriod(weeklyRefDate);
      return {
        startDate: res.startDate,
        endDate: res.endDate,
        periodLabel: res.label,
      };
    } else if (periodMode === 'monthly') {
      const res = getMonthlyPeriod(monthlyYear, monthlyMonth);
      return {
        startDate: res.startDate,
        endDate: res.endDate,
        periodLabel: res.label,
      };
    } else if (periodMode === 'semester') {
      const res = getSemesterPeriod(semesterAcademicYear, semesterType, settings);
      return {
        startDate: res.startDate,
        endDate: res.endDate,
        periodLabel: `${res.label} (${formatIndonesianDate(res.startDate)} s.d ${formatIndonesianDate(res.endDate)})`,
      };
    } else if (periodMode === 'yearly') {
      const res = getYearlyPeriod(yearlyYear);
      return {
        startDate: res.startDate,
        endDate: res.endDate,
        periodLabel: `Tahun Kalender ${yearlyYear} (${formatIndonesianDate(res.startDate)} s.d ${formatIndonesianDate(res.endDate)})`,
      };
    } else {
      // custom
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        periodLabel: `${formatIndonesianDate(customStartDate)} s.d ${formatIndonesianDate(customEndDate)}`,
      };
    }
  }, [
    periodMode,
    weeklyRefDate,
    monthlyYear,
    monthlyMonth,
    semesterAcademicYear,
    semesterType,
    yearlyYear,
    customStartDate,
    customEndDate,
    settings,
  ]);

  const dateValidation = validateDateRange(startDate, endDate);

  // Aggregated Summaries
  const attendanceSummaries = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return ReportService.getTeacherAttendanceSummary(
      schedules,
      attendanceList,
      teachers,
      startDate,
      endDate
    );
  }, [schedules, attendanceList, teachers, startDate, endDate, dateValidation.isValid]);

  const incidentSummaries = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return ReportService.getIncidentCategorySummary(
      incidents,
      categories,
      startDate,
      endDate
    );
  }, [incidents, categories, startDate, endDate, dateValidation.isValid]);

  const filteredIncidents = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return incidents.filter(
      (i) =>
        i.tanggal >= startDate &&
        i.tanggal <= endDate &&
        (searchQuery === '' ||
          i.uraian?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.lokasi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getIncidentCategoryDisplay(i).toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.kategoriName?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [incidents, startDate, endDate, searchQuery, dateValidation.isValid]);

  const totalIncidents = filteredIncidents.length;
  const resolvedIncidents = filteredIncidents.filter((i) => i.status === 'SELESAI').length;

  const filteredDutyBooks = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return dutyBooks.filter(
      (b) =>
        b.tanggal >= startDate &&
        b.tanggal <= endDate &&
        (searchQuery === '' ||
          b.petugasName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.ruangName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.catatanPiket?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [dutyBooks, startDate, endDate, searchQuery, dateValidation.isValid]);

  // Analytics & Filtered Collections
  const tardyAnalytics = useMemo(() => {
    if (!dateValidation.isValid) return { totalTardy: 0, byClass: {}, byReason: {} };
    return ReportService.getStudentTardyAnalytics(studentTardiness, startDate, endDate);
  }, [studentTardiness, startDate, endDate, dateValidation.isValid]);

  const filteredTardiness = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return studentTardiness.filter(
      (r) =>
        r.tanggal >= startDate &&
        r.tanggal <= endDate &&
        (searchQuery === '' ||
          r.namaSiswa?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.nisn?.includes(searchQuery) ||
          r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getTardyReasonDisplay(r).toLowerCase().includes(searchQuery.toLowerCase()) ||
          getDisciplineActionDisplay(r).toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.alasan?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [studentTardiness, startDate, endDate, searchQuery, dateValidation.isValid]);

  const permitAnalytics = useMemo(() => {
    if (!dateValidation.isValid) return { totalPermits: 0, byType: {}, byClass: {} };
    return ReportService.getStudentPermitAnalytics(studentPermits, startDate, endDate);
  }, [studentPermits, startDate, endDate, dateValidation.isValid]);

  const filteredPermits = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return studentPermits.filter(
      (r) =>
        r.tanggal >= startDate &&
        r.tanggal <= endDate &&
        (searchQuery === '' ||
          r.namaSiswa?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getStudentPermitTypeDisplay(r).toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.alasan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.penjemput?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [studentPermits, startDate, endDate, searchQuery, dateValidation.isValid]);

  const substitutionAnalytics = useMemo(() => {
    if (!dateValidation.isValid) return { totalSubstitutions: 0, completed: 0, inProgress: 0, pending: 0 };
    return ReportService.getSubstitutionAnalytics(substitutions, startDate, endDate);
  }, [substitutions, startDate, endDate, dateValidation.isValid]);

  const filteredSubstitutions = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return substitutions.filter(
      (r) =>
        r.tanggal >= startDate &&
        r.tanggal <= endDate &&
        (searchQuery === '' ||
          r.guruBerhalanganName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.guruPenggantiName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.mataPelajaran?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getSubstitutionReasonDisplay(r).toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [substitutions, startDate, endDate, searchQuery, dateValidation.isValid]);

  const visitorAnalytics = useMemo(() => {
    if (!dateValidation.isValid) return { totalVisitors: 0, currentlyVisiting: 0, completed: 0, rejected: 0 };
    return ReportService.getVisitorAnalytics(visitors, startDate, endDate);
  }, [visitors, startDate, endDate, dateValidation.isValid]);

  const filteredVisitors = useMemo(() => {
    if (!dateValidation.isValid) return [];
    return visitors.filter(
      (r) =>
        r.tanggal >= startDate &&
        r.tanggal <= endDate &&
        (searchQuery === '' ||
          r.namaTamu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.instansiAsal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getVisitorCategoryDisplay(r).toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.tujuanBertemu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.keperluan?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [visitors, startDate, endDate, searchQuery, dateValidation.isValid]);

  // --- EXPORT TO CSV / EXCEL HANDLERS ---
  const handleExportAttendanceCsv = async () => {
    const headers = ['No', 'NIP', 'Nama Guru', 'Mata Pelajaran', 'Total Shift', 'Hadir (GPS)', 'Luar Radius', 'Tidak Hadir', 'Persentase'];
    const rows = attendanceSummaries.map((s, idx) => [
      idx + 1,
      `'${s.nip}`,
      s.fullName,
      teachers.find((t) => t.id === s.teacherId)?.mataPelajaran || '-',
      s.totalShift,
      s.hadir,
      s.terlambatOrOutside,
      s.tidakHadir,
      `${s.percentage}%`,
    ]);

    ExportUtils.exportToCsv(`Rekap_Kehadiran_Piket_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'REPORTS',
      details: `Mengekspor data rekapitulasi kehadiran guru piket ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportIncidentsCsv = async () => {
    const headers = ['ID Insiden', 'Tanggal', 'Waktu', 'Kategori', 'Tingkat', 'Lokasi', 'Pihak Terlibat', 'Uraian Kronologis', 'Tindakan Awal', 'Status', 'Petugas'];
    const rows = filteredIncidents.map((i) => [
      i.id,
      i.tanggal,
      i.waktu,
      getIncidentCategoryDisplay(i),
      i.tingkatKeparahan,
      i.lokasi,
      i.pihakTerlibat,
      i.uraian,
      i.tindakanAwal,
      i.status,
      i.penanggungJawab,
    ]);

    ExportUtils.exportToCsv(`Rekap_Kejadian_Insiden_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'REPORTS',
      details: `Mengekspor rekapitulasi data insiden kejadian ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportDutyBooksCsv = async () => {
    const headers = ['ID Buku Piket', 'Tanggal', 'Hari', 'Jam Tugas', 'Petugas Piket', 'Ruang/Pos', 'Kondisi Keamanan', 'Kondisi Kebersihan', 'Kondisi Siswa', 'Catatan Piket', 'Tindak Lanjut', 'Status'];
    const rows = filteredDutyBooks.map((b) => [
      b.id,
      b.tanggal,
      b.hari,
      `${b.jamMulai} - ${b.jamSelesai}`,
      b.petugasName,
      b.ruangName,
      b.kondisiKeamanan || '-',
      b.kondisiKebersihan || '-',
      b.kondisiSiswa || '-',
      b.catatanPiket || '-',
      b.tindakLanjut || '-',
      getDutyBookDisplayStatus(b.status).label,
    ]);

    ExportUtils.exportToCsv(`Rekap_Jurnal_Buku_Piket_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'DUTY_BOOK',
      details: `Mengekspor arsip jurnal buku piket ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportTardinessCsv = async () => {
    const headers = ['No', 'ID', 'Tanggal', 'Jam Tiba', 'Menit Terlambat', 'NISN', 'Nama Siswa', 'Kelas', 'Alasan', 'Bentuk Pembinaan', 'Poin Pelanggaran', 'Status', 'Petugas Piket'];
    const rows = filteredTardiness.map((r, idx) => [
      idx + 1,
      r.id,
      r.tanggal,
      r.jamDatang,
      r.menitTerlambat,
      `'${r.nisn}`,
      r.namaSiswa,
      r.kelas,
      getTardyReasonDisplay(r),
      getDisciplineActionDisplay(r),
      r.poinPelanggaran,
      r.status,
      r.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Keterlambatan_Siswa_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'TARDINESS',
      details: `Mengekspor rekapitulasi keterlambatan siswa ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportPermitsCsv = async () => {
    const headers = ['No', 'ID', 'Tanggal', 'Jam Keluar', 'Jam Kembali', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Izin', 'Alasan', 'Penjemput', 'Nama Penjemput', 'No HP Ortu', 'Guru Mapel', 'Status', 'Petugas'];
    const rows = filteredPermits.map((r, idx) => [
      idx + 1,
      r.id,
      r.tanggal,
      r.jamKeluar,
      r.jamKembali || '-',
      `'${r.nisn}`,
      r.namaSiswa,
      r.kelas,
      getStudentPermitTypeDisplay(r),
      r.alasan,
      r.penjemput,
      r.namaPenjemput || '-',
      r.noHpOrangTua || '-',
      r.guruPengajarName || '-',
      r.status,
      r.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Izin_Keluar_Siswa_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'PERMITS',
      details: `Mengekspor rekapitulasi perizinan siswa meninggalkan sekolah ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportSubstitutionsCsv = async () => {
    const headers = ['No', 'ID', 'Tanggal', 'Guru Berhalangan', 'Mata Pelajaran', 'Kelas', 'Jam Pelajaran', 'Alasan', 'Guru Pengganti (Inval)', 'Materi & Tugas', 'Status', 'Petugas Piket'];
    const rows = filteredSubstitutions.map((r, idx) => [
      idx + 1,
      r.id,
      r.tanggal,
      r.guruBerhalanganName,
      r.mataPelajaran,
      r.kelas,
      r.jamPelajaran,
      getSubstitutionReasonDisplay(r),
      r.guruPenggantiName || 'Belum Ditugaskan',
      r.materiDanTugasSiswa,
      r.status,
      r.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Guru_Pengganti_Inval_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'SUBSTITUTIONS',
      details: `Mengekspor data guru pengganti (inval) ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportVisitorsCsv = async () => {
    const headers = ['No', 'ID', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Nama Tamu', 'Instansi', 'Kategori', 'No HP', 'No Identitas', 'No Badge', 'Tujuan Bertemu', 'Keperluan', 'Status', 'Petugas'];
    const rows = filteredVisitors.map((r, idx) => [
      idx + 1,
      r.id,
      r.tanggal,
      r.jamMasuk,
      r.jamKeluar || '-',
      r.namaTamu,
      r.instansiAsal,
      getVisitorCategoryDisplay(r),
      r.noHp || '-',
      r.nomorIdentitas ? `'${r.nomorIdentitas}` : '-',
      r.nomorBadge,
      r.tujuanBertemu,
      r.keperluan,
      r.status,
      r.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Buku_Tamu_${startDate}_${endDate}`, headers, rows);

    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'EXPORT',
      module: 'VISITORS',
      details: `Mengekspor buku tamu sekolah ke CSV/Excel periode ${startDate} s.d ${endDate}`,
    });
  };

  const handleExportActiveTab = () => {
    switch (activeTab) {
      case 'attendance':
        return handleExportAttendanceCsv();
      case 'incidents':
        return handleExportIncidentsCsv();
      case 'dutyBooks':
        return handleExportDutyBooksCsv();
      case 'studentTardiness':
        return handleExportTardinessCsv();
      case 'studentPermits':
        return handleExportPermitsCsv();
      case 'substitutions':
        return handleExportSubstitutionsCsv();
      case 'visitors':
        return handleExportVisitorsCsv();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart2 className="w-6 h-6 text-[var(--theme-primary)]" />
            Laporan, Rekapitulasi & Analitik Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pusat rekapitulasi kepatuhan piket, kedisiplinan siswa, layanan inval, buku tamu, dan pencetakan dokumen resmi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            onClick={() => setIsPrintModalOpen(true)}
          >
            Pratinjau & Cetak Rekap Resmi
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportActiveTab}
          >
            Ekspor Excel Tab Aktif
          </Button>
        </div>
      </div>

      {/* FILTER PERIODE REKAP (5 PILIHAN PERIODE LENGKAP) */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Mode Selector Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <CalendarRange className="w-4 h-4 text-[var(--theme-primary)]" />
              <span>Pilihan Periode Rekapitulasi:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setPeriodMode('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'weekly'
                    ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Mingguan
              </button>
              <button
                onClick={() => setPeriodMode('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'monthly'
                    ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setPeriodMode('semester')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'semester'
                    ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Semester
              </button>
              <button
                onClick={() => setPeriodMode('yearly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'yearly'
                    ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Tahunan
              </button>
              <button
                onClick={() => setPeriodMode('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodMode === 'custom'
                    ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Rentang Khusus
              </button>
            </div>
          </div>

          {/* Dynamic Inputs according to selected Period Mode */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              {/* 1. MINGGUAN */}
              {periodMode === 'weekly' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Pilih Tanggal Acuan Minggu:
                    </label>
                    <input
                      type="date"
                      value={weeklyRefDate}
                      onChange={(e) => setWeeklyRefDate(e.target.value)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div className="pt-4 text-slate-500 text-[11px]">
                    Sistem otomatis menghitung rentang <strong>Senin s.d Minggu</strong> pada pekan tersebut.
                  </div>
                </div>
              )}

              {/* 2. BULANAN */}
              {periodMode === 'monthly' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Pilih Bulan:
                    </label>
                    <select
                      value={monthlyMonth}
                      onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer"
                    >
                      {INDONESIAN_MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Tahun:
                    </label>
                    <input
                      type="number"
                      min={2020}
                      max={2035}
                      value={monthlyYear}
                      onChange={(e) => setMonthlyYear(Number(e.target.value) || new Date().getFullYear())}
                      className="p-2 w-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                </div>
              )}

              {/* 3. SEMESTER */}
              {periodMode === 'semester' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Tahun Pelajaran:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 2026/2027"
                      value={semesterAcademicYear}
                      onChange={(e) => setSemesterAcademicYear(e.target.value)}
                      className="p-2 w-32 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Semester:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSemesterType('GANJIL')}
                        className={`px-3 py-2 rounded-xl font-bold border text-xs cursor-pointer ${
                          semesterType === 'GANJIL'
                            ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] border-[var(--theme-primary)]'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Semester Ganjil
                      </button>
                      <button
                        type="button"
                        onClick={() => setSemesterType('GENAP')}
                        className={`px-3 py-2 rounded-xl font-bold border text-xs cursor-pointer ${
                          semesterType === 'GENAP'
                            ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] border-[var(--theme-primary)]'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Semester Genap
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. TAHUNAN */}
              {periodMode === 'yearly' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Tahun Kalender:
                    </label>
                    <input
                      type="number"
                      min={2020}
                      max={2035}
                      value={yearlyYear}
                      onChange={(e) => setYearlyYear(Number(e.target.value) || new Date().getFullYear())}
                      className="p-2 w-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                    />
                  </div>
                  <div className="pt-4 text-slate-500 text-[11px]">
                    Mencakup seluruh 1 Januari s.d 31 Desember pada tahun tersebut.
                  </div>
                </div>
              )}

              {/* 5. RENTANG KHUSUS */}
              {periodMode === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Tanggal Mulai:
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <span className="pt-4 text-slate-400 font-bold">s/d</span>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Tanggal Selesai:
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Active Range Summary Badge */}
            <div className="shrink-0 p-3 rounded-xl bg-[var(--theme-primary-light)] border border-[var(--theme-primary-border)] text-xs space-y-1">
              <span className="text-[10px] font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] uppercase tracking-wide block">
                Rentang Tanggal Efektif:
              </span>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                <span>{startDate}</span>
                <span className="text-slate-400">s/d</span>
                <span>{endDate}</span>
              </div>
              <p className="text-[11px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-sans font-medium">
                {periodLabel}
              </p>
            </div>
          </div>

          {/* Date Validation Alert if any */}
          {!dateValidation.isValid && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{dateValidation.errorMessage}</span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <Search className="w-4 h-4 absolute left-3 top-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa, guru, kelas, uraian kejadian, tamu, atau nomor identitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-input-bg)] focus:bg-white dark:focus:bg-[var(--theme-input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABS NAVIGATION (7 TABS TOTAL) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-[var(--theme-card-border)] scrollbar-none">
        {[
          { id: 'attendance', label: 'Presensi Guru', icon: Users, count: attendanceSummaries.length },
          { id: 'incidents', label: 'Insiden Kejadian', icon: AlertTriangle, count: totalIncidents },
          { id: 'dutyBooks', label: 'Jurnal Buku Piket', icon: BookOpenCheck, count: filteredDutyBooks.length },
          { id: 'studentTardiness', label: 'Keterlambatan Siswa', icon: UserX, count: filteredTardiness.length },
          { id: 'studentPermits', label: 'Izin Meninggalkan Sekolah', icon: FileText, count: filteredPermits.length },
          { id: 'substitutions', label: 'Guru Pengganti (Inval)', icon: GraduationCap, count: filteredSubstitutions.length },
          { id: 'visitors', label: 'Buku Tamu Sekolah', icon: Building, count: filteredVisitors.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-[var(--theme-primary)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] bg-[var(--theme-primary-light)]/50 dark:bg-[var(--theme-primary-light)]/20 rounded-t-xl'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)]'
                    : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ATTENDANCE SUMMARY */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Guru Terdaftar</span>
                <strong className="text-xl font-bold text-slate-900 dark:text-white">{teachers.length}</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Rata-rata Disiplin</span>
                <strong className="text-xl font-bold text-emerald-600">
                  {attendanceSummaries.length > 0
                    ? Math.round(attendanceSummaries.reduce((a, c) => a + c.percentage, 0) / attendanceSummaries.length)
                    : 100}%
                </strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Kehadiran Valid GPS</span>
                <strong className="text-xl font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">
                  {attendanceSummaries.reduce((a, c) => a + c.hadir, 0)} Shift
                </strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Di Luar Radius/Absen</span>
                <strong className="text-xl font-bold text-amber-600">
                  {attendanceSummaries.reduce((a, c) => a + c.terlambatOrOutside + c.tidakHadir, 0)} Shift
                </strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Kehadiran Guru Piket (${periodLabel})`}
              subtitle="Statistik kehadiran berbasis validasi GPS Geolocation dan swafoto"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Guru / Petugas Piket</th>
                    <th className="p-4">NIP</th>
                    <th className="p-4 text-center">Total Shift</th>
                    <th className="p-4 text-center">Hadir (GPS)</th>
                    <th className="p-4 text-center">Luar Radius</th>
                    <th className="p-4 text-center">Persentase</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendanceSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Tidak ada data jadwal piket pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    attendanceSummaries.map((item) => (
                      <tr key={item.teacherId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {item.fullName}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {item.nip}
                        </td>
                        <td className="p-4 text-center font-mono">
                          {item.totalShift}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.hadir}
                        </td>
                        <td className="p-4 text-center font-mono text-amber-600">
                          {item.terlambatOrOutside}
                        </td>
                        <td className="p-4 text-center font-bold">
                          <span className={`px-2 py-1 rounded-lg text-xs ${
                            item.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.percentage}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={item.percentage >= 80 ? 'success' : 'warning'} size="sm">
                            {item.percentage >= 80 ? 'Sangat Baik' : 'Cukup'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: INCIDENTS SUMMARY */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incidentSummaries.map((cat) => (
              <Card key={cat.categoryCode}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {cat.categoryCode}
                    </span>
                    <Badge variant={cat.kritis > 0 ? 'danger' : 'info'} size="sm">
                      {cat.total} Total Kasus
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{cat.categoryName}</h4>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div>Tuntas Selesai: <strong className="text-emerald-600">{cat.selesai}</strong></div>
                    <div>Dalam Proses: <strong className="text-amber-600">{cat.penanganan}</strong></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title={`Daftar Detail Insiden Terlaporkan (${periodLabel})`}
              subtitle="Rekapitulasi seluruh kejadian pada rentang tanggal terpilih"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Waktu</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4">Uraian Kejadian</th>
                    <th className="p-4">Lokasi</th>
                    <th className="p-4">Tingkat</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Tidak ada catatan insiden kejadian pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(inc.tanggal)}
                          <span className="block text-[11px] text-slate-400 font-normal">{inc.waktu} WIB</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          {getIncidentCategoryDisplay(inc)}
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs break-words">
                          {inc.uraian}
                        </td>
                        <td className="p-4 text-slate-500">
                          {inc.lokasi}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              inc.tingkatKeparahan === 'KRITIS'
                                ? 'danger'
                                : inc.tingkatKeparahan === 'TINGGI'
                                ? 'warning'
                                : 'info'
                            }
                            size="sm"
                          >
                            {inc.tingkatKeparahan}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={inc.status === 'SELESAI' ? 'success' : 'warning'} size="sm">
                            {inc.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: DUTY BOOKS SUMMARY */}
      {activeTab === 'dutyBooks' && (
        <Card>
          <CardHeader
            title={`Arsip Catatan Jurnal Buku Piket (${periodLabel})`}
            subtitle="Pencatatan laporan kondisi lingkungan, kebersihan, dan keamanan harian"
          />
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Tanggal & Shift</th>
                  <th className="p-4">Petugas Piket</th>
                  <th className="p-4">Pos / Ruangan</th>
                  <th className="p-4">Kondisi Keamanan & Fasilitas</th>
                  <th className="p-4">Catatan Observasi Piket</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDutyBooks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      Tidak ada catatan jurnal buku piket pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredDutyBooks.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatIndonesianDate(b.tanggal)}
                        <span className="block text-[11px] text-slate-400 font-normal">{b.jamMulai} - {b.jamSelesai}</span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {b.petugasName}
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300">
                        {b.ruangName}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        <div>Keamanan: <strong className="text-slate-800 dark:text-slate-200">{b.kondisiKeamanan || '-'}</strong></div>
                        <div>Kebersihan: <strong className="text-slate-800 dark:text-slate-200">{b.kondisiKebersihan || '-'}</strong></div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs break-words">
                        {b.catatanPiket || '-'}
                      </td>
                      <td className="p-4">
                        <Badge variant="primary" size="sm">
                          {getDutyBookDisplayStatus(b.status).label}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: STUDENT TARDINESS SUMMARY */}
      {activeTab === 'studentTardiness' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Keterlambatan</span>
                <strong className="text-xl font-bold text-amber-600">{filteredTardiness.length} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Poin Pelanggaran</span>
                <strong className="text-xl font-bold text-rose-600">
                  {filteredTardiness.reduce((a, c) => a + (c.poinPelanggaran || 0), 0)} Poin
                </strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Rata-rata Menit Keterlambatan</span>
                <strong className="text-xl font-bold text-slate-900 dark:text-white">
                  {filteredTardiness.length > 0
                    ? Math.round(filteredTardiness.reduce((a, c) => a + (c.menitTerlambat || 0), 0) / filteredTardiness.length)
                    : 0} Menit
                </strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Keterlambatan Siswa (${periodLabel})`}
              subtitle="Pencatatan pelanggaran disiplin waktu dan bentuk pembinaan"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Siswa & NISN</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4 text-center">Keterlambatan</th>
                    <th className="p-4">Alasan</th>
                    <th className="p-4">Bentuk Pembinaan</th>
                    <th className="p-4 text-center">Poin</th>
                    <th className="p-4">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTardiness.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Tidak ada catatan keterlambatan siswa pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredTardiness.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(r.tanggal)}
                          <span className="block text-[11px] text-slate-400 font-normal">{r.jamDatang} WIB</span>
                        </td>
                        <td className="p-4">
                          <strong className="text-slate-900 dark:text-white block">{r.namaSiswa}</strong>
                          <span className="font-mono text-slate-500 text-[11px]">NISN: {r.nisn}</span>
                        </td>
                        <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                          {r.kelas}
                        </td>
                        <td className="p-4 text-center font-bold text-amber-700">
                          {r.menitTerlambat} Menit
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {getTardyReasonDisplay(r)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300">
                          {getDisciplineActionDisplay(r)}
                        </td>
                        <td className="p-4 text-center font-bold text-rose-600">
                          +{r.poinPelanggaran}
                        </td>
                        <td className="p-4 text-slate-500">
                          {r.petugasPiketName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: STUDENT PERMITS SUMMARY */}
      {activeTab === 'studentPermits' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Izin Keluar</span>
                <strong className="text-xl font-bold text-emerald-600">{filteredPermits.length} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Izin Sakit Pulang</span>
                <strong className="text-xl font-bold text-rose-600">
                  {filteredPermits.filter((p) => p.jenisIzin === 'SAKIT_PULANG').length} Siswa
                </strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Dispensasi / Lomba</span>
                <strong className="text-xl font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">
                  {filteredPermits.filter((p) => p.jenisIzin === 'DISPENSASI_LOMBA').length} Siswa
                </strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Keperluan Keluarga/Lain</span>
                <strong className="text-xl font-bold text-amber-600">
                  {filteredPermits.filter((p) => p.jenisIzin === 'URUSAN_KELUARGA' || p.jenisIzin === 'LAINNYA').length} Siswa
                </strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Izin Meninggalkan Sekolah (${periodLabel})`}
              subtitle="Pencatatan surat izin keluar/pulang siswa dan penjemput resmi"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4">Jenis Izin</th>
                    <th className="p-4">Alasan / Keterangan</th>
                    <th className="p-4">Pendamping / Penjemput</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPermits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Tidak ada catatan izin siswa pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredPermits.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(r.tanggal)}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {r.jamKeluar}{r.jamKembali ? ` - ${r.jamKembali}` : ''}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {r.namaSiswa}
                        </td>
                        <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                          {r.kelas}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">
                            {getStudentPermitTypeDisplay(r)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs break-words">
                          {r.alasan}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">
                          {r.penjemput}
                          {r.namaPenjemput && <span className="block text-[11px] text-slate-500 font-medium">({r.namaPenjemput})</span>}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              r.status === 'SELESAI_PULANG'
                                ? 'success'
                                : r.status === 'SUDAH_KEMBALI'
                                ? 'primary'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {r.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-500">
                          {r.petugasPiketName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: SUBSTITUTIONS SUMMARY */}
      {activeTab === 'substitutions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Jadwal Inval</span>
                <strong className="text-xl font-bold text-indigo-600">{substitutionAnalytics.totalSubstitutions} Jam</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Inval Selesai Dilaksanakan</span>
                <strong className="text-xl font-bold text-emerald-600">{substitutionAnalytics.completed} Shift</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Sedang Berlangsung</span>
                <strong className="text-xl font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">{substitutionAnalytics.inProgress} Shift</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Menunggu Guru Inval</span>
                <strong className="text-xl font-bold text-rose-600">{substitutionAnalytics.pending} Shift</strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Layanan Guru Pengganti / Inval (${periodLabel})`}
              subtitle="Pencatatan guru berhalangan hadir dan pengisian pembelajaran kelas"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Guru Berhalangan</th>
                    <th className="p-4">Mata Pelajaran & Kelas</th>
                    <th className="p-4">Alasan Berhalangan</th>
                    <th className="p-4">Guru Pengganti (Inval)</th>
                    <th className="p-4">Instruksi Materi / Tugas</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubstitutions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Tidak ada catatan penugasan guru pengganti pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredSubstitutions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(r.tanggal)}
                          <span className="block text-[11px] text-slate-400 font-normal">{r.jamPelajaran}</span>
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {r.guruBerhalanganName}
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.mataPelajaran}</span>
                          <span className="block text-slate-500 font-mono text-[11px]">{r.kelas}</span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {getSubstitutionReasonDisplay(r)}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">
                          {r.guruPenggantiName || (
                            <span className="text-rose-500 italic">Belum ada pengganti</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs break-words">
                          {r.materiDanTugasSiswa}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              r.status === 'SELESAI_INVAL'
                                ? 'success'
                                : r.status === 'SEDANG_BERLANGSUNG'
                                ? 'primary'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {r.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 7: VISITORS SUMMARY */}
      {activeTab === 'visitors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Kunjungan Tamu</span>
                <strong className="text-xl font-bold text-teal-600">{visitorAnalytics.totalVisitors} Orang</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Sedang Berkunjung</span>
                <strong className="text-xl font-bold text-amber-600">{visitorAnalytics.currentlyVisiting} Orang</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Kunjungan Selesai</span>
                <strong className="text-xl font-bold text-emerald-600">{visitorAnalytics.completed} Orang</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Kunjungan Ditolak</span>
                <strong className="text-xl font-bold text-rose-600">{visitorAnalytics.rejected} Orang</strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Kunjungan Buku Tamu Sekolah (${periodLabel})`}
              subtitle="Log buku tamu resmi pos satpam dan ruang lobi sekolah"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Tamu & No. Badge</th>
                    <th className="p-4">Instansi Asal</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4">Tujuan Bertemu</th>
                    <th className="p-4">Keperluan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVisitors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Tidak ada catatan kunjungan tamu pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredVisitors.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(r.tanggal)} ({r.jamMasuk}{r.jamKeluar ? ` - ${r.jamKeluar}` : ''})
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {r.namaTamu}
                          <span className="block font-mono text-[10px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-normal">Badge: {r.nomorBadge}</span>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300">
                          {r.instansiAsal}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {getVisitorCategoryDisplay(r)}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          {r.tujuanBertemu}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs break-words">
                          {r.keperluan}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              r.status === 'SELESAI'
                                ? 'success'
                                : r.status === 'SEDANG_BERKUNJUNG'
                                ? 'primary'
                                : 'danger'
                            }
                            size="sm"
                          >
                            {r.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-500">
                          {r.petugasPiketName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MONTHLY REPORT PRINT MODAL (ALL MODULES CONNECTED) */}
      <MonthlyReportPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        settings={settings}
        periodLabel={periodLabel}
        attendanceSummaries={attendanceSummaries}
        incidentSummaries={incidentSummaries}
        totalIncidents={totalIncidents}
        resolvedIncidents={resolvedIncidents}
        tardyRecords={filteredTardiness}
        permitRecords={filteredPermits}
        substitutionRecords={filteredSubstitutions}
        visitorRecords={filteredVisitors}
        dutyBookRecords={filteredDutyBooks}
      />
    </div>
  );
};
