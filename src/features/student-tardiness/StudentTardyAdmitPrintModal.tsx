import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentTardyRecord, getTardyReasonDisplay, getDisciplineActionDisplay } from '../../types/studentTardy.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, CheckCircle2 } from 'lucide-react';

interface StudentTardyAdmitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tardy: StudentTardyRecord | null;
  settings: SchoolSettings;
}

export const StudentTardyAdmitPrintModal: React.FC<StudentTardyAdmitPrintModalProps> = ({
  isOpen,
  onClose,
  tardy,
  settings,
}) => {
  if (!tardy) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Surat Izin Masuk Kelas Siswa Terlambat" maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Slip Izin Masuk Kelas (Ditunjukkan ke Guru Pengajar di Kelas)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak Slip Izin
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
              NPSN: {settings.npsn} • Pos Piket & Kedisiplinan Siswa
            </p>
            <h4 className="text-xs font-bold uppercase tracking-wider pt-1 underline">
              SURAT IZIN MASUK KELAS (SISWA TERLAMBAT)
            </h4>
            <p className="text-[10px] font-mono">No: {tardy.id.toUpperCase()}</p>
          </div>

          <p className="text-[11px] leading-relaxed">
            Kepada Yth. <strong>Bapak/Ibu Guru Mata Pelajaran di Kelas</strong>,
            <br />
            Diberitahukan bahwa siswa di bawah ini telah melapor ke Pos Piket, menyelesaikan pembinaan kedisiplinan, dan diizinkan mengikuti pembelajaran di kelas:
          </p>

          {/* TABLE DETAIL */}
          <div className="border border-slate-200 p-2.5 rounded-lg space-y-1 text-[11px] bg-slate-50">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Nama Siswa:</span>
              <span className="col-span-2 font-bold text-black">{tardy.namaSiswa}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Kelas:</span>
              <span className="col-span-2 font-bold text-blue-900">{tardy.kelas}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Waktu Tiba:</span>
              <span className="col-span-2 font-mono font-bold">{tardy.tanggal}, {tardy.jamDatang} WIB (+{tardy.menitTerlambat} menit)</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Alasan Keterlambatan:</span>
              <span className="col-span-2 font-medium">{getTardyReasonDisplay(tardy)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Pembinaan yang Dijalani:</span>
              <span className="col-span-2 font-semibold text-emerald-800">{getDisciplineActionDisplay(tardy)}</span>
            </div>
          </div>

          {/* SIGNATURE 2 KOLOM */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-[10px]">
            <div>
              <p className="text-slate-500">Guru Mata Pelajaran,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Paraf Penerima]</div>
              <p className="font-bold underline">(.......................................)</p>
            </div>
            <div>
              <p className="text-slate-500">Petugas Piket Sekolah,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Tanda Tangan]</div>
              <p className="font-bold underline truncate">{tardy.petugasPiketName}</p>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 text-center italic pt-1">
            *Slip ini diserahkan kepada guru pengajar saat siswa memasuki ruang kelas.
          </p>
        </div>
      </div>
    </Modal>
  );
};
