import React, { useState, useEffect } from 'react';
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
import { DutyBookRecord } from '../../types/dutyBook.types';
import { IncidentRecord } from '../../types/incident.types';
import { TeacherRecord, IncidentCategoryRecord } from '../../types/master.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate } from '../../utils/dateUtils';

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

  // Filter Date Range (Default to dynamic current month)
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Subscriptions to all operational collections
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
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

  // Aggregated Summaries
  const attendanceSummaries = ReportService.getTeacherAttendanceSummary(
    schedules,
    attendanceList,
    teachers,
    startDate,
    endDate
  );

  const incidentSummaries = ReportService.getIncidentCategorySummary(
    incidents,
    categories,
    startDate,
    endDate
  );

  const filteredIncidents = incidents.filter(
    (i) => i.tanggal >= startDate && i.tanggal <= endDate &&
      (searchQuery === '' ||
        i.uraian?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.lokasi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.kategoriName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const totalIncidents = filteredIncidents.length;
  const resolvedIncidents = filteredIncidents.filter((i) => i.status === 'SELESAI').length;

  const filteredDutyBooks = dutyBooks.filter(
    (b) => b.tanggal >= startDate && b.tanggal <= endDate &&
      (searchQuery === '' ||
        b.petugasName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.ruangName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.catatanPiket?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // New Analytics & Filtered Collections
  const tardyAnalytics = ReportService.getStudentTardyAnalytics(studentTardiness, startDate, endDate);
  const filteredTardiness = studentTardiness.filter(
    (r) => r.tanggal >= startDate && r.tanggal <= endDate &&
      (searchQuery === '' ||
        r.namaSiswa?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.nisn?.includes(searchQuery) ||
        r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.alasan?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const permitAnalytics = ReportService.getStudentPermitAnalytics(studentPermits, startDate, endDate);
  const filteredPermits = studentPermits.filter(
    (r) => r.tanggal >= startDate && r.tanggal <= endDate &&
      (searchQuery === '' ||
        r.namaSiswa?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.alasan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.penjemput?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const substitutionAnalytics = ReportService.getSubstitutionAnalytics(substitutions, startDate, endDate);
  const filteredSubstitutions = substitutions.filter(
    (r) => r.tanggal >= startDate && r.tanggal <= endDate &&
      (searchQuery === '' ||
        r.guruBerhalanganName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.guruPenggantiName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.mataPelajaran?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.kelas?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const visitorAnalytics = ReportService.getVisitorAnalytics(visitors, startDate, endDate);
  const filteredVisitors = visitors.filter(
    (r) => r.tanggal >= startDate && r.tanggal <= endDate &&
      (searchQuery === '' ||
        r.namaTamu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.instansiAsal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tujuanBertemu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.keperluan?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const periodLabel = `${formatIndonesianDate(startDate)} s.d ${formatIndonesianDate(endDate)}`;

  // Quick Preset Handlers
  const handleSetQuickPeriod = (preset: 'today' | '7days' | 'month' | 'lastMonth') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const iso = toISO(today);
      setStartDate(iso);
      setEndDate(iso);
    } else if (preset === '7days') {
      const past7 = new Date(today);
      past7.setDate(today.getDate() - 7);
      setStartDate(toISO(past7));
      setEndDate(toISO(today));
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(toISO(firstDay));
      setEndDate(toISO(lastDay));
    } else if (preset === 'lastMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(toISO(firstDay));
      setEndDate(toISO(lastDay));
    }
  };

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
      i.kategoriName,
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
      b.status,
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
    const headers = ['No', 'ID', 'Tanggal', 'Jam Tiba', 'Menit Terlambat', 'NISN', 'Nama Siswa', 'Kelas', 'Alasan', 'Keterangan', 'Bentuk Pembinaan', 'Poin Pelanggaran', 'Status', 'Petugas Piket'];
    const rows = filteredTardiness.map((r, idx) => [
      idx + 1,
      r.id,
      r.tanggal,
      r.jamDatang,
      r.menitTerlambat,
      `'${r.nisn}`,
      r.namaSiswa,
      r.kelas,
      r.alasan,
      r.keteranganAlasan || '-',
      r.pembinaan,
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
      r.jenisIzin,
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
      r.alasan,
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
      r.kategori,
      r.noHp,
      `'${r.nomorIdentitas}`,
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
            <FileBarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Laporan, Rekapitulasi & Analitik Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pusat analitik kepatuhan tugas piket, kedisiplinan siswa, layanan inval, buku tamu, dan pencetakan laporan bulanan resmi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            onClick={() => setIsPrintModalOpen(true)}
          >
            Cetak Rekap Bulanan Resmi
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

      {/* DATE RANGE FILTER BAR & SEARCH */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Rentang Periode Laporan:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSetQuickPeriod('today')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => handleSetQuickPeriod('7days')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  7 Hari
                </button>
                <button
                  onClick={() => handleSetQuickPeriod('month')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => handleSetQuickPeriod('lastMonth')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Bulan Lalu
                </button>
              </div>
            </div>
          </div>

          {/* Search box */}
          <div className="relative pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <Search className="w-4 h-4 absolute left-3 top-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama siswa, guru, kelas, keterangan, atau nomor identitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABS NAVIGATION (7 TABS TOTAL) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
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
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded-t-xl'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
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
                <strong className="text-xl font-bold text-blue-600">
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
                  {attendanceSummaries.map((item) => (
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
                  ))}
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
                        Tidak ada catatan insiden sesuai filter periode dan kata kunci.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(i.tanggal)} ({i.waktu})
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {i.kategoriName}
                        </td>
                        <td className="p-4 text-slate-800 dark:text-slate-200 max-w-xs truncate">
                          {i.uraian}
                        </td>
                        <td className="p-4 text-slate-500">
                          {i.lokasi}
                        </td>
                        <td className="p-4">
                          <Badge variant={i.tingkatKeparahan === 'KRITIS' ? 'danger' : 'warning'} size="sm">
                            {i.tingkatKeparahan}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={i.status === 'SELESAI' ? 'success' : 'primary'} size="sm">
                            {i.status}
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
            title={`Rekapitulasi Jurnal Buku Piket Digital (${periodLabel})`}
            subtitle="Daftar pengarsipan buku piket dan status verifikasi kepala sekolah"
          />
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Hari & Tanggal</th>
                  <th className="p-4">Petugas Piket</th>
                  <th className="p-4">Pos / Ruangan</th>
                  <th className="p-4">Ringkasan Situasi</th>
                  <th className="p-4">Status Buku</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDutyBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Tidak ada catatan jurnal buku piket pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredDutyBooks.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {b.hari}, {formatIndonesianDate(b.tanggal)}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {b.petugasName}
                      </td>
                      <td className="p-4 text-blue-600 dark:text-blue-400">
                        {b.ruangName}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 max-w-sm truncate">
                        {b.catatanPiket || '-'}
                      </td>
                      <td className="p-4">
                        <Badge variant={b.status === 'DIKUNCI' ? 'neutral' : b.status === 'DISETUJUI' ? 'success' : 'primary'} size="sm">
                          {b.status}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Total Kasus Terlambat</span>
                <strong className="text-xl font-bold text-amber-600">{tardyAnalytics.totalTardy} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Terlambat Berulang (&gt;1x)</span>
                <strong className="text-xl font-bold text-rose-600">{tardyAnalytics.repeatOffenders} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Rata-rata Menit Terlambat</span>
                <strong className="text-xl font-bold text-slate-800 dark:text-white">{tardyAnalytics.avgMinutesTardy} Menit</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Akumulasi Poin Pelanggaran</span>
                <strong className="text-xl font-bold text-indigo-600">{tardyAnalytics.totalPoints} Poin</strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Keterlambatan Siswa (${periodLabel})`}
              subtitle="Catatan kedatangan siswa melewati batas jam masuk sekolah dan bentuk pembinaan"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4 text-center">Keterlambatan</th>
                    <th className="p-4">Alasan Keterlambatan</th>
                    <th className="p-4">Bentuk Pembinaan Disiplin</th>
                    <th className="p-4 text-center">Poin</th>
                    <th className="p-4">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTardiness.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        Tidak ada rekaman keterlambatan siswa untuk periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredTardiness.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatIndonesianDate(r.tanggal)} ({r.jamDatang})
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {r.namaSiswa}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">NISN: {r.nisn}</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                          {r.kelas}
                        </td>
                        <td className="p-4 text-center font-bold text-amber-700 dark:text-amber-400 font-mono">
                          +{r.menitTerlambat} mnt
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{r.alasan.replace(/_/g, ' ')}</span>
                          {r.keteranganAlasan && <span className="block text-slate-500 text-[11px]">{r.keteranganAlasan}</span>}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                            {r.pembinaan.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-rose-600">
                          {r.poinPelanggaran}
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
                <span className="text-slate-500 text-xs block">Total Izin Diberikan</span>
                <strong className="text-xl font-bold text-blue-600">{permitAnalytics.totalPermits} Izin</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Sedang di Luar</span>
                <strong className="text-xl font-bold text-amber-600">{permitAnalytics.currentlyOut} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Sudah Kembali Masuk</span>
                <strong className="text-xl font-bold text-emerald-600">{permitAnalytics.returned} Siswa</strong>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-slate-500 text-xs block">Izin Pulang ke Rumah</span>
                <strong className="text-xl font-bold text-indigo-600">{permitAnalytics.leftSchool} Siswa</strong>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={`Rekapitulasi Izin Meninggalkan Sekolah / Kelas (${periodLabel})`}
              subtitle="Catatan izin keluar lingkungan sekolah resmi atas verifikasi piket"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4">Jenis Perizinan</th>
                    <th className="p-4">Alasan & Kepentingan</th>
                    <th className="p-4">Penjemput</th>
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
                          {formatIndonesianDate(r.tanggal)} ({r.jamKeluar}{r.jamKembali ? ` - ${r.jamKembali}` : ''})
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          {r.namaSiswa}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">NISN: {r.nisn}</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                          {r.kelas}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">
                            {r.jenisIzin.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs">
                          {r.alasan}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">
                          {r.penjemput} {r.namaPenjemput ? `(${r.namaPenjemput})` : ''}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              r.status === 'SUDAH_KEMBALI' || r.status === 'SELESAI_PULANG'
                                ? 'success'
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
                <strong className="text-xl font-bold text-blue-600">{substitutionAnalytics.inProgress} Shift</strong>
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
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {r.alasan.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-blue-600 dark:text-blue-400">
                          {r.guruPenggantiName || (
                            <span className="text-rose-500 italic">Belum ada pengganti</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
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
                          <span className="block font-mono text-[10px] text-blue-600 dark:text-blue-400 font-normal">Badge: {r.nomorBadge}</span>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300">
                          {r.instansiAsal}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {r.kategori.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          {r.tujuanBertemu}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
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

      {/* MONTHLY REPORT PRINT MODAL (ALL 6 MODULES CONNECTED) */}
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
      />
    </div>
  );
};
