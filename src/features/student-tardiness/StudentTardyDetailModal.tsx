import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  StudentTardyRecord,
  getTardyReasonDisplay,
  getDisciplineActionDisplay,
} from '../../types/studentTardy.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import {
  Clock,
  User,
  GraduationCap,
  AlertTriangle,
  Printer,
  MessageSquare,
  CheckCircle2,
  Image as ImageIcon,
  Edit2,
  Eye,
} from 'lucide-react';

interface StudentTardyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tardy: StudentTardyRecord | null;
  onEdit?: (tardy: StudentTardyRecord) => void;
  onAdmit?: (tardy: StudentTardyRecord) => void;
  onSendWa?: (tardy: StudentTardyRecord) => void;
  onPrint?: (tardy: StudentTardyRecord) => void;
  canEdit?: boolean;
}

export const StudentTardyDetailModal: React.FC<StudentTardyDetailModalProps> = ({
  isOpen,
  onClose,
  tardy,
  onEdit,
  onAdmit,
  onSendWa,
  onPrint,
  canEdit = false,
}) => {
  const [isPreviewPhotoOpen, setIsPreviewPhotoOpen] = useState(false);

  if (!tardy) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Detail Siswa Terlambat: ${tardy.namaSiswa}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Header Status & Action Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  tardy.status === 'SELESAI_MASUK_KELAS'
                    ? 'success'
                    : tardy.status === 'PEMANGGILAN_ORTU'
                    ? 'danger'
                    : 'warning'
                }
                size="md"
              >
                {tardy.status === 'SELESAI_MASUK_KELAS'
                  ? 'Izin Masuk Kelas'
                  : tardy.status === 'PEMANGGILAN_ORTU'
                  ? 'Panggilan Orang Tua'
                  : 'Dalam Pembinaan'}
              </Badge>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                  tardy.frekuensiBulanIni >= 3
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                Keterlambatan ke-{tardy.frekuensiBulanIni} (+{tardy.poinPelanggaran} Poin)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onClose();
                    onEdit(tardy);
                  }}
                >
                  Ubah Data
                </Button>
              )}
            </div>
          </div>

          {/* Student Info Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-500 block">👤 Identitas Siswa:</span>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                {tardy.namaSiswa}
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-semibold">
                Kelas: {tardy.kelas}
              </div>
              <div className="text-slate-400 font-mono">
                {tardy.nisn && tardy.nisn !== '-' ? `NISN: ${tardy.nisn}` : 'NISN: -'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
              <span className="font-bold text-slate-500 block">⏰ Waktu & Keterlambatan:</span>
              <div className="font-bold text-slate-900 dark:text-white">
                {formatIndonesianDate(tardy.tanggal)}
              </div>
              <div className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                Tiba: {tardy.jamDatang} WIB (+{tardy.menitTerlambat} menit terlambat)
              </div>
              <div className="text-slate-500 text-[11px]">
                Petugas: <strong>{tardy.petugasPiketName}</strong>
              </div>
            </div>
          </div>

          {/* Reason & Discipline Detail */}
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Alasan Keterlambatan:
              </span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {getTardyReasonDisplay(tardy)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Bentuk Pembinaan Kedisiplinan:
              </span>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {getDisciplineActionDisplay(tardy)}
              </p>
            </div>

            {tardy.catatanPetugas && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Catatan Petugas:
                </span>
                <p className="text-slate-800 dark:text-slate-200 italic">
                  "{tardy.catatanPetugas}"
                </p>
              </div>
            )}
          </div>

          {/* Photo Documentation Section */}
          {tardy.fotoUrl ? (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Foto Dokumentasi di Pos Gerbang:
              </span>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => setIsPreviewPhotoOpen(true)}
                  className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 cursor-pointer group shadow-sm shrink-0"
                >
                  <img
                    src={tardy.fotoUrl}
                    alt="Dokumentasi Siswa"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setIsPreviewPhotoOpen(true)}
                  >
                    Perbesar Foto
                  </Button>
                  <p className="text-[11px] text-slate-400">
                    Foto tersimpan permanen sebagai bukti kehadiran gerbang.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
              Tidak ada lampiran foto dokumentasi untuk catatan ini.
            </p>
          )}

          {/* Action buttons footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {onSendWa && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                  leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                  onClick={() => onSendWa(tardy)}
                >
                  Kirim WA Ortu
                </Button>
              )}
              {onPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  leftIcon={<Printer className="w-3.5 h-3.5" />}
                  onClick={() => onPrint(tardy)}
                >
                  Cetak Slip Izin
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {tardy.status === 'DALAM_PEMBINAAN' && onAdmit && (
                <Button
                  variant="primary"
                  size="sm"
                  className="text-xs font-bold"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onAdmit(tardy);
                    onClose();
                  }}
                >
                  Selesai & Masuk Kelas
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Photo Zoom Preview Modal */}
      {tardy.fotoUrl && (
        <Modal
          isOpen={isPreviewPhotoOpen}
          onClose={() => setIsPreviewPhotoOpen(false)}
          title={`Foto Dokumentasi: ${tardy.namaSiswa}`}
          maxWidth="md"
        >
          <div className="space-y-3 text-center">
            <img
              src={tardy.fotoUrl}
              alt="Foto Siswa Terlambat"
              className="w-full max-h-[75vh] object-contain rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
            />
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsPreviewPhotoOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
