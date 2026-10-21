import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  MapPin,
  User,
  Users,
  Edit2,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  CalendarRange,
  Layers,
  LayoutGrid,
  List,
  MessageSquare,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { UserAvatar } from '../../components/common/UserAvatar';
import { DAYS_LIST, DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { AttendanceRecord, DayOfWeek, ScheduleItem, SchoolSettings, UserProfile } from '../../types';
import { TeacherRecord, StaffRecord, RoomRecord } from '../../types/master.types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { ScheduleFormModal } from './ScheduleFormModal';
import { RecurringScheduleModal } from './RecurringScheduleModal';
import { useAuth } from '../../contexts/AuthContext';
import { dutyCoverageId, dutyCancellationId, getOperationalScheduleStatus, getScheduleRecurrence } from '../../utils/scheduleUtils';
import { getTodayISODate } from '../../utils/dateUtils';
import { where } from 'firebase/firestore';
import { DutyCancellationService, DutyCancellationScope } from '../../services/firebase/dutyCancellationService';
import { DutyCoverageDialog } from '../attendance/DutyCoverageDialog';
import { getCurrentDayName } from '../../utils/dateUtils';
import { useWibToday } from '../../hooks/useWibToday';

function nextWeekdayDate(day: DayOfWeek, todayISO: string): string {
  const weekdays = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  const today = new Date(`${todayISO}T12:00:00Z`);
  const gap = (weekdays.indexOf(day) - today.getUTCDay() + 7) % 7;
  today.setUTCDate(today.getUTCDate() + gap);
  return today.toISOString().slice(0, 10);
}

/** Defer authenticated photo requests until a schedule card is close to the viewport. */
const ScheduleTeacherAvatar: React.FC<{ name: string; avatarUrl?: string | null }> = React.memo(({ name, avatarUrl }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <span ref={containerRef} className="inline-flex w-12 h-12 shrink-0 aspect-square rounded-xl overflow-hidden border border-[var(--theme-primary-border)] bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] shadow-sm">
    {visible
      ? <UserAvatar user={{ fullName: name, avatarUrl: avatarUrl || null }} className="w-full h-full rounded-xl text-base" />
      : <span aria-hidden="true" className="w-full h-full flex items-center justify-center font-bold text-base">{name.trim().charAt(0).toUpperCase() || 'P'}</span>}
  </span>;
});

const ScheduleActionGuide: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => <details className="text-[11px] text-slate-600 dark:text-slate-300">
  <summary className="cursor-pointer w-fit min-h-9 inline-flex items-center font-semibold text-[var(--theme-primary-text)] underline underline-offset-2">Apa fungsi tombol?</summary>
  <div className="mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1.5 leading-relaxed">
    {isAdmin && <><p><strong>Berhalangan:</strong> guru tidak dapat bertugas hari ini; admin bisa menunjuk pengganti.</p><p><strong>Batalkan:</strong> nonaktifkan jadwal untuk tanggal pilihan atau seluruh jadwal rutin setelah konfirmasi.</p></>}
    <p><strong>Pesan:</strong> siapkan pengingat WhatsApp.</p>
    {isAdmin && <><p><strong>Edit:</strong> ubah detail jadwal, bukan status presensi.</p><p><strong>Hapus:</strong> hapus entri jadwal, berbeda dari membatalkan jadwal.</p></>}
  </div>
</details>;

export const SchedulePreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const todayISO = useWibToday();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendanceForDate, setAttendanceForDate] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const today = getCurrentDayName() as DayOfWeek;
    return DAYS_LIST.includes(today) ? today : 'SENIN';
  });

  const [selectedDate, setSelectedDate] = useState(() => getTodayISODate());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isInitialMultiPerson, setIsInitialMultiPerson] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState<ScheduleItem | null>(null);
  const [coverageSource, setCoverageSource] = useState<ScheduleItem | null>(null);
  const [coverageFeedback, setCoverageFeedback] = useState('');
  const [cancelSource, setCancelSource] = useState<ScheduleItem | null>(null);
  const [cancelScope, setCancelScope] = useState<DutyCancellationScope>('DAY');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancellationBusy, setCancellationBusy] = useState(false);

  // WhatsApp reminder modal
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

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    const unsubSettings = FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', data => { if (data) setSettings(data); });

    const unsubSchedules = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
      setIsLoading(false);
    });

    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {
      setUsers(data);
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', (data) => {
      setTeachers(data);
    });

    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', (data) => {
      setStaff(data);
    });

    const unsubRooms = FirestoreService.subscribeToCollection<RoomRecord>('rooms', (data) => {
      setRooms(data);
    });

    return () => {
      unsubSettings();
      unsubSchedules();
      unsubUsers();
      unsubTeachers();
      unsubStaff();
      unsubRooms();
    };
  }, []);

  // Only one dated attendance listener. Status is never persisted on weekly templates.
  useEffect(() => {
    setAttendanceForDate([]);
    return FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', setAttendanceForDate,
      error => console.warn('[SCHEDULES] Presensi tidak dapat dimuat:', error?.message),
      [where('tanggal', '==', selectedDate)], { cacheKey: `schedule-live-status:${selectedDate}` });
  }, [selectedDate]);

  // Bootstrap seed if empty
  useEffect(() => {
    if (teachers.length > 0 && rooms.length > 0 && schedules.length === 0) {
      ScheduleService.bootstrapIfEmpty(teachers, rooms);
    }
  }, [teachers, rooms, schedules.length]);

  // Trigger WhatsApp Reminder
  const handleTriggerWaReminder = (schedule: ScheduleItem) => {
    const user = users.find((u) => u.id === schedule.petugasId);
    const teacher = teachers.find((t) => (t.userId && t.userId === schedule.petugasId) || t.id === schedule.petugasId || t.fullName === schedule.petugasName);
    const staffMember = staff.find((s) => (s.userId && s.userId === schedule.petugasId) || s.id === schedule.petugasId || s.fullName === schedule.petugasName);
    const phone = user?.phone || teacher?.phone || staffMember?.phone || '';

    const msg = WhatsAppService.getScheduleReminderMessage(schedule, settings.schoolName);
    setWaModalData({
      isOpen: true,
      phone,
      message: msg,
      title: `Kirim Pengingat Tugas Piket: ${schedule.petugasName}`,
    });
  };

  // Creation is atomic across all chosen days/officers, with stable slot identities.
  const handleSaveMultipleSchedules = async (items: ScheduleItem[]) => {
    if (!currentUser || !isAdmin) throw new Error('Sesi administrator tidak tersedia. Masuk kembali.');
    await ScheduleService.createSchedules(items, currentUser);
  };
  const handleSaveSchedule = async (schedule: ScheduleItem) => {
    if (!currentUser || !isAdmin) throw new Error('Hanya administrator yang dapat mengubah jadwal.');
    if (!editingSchedule) return handleSaveMultipleSchedules([schedule]);
    // Editing schedule details must never mutate operational status or revive a cancelled template.
    if (editingSchedule.status === 'DIBATALKAN') {
      throw new Error('Aktifkan kembali jadwal melalui tombol Aktifkan Kembali sebelum mengubah rinciannya.');
    }
    if (schedule.status !== 'TERJADWAL') {
      throw new Error('Status BERJALAN/SELESAI berasal dari presensi. Gunakan Berhalangan atau Batalkan untuk pengecualian.');
    }
    const latest = await FirestoreService.getAllStrict<ScheduleItem>('schedules');
    const conflict = ScheduleService.checkConflict(schedule, latest);
    if (conflict.hasConflict) throw new Error(conflict.reason);
    await FirestoreService.setDocumentWithAudit('schedules', schedule.id, { ...schedule, updatedAt: FirestoreService.nextUpdatedAt(editingSchedule), updatedBy: currentUser.id }, {
      userId: currentUser.id, userName: currentUser.fullName, role: currentUser.role, action: 'UPDATE', module: 'SCHEDULES', recordId: schedule.id,
      details: `Memperbarui rincian jadwal (status operasional tetap otomatis): ${schedule.petugasName} (${schedule.hari} di ${schedule.ruangName})`,
    }, { expectedState: editingSchedule });
  };
  const handleGenerateRecurring = handleSaveMultipleSchedules;

  // Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!deleteConfirmSchedule) return;
    await FirestoreService.deleteDocument('schedules', deleteConfirmSchedule.id);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'DELETE',
      module: 'SCHEDULES',
      recordId: deleteConfirmSchedule.id,
      details: `Menghapus jadwal piket: ${deleteConfirmSchedule.petugasName} (${deleteConfirmSchedule.hari})`,
    });
    setDeleteConfirmSchedule(null);
  };

  const statusOf = (item: ScheduleItem) => getOperationalScheduleStatus(item, schedules, attendanceForDate, selectedDate);
  const cancelFor = (item: ScheduleItem) => schedules.find(s => s.id === dutyCancellationId(selectedDate, item.id));
  const coverFor = (item: ScheduleItem) => schedules.find(s => s.id === dutyCoverageId(selectedDate, item.id));
  const requestCancel = (item: ScheduleItem) => { setCancelSource(item); setCancelScope('DAY'); setCancelReason(''); setCancelError(''); };
  const executeCancel = async () => {
    if (!cancelSource || !currentUser || !isAdmin || cancellationBusy) return;
    setCancellationBusy(true); setCancelError('');
    try {
      await DutyCancellationService.cancel({ source: cancelSource, dateISO: selectedDate,
        scope: cancelScope, reason: cancelReason, actorName: currentUser.fullName });
      setCoverageFeedback(cancelScope === 'DAY' ? `Piket ${selectedDate} dibatalkan tanpa mengubah jadwal mingguan.` : 'Jadwal piket mingguan dinonaktifkan.');
      setCancelSource(null);
    } catch (error: any) { setCancelError(error?.message || 'Pembatalan gagal.'); }
    finally { setCancellationBusy(false); }
  };
  const restoreCancel = async (item: ScheduleItem) => {
    if (!isAdmin || !currentUser || !window.confirm('Aktifkan kembali jadwal piket ini?')) return;
    try {
      const dayCancel = cancelFor(item);
      if (dayCancel) await DutyCancellationService.restoreDay(dayCancel, currentUser.fullName);
      else await DutyCancellationService.restoreRecurring(item, currentUser.fullName);
      setCoverageFeedback('Jadwal piket berhasil dipulihkan.');
    } catch (error: any) { setCoverageFeedback(error?.message || 'Gagal memulihkan jadwal.'); }
  };

  const filtered = schedules.filter((s) => {
    if (s.coverageForScheduleId || s.cancelForScheduleId) return false;
    const matchDay = s.hari === selectedDay && (getScheduleRecurrence(s) !== 'ONCE' || s.tanggal === selectedDate);
    const matchStatus = statusFilter === 'SEMUA' || statusOf(s) === statusFilter;
    const query = searchQuery.toLocaleLowerCase('id-ID');
    const matchSearch = [s.petugasName, s.ruangName, s.keterangan || ''].some(v => v.toLocaleLowerCase('id-ID').includes(query));
    return matchDay && matchStatus && matchSearch;
  });

  const userLookup = useMemo(() => {
    const byId = new Map<string, UserProfile>();
    const byName = new Map<string, UserProfile>();
    users.forEach((user) => {
      if (user.id) byId.set(user.id, user);
      if (user.fullName) byName.set(user.fullName.trim().toLocaleLowerCase('id-ID'), user);
    });
    return { byId, byName };
  }, [users]);

  const getScheduleUser = (item: ScheduleItem) => {
    return userLookup.byId.get(item.petugasId)
      || userLookup.byName.get(item.petugasName.trim().toLocaleLowerCase('id-ID'))
      || null;
  };

  return (
    <div data-tour="schedules-container" className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-[var(--theme-primary)]" />
            Jadwal Piket Guru & Staff
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Lihat jadwal dan penugasan guru piket.</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4 text-[var(--theme-primary)]" />}
              onClick={() => setIsRecurringModalOpen(true)}
            >
              Generate Otomatis
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Users className="w-4 h-4" />}
              onClick={() => {
                setEditingSchedule(null);
                setIsInitialMultiPerson(true);
                setIsFormModalOpen(true);
              }}
            >
              + Jadwal Multi-Petugas
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingSchedule(null);
                setIsInitialMultiPerson(false);
                setIsFormModalOpen(true);
              }}
            >
              + Buat Jadwal
            </Button>
          </div>
        )}
      </div>

      {/* Filter Tabs by Day of Week */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DAYS_LIST.map((day) => {
          const isToday = getCurrentDayName() === day;
          const count = schedules.filter((s) => s.hari === day && !s.coverageForScheduleId && !s.cancelForScheduleId).length;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => { setSelectedDay(day); setSelectedDate(nextWeekdayDate(day, todayISO)); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-md shadow-[var(--theme-ring)] scale-[1.02]'
                  : 'bg-white dark:bg-[var(--theme-card-bg)] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[var(--theme-card-border)] hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
              }`}
            >
              <span>{day}</span>
              {isToday && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                  HARI INI
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--theme-card-bg)] px-4 py-3">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex flex-wrap items-center gap-2">
          Tanggal pemantauan
          <input type="date" aria-label="Tanggal pemantauan piket" value={selectedDate} onChange={event => {
            const value = event.target.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
            setSelectedDate(value); setSelectedDay(getCurrentDayName(`${value}T12:00:00+07:00`) as DayOfWeek);
          }} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs" />
        </label>
        <p className="text-xs text-slate-500">Status otomatis dari presensi: masuk → BERJALAN, pulang → SELESAI. <strong>Berhalangan</strong> dipakai jika guru mendadak tidak bisa bertugas dan perlu pengganti. <strong>Batalkan</strong> dipakai untuk menonaktifkan jadwal pada tanggal dipilih atau seluruh jadwal berulang melalui konfirmasi admin.</p>
      </div>

      {/* Search & Status Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari guru, ruangan, atau catatan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50/50 dark:bg-[var(--theme-input-bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              />
            </div>

            <div className="app-filter-group flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <label className="app-filter-field"><span>Status</span><select aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-input-bg)] text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="TERJADWAL">TERJADWAL</option>
                <option value="BERJALAN">BERJALAN</option>
                <option value="SELESAI">SELESAI</option>
                <option value="DIGANTIKAN">DIGANTIKAN</option>
                <option value="MENUNGGU_PENGGANTI">MENUNGGU PENGGANTI</option>
                <option value="DIBATALKAN">DIBATALKAN</option>
              </select></label>

              {/* View Mode Toggle */}
              <div className="flex items-center border border-slate-200 dark:border-[var(--theme-card-border)] rounded-xl p-1 bg-slate-50 dark:bg-[var(--theme-input-bg)]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-[var(--theme-surface-subtle)] shadow-xs text-[var(--theme-primary)] font-bold' : 'text-slate-400'}`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-[var(--theme-surface-subtle)] shadow-xs text-[var(--theme-primary)] font-bold' : 'text-slate-400'}`}
                  title="Tampilan Tabel"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {coverageFeedback && <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 text-xs">{coverageFeedback}</div>}
      {/* SCHEDULE VIEW: GRID */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const scheduleUser = getScheduleUser(item);
              return (
              <Card key={item.id} hoverable className="transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <ScheduleTeacherAvatar name={item.petugasName} avatarUrl={scheduleUser?.avatarUrl} />
                    <Badge
                      variant={
                        statusOf(item) === 'BERJALAN'
                          ? 'success'
                          : statusOf(item) === 'SELESAI'
                          ? 'info'
                          : statusOf(item) === 'DIGANTIKAN'
                          ? 'warning'
                          : statusOf(item) === 'DIBATALKAN'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {statusOf(item) === 'MENUNGGU_PENGGANTI' ? 'MENUNGGU PENGGANTI' : statusOf(item)}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.petugasName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-semibold mt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{item.ruangName}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-[var(--theme-card-border)] text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                      <span className="font-mono">{item.jamMulai} - {item.jamSelesai} WIB</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{getScheduleRecurrence(item) === 'ONCE' ? `Sekali: ${item.tanggal}` : `Setiap ${item.hari.toLowerCase()}`}</p>
                    {cancelFor(item) && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">Dibatalkan khusus {selectedDate}: {cancelFor(item)?.cancellationReason}</p>}
                    {item.keterangan && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/50 p-2 rounded-lg">
                        "{item.keterangan}"
                      </p>
                    )}
                    {Boolean(coverFor(item)) && (() => {
                      const cover = coverFor(item)!;
                      return <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 p-2 space-y-1">
                        <p className="text-xs font-bold text-amber-800">Berhalangan hari ini</p>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">{cover.absenceReason}</p>
                        <p className="text-xs font-semibold text-amber-700">{cover.status === 'DIBATALKAN' ? 'Menunggu Pengganti' : `Pengganti: ${cover.petugasName}`}</p>
                      </div>;
                    })()}
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)] space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[11px] font-semibold text-slate-500" title="Status berasal dari presensi masuk/pulang dan pengecualian berhalangan/pembatalan; bukan diubah manual.">Status otomatis</span>
                      <span className="text-[10px] text-slate-400">Batalkan = nonaktifkan jadwal pada tanggal ini / jadwal berulang.</span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && selectedDate === todayISO && statusOf(item) === 'TERJADWAL' && <button type="button" onClick={() => setCoverageSource(item)} className="min-h-10 px-3 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-700 text-[11px] font-bold" title="Guru mendadak tidak bisa piket; cari pengganti untuk hari ini" aria-label={`Catat ${item.petugasName} berhalangan dan pilih pengganti`}>Berhalangan</button>}
                      {isAdmin && !coverFor(item) && (statusOf(item) === 'DIBATALKAN' ? (
                        <button type="button" onClick={() => restoreCancel(item)} className="min-h-10 px-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-700 text-[11px] font-bold" title="Pulihkan jadwal yang telah dibatalkan">Aktifkan Kembali</button>
                      ) : statusOf(item) === 'TERJADWAL' && selectedDate >= todayISO ? (
                        <button type="button" onClick={() => requestCancel(item)} className="min-h-10 px-3 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-700 text-[11px] font-bold" title="Nonaktifkan jadwal tanggal pilihan atau jadwal berulang, bukan menghapus guru">Batalkan</button>
                      ) : null)}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => handleTriggerWaReminder(item)}
                        className="min-w-10 min-h-10 p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                        title="Siapkan pesan pengingat WhatsApp"
                        aria-label={`Kirim pengingat WhatsApp untuk ${item.petugasName}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSchedule(item);
                              setIsFormModalOpen(true);
                            }}
                            className="min-w-10 min-h-10 p-2 rounded-xl text-slate-400 hover:text-[var(--theme-primary)] hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] cursor-pointer"
                            title="Ubah Jadwal"
                            aria-label={`Edit detail jadwal ${item.petugasName}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmSchedule(item)}
                            className="min-w-10 min-h-10 p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Hapus Jadwal"
                            aria-label={`Hapus jadwal ${item.petugasName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      </div>
                    </div>
                    <ScheduleActionGuide isAdmin={isAdmin} />
                  </div>
                </CardContent>
              </Card>
            )})
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak ada jadwal piket pada hari {selectedDay}
              </h4>
              <p className="text-xs mt-1">
                Gunakan tombol "+ Buat Jadwal" atau "Generate Otomatis" untuk mengalokasikan guru piket.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* SCHEDULE VIEW: TABLE */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border-b border-slate-200 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Guru / Petugas Piket</th>
                  <th className="p-4">Pos / Lokasi</th>
                  <th className="p-4">Waktu Shift</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Keterangan</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[var(--theme-card-border)]">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-[var(--theme-surface-subtle)]/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3 min-w-0">
                        <ScheduleTeacherAvatar name={item.petugasName} avatarUrl={getScheduleUser(item)?.avatarUrl} />
                        <div className="min-w-0">
                          <p className="truncate">{item.petugasName}</p>
                      {cancelFor(item) && <span className="block text-[11px] text-rose-700">Dibatalkan khusus {selectedDate}</span>}
                      {Boolean(coverFor(item)) && <span className="block text-[11px] text-amber-700">{(() => { const c = coverFor(item)!; return c.status === 'DIBATALKAN' ? 'Berhalangan · Menunggu Pengganti' : `Berhalangan · Digantikan ${c.petugasName}`; })()}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-semibold">
                      {item.ruangName}
                    </td>
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                      {item.jamMulai} - {item.jamSelesai} WIB
                      <span className="block font-sans text-xs text-slate-500">{getScheduleRecurrence(item) === 'ONCE' ? item.tanggal : 'Berulang mingguan'}</span>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={statusOf(item) === 'BERJALAN' ? 'success' : statusOf(item) === 'SELESAI' ? 'info' : 'neutral'}
                        size="sm"
                      >
                        {statusOf(item) === 'MENUNGGU_PENGGANTI' ? 'MENUNGGU PENGGANTI' : statusOf(item)}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-500 italic max-w-xs truncate">
                      {item.keterangan || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-[180px]">
                        {isAdmin && !coverFor(item) && (statusOf(item) === 'DIBATALKAN' ? (
                          <button type="button" onClick={() => restoreCancel(item)} className="px-2 py-1 rounded-xl text-emerald-700 border border-emerald-200 text-[11px] font-semibold">Aktifkan Kembali</button>
                        ) : statusOf(item) === 'TERJADWAL' && selectedDate >= todayISO ? (
                          <button type="button" onClick={() => requestCancel(item)} className="px-2 py-1 rounded-xl text-rose-700 border border-rose-200 text-[11px] font-semibold" title="Nonaktifkan jadwal pada tanggal dipilih atau seluruh jadwal berulang">Batalkan</button>
                        ) : null)}
                        <button
                          type="button"
                          onClick={() => handleTriggerWaReminder(item)}
                          className="min-w-10 min-h-10 p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="Kirim Pesan WhatsApp"
                          aria-label={`Kirim pengingat WhatsApp untuk ${item.petugasName}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <>
                            {selectedDate === todayISO && statusOf(item) === 'TERJADWAL' && <button type="button" onClick={() => setCoverageSource(item)} className="min-h-10 px-2 py-1 rounded-lg text-amber-700 border border-amber-200 text-[11px] font-semibold" title="Catat berhalangan dan pilih guru pengganti">Berhalangan</button>}
                            <button
                              onClick={() => {
                                setEditingSchedule(item);
                                setIsFormModalOpen(true);
                              }}
                              className="min-w-10 min-h-10 p-2 rounded-lg text-slate-400 hover:text-[var(--theme-primary)] cursor-pointer"
                              title="Edit rincian jadwal"
                              aria-label={`Edit detail jadwal ${item.petugasName}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmSchedule(item)}
                              className="min-w-10 min-h-10 p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Hapus jadwal dari daftar"
                              aria-label={`Hapus jadwal ${item.petugasName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={!!cancelSource} onClose={() => { if (!cancellationBusy) setCancelSource(null); }} title="Batalkan Penugasan Piket" maxWidth="sm">
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white break-words">{cancelSource?.petugasName}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{cancelSource?.ruangName} · {cancelSource?.jamMulai}–{cancelSource?.jamSelesai} WIB</p>
            <p className="text-xs text-slate-500">Tanggal yang dipilih: <strong>{selectedDate}</strong></p>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Gunakan pembatalan saat kegiatan piket <strong>tidak jadi dilaksanakan</strong>. Jika guru tetap perlu digantikan pada hari ini, tutup dialog lalu pilih <strong>Berhalangan</strong>. Pembatalan tidak menghapus akun guru maupun riwayat presensi.</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">1. Pilih cakupan pembatalan</legend>
            <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${cancelScope === 'DAY' ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)]' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" name="cancel-scope" checked={cancelScope === 'DAY'} onChange={() => setCancelScope('DAY')} className="mt-1 shrink-0" />
              <span className="min-w-0"><strong className="block text-sm">Hanya tanggal {selectedDate}</strong><span className="block text-xs text-slate-600 dark:text-slate-300 mt-1">Jadwal berikutnya tetap aktif seperti biasa.</span></span>
            </label>
            {cancelSource && getScheduleRecurrence(cancelSource) === 'WEEKLY' && <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${cancelScope === 'RECURRING' ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" name="cancel-scope" checked={cancelScope === 'RECURRING'} onChange={() => setCancelScope('RECURRING')} className="mt-1 shrink-0" />
              <span className="min-w-0"><strong className="block text-sm">Seluruh jadwal mingguan</strong><span className="block text-xs text-rose-700 dark:text-rose-300 mt-1">Penugasan rutin dinonaktifkan sampai admin memilih Aktifkan Kembali.</span></span>
            </label>}
          </fieldset>
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>2. Alasan pembatalan <span className="text-rose-600">*</span></span>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={500} rows={3} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm font-normal min-h-24" placeholder="Contoh: kegiatan piket ditiadakan karena perubahan agenda sekolah" />
            <span className="flex justify-between text-[11px] text-slate-500 font-normal"><span>Minimal 10 karakter untuk jejak audit.</span><span>{cancelReason.trim().length}/500</span></span>
          </label>
          <div role="status" className={`rounded-xl p-3 text-xs leading-relaxed border ${cancelScope === 'RECURRING' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800'}`}>
            <strong>Ringkasan dampak: </strong>{cancelScope === 'DAY' ? `Piket ${selectedDate} tidak dilaksanakan. Jadwal mingguan tetap ada.` : 'Semua penugasan pada jadwal mingguan ini akan dinonaktifkan, sampai dipulihkan admin.'}
          </div>
          {cancelError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-xs">{cancelError}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
            <Button variant="outline" size="sm" disabled={cancellationBusy} onClick={() => setCancelSource(null)}>Kembali tanpa mengubah</Button>
            <Button variant="danger" size="sm" disabled={cancellationBusy || cancelReason.trim().length < 10} onClick={executeCancel}>{cancellationBusy ? 'Memproses…' : cancelScope === 'DAY' ? 'Batalkan Tanggal Terpilih' : 'Nonaktifkan Jadwal Mingguan'}</Button>
          </div>
        </div>
      </Modal>

      <DutyCoverageDialog source={coverageSource} dateISO={getTodayISODate()} allSchedules={schedules} users={users} actorName={currentUser?.fullName || 'Administrator'} onClose={() => setCoverageSource(null)} onSaved={setCoverageFeedback} />
      {/* SCHEDULE FORM MODAL */}
      <ScheduleFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSchedule(null);
          setIsInitialMultiPerson(false);
        }}
        onSave={handleSaveSchedule}
        onSaveMultiple={handleSaveMultipleSchedules}
        editingSchedule={editingSchedule}
        users={users}
        teachers={teachers}
        staff={staff}
        rooms={rooms}
        allSchedules={schedules}
        defaultDay={selectedDay}
        settings={settings}
        isLoadingData={isLoading}
        initialMultiPerson={isInitialMultiPerson}
      />

      {/* RECURRING SCHEDULE GENERATOR MODAL */}
      <RecurringScheduleModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        onGenerate={handleGenerateRecurring}
        users={users}
        teachers={teachers}
        staff={staff}
        rooms={rooms}
        settings={settings}
      />

      {/* WHATSAPP REMINDER MODAL */}
      <WhatsAppModal
        isOpen={waModalData.isOpen}
        onClose={() => setWaModalData({ ...waModalData, isOpen: false })}
        title={waModalData.title}
        defaultPhone={waModalData.phone}
        defaultMessage={waModalData.message}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirmSchedule}
        onClose={() => setDeleteConfirmSchedule(null)}
        title="Konfirmasi Hapus Jadwal"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Jadwal Piket Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Petugas: <strong>{deleteConfirmSchedule?.petugasName}</strong> ({deleteConfirmSchedule?.hari} - {deleteConfirmSchedule?.ruangName})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmSchedule(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteSchedule}>
              Ya, Hapus Jadwal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
