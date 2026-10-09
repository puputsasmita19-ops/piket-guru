import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, FileText } from 'lucide-react';

interface StudentPermitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: StudentPermitRecord | null;
  settings: SchoolSettings;
}

export const StudentPermitPrintModal: React.FC<StudentPermitPrintModalProps> = ({
  isOpen,
  onClose,
  permit,
  settings,
}) => {
  if (!permit) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Surat Izin Keluar Sekolah (Gate Pass)" maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Surat Dispensasi & Izin Keluar Gerbang Siswa (Format Standar A5/Slip)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak Surat Izin
          </Button>
        </div>

        {/* PRINT CANVAS */}
        <div className="bg-white text-black p-6 rounded-2xl border border-slate-300 font-sans text-xs space-y-3 print:border-none print:p-2">
          {/* HEADER KOP */}
          <div className="text-center border-b-2 border-black pb-2 space-y-0.5">
            <h3 className="font-extrabold text-sm uppercase tracking-wide">
              {settings.schoolName}
            </h3>
            <p className="text-[10px] text-slate-600">
              NPSN: {settings.npsn} • {settings.address}
            </p>
            <h4 className="text-xs font-bold uppercase tracking-wider pt-1 underline">
              SURAT KETERANGAN IZIN MENINGGALKAN SEKOLAH
            </h4>
            <p className="text-[10px] font-mono">No: {permit.id.toUpperCase()}</p>
          </div>

          <p className="text-[11px] leading-relaxed">
            Diberikan izin kepada siswa di bawah ini untuk meninggalkan area sekolah pada jam pelajaran berlangsung:
          </p>

          {/* SISWA META TABLE */}
          <div className="border border-slate-200 p-2.5 rounded-lg space-y-1 text-[11px] bg-slate-50">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Nama Siswa:</span>
              <span className="col-span-2 font-bold text-black">{permit.namaSiswa}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Kelas / NISN:</span>
              <span className="col-span-2 font-semibold text-black">{permit.kelas} / {permit.nisn}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Jenis Izin:</span>
              <span className="col-span-2 font-bold text-blue-900">{getStudentPermitTypeDisplay(permit)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Jam Meninggalkan:</span>
              <span className="col-span-2 font-mono font-bold">{permit.tanggal}, {permit.jamKeluar} WIB</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Pendamping / Penjemput:</span>
              <span className="col-span-2 font-medium">{permit.namaPenjemput} ({permit.penjemput})</span>
            </div>
          </div>

          <div className="text-[11px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block">Alasan Izin:</span>
            <span className="font-semibold text-black italic">"{permit.alasan}"</span>
          </div>

          {/* SIGNATURE 3 KOLOM */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 text-center text-[10px]">
            <div>
              <p className="text-slate-500">Guru Mapel,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Paraf]</div>
              <p className="font-bold underline truncate">{permit.guruPengajarName || 'Guru Mapel'}</p>
            </div>
            <div>
              <p className="text-slate-500">Petugas Piket,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Tanda Tangan]</div>
              <p className="font-bold underline truncate">{permit.petugasPiketName}</p>
            </div>
            <div>
              <p className="text-slate-500">Petugas Satpam Gerbang,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Paraf Keluar]</div>
              <p className="font-bold underline">[Pos Keamanan]</p>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 text-center italic pt-1">
            *Surat izin ini wajib diserahkan kepada Petugas Keamanan di Gerbang Utama Sekolah saat keluar.
          </p>
        </div>
      </div>
    </Modal>
  );
};
