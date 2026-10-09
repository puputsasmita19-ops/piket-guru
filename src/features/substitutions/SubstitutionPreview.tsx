import React, { useState, useEffect } from 'react';
import {
  UserX,
  Plus,
  Search,
  Filter,
  Clock,
  Printer,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Download,
  BookOpen,
  GraduationCap,
  UserCheck,
  AlertTriangle,
  Edit2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { SubstitutionFormModal } from './SubstitutionFormModal';
import { SubstitutionPrintModal } from './SubstitutionPrintModal';
import {
  TeacherSubstitutionRecord,
  SubstitutionStatus,
  getSubstitutionReasonDisplay,
} from '../../types/substitution.types';
import { TeacherRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SubstitutionService } from '../../services/firebase/substitutionService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const SubstitutionPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const canEdit = Boolean(
    currentUser?.role &&
      ['ADMIN', 'SUPER_ADMIN', 'PETUGAS_PIKET', 'GURU', 'STAFF', 'KEPALA_SEKOLAH'].includes(currentUser.role)
  );

  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSubstitution, setEditingSubstitution] = useState<TeacherSubstitutionRecord | null>(null);
  const [printSub, setPrintSub] = useState<TeacherSubstitutionRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeacherSubstitutionRecord | null>(null);

  // WhatsApp Modal
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: '',
  });

  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    SubstitutionService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSub = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', (data) => {
      setSubstitutions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>(
      'teachers',
      (data) => {
        setTeachers(data);
        setIsLoadingTeachers(false);
        setTeachersError(null);
      },
      (err) => {
        console.warn('Error subscribing to teachers:', err);
        setTeachersError(err.message || 'Gagal memuat data guru dari server.');
        setIsLoadingTeachers(false);
      }
    );

    return () => {
      unsubSub();
      unsubTeachers();
    };
  }, []);

  // Create or Update Substitution
  const handleSaveSubstitution = async (data: any, isEdit?: boolean) => {
    if (!currentUser) return;
    if (isEdit && data.id) {
      await SubstitutionService.updateSubstitution(data, currentUser);
    } else {
      await SubstitutionService.createSubstitution(data, currentUser);
    }
  };

  // Quick Status Update
  const handleUpdateStatus = async (item: TeacherSubstitutionRecord, newStatus: SubstitutionStatus) => {
    if (!currentUser) return;
    await SubstitutionService.updateStatus(item.id, newStatus, undefined, undefined, currentUser);
  };

  // Delete Substitution
  const handleDeleteSubstitution = async () => {
    if (!deleteConfirm || !currentUser) return;
    await SubstitutionService.deleteSubstitution(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
  };

  // Send WhatsApp to Assigned Substitute Teacher
  const handleSendWaToSubstitute = (item: TeacherSubstitutionRecord) => {
    const subTeacher = teachers.find((t) => t.fullName === item.guruPenggantiName || t.id === item.guruPenggantiId);
    const msg = `*PENUGASAN GURU PENGGANTI (INVAL)*
*${settings.schoolName}*

Yth. Bapak/Ibu *${item.guruPenggantiName}*,

Diberitahukan bahwa Anda ditugaskan sebagai *Guru Pengganti (Inval)* pada hari ini:
📅 *Tanggal:* ${formatIndonesianDate(item.tanggal)}
🏫 *Kelas:* ${item.kelas}
⏰ *Waktu:* ${item.jamPelajaran}
📚 *Mapel:* ${item.mataPelajaran}
👤 *Menggantikan:* ${item.guruBerhalanganName} (${getSubstitutionReasonDisplay(item)})

📝 *Materi & Tugas Siswa:*
${item.materiDanTugasSiswa}

Mohon dapat mendampingi pembelajaran siswa di kelas. Terima kasih atas kerja samanya. 🙏`;

    setWaModalData({
      isOpen: true,
      phone: subTeacher?.phone || '',
      message: msg,
      title: `Kirim Notifikasi Inval ke ${item.guruPenggantiName}`,
    });
  };

  // Send WhatsApp to Class Captain / Representative
  const handleSendWaToClass = (item: TeacherSubstitutionRecord) => {
    const msg = `*INFORMASI TUGAS KELAS DARI TIM PIKET*
*${settings.schoolName}*

Kepada Ketua / Pengurus Kelas *${item.kelas}*,

Diberitahukan bahwa Bapak/Ibu *${item.guruBerhalanganName}* (${item.mataPelajaran}) hari ini berhalangan hadir.
🧑‍🏫 *Guru Pengganti / Inval:* ${item.guruPenggantiName || 'Dalam koordinasi Tim Piket'}
⏰ *Jam Pelajaran:* ${item.jamPelajaran}

📝 *Instruksi Tugas Mandiri:*
${item.materiDanTugasSiswa}

Harap seluruh siswa tetap tertib dan mengerjakan tugas dengan sungguh-sungguh di dalam kelas. Terima kasih.`;

    setWaModalData({
      isOpen: true,
      phone: '',
      message: msg,
      title: `Kirim Instruksi Tugas ke Kelas ${item.kelas}`,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Tanggal', 'Guru Berhalangan', 'Mapel', 'Alasan', 'Kelas', 'Jam Pelajaran', 'Guru Pengganti', 'Status', 'Tugas Siswa', 'Petugas Piket'];
    const rows = filteredSubs.map((s) => [
      s.tanggal,
      s.guruBerhalanganName,
      s.mataPelajaran,
      getSubstitutionReasonDisplay(s),
      s.kelas,
      s.jamPelajaran,
      s.guruPenggantiName || 'Belum Ditugaskan',
      s.status,
      s.materiDanTugasSiswa,
      s.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Guru_Inval_Pengganti_${Date.now()}`, headers, rows);
  };

  // Metrics
  const todaySubs = substitutions.filter((s) => s.tanggal === todayISO);
  const pendingSubs = todaySubs.filter((s) => s.status === 'MENUNGGU_GURU_INVAL');
  const activeSubs = todaySubs.filter((s) => s.status === 'TERTUGASKAN' || s.status === 'SEDANG_BERLANGSUNG');
  const completedSubs = todaySubs.filter((s) => s.status === 'SELESAI_INVAL');

  const filteredSubs = substitutions.filter((s) => {
    const matchStatus = statusFilter === 'SEMUA' || s.status === statusFilter;
    const matchSearch =
      s.guruBerhalanganName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.guruPenggantiName && s.guruPenggantiName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.mataPelajaran.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getSubstitutionReasonDisplay(s).toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserX className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Guru Berhalangan & Tugas Inval Pengganti
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pencatatan ketidakhadiran guru, alokasi guru inval pengganti, lembar tugas kelas, dan notifikasi WA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Ekspor Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingSubstitution(null);
              setIsFormModalOpen(true);
            }}
          >
            + Catat Guru Berhalangan
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Berhalangan Hari Ini</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {todaySubs.length} Guru
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Kelas Terdampak</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Menunggu Guru Inval</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {pendingSubs.length} Kelas
            </div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">Belum Ada Pengganti</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Inval Tertugaskan</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {activeSubs.length} Kelas
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Sedang / Siap Masuk</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Selesai Menginval</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {completedSubs.length} Kelas
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Pembelajaran Tuntas</div>
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
                placeholder="Cari nama guru, mapel, kelas, atau pengganti..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status Inval</option>
                <option value="MENUNGGU_GURU_INVAL">Menunggu Guru Inval</option>
                <option value="TERTUGASKAN">Tertugaskan</option>
                <option value="SEDANG_BERLANGSUNG">Sedang Berlangsung</option>
                <option value="SELESAI_INVAL">Selesai Inval</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUBSTITUTIONS LIST - MOBILE CARDS & DESKTOP TABLE */}
      {/* Mobile Card List (Hidden on tablet/desktop) */}
      <div className="block md:hidden space-y-3">
        {filteredSubs.length > 0 ? (
          filteredSubs.map((item) => (
            <Card key={item.id} className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.guruBerhalanganName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      📚 {item.mataPelajaran} • <span className="text-rose-600 dark:text-rose-400 font-semibold">{getSubstitutionReasonDisplay(item)}</span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === 'SELESAI_INVAL'
                        ? 'success'
                        : item.status === 'MENUNGGU_GURU_INVAL'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {item.status === 'SELESAI_INVAL'
                      ? 'Selesai Inval'
                      : item.status === 'MENUNGGU_GURU_INVAL'
                      ? 'Menunggu Inval'
                      : item.status === 'SEDANG_BERLANGSUNG'
                      ? 'Sedang Mengajar'
                      : 'Tertugaskan'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Kelas & Waktu</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{item.kelas}</span>
                    <span className="block text-[11px] text-slate-600 dark:text-slate-400 font-mono">{item.jamPelajaran}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Guru Pengganti (Inval)</span>
                    {item.guruPenggantiName ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                        🧑‍🏫 {item.guruPenggantiName}
                      </span>
                    ) : (
                      <span className="text-rose-500 font-semibold text-[11px] italic">Belum Ditugaskan</span>
                    )}
                  </div>
                </div>

                {item.materiDanTugasSiswa && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-100/60 dark:border-blue-900/40">
                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold block mb-0.5">Tugas Siswa:</span>
                    <p className="line-clamp-2 text-slate-600 dark:text-slate-300 text-[11px]">"{item.materiDanTugasSiswa}"</p>
                  </div>
                )}

                {/* Status Selector for Mobile */}
                {canEdit && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">Ubah Status:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item, e.target.value as SubstitutionStatus)}
                      className="text-xs font-bold p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      <option value="MENUNGGU_GURU_INVAL">Menunggu Inval</option>
                      <option value="TERTUGASKAN">Tertugaskan</option>
                      <option value="SEDANG_BERLANGSUNG">Sedang Mengajar</option>
                      <option value="SELESAI_INVAL">Selesai Inval</option>
                    </select>
                  </div>
                )}

                {/* Action Buttons for Mobile */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="text-xs min-h-[36px] px-3 font-semibold"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingSubstitution(item);
                          setIsFormModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs min-h-[36px] px-2.5"
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                      onClick={() => setPrintSub(item)}
                    >
                      Cetak
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.guruPenggantiName && (
                      <button
                        type="button"
                        onClick={() => handleSendWaToSubstitute(item)}
                        className="p-2 rounded-lg text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 cursor-pointer"
                        title="Kirim Notifikasi WA ke Guru Inval"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSendWaToClass(item)}
                      className="p-2 rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 cursor-pointer"
                      title="Kirim Instruksi Tugas ke Ketua Kelas"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(item)}
                        className="p-2 rounded-lg text-rose-500 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-slate-400 text-xs">
              Tidak ada catatan guru berhalangan hadir untuk filter ini.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View (Hidden on mobile) */}
      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-4">Guru Berhalangan</th>
                <th className="p-4">Kelas & Waktu</th>
                <th className="p-4">Guru Inval Pengganti</th>
                <th className="p-4">Tugas & Materi Siswa</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSubs.length > 0 ? (
                filteredSubs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.guruBerhalanganName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {item.mataPelajaran} • <span className="text-rose-600 font-semibold">{getSubstitutionReasonDisplay(item)}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        {item.kelas}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.jamPelajaran}
                      </div>
                    </td>

                    <td className="p-4">
                      {item.guruPenggantiName ? (
                        <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{item.guruPenggantiName}</span>
                        </div>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Belum Ditugaskan
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 max-w-xs">
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                        "{item.materiDanTugasSiswa}"
                      </p>
                    </td>

                    <td className="p-4">
                      {canEdit ? (
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateStatus(item, e.target.value as SubstitutionStatus)}
                          className={`text-[11px] font-bold p-1 rounded-lg border ${
                            item.status === 'SELESAI_INVAL'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : item.status === 'MENUNGGU_GURU_INVAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                        >
                          <option value="MENUNGGU_GURU_INVAL">Menunggu Inval</option>
                          <option value="TERTUGASKAN">Tertugaskan</option>
                          <option value="SEDANG_BERLANGSUNG">Sedang Mengajar</option>
                          <option value="SELESAI_INVAL">Selesai Inval</option>
                        </select>
                      ) : (
                        <Badge
                          variant={
                            item.status === 'SELESAI_INVAL'
                              ? 'success'
                              : item.status === 'MENUNGGU_GURU_INVAL'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Substitution */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubstitution(item);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ubah Catatan Inval"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Notify Substitute Teacher via WA */}
                        {item.guruPenggantiName && (
                          <button
                            type="button"
                            onClick={() => handleSendWaToSubstitute(item)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Kirim Notifikasi WA ke Guru Inval"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}

                        {/* Broadcast tasks to Class Leader */}
                        <button
                          type="button"
                          onClick={() => handleSendWaToClass(item)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                          title="Kirim Instruksi Tugas ke Ketua Kelas"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>

                        {/* Print Inval Slip */}
                        <button
                          type="button"
                          onClick={() => setPrintSub(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Cetak Lembar Penugasan Inval"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 text-xs">
                    Tidak ada catatan guru berhalangan hadir untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* SUBSTITUTION FORM MODAL */}
      <SubstitutionFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSubstitution(null);
        }}
        onSave={handleSaveSubstitution}
        editingSubstitution={editingSubstitution}
        teachers={teachers}
        isLoadingTeachers={isLoadingTeachers}
        teachersError={teachersError}
      />

      {/* PRINT SLIP MODAL */}
      <SubstitutionPrintModal
        isOpen={!!printSub}
        onClose={() => setPrintSub(null)}
        substitution={printSub}
        settings={settings}
      />

      {/* WHATSAPP MODAL */}
      <WhatsAppModal
        isOpen={waModalData.isOpen}
        onClose={() => setWaModalData({ ...waModalData, isOpen: false })}
        title={waModalData.title}
        defaultPhone={waModalData.phone}
        defaultMessage={waModalData.message}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Catatan Inval Guru"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Data Inval Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Guru: <strong>{deleteConfirm?.guruBerhalanganName}</strong> ({deleteConfirm?.kelas})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteSubstitution}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
