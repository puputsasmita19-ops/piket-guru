import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import { Printer, FileSpreadsheet } from 'lucide-react';

interface SubstitutionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  substitution: TeacherSubstitutionRecord | null;
  settings: SchoolSettings;
}

export const SubstitutionPrintModal: React.FC<SubstitutionPrintModalProps> = ({
  isOpen,
  onClose,
  substitution,
  settings,
}) => {
  if (!substitution) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cetak Lembar Penugasan Guru Inval / Pengganti" maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <span className="font-semibold text-blue-900 dark:text-blue-200">
            Surat Penugasan Guru Pengganti / Inval (Format Standar A5)
          </span>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Cetak Lembar Tugas Inval
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
              LEMBAR PENUGASAN GURU PENGGANTI (INVAL)
            </h4>
            <p className="text-[10px] font-mono">No: {substitution.id.toUpperCase()}</p>
          </div>

          <p className="text-[11px] leading-relaxed">
            Sehubungan dengan adanya guru mata pelajaran yang berhalangan hadir pada hari ini, dengan ini ditugaskan guru pengganti (inval) untuk mendampingi kegiatan pembelajaran siswa di kelas:
          </p>

          {/* TABLE DETAIL */}
          <div className="border border-slate-200 p-2.5 rounded-lg space-y-1 text-[11px] bg-slate-50">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Guru Berhalangan:</span>
              <span className="col-span-2 font-bold text-black">{substitution.guruBerhalanganName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Mata Pelajaran:</span>
              <span className="col-span-2 font-semibold text-black">{substitution.mataPelajaran}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Alasan Berhalangan:</span>
              <span className="col-span-2 font-medium">{substitution.alasan.replace('_', ' ')} {substitution.keteranganAlasan ? `(${substitution.keteranganAlasan})` : ''}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Kelas / Jam Pelajaran:</span>
              <span className="col-span-2 font-bold text-blue-900">{substitution.kelas} • {substitution.jamPelajaran}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Guru Pengganti / Inval:</span>
              <span className="col-span-2 font-bold text-emerald-800">{substitution.guruPenggantiName || 'Belum Ditugaskan'}</span>
            </div>
          </div>

          {/* MATERI & TUGAS */}
          <div className="text-[11px] p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-bold text-slate-700 block">Materi & Penugasan untuk Siswa:</span>
            <p className="font-medium text-black leading-relaxed text-justify">
              {substitution.materiDanTugasSiswa}
            </p>
          </div>

          {/* SIGNATURE 2 KOLOM */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-[10px]">
            <div>
              <p className="text-slate-500">Petugas Piket Sekolah,</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Tanda Tangan]</div>
              <p className="font-bold underline truncate">{substitution.petugasPiketName}</p>
            </div>
            <div>
              <p className="text-slate-500">Guru Pengganti (Inval),</p>
              <div className="h-10 flex items-center justify-center italic text-slate-300">[Tanda Tangan]</div>
              <p className="font-bold underline truncate">{substitution.guruPenggantiName || 'Guru Pengganti'}</p>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 text-center italic pt-1">
            *Setelah jam pelajaran selesai, mohon serahkan kembali lembar penugasan ini ke meja koordinator piket.
          </p>
        </div>
      </div>
    </Modal>
  );
};
