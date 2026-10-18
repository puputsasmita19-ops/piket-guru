import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  Camera,
  ImageOff,
  ChevronLeft,
  ChevronRight,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { MonthlyReportPrintModal } from './MonthlyReportPrintModal';
import { PhotoRecapPrintModal } from './PhotoRecapPrintModal';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { where } from 'firebase/firestore';
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
import type { OperationalReport } from '../../utils/operationalReport';
import { useAuth } from '../../contexts/AuthContext';
import {
  ScheduleItem,
  AttendanceRecord,
  SchoolSettings,
} from '../../types';
import { PhotoRecapItem } from '../../types/watermark.types';
import { isPhotoAlreadyWatermarked } from '../../services/watermark/watermarkService';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { IncidentRecord, getIncidentCategoryDisplay } from '../../types/incident.types';
import { TeacherRecord, IncidentCategoryRecord } from '../../types/master.types';
import { StudentTardyRecord, getTardyReasonDisplay, getDisciplineActionDisplay } from '../../types/studentTardy.types';
import { StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord, getSubstitutionReasonDisplay } from '../../types/substitution.types';
import { VisitorRecord, getVisitorCategoryDisplay } from '../../types/visitor.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, getTodayISODate, formatTime } from '../../utils/dateUtils';
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
  | 'visitors'
  | 'photoRecap';

interface PhotoCardItemProps {
  photo: PhotoRecapItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onPreview: (photo: PhotoRecapItem) => void;
}

