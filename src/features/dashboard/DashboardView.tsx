import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  BookOpenCheck,
  ShieldCheck,
  Users,
  ChevronRight,
  TrendingUp,
  Megaphone,
  MessageSquare,
  Plus,
  Trash2,
  Info,
  Building2,
  Sparkles,
  UserX,
  FileText,
  GraduationCap,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../config/permissions';
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
import { AnnouncementRecord } from '../../types/announcement.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import { isScheduleMatchingUser } from '../../utils/scheduleUtils';

interface DashboardViewProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const { currentUser, hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

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
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);

  // Modals
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
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

  const todayName = getCurrentDayName();
  const todayISO = getTodayISODate();

  useEffect(() => {
    AnnouncementService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', setStaff);
    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', setAttendance);
    const unsubBooks = FirestoreService.subscribeToCollection<DutyBookRecord>('dutyBooks', setDutyBooks);
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>('incidents', setIncidents);
    const unsubAnn = FirestoreService.subscribeToCollection<AnnouncementRecord>('announcements', (data) => {
      setAnnouncements(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    const unsubTardy = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setStudentTardiness);
    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setStudentPermits);
    const unsubSubs = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', setSubstitutions);
    const unsubVisitors = FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors);

    return () => {
      unsubSched();
      unsubTeachers();
      unsubStaff();
      unsubAtt();
      unsubBooks();
      unsubInc();
      unsubAnn();
      unsubTardy();
      unsubPermits();
      unsubSubs();
      unsubVisitors();
    };
  }, []);

  // Today's schedules & operational items
  const todaySchedules = schedules.filter((s) => s.hari === todayName);
  const todayAttendance = attendance.filter((a) => a.tanggal === todayISO);
  const todayDutyBook = dutyBooks.find((b) => b.tanggal === todayISO);
  const todayIncidents = incidents.filter((i) => i.tanggal === todayISO);
  const todayTardiness = studentTardiness.filter((t) => t.tanggal === todayISO);
  const todayPermits = studentPermits.filter((p) => p.tanggal === todayISO);
  const todaySubstitutions = substitutions.filter((s) => s.tanggal === todayISO);
  const todayVisitors = visitors.filter((v) => v.tanggal === todayISO);

  // Personal duty schedule & status for currentUser (supports users.id and legacy teacher.id)
  const isMySchedule = (s: ScheduleItem) => isScheduleMatchingUser(s, currentUser, teachers, staff);

  const myTodaySchedule = schedules.find((s) => s.hari === todayName && isMySchedule(s));
  const myAttendance = attendance.find((a) => a.tanggal === todayISO && a.userId === currentUser?.id);
  const myDutyBook = dutyBooks.find((b) => b.tanggal === todayISO && (b.petugasId === currentUser?.id || (teachers.some(t => t.userId === currentUser?.id && t.id === b.petugasId))));
  const myOtherSchedules = schedules.filter((s) => isMySchedule(s) && s.hari !== todayName);

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

  // Create Announcement
  const handleSaveAnnouncement = async (data: any) => {
    if (!currentUser) return;
    await AnnouncementService.saveAnnouncement(data, currentUser);
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id: string) => {
    if (!currentUser) return;
    await AnnouncementService.deleteAnnouncement(id, currentUser);
  };

  return (
    <div className="space-y-6">
      {/* HERO WELCOME BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[var(--theme-primary)] via-[var(--theme-primary-hover)] to-[var(--theme-primary-active)] text-white p-6 sm:p-8 shadow-xl shadow-[var(--theme-ring)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white backdrop-blur-md text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{settings.schoolName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Bertugas, {currentUser?.fullName}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm max-w-xl leading-relaxed">
              Sistem Terintegrasi Presensi GPS Geolocation, Jurnal Buku Piket Digital & Penanganan Cepat Insiden Sekolah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasPermission(PERMISSIONS.ATTENDANCE_VIEW) && (
              <button
                type="button"
                onClick={() => onNavigateTab('attendance')}
                className="group relative inline-flex items-center justify-center gap-2.5 min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/20 hover:border-white/50 focus-visible:border-white shadow-sm hover:shadow-lg backdrop-blur-md transition-all duration-250 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer select-none"
                aria-label="Buka Presensi Mandiri"
              >
                <ShieldCheck className="w-4 h-4 text-white group-hover:scale-105 transition-transform duration-250 ease-out motion-reduce:transform-none shrink-0" />
                <span>Presensi Mandiri</span>
              </button>
            )}
            {hasPermission(PERMISSIONS.DUTYBOOK_VIEW) && (
              <button
                type="button"
                onClick={() => onNavigateTab('duty-book')}
                className="group relative inline-flex items-center justify-center gap-2.5 min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-[var(--theme-primary-text)] bg-white hover:bg-[var(--theme-primary-light)] active:bg-white/90 border border-transparent hover:border-[var(--theme-primary-border)] shadow-md hover:shadow-xl transition-all duration-250 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer select-none"
                aria-label="Buka Isi Buku Piket"
              >
                <BookOpenCheck className="w-4 h-4 text-[var(--theme-primary)] group-hover:scale-105 transition-transform duration-250 ease-out motion-reduce:transform-none shrink-0" />
                <span>Isi Buku Piket</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* PERSONAL DUTY STATUS CARD (TEACHER DUTY HUD) */}
      <Card className="border-[var(--theme-primary-border)]/60 bg-linear-to-b from-[var(--theme-primary-light)]/40 to-white dark:from-[var(--theme-primary-light)]/20 dark:to-[var(--theme-card-bg)] shadow-md">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--theme-primary-border)]/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center font-bold text-sm shadow-md shadow-[var(--theme-ring)] shrink-0">
                {currentUser?.fullName?.charAt(0) || 'G'}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Status Tugas Piket Anda Hari Ini
                  </h2>
                  <Badge variant={myTodaySchedule ? 'primary' : 'neutral'} size="sm">
                    {todayName}, {formatIndonesianDate(new Date())}
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
                    Anda tidak memiliki penugasan piket pada hari ini ({todayName}).
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

      {/* METRIC STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <Card hoverable onClick={() => onNavigateTab('schedules')} className="cursor-pointer">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Petugas Hari Ini</span>
              <div className="w-7 h-7 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary)] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {todaySchedules.length} Guru
            </div>
            <div className="text-[11px] text-slate-400 font-mono">Shift {todayName}</div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card hoverable onClick={() => onNavigateTab('attendance')} className="cursor-pointer">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Kehadiran (GPS)</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {attendancePercentage}%
            </div>
            <div className="text-[11px] text-emerald-600 font-medium">
              {presentCount} dari {todaySchedules.length || 0} Terverifikasi
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card hoverable onClick={() => onNavigateTab('duty-book')} className="cursor-pointer">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Buku Piket Hari Ini</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                <BookOpenCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
              {todayDutyBook ? getDutyBookDisplayStatus(todayDutyBook.status).label : 'Belum Dibuat'}
            </div>
            <div className="text-[11px] text-purple-600 font-medium">
              {todayDutyBook ? 'Tahap Jurnal' : 'Siap Diisi'}
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card hoverable onClick={() => onNavigateTab('incidents')} className="cursor-pointer">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Insiden Terlapor</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {todayIncidents.length} Kejadian
            </div>
            <div className="text-[11px] text-amber-600 font-medium">
              {todayIncidents.filter((i) => i.status === 'SELESAI').length} Tuntas Ditangani
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OPERATIONAL SUMMARY ROW (STUDENT TARDINESS, PERMITS, SUBSTITUTIONS, VISITORS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigateTab('student-tardiness')}
          className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold group-hover:text-amber-600">Siswa Terlambat</span>
            <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {todayTardiness.length} Siswa
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Hari Ini • Masuk Gerbang</div>
        </div>

        <div
          onClick={() => onNavigateTab('student-permits')}
          className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:border-[var(--theme-primary-border)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold group-hover:text-[var(--theme-primary)]">Izin Keluar Kelas</span>
            <div className="p-1 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary)]">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {todayPermits.length} Siswa
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Hari Ini • Disetujui Piket</div>
        </div>

        <div
          onClick={() => onNavigateTab('substitutions')}
          className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold group-hover:text-indigo-600">Guru Pengganti (Inval)</span>
            <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {todaySubstitutions.length} Jam Pelajaran
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Hari Ini • Tugas Inval</div>
        </div>

        <div
          onClick={() => onNavigateTab('visitors')}
          className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:border-teal-400 dark:hover:border-teal-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold group-hover:text-teal-600">Buku Tamu Sekolah</span>
            <div className="p-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Building className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {todayVisitors.length} Tamu
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Hari Ini • Pos Keamanan</div>
        </div>
      </div>

      {/* PAPAN INFORMASI & PENGUMUMAN PIKET */}
      <Card>
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
                onClick={() => setIsAnnModalOpen(true)}
              >
                + Buat Pengumuman
              </Button>
            )
          }
        />
        <CardContent className="p-4 sm:p-5">
          {announcements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {announcements.slice(0, 4).map((ann) => (
                <div
                  key={ann.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    ann.priority === 'DARURAT'
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                      : ann.priority === 'PENTING'
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={ann.priority === 'DARURAT' ? 'danger' : ann.priority === 'PENTING' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {ann.priority}
                      </Badge>
                      <h4 className="font-bold text-xs">{ann.title}</h4>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                        title="Hapus Pengumuman"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs mt-2 leading-relaxed text-justify opacity-90">
                    {ann.content}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2.5 mt-2.5 border-t border-black/5 dark:border-white/5 font-mono">
                    <span>Oleh: <strong>{ann.authorName.split(' ')[0]}</strong> ({ann.authorRole})</span>
                    <span>{formatIndonesianDate(ann.date)}</span>
                  </div>
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

      {/* 2 COLS: TODAY'S DUTY ROSTER & RECENT INCIDENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: TODAY'S DUTY ROSTER */}
        <Card>
          <CardHeader
            title={`Daftar Guru Bertugas Hari Ini (${todayName})`}
            subtitle={`${formatIndonesianDate(new Date())} • ${todaySchedules.length} Pos Terjadwal`}
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]"
                onClick={() => onNavigateTab('schedules')}
              >
                Lihat Semua Jadwal
              </Button>
            }
          />
          <CardContent className="p-0">
            {todaySchedules.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {todaySchedules.map((item) => {
                  const att = todayAttendance.find((a) => a.userId === item.petugasId);
                  const isPresent = att?.status === 'DALAM_LOKASI';

                  return (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPresent
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                        }`}>
                          {item.petugasName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.petugasName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>📍 {item.ruangName}</span>
                            <span>•</span>
                            <span className="font-mono">{item.jamMulai} - {item.jamSelesai} WIB</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={isPresent ? 'success' : 'neutral'} size="sm">
                          {isPresent ? 'Hadir (GPS)' : 'Belum Presensi'}
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
                Tidak ada jadwal tugas piket untuk hari ini.
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: RECENT INCIDENTS */}
        <Card>
          <CardHeader
            title="Laporan Insiden & Kejadian Terbaru"
            subtitle="Rekapitulasi peristiwa terkini yang memerlukan tindak lanjut"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]"
                onClick={() => onNavigateTab('incidents')}
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
      </div>

      {/* ANNOUNCEMENT FORM MODAL */}
      <AnnouncementFormModal
        isOpen={isAnnModalOpen}
        onClose={() => setIsAnnModalOpen(false)}
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
