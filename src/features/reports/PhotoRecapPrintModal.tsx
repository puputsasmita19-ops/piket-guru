import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolSettings } from '../../types';
import { PhotoRecapItem } from '../../types/watermark.types';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';
import { AuditService } from '../../services/audit/auditService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Printer,
  Download,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Building,
  Image as ImageIcon,
  Grid,
  FileText,
} from 'lucide-react';

interface PhotoRecapPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  periodLabel: string;
  selectedPhotos: PhotoRecapItem[];
}

export const PhotoRecapPrintModal: React.FC<PhotoRecapPrintModalProps> = ({
  isOpen,
  onClose,
  settings,
  periodLabel,
  selectedPhotos,
}) => {
  const { currentUser } = useAuth();
  const [photosPerPage, setPhotosPerPage] = useState<2 | 4>(4);
  const [reportDate, setReportDate] = useState<string>(() => getTodayISODate());
  const [reportCity, setReportCity] = useState<string>(() => settings.reportCity || 'Jakarta');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);

  if (!isOpen) return null;

  // Chunk photos into pages based on photosPerPage
  const pages: PhotoRecapItem[][] = [];
  for (let i = 0; i < selectedPhotos.length; i += photosPerPage) {
    pages.push(selectedPhotos.slice(i, i + photosPerPage));
  }

  const handlePrint = () => {
    // Record export audit log
    if (currentUser) {
      void AuditService.log({
        userId: currentUser.id,
        action: 'EXPORT',
        module: 'REPORTS',
        status: 'SUCCESS',
        target: 'Lampiran Dokumentasi Bulanan',
        details: `Mencetak / Mengunduh PDF Lampiran Dokumentasi Bulanan (${selectedPhotos.length} foto terpilih, format ${photosPerPage} foto/halaman) periode: ${periodLabel}`,
      });
    }

    window.print();
  };

  const getModuleBadgeLabel = (mod: string) => {
    switch (mod) {
      case 'ATTENDANCE':
        return 'Presensi GPS';
      case 'INCIDENT':
        return 'Laporan Kejadian';
      case 'STUDENT_TARDY':
        return 'Siswa Terlambat';
      case 'VISITOR':
        return 'Buku Tamu';
      default:
        return 'Dokumentasi';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cetak & Ekspor PDF Lampiran Dokumentasi Bulanan"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Dynamic Print CSS for A4 page breaks and clean layout */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 12mm 12mm;
              }
              body {
                background: white !important;
                color: black !important;
              }
              body * {
                visibility: hidden;
              }
              #photo-rekap-print-area, #photo-rekap-print-area * {
                visibility: visible;
              }
              #photo-rekap-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                overflow: visible !important;
                max-height: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
              .print-page {
                box-shadow: none !important;
                border: none !important;
                padding: 4mm 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: 260mm !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              .print-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          `,
          }}
        />

        {/* Print Configuration Controls */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 no-print">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
              <span>Pengaturan Tata Letak Dokumen (Kertas A4):</span>
            </span>
            <span className="text-xs font-mono font-semibold text-[var(--theme-primary)]">
              {selectedPhotos.length} Foto Terpilih ({pages.length} Halaman)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Photos per page */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Jumlah Foto per Halaman:
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPhotosPerPage(2)}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    photosPerPage === 2
                      ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  2 Foto / Hal
                </button>
                <button
                  type="button"
                  onClick={() => setPhotosPerPage(4)}
                  className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                    photosPerPage === 4
                      ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  4 Foto / Hal
                </button>
              </div>
            </div>

            {/* Kota Laporan */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Kota Penandatanganan:
              </label>
              <input
                type="text"
                value={reportCity}
                onChange={(e) => setReportCity(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              />
            </div>

            {/* Tanggal Cetak */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Tanggal Dokumen:
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* PRINT PREVIEW CONTAINER */}
        <div
          id="photo-rekap-print-area"
          className="max-h-[65vh] overflow-y-auto p-4 bg-slate-200 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800 space-y-6"
        >
          {pages.map((pagePhotos, pageIdx) => (
            <div
              key={pageIdx}
              className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-lg border border-slate-300 max-w-[800px] mx-auto min-h-[1050px] flex flex-col justify-between print-page"
              style={{ pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto' }}
            >
              {/* Kop Surat Sekolah */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4">
                <div className="flex items-center gap-4">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo Sekolah"
                      className="w-14 h-14 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shrink-0">
                      🏛️
                    </div>
                  )}
                  <div className="text-center flex-1">
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                      {settings.schoolName}
                    </h2>
                    <p className="text-[11px] text-slate-700 leading-tight">
                      NPSN: {settings.npsn} • {settings.address}
                    </p>
                    {settings.phone && (
                      <p className="text-[10px] text-slate-600">
                        Telp/Fax: {settings.phone} • Email: {settings.email || '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Title Header */}
              <div className="text-center mb-4 space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 underline">
                  LAMPIRAN DOKUMENTASI BULANAN
                </h3>
                <p className="text-xs text-slate-600 font-medium">Periode: {periodLabel}</p>
                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Bukti Dokumentasi Visual & Operasional Piket</span>
                  <span>
                    Halaman {pageIdx + 1} dari {pages.length}
                  </span>
                </div>
              </div>

              {/* Photos Grid: 2 or 4 photos per page */}
              <div
                className={`grid gap-4 flex-1 ${
                  photosPerPage === 2 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {pagePhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="border border-slate-300 rounded-xl p-2.5 flex flex-col justify-between bg-slate-50/50"
                  >
                    {/* Preserved Aspect Ratio Photo */}
                    <div
                      className={`relative w-full rounded-lg overflow-hidden bg-black flex items-center justify-center ${
                        photosPerPage === 2 ? 'h-[340px]' : 'h-[175px]'
                      }`}
                    >
                      <img
                        src={photo.photoUrl}
                        alt={photo.title}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Graceful fallback for broken/missing photos
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                        {getModuleBadgeLabel(photo.sourceModule)}
                      </div>
                      {photo.isLegacyUnwatermarked && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">
                          Foto Arsip
                        </div>
                      )}
                    </div>

                    {/* Compact Caption */}
                    <div className="pt-2 text-[10px] space-y-0.5 text-slate-800">
                      <div className="font-bold text-[11px] truncate">{photo.title}</div>
                      <div className="text-slate-600 truncate">{photo.briefIdentity}</div>
                      <div className="flex items-center justify-between text-slate-500 text-[9.5px]">
                        <span>
                          Kejadian: {formatIndonesianDate(photo.tanggalKejadian)}
                          {photo.waktuKejadian ? ` (${photo.waktuKejadian})` : ''}
                        </span>
                        {photo.tanggalDokumentasi && photo.tanggalDokumentasi !== photo.tanggalKejadian && (
                          <span className="font-semibold text-blue-700">
                            Foto: {formatIndonesianDate(photo.tanggalDokumentasi)}
                          </span>
                        )}
                      </div>
                      {photo.petugasName && (
                        <div className="text-slate-500 text-[9px]">
                          Petugas: {photo.petugasName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signatures on the final page */}
              {pageIdx === pages.length - 1 && showSignatures && (
                <div className="pt-6 border-t border-slate-300 mt-4 text-xs">
                  <div className="text-right text-[11px] text-slate-700 mb-2">
                    {reportCity}, {formatIndonesianDate(reportDate)}
                  </div>
                  <div className="grid grid-cols-2 gap-8 text-center">
                    <div>
                      <p className="font-medium text-slate-600 text-[10.5px]">
                        Koordinator Guru Piket,
                      </p>
                      <div className="h-14 flex items-center justify-center">
                        {settings.coordinatorSignatureUrl ? (
                          <img
                            src={settings.coordinatorSignatureUrl}
                            alt="TTD Koordinator"
                            className="max-h-12 object-contain"
                          />
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">
                            (Tanda Tangan & Stempel)
                          </div>
                        )}
                      </div>
                      <p className="font-bold underline text-slate-900">
                        {settings.coordinatorName || 'Koordinator Guru Piket'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {settings.coordinatorIdType || 'NIP'}. {settings.coordinatorIdNumber || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-600 text-[10.5px]">
                        Kepala Sekolah,
                      </p>
                      <div className="h-14 flex items-center justify-center">
                        {settings.principalSignatureUrl ? (
                          <img
                            src={settings.principalSignatureUrl}
                            alt="TTD Kepala Sekolah"
                            className="max-h-12 object-contain"
                          />
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">
                            (Tanda Tangan & Stempel)
                          </div>
                        )}
                      </div>
                      <p className="font-bold underline text-slate-900">
                        {settings.principalName || 'Kepala Sekolah'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {settings.principalIdType || 'NIP'}. {settings.principalIdNumber || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Page Number */}
              <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-100 mt-2">
                Aplikasi Piket Guru • Lampiran Dokumentasi Bulanan • Halaman {pageIdx + 1} dari{' '}
                {pages.length}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 no-print">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
              className="font-bold shadow-md text-xs"
            >
              Cetak / Unduh PDF (A4)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
