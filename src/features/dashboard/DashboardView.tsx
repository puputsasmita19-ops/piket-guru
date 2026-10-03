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
import { FirestoreService } from '../../services/firebase/firestoreService';
import { AnnouncementService } from '../../services/firebase/announcementService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import {
  ScheduleItem,
  AttendanceRecord,
  SchoolSettings,
} from '../../types';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { IncidentRecord } from '../../types/incident.types';
import { AnnouncementRecord } from '../../types/announcement.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName } from '../../utils/dateUtils';

interface DashboardViewProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
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
  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    AnnouncementService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
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
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-6 sm:p-8 shadow-xl shadow-blue-900/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-blue-100 backdrop-blur-md text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{settings.schoolName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Bertugas, {currentUser?.fullName}
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm max-w-xl leading-relaxed">
              Sistem Terintegrasi Presensi GPS Geolocation, Jurnal Buku Piket Digital & Penanganan Cepat Insiden Sekolah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="glass"
              size="md"
              className="text-xs font-bold"
              onClick={() => onNavigateTab('attendance')}
            >
              Presensi Mandiri
            </Button>
            <Button
              variant="white"
              size="md"
              className="text-xs font-bold shadow-lg"
              onClick={() => onNavigateTab('duty-book')}
            >
              Isi Buku Piket
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* METRIC STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <Card hoverable onClick={() => onNavigateTab('schedules')} className="cursor-pointer">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Petugas Hari Ini</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
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
              {todayDutyBook ? todayDutyBook.status : 'BELUM DIBUAT'}
            </div>
            <div className="text-[11px] text-purple-600 font-medium">
              {todayDutyBook ? 'Tahap Dokumen' : 'Siap Diisi'}
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
          className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold group-hover:text-blue-600">Izin Keluar Kelas</span>
            <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
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
                leftIcon={<Plus className="w-3.5 h-3.5 text-blue-600" />}
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
                className="text-xs text-blue-600"
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
                  const att = todayAttendance.find((a) => a.userId === item.petugasId || a.userName.includes(item.petugasName.split(' ')[0]));
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
                className="text-xs text-blue-600"
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
                        [{inc.kategoriName}] {inc.lokasi}
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
