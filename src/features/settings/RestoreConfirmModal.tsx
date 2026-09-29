import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { BackupPayload } from '../../services/backup/backupService';
import { formatIndonesianDate } from '../../utils/dateUtils';
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  Database,
  Calendar,
  Layers,
} from 'lucide-react';

interface RestoreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupData: BackupPayload | null;
  onConfirmRestore: (data: BackupPayload) => Promise<void>;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  isOpen,
  onClose,
  backupData,
  onConfirmRestore,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);

  if (!backupData) return null;

  const handleExecute = async () => {
    setIsRestoring(true);
    try {
      await onConfirmRestore(backupData);
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  const dataEntries = Object.entries(backupData.data).map(([key, value]) => ({
    collection: key,
    count: Array.isArray(value) ? value.length : 0,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Pemulihan Database (Restore)"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Peringatan Pemulihan Data!</span>
            <p>
              Proses restore akan memperbarui dan menimpa dokumen di database dengan data yang ada pada berkas cadangan ini. Pastikan berkas cadangan yang Anda pilih sudah benar.
            </p>
          </div>
        </div>

        {/* Backup Meta Info */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block">Waktu Pembuatan Cadangan:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {formatIndonesianDate(backupData.timestamp)} ({backupData.timestamp.split('T')[1].substring(0, 5)} WIB)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Dibuat Oleh:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {backupData.createdBy.fullName} ({backupData.createdBy.role})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Asal Sekolah:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {backupData.metadata.schoolName} (NPSN: {backupData.metadata.npsn})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Rekaman:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {backupData.metadata.totalRecords} Dokumen
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown table */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Rincian Dokumen per Koleksi:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 text-xs">
            {dataEntries.map((entry) => (
              <div
                key={entry.collection}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px] capitalize">
                  {entry.collection}
                </span>
                <span className="font-bold font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 text-[10px]">
                  {entry.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isRestoring}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isRestoring}
            leftIcon={<Database className="w-4 h-4" />}
            onClick={handleExecute}
          >
            Mulai Pulihkan Data (Restore)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
