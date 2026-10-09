import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { UserProfile } from '../../types';
import {
  GURU_PIKET_CORE_PERMISSIONS,
  APP_PERMISSION_ITEMS,
} from '../../config/permissions';
import {
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  AlertCircle,
  Check,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ApplyGuruDutyPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onApply: (userId: string, newPermissions: string[]) => Promise<void>;
}

export const ApplyGuruDutyPermissionsModal: React.FC<ApplyGuruDutyPermissionsModalProps> = ({
  isOpen,
  onClose,
  user,
  onApply,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user) return null;

  const currentPermissions = user.permissions || [];
  
  // Calculate what permissions will be added
  const missingCorePermissions = GURU_PIKET_CORE_PERMISSIONS.filter(
    (p) => !currentPermissions.includes(p) && !currentPermissions.includes('*')
  );

  // Union of current permissions + missing core permissions (preserving existing custom permissions)
  const targetPermissions = Array.from(new Set([...currentPermissions, ...GURU_PIKET_CORE_PERMISSIONS])).filter(
    (p) => p !== '*' // Ensure GURU never receives wildcard '*'
  );

  const getPermissionLabel = (permId: string): string => {
    const item = APP_PERMISSION_ITEMS.find((i) => i.id === permId);
    return item ? `${item.label} (${permId})` : permId;
  };

  const handleApply = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onApply(user.id, targetPermissions);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menerapkan hak akses piket guru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terapkan Hak Akses Piket Guru"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* User Card */}
        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{user.fullName}</span>
              <Badge variant="primary" size="sm">
                {user.role}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {user.loginId ? `ID Login: ${user.loginId}` : ''}
              {user.loginId && user.nip ? ' • ' : ''}
              {user.nip ? `NIP: ${user.nip}` : ''}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Izin Saat Ini
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {currentPermissions.length} Izin Aktif
            </span>
          </div>
        </div>

        {/* Notice */}
        <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Pratinjau Perubahan:</strong> Tindakan ini hanya memperbarui akun yang dipilih di bawah ini. Akun production lain tidak akan diubah secara otomatis.
          </div>
        </div>

        {/* Diff Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Hak Akses yang Akan Ditambahkan ({missingCorePermissions.length})</span>
          </h4>

          {missingCorePermissions.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {missingCorePermissions.map((perm) => (
                <div
                  key={perm}
                  className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{getPermissionLabel(perm)}</span>
                  </div>
                  <Badge variant="success" size="sm">
                    + Baru
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs text-center">
              Akun ini sudah memiliki seluruh hak akses standar Piket Guru.
            </div>
          )}

          {/* Retained permissions */}
          {currentPermissions.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Izin yang Sudah Dimiliki & Tetap Dipertahankan ({currentPermissions.length}):
              </span>
              <div className="flex flex-wrap gap-1">
                {currentPermissions.map((p) => (
                  <span
                    key={p}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleApply}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Terapkan Hak Akses Piket Guru
          </Button>
        </div>
      </div>
    </Modal>
  );
};
