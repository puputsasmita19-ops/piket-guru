import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  Briefcase,
  Building2,
  Tag,
  History,
  Plus,
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { MasterDataService } from '../../services/firebase/masterDataService';
import { useAuth } from '../../contexts/AuthContext';
import {
  TeacherRecord,
  StaffRecord,
  StudentRecord,
  RoomRecord,
  IncidentCategoryRecord,
  AuditLogRecord,
} from '../../types/master.types';
import { StudentService } from '../../services/firebase/studentService';
import { UserRole } from '../../types';
import { ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

type MasterTab = 'teachers' | 'staff' | 'students' | 'rooms' | 'categories' | 'audit';

export const MasterDataTabs: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTab>('teachers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // States for Collections
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Modals state
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRecord | null>(null);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<IncidentCategoryRecord | null>(null);

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    collection: string;
    id: string;
    name: string;
  } | null>(null);

  // Initial Load & Realtime subscriptions
  useEffect(() => {
    MasterDataService.bootstrapIfEmpty().then(() => {
      setIsLoading(false);
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', (data) => {
      setTeachers(data);
    });
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', (data) => {
      setStaffList(data);
    });
    const unsubStudents = FirestoreService.subscribeToCollection<StudentRecord>('students', (data) => {
      setStudents(data);
    });
    const unsubRooms = FirestoreService.subscribeToCollection<RoomRecord>('rooms', (data) => {
      setRooms(data);
    });
    const unsubCats = FirestoreService.subscribeToCollection<IncidentCategoryRecord>('incidentCategories', (data) => {
      setCategories(data);
    });
    const unsubAudit = FirestoreService.subscribeToCollection<AuditLogRecord>('auditLogs', (data) => {
      setAuditLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });

    return () => {
      unsubTeachers();
      unsubStaff();
      unsubStudents();
      unsubRooms();
      unsubCats();
      unsubAudit();
    };
  }, []);

  // --- CRUD TEACHERS ---
  const handleSaveTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = editingTeacher ? editingTeacher.id : `tch-${Date.now()}`;
    const payload: TeacherRecord = {
      id,
      nip: formData.get('nip') as string,
      fullName: formData.get('fullName') as string,
      mataPelajaran: formData.get('mataPelajaran') as string,
      pangkatGolongan: formData.get('pangkatGolongan') as string,
      statusKepegawaian: formData.get('statusKepegawaian') as any,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      createdAt: editingTeacher ? editingTeacher.createdAt : new Date().toISOString(),
      createdBy: editingTeacher ? editingTeacher.createdBy : currentUser?.fullName || 'ADMIN',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'ADMIN',
    };

    await FirestoreService.setDocument('teachers', id, payload);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingTeacher ? 'UPDATE' : 'CREATE',
      module: 'TEACHERS',
      recordId: id,
      details: `${editingTeacher ? 'Memperbarui' : 'Menambahkan'} data guru: ${payload.fullName} (${payload.nip})`,
    });

    setIsTeacherModalOpen(false);
    setEditingTeacher(null);
  };

  // --- CRUD ROOMS ---
  const handleSaveRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = editingRoom ? editingRoom.id : `room-${Date.now()}`;
    const payload: RoomRecord = {
      id,
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      building: formData.get('building') as string,
      floor: Number(formData.get('floor')) || 1,
      capacity: Number(formData.get('capacity')) || 0,
      isActive: true,
      createdAt: editingRoom ? editingRoom.createdAt : new Date().toISOString(),
      createdBy: editingRoom ? editingRoom.createdBy : currentUser?.fullName || 'ADMIN',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'ADMIN',
    };

    await FirestoreService.setDocument('rooms', id, payload);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingRoom ? 'UPDATE' : 'CREATE',
      module: 'ROOMS',
      recordId: id,
      details: `${editingRoom ? 'Memperbarui' : 'Menambahkan'} ruangan/pos: ${payload.name} (${payload.code})`,
    });

    setIsRoomModalOpen(false);
    setEditingRoom(null);
  };

  // --- CRUD STAFF ---
  const handleSaveStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = editingStaff ? editingStaff.id : `stf-${Date.now()}`;
    const payload: StaffRecord = {
      id,
      nip: (formData.get('nip') as string) || '-',
      fullName: formData.get('fullName') as string,
      divisi: formData.get('divisi') as any,
      jabatan: formData.get('jabatan') as string,
      statusKepegawaian: formData.get('statusKepegawaian') as any,
      phone: (formData.get('phone') as string) || '-',
      createdAt: editingStaff ? editingStaff.createdAt : new Date().toISOString(),
      createdBy: editingStaff ? editingStaff.createdBy : currentUser?.fullName || 'ADMIN',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'ADMIN',
    };

    await FirestoreService.setDocument('staff', id, payload);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingStaff ? 'UPDATE' : 'CREATE',
      module: 'STAFF',
      recordId: id,
      details: `${editingStaff ? 'Memperbarui' : 'Menambahkan'} data staf: ${payload.fullName} (${payload.divisi})`,
    });

    setIsStaffModalOpen(false);
    setEditingStaff(null);
  };

  // --- CRUD STUDENTS ---
  const handleSaveStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = editingStudent ? editingStudent.id : `std-${Date.now()}`;
    const payload: StudentRecord = {
      id,
      nisn: (formData.get('nisn') as string) || '-',
      nama: formData.get('nama') as string,
      kelas: formData.get('kelas') as string,
      jenisKelamin: (formData.get('jenisKelamin') as 'L' | 'P') || 'L',
      noHpOrangTua: (formData.get('noHpOrangTua') as string) || '-',
      alamat: (formData.get('alamat') as string) || '',
      isActive: true,
      createdAt: editingStudent ? editingStudent.createdAt : new Date().toISOString(),
      createdBy: editingStudent ? editingStudent.createdBy : currentUser?.fullName || 'ADMIN',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'ADMIN',
    };

    await FirestoreService.setDocument('students', id, payload);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingStudent ? 'UPDATE' : 'CREATE',
      module: 'STUDENTS' as any,
      recordId: id,
      details: `${editingStudent ? 'Memperbarui' : 'Menambahkan'} data siswa: ${payload.nama} (${payload.kelas})`,
    });

    setIsStudentModalOpen(false);
    setEditingStudent(null);
  };

  // --- CRUD CATEGORIES ---
  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = editingCat ? editingCat.id : `cat-${Date.now()}`;
    const payload: IncidentCategoryRecord = {
      id,
      code: (formData.get('code') as string) || 'CAT',
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      severity: formData.get('severity') as any,
      isActive: true,
      createdAt: editingCat ? editingCat.createdAt : new Date().toISOString(),
      createdBy: editingCat ? editingCat.createdBy : currentUser?.fullName || 'ADMIN',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'ADMIN',
    };

    await FirestoreService.setDocument('incidentCategories', id, payload);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingCat ? 'UPDATE' : 'CREATE',
      module: 'INCIDENTS',
      recordId: id,
      details: `${editingCat ? 'Memperbarui' : 'Menambahkan'} kategori insiden: ${payload.name} (${payload.severity})`,
    });

    setIsCatModalOpen(false);
    setEditingCat(null);
  };

  // --- DELETE HANDLER ---
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { collection, id, name } = deleteConfirm;

    await FirestoreService.deleteDocument(collection, id);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'DELETE',
      module: collection.toUpperCase() as any,
      recordId: id,
      details: `Menghapus record ${collection}: ${name}`,
    });

    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Master Data & Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pengelolaan data referensi terpusat Firebase Firestore & Rekam Jejak Audit Sistem
          </p>
        </div>

        {activeTab === 'teachers' && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingTeacher(null);
              setIsTeacherModalOpen(true);
            }}
          >
            + Tambah Guru
          </Button>
        )}

        {activeTab === 'staff' && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingStaff(null);
              setIsStaffModalOpen(true);
            }}
          >
            + Tambah Staf
          </Button>
        )}

        {activeTab === 'students' && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingStudent(null);
              setIsStudentModalOpen(true);
            }}
          >
            + Tambah Siswa
          </Button>
        )}

        {activeTab === 'rooms' && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingRoom(null);
              setIsRoomModalOpen(true);
            }}
          >
            + Tambah Ruangan / Pos
          </Button>
        )}

        {activeTab === 'categories' && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingCat(null);
              setIsCatModalOpen(true);
            }}
          >
            + Tambah Kategori
          </Button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'teachers', label: 'Data Guru', icon: GraduationCap, count: teachers.length },
          { id: 'staff', label: 'Tenaga Kependidikan', icon: Briefcase, count: staffList.length },
          { id: 'students', label: 'Data Siswa', icon: Users, count: students.length },
          { id: 'rooms', label: 'Ruangan & Pos Piket', icon: Building2, count: rooms.length },
          { id: 'categories', label: 'Kategori Kejadian', icon: Tag, count: categories.length },
          { id: 'audit', label: 'Audit Log Sistem', icon: History, count: auditLogs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MasterTab);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-xs transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 rounded-t-xl'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari di data ${activeTab}...`}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TAB 1: TEACHERS */}
      {activeTab === 'teachers' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teachers
                .filter((t) => t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || t.nip.includes(searchQuery))
                .map((t) => (
                  <div key={t.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {t.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{t.fullName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          NIP. {t.nip} • {t.pangkatGolongan}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                          📚 Mapel: {t.mataPelajaran}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Badge variant="primary" size="sm">
                        {t.statusKepegawaian}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingTeacher(t);
                          setIsTeacherModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        onClick={() => setDeleteConfirm({ collection: 'teachers', id: t.id, name: t.fullName })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: STAFF */}
      {activeTab === 'staff' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {staffList
                .filter((s) => s.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((s) => (
                  <div key={s.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {s.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{s.fullName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          NIP. {s.nip} • {s.phone}
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                          💼 Divisi: {s.divisi} ({s.jabatan})
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Badge variant="neutral" size="sm">{s.statusKepegawaian}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingStaff(s);
                          setIsStaffModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        onClick={() => setDeleteConfirm({ collection: 'staff', id: s.id, name: s.fullName })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: STUDENTS */}
      {activeTab === 'students' && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {students
                .filter(
                  (st) =>
                    st.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    st.nisn.includes(searchQuery) ||
                    st.kelas.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((st) => (
                  <div
                    key={st.id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {st.nama.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{st.nama}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                            {st.kelas}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          NISN: {st.nisn} • Gender: {st.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          📞 No HP Ortu: {st.noHpOrangTua || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingStudent(st);
                          setIsStudentModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        onClick={() => setDeleteConfirm({ collection: 'students', id: st.id, name: st.nama })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              {students.length === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-3">
                  <p>Belum ada data siswa di database sekolah.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await StudentService.bootstrapIfEmpty();
                      const list = await StudentService.getAllStudents();
                      setStudents(list);
                    }}
                  >
                    Muat Data Siswa Awal (Seed)
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: ROOMS */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms
            .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.code.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((r) => (
              <Card key={r.id} hoverable>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                      {r.code}
                    </span>
                    <Badge variant="success" size="sm">Aktif</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{r.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {r.building} • Lantai {r.floor} (Kapasitas: {r.capacity || '-'} orang)
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setEditingRoom(r);
                        setIsRoomModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteConfirm({ collection: 'rooms', id: r.id, name: r.name })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* TAB 4: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    {c.code}
                  </span>
                  <Badge
                    variant={c.severity === 'KRITIS' ? 'danger' : c.severity === 'TINGGI' ? 'warning' : 'info'}
                    size="sm"
                  >
                    Tingkat: {c.severity}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{c.description}</p>
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEditingCat(c);
                      setIsCatModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    onClick={() => setDeleteConfirm({ collection: 'incidentCategories', id: c.id, name: c.name })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader
            title="Jejak Audit Aktivitas Sistem"
            subtitle="Pencatatan real-time aksi pengguna, perubahan data, dan keamanan"
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={log.action === 'DELETE' ? 'danger' : log.action === 'CREATE' ? 'success' : log.action === 'UPDATE' ? 'warning' : 'primary'}
                          size="sm"
                        >
                          {log.action}
                        </Badge>
                        <span className="font-bold text-slate-800 dark:text-slate-200">[{log.module}]</span>
                        <span className="text-slate-600 dark:text-slate-400">{log.details}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Oleh: <strong>{log.userName}</strong> ({ROLE_LABELS[log.role]})
                      </div>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {formatIndonesianDate(log.timestamp)} • {formatTime(log.timestamp)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400">Belum ada catatan audit log.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TEACHER MODAL (ADD / EDIT) */}
      <Modal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        title={editingTeacher ? 'Ubah Data Guru' : 'Tambah Guru Baru'}
      >
        <form onSubmit={handleSaveTeacher} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">NIP</label>
              <input
                required
                name="nip"
                defaultValue={editingTeacher?.nip}
                placeholder="18 digit NIP"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap & Gelar</label>
              <input
                required
                name="fullName"
                defaultValue={editingTeacher?.fullName}
                placeholder="Contoh: Siti Nurhaliza, S.Pd."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mata Pelajaran</label>
              <input
                required
                name="mataPelajaran"
                defaultValue={editingTeacher?.mataPelajaran}
                placeholder="Contoh: Matematika"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pangkat / Golongan</label>
              <input
                name="pangkatGolongan"
                defaultValue={editingTeacher?.pangkatGolongan || 'Penata Muda / IIIa'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
              <select
                name="statusKepegawaian"
                defaultValue={editingTeacher?.statusKepegawaian || 'PNS'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="PNS">PNS</option>
                <option value="PPPK">PPPK</option>
                <option value="GTT">GTT</option>
                <option value="HONORER">Honorer</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">No. WhatsApp / HP</label>
              <input
                name="phone"
                defaultValue={editingTeacher?.phone}
                placeholder="0812..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Sekolah</label>
            <input
              type="email"
              name="email"
              defaultValue={editingTeacher?.email}
              placeholder="nama@sekolah.sch.id"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsTeacherModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Data Guru
            </Button>
          </div>
        </form>
      </Modal>

      {/* ROOM MODAL */}
      <Modal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title={editingRoom ? 'Ubah Pos / Ruangan' : 'Tambah Pos / Ruangan'}
      >
        <form onSubmit={handleSaveRoom} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kode Lokasi</label>
              <input
                required
                name="code"
                defaultValue={editingRoom?.code}
                placeholder="Contoh: POS-UTAMA"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Area / Ruang</label>
              <input
                required
                name="name"
                defaultValue={editingRoom?.name}
                placeholder="Contoh: Gerbang Depan & Lobby"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gedung</label>
              <input
                name="building"
                defaultValue={editingRoom?.building || 'Gedung Utama'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lantai</label>
              <input
                type="number"
                name="floor"
                defaultValue={editingRoom?.floor || 1}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kapasitas</label>
              <input
                type="number"
                name="capacity"
                defaultValue={editingRoom?.capacity || 0}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRoomModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Ruangan
            </Button>
          </div>
        </form>
      </Modal>

      {/* STAFF MODAL */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={editingStaff ? 'Ubah Data Staf / Tenaga Kependidikan' : 'Tambah Tenaga Kependidikan'}
      >
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">NIP / No. Identitas</label>
              <input
                name="nip"
                defaultValue={editingStaff?.nip !== '-' ? editingStaff?.nip : ''}
                placeholder="NIP atau tanda (-)"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap & Gelar</label>
              <input
                required
                name="fullName"
                defaultValue={editingStaff?.fullName}
                placeholder="Contoh: Rahmat Santoso, S.Kom."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Divisi Kerja</label>
              <select
                name="divisi"
                defaultValue={editingStaff?.divisi || 'Tata Usaha'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="Tata Usaha">Tata Usaha</option>
                <option value="Keamanan/Satpam">Keamanan/Satpam</option>
                <option value="Kebersihan">Kebersihan</option>
                <option value="Sarpras">Sarpras</option>
                <option value="Perpustakaan">Perpustakaan</option>
                <option value="Laboratorium">Laboratorium</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jabatan / Tugas</label>
              <input
                required
                name="jabatan"
                defaultValue={editingStaff?.jabatan || 'Staf Tata Usaha'}
                placeholder="Contoh: Koordinator Keamanan"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status Kepegawaian</label>
              <select
                name="statusKepegawaian"
                defaultValue={editingStaff?.statusKepegawaian || 'PTT'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="PNS">PNS</option>
                <option value="PPPK">PPPK</option>
                <option value="PTT">PTT</option>
                <option value="HONORER">Honorer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">No. WhatsApp / HP</label>
              <input
                name="phone"
                defaultValue={editingStaff?.phone !== '-' ? editingStaff?.phone : ''}
                placeholder="0812..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsStaffModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Data Staf
            </Button>
          </div>
        </form>
      </Modal>

      {/* STUDENT MODAL */}
      <Modal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title={editingStudent ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">NISN Siswa</label>
              <input
                required
                name="nisn"
                defaultValue={editingStudent?.nisn}
                placeholder="10 digit NISN"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap Siswa</label>
              <input
                required
                name="nama"
                defaultValue={editingStudent?.nama}
                placeholder="Contoh: Muhammad Rizky Pratama"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kelas / Rombel</label>
              <input
                required
                name="kelas"
                defaultValue={editingStudent?.kelas || 'X MIPA 1'}
                placeholder="Contoh: X MIPA 1"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
              <select
                name="jenisKelamin"
                defaultValue={editingStudent?.jenisKelamin || 'L'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">No. HP Orang Tua / Wali</label>
              <input
                name="noHpOrangTua"
                defaultValue={editingStudent?.noHpOrangTua !== '-' ? editingStudent?.noHpOrangTua : ''}
                placeholder="0812..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alamat Rumah (Opsional)</label>
            <input
              name="alamat"
              defaultValue={editingStudent?.alamat}
              placeholder="Alamat domisili siswa..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsStudentModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Data Siswa
            </Button>
          </div>
        </form>
      </Modal>

      {/* CATEGORY MODAL */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCat ? 'Ubah Kategori Kejadian' : 'Tambah Kategori Kejadian'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kode Kategori</label>
              <input
                required
                name="code"
                defaultValue={editingCat?.code}
                placeholder="Contoh: CAT-DISIPLIN"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Kategori</label>
              <input
                required
                name="name"
                defaultValue={editingCat?.name}
                placeholder="Contoh: Pelanggaran Tata Tertib"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tingkat Keparahan (Severity)</label>
            <select
              name="severity"
              defaultValue={editingCat?.severity || 'SEDANG'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="RENDAH">RENDAH (Catatan Pembinaan Ringan)</option>
              <option value="SEDANG">SEDANG (Perlu Penanganan Piket & Guru BK)</option>
              <option value="TINGGI">TINGGI (Perlu Pemanggilan Orang Tua / Pimpinan)</option>
              <option value="KRITIS">KRITIS (Bahaya Fisik / Darurat Sekolah)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Uraian / Deskripsi</label>
            <textarea
              required
              rows={3}
              name="description"
              defaultValue={editingCat?.description}
              placeholder="Deskripsi jenis insiden dan cakupan kategori..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCatModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Konfirmasi Hapus Data"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Hapus {deleteConfirm?.name}?</h4>
            <p className="text-xs text-slate-500 mt-1">Tindakan ini tidak dapat dibatalkan dan akan dicatat di audit log.</p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
