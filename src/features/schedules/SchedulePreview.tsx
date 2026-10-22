import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
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
  HelpCircle,
  ChevronDown,
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
import { dutyCoverageId, dutyCancellationId, getDutyCoverageForDate, getDutyCancellationForDate, getScheduleRecurrence } from '../../utils/scheduleUtils';
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

/** Compact, keyboard-accessible contextual help. Native <details> avoids rerendering all schedule cards. */
const ScheduleActionGuide: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => (
  <details name="schedule-action-help" className="group relative shrink-0 text-[11px] text-slate-600 dark:text-slate-300">
    <summary
      aria-label="Apa fungsi tombol jadwal piket?"
      title="Apa fungsi tombol?"
      className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-[var(--theme-primary-text)] hover:bg-[var(--theme-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] [&::-webkit-details-marker]:hidden"
    >
      <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
      <span className="sr-only">Apa fungsi tombol?</span>
    </summary>
    <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-3rem))] space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 leading-relaxed shadow-lg">
      <p className="mb-2 font-bold text-slate-800 dark:text-slate-100">Panduan tombol jadwal</p>
      {isAdmin && <><p><strong>Berhalangan:</strong> guru tidak dapat bertugas hari ini; admin bisa menunjuk pengganti.</p><p><strong>Batalkan:</strong> nonaktifkan jadwal untuk tanggal pilihan atau seluruh jadwal rutin setelah konfirmasi.</p></>}
      <p><strong>Pesan:</strong> siapkan pengingat WhatsApp.</p>
      {isAdmin && <><p><strong>Edit:</strong> ubah detail jadwal, bukan status presensi.</p><p><strong>Hapus:</strong> hapus entri jadwal, berbeda dari membatalkan jadwal.</p></>}
      <p className="pt-1 text-[10px] text-slate-500 dark:text-slate-400">Ketuk ikon bantuan lagi untuk menutup.</p>
    </div>
  </details>
);

