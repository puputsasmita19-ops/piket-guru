import React, { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useWibToday } from '../../hooks/useWibToday';
import { useHistoryPagination, useHistoryPeriod } from '../../hooks/useHistoryPeriod';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { AttendanceRecord, ScheduleItem, SchoolSettings } from '../../types';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { isScheduleOnDate } from '../../utils/scheduleUtils';
import { formatIndonesianDate, formatTime, toEpochMs } from '../../utils/dateUtils';
import { HistoryControls, HistoryPagination, useHistoryView } from '../../components/common/HistoryControls';
import { AdminAttendanceDialog, AdminAttendanceSelection } from './AdminAttendanceDialog';
import { Activity, Users, CheckCircle2, AlertTriangle, Clock, MapPin, Edit3, Trash2 } from '../../components/icons';
import { RealtimeMonitorLogo } from '../../components/icons/RealtimeMonitorLogo';
import { buildAdminMonitorRows } from '../../utils/adminMonitorRows';

const Metric: React.FC<{ label: string; value: number; description: string; icon: React.ReactNode; tone?: string }> = ({ label, value, description, icon, tone = 'text-slate-700 dark:text-slate-200' }) => <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-[var(--theme-card-bg)] shadow-sm">
  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span><span className={tone}>{icon}</span></div>
  <div className={`mt-2 text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
</div>;

/** Realtime admin-only view; queries are restricted to today's records and an explicit bounded history period. */
export const AdminAttendanceDashboard: React.FC = () => {
  const { hasRole, isOffline, currentUser } = useAuth();
  const admin = hasRole('ADMIN');
  const today = useWibToday();
  const [school, setSchool] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const history = useHistoryPeriod(school);
  const [historyView, setHistoryView] = useHistoryView();
  // The admin landing view needs today's metrics, not a month of history.
  // Attach the bounded history listener only when the administrator opens it.
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [expandDutyBooks, setExpandDutyBooks] = useState(false);
  const [todayError, setTodayError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<AdminAttendanceSelection | null>(null);
  const [feedback, setFeedback] = useState('');
  const [monitorView, setMonitorView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!admin) return;
    const stopSchool = FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', data => { if (data) setSchool(data); });
    const stopSchedule = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules, error => setTodayError(error?.message || 'Jadwal tidak dapat dibaca.'));
    return () => { stopSchool(); stopSchedule(); };
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    setLoading(true); setTodayError(''); setTodayRecords([]); setDutyBooks([]);
    const stopBooks = FirestoreService.subscribeToCollection<DutyBookRecord>('dutyBooks', setDutyBooks,
      error => setTodayError(error?.message || 'Jurnal piket tidak dapat dibaca.'),
      [where('tanggal', '==', today)], { cacheKey: `admin-monitor-books:${today}` });
    const stopAttendance = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', data => {
      setTodayRecords(data); setLoading(false);
    }, error => { setTodayError(error?.message || 'Gagal membaca presensi hari ini.'); setLoading(false); },
    [where('tanggal', '==', today)], { cacheKey: `admin-monitor-today:${today}` });
    return () => { stopAttendance(); stopBooks(); };
  }, [admin, today]);

  useEffect(() => {
    setHistoricalRecords([]); setHistoryError('');
    if (!admin || !historyExpanded || history.range.error) return;
    return FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', setHistoricalRecords,
      error => setHistoryError(error?.message || 'Riwayat belum dapat dimuat.'),
      history.constraints, { cacheKey: `admin-monitor-history:${history.key}` });
  }, [admin, historyExpanded, history.key, history.constraints, history.range.error]);

  // Each person is one row even with several shifts; do not count a multi-shift teacher twice.
  const dailyRows = useMemo(
    () => buildAdminMonitorRows(schedules, todayRecords, schedule => isScheduleOnDate(schedule, today)),
    [schedules, todayRecords, today],
  );

  const assignedRows = dailyRows.filter(r => !r.id.startsWith('extra:'));
  const hadir = assignedRows.filter(r => Boolean(r.attendance)).length;
  const belumHadir = assignedRows.filter(r => !r.attendance).length;
  const belumPulang = dailyRows.filter(r => r.attendance && !r.attendance.jamPulang).length;
  const selesai = dailyRows.filter(r => Boolean(r.attendance?.jamPulang)).length;
  const gpsWarning = dailyRows.filter(r => r.attendance && r.attendance.status !== 'DALAM_LOKASI').length;
  const submittedBooks = dutyBooks.filter(b => getDutyBookDisplayStatus(b.status).stage !== 'DRAFT').length;
  const recentDutyBooks = [...dutyBooks].sort((a,b) => toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt));

  const historyUsers = useMemo(() => [...new Map(historicalRecords.map(a => [a.userId, { id: a.userId, name: a.userName }])).values()].sort((a,b) => a.name.localeCompare(b.name, 'id-ID')), [historicalRecords]);
  const filtered = useMemo(() => historicalRecords.filter(a =>
    (userFilter === 'all' || a.userId === (userFilter === 'me' ? currentUser?.id : userFilter)) &&
    `${a.userName} ${a.tanggal} ${a.status} ${a.id}`.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))
  ).sort((a,b) => toEpochMs(b.jamMasuk) - toEpochMs(a.jamMasuk)), [historicalRecords, userFilter, search, currentUser?.id]);
  const page = useHistoryPagination(filtered, `${history.key}:${userFilter}:${search}`, 12);
  if (!admin) return <div role="alert" className="p-5 rounded-xl bg-rose-50 text-rose-800">Menu Monitoring Piket hanya untuk Administrator.</div>;

  const buttons = (record: AttendanceRecord) => <div className="flex items-center gap-2 flex-wrap">
    <button type="button" onClick={() => setSelection({ record, mode: 'edit' })} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
    <button type="button" onClick={() => setSelection({ record, mode: 'delete' })} className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
  </div>;

  return <div className="space-y-6 pb-5">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div><h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex gap-2 items-center"><RealtimeMonitorLogo className="w-6 h-6 text-[var(--theme-primary)]" /> Monitoring Piket Realtime</h1>
        <p className="text-xs text-slate-500 mt-1">Dashboard khusus administrator · {formatIndonesianDate(today)} · Pembaruan otomatis dari Firestore</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 self-start">
          <button type="button" onClick={() => setMonitorView('grid')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${monitorView === 'grid' ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Grid</button>
          <button type="button" onClick={() => setMonitorView('list')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${monitorView === 'list' ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>List</button>
        </div>
        <span className={`self-start text-xs font-bold rounded-full px-3 py-1.5 ${isOffline ? 'text-amber-800 bg-amber-100' : 'text-emerald-800 bg-emerald-100'}`}>{isOffline ? 'Offline · mungkin menampilkan cache' : 'Online · Realtime'}</span>
      </div>
    </div>
    {feedback && <div role="status" className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">{feedback}</div>}
    {(todayError || historyError) && <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">{todayError || historyError}</div>}
    <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
      <Metric label="Guru Dijadwalkan" value={assignedRows.length} description="Petugas unik hari ini" icon={<Users className="w-5 h-5" />} />
      <Metric label="Sudah Hadir" value={hadir} description="Dari guru dijadwalkan" icon={<CheckCircle2 className="w-5 h-5" />} tone="text-emerald-700 dark:text-emerald-400" />
      <Metric label="Belum Hadir" value={belumHadir} description="Dari guru dijadwalkan" icon={<Clock className="w-5 h-5" />} tone="text-amber-700 dark:text-amber-400" />
      <Metric label="Belum Pulang" value={belumPulang} description="Sudah masuk, belum checkout" icon={<AlertTriangle className="w-5 h-5" />} tone="text-orange-700 dark:text-orange-400" />
      <Metric label="Selesai Piket" value={selesai} description={`${gpsWarning} presensi berstatus GPS perhatian`} icon={<CheckCircle2 className="w-5 h-5" />} tone="text-sky-700 dark:text-sky-400" />
      <Metric label="Jurnal Piket" value={submittedBooks} description={`${dutyBooks.length} jurnal hari ini, termasuk draf`} icon={<Activity className="w-5 h-5" />} tone="text-violet-700 dark:text-violet-400" />
    </div>
    <section aria-labelledby="status-today" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--theme-card-bg)] overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"><div><h2 id="status-today" className="font-bold text-slate-900 dark:text-white">Aktivitas Piket Hari Ini</h2><p className="text-xs text-slate-500">Guru berdasarkan jadwal aktif, ditambah presensi tanpa jadwal. {loading && 'Memuat data…'}</p></div><span className="text-[11px] font-semibold text-slate-500">Tampilan {monitorView === 'grid' ? 'grid' : 'list'} · scroll aktif</span></div>
      {dailyRows.length === 0 ? <div className="p-6 text-sm text-slate-500">{loading ? 'Memuat status piket…' : 'Belum ada jadwal atau presensi hari ini.'}</div> : <div className="max-h-[34rem] overflow-y-auto p-3 pr-2"><div className={monitorView === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-3'}>
        {dailyRows.map(row => <div key={row.id} className={`rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30 ${monitorView === 'list' ? 'flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3' : 'space-y-2'}`}>
          <div className="min-w-0 space-y-2 flex-1"><div className="flex justify-between items-start gap-2"><div className="font-bold text-sm text-slate-900 dark:text-white min-w-0">{row.name}<p className="font-normal text-[11px] text-slate-500 break-words">{row.assignment}</p></div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${!row.attendance ? 'bg-amber-100 text-amber-800' : row.attendance.jamPulang ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{!row.attendance ? 'Belum hadir' : row.attendance.jamPulang ? 'Selesai' : 'Bertugas'}</span></div>
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap"><Clock className="w-3.5 h-3.5 shrink-0" /> Masuk {row.attendance ? formatTime(row.attendance.jamMasuk) : '—'} · Pulang {row.attendance?.jamPulang ? formatTime(row.attendance.jamPulang) : '—'}</div>
          {row.attendance && <p className="text-[11px] text-slate-500 flex gap-1 items-center flex-wrap"><MapPin className="w-3.5 h-3.5" /> {row.attendance.status} · {row.attendance.distance} m</p>}</div>
          {row.attendance && <div className="shrink-0">{buttons(row.attendance)}</div>}
        </div>)}
      </div></div>}
    </section>
    <section aria-labelledby="duty-activity-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--theme-card-bg)] overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"><div><h2 id="duty-activity-title" className="font-bold text-slate-900 dark:text-white">Jurnal Kegiatan Piket Hari Ini</h2><p className="text-xs text-slate-500">Kegiatan dari Buku Piket Digital diperbarui secara realtime.</p></div>
        {recentDutyBooks.length > 5 && <button type="button" onClick={() => setExpandDutyBooks(v => !v)} className="text-xs font-semibold text-[var(--theme-primary)]">{expandDutyBooks ? 'Tampilkan ringkas' : `Lihat semua (${recentDutyBooks.length})`}</button>}
      </div>
      {recentDutyBooks.length ? <div className="max-h-[30rem] overflow-y-auto p-3 pr-2"><div className={monitorView === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'space-y-3'}>{recentDutyBooks.slice(0, expandDutyBooks ? undefined : 5).map(book => <article key={book.id} className={`rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-1.5 ${monitorView === 'list' ? 'bg-slate-50/60 dark:bg-slate-800/20' : ''}`}>
        <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold">{book.petugasName} <span className="font-normal text-xs text-slate-500">· {book.ruangName}</span></p><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">{getDutyBookDisplayStatus(book.status).label}</span></div>
        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{book.catatanPiket || 'Belum ada catatan kegiatan.'}</p>
        {book.tindakLanjut && <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold">Tindak lanjut:</span> {book.tindakLanjut}</p>}
        <p className="text-[11px] text-slate-500">Terakhir diperbarui: {formatTime(book.updatedAt)}</p>
      </article>)}</div></div> : <p className="p-5 text-sm text-slate-500">Belum ada jurnal piket hari ini.</p>}
    </section>
    <section aria-labelledby="history-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[var(--theme-card-bg)] overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
        <div><h2 id="history-title" className="font-bold text-slate-900 dark:text-white">Kelola Riwayat Presensi Guru Piket</h2>
          <p className="text-xs text-slate-500 mt-1">Riwayat dimuat saat dibuka untuk menghemat pembacaan Firebase. Edit/hapus tetap memakai audit Admin.</p></div>
        <button type="button" aria-controls="monitor-history-content" aria-expanded={historyExpanded} onClick={() => setHistoryExpanded(value => !value)}
          className="min-h-10 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {historyExpanded ? 'Tutup Riwayat' : 'Buka Riwayat Presensi'}
        </button>
      </div>
      {historyExpanded && <div id="monitor-history-content">
      <div className="p-3 space-y-3"><HistoryControls history={history} view={historyView} onViewChange={setHistoryView} user={userFilter} onUserChange={setUserFilter} users={historyUsers} />
        <input aria-label="Cari riwayat" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, tanggal, status atau ID…" className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
        {history.range.error && <p role="alert" className="text-xs text-rose-700">{history.range.error}</p>}
      </div>
      <div className="max-h-[32rem] overflow-y-auto"><div className={historyView === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 gap-3 p-3" : "divide-y divide-slate-100 dark:divide-slate-800"}>{page.records.map(a => <div key={a.id} className={`${historyView === 'grid' ? 'rounded-xl border border-slate-200 dark:border-slate-700' : ''} p-3 sm:p-4 flex flex-col sm:flex-row sm:justify-between gap-3`}>
        <div className="space-y-1 min-w-0"><p className="font-bold text-sm">{a.userName}</p><p className="text-xs text-slate-500">{formatIndonesianDate(a.tanggal)} · Masuk: {formatTime(a.jamMasuk)} · Pulang: {formatTime(a.jamPulang)}</p>
          <p className="text-[11px] text-slate-500">{a.status} · Jarak {a.distance} m {a.adminCorrection ? '· Sudah dikoreksi admin' : ''}</p></div>
        <div className="self-start shrink-0">{buttons(a)}</div></div>)}
        {page.records.length === 0 && <p className="p-6 text-sm text-slate-500">Tidak ada presensi pada filter/periode ini.</p>}
      </div></div>
      <HistoryPagination {...page} />
      </div>}
    </section>
    <AdminAttendanceDialog selection={selection} onClose={() => setSelection(null)} onCompleted={setFeedback} />
  </div>;
};
