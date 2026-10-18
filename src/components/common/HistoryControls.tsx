import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LayoutGrid, List } from '../icons';
import type { useHistoryPeriod } from '../../hooks/useHistoryPeriod';

export type HistoryViewMode = 'grid' | 'list';
export function useHistoryView() { return useState<HistoryViewMode>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list'); }
type Period = ReturnType<typeof useHistoryPeriod>;
export function HistoryControls({ history, view, onViewChange, user, onUserChange, users }: {
  history: Period; view: HistoryViewMode; onViewChange: (view: HistoryViewMode) => void;
  user?: string; onUserChange?: (user: string) => void; users?: { id: string; name: string }[];
}) {
  const { value, setValue, range } = history;
  return <div className="history-controls">
    <div className="history-controls-row">
      <label className="history-field"><span>Periode</span><select aria-label="Periode riwayat" value={value.mode} onChange={e => setValue(v => ({ ...v, mode: e.target.value as typeof v.mode, anchor: '' }))}>
        <option value="today">Hari ini</option><option value="week">Minggu</option><option value="month">Bulan</option><option value="semester">Semester</option><option value="year">Tahun</option><option value="custom">Rentang waktu</option>
      </select></label>
      {value.mode === 'month' && <label className="history-field"><span>Bulan</span><input aria-label="Bulan riwayat" type="month" value={(value.anchor || history.today).slice(0, 7)} onChange={e => setValue(v => ({ ...v, anchor: e.target.value ? e.target.value + '-01' : '' }))}/></label>}
      {value.mode === 'week' && <label className="history-field"><span>Minggu yang memuat</span><input aria-label="Tanggal acuan minggu" type="date" value={value.anchor || history.today} onChange={e => setValue(v => ({ ...v, anchor: e.target.value }))}/></label>}
      {value.mode === 'year' && <label className="history-field"><span>Tahun</span><input aria-label="Tahun riwayat" type="number" min="1900" max="9999" value={(value.anchor || history.today).split('-')[0]} onChange={e => setValue(v => ({ ...v, anchor: e.target.value + '-01-01' }))}/></label>}
      {value.mode === 'semester' && <label className="history-field"><span>Semester pelajaran</span><select aria-label="Semester pelajaran" value={value.semester} onChange={e => setValue(v => ({ ...v, semester: e.target.value as typeof v.semester }))}><option value="current">Semester berjalan</option><option value="odd">Ganjil sesuai pengaturan admin</option><option value="even">Genap sesuai pengaturan admin</option></select></label>}
      {value.mode === 'custom' && <><label className="history-field"><span>Dari tanggal</span><input aria-label="Dari tanggal" type="date" value={value.from} onChange={e => setValue(v => ({ ...v, from: e.target.value }))}/></label><label className="history-field"><span>Sampai tanggal</span><input aria-label="Sampai tanggal" type="date" min={value.from} value={value.to} onChange={e => setValue(v => ({ ...v, to: e.target.value }))}/></label></>}
      {onUserChange && <label className="history-field"><span>Pengguna</span><select aria-label="Pengguna riwayat" value={user} onChange={e => onUserChange(e.target.value)}><option value="all">Semua pengguna</option><option value="me">Saya sendiri</option>{users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
      <div className="history-view-toggle" role="group" aria-label="Tampilan riwayat">{(['grid', 'list'] as const).map(mode => <button key={mode} type="button" aria-label={mode === 'grid' ? 'Tampilan grid' : 'Tampilan list'} aria-pressed={view === mode} onClick={() => onViewChange(mode)}>{mode === 'grid' ? <LayoutGrid className="w-4 h-4"/> : <List className="w-4 h-4"/>}<span>{mode === 'grid' ? 'Grid' : 'List'}</span></button>)}</div>
    </div>
    <p className={range.error ? 'text-xs text-rose-700 dark:text-rose-300' : 'text-[11px] text-slate-500 dark:text-slate-400'} role={range.error ? 'alert' : undefined}>{range.error || `${range.label} · WIB${value.mode === 'week' ? ' · Senin–Minggu' : ''}`}</p>
  </div>;
}

/** The original table and action handlers stay intact in either presentation. */
export function HistoryTable({ view, children }: { view: HistoryViewMode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const table = ref.current?.querySelector('table'); if (!table) return;
    const labels = Array.from(table.querySelectorAll('thead th'), th => th.textContent?.trim() || 'Pilihan');
    for (const row of table.querySelectorAll('tbody tr')) Array.from(row.children).forEach((cell, i) => { if ((cell as HTMLTableCellElement).colSpan === 1) (cell as HTMLElement).dataset.label = labels[i] || ''; });
  });
  return <div ref={ref} className="history-table" data-view={view}>{children}</div>;
}

export function HistoryPagination({ page, pages, setPage, total, pageSize }: { page: number; pages: number; setPage: React.Dispatch<React.SetStateAction<number>>; total: number; pageSize: number }) {
  return <div className="history-pagination"><span role="status">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} dari ${total} data` : '0 data'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Sebelumnya</button><span>{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Berikutnya</button></div></div>;
}
