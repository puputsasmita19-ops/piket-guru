import { PrintLetterhead, ReportSignatures } from '../../components/reports/PrintLetterhead';
import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import { Printer } from '../../components/icons';

interface DutyBookPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  dutyBook: DutyBookRecord | null;
  settings: SchoolSettings;
}

export const DutyBookPrintModal: React.FC<DutyBookPrintModalProps> = ({
  isOpen,
  onClose,
  dutyBook,
  settings,
}) => {
  if (!dutyBook) return null;

  const displayStatus = getDutyBookDisplayStatus(dutyBook.status);
  const pengesahNama = dutyBook.lockedBy || dutyBook.approvedBy || dutyBook.verifiedBy;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Jurnal Buku Piket Digital" maxWidth="2xl">
      <div className="space-y-6">
        {/* Print Action Header */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Pratinjau Dokumen Resmi Buku Piket Sekolah (Format Standar A4)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak Dokumen
          </Button>
        </div>

        {/* Printable Paper Canvas */}
        <div className="bg-white text-black p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 font-serif text-xs leading-relaxed space-y-4">
          {settings.printConfig?.showLetterhead !== false && <PrintLetterhead settings={settings} showLogo={settings.printConfig?.showLogo !== false}/>}
          <h3 className="text-xs font-bold uppercase tracking-wide text-center">BUKU JURNAL CATATAN PIKET HARIAN</h3>

          {/* META INFO TABEL */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-b border-slate-200 pb-2">
            <div>
              <span className="font-bold">Hari, Tanggal:</span> {dutyBook.hari}, {formatIndonesianDate(dutyBook.tanggal)}
            </div>
            <div>
              <span className="font-bold">Waktu Shift:</span> {dutyBook.jamMulai} - {dutyBook.jamSelesai} WIB
            </div>
            <div>
              <span className="font-bold">Petugas Piket:</span> {dutyBook.petugasName}
            </div>
            <div>
              <span className="font-bold">Pos / Lokasi:</span> {dutyBook.ruangName}
            </div>
            <div>
              <span className="font-bold">Status Dokumen:</span> {displayStatus.label}
            </div>
            <div>
              <span className="font-bold">ID Dokumen:</span> {dutyBook.id}
            </div>
          </div>

          {/* 7 JURNAL CONTENT */}
          <div className="space-y-3 pt-1 text-[11px]">
            <div>
              <h5 className="font-bold underline">1. Kondisi Keamanan & Ketertiban:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.kondisiKeamanan || '-'}</p>
            </div>

            <div>
              <h5 className="font-bold underline">2. Kondisi Kebersihan Lingkungan & Fasilitas Umum:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.kondisiKebersihan || '-'}</p>
            </div>

            <div>
              <h5 className="font-bold underline">3. Kondisi KBM & Kehadiran Guru/Kelas:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.kondisiKelas || '-'}</p>
            </div>

            <div>
              <h5 className="font-bold underline">4. Kondisi Sarana & Prasarana:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.kondisiFasilitas || '-'}</p>
            </div>

            <div>
              <h5 className="font-bold underline">5. Kedisiplinan & Kejadian Siswa:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.kondisiSiswa || '-'}</p>
            </div>

            {dutyBook.kegiatanKhusus && (
              <div>
                <h5 className="font-bold underline">6. Kegiatan Khusus Sekolah:</h5>
                <p className="mt-0.5 text-justify">{dutyBook.kegiatanKhusus}</p>
              </div>
            )}

            <div>
              <h5 className="font-bold underline">7. Catatan Kesimpulan & Rekomendasi Tindak Lanjut:</h5>
              <p className="mt-0.5 text-justify">{dutyBook.catatanPiket || '-'}</p>
              {dutyBook.tindakLanjut && (
                <p className="mt-1 italic text-slate-700">Tindak Lanjut: {dutyBook.tindakLanjut}</p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-600">Penulis: {dutyBook.petugasName} · Pengesahan: {pengesahNama || 'Belum disahkan'}</p>
          {settings.printConfig?.showSignatures !== false && <ReportSignatures settings={settings} date={formatIndonesianDate(dutyBook.tanggal)}/>}

        </div>
      </div>
    </Modal>
  );
};
