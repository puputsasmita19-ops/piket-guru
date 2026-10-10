import React from 'react';
import { AlertTriangle, ShieldAlert, LogOut, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UnsavedOfflineWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCount: number;
  draftsCount: number;
  onConfirmLogout: (purgeUserData: boolean) => Promise<void>;
}

export const UnsavedOfflineWarningModal: React.FC<UnsavedOfflineWarningModalProps> = ({
  isOpen,
  onClose,
  pendingCount,
  draftsCount,
  onConfirmLogout,
}) => {
  const { isTrustedDevice } = useAuth();

  if (!isOpen) return null;

  const totalUnsaved = pendingCount + draftsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white dark:bg-[var(--theme-card-bg)] rounded-3xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] overflow-hidden p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Perhatian: Data Belum Terkirim
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Terdapat <strong className="text-amber-600 dark:text-amber-400">{totalUnsaved} data</strong> (
              {pendingCount > 0 ? `${pendingCount} antrean kirim` : ''}
              {pendingCount > 0 && draftsCount > 0 ? ' & ' : ''}
              {draftsCount > 0 ? `${draftsCount} draf formulir` : ''}
              ) yang masih tersimpan secara lokal pada perangkat ini.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200 dark:border-[var(--theme-card-border)] text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Peringatan Perangkat Bersama</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Jika ini adalah komputer/gawai bersama di ruang piket, data yang belum terkirim dapat dibersihkan demi privasi, atau disimpan jika ini adalah perangkat pribadi Anda.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Batal Keluar (Periksa / Kirim Data Dulu)
          </button>

          <button
            type="button"
            onClick={() => onConfirmLogout(false)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Tetap Keluar & Simpan di Perangkat Ini</span>
          </button>

          <button
            type="button"
            onClick={() => onConfirmLogout(true)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            Hapus Data Lokal & Keluar Sekarang
          </button>
        </div>
      </div>
    </div>
  );
};
