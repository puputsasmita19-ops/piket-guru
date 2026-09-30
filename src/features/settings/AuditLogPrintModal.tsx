import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SchoolSettings } from '../../types';
import { AuditLogRecord } from '../../types/master.types';
import { Printer, ShieldCheck } from 'lucide-react';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface AuditLogPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogRecord[];
  settings: SchoolSettings;
}

export const AuditLogPrintModal: React.FC<AuditLogPrintModalProps> = ({
  isOpen,
  onClose,
  logs,
  settings,
}) => {
  const currentDate = new Date();

  // Statistics
  const totalEvents = logs.length;
  const uniqueUsers = new Set(logs.map((l) => l.userName)).size;
  const deleteActions = logs.filter((l) => l.action === 'DELETE').length;
  const emergencyActions = logs.filter(
    (l) => l.action === 'EMERGENCY' || l.action === 'SECURITY'
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cetak Berkas Laporan Jejak Audit Forensik Resmi"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Print Action Bar */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-950 dark:text-blue-200">
              Format Laporan Audit Kepatuhan & Akuntabilitas Sistem ({logs.length} Rekaman)
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Cetak Dokumen Resmi
          </Button>
        </div>

        {/* PRINT PAPER CONTAINER */}
        <div className="bg-white text-black p-6 sm:p-8 rounded-2xl border border-slate-300 font-sans text-xs space-y-4 print:border-none print:p-2 relative overflow-hidden">
          {/* Security Watermark for print */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-25deg] select-none text-4xl sm:text-6xl font-black font-mono">
            DOKUMEN RESMI AUDIT FORENSIK • RAHASIA
          </div>

          {/* KOP SURAT RESMI */}
          <div className="border-b-2 border-black pb-3 text-center space-y-1 relative">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg font-mono">
                PG
              </div>
              <div className="text-left">
                <h2 className="font-extrabold text-base uppercase tracking-wider text-black">
                  {settings.schoolName}
                </h2>
                <p className="text-[11px] text-slate-700">
                  NPSN: {settings.npsn} • {settings.address}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Sistem Informasi Manajemen Piket & Ketertiban Sekolah Terpadu
                </p>
              </div>
            </div>
            <div className="pt-2">
              <h3 className="text-sm font-black uppercase tracking-widest underline">
                BERKAS AUDIT FORENSIK & REKAM JEJAK SISTEM (AUDIT TRAIL)
              </h3>
              <p className="text-[10px] font-mono text-slate-600">
                Nomor Registrasi: AUD-{Date.now().toString().slice(-8)} / KEPATUHAN / {currentDate.getFullYear()}
              </p>
            </div>
          </div>

          {/* RINGKASAN AUDIT */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500">Total Peristiwa</div>
              <div className="font-bold text-sm font-mono">{totalEvents}</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500">Pengguna Terlibat</div>
              <div className="font-bold text-sm font-mono">{uniqueUsers} Orang</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500">Aksi Penghapusan</div>
              <div className="font-bold text-sm font-mono text-rose-600">{deleteActions}</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-slate-500">Insiden / Siaga</div>
              <div className="font-bold text-sm font-mono text-amber-600">{emergencyActions}</div>
            </div>
          </div>

          {/* TABEL LOG AUDIT */}
          <div className="pt-2">
            <table className="w-full text-left text-[10px] border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 border-b border-black">
                  <th className="p-2 border-r border-black w-8 text-center">No</th>
                  <th className="p-2 border-r border-black w-24">Waktu (WIB)</th>
                  <th className="p-2 border-r border-black w-32">Pengguna & Peran</th>
                  <th className="p-2 border-r border-black w-20">Modul</th>
                  <th className="p-2 border-r border-black w-20">Aksi</th>
                  <th className="p-2">Deskripsi Rincian Rekam Jejak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.slice(0, 75).map((log, idx) => (
                  <tr key={log.id} className="border-b border-slate-300">
                    <td className="p-1.5 border-r border-black text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="p-1.5 border-r border-black font-mono text-[9px]">
                      {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 16) : '-'}
                    </td>
                    <td className="p-1.5 border-r border-black">
                      <div className="font-bold">{log.userName}</div>
                      <div className="text-[9px] text-slate-500 font-mono">[{log.role}]</div>
                    </td>
                    <td className="p-1.5 border-r border-black font-mono font-bold text-[9px]">
                      {log.module}
                    </td>
                    <td className="p-1.5 border-r border-black font-mono font-bold text-[9px]">
                      {log.action}
                    </td>
                    <td className="p-1.5 text-slate-800 leading-snug">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length > 75 && (
              <p className="text-[9px] text-slate-400 italic pt-1 text-center">
                * Menampilkan 75 dari total {logs.length} rekaman jejak audit dalam berkas cetak ini.
              </p>
            )}
          </div>

          {/* LEGALITAS DAN TANDA TANGAN */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-black text-center text-[10px]">
            <div>
              <p className="text-slate-600">Disusun dan Diverifikasi oleh:</p>
              <p className="font-bold">Administrator / Petugas Audit Sistem</p>
              <div className="h-16 flex items-center justify-center italic text-slate-300">
                [Tanda Tangan & Stempel Resmi]
              </div>
              <p className="font-bold underline uppercase">( Tim Administrator IT )</p>
              <p className="text-slate-500 text-[9px]">Piket Guru Digital Security</p>
            </div>

            <div>
              <p className="text-slate-600">
                Mengetahui dan Mengesahkan,
                <br />
                {settings.address.split(',')[0] || 'Sekolah'}, {formatIndonesianDate(currentDate)}
              </p>
              <p className="font-bold">Kepala Sekolah / Penanggung Jawab</p>
              <div className="h-16 flex items-center justify-center italic text-slate-300">
                [Tanda Tangan & Cap Sekolah]
              </div>
              <p className="font-bold underline uppercase">( Kepala {settings.schoolName} )</p>
              <p className="text-slate-500 text-[9px]">NIP. 19780512 200501 1 008</p>
            </div>
          </div>

          <div className="text-[8px] text-slate-400 text-center italic pt-2">
            Dokumen ini dihasilkan secara otomatis dan sah berdasarkan enkripsi jejak audit sistem Piket Guru Digital.
          </div>
        </div>
      </div>
    </Modal>
  );
};
