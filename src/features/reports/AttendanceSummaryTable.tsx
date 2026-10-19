import React, { useEffect, useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from '../../components/icons';
import type { TeacherAttendanceSummary } from '../../services/reports/reportService';
import './AttendanceSummaryTable.css';

interface AttendanceSummaryTableProps {
  items: TeacherAttendanceSummary[];
  periodLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
}

export function filterAttendanceSummaries(items: TeacherAttendanceSummary[], search: string): TeacherAttendanceSummary[] {
  const needle = search.trim().toLocaleLowerCase('id-ID');
  return needle ? items.filter(item => `${item.fullName} ${item.nip || ''}`.toLocaleLowerCase('id-ID').includes(needle)) : items;
}

/** Presentation pagination only: report totals, period queries and exports stay complete. */
export function AttendanceSummaryTable({ items, periodLabel, search, onSearchChange }: AttendanceSummaryTableProps) {
  const titleId = useId();
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterAttendanceSummaries(items, search), [items, search]);
  useEffect(() => { setPage(1); }, [search, pageSize, periodLabel]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return <section className="attendance-summary" aria-labelledby={titleId}>
    <header className="attendance-summary-header">
      <div><h3 id={titleId}>Rekap Kehadiran Guru Piket</h3><p>{periodLabel}</p></div>
      <span className="attendance-summary-total">{items.length} guru</span>
    </header>
    <div className="attendance-summary-tools">
      <label className="attendance-summary-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Cari guru atau NIP pada rekap kehadiran</span>
        <input type="search" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Nama / NIP" />
      </label>
      <label className="attendance-summary-size">
        <span className="sr-only">Jumlah guru per halaman</span>
        <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>
          {[5, 10, 20].map(size => <option key={size} value={size}>{size} baris</option>)}
        </select>
      </label>
    </div>
    <table>
      <caption className="sr-only">Rekap kehadiran guru piket, {periodLabel}. Hadir GPS dibandingkan dengan total shift.</caption>
      <thead><tr>
        <th scope="col" className="attendance-summary-person">Guru / Petugas</th>
        <th scope="col" className="attendance-summary-desktop">Total Shift</th>
        <th scope="col" className="attendance-summary-desktop">Hadir GPS</th>
        <th scope="col" className="attendance-summary-desktop">Luar Radius</th>
        <th scope="col" className="attendance-summary-mobile">Presensi</th>
        <th scope="col" className="attendance-summary-result">Capaian</th>
      </tr></thead>
      <tbody>{visible.length ? visible.map(item => <tr key={item.teacherId}>
        <th scope="row" className="attendance-summary-person">
          <span className="attendance-summary-name">{item.fullName}</span>
          {item.nip?.trim() && <span className="attendance-summary-nip">NIP {item.nip}</span>}
        </th>
        <td className="attendance-summary-desktop">{item.totalShift}</td>
        <td className="attendance-summary-desktop attendance-summary-valid">{item.hadir}</td>
        <td className="attendance-summary-desktop attendance-summary-outside">{item.terlambatOrOutside}</td>
        <td className="attendance-summary-mobile">
          <span className="attendance-summary-ratio"><strong>{item.hadir}</strong> / {item.totalShift}</span>
          <span className="attendance-summary-detail">GPS / shift</span>
          <span className="attendance-summary-detail attendance-summary-outside">Luar radius: {item.terlambatOrOutside}</span>
        </td>
        <td className="attendance-summary-result">
          <strong className={item.percentage >= 80 ? 'attendance-summary-valid' : 'attendance-summary-outside'}>{item.percentage}%</strong>
          <span className="attendance-summary-detail">{item.percentage >= 80 ? 'Sangat Baik' : 'Cukup'}</span>
        </td>
      </tr>) : <tr><td colSpan={6} className="attendance-summary-empty" role="status">
        {items.length ? 'Guru tidak ditemukan. Coba nama atau NIP lain.' : 'Tidak ada data guru pada periode ini.'}
      </td></tr>}</tbody>
    </table>
    <footer className="attendance-summary-footer">
      <span role="status" aria-live="polite">{filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} dari ${filtered.length} guru` : '0 guru'}</span>
      <nav aria-label="Halaman rekap kehadiran">
        <button type="button" aria-label="Halaman rekap sebelumnya" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></button>
        <span aria-label={`Halaman ${currentPage} dari ${pages}`}>{currentPage} / {pages}</span>
        <button type="button" aria-label="Halaman rekap berikutnya" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button>
      </nav>
    </footer>
  </section>;
}
