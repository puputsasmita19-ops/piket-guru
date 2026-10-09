import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolSettings, PrintLayoutConfig } from '../../types';
import { TeacherAttendanceSummary, IncidentCategorySummary } from '../../services/reports/reportService';
import { StudentTardyRecord, getTardyReasonDisplay, getDisciplineActionDisplay } from '../../types/studentTardy.types';
import { StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { TeacherSubstitutionRecord, getSubstitutionReasonDisplay } from '../../types/substitution.types';
import { VisitorRecord, getVisitorCategoryDisplay } from '../../types/visitor.types';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';
import {
  Printer,
  Sliders,
  Settings2,
  FileText,
  Building,
  CheckCircle2,
  Image as ImageIcon,
  PenTool,
  Info,
  RotateCcw,
} from 'lucide-react';

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
  dutyBookRecords?: DutyBookRecord[];
}

const LOCAL_STORAGE_PRINT_KEY = 'piket_print_settings_v1';

const DEFAULT_PRINT_CONFIG: PrintLayoutConfig = {
  paperSize: 'A4',
  f4WidthMm: 215,
  f4HeightMm: 330,
  orientation: 'portrait',
  marginTopMm: 15,
  marginBottomMm: 15,
  marginLeftMm: 15,
  marginRightMm: 15,
  showLogo: true,
  showLetterhead: true,
  showSignatures: true,
};

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
  dutyBookRecords = [],
}) => {
  // Load initial print preferences from localStorage or settings
  const [printConfig, setPrintConfig] = useState<PrintLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PRINT_KEY);
      if (saved) {
        return { ...DEFAULT_PRINT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return settings.printConfig || DEFAULT_PRINT_CONFIG;
  });

  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [reportDate, setReportDate] = useState<string>(() => getTodayISODate());
  const [customReportCity, setCustomReportCity] = useState<string>(() => settings.reportCity || 'Jakarta');

  // Save to localStorage whenever printConfig changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_PRINT_KEY, JSON.stringify(printConfig));
    } catch {
      // ignore
    }
  }, [printConfig]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const resetPrintConfig = () => {
    setPrintConfig(DEFAULT_PRINT_CONFIG);
  };

  const avgAttendance =
    attendanceSummaries.length > 0
      ? Math.round(
          attendanceSummaries.reduce((acc, curr) => acc + curr.percentage, 0) /
            attendanceSummaries.length
        )
      : 100;

  const totalTardy = tardyRecords.length;
  const totalPermits = permitRecords.length;
  const totalSubstitutions = substitutionRecords.length;
  const totalVisitors = visitorRecords.length;
  const totalDutyBooks = dutyBookRecords.length;

  // City and date display
  const cityDisplay = customReportCity || settings.reportCity || 'Tempat';
  const formattedPublishDate = formatIndonesianDate(reportDate);

  // Signer IDs
  const principalIdDisplay =
    settings.principalIdNumber && settings.principalIdNumber.trim() !== ''
      ? `${settings.principalIdType || 'NIP'}. ${settings.principalIdNumber}`
      : null;

  const coordinatorIdDisplay =
    settings.coordinatorIdNumber && settings.coordinatorIdNumber.trim() !== ''
      ? `${settings.coordinatorIdType || 'NIP'}. ${settings.coordinatorIdNumber}`
      : null;

  // Compute paper CSS dimensions
  const isA4 = printConfig.paperSize === 'A4';
  const f4Width = printConfig.f4WidthMm || 215;
  const f4Height = printConfig.f4HeightMm || 330;

  const paperWidthMm = isA4
    ? printConfig.orientation === 'portrait' ? 210 : 297
    : printConfig.orientation === 'portrait' ? f4Width : f4Height;

  const paperHeightMm = isA4
    ? printConfig.orientation === 'portrait' ? 297 : 210
    : printConfig.orientation === 'portrait' ? f4Height : f4Width;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pratinjau & Cetak Rekapitulasi Laporan Piket Resmi"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Dynamic Print CSS Style Injection for exact margins and page sizing */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${isA4 ? 'A4' : `${f4Width}mm ${f4Height}mm`} ${printConfig.orientation};
                margin: ${printConfig.marginTopMm}mm ${printConfig.marginRightMm}mm ${printConfig.marginBottomMm}mm ${printConfig.marginLeftMm}mm;
              }
              body {
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
              .print-container {
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                max-width: 100% !important;
                width: 100% !important;
              }
              .print-page-break-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `
        }} />

        {/* TOP ACTION & NOTIFICATION BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs no-print">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-blue-950 dark:text-blue-100">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Pratinjau Berkas Rekapitulasi Siap Cetak / Simpan PDF</span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Kertas: <strong className="font-semibold">{printConfig.paperSize} ({isA4 ? '210 x 297 mm' : `${f4Width} x ${f4Height} mm`})</strong> •
              Orientasi: <strong className="font-semibold">{printConfig.orientation === 'portrait' ? 'Tegak (Portrait)' : 'Mendatar (Landscape)'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showConfigPanel ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Sliders className="w-4 h-4" />}
              onClick={() => setShowConfigPanel(!showConfigPanel)}
            >
              {showConfigPanel ? 'Tutup Pengaturan' : 'Pengaturan Cetak'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Cetak / Simpan PDF
            </Button>
          </div>
        </div>

        {/* PRINT CONFIGURATION DRAWER / ACCORDION */}
        {showConfigPanel && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 space-y-4 no-print animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                Panel Konfigurasi Tata Letak Cetak & Tanda Tangan
              </h4>
              <button
                onClick={resetPrintConfig}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Standar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {/* Paper size & dimensions */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Ukuran Kertas:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, paperSize: 'A4' })}
                    className={`py-1.5 px-3 rounded-lg font-bold border text-xs cursor-pointer ${
                      printConfig.paperSize === 'A4'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    A4 (210×297 mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, paperSize: 'F4' })}
                    className={`py-1.5 px-3 rounded-lg font-bold border text-xs cursor-pointer ${
                      printConfig.paperSize === 'F4'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    F4 / Folio (215×330 mm)
                  </button>
                </div>

                {printConfig.paperSize === 'F4' && (
                  <div className="pt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-500 block">Lebar F4 (mm):</label>
                      <input
                        type="number"
                        value={printConfig.f4WidthMm || 215}
                        onChange={(e) =>
                          setPrintConfig({
                            ...printConfig,
                            f4WidthMm: Number(e.target.value) || 215,
                          })
                        }
                        className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block">Tinggi F4 (mm):</label>
                      <input
                        type="number"
                        value={printConfig.f4HeightMm || 330}
                        onChange={(e) =>
                          setPrintConfig({
                            ...printConfig,
                            f4HeightMm: Number(e.target.value) || 330,
                          })
                        }
                        className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Orientation */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Orientasi Halaman:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, orientation: 'portrait' })}
                    className={`py-1.5 px-3 rounded-lg font-bold border text-xs cursor-pointer ${
                      printConfig.orientation === 'portrait'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Tegak (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, orientation: 'landscape' })}
                    className={`py-1.5 px-3 rounded-lg font-bold border text-xs cursor-pointer ${
                      printConfig.orientation === 'landscape'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Mendatar (Landscape)
                  </button>
                </div>
              </div>

              {/* Margins */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Margin Halaman (mm):
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                  <div>
                    <span className="text-slate-500 block">Atas</span>
                    <input
                      type="number"
                      value={printConfig.marginTopMm}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, marginTopMm: Number(e.target.value) || 0 })
                      }
                      className="w-full p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kanan</span>
                    <input
                      type="number"
                      value={printConfig.marginRightMm}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, marginRightMm: Number(e.target.value) || 0 })
                      }
                      className="w-full p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bawah</span>
                    <input
                      type="number"
                      value={printConfig.marginBottomMm}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, marginBottomMm: Number(e.target.value) || 0 })
                      }
                      className="w-full p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kiri</span>
                    <input
                      type="number"
                      value={printConfig.marginLeftMm}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, marginLeftMm: Number(e.target.value) || 0 })
                      }
                      className="w-full p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Elements display toggles */}
              <div className="space-y-2 sm:col-span-2 md:col-span-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Elemen Laporan yang Ditampilkan:
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printConfig.showLetterhead}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, showLetterhead: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Tampilkan Kop Surat Sekolah
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printConfig.showLogo}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, showLogo: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Tampilkan Logo Sekolah
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printConfig.showSignatures}
                      onChange={(e) =>
                        setPrintConfig({ ...printConfig, showSignatures: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      Tampilkan Blok Pengesahan & Tanda Tangan
                    </span>
                  </label>
                </div>
              </div>

              {/* Tempat & Tanggal Laporan */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Kota / Tempat Terbit:
                </label>
                <input
                  type="text"
                  value={customReportCity}
                  onChange={(e) => setCustomReportCity(e.target.value)}
                  placeholder="Contoh: Jakarta"
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Tanggal Pengesahan Laporan:
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* PRINTER DIALOG NOTICE BANNER */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 no-print">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Petunjuk Cetak / PDF Browser:</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Pada jendela dialog cetak printer (Ctrl+P / Cmd+P), pastikan opsi <strong>Paper Size (Ukuran Kertas)</strong> disesuaikan dengan kertas fisik Anda (terutama jika menggunakan kertas F4/Folio), dan aktifkan centang <strong>Background graphics (Grafis Latar Belakang)</strong> agar tata warna dan garis tabel tercetak sempurna.
            </p>
          </div>
        </div>

        {/* PRINT PAPER / PREVIEW CONTAINER */}
        <div className="overflow-x-auto max-w-full p-2 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div
            className="print-container bg-white text-black p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 font-serif text-xs leading-relaxed space-y-5 mx-auto"
            style={{
              maxWidth: printConfig.orientation === 'landscape' ? '1100px' : '850px',
            }}
          >
            {/* KOP SURAT SEKOLAH */}
            {printConfig.showLetterhead && (
              <div className="border-b-2 border-black pb-3">
                <div className="flex items-center justify-between gap-4">
                  {printConfig.showLogo && settings.logoUrl && (
                    <div className="shrink-0 w-20 h-20 flex items-center justify-center">
                      <img
                        src={settings.logoUrl}
                        alt="Logo Sekolah"
                        className="max-h-20 max-w-20 object-contain"
                      />
                    </div>
                  )}

                  <div className="flex-1 text-center space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-black">
                      {settings.schoolName || 'PEMERINTAH DAERAH / SEKOLAH'}
                    </h2>
                    <p className="text-[11px] text-slate-800 italic">
                      {settings.npsn ? `NPSN: ${settings.npsn}` : ''}
                      {settings.address ? ` • ${settings.address}` : ''}
                    </p>
                    {(settings.phone || settings.email || settings.website) && (
                      <p className="text-[10px] text-slate-700">
                        {settings.phone ? `Telp: ${settings.phone}` : ''}
                        {settings.email ? ` • Email: ${settings.email}` : ''}
                        {settings.website ? ` • Web: ${settings.website}` : ''}
                      </p>
                    )}
                  </div>

                  {printConfig.showLogo && settings.logoUrl && (
                    <div className="shrink-0 w-20 hidden sm:block opacity-0">
                      {/* Spacer for symmetrical centering */}
                    </div>
                  )}
                </div>

                <div className="text-center pt-3 space-y-0.5 border-t border-slate-400 mt-2">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide underline">
                    LAPORAN REKAPITULASI PELAKSANAAN TUGAS PIKET & KETERTIBAN SEKOLAH
                  </h3>
                  <p className="text-[11px] font-sans font-bold text-slate-900">
                    Periode: {periodLabel}
                  </p>
                  <p className="text-[9px] font-sans text-slate-500">
                    Dokumen dicetak pada: {formattedPublishDate} • Berkas Resmi Sekolah
                  </p>
                </div>
              </div>
            )}

            {/* RINGKASAN EKSEKUTIF SEMUA MODUL */}
            <div className="print-page-break-avoid border border-slate-300 p-3.5 rounded-lg text-[11px] space-y-2 bg-slate-50">
              <h5 className="font-bold underline text-slate-900">
                Ringkasan Eksekutif & Kinerja Operasional Seluruh Bidang Piket:
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 font-sans text-[10px]">
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Kepatuhan Guru Piket:</span>
                  <strong className="text-xs text-blue-700">{avgAttendance}%</strong> (
                  {attendanceSummaries.filter((a) => a.percentage >= 80).length} Disiplin)
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Insiden & Kasus:</span>
                  <strong className="text-xs text-slate-900">{totalIncidents} Kasus</strong> (
                  {resolvedIncidents} Tuntas)
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Keterlambatan Siswa:</span>
                  <strong className="text-xs text-amber-700">{totalTardy} Kasus</strong> (
                  {tardyRecords.reduce((acc, c) => acc + (c.poinPelanggaran || 0), 0)} Total Poin)
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Izin Keluar Siswa:</span>
                  <strong className="text-xs text-emerald-700">{totalPermits} Siswa</strong>
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Guru Pengganti (Inval):</span>
                  <strong className="text-xs text-indigo-700">{totalSubstitutions} Penugasan</strong>
                </div>
                <div className="p-2 border border-slate-200 rounded bg-white">
                  <span className="text-slate-600 block">Buku Tamu Masuk:</span>
                  <strong className="text-xs text-teal-700">{totalVisitors} Kunjungan</strong>
                </div>
              </div>
            </div>

            {/* TABEL A: REKAP KEHADIRAN GURU PIKET */}
            <div className="space-y-1.5 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                A. Rekapitulasi Presensi & Kedisiplinan Guru Piket
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
                    <th className="border border-black p-1.5 text-left">Nama Guru / Petugas Piket</th>
                    <th className="border border-black p-1.5">NIP</th>
                    <th className="border border-black p-1.5">Total Shift</th>
                    <th className="border border-black p-1.5">Hadir (GPS)</th>
                    <th className="border border-black p-1.5">Luar Radius</th>
                    <th className="border border-black p-1.5">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-black p-2 italic text-slate-500">
                        Tidak ada catatan jadwal piket guru pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    attendanceSummaries.map((row, idx) => (
                      <tr key={row.teacherId}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {row.fullName}
                        </td>
                        <td className="border border-black p-1.5 font-mono">{row.nip}</td>
                        <td className="border border-black p-1.5">{row.totalShift}</td>
                        <td className="border border-black p-1.5 text-emerald-700 font-bold">
                          {row.hadir}
                        </td>
                        <td className="border border-black p-1.5">{row.terlambatOrOutside}</td>
                        <td className="border border-black p-1.5 font-bold">{row.percentage}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL B: REKAPITULASI LAPORAN KEJADIAN */}
            <div className="space-y-1.5 pt-2 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                B. Rekapitulasi Laporan Kejadian & Penanganan Kasus
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
                    <th className="border border-black p-1.5 text-left">Kategori Kejadian</th>
                    <th className="border border-black p-1.5">Total Kasus</th>
                    <th className="border border-black p-1.5">Tingkat Kritis/Tinggi</th>
                    <th className="border border-black p-1.5">Tuntas Selesai</th>
                    <th className="border border-black p-1.5">Dalam Proses</th>
                  </tr>
                </thead>
                <tbody>
                  {incidentSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-black p-2 italic text-slate-500">
                        Tidak ada insiden kejadian dilaporkan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    incidentSummaries.map((cat, idx) => (
                      <tr key={cat.categoryCode}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {cat.categoryName}
                        </td>
                        <td className="border border-black p-1.5 font-bold">{cat.total}</td>
                        <td className="border border-black p-1.5 text-rose-700 font-bold">
                          {cat.kritis}
                        </td>
                        <td className="border border-black p-1.5 text-emerald-700 font-bold">
                          {cat.selesai}
                        </td>
                        <td className="border border-black p-1.5">{cat.penanganan}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL C: REKAPITULASI KETERLAMBATAN SISWA */}
            <div className="space-y-1.5 pt-2 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                C. Rekapitulasi Kedisiplinan & Keterlambatan Siswa ({totalTardy} Catatan)
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
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
                    tardyRecords.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {r.namaSiswa}
                        </td>
                        <td className="border border-black p-1.5">{r.kelas}</td>
                        <td className="border border-black p-1.5 font-mono">
                          {r.tanggal} ({r.jamDatang})
                        </td>
                        <td className="border border-black p-1.5 text-amber-800 font-bold">
                          {r.menitTerlambat} mnt
                        </td>
                        <td className="border border-black p-1.5 text-left">
                          {getTardyReasonDisplay(r)}
                        </td>
                        <td className="border border-black p-1.5 text-left">
                          {getDisciplineActionDisplay(r)}
                        </td>
                        <td className="border border-black p-1.5 font-bold text-rose-700">
                          {r.poinPelanggaran}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL D: REKAPITULASI IZIN SISWA */}
            <div className="space-y-1.5 pt-2 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                D. Rekapitulasi Perizinan Meninggalkan Sekolah / Kelas ({totalPermits} Catatan)
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
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
                    permitRecords.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {r.namaSiswa}
                        </td>
                        <td className="border border-black p-1.5">{r.kelas}</td>
                        <td className="border border-black p-1.5 font-mono">
                          {r.tanggal} ({r.jamKeluar})
                        </td>
                        <td className="border border-black p-1.5 text-left">
                          {getStudentPermitTypeDisplay(r)}
                        </td>
                        <td className="border border-black p-1.5 text-left break-words">
                          {r.alasan}
                        </td>
                        <td className="border border-black p-1.5">{r.penjemput}</td>
                        <td className="border border-black p-1.5 font-bold">
                          {r.status.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL E: REKAPITULASI GURU PENGGANTI (INVAL) */}
            <div className="space-y-1.5 pt-2 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                E. Rekapitulasi Layanan Guru Pengganti (Inval Pembelajaran) ({totalSubstitutions} Penugasan)
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
                    <th className="border border-black p-1.5 text-left">Guru Berhalangan</th>
                    <th className="border border-black p-1.5 text-left">Mata Pelajaran & Kelas</th>
                    <th className="border border-black p-1.5">Jam Pelajaran</th>
                    <th className="border border-black p-1.5 text-left">Guru Pengganti (Inval)</th>
                    <th className="border border-black p-1.5 text-left">Alasan</th>
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
                    substitutionRecords.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {r.guruBerhalanganName}
                        </td>
                        <td className="border border-black p-1.5 text-left">
                          {r.mataPelajaran} ({r.kelas})
                        </td>
                        <td className="border border-black p-1.5 font-mono">{r.jamPelajaran}</td>
                        <td className="border border-black p-1.5 text-left font-semibold text-blue-900">
                          {r.guruPenggantiName || 'Belum Ditugaskan'}
                        </td>
                        <td className="border border-black p-1.5 text-left">
                          {getSubstitutionReasonDisplay(r)}
                        </td>
                        <td className="border border-black p-1.5 font-bold">
                          {r.status.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL F: REKAPITULASI BUKU TAMU */}
            <div className="space-y-1.5 pt-2 print-page-break-avoid">
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                F. Rekapitulasi Kunjungan Tamu Sekolah ({totalVisitors} Kunjungan)
              </h4>
              <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 w-8">No</th>
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
                    visitorRecords.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">
                          {r.namaTamu}
                        </td>
                        <td className="border border-black p-1.5 text-left">{r.instansiAsal}</td>
                        <td className="border border-black p-1.5">
                          {getVisitorCategoryDisplay(r)}
                        </td>
                        <td className="border border-black p-1.5 text-left">{r.tujuanBertemu}</td>
                        <td className="border border-black p-1.5 text-left break-words">
                          {r.keperluan}
                        </td>
                        <td className="border border-black p-1.5 font-mono">
                          {r.tanggal} {r.jamMasuk}
                        </td>
                        <td className="border border-black p-1.5 font-bold">
                          {r.status.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL G: JURNAL CATATAN PIKET */}
            {dutyBookRecords.length > 0 && (
              <div className="space-y-1.5 pt-2 print-page-break-avoid">
                <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900">
                  G. Rekapitulasi Catatan Jurnal Buku Piket ({totalDutyBooks} Jurnal)
                </h4>
                <table className="w-full border-collapse border border-black text-[10px] text-center font-sans">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-1.5 w-8">No</th>
                      <th className="border border-black p-1.5">Tanggal</th>
                      <th className="border border-black p-1.5 text-left">Petugas Piket</th>
                      <th className="border border-black p-1.5 text-left">Pos / Ruangan</th>
                      <th className="border border-black p-1.5 text-left">Catatan Observasi & Kondisi Sekolah</th>
                      <th className="border border-black p-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dutyBookRecords.map((b, idx) => (
                      <tr key={b.id}>
                        <td className="border border-black p-1.5">{idx + 1}</td>
                        <td className="border border-black p-1.5 font-mono">{b.tanggal}</td>
                        <td className="border border-black p-1.5 text-left font-semibold">{b.petugasName}</td>
                        <td className="border border-black p-1.5 text-left">{b.ruangName}</td>
                        <td className="border border-black p-1.5 text-left break-words">{b.catatanPiket || '-'}</td>
                        <td className="border border-black p-1.5 font-bold">{getDutyBookDisplayStatus(b.status).label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TANDA TANGAN REKAP RESMI */}
            {printConfig.showSignatures && (
              <div
                className="print-page-break-avoid pt-6"
                style={{
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                {/* Two equal-width columns: Kepala Sekolah on left, Koordinator on right */}
                <div className="grid grid-cols-2 gap-8 text-center text-[10px] w-full items-start">
                  {/* Kolom Kiri: Kepala Sekolah */}
                  <div className="flex flex-col items-center w-full space-y-1">
                    {/* Ruang penyeimbang setinggi Tempat & Tanggal di kolom kanan */}
                    <div className="h-5 flex items-center justify-center invisible select-none" aria-hidden="true">
                      &nbsp;
                    </div>

                    {/* Bagian Jabatan */}
                    <div className="h-10 flex flex-col justify-end items-center text-center">
                      <p className="font-medium text-slate-800 leading-tight">Mengetahui,</p>
                      <p className="font-medium text-slate-800 leading-tight">Kepala Sekolah,</p>
                    </div>

                    {/* Ruang Tanda Tangan */}
                    <div className="h-20 w-full flex items-center justify-center my-1">
                      {settings.principalSignatureUrl ? (
                        <img
                          src={settings.principalSignatureUrl}
                          alt="Tanda Tangan Kepala Sekolah"
                          className="max-h-20 max-w-36 object-contain"
                        />
                      ) : (
                        <div className="h-16 w-full flex items-center justify-center text-[9px] italic text-slate-400">
                          [Ruang Tanda Tangan & Cap Lembaga]
                        </div>
                      )}
                    </div>

                    {/* Nama Lengkap & Gelar */}
                    <div className="min-h-[1.25rem] flex items-center justify-center text-center px-2">
                      <p className="font-bold underline text-black leading-tight break-words">
                        {settings.principalName || 'Dr. Hj. Siti Rohmah, M.Pd.'}
                      </p>
                    </div>

                    {/* Identitas Pendamping (NIP/NUPTK/dll) */}
                    <div className="min-h-[1.1rem] flex items-center justify-center text-center">
                      {principalIdDisplay ? (
                        <p className="text-[9px] font-mono text-slate-700 leading-tight">
                          {principalIdDisplay}
                        </p>
                      ) : (
                        <span className="invisible text-[9px] select-none">&nbsp;</span>
                      )}
                    </div>
                  </div>

                  {/* Kolom Kanan: Koordinator Tim Piket */}
                  <div className="flex flex-col items-center w-full space-y-1">
                    {/* Tempat dan Tanggal Penerbitan */}
                    <div className="h-5 flex items-center justify-center text-slate-800">
                      <p className="leading-tight font-medium">
                        {cityDisplay}, {formattedPublishDate}
                      </p>
                    </div>

                    {/* Bagian Jabatan */}
                    <div className="h-10 flex flex-col justify-end items-center text-center">
                      <p className="font-medium text-slate-800 leading-tight invisible select-none" aria-hidden="true">
                        &nbsp;
                      </p>
                      <p className="font-medium text-slate-800 leading-tight">Koordinator Tim Piket Sekolah,</p>
                    </div>

                    {/* Ruang Tanda Tangan */}
                    <div className="h-20 w-full flex items-center justify-center my-1">
                      {settings.coordinatorSignatureUrl ? (
                        <img
                          src={settings.coordinatorSignatureUrl}
                          alt="Tanda Tangan Koordinator"
                          className="max-h-20 max-w-36 object-contain"
                        />
                      ) : (
                        <div className="h-16 w-full flex items-center justify-center text-[9px] italic text-slate-400">
                          [Ruang Tanda Tangan & Cap Tim Piket]
                        </div>
                      )}
                    </div>

                    {/* Nama Lengkap & Gelar */}
                    <div className="min-h-[1.25rem] flex items-center justify-center text-center px-2">
                      <p className="font-bold underline text-black leading-tight break-words">
                        {settings.coordinatorName || 'Drs. H. Ahmad Fauzi, M.Pd.'}
                      </p>
                    </div>

                    {/* Identitas Pendamping (NIP/NUPTK/dll) */}
                    <div className="min-h-[1.1rem] flex items-center justify-center text-center">
                      {coordinatorIdDisplay ? (
                        <p className="text-[9px] font-mono text-slate-700 leading-tight">
                          {coordinatorIdDisplay}
                        </p>
                      ) : (
                        <span className="invisible text-[9px] select-none">&nbsp;</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
