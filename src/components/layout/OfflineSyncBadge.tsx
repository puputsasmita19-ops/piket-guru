import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SyncQueueService, SyncQueueStatus } from '../../services/offline/syncQueueService';
import { OfflineSyncPanel } from './OfflineSyncPanel';
import { OfflineSyncModal } from './OfflineSyncModal';

export const OfflineSyncBadge: React.FC = () => {
  const { currentUser, isOffline, isOfflineSession } = useAuth();
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncQueueStatus>({
    pendingCount: 0,
    needsActionCount: 0,
    isSyncing: false,
    lastSuccessfulSyncAt: null,
    items: [],
  });

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    SyncQueueService.refreshStatus(currentUser.id).then(setSyncStatus);
    const unsub = SyncQueueService.subscribe(setSyncStatus);
    return () => unsub();
  }, [currentUser?.id]);

  // Click outside listener for the notification panel
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPanelOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPanelOpen]);

  if (!currentUser) return null;

  const { pendingCount, needsActionCount, isSyncing } = syncStatus;

  // Determine state tone and labels
  let shortLabel = 'Online';
  let Icon = Wifi;

  if (needsActionCount > 0) {
    shortLabel = 'Perlu tindakan';
    Icon = AlertCircle;
  } else if (isSyncing) {
    shortLabel = 'Mengirim';
    Icon = RefreshCw;
  } else if (pendingCount > 0) {
    shortLabel = 'Menunggu koneksi';
    Icon = Clock;
  } else if (isOffline || isOfflineSession) {
    shortLabel = 'Offline';
    Icon = WifiOff;
  } else {
    shortLabel = 'Online';
    Icon = Wifi;
  }

  // Accessible Label
  const accessibleLabel = `Status koneksi: ${shortLabel}.${
    pendingCount > 0 ? ` ${pendingCount} data belum terkirim.` : ''
  } Klik untuk membaca rincian status koneksi.`;

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 50);
  };

  const handleOpenQueueModal = () => {
    setIsPanelOpen(false);
    setIsQueueModalOpen(true);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        aria-expanded={isPanelOpen}
        aria-haspopup="true"
        className="p-2.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors relative cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95"
        title={`Status koneksi: ${shortLabel}`}
        aria-label={accessibleLabel}
      >
        <Icon
          className={`w-5 h-5 shrink-0 ${
            isSyncing
              ? 'animate-spin text-blue-600 dark:text-blue-400'
              : needsActionCount > 0
              ? 'text-rose-600 dark:text-rose-400'
              : isOffline || isOfflineSession
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        />

        {/* Counter Badge for Pending Sync Data */}
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold bg-amber-500 text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-[var(--theme-card-bg)]">
            {pendingCount}
          </span>
        )}

        {/* Needs action dot indicator if no pending items but action needed */}
        {needsActionCount > 0 && pendingCount === 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[var(--theme-card-bg)] animate-pulse" />
        )}
      </button>

      {/* Compact Notification Panel */}
      {isPanelOpen && (
        <OfflineSyncPanel
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          syncStatus={syncStatus}
          onOpenQueueModal={handleOpenQueueModal}
        />
      )}

      {/* Detailed Queue Modal */}
      {isQueueModalOpen && (
        <OfflineSyncModal
          isOpen={isQueueModalOpen}
          onClose={() => setIsQueueModalOpen(false)}
          syncStatus={syncStatus}
        />
      )}
    </div>
  );
};
