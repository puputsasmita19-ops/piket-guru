import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { authService } from '../../services/auth/authService';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Info,
  Layers,
} from 'lucide-react';

interface OrphanReservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshUsers?: () => void;
}

interface OrphanItem {
  loginId: string;
  userId: string;
  createdAt?: string;
  reason: string;
}

export const OrphanReservationsModal: React.FC<OrphanReservationsModalProps> = ({
  isOpen,
  onClose,
  onRefreshUsers,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<OrphanItem[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const scanOrphans = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await authService.getOrphanReservations();
      if (res.success) {
        setOrphans(res.orphans || []);
        setHasScanned(true);
        if (res.count === 0) {
          setSuccessMsg('Pemeriksaan selesai: Seluruh reservasi ID Login konsisten dengan akun aktif.');
        } else {
          setSuccessMsg(`Pemeriksaan selesai: Ditemukan ${res.count} reservasi ID Login yatim.`);
        }
      } else {
        setErrorMsg(res.error || 'Gagal memindai reservasi yatim.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memindai.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setHasScanned(false);
      setOrphans([]);
      setErrorMsg(null);
      setSuccessMsg(null);
      scanOrphans();
    }
  }, [isOpen]);

  const handleCleanReservation = async (loginId: string) => {
    setIsCleaning(loginId);
    setErrorMsg(null);
    try {
      const res = await authService.cleanOrphanReservation(loginId);
      if (res.success) {
        setSuccessMsg(res.message || `Reservasi '${loginId}' berhasil dibersihkan.`);
        setOrphans((prev) => prev.filter((o) => o.loginId !== loginId));
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setErrorMsg(res.error || `Gagal membersihkan reservasi '${loginId}'.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membersihkan reservasi.');
    } finally {
      setIsCleaning(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Periksa & Bersihkan Reservasi ID Login Yatim"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Pemeriksaan Lifecycle ID Login (CR-LIFECYCLE-LOGINID)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            Fitur ini melakukan pemeriksaan awal tanpa perubahan (dry-run). Reservasi ID hanya dapat dilepas jika dokumen profil pengguna terkait sudah tidak ada dan tidak ada akun lain yang memakai ID tersebut.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scan Status / Results */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Hasil Pemindaian Reservasi ({orphans.length} Yatim)
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              isLoading={isLoading}
              onClick={scanOrphans}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            >
              Pindai Ulang
            </Button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              <p>Memeriksa integritas reservasi ID Login terhadap database profil...</p>
            </div>
          ) : orphans.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {orphans.map((orphan) => (
                <div
                  key={orphan.loginId}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md text-xs">
                        {orphan.loginId}
                      </span>
                      <Badge variant="warning" size="sm">
                        Yatim / Tak Terpakai
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {orphan.reason}
                    </div>
                    {orphan.userId && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Bekas User ID: {orphan.userId}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs shrink-0"
                    isLoading={isCleaning === orphan.loginId}
                    disabled={isCleaning !== null}
                    onClick={() => handleCleanReservation(orphan.loginId)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Lepas Reservasi
                  </Button>
                </div>
              ))}
            </div>
          ) : hasScanned ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Semua Reservasi ID Bersih & Sinkron
              </p>
              <p className="text-[11px]">Tidak ada ID Login yang terkunci tanpa akun pemilik aktif.</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
