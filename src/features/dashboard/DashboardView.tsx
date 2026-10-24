import { useWibToday } from '../../hooks/useWibToday';
import { DashboardWelcome } from './DashboardWelcome';
import { DashboardStatistics, type DashboardStatistic } from './DashboardStatistics';
import { buildDailyStatisticSeries } from './dashboardStatisticSeries';
import { DashboardFlashInfo, type DashboardFlashSlide } from './DashboardFlashInfo';
import { sanitizeDashboardInfoConfig } from '../../types/dashboardInfo.types';
import { useNavigation } from '../../contexts/NavigationContext';
import { Modal } from '../../components/common/Modal';
import { UserAvatar } from '../../components/common/UserAvatar';
import { QuickActions } from './QuickActions';
import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  LayoutDashboard,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  BookOpenCheck,
  ShieldCheck,
  Users,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Megaphone,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Info,
  Building2,
  Sparkles,
  UserX,
  FileText,
  GraduationCap,
  Building,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS, type PermissionKey } from '../../config/permissions';
import { where } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { AnnouncementService } from '../../services/firebase/announcementService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import {
  ScheduleItem,
  AttendanceRecord,
  SchoolSettings,
} from '../../types';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { IncidentRecord, getIncidentCategoryDisplay } from '../../types/incident.types';
import { AnnouncementRecord, AnnouncementSaveInput, sanitizeAnnouncementConfig } from '../../types/announcement.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatShortIndonesianDate, formatTime, getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import { isScheduleMatchingUser, isScheduleOnDate } from '../../utils/scheduleUtils';
import { nextDutyDate, dutyRosterForDate } from '../../utils/dutyRoster';
import { buildSubstitutionFlashSummary } from './substitutionFlashSummary';

interface DashboardViewProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const { currentUser, hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const { subView, setSubView } = useNavigation();
  const [detailPanel, setDetailPanel] = useState<'announcements' | 'dutyRoster' | 'dutyRosterTomorrow' | 'incidents' | null>(null);
  const [focusedAnnouncementId, setFocusedAnnouncementId] = useState<string | null>(null);
  const focusedOnce = useRef<string | null>(null);
  const openAnnouncements = () => { setFocusedAnnouncementId(null); focusedOnce.current = null; setDetailPanel('announcements'); };
  useEffect(() => {
    if (!subView?.startsWith('announcement:')) return;
    setFocusedAnnouncementId(subView.slice('announcement:'.length));
    focusedOnce.current = null;
    setDetailPanel('announcements');
    setSubView(null);
  }, [subView, setSubView]);

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [studentTardiness, setStudentTardiness] = useState<StudentTardyRecord[]>([]);
  const [studentPermits, setStudentPermits] = useState<StudentPermitRecord[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [substitutionReadState, setSubstitutionReadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);

  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementFeedback, setAnnouncementFeedback] = useState('');
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<string | null>(null);
  const announcementConfig = sanitizeAnnouncementConfig(settings.announcementConfig);

