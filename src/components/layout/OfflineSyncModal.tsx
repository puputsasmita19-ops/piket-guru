import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ListOrdered,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SyncQueueService } from '../../services/offline/syncQueueService';
import { QueueItem } from '../../services/offline/offlineStorage';
import { SyncQueueStatus } from '../../services/offline/syncQueueService';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncQueueStatus;
}

const OPERATION_LABELS: Record<QueueItem['operationType'], string> = {
  ATTENDANCE_CHECKIN: 'Presensi Masuk Piket',
  DUTYBOOK_SUBMIT: 'Buku Piket Digital',
  INCIDENT_REPORT: 'Laporan Kejadian',
  TARDY_REPORT: 'Siswa Terlambat',
  PERMIT_REPORT: 'Izin Siswa & Gerbang',
  VISITOR_REPORT: 'Buku Tamu Digital',
  SUBSTITUTION_REPORT: 'Guru Inval / Pengganti',
  GENERIC_SET: 'Data Operasional',
};

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
}) => {
  const { currentUser, isOffline } = useAuth();
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const { items, pendingCount, isSyncing } = syncStatus;

  const handleSyncAll = async () => {
    if (isOffline) {
      setFeedback('Tidak dapat menyinkronkan: Perangkat sedang offline.');
      return;
    }

    setIsSyncingLocal(true);
    setFeedback('Memulai sinkronisasi antrean ke server…');

    try {
      const res = await SyncQueueService.triggerSync(currentUser);
      if (res.processed === 0) {
        setFeedback('Tidak ada antrean tertunda.');
      } else if (res.failed > 0) {
        setFeedback(`${res.succeeded} data berhasil dikirim, ${res.failed} data perlu tindakan.`);
      } else {
        setFeedback(`Semua data (${res.succeeded} item) berhasil diterima server!`);
      }
    } catch (err: any) {
      setFeedback(`Gagal sinkronisasi: ${err?.message || 'Server belum dapat dihubungi'}`);
    } finally {
      setIsSyncingLocal(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleRetrySingle = async (opId: string) => {
    await SyncQueueService.retryItem(opId, currentUser);
  };

  const handleDeleteSingle = async (opId: string) => {
    if (window.confirm('Hapus item ini dari antrean offline? Data yang belum tersinkron akan dibatalkan.')) {
      await SyncQueueService.removeItem(opId, currentUser.id);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rincian Antrean Pengiriman Luring"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-[var(--theme-card-bg)] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-[var(--theme-card-border)] overflow-hidden flex flex-col max-h-[85vh] pb-safe">
        {/* Mobile Sheet Drag Handle Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/80 dark:bg-[var(--theme-surface-subtle)]/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] shrink-0">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Rincian Antrean Pengiriman
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {items.length} item dalam antrean luring
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
            aria-label="Tutup rincian antrean"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
          {feedback && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 text-blue-600 animate-spin motion-reduce:animate-none" />
              <span>{feedback}</span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Seluruh data telah diterima server
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tidak ada antrean tertunda untuk akun ini.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const label = OPERATION_LABELS[item.operationType] || item.operationType;
                return (
                  <div
                    key={item.operationId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[var(--theme-card-bg)] shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            item.status === 'NEEDS_ACTION'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200'
                              : item.status === 'SENDING'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
                              : item.status === 'SUCCESS'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
                          }`}
                        >
                          {item.status === 'NEEDS_ACTION'
                            ? 'Perlu Tindakan'
                            : item.status === 'SENDING'
                            ? 'Sedang Mengirim…'
                            : item.status === 'SUCCESS'
                            ? 'Berhasil'
                            : 'Menunggu Koneksi'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.status === 'NEEDS_ACTION' && (
                          <button
                            type="button"
                            onClick={() => handleRetrySingle(item.operationId)}
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg text-xs font-semibold cursor-pointer"
                            title="Coba sinkronkan ulang"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status !== 'SENDING' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(item.operationId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg text-xs cursor-pointer transition-colors"
                            title="Hapus data dari antrean"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>ID Record: {item.recordId}</span>
                      <span>
                        {formatIndonesianDate(item.createdAt.split('T')[0])}{' '}
                        {formatTime(item.createdAt)}
                      </span>
                    </div>

                    {item.lastError && (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{item.lastError}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/80 dark:bg-[var(--theme-surface-subtle)]/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isOffline || isSyncing || isSyncingLocal || items.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing || isSyncingLocal ? 'animate-spin motion-reduce:animate-none' : ''
              }`}
            />
            <span>{isSyncing || isSyncingLocal ? 'Menyinkronkan…' : 'Sinkronkan Semua'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
