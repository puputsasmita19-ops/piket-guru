import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { UserProfile } from '../../types';
import {
  FOUR_ADDITIONAL_PERMISSIONS,
  FOUR_ADDITIONAL_PERMISSION_IDS,
  AdditionalDutyPermissionItem,
} from '../../config/permissions';
import { UserService } from '../../services/auth/userService';
import { useAuth } from '../../contexts/AuthContext';
import { FirestoreService } from '../../services/firebase/firestoreService';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  UserX,
  UserCheck,
  Check,
  ArrowRight,
  Info,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface ManageAdditionalPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onApply?: (userId: string, newPermissions: string[]) => Promise<void>;
  onSuccess?: (message: string) => void;
}

export const ApplyGuruDutyPermissionsModal: React.FC<ManageAdditionalPermissionsModalProps> = ({
  isOpen,
  onClose,
  user,
  onApply,
  onSuccess,
}) => {
  const { currentUser, refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected permission IDs from the 4 additional items
  const [selectedPerms, setSelectedPerms] = useState<string[]>(FOUR_ADDITIONAL_PERMISSION_IDS);

  // Active action mode: 'APPLY' (Terapkan) vs 'REVOKE' (Nonaktifkan)
  const [actionMode, setActionMode] = useState<'APPLY' | 'REVOKE'>('APPLY');

  // Realtime fresh permissions from Firestore to prevent stale overwrites
  const [freshPermissions, setFreshPermissions] = useState<string[]>([]);
  const [freshLoading, setFreshLoading] = useState<boolean>(false);

  // Sync latest permissions from database when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setErrorMsg(null);
      setSelectedPerms(FOUR_ADDITIONAL_PERMISSION_IDS);
      setActionMode('APPLY');
      setFreshLoading(true);

      FirestoreService.getById<UserProfile>('users', user.id)
        .then((latestUser) => {
          if (latestUser && latestUser.permissions) {
            setFreshPermissions(latestUser.permissions);
          } else {
            setFreshPermissions(user.permissions || []);
          }
        })
        .catch(() => {
          setFreshPermissions(user.permissions || []);
        })
        .finally(() => {
          setFreshLoading(false);
        });
    }
  }, [isOpen, user]);

  const currentPermissions = user
    ? (freshPermissions.length > 0 || freshLoading
        ? freshPermissions
        : (user.permissions || []))
    : [];

  const hasWildcard = currentPermissions.includes('*');

  // Icons mapper for the 4 items
  const getPermissionIcon = (permId: string) => {
    switch (permId) {
      case 'student_tardy.view':
        return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'student_permits.view':
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'substitutions.view':
        return <UserX className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'visitors.view':
        return <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  // Toggle single item selection
  const handleTogglePerm = (permId: string) => {
    if (isSubmitting) return;
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Select all 4
  const handleSelectAll = () => {
    if (isSubmitting) return;
    setSelectedPerms([...FOUR_ADDITIONAL_PERMISSION_IDS]);
  };

  // Clear selection
  const handleClearSelection = () => {
    if (isSubmitting) return;
    setSelectedPerms([]);
  };

  // Calculations for DIFF & PREVIEW
  // 1. For APPLY:
  const itemsToAdd = useMemo(() => {
    return selectedPerms.filter((p) => !currentPermissions.includes(p));
  }, [selectedPerms, currentPermissions]);

  const permissionsAfterApply = useMemo(() => {
    return Array.from(new Set([...currentPermissions, ...selectedPerms]));
  }, [currentPermissions, selectedPerms]);

  // 2. For REVOKE:
  const itemsToRemove = useMemo(() => {
    return selectedPerms.filter((p) => currentPermissions.includes(p));
  }, [selectedPerms, currentPermissions]);

  const permissionsAfterRevoke = useMemo(() => {
    return currentPermissions.filter((p) => !selectedPerms.includes(p));
  }, [currentPermissions, selectedPerms]);

  // Active diff evaluation based on chosen actionMode
  const isNoChange = actionMode === 'APPLY'
    ? itemsToAdd.length === 0
    : itemsToRemove.length === 0 && !hasWildcard;

  const beforeCount = currentPermissions.length;
  const afterCount = actionMode === 'APPLY'
    ? permissionsAfterApply.length
    : permissionsAfterRevoke.length;

  const retainedCount = actionMode === 'APPLY'
    ? currentPermissions.length
    : permissionsAfterRevoke.length;

  // Execute Action
  const handleSubmitAction = async () => {
    if (!currentUser || !user) return;
    if (selectedPerms.length === 0) {
      setErrorMsg('Pilih minimal satu hak akses dari daftar untuk diproses.');
      return;
    }

    if (isNoChange) {
      setErrorMsg('Tidak ada perubahan: Hak akses terpilih sudah dalam status tersebut. Tidak ada data yang perlu ditulis ulang.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Use existing updateAdditionalPermissions service with backend admin verification and audit logging
      const res = await UserService.updateAdditionalPermissions(
        user.id,
        actionMode,
        selectedPerms,
        currentUser
      );

      if (!res.changed) {
        setErrorMsg('Tidak ada perubahan terdeteksi pada database. Hak akses tidak diubah.');
        setIsSubmitting(false);
        return;
      }

      // Sync active session if modifying own profile
      if (user.id === currentUser.id) {
        await refreshProfile();
      }

      // Also call legacy onApply prop if provided
      if (onApply) {
        await onApply(user.id, res.newPermissions);
      }

      // Trigger success callback
      const targetName = user.fullName;
      const permNamesMap: Record<string, string> = {
        'student_tardy.view': 'Siswa Terlambat',
        'student_permits.view': 'Izin Siswa & Gerbang',
        'substitutions.view': 'Guru Inval/Pengganti',
        'visitors.view': 'Buku Tamu Digital',
      };

      let successFeedback = '';
      if (actionMode === 'APPLY') {
        const addedNames = res.added.map((id) => permNamesMap[id] || id).join(', ');
        successFeedback = `Berhasil menerapkan ${res.added.length} hak akses tambahan (${addedNames}) untuk ${targetName}. Total izin: ${res.previousPermissions.length} -> ${res.newPermissions.length}. Izin langsung aktif di sesi pengguna.`;
      } else {
        const removedNames = res.removed.map((id) => permNamesMap[id] || id).join(', ');
        successFeedback = `Berhasil menonaktifkan ${res.removed.length} hak akses tambahan (${removedNames}) untuk ${targetName}. Total izin: ${res.previousPermissions.length} -> ${res.newPermissions.length}.${
          res.hasWildcard ? ' (Catatan: Akun memiliki wildcard *, akses efektif tetap penuh)' : ' Menu yang dicabut langsung hilang dari navigasi.'
        }`;
      }

      if (onSuccess) {
        onSuccess(successFeedback);
      }

      onClose();
    } catch (err: any) {
      // Retain choices on error, show explicit message
      setErrorMsg(err.message || 'Gagal memperbarui hak akses pengguna. Silakan periksa koneksi atau izin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Kelola 4 Hak Akses Tambahan"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block font-semibold">Gagal Memproses:</strong>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* User Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>{user.fullName}</span>
              <Badge variant="primary" size="sm">
                {user.role}
              </Badge>
              {hasWildcard && (
                <Badge variant="warning" size="sm">
                  Wildcard (*) Superadmin
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap font-mono">
              <span>ID Login: <strong>{user.loginId || '-'}</strong></span>
              {user.nip && <span>• NIP: {user.nip}</span>}
              {user.nuptk && <span>• NUPTK: {user.nuptk}</span>}
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Status Izin Database
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {currentPermissions.length} Izin Aktif Saat Ini
            </span>
          </div>
        </div>

        {/* Wildcard Info Note if user has * */}
        {hasWildcard && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Akun Wildcard (*):</strong> Akun ini memiliki izin wildcard <code>*</code> (Superadmin). Akun ini otomatis dapat membuka seluruh menu aplikasi. Menghapus permission spesifik tidak akan mencabut akses efektif pengguna karena wildcard <code>*</code> tetap aktif.
            </div>
          </div>
        )}

        {/* Checkbox Section for the 4 Permissions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Pilih Hak Akses Tambahan
              </h4>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {selectedPerms.length} dari 4 Dipilih
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={isSubmitting || selectedPerms.length === FOUR_ADDITIONAL_PERMISSIONS.length}
                leftIcon={<CheckSquare className="w-3.5 h-3.5 text-blue-600" />}
                className="text-xs py-1 px-2.5 h-auto"
              >
                Pilih Semua
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={isSubmitting || selectedPerms.length === 0}
                leftIcon={<Square className="w-3.5 h-3.5 text-slate-400" />}
                className="text-xs py-1 px-2.5 h-auto"
              >
                Batal Pilih
              </Button>
            </div>
          </div>

          {/* 4 Permissions List */}
          <div className="space-y-2">
            {FOUR_ADDITIONAL_PERMISSIONS.map((perm) => {
              const isSelected = selectedPerms.includes(perm.id);
              const isCurrentlyActive = currentPermissions.includes(perm.id);

              return (
                <div
                  key={perm.id}
                  onClick={() => handleTogglePerm(perm.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTogglePerm(perm.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isSubmitting}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                    />

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {getPermissionIcon(perm.id)}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {perm.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                          ({perm.id})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {perm.description}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge in database */}
                  <div className="shrink-0 text-right">
                    {isCurrentlyActive ? (
                      <Badge variant="success" size="sm">
                        <Check className="w-3 h-3 mr-1 inline" />
                        Aktif
                      </Badge>
                    ) : hasWildcard ? (
                      <Badge variant="warning" size="sm">
                        Aktif via Wildcard (*)
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Nonaktif
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Tabs & Mode Selector */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Pilih Tindakan Operasi:
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActionMode('APPLY')}
                disabled={isSubmitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  actionMode === 'APPLY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Terapkan Akses</span>
              </button>
              <button
                type="button"
                onClick={() => setActionMode('REVOKE')}
                disabled={isSubmitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  actionMode === 'REVOKE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>Nonaktifkan Akses</span>
              </button>
            </div>
          </div>

          {/* Diff & Preview Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Pratinjau Perubahan</span>
              </h5>

              <div className="text-xs font-mono font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span>{beforeCount} Izin</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className={afterCount > beforeCount ? 'text-emerald-600 font-bold' : afterCount < beforeCount ? 'text-rose-600 font-bold' : ''}>
                  {afterCount} Izin
                </span>
              </div>
            </div>

            {/* Target user recap */}
            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span>Pengguna sasaran:</span>
              <strong className="text-slate-900 dark:text-white">{user.fullName}</strong>
              <span>({user.role} • ID Login: {user.loginId || '-'})</span>
            </div>

            {/* Mode-specific preview details */}
            {actionMode === 'APPLY' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hak Akses yang Akan Ditambahkan ({itemsToAdd.length}):
                </div>

                {itemsToAdd.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {itemsToAdd.map((permId) => {
                      const item = FOUR_ADDITIONAL_PERMISSIONS.find((p) => p.id === permId);
                      return (
                        <div
                          key={permId}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold">{item?.name || permId}</span>
                          </div>
                          <Badge variant="success" size="sm">
                            + Ditambahkan
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                    Tidak ada perubahan: Seluruh hak akses terpilih sudah aktif pada akun ini.
                  </div>
                )}

                <div className="text-[11px] text-slate-500 pt-1">
                  Izin lain yang tetap dipertahankan: <strong>{retainedCount} izin</strong> (termasuk modul piket & hak akses bawaan role).
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hak Akses yang Akan Dicabut ({itemsToRemove.length}):
                </div>

                {itemsToRemove.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {itemsToRemove.map((permId) => {
                      const item = FOUR_ADDITIONAL_PERMISSIONS.find((p) => p.id === permId);
                      return (
                        <div
                          key={permId}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <MinusCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="font-semibold">{item?.name || permId}</span>
                          </div>
                          <Badge variant="danger" size="sm">
                            - Dicabut
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                    Tidak ada perubahan: Tidak ada hak akses terpilih yang sedang aktif pada akun ini.
                  </div>
                )}

                <div className="text-[11px] text-slate-500 pt-1">
                  Izin yang tetap dipertahankan: <strong>{retainedCount} izin</strong> (izin modul lain tidak terpengaruh).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>

          <div className="flex items-center gap-2">
            {actionMode === 'APPLY' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={isSubmitting || selectedPerms.length === 0 || isNoChange}
                onClick={handleSubmitAction}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isNoChange ? 'Tidak Ada Perubahan' : 'Terapkan Akses Terpilih'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isSubmitting}
                disabled={isSubmitting || selectedPerms.length === 0 || isNoChange}
                onClick={handleSubmitAction}
                leftIcon={<XCircle className="w-4 h-4" />}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isNoChange ? 'Tidak Ada Perubahan' : 'Nonaktifkan Akses Terpilih'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Also export as ManageAdditionalPermissionsModal
export const ManageAdditionalPermissionsModal = ApplyGuruDutyPermissionsModal;
