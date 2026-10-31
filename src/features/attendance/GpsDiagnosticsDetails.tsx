import React from 'react';
import type { AttendanceRecord } from '../../types';
import { getGpsDiagnostic, getGpsDiagnosticLabel, type GpsDiagnosticSnapshot } from './gpsDiagnostics';

const displayMeters = (value: number | null) => value === null ? 'Tidak tersedia' : `${Math.round(value)} m`;
const displayTime = (value: number | null) => value === null ? 'Tidak tersedia' :
  new Intl.DateTimeFormat('id-ID', { timeZone:'Asia/Jakarta', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(value) + ' WIB';
const displayPoint = (value: number | null) => value === null ? 'Tidak tersedia' : value.toFixed(6);

const Snapshot: React.FC<{ title: string; gps: GpsDiagnosticSnapshot }> = ({ title, gps }) => {
  const label = getGpsDiagnosticLabel(gps);
  return <section className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</h5>
      <span className={`text-[10px] font-semibold ${label === 'Memenuhi batas' ? 'text-emerald-700 dark:text-emerald-300' : label === 'Perlu diperiksa' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
      <div><dt className="text-slate-500 dark:text-slate-400">Jarak</dt><dd className="font-semibold">{displayMeters(gps.distance)}</dd></div>
      <div><dt className="text-slate-500 dark:text-slate-400">Akurasi</dt><dd className="font-semibold">{gps.accuracy === null ? 'Tidak tersedia' : `±${displayMeters(gps.accuracy)}`}</dd></div>
      <div><dt className="text-slate-500 dark:text-slate-400">Radius saat validasi</dt><dd>{displayMeters(gps.radiusMeters)}</dd></div>
      <div><dt className="text-slate-500 dark:text-slate-400">Status tersimpan</dt><dd>{gps.status || 'Tidak tersedia'}</dd></div>
      <div className="col-span-2"><dt className="text-slate-500 dark:text-slate-400">Waktu pembacaan GPS</dt><dd>{displayTime(gps.capturedAtMs)}</dd></div>
      <div className="col-span-2"><dt className="text-slate-500 dark:text-slate-400">Waktu pencatatan / konfirmasi</dt><dd>{displayTime(gps.validatedAtMs)}</dd></div>
      <div className="col-span-2"><dt className="text-slate-500 dark:text-slate-400">Koordinat (latitude, longitude)</dt><dd className="break-all font-mono">{displayPoint(gps.latitude)}, {displayPoint(gps.longitude)}</dd></div>
    </dl>
  </section>;
};

/** Render only in a role-gated admin page; GPS coordinates are operationally sensitive. */
export const GpsDiagnosticsDetails: React.FC<{ record: AttendanceRecord }> = ({ record }) =>
  <details className="group min-w-0 max-w-lg text-left">
    <summary className="min-h-9 inline-flex cursor-pointer select-none items-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-[var(--theme-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:text-sky-300">Detail GPS</summary>
    <div className="mt-2 space-y-2 min-w-[230px] max-w-full">
      <Snapshot title="Check-In" gps={getGpsDiagnostic(record, 'in')} />
      <Snapshot title="Check-Out" gps={getGpsDiagnostic(record, 'out')} />
      <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Data lama dapat tidak memiliki waktu baca GPS atau bukti GPS Check-Out. Angka berasal dari perangkat pengguna dan bukan jaminan anti-manipulasi lokasi; koreksi administratif tidak dianggap sebagai pembacaan GPS baru.</p>
    </div>
  </details>;
