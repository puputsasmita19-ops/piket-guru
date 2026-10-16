import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { SchoolSettings } from '../../types';
import { Printer, FileText, Users, ChevronLeft, ChevronRight } from '../../components/icons';

interface StudentPermitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit?: StudentPermitRecord | null;
  permits?: StudentPermitRecord[];
  settings: SchoolSettings;
}

export const StudentPermitPrintModal: React.FC<StudentPermitPrintModalProps> = ({
  isOpen,
  onClose,
  permit,
  permits = [],
  settings,
}) => {
  // Normalize items to print
  const printList: StudentPermitRecord[] = React.useMemo(() => {
    if (permits && permits.length > 0) return permits;
    if (permit) return [permit];
    return [];
  }, [permit, permits]);

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [printMode, setPrintMode] = useState<'ALL' | 'SINGLE'>('ALL');

  if (printList.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentPreview = printList[activePreviewIndex] || printList[0];
  const isMultiple = printList.length > 1;

  const renderSingleSlip = (p: StudentPermitRecord, index: number, isLast: boolean) => (
    <div
      key={p.id}
      className={`bg-white text-black p-6 rounded-2xl border border-slate-300 font-sans text-xs space-y-3 print:border-none print:p-4 print:shadow-none print:rounded-none ${
        !isLast ? 'print:break-after-page mb-6 print:mb-0' : ''
      }`}
    >
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
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono">
          <span>No: {p.id.toUpperCase()}</span>
          {p.groupId && (
            <span className="text-slate-500">
              • Grup: #{p.groupId.slice(-6).toUpperCase()} ({index + 1}/{printList.length})
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed">
        Diberikan izin kepada siswa di bawah ini untuk meninggalkan area sekolah pada jam pelajaran berlangsung:
      </p>

      {/* SISWA META TABLE */}
      <div className="border border-slate-200 p-2.5 rounded-lg space-y-1 text-[11px] bg-slate-50">
        <div className="grid grid-cols-3 gap-1">
          <span className="text-slate-500">Nama Siswa:</span>
          <span className="col-span-2 font-bold text-black">{p.namaSiswa}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span className="text-slate-500">Kelas / NISN:</span>
          <span className="col-span-2 font-semibold text-black">
            {p.kelas} {p.nisn && p.nisn !== '-' ? `/ NISN: ${p.nisn}` : ''}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span className="text-slate-500">Jenis Izin:</span>
          <span className="col-span-2 font-bold text-blue-900">{getStudentPermitTypeDisplay(p)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span className="text-slate-500">Jam Meninggalkan:</span>
          <span className="col-span-2 font-mono font-bold">
            {p.tanggal}, {p.jamKeluar} WIB
            {p.jamKembali ? ` (Kembali: ${p.jamKembali} WIB)` : ''}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span className="text-slate-500">Pendamping / Penjemput:</span>
          <span className="col-span-2 font-medium">
            {p.namaPenjemput || '-'} ({p.penjemput})
            {p.noHpOrangTua ? ` • Kontak: ${p.noHpOrangTua}` : ''}
          </span>
        </div>
      </div>

      <div className="text-[11px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
        <span className="text-slate-500 block">Alasan Izin:</span>
        <span className="font-semibold text-black italic">"{p.alasan}"</span>
      </div>

      {/* SIGNATURE 3 KOLOM */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 text-center text-[10px]">
        <div>
          <p className="text-slate-500">Guru Mapel,</p>
          <div className="h-10 flex items-center justify-center italic text-slate-300">[Paraf]</div>
          <p className="font-bold underline truncate">{p.guruPengajarName || 'Guru Mapel'}</p>
        </div>
        <div>
          <p className="text-slate-500">Petugas Piket,</p>
          <div className="h-10 flex items-center justify-center italic text-slate-300">[Tanda Tangan]</div>
          <p className="font-bold underline truncate">{p.petugasPiketName}</p>
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isMultiple
          ? `Cetak ${printList.length} Surat Izin Gerbang Siswa (Massal)`
          : 'Cetak Surat Izin Keluar Sekolah (Gate Pass)'
      }
      maxWidth={isMultiple ? 'lg' : 'md'}
    >
      <div className="space-y-4">
        {/* ACTION & MODE BAR (Screen only) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs no-print">
          <div>
            <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              {isMultiple
                ? `Format Standar A5/Slip — ${printList.length} Surat Izin Siswa`
                : 'Surat Dispensasi & Izin Keluar Gerbang Siswa (Format Standar A5/Slip)'}
            </span>
            {isMultiple && (
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Setiap siswa dicetak pada lembar/slip terpisah (dilengkapi page-break otomatis).
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              {isMultiple ? `Cetak Semua (${printList.length})` : 'Cetak Surat Izin'}
            </Button>
          </div>
        </div>

        {/* BATCH SELECTOR (Screen preview) */}
        {isMultiple && (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs no-print">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Pratinjau Siswa ({activePreviewIndex + 1} dari {printList.length}):
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {currentPreview.namaSiswa} ({currentPreview.kelas})
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activePreviewIndex === 0}
                onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                title="Siswa Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={activePreviewIndex === printList.length - 1}
                onClick={() => setActivePreviewIndex((prev) => Math.min(printList.length - 1, prev + 1))}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                title="Siswa Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PRINT CANVAS (All items rendered so window.print prints all with page break) */}
        <div className="print:block">
          {/* On screen: if multiple, show active preview or all depending on screen scroll */}
          <div className="hidden print:block space-y-6">
            {printList.map((p, idx) => renderSingleSlip(p, idx, idx === printList.length - 1))}
          </div>

          <div className="block print:hidden">
            {renderSingleSlip(currentPreview, activePreviewIndex, true)}
          </div>
        </div>
      </div>
    </Modal>
  );
};
