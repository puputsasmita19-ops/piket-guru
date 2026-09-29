import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolSettings } from '../../types';
import { TeacherAttendanceSummary, IncidentCategorySummary } from '../../services/reports/reportService';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, X } from 'lucide-react';

interface MonthlyReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  periodLabel: string;
  attendanceSummaries: TeacherAttendanceSummary[];
  incidentSummaries: IncidentCategorySummary[];
  totalIncidents: number;
  resolvedIncidents: number;
}

export const MonthlyReportPrintModal: React.FC<MonthlyReportPrintModalProps> = ({
  isOpen,
  onClose,
  settings,
  periodLabel,
  attendanceSummaries,
  incidentSummaries,
  totalIncidents,
  resolvedIncidents,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const avgAttendance = attendanceSummaries.length > 0
    ? Math.round(attendanceSummaries.reduce((acc, curr) => acc + curr.percentage, 0) / attendanceSummaries.length)
    : 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Rekapitulasi Laporan Bulanan" maxWidth="2xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Pratinjau Berkas Rekapitulasi Resmi Siap Cetak (Format Standar A4)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak / Simpan PDF
          </Button>
        </div>

        {/* PRINT PAPER */}
        <div className="bg-white text-black p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 font-serif text-xs leading-relaxed space-y-5">
          {/* KOP SURAT */}
          <div className="text-center border-b-2 border-black pb-3 space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wider">
              {settings.schoolName}
            </h2>
            <p className="text-[11px] italic">
              NPSN: {settings.npsn} • {settings.address}
            </p>
            <h3 className="text-xs font-bold uppercase tracking-wide pt-1.5 underline">
              LAPORAN REKAPITULASI PELAKSANAAN TUGAS PIKET & KETERTIBAN SEKOLAH
            </h3>
            <p className="text-[11px] font-sans font-bold">Periode: {periodLabel}</p>
          </div>

          {/* RINGKASAN EKSEKUTIF */}
          <div className="border border-slate-300 p-3 rounded-lg text-[11px] space-y-1 bg-slate-50">
            <h5 className="font-bold underline">Ringkasan Statistik Utama:</h5>
            <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
              <div>Rata-rata Kehadiran Piket: <strong>{avgAttendance}%</strong></div>
              <div>Total Kejadian Dilaporkan: <strong>{totalIncidents} Kasus</strong></div>
              <div>Kasus Selesai Ditangani: <strong>{resolvedIncidents} ({totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 100}%)</strong></div>
            </div>
          </div>

          {/* TABEL 1: REKAP KEHADIRAN GURU */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              A. Rekapitulasi Presensi & Kedisiplinan Guru Piket
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Nama Guru / Petugas</th>
                  <th className="border border-black p-1.5">NIP</th>
                  <th className="border border-black p-1.5">Total Shift</th>
                  <th className="border border-black p-1.5">Hadir (GPS)</th>
                  <th className="border border-black p-1.5">Luar Radius</th>
                  <th className="border border-black p-1.5">% Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSummaries.map((row, idx) => (
                  <tr key={row.teacherId}>
                    <td className="border border-black p-1.5">{idx + 1}</td>
                    <td className="border border-black p-1.5 text-left font-semibold">{row.fullName}</td>
                    <td className="border border-black p-1.5 font-mono">{row.nip}</td>
                    <td className="border border-black p-1.5">{row.totalShift}</td>
                    <td className="border border-black p-1.5 text-emerald-700 font-bold">{row.hadir}</td>
                    <td className="border border-black p-1.5">{row.terlambatOrOutside}</td>
                    <td className="border border-black p-1.5 font-bold">{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TABEL 2: REKAPITULASI KEJADIAN */}
          <div className="space-y-1.5 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              B. Rekapitulasi Laporan Kejadian & Penanganan Kasus
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Kategori Kejadian</th>
                  <th className="border border-black p-1.5">Total Kasus</th>
                  <th className="border border-black p-1.5">Tingkat Kritis/Tinggi</th>
                  <th className="border border-black p-1.5">Tuntas Selesai</th>
                  <th className="border border-black p-1.5">Dalam Proses</th>
                </tr>
              </thead>
              <tbody>
                {incidentSummaries.map((cat, idx) => (
                  <tr key={cat.categoryCode}>
                    <td className="border border-black p-1.5">{idx + 1}</td>
                    <td className="border border-black p-1.5 text-left font-semibold">{cat.categoryName}</td>
                    <td className="border border-black p-1.5 font-bold">{cat.total}</td>
                    <td className="border border-black p-1.5 text-rose-700 font-bold">{cat.kritis}</td>
                    <td className="border border-black p-1.5 text-emerald-700 font-bold">{cat.selesai}</td>
                    <td className="border border-black p-1.5">{cat.penanganan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TANDA TANGAN REKAP */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px]">
            <div>
              <p>Koordinator Tim Piket Sekolah,</p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                [Tanda Tangan & Cap]
              </div>
              <p className="font-bold underline">Drs. H. Ahmad Fauzi, M.Pd.</p>
              <p className="text-[9px] font-mono">NIP. 198503152010011002</p>
            </div>

            <div>
              <p>Mengetahui,<br />Kepala Sekolah,</p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                [Tanda Tangan & Cap Lembaga]
              </div>
              <p className="font-bold underline">Dr. Hj. Siti Rohmah, M.Pd.</p>
              <p className="text-[9px] font-mono">NIP. 197605122000032001</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