export const SchedulePreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const todayISO = useWibToday();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendanceSnapshot, setAttendanceSnapshot] = useState<{ date: string; records: AttendanceRecord[] }>({ date: '', records: [] });
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

  // Urgent day-button feedback renders first; the heavier roster follows concurrently.
  // Day and date must be deferred together to avoid mixing two different dates.
  const selection = useMemo(() => ({ day: selectedDay, date: selectedDate }), [selectedDay, selectedDate]);
  const displaySelection = useDeferredValue(selection);
  const selectionPending = displaySelection !== selection;
  const displayDay = displaySelection.day;
  const displayDate = displaySelection.date;


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
    // Keep the response date with its records: a previous day's listener must never
    // accidentally mark a newly selected day as BERJALAN or SELESAI.
    let active = true;
    setAttendanceSnapshot({ date: selectedDate, records: [] });
    const unsubscribe = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance',
      records => { if (active) setAttendanceSnapshot({ date: selectedDate, records }); },
      error => console.warn('[SCHEDULES] Presensi tidak dapat dimuat:', error?.message),
      [where('tanggal', '==', selectedDate)], { cacheKey: `schedule-live-status:${selectedDate}` });
    return () => { active = false; unsubscribe(); };
  }, [selectedDate]);

  // Bootstrap seed if empty
  useEffect(() => {
    if (teachers.length > 0 && rooms.length > 0 && schedules.length === 0) {
      ScheduleService.bootstrapIfEmpty(teachers, rooms);
    }
  }, [teachers, rooms, schedules.length]);

  // Trigger WhatsApp Reminder
  const handleTriggerWaReminder = useCallback((schedule: ScheduleItem) => {
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
  }, [users, teachers, staff, settings.schoolName]);

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

  const scheduleById = useMemo(() => new Map(schedules.map(item => [item.id, item])), [schedules]);
  const cancelFor = useCallback((item: ScheduleItem) => scheduleById.get(dutyCancellationId(displayDate, item.id)), [scheduleById, displayDate]);
  const coverFor = useCallback((item: ScheduleItem) => scheduleById.get(dutyCoverageId(displayDate, item.id)), [scheduleById, displayDate]);

  // Prepare indexes ONCE for the selected date instead of rescanning all schedules
  // and attendance records independently for every teacher card.
  const operationalIndex = useMemo(() => {
    const cancelled = new Set<string>(getDutyCancellationForDate(schedules, displayDate)
      .map(item => item.cancelForScheduleId).filter((id): id is string => Boolean(id)));
    const covered = new Map<string, ScheduleItem>(getDutyCoverageForDate(schedules, displayDate)
      .filter(item => Boolean(item.coverageForScheduleId))
      .map(item => [item.coverageForScheduleId!, item] as const));
    const bySchedule = new Map<string, { order: number; record: AttendanceRecord }>();
    const byUser = new Map<string, { order: number; record: AttendanceRecord }>();
    const records = attendanceSnapshot.date === displayDate ? attendanceSnapshot.records : [];
    records.forEach((record, order) => {
      if (record.tanggal !== displayDate) return;
      if (record.scheduleId && !bySchedule.has(record.scheduleId)) bySchedule.set(record.scheduleId, { order, record });
      if (record.userId && !byUser.has(record.userId)) byUser.set(record.userId, { order, record });
    });
    return { cancelled, covered, bySchedule, byUser };
  }, [schedules, displayDate, attendanceSnapshot]);
  const statusOf = useCallback((item: ScheduleItem) => {
    if (item.status === 'DIBATALKAN' || item.cancelForScheduleId || operationalIndex.cancelled.has(item.id)) return 'DIBATALKAN';
    const replacement = operationalIndex.covered.get(item.id);
    if (replacement) return replacement.status === 'DIBATALKAN' ? 'MENUNGGU_PENGGANTI' : 'DIGANTIKAN';
    const bySchedule = operationalIndex.bySchedule.get(item.id);
    const byUser = operationalIndex.byUser.get(item.petugasId);
    const entry = !bySchedule || (byUser && byUser.order < bySchedule.order) ? byUser : bySchedule;
    return entry ? (entry.record.jamPulang ? 'SELESAI' : 'BERJALAN') : 'TERJADWAL';
  }, [operationalIndex]);
  const requestCancel = useCallback((item: ScheduleItem) => { setCancelSource(item); setCancelScope('DAY'); setCancelReason(''); setCancelError(''); }, []);
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
  const restoreCancel = useCallback(async (item: ScheduleItem) => {
    if (!isAdmin || !currentUser || !window.confirm('Aktifkan kembali jadwal piket ini?')) return;
    try {
      const dayCancel = cancelFor(item);
      if (dayCancel) await DutyCancellationService.restoreDay(dayCancel, currentUser.fullName);
      else await DutyCancellationService.restoreRecurring(item, currentUser.fullName);
      setCoverageFeedback('Jadwal piket berhasil dipulihkan.');
    } catch (error: any) { setCoverageFeedback(error?.message || 'Gagal memulihkan jadwal.'); }
  }, [isAdmin, currentUser, cancelFor]);

  const dayCounts = useMemo(() => {
    const counts = new Map<DayOfWeek, number>();
    schedules.forEach(schedule => {
      if (!schedule.coverageForScheduleId && !schedule.cancelForScheduleId) {
        counts.set(schedule.hari, (counts.get(schedule.hari) || 0) + 1);
      }
    });
    return counts;
  }, [schedules]);

  // Resolve only the chosen day first, then apply search/status filters to this small subset.
  const daySchedules = useMemo(() => schedules.filter(item =>
    !item.coverageForScheduleId && !item.cancelForScheduleId &&
    item.hari === displayDay &&
    (getScheduleRecurrence(item) !== 'ONCE' || item.tanggal === displayDate)
  ), [schedules, displayDay, displayDate]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('id-ID');
    return daySchedules.filter(item =>
      (statusFilter === 'SEMUA' || statusOf(item) === statusFilter) &&
      (!query || [item.petugasName, item.ruangName, item.keterangan || '']
        .some(text => text.toLocaleLowerCase('id-ID').includes(query)))
    );
  }, [daySchedules, statusFilter, searchQuery, statusOf]);

  const userLookup = useMemo(() => {
    const byId = new Map<string, UserProfile>();
    const byName = new Map<string, UserProfile>();
    users.forEach((user) => {
      if (user.id) byId.set(user.id, user);
      if (user.fullName) byName.set(user.fullName.trim().toLocaleLowerCase('id-ID'), user);
    });
    return { byId, byName };
  }, [users]);

  const getScheduleUser = useCallback((item: ScheduleItem) => {
    return userLookup.byId.get(item.petugasId)
      || userLookup.byName.get(item.petugasName.trim().toLocaleLowerCase('id-ID'))
      || null;
  }, [userLookup]);

  // Memoize the large schedule card/table trees. Opening a dialog must not
  // reconstruct every teacher card or refetch profile photos on each click.
  const gridRows = useMemo(() => filtered.map(item => {
    const person = getScheduleUser(item);
    const status = statusOf(item);
    const cancel = cancelFor(item);
    const cover = coverFor(item);
    const canChange = isAdmin && status === 'TERJADWAL';
    return <Card key={item.id} className="schedule-duty-card">
      <CardContent className="p-3 sm:p-5 space-y-2.5 sm:space-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <ScheduleTeacherAvatar name={item.petugasName} avatarUrl={person?.avatarUrl} />
          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">{item.petugasName}</h4>
            <p className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-[var(--theme-primary-text)]">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /><span className="truncate">{item.ruangName}</span>
            </p>
          </div>
          <div className="shrink-0"><Badge variant={status === 'BERJALAN' ? 'success' : status === 'SELESAI' ? 'info' : status === 'DIGANTIKAN' || status === 'MENUNGGU_PENGGANTI' ? 'warning' : status === 'DIBATALKAN' ? 'danger' : 'neutral'} size="sm">
            {status === 'MENUNGGU_PENGGANTI' ? 'MENUNGGU PENGGANTI' : status}
          </Badge></div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5 shrink-0 text-[var(--theme-primary)]" />
          <span className="font-mono font-semibold">{item.jamMulai}–{item.jamSelesai} WIB</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-500 dark:text-slate-400">{getScheduleRecurrence(item) === 'ONCE' ? `Sekali · ${item.tanggal}` : `Setiap ${item.hari.toLowerCase()}`}</span>
        </div>

        {cancel && <p className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-2 text-[11px] text-rose-800 dark:text-rose-200">Dibatalkan khusus {displayDate}: {cancel.cancellationReason}</p>}
        {cover && <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-2 text-[11px] space-y-0.5">
          <p className="font-bold text-amber-800 dark:text-amber-200">Guru berhalangan · {cover.status === 'DIBATALKAN' ? 'Menunggu pengganti' : `Pengganti: ${cover.petugasName}`}</p>
          {cover.absenceReason && <p className="text-slate-600 dark:text-slate-300 break-words">{cover.absenceReason}</p>}
        </div>}
        {item.keterangan && <details className="group rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <summary className="min-h-7 flex items-center justify-between gap-2 cursor-pointer font-medium list-none [&::-webkit-details-marker]:hidden">
            <span className="truncate">Catatan tugas</span><ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <p className="pt-1.5 pb-1 whitespace-pre-wrap break-words leading-relaxed">{item.keterangan}</p>
        </details>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            {canChange && displayDate === todayISO && <button type="button" onClick={() => setCoverageSource(item)} className="min-h-9 px-2.5 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-700 dark:text-amber-300 text-[11px] font-bold" aria-label={`Catat ${item.petugasName} berhalangan`}>Berhalangan</button>}
            {isAdmin && !cover && (status === 'DIBATALKAN' ?
              <button type="button" onClick={() => restoreCancel(item)} className="min-h-9 px-2.5 rounded-lg border border-emerald-200 text-emerald-700 text-[11px] font-bold">Aktifkan Kembali</button>
              : canChange && displayDate >= todayISO ?
              <button type="button" onClick={() => requestCancel(item)} className="min-h-9 px-2.5 rounded-lg border border-rose-200 bg-rose-50/80 text-rose-700 text-[11px] font-bold">Batalkan</button> : null)}
          </div>
          <div className="flex items-center gap-0.5 ml-auto">
            <button type="button" onClick={() => handleTriggerWaReminder(item)} className="min-h-9 min-w-9 p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50" title="Kirim pengingat WhatsApp" aria-label={`Kirim pengingat WhatsApp untuk ${item.petugasName}`}><MessageSquare className="w-4 h-4" /></button>
            {isAdmin && <>
              <button type="button" onClick={() => { setEditingSchedule(item); setIsFormModalOpen(true); }} className="min-h-9 min-w-9 p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit Jadwal" aria-label={`Edit detail jadwal ${item.petugasName}`}><Edit2 className="w-4 h-4" /></button>
              <button type="button" onClick={() => setDeleteConfirmSchedule(item)} className="min-h-9 min-w-9 p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50" title="Hapus Jadwal" aria-label={`Hapus jadwal ${item.petugasName}`}><Trash2 className="w-4 h-4" /></button>
            </>}
            <ScheduleActionGuide isAdmin={isAdmin} />
          </div>
        </div>
      </CardContent>
    </Card>;
  }), [filtered, getScheduleUser, statusOf, cancelFor, coverFor, isAdmin, displayDate, todayISO, requestCancel, restoreCancel, handleTriggerWaReminder]);

  const tableRows = useMemo(() => filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-[var(--theme-surface-subtle)]/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3 min-w-0">
                        <ScheduleTeacherAvatar name={item.petugasName} avatarUrl={getScheduleUser(item)?.avatarUrl} />
                        <div className="min-w-0">
                          <p className="truncate">{item.petugasName}</p>
                      {cancelFor(item) && <span className="block text-[11px] text-rose-700">Dibatalkan khusus {displayDate}</span>}
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
                        ) : statusOf(item) === 'TERJADWAL' && displayDate >= todayISO ? (
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
                            {displayDate === todayISO && statusOf(item) === 'TERJADWAL' && <button type="button" onClick={() => setCoverageSource(item)} className="min-h-10 px-2 py-1 rounded-lg text-amber-700 border border-amber-200 text-[11px] font-semibold" title="Catat berhalangan dan pilih guru pengganti">Berhalangan</button>}
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
                )),
    [filtered, getScheduleUser, statusOf, cancelFor, coverFor, requestCancel, restoreCancel, handleTriggerWaReminder, isAdmin, displayDate, todayISO]);

  return (
    <div data-tour="schedules-container" className="space-y-4 sm:space-y-6">
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

      {/* All seven days stay visible on phones: 4 above, 3 below; desktop keeps the original row. */}
      <nav aria-label="Pilih hari jadwal piket" className="grid grid-cols-12 gap-1.5 min-[370px]:gap-2 md:flex md:items-center md:gap-2 md:overflow-x-auto md:overscroll-x-contain md:pb-1 md:scrollbar-none">
        {DAYS_LIST.map((day, dayIndex) => {
          const isToday = getCurrentDayName() === day;
          const count = dayCounts.get(day) || 0;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Jadwal ${day.toLowerCase()}, ${count} jadwal${isToday ? ', hari ini' : ''}`}
              onClick={() => { if (day === selectedDay) return; setSelectedDay(day); setSelectedDate(nextWeekdayDate(day, todayISO)); }}
              className={`${dayIndex < 4 ? 'col-span-3' : 'col-span-4'} flex h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 text-[10px] font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-primary)] md:h-auto md:shrink-0 md:flex-row md:gap-1.5 md:px-4 md:py-2.5 md:text-xs md:whitespace-nowrap ${
                isSelected
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] md:shadow-sm md:shadow-[var(--theme-ring)]'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-[var(--theme-card-border)] dark:bg-[var(--theme-card-bg)] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
              }`}
            >
              <span className="flex min-w-0 items-center justify-center gap-1 leading-tight">
                <span className="text-[10px] min-[370px]:text-[11px] md:text-xs">{day}</span>
                <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] md:h-auto md:min-w-0 md:px-1.5 md:py-0.5 md:text-[10px] ${isSelected ? 'bg-white/25' : 'bg-slate-100 text-slate-500 dark:bg-[var(--theme-surface-subtle)] dark:text-slate-400'}`}>
                  {count}
                </span>
              </span>
              {isToday && <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-extrabold leading-none md:text-[9px] ${isSelected ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                HARI INI
              </span>}
            </button>
          );
        })}
      </nav>

      {isAdmin && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--theme-card-bg)] px-4 py-3">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex flex-wrap items-center gap-2">
          Tanggal pemantauan
          <input type="date" aria-label="Tanggal pemantauan piket" value={selectedDate} onChange={event => {
            const value = event.target.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
            setSelectedDate(value); setSelectedDay(getCurrentDayName(`${value}T12:00:00+07:00`) as DayOfWeek);
          }} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs" />
        </label>
        <p className="text-xs text-slate-500">Status otomatis dari presensi: masuk → BERJALAN, pulang → SELESAI. <strong>Berhalangan</strong> dipakai jika guru mendadak tidak bisa bertugas dan perlu pengganti. <strong>Batalkan</strong> dipakai untuk menonaktifkan jadwal pada tanggal dipilih atau seluruh jadwal berulang melalui konfirmasi admin.</p>
      </div>}

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
      {/* Keep day selection responsive; never expose actions from the previous date. */}
      {selectionPending ? <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 p-4 text-xs text-slate-500">Menampilkan jadwal {selectedDay.toLowerCase()}…</div> : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {filtered.length > 0 ? (
gridRows
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak ada jadwal piket pada hari {displayDay}
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
                {tableRows}
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
