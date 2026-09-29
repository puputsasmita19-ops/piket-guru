import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { VisitorRecord } from '../../types/visitor.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, UserCheck, ShieldCheck } from 'lucide-react';

interface VisitorPassPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: VisitorRecord | null;
  settings: SchoolSettings;
}

export const VisitorPassPrintModal: React.FC<VisitorPassPrintModalProps> = ({
  isOpen,
  onClose,
  visitor,
  settings,
}) => {
  if (!visitor) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Kartu Izin Tamu (Visitor Pass)" maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Slip Izin Masuk Tamu Sekolah (Format Standar ID Card)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak Slip Tamu
          </Button>
        </div>

        {/* PRINT CANVAS */}
        <div className="bg-white text-black p-6 rounded-2xl border-2 border-dashed border-slate-400 font-sans text-xs space-y-3 print:border-solid print:p-4">
          {/* HEADER KOP */}
          <div className="text-center border-b-2 border-black pb-2 space-y-0.5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide">
              {settings.schoolName}
            </h3>
            <p className="text-[10px] text-slate-600">
              NPSN: {settings.npsn} • Pos Keamanan & Ruang Piket Utama
            </p>
            <div className="inline-block bg-black text-white px-3 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase mt-1">
              SLIP IZIN MASUK TAMU
            </div>
          </div>

          {/* BADGE NUMBER BIG DISPLAY */}
          <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Nomor Badge Tamu:
            </span>
            <div className="text-2xl font-extrabold font-mono text-blue-900 tracking-wider">
              {visitor.nomorBadge}
            </div>
          </div>

          {/* TAMU META TABLE */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-slate-500 block">Nama Tamu:</span>
              <span className="font-bold text-black">{visitor.namaTamu}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Instansi Asal:</span>
              <span className="font-bold text-black">{visitor.instansiAsal}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Waktu Masuk:</span>
              <span className="font-mono font-bold">{visitor.tanggal}, {visitor.jamMasuk} WIB</span>
            </div>
            <div>
              <span className="text-slate-500 block">Pihak Dituju:</span>
              <span className="font-bold text-black">{visitor.tujuanBertemu}</span>
            </div>
          </div>

          <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Keperluan Kunjungan:</span>
            <span className="font-semibold text-black italic">"{visitor.keperluan}"</span>
          </div>

          {/* SIGNATURE / PETUGAS */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-[10px]">
            <div>
              <p className="text-slate-500">Petugas Piket / Satpam:</p>
              <p className="font-bold underline mt-6">{visitor.petugasPiketName}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Tanda Tangan Tamu:</p>
              <div className="h-6" />
              <p className="font-bold underline">({visitor.namaTamu})</p>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 text-center italic pt-1">
            *Harap serahkan kembali slip ini ke pos satpam saat meninggalkan area sekolah.
          </p>
        </div>
      </div>
    </Modal>
  );
};
