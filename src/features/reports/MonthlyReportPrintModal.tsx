import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolSettings } from '../../types';
import { TeacherAttendanceSummary, IncidentCategorySummary } from '../../services/reports/reportService';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { VisitorRecord } from '../../types/visitor.types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer } from 'lucide-react';

interface MonthlyReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  periodLabel: string;
  attendanceSummaries: TeacherAttendanceSummary[];
  incidentSummaries: IncidentCategorySummary[];
  totalIncidents: number;
  resolvedIncidents: number;
  tardyRecords?: StudentTardyRecord[];
  permitRecords?: StudentPermitRecord[];
  substitutionRecords?: TeacherSubstitutionRecord[];
  visitorRecords?: VisitorRecord[];
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
  tardyRecords = [],
  permitRecords = [],
  substitutionRecords = [],
  visitorRecords = [],
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const avgAttendance = attendanceSummaries.length > 0
    ? Math.round(attendanceSummaries.reduce((acc, curr) => acc + curr.percentage, 0) / attendanceSummaries.length)
    : 100;

  const totalTardy = tardyRecords.length;
  const totalPermits = permitRecords.length;
  const totalSubstitutions = substitutionRecords.length;
  const totalVisitors = visitorRecords.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Rekapitulasi Laporan Bulanan Resmi" maxWidth="2xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Pratinjau Berkas Rekapitulasi Resmi Siap Cetak (Format Standar A4 Cetak/PDF)
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

          {/* RINGKASAN EKSEKUTIF 6 MODUL */}
          <div className="border border-slate-300 p-3 rounded-lg text-[11px] space-y-1.5 bg-slate-50">
            <h5 className="font-bold underline">Ringkasan Statistik Eksekutif Seluruh Bidang Piket:</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 font-sans text-[10px]">
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Kepatuhan Guru Piket:</span>
                <strong className="text-xs text-blue-700">{avgAttendance}%</strong> ({attendanceSummaries.filter(a => a.percentage >= 80).length} Disiplin)
              </div>
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Insiden & Kasus:</span>
                <strong className="text-xs text-slate-800">{totalIncidents} Kasus</strong> ({resolvedIncidents} Selesai)
              </div>
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Keterlambatan Siswa:</span>
                <strong className="text-xs text-amber-700">{totalTardy} Kasus</strong> ({tardyRecords.reduce((acc, c) => acc + (c.poinPelanggaran || 0), 0)} Total Poin)
              </div>
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Izin Meninggalkan Sekolah:</span>
                <strong className="text-xs text-emerald-700">{totalPermits} Siswa</strong>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Guru Pengganti (Inval):</span>
                <strong className="text-xs text-indigo-700">{totalSubstitutions} Penugasan</strong>
              </div>
              <div className="p-2 border border-slate-200 rounded bg-white">
                <span className="text-slate-500 block">Buku Tamu Masuk:</span>
                <strong className="text-xs text-teal-700">{totalVisitors} Kunjungan</strong>
              </div>
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

          {/* TABEL 3: REKAPITULASI KETERLAMBATAN SISWA */}
          <div className="space-y-1.5 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              C. Rekapitulasi Kedisiplinan & Keterlambatan Siswa
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Nama Siswa</th>
                  <th className="border border-black p-1.5">Kelas</th>
                  <th className="border border-black p-1.5">Tanggal & Jam</th>
                  <th className="border border-black p-1.5">Menit Terlambat</th>
                  <th className="border border-black p-1.5 text-left">Alasan</th>
                  <th className="border border-black p-1.5 text-left">Bentuk Pembinaan</th>
                  <th className="border border-black p-1.5">Poin</th>
                </tr>
              </thead>
              <tbody>
                {tardyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-black p-2 italic text-slate-500">
                      Tidak ada catatan keterlambatan siswa pada periode ini.
                    </td>
                  </tr>
                ) : (
                  tardyRecords.slice(0, 10).map((r, idx) => (
                    <tr key={r.id}>
                      <td className="border border-black p-1.5">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-left font-semibold">{r.namaSiswa}</td>
                      <td className="border border-black p-1.5">{r.kelas}</td>
                      <td className="border border-black p-1.5 font-mono">{r.tanggal} ({r.jamDatang})</td>
                      <td className="border border-black p-1.5 text-amber-800 font-bold">{r.menitTerlambat} mnt</td>
                      <td className="border border-black p-1.5 text-left">{r.alasan.replace(/_/g, ' ')}</td>
                      <td className="border border-black p-1.5 text-left">{r.pembinaan.replace(/_/g, ' ')}</td>
                      <td className="border border-black p-1.5 font-bold text-rose-700">{r.poinPelanggaran}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {tardyRecords.length > 10 && (
              <p className="text-[9px] italic text-slate-500 text-right">
                * Menampilkan 10 dari total {tardyRecords.length} catatan keterlambatan. Rekapitulasi penuh tersedia pada arsip CSV.
              </p>
            )}
          </div>

          {/* TABEL 4: REKAPITULASI IZIN SISWA */}
          <div className="space-y-1.5 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              D. Rekapitulasi Perizinan Meninggalkan Sekolah / Kelas
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Nama Siswa</th>
                  <th className="border border-black p-1.5">Kelas</th>
                  <th className="border border-black p-1.5">Waktu Keluar</th>
                  <th className="border border-black p-1.5 text-left">Jenis Izin</th>
                  <th className="border border-black p-1.5 text-left">Alasan / Kepentingan</th>
                  <th className="border border-black p-1.5">Penjemput</th>
                  <th className="border border-black p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {permitRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-black p-2 italic text-slate-500">
                      Tidak ada perizinan keluar siswa tercatat pada periode ini.
                    </td>
                  </tr>
                ) : (
                  permitRecords.slice(0, 10).map((r, idx) => (
                    <tr key={r.id}>
                      <td className="border border-black p-1.5">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-left font-semibold">{r.namaSiswa}</td>
                      <td className="border border-black p-1.5">{r.kelas}</td>
                      <td className="border border-black p-1.5 font-mono">{r.tanggal} ({r.jamKeluar})</td>
                      <td className="border border-black p-1.5 text-left">{r.jenisIzin.replace(/_/g, ' ')}</td>
                      <td className="border border-black p-1.5 text-left">{r.alasan}</td>
                      <td className="border border-black p-1.5">{r.penjemput}</td>
                      <td className="border border-black p-1.5 font-bold">{r.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABEL 5: REKAPITULASI GURU PENGGANTI (INVAL) */}
          <div className="space-y-1.5 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              E. Rekapitulasi Layanan Guru Pengganti (Inval Pembelajaran)
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Guru Berhalangan</th>
                  <th className="border border-black p-1.5 text-left">Mata Pelajaran & Kelas</th>
                  <th className="border border-black p-1.5">Jam Pelajaran</th>
                  <th className="border border-black p-1.5 text-left">Guru Pengganti (Inval)</th>
                  <th className="border border-black p-1.5 text-left">Alasan Berhalangan</th>
                  <th className="border border-black p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {substitutionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-black p-2 italic text-slate-500">
                      Tidak ada penugasan guru inval pada periode ini.
                    </td>
                  </tr>
                ) : (
                  substitutionRecords.slice(0, 10).map((r, idx) => (
                    <tr key={r.id}>
                      <td className="border border-black p-1.5">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-left font-semibold">{r.guruBerhalanganName}</td>
                      <td className="border border-black p-1.5 text-left">{r.mataPelajaran} ({r.kelas})</td>
                      <td className="border border-black p-1.5 font-mono">{r.jamPelajaran}</td>
                      <td className="border border-black p-1.5 text-left font-semibold text-blue-900">{r.guruPenggantiName || '-'}</td>
                      <td className="border border-black p-1.5 text-left">{r.alasan.replace(/_/g, ' ')}</td>
                      <td className="border border-black p-1.5 font-bold">{r.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABEL 6: REKAPITULASI BUKU TAMU */}
          <div className="space-y-1.5 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-tight">
              F. Rekapitulasi Kunjungan Tamu Sekolah
            </h4>
            <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5">No</th>
                  <th className="border border-black p-1.5 text-left">Nama Tamu</th>
                  <th className="border border-black p-1.5 text-left">Instansi / Asal</th>
                  <th className="border border-black p-1.5">Kategori</th>
                  <th className="border border-black p-1.5 text-left">Tujuan Bertemu</th>
                  <th className="border border-black p-1.5 text-left">Keperluan</th>
                  <th className="border border-black p-1.5">Waktu Masuk</th>
                  <th className="border border-black p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {visitorRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-black p-2 italic text-slate-500">
                      Tidak ada kunjungan tamu tercatat pada periode ini.
                    </td>
                  </tr>
                ) : (
                  visitorRecords.slice(0, 10).map((r, idx) => (
                    <tr key={r.id}>
                      <td className="border border-black p-1.5">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-left font-semibold">{r.namaTamu}</td>
                      <td className="border border-black p-1.5 text-left">{r.instansiAsal}</td>
                      <td className="border border-black p-1.5">{r.kategori.replace(/_/g, ' ')}</td>
                      <td className="border border-black p-1.5 text-left">{r.tujuanBertemu}</td>
                      <td className="border border-black p-1.5 text-left">{r.keperluan}</td>
                      <td className="border border-black p-1.5 font-mono">{r.tanggal} {r.jamMasuk}</td>
                      <td className="border border-black p-1.5 font-bold">{r.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TANDA TANGAN REKAP RESMI */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px]">
            <div>
              <p>Koordinator Tim Piket Sekolah,</p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                [Tanda Tangan & Cap Tim Piket]
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

