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
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Hash,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { UserFormModal } from './UserFormModal';
import { StudentFormModal } from './StudentFormModal';
import { ResetPinModal } from './ResetPinModal';
import { BulkImportModal } from '../master/BulkImportModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { UserService } from '../../services/auth/userService';
import { StudentService } from '../../services/firebase/studentService';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile, UserRole } from '../../types';
import { StudentRecord } from '../../types/master.types';
import { ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate } from '../../utils/dateUtils';

type UserCategoryTab = 'GURU' | 'SISWA';

export const UserManagementView: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  // Active Category: Guru & Tendik vs Siswa
  const [activeCategory, setActiveCategory] = useState<UserCategoryTab>('GURU');

  // Teachers / Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('SEMUA');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');

  // Students state
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('SEMUA');
  const [genderFilter, setGenderFilter] = useState<string>('SEMUA');
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>('SEMUA');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(15); // 10, 15, 20, 50, 0 (Semua)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals for User (Guru/Tendik)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportDefaultType, setBulkImportDefaultType] = useState<'USERS_TEACHERS' | 'STUDENTS'>('USERS_TEACHERS');
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [targetPinUser, setTargetPinUser] = useState<UserProfile | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals for Siswa
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    UserService.bootstrapIfEmpty();
    StudentService.bootstrapIfEmpty();

    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {
      setUsers(data);
    });

    const unsubStudents = FirestoreService.subscribeToCollection<StudentRecord>('students', (data) => {
      setStudents(data);
    });

    return () => {
      unsubUsers();
      unsubStudents();
    };
  }, []);

  // Reset page when category, filters, or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, roleFilter, statusFilter, studentSearch, classFilter, genderFilter, studentStatusFilter, pageSize]);

  // Save User (Guru / Tendik)
  const handleSaveUser = async (data: {
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
  }) => {
    if (!currentUser) return;
    if (data.id) {
      await UserService.updateUser(data.id, data, currentUser);
    } else {
      await UserService.createUser(data, currentUser);
    }
  };

  // Reset PIN User
  const handleResetPin = async (userId: string, newPin: string) => {
    if (!currentUser) return;
    await UserService.resetPin(userId, newPin, currentUser);
  };

  // Toggle Active Status User
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

  // Save Student (Siswa)
  const handleSaveStudent = async (data: {
    id?: string;
    nisn: string;
    nama: string;
    kelas: string;
    jenisKelamin: 'L' | 'P';
    noHpOrangTua: string;
    alamat?: string;
    isActive: boolean;
  }) => {
    if (!currentUser) return;
    const studentId = data.id || `std-${Date.now()}`;
    const studentRecord: StudentRecord = {
      id: studentId,
      nisn: data.nisn,
      nama: data.nama,
      kelas: data.kelas,
      jenisKelamin: data.jenisKelamin,
      noHpOrangTua: data.noHpOrangTua,
      alamat: data.alamat,
      isActive: data.isActive,
      createdAt: data.id
        ? students.find((s) => s.id === data.id)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      createdBy: currentUser.fullName,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    };

    await StudentService.saveStudent(studentRecord);
    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: data.id ? 'UPDATE' : 'CREATE',
      module: 'USERS',
      recordId: studentId,
      details: `${data.id ? 'Memperbarui' : 'Menambahkan'} data siswa ${data.nama} (Kelas ${data.kelas})`,
    });
  };

  // Toggle Active Status Student
  const handleToggleStudentStatus = async (st: StudentRecord) => {
    if (!currentUser || !isAdmin) return;
    const updated: StudentRecord = {
      ...st,
      isActive: st.isActive === false,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    };
    await StudentService.saveStudent(updated);
  };

  // Delete Student
  const handleDeleteStudent = async () => {
    if (!deleteConfirmStudent || !currentUser || !isAdmin) return;
    await StudentService.deleteStudent(deleteConfirmStudent.id);
    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: 'DELETE',
      module: 'USERS',
      recordId: deleteConfirmStudent.id,
      details: `Menghapus siswa ${deleteConfirmStudent.nama} (NISN: ${deleteConfirmStudent.nisn})`,
    });
    setDeleteConfirmStudent(null);
  };

  // Metrics
  const totalUsers = users.length;
  const teacherCount = users.filter((u) => u.role === 'GURU').length;
  const staffCount = users.filter((u) => u.role === 'TENAGA_KEPENDIDIKAN' || u.role === 'SATPAM' || u.role === 'KEPALA_SEKOLAH').length;
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.isActive !== false).length;

  // Filtered Users (Guru / Tendik)
  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilter === 'SEMUA' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'SEMUA' ||
      (statusFilter === 'AKTIF' && u.isActive !== false) ||
      (statusFilter === 'NONAKTIF' && u.isActive === false);
    const matchSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.loginId && u.loginId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.nip && u.nip.includes(searchQuery)) ||
      (u.nuptk && u.nuptk.includes(searchQuery)) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchRole && matchStatus && matchSearch;
  });

  // Filtered Students (Siswa)
  const filteredStudents = students.filter((s) => {
    const matchClass = classFilter === 'SEMUA' || s.kelas.toLowerCase().includes(classFilter.toLowerCase());
    const matchGender = genderFilter === 'SEMUA' || s.jenisKelamin === genderFilter;
    const matchStatus =
      studentStatusFilter === 'SEMUA' ||
      (studentStatusFilter === 'AKTIF' && s.isActive !== false) ||
      (studentStatusFilter === 'NONAKTIF' && s.isActive === false);
    const matchSearch =
      s.nama.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.nisn.includes(studentSearch) ||
      s.kelas.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.noHpOrangTua && s.noHpOrangTua.includes(studentSearch));

    return matchClass && matchGender && matchStatus && matchSearch;
  });

  // Extract unique classes for filter
  const uniqueClasses = Array.from(new Set(students.map((s) => s.kelas))).filter(Boolean).sort();

  // Pagination calculation
  const isGuru = activeCategory === 'GURU';
  const currentDatasetLength = isGuru ? filteredUsers.length : filteredStudents.length;
  const effectivePageSize = pageSize === 0 ? currentDatasetLength || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(currentDatasetLength / effectivePageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * effectivePageSize;
  const paginatedUsers = pageSize === 0 ? filteredUsers : filteredUsers.slice(startIndex, startIndex + effectivePageSize);
  const paginatedStudents = pageSize === 0 ? filteredStudents : filteredStudents.slice(startIndex, startIndex + effectivePageSize);

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

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={`transition-all ${activeCategory === 'GURU' ? 'ring-2 ring-blue-500/30' : ''}`}>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Golongan Guru & Tendik</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{totalUsers} Akun</div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">
              {teacherCount} Guru • {staffCount} Tendik/Staff
            </div>
          </CardContent>
        </Card>

        <Card className={`transition-all ${activeCategory === 'SISWA' ? 'ring-2 ring-emerald-500/30' : ''}`}>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Golongan Siswa</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">{totalStudents} Siswa</div>
            <div className="text-[11px] text-emerald-500 font-medium mt-1">
              {activeStudents} Siswa Berstatus Aktif
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kelas Terdaftar</span>
            <div className="text-xl font-bold text-purple-600 mt-1">{uniqueClasses.length} Rombel</div>
            <div className="text-[11px] text-purple-500 font-medium mt-1">Tingkat X, XI, XII</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Model Tampilan</span>
            <div className="text-xl font-bold text-amber-600 mt-1">{pageSize === 0 ? 'Semua' : `${pageSize} / Hal`}</div>
            <div className="text-[11px] text-amber-500 font-medium mt-1">Scroll & Halaman Ergonomis</div>
          </CardContent>
        </Card>
      </div>

      {/* ERGONOMIC CATEGORY SELECTOR TABS (GURU VS SISWA) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveCategory('GURU')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeCategory === 'GURU'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Golongan Guru & Tenaga Pendidik</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold">
            {totalUsers}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('SISWA')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeCategory === 'SISWA'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Golongan Siswa</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">
            {totalStudents}
          </span>
        </button>
      </div>

      {/* SEARCH, FILTERS, AND ACTIONS BAR */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={isGuru ? searchQuery : studentSearch}
                onChange={(e) => (isGuru ? setSearchQuery(e.target.value) : setStudentSearch(e.target.value))}
                placeholder={isGuru ? 'Cari nama guru, NIP, atau email...' : 'Cari nama siswa, NISN, atau kelas...'}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Filters based on Category */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
              {isGuru ? (
                <>
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
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                        onClick={() => {
                          setBulkImportDefaultType('USERS_TEACHERS');
                          setIsBulkImportOpen(true);
                        }}
                      >
                        Import (.CSV)
                      </Button>
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
                    </>
                  )}
                </>
              ) : (
                <>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                  >
                    <option value="SEMUA">Semua Kelas</option>
                    {uniqueClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>

                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                  >
                    <option value="SEMUA">Semua Gender</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>

                  <select
                    value={studentStatusFilter}
                    onChange={(e) => setStudentStatusFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                  >
                    <option value="SEMUA">Semua Status</option>
                    <option value="AKTIF">Hanya Aktif</option>
                    <option value="NONAKTIF">Hanya Nonaktif</option>
                  </select>

                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                        onClick={() => {
                          setBulkImportDefaultType('STUDENTS');
                          setIsBulkImportOpen(true);
                        }}
                      >
                        Import (.CSV)
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<UserPlus className="w-4 h-4" />}
                        onClick={() => {
                          setEditingStudent(null);
                          setIsStudentModalOpen(true);
                        }}
                      >
                        + Tambah Siswa
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLE WITH SCROLL MODEL & STICKY HEADER */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto scrollbar-thin">
            {isGuru ? (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold shadow-xs">
                  <tr>
                    <th className="p-4">Pengguna & Identitas</th>
                    <th className="p-4">Peran / Role</th>
                    <th className="p-4">Kontak</th>
                    <th className="p-4">Izin Akses</th>
                    <th className="p-4 text-center">Status</th>
                    {isAdmin && <th className="p-4 text-right">Aksi Manajemen</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedUsers.map((user) => {
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
                              <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {user.loginId ? (
                                  <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                                    ID: {user.loginId}
                                  </span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 italic">ID Belum Diatur</span>
                                )}
                                {user.nip ? <span>• NIP: {user.nip}</span> : null}
                                {user.nuptk ? <span>• NUPTK: {user.nuptk}</span> : null}
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
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Tidak ada data akun guru/pengguna yang cocok dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold shadow-xs">
                  <tr>
                    <th className="p-4">Nama Siswa & NISN</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4">L/P</th>
                    <th className="p-4">Kontak Orang Tua / Wali</th>
                    <th className="p-4">Alamat Domisili</th>
                    <th className="p-4 text-center">Status</th>
                    {isAdmin && <th className="p-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedStudents.map((st) => {
                    const isActive = st.isActive !== false;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {st.nama.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {st.nama}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                NISN. {st.nisn}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-900/60">
                            {st.kelas}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.jenisKelamin === 'L' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300'
                          }`}>
                            {st.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </td>

                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-mono font-bold">{st.noHpOrangTua || '-'}</span>
                          </div>
                        </td>

                        <td className="p-4 text-slate-600 dark:text-slate-300 text-[11px] max-w-xs truncate">
                          {st.alamat || '-'}
                        </td>

                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStudentStatus(st)}
                            disabled={!isAdmin}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        </td>

                        {isAdmin && (
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setEditingStudent(st);
                                  setIsStudentModalOpen(true);
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-rose-600 hover:bg-rose-50"
                                onClick={() => setDeleteConfirmStudent(st)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {paginatedStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Tidak ada data siswa yang cocok dengan filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* ERGONOMIC PAGINATION AND PAGE SIZE BAR */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
            {/* Info Items */}
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {currentDatasetLength > 0 ? (
                <>
                  Menampilkan{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {startIndex + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(startIndex + effectivePageSize, currentDatasetLength)}
                  </strong>{' '}
                  dari{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {currentDatasetLength}
                  </strong>{' '}
                  {isGuru ? 'pengguna' : 'siswa'} (Hal. {validCurrentPage} dari {totalPages})
                </>
              ) : (
                'Tidak ada data untuk ditampilkan'
              )}
            </div>

            {/* Page Navigation & Page Size Selector */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Tampilkan:</span>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg">
                  {[10, 15, 20, 50, 0].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setPageSize(sz)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        pageSize === sz
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sz === 0 ? 'Semua' : sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prev & Next Pagination Buttons */}
              {pageSize !== 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={validCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      // Display first, last, and window around current
                      if (
                        totalPages <= 7 ||
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - validCurrentPage) <= 1
                      ) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              validCurrentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === validCurrentPage - 2 ||
                        pageNum === validCurrentPage + 2
                      ) {
                        return (
                          <span key={pageNum} className="text-slate-400 px-1 text-xs">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={validCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
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

      {/* STUDENT FORM MODAL */}
      <StudentFormModal
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveStudent}
        editingStudent={editingStudent}
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

      {/* DELETE CONFIRM USER MODAL */}
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

      {/* DELETE CONFIRM STUDENT MODAL */}
      <Modal
        isOpen={!!deleteConfirmStudent}
        onClose={() => setDeleteConfirmStudent(null)}
        title="Konfirmasi Hapus Data Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Data Siswa {deleteConfirmStudent?.nama}?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              NISN: {deleteConfirmStudent?.nisn} • Kelas: {deleteConfirmStudent?.kelas}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmStudent(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteStudent}>
              Ya, Hapus Siswa
            </Button>
          </div>
        </div>
      </Modal>

      {/* BULK IMPORT MODAL */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        defaultType={bulkImportDefaultType}
      />
    </div>
  );
};