const PhotoCardItem: React.FC<PhotoCardItemProps> = ({
  photo,
  isSelected,
  onToggleSelect,
  onPreview,
}) => {
  const [hasError, setHasError] = useState(false);

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'ATTENDANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300">Presensi GPS</span>;
      case 'INCIDENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">Laporan Kejadian</span>;
      case 'STUDENT_TARDY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">Siswa Terlambat</span>;
      case 'VISITOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">Buku Tamu</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Dokumentasi</span>;
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header Card */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(photo.id)}
            className="rounded text-[var(--theme-primary)] focus:ring-0 cursor-pointer"
          />
          {getModuleBadge(photo.sourceModule)}
        </label>

        {photo.isLegacyUnwatermarked && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-[9px] font-bold">
            Foto Arsip
          </span>
        )}
      </div>

      {/* Image Preview Container (Never distort or crop watermark) */}
      <div
        onClick={() => onPreview(photo)}
        className="relative bg-slate-950 aspect-4/3 flex items-center justify-center overflow-hidden cursor-pointer group"
      >
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <ImageOff className="w-8 h-8 mb-1.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-300">Foto tidak dapat dimuat</span>
            <span className="text-[10px] text-slate-500">Berkas lokal/arsip tidak ditemukan</span>
          </div>
        ) : (
          <AuthenticatedImage
            src={photo.photoUrl}
            alt={photo.title}
            onError={() => setHasError(true)}
            className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-102"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold backdrop-blur-xs">
          Klik untuk perbesar
        </div>
      </div>

      {/* Caption & Metadata */}
      <div className="p-3.5 space-y-2 text-xs flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1" title={photo.title}>
            {photo.title}
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1" title={photo.briefIdentity}>
            {photo.briefIdentity}
          </p>
          {photo.notes && (
            <p className="text-[10.5px] text-slate-500 line-clamp-2 italic" title={photo.notes}>
              {photo.notes}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[10px] text-slate-500">
          <div className="flex items-center justify-between">
            <span>Kejadian: {formatIndonesianDate(photo.tanggalKejadian)}{photo.waktuKejadian ? ` (${photo.waktuKejadian})` : ''}</span>
          </div>

          {photo.tanggalDokumentasi && photo.tanggalDokumentasi !== photo.tanggalKejadian && (
            <div className="text-blue-600 dark:text-blue-400 font-medium">
              Foto: {formatIndonesianDate(photo.tanggalDokumentasi)}{photo.waktuDokumentasi ? ` (${photo.waktuDokumentasi})` : ''}
            </div>
          )}

          {photo.petugasName && (
            <div className="text-slate-600 dark:text-slate-400 font-medium truncate">
              Petugas: {photo.petugasName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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

  // Print Modals
  const [isReportActionsOpen, setIsReportActionsOpen] = useState(false);
  const [isExportingDocument, setIsExportingDocument] = useState(false);
  const [exportError, setExportError] = useState('');
  const [settingsReady, setSettingsReady] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPhotoRecapPrintOpen, setIsPhotoRecapPrintOpen] = useState<boolean>(false);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Loading and Error tracking
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // Photo Recap Module Filter & Selection States
  const [photoModuleFilter, setPhotoModuleFilter] = useState<'ALL' | 'ATTENDANCE' | 'INCIDENT' | 'STUDENT_TARDY' | 'VISITOR'>('ALL');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [photoRecapPage, setPhotoRecapPage] = useState<number>(1);
  const [previewPhotoItem, setPreviewPhotoItem] = useState<PhotoRecapItem | null>(null);

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

  // Master Data Subscription (schedules, teachers, categories, settings)
  useEffect(() => {
    let active = true;

    FirestoreService.getById<SchoolSettings>('settings', 'school_config')
      .then((data) => {
        if (data && active) {
          setSettings(data);
          setSettingsReady(true);
          if (data.academicSemester?.academicYear) {
            setSemesterAcademicYear(data.academicSemester.academicYear);
          }
        }
      })
      .catch(console.warn);

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>(
      'schedules',
      (data) => active && setSchedules(data)
    );
    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>(
      'teachers',
      (data) => active && setTeachers(data)
    );
    const unsubCats = FirestoreService.subscribeToCollection<IncidentCategoryRecord>(
      'incidentCategories',
      (data) => active && setCategories(data)
    );

    return () => {
      active = false;
      unsubSched();
      unsubTeachers();
      unsubCats();
    };
  }, []);

  // Operational Data Subscriptions bounded strictly by computed date range
  useEffect(() => {
    let active = true;
    setIsLoadingData(true);
    setDataLoadError(null);

    const handleError = (err: any) => {
      if (!active) return;
      console.warn('[REPORTS] Error fetching operational reports data:', err);
      if (err?.code === 'permission-denied') {
        setDataLoadError('Akses database laporan ditolak (izin akses tidak mencukupi).');
      } else {
        setDataLoadError(err?.message || 'Gagal memuat data laporan dari database.');
      }
      setIsLoadingData(false);
    };

    const pending = new Set(['attendance', 'dutyBooks', 'incidents', 'studentTardiness', 'studentPermits', 'substitutions', 'visitors']);
    const ready = (collection: string) => { pending.delete(collection); if (active && pending.size === 0) setIsLoadingData(false); };
    const dateConstraints = [
      where('tanggal', '>=', startDate),
      where('tanggal', '<=', endDate),
    ];

    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>(
      'attendance',
      (data) => {
        if (active) {
          setAttendanceList(data);
          ready('attendance');
        }
      },
      handleError,
      dateConstraints
    );
    const unsubBooks = FirestoreService.subscribeToCollection<DutyBookRecord>(
      'dutyBooks',
      (data) => { if (active) { setDutyBooks(data); ready('dutyBooks'); } },
      handleError,
      dateConstraints
    );
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>(
      'incidents',
      (data) => { if (active) { setIncidents(data); ready('incidents'); } },
      handleError,
      dateConstraints
    );
    const unsubTardy = FirestoreService.subscribeToCollection<StudentTardyRecord>(
      'studentTardiness',
      (data) => { if (active) { setStudentTardiness(data); ready('studentTardiness'); } },
      handleError,
      dateConstraints
    );
    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>(
      'studentPermits',
      (data) => { if (active) { setStudentPermits(data); ready('studentPermits'); } },
      handleError,
      dateConstraints
    );
    const unsubSubs = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>(
      'substitutions',
      (data) => { if (active) { setSubstitutions(data); ready('substitutions'); } },
      handleError,
      dateConstraints
    );
    const unsubVisitors = FirestoreService.subscribeToCollection<VisitorRecord>(
      'visitors',
      (data) => { if (active) { setVisitors(data); ready('visitors'); } },
      handleError,
      dateConstraints
    );

    return () => {
      active = false;
      unsubAtt();
      unsubBooks();
      unsubInc();
      unsubTardy();
      unsubPermits();
      unsubSubs();
      unsubVisitors();
    };
  }, [startDate, endDate]);

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

  // --- REKAP FOTO DOKUMENTASI (4 MODUL LENGKAP) ---
  const allPhotoItems = useMemo<PhotoRecapItem[]>(() => {
    if (!dateValidation.isValid) return [];
    const items: PhotoRecapItem[] = [];

    // 1. Presensi GPS Guru Piket (Selfie / photoUrl / fotoUrl / selfieUrl)
    attendanceList.forEach((att) => {
      const attPhoto = att.photoUrl || (att as any).fotoUrl || (att as any).selfieUrl || (att as any).photo;
      const jamMasukStr = typeof att.jamMasuk === 'string' ? att.jamMasuk : att.jamMasuk ? String(att.jamMasuk) : '';
      if (attPhoto && att.tanggal >= startDate && att.tanggal <= endDate) {
        const isLegacy = !isPhotoAlreadyWatermarked(attPhoto);
        items.push({
          id: `att-${att.id}`,
          sourceModule: 'ATTENDANCE',
          sourceId: att.id,
          photoUrl: attPhoto,
          tanggalKejadian: att.tanggal,
          waktuKejadian: jamMasukStr ? jamMasukStr.slice(0, 5) : undefined,
          tanggalDokumentasi: att.tanggal,
          waktuDokumentasi: jamMasukStr ? `${jamMasukStr.slice(0, 5)} WIB` : undefined,
          petugasName: att.userName,
          title: `Presensi Masuk: ${att.userName}`,
          briefIdentity: `Guru Piket • Status: ${att.status}`,
          notes: `Presensi GPS${att.accuracy ? ` • Akurasi GPS: ±${Math.round(att.accuracy)} m` : ''}`,
          isLegacyUnwatermarked: isLegacy,
        });
      }
    });

    // 2. Laporan Kejadian (Insiden)
    incidents.forEach((inc) => {
      if (inc.tanggal >= startDate && inc.tanggal <= endDate) {
        if (Array.isArray(inc.photos) && inc.photos.length > 0) {
          inc.photos.forEach((photo, pIdx) => {
            const pUrl = photo.url || (photo as any).photoUrl || (photo as any).fotoUrl || (photo as any).urlFoto;
            if (!pUrl) return;
            const docDate = photo.uploadedAt ? photo.uploadedAt.split('T')[0] : inc.tanggal;
            const docTime = photo.uploadedAt ? photo.uploadedAt.split('T')[1]?.slice(0, 5) : inc.waktu;
            const isLegacy = !isPhotoAlreadyWatermarked(pUrl);
            items.push({
              id: `inc-${inc.id}-${photo.id || pIdx}`,
              sourceModule: 'INCIDENT',
              sourceId: inc.id,
              photoUrl: pUrl,
              tanggalKejadian: inc.tanggal,
              waktuKejadian: inc.waktu ? `${inc.waktu} WIB` : undefined,
              tanggalDokumentasi: docDate,
              waktuDokumentasi: docTime ? `${docTime} WIB` : undefined,
              petugasName: inc.pelaporName || 'Petugas Piket',
              title: `Kejadian: ${inc.kategoriName || inc.kategori}`,
              briefIdentity: `${inc.kategoriName || inc.kategori}${inc.lokasi ? ` • Lokasi: ${inc.lokasi}` : ''}`,
              notes: inc.uraian || (inc.tingkatKeparahan ? `Tingkat: ${inc.tingkatKeparahan}` : undefined),
              isLegacyUnwatermarked: isLegacy,
            });
          });
        } else if ((inc as any).fotoUrl || (inc as any).photoUrl || (inc as any).foto || (inc as any).buktiFoto) {
          const pUrl = (inc as any).fotoUrl || (inc as any).photoUrl || (inc as any).foto || (inc as any).buktiFoto;
          const isLegacy = !isPhotoAlreadyWatermarked(pUrl);
          items.push({
            id: `inc-${inc.id}-legacy`,
            sourceModule: 'INCIDENT',
            sourceId: inc.id,
            photoUrl: pUrl,
            tanggalKejadian: inc.tanggal,
            waktuKejadian: inc.waktu ? `${inc.waktu} WIB` : undefined,
            tanggalDokumentasi: inc.tanggal,
            waktuDokumentasi: inc.waktu ? `${inc.waktu} WIB` : undefined,
            petugasName: inc.pelaporName || 'Petugas Piket',
            title: `Kejadian: ${inc.kategoriName || inc.kategori}`,
            briefIdentity: `${inc.kategoriName || inc.kategori}${inc.lokasi ? ` • Lokasi: ${inc.lokasi}` : ''}`,
            notes: inc.uraian || (inc.tingkatKeparahan ? `Tingkat: ${inc.tingkatKeparahan}` : undefined),
            isLegacyUnwatermarked: isLegacy,
          });
        }
      }
    });

    // 3. Siswa Terlambat
    studentTardiness.forEach((tardy) => {
      const tardyPhoto = tardy.fotoUrl || (tardy as any).photoUrl || (tardy as any).buktiFoto || (tardy as any).foto;
      if (tardyPhoto && tardy.tanggal >= startDate && tardy.tanggal <= endDate) {
        const isLegacy = !isPhotoAlreadyWatermarked(tardyPhoto);
        items.push({
          id: `tardy-${tardy.id}`,
          sourceModule: 'STUDENT_TARDY',
          sourceId: tardy.id,
          photoUrl: tardyPhoto,
          tanggalKejadian: tardy.tanggal,
          waktuKejadian: tardy.jamDatang ? `${tardy.jamDatang} WIB` : undefined,
          tanggalDokumentasi: tardy.tanggal,
          waktuDokumentasi: tardy.jamDatang ? `${tardy.jamDatang} WIB` : undefined,
          petugasName: tardy.createdBy || 'Petugas Piket',
          title: `Siswa Terlambat: ${tardy.namaSiswa}`,
          briefIdentity: `Siswa: ${tardy.namaSiswa} • Kelas: ${tardy.kelas}`,
          notes: `Terlambat ${tardy.menitTerlambat} mnt • Alasan: ${getTardyReasonDisplay(tardy)}`,
          isLegacyUnwatermarked: isLegacy,
        });
      }
    });

    // 4. Buku Tamu Digital
    visitors.forEach((vis) => {
      const visPhoto = vis.fotoUrl || (vis as any).photoUrl || (vis as any).fotoTamu || (vis as any).foto;
      if (visPhoto && vis.tanggal >= startDate && vis.tanggal <= endDate) {
        const isLegacy = !isPhotoAlreadyWatermarked(visPhoto);
        items.push({
          id: `vis-${vis.id}`,
          sourceModule: 'VISITOR',
          sourceId: vis.id,
          photoUrl: visPhoto,
          tanggalKejadian: vis.tanggal,
          waktuKejadian: vis.jamMasuk ? `${vis.jamMasuk} WIB` : undefined,
          tanggalDokumentasi: vis.tanggal,
          waktuDokumentasi: vis.jamMasuk ? `${vis.jamMasuk} WIB` : undefined,
          petugasName: vis.petugasPiketName || 'Petugas Piket',
          title: `Buku Tamu: ${vis.namaTamu}`,
          briefIdentity: `Tamu: ${vis.namaTamu}${vis.instansiAsal ? ` • Asal: ${vis.instansiAsal}` : ''}`,
          notes: `Tujuan: ${vis.tujuanBertemu || '-'}${vis.keperluan ? ` (${vis.keperluan})` : ''}`,
          isLegacyUnwatermarked: isLegacy,
        });
      }
    });

    return items.sort((a, b) => {
      const dateA = a.tanggalKejadian + (a.waktuKejadian || '');
      const dateB = b.tanggalKejadian + (b.waktuKejadian || '');
      return dateB.localeCompare(dateA);
    });
  }, [attendanceList, incidents, studentTardiness, visitors, startDate, endDate, dateValidation.isValid]);

  const filteredPhotoItems = useMemo(() => {
    return allPhotoItems.filter((item) => {
      if (photoModuleFilter !== 'ALL' && item.sourceModule !== photoModuleFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchIdentity = item.briefIdentity.toLowerCase().includes(q);
        const matchPetugas = item.petugasName?.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        const matchDate = item.tanggalKejadian.includes(q);
        if (!matchTitle && !matchIdentity && !matchPetugas && !matchNotes && !matchDate) {
          return false;
        }
      }
      return true;
    });
  }, [allPhotoItems, photoModuleFilter, searchQuery]);

  const PHOTO_PAGE_SIZE = 12;
  const totalPhotoPages = Math.ceil(filteredPhotoItems.length / PHOTO_PAGE_SIZE) || 1;
  const paginatedPhotos = useMemo(() => {
    const start = (photoRecapPage - 1) * PHOTO_PAGE_SIZE;
    return filteredPhotoItems.slice(start, start + PHOTO_PAGE_SIZE);
  }, [filteredPhotoItems, photoRecapPage]);

  // Reset photo recap page on filter change
  useEffect(() => {
    setPhotoRecapPage(1);
  }, [photoModuleFilter, searchQuery, startDate, endDate]);

  const handleToggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedPhotoIds.size === filteredPhotoItems.length && filteredPhotoItems.length > 0) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(filteredPhotoItems.map((p) => p.id)));
    }
  };

  const selectedPhotosList = useMemo(() => {
    if (selectedPhotoIds.size === 0) return filteredPhotoItems;
    return filteredPhotoItems.filter((p) => selectedPhotoIds.has(p.id));
  }, [filteredPhotoItems, selectedPhotoIds]);

  // The Word export uses the same complete filtered arrays as the active report tab.
  // Group related fields into readable cells rather than squeezing 13–16 spreadsheet columns onto paper.
  const activeWordReport = useMemo<OperationalReport | null>(() => {
    const make = (title: string, headers: string[], rows: OperationalReport['rows'], groups: [string, number[]][]): OperationalReport => ({
      title, period: `${periodLabel} (${startDate} s.d. ${endDate})`, headers: groups.map(([label]) => label),
      rows: rows.map(row => groups.map(([, indexes]) => indexes.map(index => `${headers[index]}: ${row[index] ?? '-'}`).join('\n'))),
    });
    switch (activeTab) {
      case 'attendance': {
        const headers = ['No', 'NIP', 'Nama Guru', 'Mata Pelajaran', 'Total Shift', 'Hadir (GPS)', 'Luar Radius', 'Tidak Hadir', 'Persentase'];
        const rows = attendanceSummaries.map((s, idx) => [
          idx + 1,
          s.nip,
          s.fullName,
          teachers.find((t) => t.id === s.teacherId)?.mataPelajaran || '-',
          s.totalShift,
          s.hadir,
          s.terlambatOrOutside,
          s.tidakHadir,
          `${s.percentage}%`,
        ]);
        return make('Rekap Kehadiran Guru Piket', headers, rows, [["Identitas Guru", [1, 2]], ["Mata Pelajaran", [3]], ["Total Shift", [4]], ["Kehadiran", [5, 6, 7]], ["Persentase", [8]]]);
      }
      case 'incidents': {
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
        return make('Rekap Insiden dan Kejadian', headers, rows, [["Waktu / ID", [0, 1, 2]], ["Kategori / Tingkat", [3, 4]], ["Pihak / Lokasi", [5, 6]], ["Kronologi", [7]], ["Tindakan / Status", [8, 9]], ["Petugas", [10]]]);
      }
      case 'dutyBooks': {
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
        return make('Rekap Jurnal Buku Piket Digital', headers, rows, [["Waktu / ID", [0, 1, 2, 3]], ["Petugas / Pos", [4, 5]], ["Kondisi Sekolah", [6, 7, 8]], ["Catatan / Tindak Lanjut", [9, 10]], ["Status", [11]]]);
      }
      case 'studentTardiness': {
        const headers = ['No', 'ID', 'Tanggal', 'Jam Tiba', 'Menit Terlambat', 'NISN', 'Nama Siswa', 'Kelas', 'Alasan', 'Bentuk Pembinaan', 'Poin Pelanggaran', 'Status', 'Petugas Piket'];
        const rows = filteredTardiness.map((r, idx) => [
          idx + 1,
          r.id,
          r.tanggal,
          r.jamDatang,
          r.menitTerlambat,
          r.nisn,
          r.namaSiswa,
          r.kelas,
          getTardyReasonDisplay(r),
          getDisciplineActionDisplay(r),
          r.poinPelanggaran,
          r.status,
          r.petugasPiketName,
        ]);
        return make('Rekap Siswa Terlambat', headers, rows, [["Waktu / ID", [1, 2, 3]], ["Identitas Siswa", [5, 6, 7]], ["Keterlambatan / Poin", [4, 10]], ["Alasan / Pembinaan", [8, 9]], ["Status / Petugas", [11, 12]]]);
      }
      case 'studentPermits': {
        const headers = ['No', 'ID', 'Tanggal', 'Jam Keluar', 'Jam Kembali', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Izin', 'Alasan', 'Penjemput', 'Nama Penjemput', 'No HP Ortu', 'Guru Mapel', 'Status', 'Petugas'];
        const rows = filteredPermits.map((r, idx) => [
          idx + 1,
          r.id,
          r.tanggal,
          r.jamKeluar,
          r.jamKembali || '-',
          r.nisn,
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
        return make('Rekap Izin Keluar Siswa', headers, rows, [["Waktu / ID", [1, 2, 3, 4]], ["Identitas Siswa", [5, 6, 7]], ["Izin / Alasan", [8, 9]], ["Penjemput / Kontak", [10, 11, 12]], ["Guru / Status / Petugas", [13, 14, 15]]]);
      }
      case 'substitutions': {
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
        return make('Rekap Guru Pengganti Inval', headers, rows, [["Tanggal / ID", [1, 2]], ["Guru / Pelajaran", [3, 4]], ["Kelas / Jam", [5, 6]], ["Alasan / Materi", [7, 9]], ["Guru Pengganti", [8]], ["Status / Petugas", [10, 11]]]);
      }
      case 'visitors': {
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
          r.nomorIdentitas || '-',
          r.nomorBadge,
          r.tujuanBertemu,
          r.keperluan,
          r.status,
          r.petugasPiketName,
        ]);
        return make('Rekap Buku Tamu Digital', headers, rows, [["Waktu / ID", [1, 2, 3, 4]], ["Tamu / Instansi", [5, 6]], ["Kategori / Identitas", [7, 8, 9]], ["Badge / Tujuan", [10, 11]], ["Keperluan", [12]], ["Status / Petugas", [13, 14]]]);
      }
      default: return null;
    }
  }, [activeTab, periodLabel, startDate, endDate, attendanceSummaries, teachers, filteredIncidents, filteredDutyBooks, filteredTardiness, filteredPermits, filteredSubstitutions, filteredVisitors]);

  const handleExportActiveDocument = async (format: 'word' | 'pdf') => {
    if (isExportingDocument || !activeWordReport?.rows.length || !settingsReady || isLoadingData || dataLoadError || !dateValidation.isValid) return;
    setIsExportingDocument(true); setExportError('');
    try {
      const fileTitle = `${activeWordReport.title.replace(/[^\p{L}\p{N} -]/gu, '')}-${startDate}-${endDate}`;
      if (format === 'pdf') {
        const pdf = await import('../../utils/reportPdf'); pdf.downloadPdf(await pdf.createReportPdf(activeWordReport, settings), fileTitle);
      } else {
        const service = await import('../../utils/operationalReport');
        const assets = await service.loadReportAssets(settings), bytes = service.operationalReportDocx(activeWordReport, settings, assets);
        const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = fileTitle + '.docx';
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      if (currentUser) void FirestoreService.logAudit({ userId: currentUser.id, userName: currentUser.fullName, role: currentUser.role, action: 'EXPORT', module: 'REPORTS', details: `Mengekspor ${format === 'word' ? 'Word' : 'PDF'} ${activeWordReport.title}: ${activeWordReport.rows.length} catatan, periode ${startDate} s.d. ${endDate}` }).catch(console.warn);
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Dokumen belum dapat disiapkan. Coba kembali.'); }
    finally { setIsExportingDocument(false); }
  };

  return (
    <div data-tour="reports-container" className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart2 className="w-6 h-6 text-[var(--theme-primary)]" />
            Laporan, Rekapitulasi & Analitik Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Pilih periode untuk melihat, mengunduh, atau mencetak laporan.</p>
        </div>

        <div className="page-actions flex flex-wrap items-center gap-2">
          {/* Tombol Berikon Gambar dengan Label "Rekap Foto" pada Area Tindakan Atas Halaman (Dekat Tombol Cetak) */}
          <Button
            variant={activeTab === 'photoRecap' ? 'primary' : 'outline'}
            size="sm"
            leftIcon={<ImageIcon className={`w-4 h-4 ${activeTab === 'photoRecap' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />}
            onClick={() => {
              setActiveTab('photoRecap');
            }}
            className={`font-bold shadow-xs cursor-pointer transition-all ${
              activeTab === 'photoRecap'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                : 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            }`}
            title="Buka Rekap Foto Dokumentasi Sekolah"
          >
            <span className="flex items-center gap-1.5">
              <span>Rekap Foto</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'photoRecap'
                    ? 'bg-white text-indigo-700'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {allPhotoItems.length}
              </span>
            </span>
          </Button>

          {activeTab === 'photoRecap' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileBarChart2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
                onClick={() => setActiveTab('attendance')}
                className="font-semibold cursor-pointer"
              >
                Kembali ke Tabel Laporan
              </Button>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => setIsPhotoRecapPrintOpen(true)}
                disabled={selectedPhotosList.length === 0}
                className="font-bold cursor-pointer shadow-sm"
              >
                Pratinjau Dokumentasi Foto ({selectedPhotosList.length})
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4"/>}
                disabled={!dateValidation.isValid || isLoadingData || !!dataLoadError || !settingsReady}
                onClick={() => { setExportError(''); setIsReportActionsOpen(true); }}>
                Pratinjau & Ekspor
              </Button>
            </>
          )}
        </div>
      </div>

      {/* FILTER PERIODE REKAP (DROPDOWN PERIODE LAPORAN) */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Mode Selector Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
              <label htmlFor="period-mode-select" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Periode Laporan:
              </label>
            </div>

            <div className="w-full sm:w-auto min-w-[220px]">
              <label className="app-filter-field"><span>Periode</span><select
                id="period-mode-select"
                aria-label="Periode Laporan"
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as ReportPeriodMode)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none cursor-pointer shadow-xs transition-colors"
              >
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="semester">Semester</option>
                <option value="yearly">Tahunan</option>
                <option value="custom">Rentang Khusus</option>
              </select></label>
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
                        <option key={m.value} value={m.value}>{m.label}
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

      {/* Quick Select for Mobile / Compact screens */}
      <div className="lg:hidden flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <label htmlFor="quick-report-tab-select" className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
          <FileBarChart2 className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
          <span>Menu Laporan:</span>
        </label>
        <select
          id="quick-report-tab-select"
          aria-label="Pilih Tampilan Laporan"
          value={activeTab}
          onChange={(e) => {
            setActiveTab(e.target.value as ReportTab);
            setSearchQuery('');
          }}
          className="w-full max-w-[260px] text-xs font-bold p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] cursor-pointer"
        >
          <option value="attendance">Presensi Guru ({attendanceSummaries.length})</option>
          <option value="incidents">Insiden Kejadian ({totalIncidents})</option>
          <option value="dutyBooks">Jurnal Buku Piket ({filteredDutyBooks.length})</option>
          <option value="studentTardiness">Keterlambatan Siswa ({filteredTardiness.length})</option>
          <option value="studentPermits">Izin Meninggalkan Sekolah ({filteredPermits.length})</option>
          <option value="substitutions">Guru Pengganti (Inval) ({filteredSubstitutions.length})</option>
          <option value="visitors">Buku Tamu Sekolah ({filteredVisitors.length})</option>
          <option value="photoRecap">Rekap Foto Dokumentasi ({allPhotoItems.length})</option>
        </select>
      </div>

      {/* REPORT TABS NAVIGATION (8 TABS TOTAL) */}
      <div className="relative">
        <div
          ref={tabListRef}
          className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-[var(--theme-card-border)]"
        >
          {[
            { id: 'attendance', label: 'Presensi Guru', icon: Users, count: attendanceSummaries.length },
            { id: 'incidents', label: 'Insiden Kejadian', icon: AlertTriangle, count: totalIncidents },
            { id: 'dutyBooks', label: 'Jurnal Buku Piket', icon: BookOpenCheck, count: filteredDutyBooks.length },
            { id: 'studentTardiness', label: 'Keterlambatan Siswa', icon: UserX, count: filteredTardiness.length },
            { id: 'studentPermits', label: 'Izin Meninggalkan Sekolah', icon: FileText, count: filteredPermits.length },
            { id: 'substitutions', label: 'Guru Pengganti (Inval)', icon: GraduationCap, count: filteredSubstitutions.length },
            { id: 'visitors', label: 'Buku Tamu Sekolah', icon: Building, count: filteredVisitors.length },
            { id: 'photoRecap', label: 'Rekap Foto', icon: ImageIcon, count: allPhotoItems.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isPhoto = tab.id === 'photoRecap';
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as ReportTab);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? isPhoto
                      ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 rounded-t-xl font-bold shadow-xs ring-1 ring-indigo-500/30'
                      : 'border-[var(--theme-primary)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] bg-[var(--theme-primary-light)]/50 dark:bg-[var(--theme-primary-light)]/20 rounded-t-xl font-bold'
                    : isPhoto
                      ? 'border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold rounded-t-xl'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isPhoto ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? isPhoto
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)]'
                      : isPhoto
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                        : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
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

      {/* TAB 8: PHOTO RECAP (REKAP FOTO DOKUMENTASI BULANAN) */}
      {activeTab === 'photoRecap' && (
        <div className="space-y-4">
          {/* Top Control Bar: Module Filter & Bulk Selection */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Filter Modul Dokumentasi:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: 'Semua Modul' },
                    { id: 'ATTENDANCE', label: 'Presensi GPS' },
                    { id: 'INCIDENT', label: 'Laporan Kejadian' },
                    { id: 'STUDENT_TARDY', label: 'Siswa Terlambat' },
                    { id: 'VISITOR', label: 'Buku Tamu' },
                  ].map((m) => {
                    const isMActive = photoModuleFilter === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPhotoModuleFilter(m.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                          isMActive
                            ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-xs font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleSelectAllFiltered}
                    disabled={filteredPhotoItems.length === 0}
                    leftIcon={
                      selectedPhotoIds.size === filteredPhotoItems.length && filteredPhotoItems.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {selectedPhotoIds.size === filteredPhotoItems.length && filteredPhotoItems.length > 0
                      ? 'Batal Pilih Semua'
                      : 'Pilih Seluruh Hasil Filter'}
                  </Button>

                  <span className="text-slate-500 font-medium">
                    {selectedPhotoIds.size > 0 ? (
                      <span className="font-bold text-[var(--theme-primary)]">
                        {selectedPhotoIds.size} dari {filteredPhotoItems.length} foto dipilih
                      </span>
                    ) : (
                      <span>Total {filteredPhotoItems.length} foto tersedia</span>
                    )}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="font-bold shadow-md text-xs"
                  leftIcon={<Printer className="w-3.5 h-3.5" />}
                  onClick={() => setIsPhotoRecapPrintOpen(true)}
                  disabled={filteredPhotoItems.length === 0}
                >
                  Pratinjau / Unduh PDF Foto ({selectedPhotosList.length} Foto)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Photo Cards Grid */}
          {isLoadingData ? (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Memuat Dokumentasi Foto...
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Sedang mengambil berkas foto dan bukti lapangan dari database sekolah...
                </p>
              </CardContent>
            </Card>
          ) : dataLoadError ? (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Gagal Mengambil Data Foto
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {dataLoadError}
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="text-xs font-semibold"
                  >
                    Muat Ulang Halaman
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredPhotoItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                {allPhotoItems.length === 0 ? (
                  <>
                    <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Belum ada foto pada periode yang dipilih
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Belum ditemukan foto dokumentasi bukti pada periode {periodLabel} dari modul Presensi GPS, Laporan Kejadian, Siswa Terlambat, maupun Buku Tamu.
                      Coba sesuaikan pilihan Periode Laporan di bagian atas atau periksa entri data sekolah.
                    </p>
                  </>
                ) : (
                  <>
                    <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Tidak ada foto yang cocok
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Ditemukan {allPhotoItems.length} foto pada periode ini, namun tidak ada yang cocok dengan filter modul atau kata kunci "{searchQuery}".
                    </p>
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPhotoModuleFilter('ALL');
                          setSearchQuery('');
                        }}
                        className="text-xs font-semibold"
                      >
                        Reset Filter &amp; Pencarian
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedPhotos.map((photo) => (
                  <PhotoCardItem
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedPhotoIds.has(photo.id)}
                    onToggleSelect={handleToggleSelectPhoto}
                    onPreview={setPreviewPhotoItem}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPhotoPages > 1 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500">
                    Menampilkan {(photoRecapPage - 1) * PHOTO_PAGE_SIZE + 1} s.d{' '}
                    {Math.min(photoRecapPage * PHOTO_PAGE_SIZE, filteredPhotoItems.length)} dari{' '}
                    {filteredPhotoItems.length} foto
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPhotoRecapPage((p) => Math.max(1, p - 1))}
                      disabled={photoRecapPage === 1}
                      leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                    >
                      Sebelumnya
                    </Button>
                    <span className="px-3 py-1 font-mono font-bold text-slate-700 dark:text-slate-300">
                      Hal {photoRecapPage} / {totalPhotoPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPhotoRecapPage((p) => Math.min(totalPhotoPages, p + 1))}
                      disabled={photoRecapPage === totalPhotoPages}
                      rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SINGLE PHOTO DETAIL ZOOM MODAL */}
      {previewPhotoItem && (
        <Modal
          isOpen={previewPhotoItem !== null}
          onClose={() => setPreviewPhotoItem(null)}
          title="Detail Foto Dokumentasi"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center p-2 border border-slate-800">
              <AuthenticatedImage
                src={previewPhotoItem.photoUrl}
                alt={previewPhotoItem.title}
                className="max-h-[60vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>

            <div className="space-y-2 text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {previewPhotoItem.title}
                </span>
                {previewPhotoItem.isLegacyUnwatermarked ? (
                  <Badge variant="warning">Foto Arsip (Non-watermark)</Badge>
                ) : (
                  <Badge variant="success">Berwatermark Resmi</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  <strong>Identitas:</strong> {previewPhotoItem.briefIdentity}
                </div>
                <div>
                  <strong>Tanggal Kejadian:</strong> {formatIndonesianDate(previewPhotoItem.tanggalKejadian)}
                  {previewPhotoItem.waktuKejadian ? ` (${previewPhotoItem.waktuKejadian})` : ''}
                </div>
                {previewPhotoItem.tanggalDokumentasi && (
                  <div>
                    <strong>Tanggal Foto:</strong> {formatIndonesianDate(previewPhotoItem.tanggalDokumentasi)}
                    {previewPhotoItem.waktuDokumentasi ? ` (${previewPhotoItem.waktuDokumentasi})` : ''}
                  </div>
                )}
                {previewPhotoItem.petugasName && (
                  <div>
                    <strong>Petugas Pencatat:</strong> {previewPhotoItem.petugasName}
                  </div>
                )}
              </div>

              {previewPhotoItem.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 italic">
                  <strong>Catatan:</strong> {previewPhotoItem.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewPhotoItem(null)}>
                Tutup Pratinjau
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={isReportActionsOpen} onClose={() => { if (!isExportingDocument) setIsReportActionsOpen(false); }} title="Pratinjau & Ekspor Laporan" maxWidth="md">
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Periode: {periodLabel}. Kop dan tanda tangan mengikuti pengaturan admin.</p>
          <section className="rounded-xl border border-[var(--theme-card-border)] p-4 space-y-2">
            <h3 className="font-semibold">Rekap lengkap</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gabungan seluruh modul pada periode ini. Periksa tata letak sebelum mencetak atau mengunduh PDF.</p>
            <Button size="sm" variant="outline" disabled={isExportingDocument} leftIcon={<Printer className="w-4 h-4"/>} onClick={() => { setIsReportActionsOpen(false); setIsPrintModalOpen(true); }}>Pratinjau & Cetak Resmi</Button>
          </section>
          <section className="rounded-xl border border-[var(--theme-card-border)] p-4 space-y-2">
            <h3 className="font-semibold">Unduhan tab aktif</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeWordReport?.title} · {activeWordReport?.rows.length || 0} catatan. Mencakup seluruh hasil filter yang tampil pada tab ini.</p>
            <Button size="sm" disabled={isExportingDocument || !activeWordReport?.rows.length} leftIcon={<Download className="w-4 h-4"/>} onClick={() => void handleExportActiveDocument('word')}>{isExportingDocument ? 'Menyiapkan dokumen…' : 'Unduh Word Tab Aktif'}</Button>
            <Button size="sm" variant="outline" disabled={isExportingDocument || !activeWordReport?.rows.length} leftIcon={<Download className="w-4 h-4"/>} onClick={() => void handleExportActiveDocument('pdf')}>Unduh PDF Tab Aktif</Button>
          </section>
          {exportError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{exportError}</p>}
        </div>
      </Modal>

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

      {/* PHOTO RECAP PRINT MODAL (LAMPIRAN DOKUMENTASI BULANAN A4) */}
      <PhotoRecapPrintModal
        isOpen={isPhotoRecapPrintOpen}
        onClose={() => setIsPhotoRecapPrintOpen(false)}
        settings={settings}
        periodLabel={periodLabel}
        selectedPhotos={selectedPhotosList}
      />
    </div>
  );
};
