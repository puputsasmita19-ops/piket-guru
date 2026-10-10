import React, { useState } from 'react';
import {
  X,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ListOrdered,
  Database,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SyncQueueService, SyncQueueStatus } from '../../services/offline/syncQueueService';
import { OfflineStorage } from '../../services/offline/offlineStorage';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

interface OfflineSyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncQueueStatus;
  onOpenQueueModal: () => void;
}

export const OfflineSyncPanel: React.FC<OfflineSyncPanelProps> = ({
  onClose,
  syncStatus,
  onOpenQueueModal,
}) => {
  const { currentUser, isOffline, isOfflineSession, isTrustedDevice, setTrustedDevice } = useAuth();
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!currentUser) return null;

  const { items, pendingCount, needsActionCount, lastSuccessfulSyncAt, isSyncing } = syncStatus;

  // Determine State Theme & Icon
  let statusTitle = 'Online';
  let statusExplanation = 'Tidak ada data dalam antrean.';
  let StatusIcon = CheckCircle2;
  let statusCardStyle =
    'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200';
  let statusIconStyle = 'text-emerald-600 dark:text-emerald-400';

  if (needsActionCount > 0) {
    statusTitle = 'Perlu tindakan';
    statusExplanation = `${needsActionCount} item antrean memerlukan konfirmasi atau perbaikan pengguna.`;
    StatusIcon = AlertCircle;
    statusCardStyle =
      'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200';
    statusIconStyle = 'text-rose-600 dark:text-rose-400';
  } else if (isSyncing || isSyncingLocal) {
    statusTitle = 'Sedang mengirim';
    statusExplanation = `Mengirim ${pendingCount || items.length} data antrean ke server sekolah…`;
    StatusIcon = RefreshCw;
    statusCardStyle =
      'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200';
    statusIconStyle = 'text-blue-600 dark:text-blue-400 animate-spin motion-reduce:animate-none';
  } else if (isOffline || isOfflineSession) {
    statusTitle = 'Offline';
    statusExplanation =
      'Data yang menunggu pengiriman akan dikirim setelah koneksi tersedia dan akun terverifikasi.';
    StatusIcon = WifiOff;
    statusCardStyle =
      'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200';
    statusIconStyle = 'text-amber-600 dark:text-amber-400';
  } else if (pendingCount > 0) {
    statusTitle = 'Menunggu koneksi';
    statusExplanation = `${pendingCount} item antrean siap disinkronkan ke server sekolah.`;
    StatusIcon = Clock;
    statusCardStyle =
      'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200';
    statusIconStyle = 'text-amber-600 dark:text-amber-400';
  }

  const handleSyncAll = async () => {
    if (isOffline) {
      setFeedback('Perangkat sedang offline. Sambungkan internet terlebih dahulu.');
      return;
    }

    setIsSyncingLocal(true);
    setFeedback('Memulai sinkronisasi…');

    try {
      const res = await SyncQueueService.triggerSync(currentUser);
      if (res.processed === 0) {
        setFeedback('Tidak ada antrean yang perlu disinkronkan.');
      } else if (res.failed > 0) {
        setFeedback(`${res.succeeded} berhasil terkirim, ${res.failed} gagal.`);
      } else {
        setFeedback(`Semua data (${res.succeeded}) berhasil diterima server!`);
      }
    } catch (err: any) {
      setFeedback(`Gagal: ${err?.message || 'Server belum dapat dihubungi'}`);
    } finally {
      setIsSyncingLocal(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleClearDisplayCache = async () => {
    if (
      window.confirm(
        'Bersihkan cache tampilan di perangkat ini? (Draf isian & antrean pengiriman Anda TIDAK AKAN terhapus).'
      )
    ) {
      await OfflineStorage.clearDisplayCacheOnly(currentUser.id);
      setFeedback('Cache tampilan dibersihkan. Memuat ulang data…');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <>
      {/* Mobile Subtle Backdrop overlay (Hidden on Desktop) */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-xs sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Compact Notification Panel */}
      <div
        role="region"
        aria-label="Panel Notifikasi Status Koneksi"
        className="fixed top-16 left-3 right-3 sm:left-auto sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-[360px] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-xl border border-slate-200 dark:border-[var(--theme-card-border)] p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[85vh] overflow-y-auto"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
              Status Koneksi
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup Panel"
            aria-label="Tutup panel status koneksi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert if active */}
        {feedback && (
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-[11px] font-semibold flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0 animate-spin motion-reduce:animate-none text-blue-600" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Main Status Row */}
        <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${statusCardStyle}`}>
          <StatusIcon className={`w-4 h-4 shrink-0 mt-0.5 ${statusIconStyle}`} />
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="font-bold text-xs block truncate">{statusTitle}</span>
            <p className="text-[11px] leading-snug opacity-90">{statusExplanation}</p>
          </div>
        </div>

        {/* Unsent Queue Summary Row */}
        <div className="flex items-center justify-between py-1.5 px-1 border-b border-slate-100 dark:border-slate-800/80 text-[11px]">
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
            <ListOrdered className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Antrean Belum Terkirim:</span>
          </span>
          {pendingCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                {pendingCount} item
              </span>
              <button
                type="button"
                onClick={onOpenQueueModal}
                className="font-bold text-[var(--theme-primary-text)] hover:underline cursor-pointer"
              >
                Lihat antrean
              </button>
            </div>
          ) : (
            <span className="text-slate-400 font-medium">Kosong (0)</span>
          )}
        </div>

        {/* Last Sync Time Row */}
        <div className="flex items-center justify-between py-1.5 px-1 border-b border-slate-100 dark:border-slate-800/80 text-[11px]">
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Sinkronisasi terakhir:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px]">
            {lastSuccessfulSyncAt
              ? `${formatIndonesianDate(lastSuccessfulSyncAt.split('T')[0])} ${formatTime(lastSuccessfulSyncAt)}`
              : 'Belum ada'}
          </span>
        </div>

        {/* Device Mode & Storage Row */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between py-1 px-1 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
              {isTrustedDevice ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span>Mode Perangkat: <strong className="text-slate-700 dark:text-slate-200">{isTrustedDevice ? 'Pribadi' : 'Publik'}</strong></span>
            </span>
            <button
              type="button"
              onClick={() => setTrustedDevice(!isTrustedDevice)}
              className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer shrink-0 ml-2"
            >
              [Ubah]
            </button>
          </div>

          <div className="flex items-center justify-between py-1 px-1 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
              <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Penyimpanan Lokal:</span>
            </span>
            <button
              type="button"
              onClick={handleClearDisplayCache}
              className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer shrink-0 ml-2"
            >
              Bersihkan Cache
            </button>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenQueueModal}
            className="flex-1 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-center truncate flex items-center justify-center gap-1.5"
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span>Rincian Antrean</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isOffline || isSyncing || isSyncingLocal || items.length === 0}
            className="flex-1 px-3 py-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed text-center truncate flex items-center justify-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${
                isSyncing || isSyncingLocal ? 'animate-spin motion-reduce:animate-none' : ''
              }`}
            />
            <span>{isSyncing || isSyncingLocal ? 'Mengirim…' : 'Coba Sinkronkan'}</span>
          </button>
        </div>
      </div>
    </>
  );
};
