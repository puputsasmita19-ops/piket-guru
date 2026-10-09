import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { UserProfile, UserRole } from '../../types';
import { ROLE_LABELS } from '../../config/constants';
import {
  APP_PERMISSION_ITEMS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  isPermissionItemChecked,
  togglePermissionItem,
} from '../../config/permissions';
import {
  User,
  Shield,
  KeyRound,
  Mail,
  Phone,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    loginId: string;
    nip?: string;
    nuptk?: string;
    fullName: string;
    role: UserRole;
    email: string;
    phone: string;
    initialPin?: string;
    permissions: string[];
    isActive: boolean;
  }) => Promise<void>;
  editingUser: UserProfile | null;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingUser,
}) => {
  const [loginId, setLoginId] = useState('');
  const [nip, setNip] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('GURU');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingUser) {
      setLoginId(editingUser.loginId || '');
      setNip(editingUser.nip || '');
      setNuptk(editingUser.nuptk || '');
      setFullName(editingUser.fullName);
      setRole(editingUser.role);
      setEmail(editingUser.email || '');
      setPhone(editingUser.phone || '');
      setPin('');
      setIsActive(editingUser.isActive !== false);
      setPermissions(editingUser.permissions || []);
      setErrorMsg(null);
    } else {
      setLoginId('');
      setNip('');
      setNuptk('');
      setFullName('');
      setRole('GURU');
      setEmail('');
      setPhone('');
      setPin('');
      setIsActive(true);
      setErrorMsg(null);
      applyDefaultPermissionsForRole('GURU');
    }
  }, [editingUser, isOpen]);

  const applyDefaultPermissionsForRole = (targetRole: UserRole) => {
    if (targetRole === 'ADMIN') {
      setPermissions(['*']);
    } else {
      const defaults = ROLE_PERMISSIONS[targetRole] || [];
      // Crucial: Filter out '*' so GURU and other non-admin roles never receive wildcard '*'
      setPermissions(defaults.filter((p) => p !== '*'));
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    applyDefaultPermissionsForRole(newRole);
  };

  const togglePermission = (id: string) => {
    setPermissions(togglePermissionItem(id, permissions, role));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) {
      setErrorMsg('ID Login / Kode Pegawai wajib diisi.');
      return;
    }
    if (!editingUser) {
      if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        setErrorMsg('PIN Keamanan baru harus tepat 6 digit angka numerik.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Ensure GURU never receives wildcard '*'
      const cleanPermissions = role === 'GURU' ? permissions.filter((p) => p !== '*') : permissions;

      await onSave({
        id: editingUser?.id,
        loginId: loginId.trim().toUpperCase(),
        nip: nip.trim(),
        nuptk: nuptk.trim(),
        fullName,
        role,
        email,
        phone,
        initialPin: !editingUser ? pin : undefined,
        permissions: cleanPermissions,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil pengguna.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingUser ? 'Ubah Profil & Hak Akses Pengguna' : 'Tambah Pengguna & Petugas Baru'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {errorMsg}
          </div>
        )}
        {/* Row 1: ID Login / Kode Pegawai (Wajib) & Nama Lengkap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>ID Login / Kode Pegawai <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Unik & Wajib</span>
            </label>
            <input
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toUpperCase())}
              placeholder="Contoh: ADMIN-001, GURU-001, STAFF-001"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Row 2: NIP (Opsional) & NUPTK (Opsional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>NIP (Nomor Induk Pegawai)</span>
              <span className="text-[10px] text-slate-400 font-normal">Opsional</span>
            </label>
            <input
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Contoh: 198503152010011002 (Kosongkan jika belum ada)"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>NUPTK</span>
              <span className="text-[10px] text-slate-400 font-normal">Opsional</span>
            </label>
            <input
              value={nuptk}
              onChange={(e) => setNuptk(e.target.value)}
              placeholder="Contoh: 1234567890123456 (Kosongkan jika belum ada)"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Row 2: Peran / Role & PIN Awal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Peran Utama (Role RBAC)
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="ADMIN">{ROLE_LABELS.ADMIN} (Hak Penuh)</option>
              <option value="KEPALA_SEKOLAH">{ROLE_LABELS.KEPALA_SEKOLAH} (Executive / Approval)</option>
              <option value="GURU">{ROLE_LABELS.GURU} (Petugas Piket Utama)</option>
              <option value="TENAGA_KEPENDIDIKAN">{ROLE_LABELS.TENAGA_KEPENDIDIKAN} (Tata Usaha / Pendukung)</option>
              <option value="SATPAM">{ROLE_LABELS.SATPAM} (Keamanan Gerbang)</option>
            </select>
          </div>

          {!editingUser ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                PIN Awal (6 Digit)
              </label>
              <input
                type="password"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-center tracking-widest"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Status Akun
              </label>
              <select
                value={isActive ? 'AKTIF' : 'NONAKTIF'}
                onChange={(e) => setIsActive(e.target.value === 'AKTIF')}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                <option value="AKTIF">🟢 Akun Aktif (Dapat Login)</option>
                <option value="NONAKTIF">🔴 Akun Nonaktif (Dibekukan)</option>
              </select>
            </div>
          )}
        </div>

        {/* Row 3: Email & WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Alamat Email Sekolah
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sekolah.sch.id"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No. WhatsApp / HP
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
        </div>

        {/* GRANULAR PERMISSIONS */}
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-500" />
              <span>Hak Akses & Izin Spesifik ({permissions.length} Aktif)</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600"
              onClick={() => applyDefaultPermissionsForRole(role)}
            >
              Set Standar Role
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            {APP_PERMISSION_ITEMS.map((perm) => {
              const isChecked = isPermissionItemChecked(perm.id, permissions);
              return (
                <button
                  type="button"
                  key={perm.id}
                  onClick={() => togglePermission(perm.id)}
                  className={`p-2.5 rounded-xl text-left text-xs transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-bold border border-blue-200 dark:border-blue-900'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {perm.category}
                      </span>
                      <span>{perm.label}</span>
                    </div>
                    {perm.description && (
                      <p className="text-[10px] text-slate-500 font-normal leading-tight">
                        {perm.description}
                      </p>
                    )}
                  </div>
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {editingUser ? 'Simpan Perubahan Pengguna' : 'Daftarkan Pengguna Baru'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
