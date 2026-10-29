import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { AttendanceRecord } from '../../types';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import { summarizeCheckoutHistory } from '../../utils/missingCheckoutPolicy';
import { readMissingCheckoutPage, verifyMissingCheckoutCandidate } from '../../services/firebase/missingCheckoutService';
import { AlertTriangle, Clock, Edit3, RefreshCw } from '../../components/icons';

const DAYS = [7, 14, 30] as const;
type WindowDays = typeof DAYS[number];

export const MissingCheckoutPanel: React.FC<{
  today: string;
  correctionRevision: number;
  onCorrect: (record: AttendanceRecord) => void;
}> = ({ today, correctionRevision, onCorrect }) => {
  const { currentUser, hasRole, isOffline } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState<WindowDays>(7);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState<'first' | 'more' | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastVerified, setLastVerified] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestGeneration = useRef(0);
  const uid = currentUser?.id || '';
  const admin = hasRole('ADMIN');

  useEffect(() => {
    const generation = ++requestGeneration.current;
    setRecords([]); setCursor(null); setHasMore(false); setLastVerified(null);
    setCheckingId(null); setError(''); setBusy(null);
    if (!expanded || !admin) return () => { requestGeneration.current++; };
    if (isOffline) {
      setError('Sedang offline. Data historis hanya ditampilkan setelah berhasil dibaca dari server.');
      return () => { requestGeneration.current++; };
    }
    setBusy('first');
    void readMissingCheckoutPage(uid, today, days).then(page => {
      if (generation !== requestGeneration.current) return;
      setRecords(page.items); setCursor(page.cursor); setHasMore(page.hasMore); setLastVerified(new Date());
    }).catch(cause => {
      if (generation !== requestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : 'Server tidak dapat memverifikasi riwayat.');
    }).finally(() => { if (generation === requestGeneration.current) setBusy(null); });
    return () => { requestGeneration.current++; };
  }, [expanded, admin, uid, isOffline, today, days, correctionRevision, refreshKey]);

  const loadMore = async () => {
    if (!cursor || !hasMore || busy || checkingId || isOffline) return;
    const generation = requestGeneration.current;
    setBusy('more'); setError('');
    try {
      const page = await readMissingCheckoutPage(uid, today, days, cursor);
      if (generation !== requestGeneration.current) return;
      setRecords(previous => {
        const byId = new Map(previous.map(record => [record.id, record]));
        page.items.forEach(record => byId.set(record.id, record));
        return Array.from(byId.values());
      });
      setCursor(page.cursor); setHasMore(page.hasMore); setLastVerified(new Date());
    } catch (cause) {
      if (generation === requestGeneration.current) {
        // A failed continuation invalidates the guarantee that the displayed list is complete.
        setError(cause instanceof Error ? cause.message : 'Gagal mengambil halaman berikutnya.');
      }
    } finally { if (generation === requestGeneration.current) setBusy(null); }
  };

  // The cursor can split a calendar day; exclude the incomplete day until its final page is loaded.
  const incompleteDate = hasMore && cursor ? String(cursor.data().tanggal || '') : undefined;
  const summary = useMemo(() => summarizeCheckoutHistory(records, today, incompleteDate), [records, today, incompleteDate]);
  const term = search.trim().toLocaleLowerCase('id-ID');
  const filtered = useMemo(() => summary.missing.filter(({ record }) =>
    !term || `${record.userName} ${record.userId} ${record.tanggal}`.toLocaleLowerCase('id-ID').includes(term)
  ), [summary, term]);

  const correct = async (record: AttendanceRecord) => {
    if (checkingId || busy || isOffline || !admin) return;
    const generation = requestGeneration.current;
    setCheckingId(record.id); setError('');
    try {
      const verified = await verifyMissingCheckoutCandidate(uid, record, today);
      if (generation === requestGeneration.current) onCorrect(verified);
    } catch (cause) {
      if (generation === requestGeneration.current) {
        setError(cause instanceof Error ? cause.message : 'Presensi belum bisa diverifikasi. Muat ulang daftar.');
      }
    } finally { if (generation === requestGeneration.current) setCheckingId(null); }
  };

  if (!admin) return null;
  return <section aria-labelledby="r89c-title" className="overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-white dark:bg-[var(--theme-card-bg)]">
    <header className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
      <div className="min-w-0 flex-1">
        <h2 id="r89c-title" className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Checkout Belum Tercatat · Hari Sebelumnya</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">R89-C · Riwayat dipisahkan dari “Belum Pulang Hari Ini”. Hanya Admin yang bisa memeriksa dan mengoreksi.</p>
      </div>
      <button type="button" aria-expanded={expanded} aria-controls="r89c-content" onClick={() => setExpanded(value => !value)}
        className="min-h-10 px-4 py-2 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950 focus-visible:outline focus-visible:outline-2">
        {expanded ? 'Tutup Monitoring' : 'Periksa Checkout Terlewat'}
      </button>
    </header>
    {expanded && <div id="r89c-content" className="p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rentang monitoring checkout">
          {DAYS.map(value => <button key={value} type="button" onClick={() => setDays(value)} aria-pressed={days === value}
            className={`min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg border ${days === value ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{value} hari</button>)}
        </div>
        <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={Boolean(busy) || Boolean(checkingId) || isOffline}
          className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800"><RefreshCw className="w-3.5 h-3.5" /> Segarkan dari Server</button>
      </div>
      <div className="rounded-xl p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-[11px] sm:text-xs text-sky-900 dark:text-sky-200">
        “Checkout belum tercatat” berarti <strong>belum ditemukan waktu pulang pada data server yang telah diperiksa</strong>, bukan bukti guru tidak mencoba checkout. Konfirmasi antrean offline/sinkronisasi di perangkat guru sebelum koreksi. Tidak ada checkout otomatis.
      </div>
      {lastVerified && !isOffline && <p className="text-[11px] text-slate-500" role="status">Dibaca dari server pukul {formatTime(lastVerified)} · {records.length} record operasional dimuat {hasMore ? '(parsial; masih ada halaman)' : '(selesai untuk rentang ini)'}</p>}
      <input aria-label="Cari guru dalam monitoring checkout" value={search} onChange={event => setSearch(event.target.value)}
        placeholder="Cari nama, ID guru, atau tanggal…" className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-white" />
      {hasMore && <p className="text-xs text-amber-700 dark:text-amber-300">Daftar dan pencarian hanya mencakup halaman yang sudah dimuat. {summary.boundaryDeferred > 0 ? `${summary.boundaryDeferred} record pada tanggal batas halaman ditahan sementara agar tidak salah diklasifikasi.` : ''} Klik “Muat 100 Lagi” untuk melanjutkan.</p>}
      {lastVerified && summary.ignored > 0 && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{summary.ignored} entri tidak dapat diklasifikasikan karena identitas, tanggal, atau waktu masuk tidak valid. Periksa melalui Riwayat Presensi.</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 text-rose-700 dark:text-rose-300 p-3 text-xs">{error}</p>}
      {lastVerified && !isOffline && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 p-3"><div className="text-[11px] text-slate-500">Belum Tercatat {hasMore ? '(parsial)' : ''}</div><div className="font-bold text-xl text-amber-700 dark:text-amber-300 tabular-nums">{summary.missing.length}</div></div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 p-3"><div className="text-[11px] text-slate-500">Perlu Review Data</div><div className="font-bold text-xl text-rose-700 dark:text-rose-300 tabular-nums">{summary.conflicts.length}</div></div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 p-3 col-span-2 sm:col-span-1"><div className="text-[11px] text-slate-500">Checkout Tercatat</div><div className="font-bold text-xl text-emerald-700 dark:text-emerald-300 tabular-nums">{summary.completed}</div></div>
      </div>}
      {busy === 'first' && <p role="status" className="p-4 text-sm text-slate-500">Memverifikasi presensi tanggal lampau dari server…</p>}
      {lastVerified && !isOffline && <>
        {summary.conflicts.length > 0 && <div className="rounded-xl p-3 border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-200">Perlu review manual · kemungkinan duplikat / waktu pulang tidak valid (tidak dapat dikoreksi dari panel ini)</p>
          <div className="max-h-40 overflow-y-auto space-y-1">{summary.conflicts.map(({ record, duplicateCount }) => <p key={`${record.tanggal}:${record.userId}`} className="text-xs text-slate-700 dark:text-slate-200">{record.userName} · {formatIndonesianDate(record.tanggal)} · {duplicateCount > 1 ? `${duplicateCount} record` : 'Waktu pulang tidak valid'}</p>)}</div>
        </div>}
        {filtered.length === 0 ? <p className="p-4 text-sm text-slate-500">{term ? 'Tidak ada hasil pada data yang sudah dimuat.' : 'Belum ada checkout historis yang dapat diklasifikasi sebagai belum tercatat pada data yang sudah dimuat.'}</p> : <div className="max-h-[34rem] overflow-y-auto space-y-2 pr-1">
          {filtered.map(({ record }) => <article key={record.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-bold break-words text-slate-900 dark:text-white">{record.userName} <span className="ml-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Belum tercatat</span></div>
              <p className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatIndonesianDate(record.tanggal)} · Masuk {formatTime(record.jamMasuk)} · Pulang —</p>
              <p className="text-[11px] text-slate-500 break-all">ID guru: {record.userId} · ID presensi: {record.id}</p>
            </div>
            <button type="button" onClick={() => void correct(record)} disabled={Boolean(checkingId) || Boolean(busy) || isOffline || Boolean(error)}
              className="min-h-10 shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-200 disabled:opacity-40 hover:bg-sky-50 dark:hover:bg-sky-950">
              <Edit3 className="w-3.5 h-3.5" />{checkingId === record.id ? 'Verifikasi…' : 'Tinjau & Koreksi'}
            </button>
          </article>)}
        </div>}
      </>}
      {hasMore && !isOffline && <button type="button" onClick={() => void loadMore()} disabled={Boolean(busy) || Boolean(checkingId)}
        className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">
        {busy === 'more' ? 'Memuat dari server…' : 'Muat 100 Lagi'}
      </button>}
    </div>}
  </section>;
};