  // Modals
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRecord | null>(null);
  const openAnnouncementForm = (record: AnnouncementRecord | null) => {
    setEditingAnnouncement(record); setAnnouncementFeedback(''); setDetailPanel(null); setIsAnnModalOpen(true);
  };
  const closeAnnouncementForm = () => {
    setIsAnnModalOpen(false); setEditingAnnouncement(null); setDetailPanel('announcements');
  };
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: '',
  });

  const [showDutyDetails, setShowDutyDetails] = useState(false);
  const [dutyRevealRequest, setDutyRevealRequest] = useState(0);
  const toggleDutyDetails = () => setShowDutyDetails(value => !value);
  const revealDutyDetails = () => {
    // A link to the details always opens them, even if they were already expanded.
    setShowDutyDetails(true);
    setDutyRevealRequest(value => value + 1);
  };
  useEffect(() => {
    if (!dutyRevealRequest) return;
    // Run after React commits the expanded body; repeat clicks still bring it into view.
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('personal-duty-details')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [dutyRevealRequest]);
  const todayISO = useWibToday();
  const todayName = getCurrentDayName(todayISO);
  const tomorrowISO = nextDutyDate(todayISO);
  const canViewSubstitutions = hasPermission(PERMISSIONS.SUBSTITUTIONS_VIEW);

  useEffect(() => {
    let active = true;
    setSubstitutions([]);
    setSubstitutionReadState('loading');
    if (!canViewSubstitutions) return;
    const unsubscribe = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>(
      'substitutions',
      data => { if (active) { setSubstitutions(data); setSubstitutionReadState('ready'); } },
      () => { if (active) { setSubstitutions([]); setSubstitutionReadState('error'); } },
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    return () => { active = false; unsubscribe(); };
  }, [todayISO, canViewSubstitutions, currentUser?.id]);

  useEffect(() => {
    AnnouncementService.bootstrapIfEmpty();

    const unsubSettings = FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', data => {
      setSettings(data || DEFAULT_SCHOOL_SETTINGS);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
      setIsLoadingMetrics(false);
    });
    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', setStaff);
    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>(
      'attendance',
      setAttendance,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    const unsubBooks = FirestoreService.subscribeToCollection<DutyBookRecord>(
      'dutyBooks',
      setDutyBooks,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>(
      'incidents',
      setIncidents,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    const unsubAnn = FirestoreService.subscribeToCollection<AnnouncementRecord>(
      'announcements',
      (data) => {
        setAnnouncements([...data].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
        setIsLoadingAnnouncements(false);
        setAnnouncementError('');
      },
      () => { setIsLoadingAnnouncements(false); setAnnouncementError('Papan pengumuman belum tersambung. Periksa koneksi dan izin akun.'); },
      [where('isActive', '==', true)], { cacheKey: 'active' }
    );
    const unsubTardy = FirestoreService.subscribeToCollection<StudentTardyRecord>(
      'studentTardiness',
      setStudentTardiness,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>(
      'studentPermits',
      setStudentPermits,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );
    const unsubVisitors = FirestoreService.subscribeToCollection<VisitorRecord>(
      'visitors',
      setVisitors,
      undefined,
      [where('tanggal', '==', todayISO)], { cacheKey: `today:${todayISO}` }
    );

    return () => {
      unsubSettings();
      unsubSched();
      unsubTeachers();
      unsubStaff();
      unsubAtt();
      unsubBooks();
      unsubInc();
      unsubAnn();
      unsubTardy();
      unsubPermits();
      unsubVisitors();
    };
  }, [todayISO]);

  // Today's schedules & operational items
  const todaySchedules = dutyRosterForDate(schedules, todayISO);
  const tomorrowSchedules = dutyRosterForDate(schedules, tomorrowISO);
  const todayAttendance = attendance.filter((a) => a.tanggal === todayISO);
  const todayDutyBook = dutyBooks.find((b) => b.tanggal === todayISO);
  const todayIncidents = incidents.filter((i) => i.tanggal === todayISO);
  const todayTardiness = studentTardiness.filter((t) => t.tanggal === todayISO);
  const todayPermits = studentPermits.filter((p) => p.tanggal === todayISO);
  const todaySubstitutions = substitutions.filter((s) => s.tanggal === todayISO);
  const todayVisitors = visitors.filter((v) => v.tanggal === todayISO);

  // Personal duty schedule & status for currentUser (supports users.id and legacy teacher.id)
  const isMySchedule = (s: ScheduleItem) => isScheduleMatchingUser(s, currentUser, teachers, staff);

  const myTodaySchedule = schedules.find((s) => isScheduleOnDate(s, todayISO) && isMySchedule(s));
  const myAttendance = attendance.find((a) => a.tanggal === todayISO && a.userId === currentUser?.id);
  const myDutyBook = dutyBooks.find((b) => b.tanggal === todayISO && (b.petugasId === currentUser?.id || (teachers.some(t => t.userId === currentUser?.id && t.id === b.petugasId))));
  const myOtherSchedules = schedules.filter((s) => isMySchedule(s) && !isScheduleOnDate(s, todayISO) && s.status !== 'DIBATALKAN' && (s.recurrence !== 'ONCE' || s.tanggal >= todayISO));

  // Present count today
  const presentCount = todayAttendance.filter((a) => a.status === 'DALAM_LOKASI').length;
  const attendancePercentage = todaySchedules.length > 0
    ? Math.round((presentCount / todaySchedules.length) * 100)
    : 0;

  // Handler for WhatsApp Reminder to Teacher
  const handleSendWaReminder = (schedule: ScheduleItem) => {
    const msg = WhatsAppService.getScheduleReminderMessage(schedule, settings.schoolName);
    setWaModalData({
      isOpen: true,
      phone: '',
      message: msg,
      title: `Kirim Pengingat WhatsApp ke ${schedule.petugasName}`,
    });
  };

  const handleSaveAnnouncement = async (data: AnnouncementSaveInput) => {
    if (!currentUser) throw new Error('Sesi berakhir. Silakan masuk kembali.');
    await AnnouncementService.saveAnnouncement(data, currentUser);
    setAnnouncementFeedback(data.id ? 'Perubahan pengumuman berhasil disimpan.' : 'Pengumuman berhasil diterbitkan.');
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id: string) => {
    if (!currentUser || deletingAnnouncement || !window.confirm('Hapus pengumuman ini? Informasi akan hilang dari papan pengumuman pengguna.')) return;
    setDeletingAnnouncement(id); setAnnouncementFeedback('');
    try {
      await AnnouncementService.deleteAnnouncement(id, currentUser);
      setAnnouncementFeedback('Pengumuman berhasil dihapus.');
    } catch (error) { setAnnouncementFeedback(error instanceof Error ? error.message : 'Pengumuman gagal dihapus. Coba lagi.'); }
    finally { setDeletingAnnouncement(null); }
  };

  const visibleAnnouncements = announcements.filter(a => {
    const target = a.targetRole || 'SEMUA';
    return a.isActive && !a.isDemo && a.dataSource !== 'SEED' && (isAdmin || target === 'SEMUA' || target === currentUser?.role || (target === 'TENDIK' && currentUser?.role === 'TENAGA_KEPENDIDIKAN'));
  });
  useEffect(() => {
    if (detailPanel !== 'announcements' || !focusedAnnouncementId || isLoadingAnnouncements || focusedOnce.current === focusedAnnouncementId) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`dashboard-announcement-${encodeURIComponent(focusedAnnouncementId)}`);
      if (!target) return;
      focusedOnce.current = focusedAnnouncementId;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [detailPanel, focusedAnnouncementId, isLoadingAnnouncements, announcements]);
  const flashConfig = sanitizeDashboardInfoConfig(settings.dashboardInfoConfig);
  const substitutionSummary = buildSubstitutionFlashSummary(substitutions, todayISO);
  const operationItems = [
    hasPermission(PERMISSIONS.STUDENT_TARDY_VIEW) && { id: 'tardy', title: `${todayTardiness.length} siswa terlambat`, detail: 'Pencatatan hari ini' },
    hasPermission(PERMISSIONS.STUDENT_PERMITS_VIEW) && { id: 'permits', title: `${todayPermits.filter(p => p.status === 'SEDANG_KELUAR').length} izin siswa masih di luar`, detail: `${todayPermits.length} izin tercatat hari ini` },
    hasPermission(PERMISSIONS.VISITORS_VIEW) && { id: 'visitors', title: `${todayVisitors.length} tamu sekolah`, detail: `${todayVisitors.filter(v => v.status === 'SEDANG_BERKUNJUNG').length} kunjungan berlangsung hari ini` },
  ].filter(Boolean) as DashboardFlashSlide['items'];
  const flashSlides: DashboardFlashSlide[] = [
    { id: 'announcements' as const, title: 'Pengumuman & Instruksi Piket', icon: Megaphone, items: visibleAnnouncements.map(a => ({ id: a.id, title: a.title, detail: a.content })), emptyText: isLoadingAnnouncements ? 'Memuat pengumuman…' : 'Belum ada pengumuman aktif untuk Anda.', actionLabel: 'Buka pengumuman', onAction: openAnnouncements },
    ...(hasPermission(PERMISSIONS.SCHEDULE_VIEW) ? [
      { id: 'dutyRoster' as const, title: 'Guru Bertugas Hari Ini', caption: `${formatIndonesianDate(todayISO)} · ${todaySchedules.length} penugasan`, icon: Users, items: todaySchedules.map(item => ({ id: item.id, title: item.petugasName, detail: `${item.ruangName} · ${item.jamMulai}–${item.jamSelesai} WIB` })), emptyText: 'Tidak ada jadwal piket hari ini.', actionLabel: 'Buka daftar guru', onAction: () => setDetailPanel('dutyRoster') },
      { id: 'dutyRosterTomorrow' as const, title: 'Guru Bertugas Besok', caption: `${formatIndonesianDate(tomorrowISO)} · ${tomorrowSchedules.length} penugasan`, icon: Users, items: tomorrowSchedules.map(item => ({ id: item.id, title: item.petugasName, detail: `${item.ruangName} · ${item.jamMulai}–${item.jamSelesai} WIB` })), emptyText: 'Belum ada jadwal piket untuk besok.', actionLabel: 'Buka petugas besok', onAction: () => setDetailPanel('dutyRosterTomorrow') },
    ] : []),
    ...(canViewSubstitutions ? [{
      id: 'substitutions' as const, title: 'Guru Berhalangan & Tugas Inval', icon: GraduationCap,
      caption: substitutionReadState === 'ready'
        ? `${substitutionSummary.teacherCount} guru · ${substitutionSummary.taskCount} tugas · ${substitutionSummary.pendingCount} menunggu pengganti`
        : undefined,
      items: substitutionSummary.items,
      emptyText: substitutionReadState === 'loading' ? 'Memuat penugasan inval hari ini…'
        : substitutionReadState === 'error' ? 'Data inval belum tersambung. Periksa koneksi atau buka menu Guru Pengganti.'
        : 'Belum ada guru berhalangan atau tugas inval yang tercatat hari ini.',
      actionLabel: 'Buka rincian inval',
      onAction: () => { if (hasPermission(PERMISSIONS.SUBSTITUTIONS_VIEW)) onNavigateTab('substitutions'); },
    }] : []),
    ...(hasPermission(PERMISSIONS.INCIDENT_VIEW) ? [{ id: 'incidents' as const, title: 'Insiden & Kejadian Terbaru', icon: AlertTriangle, items: [...todayIncidents].sort((a, b) => (b.waktu || '').localeCompare(a.waktu || '')).map(item => ({ id: item.id, title: `[${getIncidentCategoryDisplay(item)}] ${item.lokasi}`, detail: `${item.waktu} WIB · ${item.uraian}` })), emptyText: 'Belum ada kejadian yang dilaporkan hari ini.', actionLabel: 'Buka laporan kejadian', onAction: () => setDetailPanel('incidents') }] : []),
    ...(operationItems.length ? [{ id: 'operations' as const, title: 'Kegiatan Sekolah Hari Ini', icon: Building2, items: operationItems, emptyText: 'Belum ada kegiatan tercatat.', actionLabel: 'Lihat rincian tugas', onAction: revealDutyDetails, expanded: showDutyDetails, controls: 'personal-duty-body' }] : []),
  ].filter(slide => flashConfig.panels[slide.id]);
  const bookStage = todayDutyBook ? getDutyBookDisplayStatus(todayDutyBook.status) : null;
  const statistics: (DashboardStatistic & { permission: PermissionKey })[] = [
    { tab: 'schedules', permission: PERMISSIONS.SCHEDULE_VIEW, title: 'Petugas Hari Ini', value: todaySchedules.length, unit: 'guru', detail: `Shift ${todayName.toLocaleLowerCase('id-ID')}`, icon: Users, series: buildDailyStatisticSeries(todaySchedules.map(item => item.jamMulai), todayISO, true), chartLabel: 'Akumulasi jadwal terencana hari ini menurut jam mulai' },
    { tab: 'attendance', permission: PERMISSIONS.ATTENDANCE_VIEW, title: 'Kehadiran GPS', value: attendancePercentage, unit: '%', detail: `${presentCount} dari ${todaySchedules.length} terverifikasi`, icon: ShieldCheck, series: buildDailyStatisticSeries(todayAttendance.filter(item => item.status === 'DALAM_LOKASI').map(item => item.jamMasuk), todayISO), chartLabel: 'Akumulasi presensi GPS terverifikasi hari ini menurut jam masuk' },
    { tab: 'duty-book', permission: PERMISSIONS.DUTYBOOK_VIEW, title: 'Buku Piket', value: bookStage?.label || 'Belum dibuat', detail: todayDutyBook ? 'Tahap jurnal hari ini' : 'Siap diisi', icon: BookOpenCheck, stage: bookStage ? { DRAFT: 1, TERKIRIM: 2, SELESAI: 3 }[bookStage.stage] : 0 },
    { tab: 'incidents', permission: PERMISSIONS.INCIDENT_VIEW, title: 'Insiden Terlapor', value: todayIncidents.length, unit: 'kejadian', detail: `${todayIncidents.filter(item => item.status === 'SELESAI').length} tuntas ditangani`, icon: AlertTriangle, series: buildDailyStatisticSeries(todayIncidents.map(item => item.waktu), todayISO) },
    { tab: 'student-tardiness', permission: PERMISSIONS.STUDENT_TARDY_VIEW, title: 'Siswa Terlambat', value: todayTardiness.length, unit: 'siswa', detail: 'Masuk gerbang hari ini', icon: UserX, series: buildDailyStatisticSeries(todayTardiness.map(item => item.jamDatang), todayISO) },
    { tab: 'student-permits', permission: PERMISSIONS.STUDENT_PERMITS_VIEW, title: 'Izin Keluar Kelas', value: todayPermits.length, unit: 'siswa', detail: `${todayPermits.filter(item => item.status === 'SEDANG_KELUAR').length} masih di luar`, icon: FileText, series: buildDailyStatisticSeries(todayPermits.map(item => item.jamKeluar), todayISO) },
    { tab: 'substitutions', permission: PERMISSIONS.SUBSTITUTIONS_VIEW, title: 'Guru Pengganti', value: todaySubstitutions.length, unit: 'tugas', detail: 'Penugasan inval hari ini', icon: GraduationCap, series: buildDailyStatisticSeries(todaySubstitutions.map(item => item.createdAt), todayISO), chartLabel: 'Akumulasi penugasan inval yang dicatat hari ini' },
    { tab: 'visitors', permission: PERMISSIONS.VISITORS_VIEW, title: 'Buku Tamu', value: todayVisitors.length, unit: 'tamu', detail: `${todayVisitors.filter(item => item.status === 'SEDANG_BERKUNJUNG').length} sedang berkunjung`, icon: Building, series: buildDailyStatisticSeries(todayVisitors.map(item => item.jamMasuk), todayISO) },
  ];
  const visibleStatistics = statistics.filter(item => hasPermission(item.permission));
  const activitySlide: DashboardFlashSlide = {
    id: 'activity', title: isLoadingMetrics ? 'Menyiapkan kegiatan Anda…' : myTodaySchedule ? 'Piket Anda hari ini' : 'Kegiatan sekolah, lebih praktis',
    icon: myTodaySchedule ? Calendar : LayoutDashboard,
    // Compact theme-colored icon replaces the oversized tilted book artwork.
    // The panel content, details action and carousel logic remain unchanged.
    illustration: <span className="dashboard-activity-mark" aria-hidden="true">
      {myTodaySchedule ? <Calendar className="dashboard-activity-mark-glyph" /> : <LayoutDashboard className="dashboard-activity-mark-glyph" />}
    </span>,
    description: myTodaySchedule ? `${myTodaySchedule.ruangName} · ${myTodaySchedule.jamMulai}–${myTodaySchedule.jamSelesai} WIB` : 'Buka menu favorit dan temukan informasi piket dalam satu tempat.',
    items: [], emptyText: '', actionLabel: showDutyDetails ? 'Tutup rincian tugas' : 'Lihat rincian tugas', onAction: showDutyDetails ? toggleDutyDetails : revealDutyDetails, expanded: showDutyDetails, controls: 'personal-duty-body',
  };
  const dashboardSlides = [activitySlide, ...(flashConfig.enabled ? flashSlides : [])];
  const announcementBoard = (
<Card className="announcement-board">
        <CardHeader
          title="Papan Pengumuman & Instruksi Khusus Piket"
          subtitle="Pemberitahuan resmi dari Kepala Sekolah dan Koordinator Piket"
          action={
            isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Plus className="w-3.5 h-3.5 text-[var(--theme-primary)]" />}
                onClick={() => openAnnouncementForm(null)}
              >
                + Buat Pengumuman
              </Button>
            )
          }
        />
        <CardContent className="p-4 sm:p-5">
          {announcementFeedback && <p role="status" className="mb-3 text-sm text-[var(--theme-primary-text)]">{announcementFeedback}</p>}
          {announcementError && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-200">{announcementError}</p>}
          {isAdmin && !announcementConfig.allowPublishedEditing && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Edit pengumuman dinonaktifkan. Admin dapat mengaktifkannya di Pengaturan → Notifikasi & Pengumuman.</p>}
          {focusedAnnouncementId && !isLoadingAnnouncements && !visibleAnnouncements.some(a => a.id === focusedAnnouncementId) && <p role="status" className="mb-3 p-3 rounded-xl bg-[var(--theme-surface-subtle)] text-xs">Pengumuman yang dipilih sudah tidak tersedia atau tidak ditujukan untuk akun ini. Pengumuman aktif lainnya ditampilkan di bawah.</p>}
          {isLoadingAnnouncements ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 animate-pulse space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700/60 rounded" />
                <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700/60 rounded" />
              </div>
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 animate-pulse space-y-2">
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700/60 rounded" />
                <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700/60 rounded" />
              </div>
            </div>
          ) : visibleAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  id={`dashboard-announcement-${encodeURIComponent(ann.id)}`}
                  tabIndex={-1}
                  className={`p-4 rounded-2xl border transition-all focus:outline-none ${focusedAnnouncementId === ann.id ? 'ring-2 ring-[var(--theme-primary-text)] ring-offset-2 dark:ring-offset-[var(--theme-card-bg)]' : ''} ${
                    ann.priority === 'DARURAT'
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                      : ann.priority === 'PENTING'
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                      <Badge
                        variant={ann.priority === 'DARURAT' ? 'danger' : ann.priority === 'PENTING' ? 'warning' : 'info'}
                        size="sm" className="announcement-priority"
                      >
                        {ann.priority}
                      </Badge>

                    {isAdmin && <div className="flex items-center gap-1 shrink-0">
                      {announcementConfig.allowPublishedEditing && <button type="button"
                        onClick={() => openAnnouncementForm(ann)}
                        aria-label={`Edit pengumuman: ${ann.title}`}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2 text-xs font-medium text-current rounded-lg hover:bg-black/5 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]">
                        <Edit3 className="w-4 h-4" /><span>Edit</span>
                      </button>}
                      <button type="button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        disabled={!!deletingAnnouncement}
                        aria-label={`Hapus pengumuman: ${ann.title}`}
                        className="inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 cursor-pointer w-11 h-11 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                        title="Hapus Pengumuman"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>}
                  </div>

                  <h4 className="announcement-title mt-2 font-bold break-words min-w-0 [overflow-wrap:anywhere]">{ann.title}</h4>
                  <p className="announcement-body mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] opacity-90">
                    {ann.content}
                  </p>

                  <div className="announcement-meta flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400 pt-2.5 mt-2.5 border-t border-black/5 dark:border-white/5">
                    <span>Oleh: <strong>{ann.authorName}</strong></span>
                    <span>{formatShortIndonesianDate(ann.date)}</span>
                  </div>
                  {announcementConfig.showUpdateInfo && ann.updatedBy && ann.updatedAt && <p className="announcement-meta mt-2 text-slate-500 dark:text-slate-400 break-words">Diperbarui {formatShortIndonesianDate(ann.updatedAt)}, {formatTime(ann.updatedAt)}{ann.updatedByName ? ` oleh ${ann.updatedByName}` : ''}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs">
              Belum ada pengumuman instruksi khusus hari ini.
            </div>
          )}
        </CardContent>
      </Card>
  );
  const isTomorrowRoster = detailPanel === 'dutyRosterTomorrow';
  const rosterSchedules = isTomorrowRoster ? tomorrowSchedules : todaySchedules;
  const rosterTitle = isTomorrowRoster ? 'Daftar Guru Bertugas Besok' : 'Daftar Guru Bertugas Hari Ini';
  const dutyRosterBoard = (
<Card>
          <CardHeader
            title={rosterTitle}
            subtitle={`${formatIndonesianDate(isTomorrowRoster ? tomorrowISO : todayISO)} · ${rosterSchedules.length} penugasan`}
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]"
                onClick={() => { setDetailPanel(null); onNavigateTab('schedules'); }}
              >
                Lihat Semua Jadwal
              </Button>
            }
          />
          <CardContent className="p-0">
            {rosterSchedules.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {rosterSchedules.map((item) => {
                  const att = isTomorrowRoster ? undefined : todayAttendance.find((a) => a.userId === item.petugasId);
                  const isPresent = att?.status === 'DALAM_LOKASI';

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPresent
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                        }`}>
                          {item.petugasName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm break-words [overflow-wrap:anywhere] font-bold text-slate-900 dark:text-white">
                            {item.petugasName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center min-w-0 break-words [overflow-wrap:anywhere]"><MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />{item.ruangName}</span>
                            <span>•</span>
                            <span className="font-mono">{item.jamMulai} - {item.jamSelesai} WIB</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={isPresent ? 'success' : 'neutral'} size="sm">
                          {isTomorrowRoster ? 'Terjadwal' : isPresent ? 'Hadir (GPS)' : 'Belum Presensi'}
                        </Badge>

                        {/* WhatsApp reminder button */}
                        <button
                          type="button"
                          onClick={() => handleSendWaReminder(item)}
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 hover:bg-emerald-100 cursor-pointer transition-colors"
                          title="Kirim Pesan WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                {isTomorrowRoster ? 'Belum ada jadwal tugas piket untuk besok.' : 'Tidak ada jadwal tugas piket untuk hari ini.'}
              </div>
            )}
          </CardContent>
        </Card>
  );
  const incidentBoard = (
<Card>
          <CardHeader
            title="Laporan Insiden & Kejadian Terbaru"
            subtitle="Rekapitulasi peristiwa terkini yang memerlukan tindak lanjut"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]"
                onClick={() => { setDetailPanel(null); onNavigateTab('incidents'); }}
              >
                Buka Manajemen Insiden
              </Button>
            }
          />
          <CardContent className="p-0">
            {incidents.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {incidents.slice(0, 4).map((inc) => (
                  <div key={inc.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        [{getIncidentCategoryDisplay(inc)}] {inc.lokasi}
                      </span>
                      <Badge
                        variant={inc.status === 'SELESAI' ? 'success' : inc.tingkatKeparahan === 'KRITIS' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {inc.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                      {inc.uraian}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                      <span>Pihak: {inc.pihakTerlibat}</span>
                      <span>{formatIndonesianDate(inc.tanggal)} ({inc.waktu} WIB)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada insiden yang dilaporkan. Situasi sekolah aman dan kondusif.
              </div>
            )}
          </CardContent>
        </Card>
  );

  return (
    <div className="space-y-6">
      <DashboardWelcome config={settings.dashboardInfoConfig?.welcome} user={currentUser} />

      <DashboardFlashInfo config={flashConfig} slides={dashboardSlides} onAnnouncements={openAnnouncements} suspended={detailPanel !== null || isAnnModalOpen || waModalData.isOpen} />

      <QuickActions onNavigate={onNavigateTab} />

      {/* PERSONAL DUTY STATUS CARD (TEACHER DUTY HUD) */}
      <section className="dashboard-duty-disclosure" id="personal-duty-details">
        <button type="button" className="duty-disclosure-toggle" onClick={() => toggleDutyDetails()} aria-expanded={showDutyDetails} aria-controls="personal-duty-body"><span><BookOpenCheck className="w-5 h-5" />Rincian tugas Anda</span><ChevronDown className={`w-4 h-4 transition-transform ${showDutyDetails ? 'rotate-180' : ''}`} /></button>
        {showDutyDetails && <div id="personal-duty-body" className="pt-3">      <Card className="border-[var(--theme-primary-border)]/60 bg-linear-to-b from-[var(--theme-primary-light)]/40 to-white dark:from-[var(--theme-primary-light)]/20 dark:to-[var(--theme-card-bg)] shadow-md">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--theme-primary-border)]/40 pb-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={currentUser} className="w-10 h-10 rounded-2xl text-sm shadow-md" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Tugas Anda hari ini
                  </h2>
                  <Badge variant={myTodaySchedule ? 'primary' : 'neutral'} size="sm">
                    {formatIndonesianDate(new Date())}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {myTodaySchedule
                    ? `Terjadwal di ${myTodaySchedule.ruangName} (${myTodaySchedule.jamMulai} - ${myTodaySchedule.jamSelesai} WIB)`
                    : 'Tidak ada jadwal tugas piket untuk akun Anda hari ini.'}
                </p>
              </div>
            </div>

            {myTodaySchedule && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]/50 text-xs font-semibold self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                <span>Shift Aktif Hari Ini</span>
              </div>
            )}
          </div>

          {/* Details & Status Pill Grid */}
          {myTodaySchedule ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Box 1: Pos Piket */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--theme-surface-subtle)] border border-slate-200/80 dark:border-[var(--theme-card-border)] space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                  <span>Pos & Ruang Piket</span>
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {myTodaySchedule.ruangName}
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{myTodaySchedule.jamMulai} - {myTodaySchedule.jamSelesai} WIB</span>
                </div>
              </div>

              {/* Box 2: Status Presensi GPS */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--theme-surface-subtle)] border border-slate-200/80 dark:border-[var(--theme-card-border)] space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Status Presensi GPS</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={myAttendance ? (myAttendance.status === 'DALAM_LOKASI' ? 'success' : 'warning') : 'neutral'} size="sm">
                    {myAttendance ? (myAttendance.status === 'DALAM_LOKASI' ? 'Hadir (GPS Valid)' : 'Luar Radius') : 'Belum Presensi'}
                  </Badge>
                  {myAttendance && (
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatTime(myAttendance.jamMasuk)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {myAttendance
                    ? `Dicatat secara terverifikasi (Jarak: ${Math.round(myAttendance.distance || 0)}m)`
                    : 'Segera lakukan presensi mandiri saat tiba di pos piket'}
                </div>
              </div>

              {/* Box 3: Status Jurnal Buku Piket */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--theme-surface-subtle)] border border-slate-200/80 dark:border-[var(--theme-card-border)] space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <BookOpenCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Jurnal Buku Piket Anda</span>
                </span>
                <div className="flex items-center gap-2">
                  {myDutyBook ? (
                    (() => {
                      const displayInfo = getDutyBookDisplayStatus(myDutyBook.status);
                      return (
                        <Badge variant={displayInfo.variant} size="sm">
                          {displayInfo.label}
                        </Badge>
                      );
                    })()
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Belum Dibuat
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {myDutyBook
                    ? (myDutyBook.catatanPiket || 'Draft sedang dikerjakan')
                    : 'Silakan isi jurnal 7 aspek situasi sekolah hari ini'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white dark:bg-[var(--theme-surface-subtle)]/80 border border-slate-200/80 dark:border-[var(--theme-card-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-[var(--theme-card-bg)] text-slate-500 shrink-0">
                  <Info className="w-5 h-5 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Tidak ada penugasan piket hari ini.
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    {myOtherSchedules.length > 0 ? (
                      <>
                        Jadwal piket Anda berikutnya: {' '}
                        <strong>
                          {myOtherSchedules.map((s) => `${s.hari} (${s.ruangName} • ${s.jamMulai}-${s.jamSelesai} WIB)`).join(', ')}
                        </strong>
                      </>
                    ) : (
                      'Belum ada jadwal piket yang ditugaskan ke ID akun Anda. Anda tetap dapat memantau jurnal atau situasi umum sekolah.'
                    )}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-xs self-start sm:self-center shrink-0"
                onClick={() => onNavigateTab('schedules')}
              >
                Lihat Semua Jadwal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

        </div>}
      </section>

      <DashboardStatistics items={visibleStatistics} loading={isLoadingMetrics} onNavigate={onNavigateTab} />

      <Modal isOpen={detailPanel !== null} onClose={() => { setDetailPanel(null); setFocusedAnnouncementId(null); }} maxWidth="3xl"
        title={detailPanel === 'announcements' ? 'Papan Pengumuman & Instruksi Piket' : (detailPanel === 'dutyRoster' || detailPanel === 'dutyRosterTomorrow') ? rosterTitle : 'Laporan Insiden & Kejadian Terbaru'}>
        {detailPanel === 'announcements' && announcementBoard}
        {(detailPanel === 'dutyRoster' || detailPanel === 'dutyRosterTomorrow') && dutyRosterBoard}
        {detailPanel === 'incidents' && incidentBoard}
      </Modal>

      {/* ANNOUNCEMENT FORM MODAL */}
      <AnnouncementFormModal
        key={editingAnnouncement?.id || 'new'}
        isOpen={isAnnModalOpen}
        initialData={editingAnnouncement}
        onClose={closeAnnouncementForm}
        onSave={handleSaveAnnouncement}
      />

      {/* WHATSAPP SENDER MODAL */}
      <WhatsAppModal
        isOpen={waModalData.isOpen}
        onClose={() => setWaModalData({ ...waModalData, isOpen: false })}
        title={waModalData.title}
        defaultPhone={waModalData.phone}
        defaultMessage={waModalData.message}
      />
    </div>
  );
};
