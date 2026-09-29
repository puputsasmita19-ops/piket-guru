import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, X, ShieldCheck } from 'lucide-react';

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
            Cetak Dokumen / Simpan PDF
          </Button>
        </div>

        {/* Printable Paper Canvas */}
        <div className="bg-white text-black p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 font-serif text-xs leading-relaxed space-y-4">
          {/* KOP SURAT SEKOLAH */}
          <div className="text-center border-b-2 border-black pb-3 space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wider">
              {settings.schoolName}
            </h2>
            <p className="text-[11px] italic">
              NPSN: {settings.npsn} • {settings.address}
            </p>
            <h3 className="text-xs font-bold uppercase tracking-wide pt-1">
              BUKU JURNAL CATATAN PIKET HARIAN
            </h3>
          </div>

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

          {/* TANDA TANGAN (SIGNATURE BLOCK) */}
          <div className="grid grid-cols-3 gap-4 pt-8 text-center text-[10px]">
            <div>
              <p>Petugas Piket,</p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                [Paraf Digital]
              </div>
              <p className="font-bold underline">{dutyBook.petugasName}</p>
            </div>

            <div>
              <p>Koordinator Piket,</p>
              <div className="h-16 flex items-center justify-center italic text-slate-400">
                {dutyBook.verifiedBy ? `[Diverifikasi: ${dutyBook.verifiedBy.split(' ')[0]}]` : '[Belum Diverifikasi]'}
              </div>
              <p className="font-bold underline">{dutyBook.verifiedBy || 'Koordinator Piket'}</p>
            </div>

            <div>
              <p>Mengetahui,<br />Kepala Sekolah,</p>
              <div className="h-12 flex items-center justify-center italic text-slate-400">
                {dutyBook.approvedBy ? `[Disetujui: ${dutyBook.approvedBy.split(' ')[0]}]` : '[Belum Disetujui]'}
              </div>
              <p className="font-bold underline">{dutyBook.approvedBy || 'Dr. Hj. Siti Rohmah, M.Pd.'}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
