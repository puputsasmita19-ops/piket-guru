import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  StudentTardyRecord,
  calculateStudentTardiness,
  calculateTardyViolationPoints,
} from '../../types/studentTardy.types';
import { SchoolSettings } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';
import {
  Clock,
  User,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  History,
} from '../../components/icons';

interface StudentTardyCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tardy: StudentTardyRecord | null;
  settings?: SchoolSettings;
  onSaveCorrection: (params: {
    tardyId: string;
    newJamDatang?: string;
    manualMinutesLate?: number;
    reason: string;
  }) => Promise<void>;
}

export const StudentTardyCorrectionModal: React.FC<StudentTardyCorrectionModalProps> = ({
  isOpen,
  onClose,
  tardy,
  settings,
  onSaveCorrection,
}) => {
  const [correctionMode, setCorrectionMode] = useState<'TIME' | 'MANUAL'>('TIME');
  const [newJamDatang, setNewJamDatang] = useState('');
  const [manualMinutesStr, setManualMinutesStr] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tardy) {
      setCorrectionMode('TIME');
      setNewJamDatang(tardy.jamDatang || '07:15');
      setManualMinutesStr(String(tardy.menitTerlambat || 0));
      setReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, tardy]);

  const entryLimit = useMemo(() => {
    return (
      tardy?.ruleSnapshot?.entryLimit ||
      settings?.studentTardyConfig?.entryLimit ||
      settings?.workHours?.start ||
      '07:00'
    );
  }, [tardy, settings]);

  const toleranceMinutes = useMemo(() => {
    if (tardy?.ruleSnapshot?.toleranceMinutes !== undefined) {
      return tardy.ruleSnapshot.toleranceMinutes;
    }
    return settings?.studentTardyConfig?.toleranceMinutes ?? 0;
  }, [tardy, settings]);

  // Dynamic preview when adjusting arrival time
  const timePreview = useMemo(() => {
    return calculateStudentTardiness(newJamDatang, entryLimit, toleranceMinutes);
  }, [newJamDatang, entryLimit, toleranceMinutes]);

  // Dynamic preview when manual minutes are entered
  const manualMinutesNumber = useMemo(() => {
    const parsed = parseInt(manualMinutesStr, 10);
    return isNaN(parsed) ? null : parsed;
  }, [manualMinutesStr]);

  if (!tardy) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!reason.trim()) {
      setErrorMessage('Alasan koreksi wajib diisi secara jelas.');
      return;
    }

    if (correctionMode === 'MANUAL') {
      if (manualMinutesNumber === null || manualMinutesNumber < 0) {
        setErrorMessage('Menit keterlambatan harus berupa bilangan bulat tidak negatif (>= 0).');
        return;
      }
    } else {
      if (!newJamDatang || !newJamDatang.trim()) {
        setErrorMessage('Jam tiba perbaikan wajib diisi.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (correctionMode === 'MANUAL') {
        await onSaveCorrection({
          tardyId: tardy.id,
          manualMinutesLate: manualMinutesNumber!,
          reason: reason.trim(),
        });
      } else {
        await onSaveCorrection({
          tardyId: tardy.id,
          newJamDatang: newJamDatang.trim(),
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan koreksi keterlambatan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const originalMinutes = tardy.menitTerlambatAsli ?? tardy.menitTerlambat;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Koreksi Keterlambatan Siswa (Khusus Admin)"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner Hak Akses Admin */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Otoritas Koreksi Administrator</span>
            <p className="text-[11px] leading-relaxed opacity-90">
              Setiap tindakan koreksi akan dicatat dalam Audit Log resmi. Hasil perhitungan asli tetap tersimpan secara terpisah.
            </p>
          </div>
        </div>

        {/* Info Siswa & Status Saat Ini */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {tardy.namaSiswa}
              </span>
              <span className="text-slate-500 ml-2 font-medium">({tardy.kelas})</span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              {formatIndonesianDate(tardy.tanggal)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div>
              <span className="text-slate-500 block">Jam Tiba Tercatat:</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {tardy.jamDatang} WIB
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Batas Jam Masuk:</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {entryLimit} WIB
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Toleransi:</span>
              <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                {toleranceMinutes} Menit
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Hasil Asli / Saat Ini:</span>
              <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                {originalMinutes} mnt / {tardy.menitTerlambat} mnt
              </span>
            </div>
          </div>

          {tardy.isCorrectedByAdmin && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-medium">
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>Sebelumnya dikoreksi oleh {tardy.adminCorrection?.correctedByAdminName || 'Admin'}: "{tardy.adminCorrection?.reason}"</span>
            </div>
          )}
        </div>

        {/* Pilihan Metode Koreksi */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Metode Koreksi:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCorrectionMode('TIME')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                correctionMode === 'TIME'
                  ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] ring-1 ring-[var(--theme-primary-border)]'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Perbaiki Jam Tiba</span>
            </button>
            <button
              type="button"
              onClick={() => setCorrectionMode('MANUAL')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                correctionMode === 'MANUAL'
                  ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] ring-1 ring-[var(--theme-primary-border)]'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Koreksi Manual Menit</span>
            </button>
          </div>
        </div>

        {/* Input Berdasarkan Mode */}
        {correctionMode === 'TIME' ? (
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Jam Tiba yang Seharusnya (WIB):
            </label>
            <input
              type="time"
              required
              value={newJamDatang}
              onChange={(e) => setNewJamDatang(e.target.value)}
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm font-bold w-full sm:w-48"
            />
            {/* Pratinjau Perhitungan Otomatis */}
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] space-y-1">
              <span className="font-bold text-blue-900 dark:text-blue-300 block">
                Hasil Hitung Ulang:
              </span>
              <p className="text-blue-800 dark:text-blue-200">
                Jam Tiba: <strong>{newJamDatang || '-'} WIB</strong> &bull; Batas Masuk: <strong>{entryLimit} WIB</strong> &bull; Toleransi: <strong>{toleranceMinutes} Menit</strong>
              </p>
              <p className="font-bold font-mono text-blue-900 dark:text-blue-200">
                {timePreview.displayText} {timePreview.minutesLate !== null && `(+${calculateTardyViolationPoints(timePreview.minutesLate)} Poin)`}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Menit Keterlambatan Hasil Koreksi:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                required
                value={manualMinutesStr}
                onChange={(e) => setManualMinutesStr(e.target.value)}
                placeholder="0"
                className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm font-bold w-36"
              />
              <span className="font-bold text-slate-600 dark:text-slate-400">Menit</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Nilai harus bilangan bulat tidak negatif (&gt;= 0). Masukkan 0 jika siswa dinyatakan tepat waktu.
            </p>
            {manualMinutesNumber !== null && (
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Poin Pelanggaran Otomatis: +{calculateTardyViolationPoints(manualMinutesNumber)} Poin
              </div>
            )}
          </div>
        )}

        {/* Alasan Koreksi (Wajib) */}
        <div className="space-y-1 text-xs">
          <label className="font-bold text-slate-700 dark:text-slate-300 block">
            Alasan Koreksi <span className="text-rose-500">*</span>:
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Kesalahan input jam kedatangan oleh petugas piket gerbang, verifikasi rekaman CCTV gerbang menunjukkan tiba pukul 06.58 WIB."
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs leading-relaxed focus:ring-2 focus:ring-[var(--theme-primary)]"
          />
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Simpan Koreksi Admin
          </Button>
        </div>
      </form>
    </Modal>
  );
};
