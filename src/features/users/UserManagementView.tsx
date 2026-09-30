import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { UserFormModal } from './UserFormModal';
import { ResetPinModal } from './ResetPinModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { UserService } from '../../services/auth/userService';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, UserRole } from '../../types';
import { ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const UserManagementView: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('SEMUA');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [targetPinUser, setTargetPinUser] = useState<UserProfile | null>(null);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    UserService.bootstrapIfEmpty();

    const unsub = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {
      setUsers(data);
    });

    return () => unsub();
  }, []);

  // Save User
  const handleSaveUser = async (data: {
    id?: string;
    nip: string;
    fullName: string;
    role: UserRole;
    email: string;
    phone: string;
    pin?: string;
    permissions: string[];
    isActive: boolean;
  }) => {
    if (!currentUser) return;

    if (data.id) {
      await UserService.updateUser(data.id, data, currentUser);
    } else {
      await UserService.createUser(data, currentUser);
    }
  };

  // Reset PIN
  const handleResetPin = async (userId: string, newPin: string) => {
    if (!currentUser) return;
    await UserService.resetPin(userId, newPin, currentUser);
  };

  // Toggle Active Status
  const handleToggleStatus = async (user: UserProfile) => {
    if (!currentUser) return;
    if (user.id === currentUser.id) {
      setActionError('Anda tidak dapat menonaktifkan akun yang sedang digunakan saat ini.');
      setTimeout(() => setActionError(null), 5000);
      return;
    }
    setActionError(null);
    const newStatus = !user.isActive;
    await UserService.toggleActiveStatus(user.id, newStatus, currentUser);
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser || !currentUser) return;
    if (deleteConfirmUser.id === currentUser.id) {
      setActionError('Anda tidak dapat menghapus akun Anda sendiri.');
      setTimeout(() => setActionError(null), 5000);
      setDeleteConfirmUser(null);
      return;
    }
    setActionError(null);
    await UserService.deleteUser(deleteConfirmUser.id, currentUser);
    setDeleteConfirmUser(null);
  };

  // Summary Metrics
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const teacherCount = users.filter((u) => u.role === 'GURU').length;
  const staffCount = users.filter((u) => u.role === 'TENAGA_KEPENDIDIKAN' || u.role === 'SATPAM' || u.role === 'KEPALA_SEKOLAH').length;
  const inactiveCount = users.filter((u) => u.isActive === false).length;

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'SEMUA' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'SEMUA' ||
      (statusFilter === 'AKTIF' && u.isActive !== false) ||
      (statusFilter === 'NONAKTIF' && u.isActive === false);
    const matchSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nip.includes(searchQuery) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchRole && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Akun Pengguna</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{totalUsers} Akun</div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">Terdaftar di Database</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Guru Pengajar</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">{teacherCount} Guru</div>
            <div className="text-[11px] text-emerald-500 font-medium mt-1">Petugas Piket Terjadwal</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tendik & Keamanan</span>
            <div className="text-xl font-bold text-purple-600 mt-1">{staffCount} Akun</div>
            <div className="text-[11px] text-purple-500 font-medium mt-1">Staff / Satpam / Kepsek</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Administrator</span>
            <div className="text-xl font-bold text-rose-600 mt-1">{adminCount} Akun</div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">Hak Akses Penuh Sistem</div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIP, atau email..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Role</option>
                <option value="ADMIN">ADMIN</option>
                <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH</option>
                <option value="GURU">GURU</option>
                <option value="TENAGA_KEPENDIDIKAN">TENAGA KEPENDIDIKAN</option>
                <option value="SATPAM">SATPAM</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="AKTIF">Hanya Aktif</option>
                <option value="NONAKTIF">Hanya Nonaktif</option>
              </select>

              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  onClick={() => {
                    setEditingUser(null);
                    setIsFormModalOpen(true);
                  }}
                >
                  + Tambah Pengguna
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* USERS LIST */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-4">Pengguna</th>
                <th className="p-4">Peran / Role</th>
                <th className="p-4">Kontak</th>
                <th className="p-4">Izin Akses</th>
                <th className="p-4 text-center">Status</th>
                {isAdmin && <th className="p-4 text-right">Aksi Manajemen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((user) => {
                const isActive = user.isActive !== false;
                const isCurrentSelf = user.id === currentUser?.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {user.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{user.fullName}</span>
                            {isCurrentSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded font-extrabold">
                                (Saya)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            NIP. {user.nip}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={
                          user.role === 'ADMIN'
                            ? 'danger'
                            : user.role === 'KEPALA_SEKOLAH'
                            ? 'warning'
                            : user.role === 'GURU'
                            ? 'primary'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </td>

                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{user.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono">{user.phone || '-'}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        {user.permissions?.length || 0} Izin Aktif
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user)}
                        disabled={!isAdmin || isCurrentSelf}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        } ${isAdmin && !isCurrentSelf ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        title={isAdmin ? 'Klik untuk toggle status aktif' : ''}
                      >
                        {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>

                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                            onClick={() => {
                              setTargetPinUser(user);
                              setIsResetPinOpen(true);
                            }}
                          >
                            Reset PIN
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setEditingUser(user);
                              setIsFormModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {!isCurrentSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => setDeleteConfirmUser(user)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* USER FORM MODAL */}
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />

      {/* RESET PIN MODAL */}
      <ResetPinModal
        isOpen={isResetPinOpen}
        onClose={() => {
          setIsResetPinOpen(false);
          setTargetPinUser(null);
        }}
        user={targetPinUser}
        onReset={handleResetPin}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        title="Konfirmasi Hapus Pengguna"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Akun {deleteConfirmUser?.fullName}?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Pengguna ini tidak akan dapat login lagi ke sistem piket sekolah.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmUser(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteUser}>
              Ya, Hapus Akun
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
