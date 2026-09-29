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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MonthlyReportPrintModal } from './MonthlyReportPrintModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { ReportService, TeacherAttendanceSummary, IncidentCategorySummary } from '../../services/reports/reportService';
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
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

type ReportTab = 'attendance' | 'incidents' | 'dutyBooks';

export const ReportsPreview: React.FC = () => {
  const { currentUser } = useAuth();

  // Primary Collections
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  // Filter Date Range (Default to current month: 2026-09-01 s/d 2026-09-30)
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Subscriptions
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

    return () => {
      unsubSched();
      unsubAtt();
      unsubBooks();
      unsubInc();
      unsubTeachers();
      unsubCats();
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
    (i) => i.tanggal >= startDate && i.tanggal <= endDate
  );
  const totalIncidents = filteredIncidents.length;
  const resolvedIncidents = filteredIncidents.filter((i) => i.status === 'SELESAI').length;

  const filteredDutyBooks = dutyBooks.filter(
    (b) => b.tanggal >= startDate && b.tanggal <= endDate
  );

  const periodLabel = `${formatIndonesianDate(startDate)} s.d ${formatIndonesianDate(endDate)}`;

  // --- EXPORT TO CSV / EXCEL ---
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

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Laporan & Rekapitulasi Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analisis kepatuhan tugas piket, rekapitulasi kejadian sekolah, ekspor spreadsheet dan cetak laporan resmi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            onClick={() => setIsPrintModalOpen(true)}
          >
            Cetak Rekap Bulanan
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={
              activeTab === 'attendance'
                ? handleExportAttendanceCsv
                : handleExportIncidentsCsv
            }
          >
            Ekspor Excel (CSV)
          </Button>
        </div>
      </div>

      {/* DATE RANGE FILTER BAR */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  onClick={() => {
                    setStartDate('2026-09-01');
                    setEndDate('2026-09-30');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Bulan Ini
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* REPORT TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        {[
          { id: 'attendance', label: 'Rekap Presensi Guru', icon: Users, count: attendanceSummaries.length },
          { id: 'incidents', label: 'Rekap Insiden & Kejadian', icon: AlertTriangle, count: totalIncidents },
          { id: 'dutyBooks', label: 'Rekap Jurnal Buku Piket', icon: BookOpenCheck, count: filteredDutyBooks.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-xs transition-all cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded-t-xl'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ATTENDANCE SUMMARY */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
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
                  {filteredIncidents.map((i) => (
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
                  ))}
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
                  <th className="p-4">Tahap Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDutyBooks.map((b) => (
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
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* MONTHLY REPORT PRINT MODAL */}
      <MonthlyReportPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        settings={settings}
        periodLabel={periodLabel}
        attendanceSummaries={attendanceSummaries}
        incidentSummaries={incidentSummaries}
        totalIncidents={totalIncidents}
        resolvedIncidents={resolvedIncidents}
      />
    </div>
  );
};
