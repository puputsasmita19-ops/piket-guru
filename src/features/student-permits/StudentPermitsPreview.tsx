import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Clock,
  Printer,
  MessageSquare,
  LogIn,
  Trash2,
  Calendar,
  Download,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Award,
  AlertCircle,
  Edit2,
  Users,
  CheckSquare,
  Square,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { StudentPermitFormModal } from './StudentPermitFormModal';
import { StudentPermitPrintModal } from './StudentPermitPrintModal';
import {
  StudentPermitRecord,
  StudentPermitType,
  StudentPermitStatus,
  getStudentPermitTypeDisplay,
} from '../../types/studentPermit.types';
import { TeacherRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { StudentPermitService } from '../../services/firebase/studentPermitService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

export const StudentPermitsPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const canEdit = Boolean(
    currentUser?.role &&
      ['ADMIN', 'SUPER_ADMIN', 'PETUGAS_PIKET', 'GURU', 'STAFF', 'KEPALA_SEKOLAH'].includes(currentUser.role)
  );

  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [typeFilter, setTypeFilter] = useState<string>('SEMUA');

  // Multi-Selection State for bulk actions
  const [selectedPermitIds, setSelectedPermitIds] = useState<Set<string>>(new Set());

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPermit, setEditingPermit] = useState<StudentPermitRecord | null>(null);
  const [printPermit, setPrintPermit] = useState<StudentPermitRecord | null>(null);
  const [printPermitsList, setPrintPermitsList] = useState<StudentPermitRecord[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<StudentPermitRecord | null>(null);

  // Batch Return Modal State
  const [isBatchReturnModalOpen, setIsBatchReturnModalOpen] = useState(false);
  const [batchReturnTime, setBatchReturnTime] = useState(formatTime(new Date()));
  const [batchReturnError, setBatchReturnError] = useState<string | null>(null);
  const [isSubmittingBatchReturn, setIsSubmittingBatchReturn] = useState(false);

  // Single Return Modal State (with time prompt)
  const [singleReturnPermit, setSingleReturnPermit] = useState<StudentPermitRecord | null>(null);
  const [singleReturnTime, setSingleReturnTime] = useState(formatTime(new Date()));
  const [singleReturnError, setSingleReturnError] = useState<string | null>(null);

  // WhatsApp Alert Modal
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
    StudentPermitService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', (data) => {
      setPermits(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);

    return () => {
      unsubPermits();
    };
  }, []);

  // Filtered Permits
  const filteredPermits = useMemo(() => {
    return permits.filter((p) => {
      const matchStatus = statusFilter === 'SEMUA' || p.status === statusFilter;
      const matchType = typeFilter === 'SEMUA' || p.jenisIzin === typeFilter;
      const q = searchQuery.toLowerCase();
      const typeLabel = getStudentPermitTypeDisplay(p).toLowerCase();
      const matchSearch =
        p.namaSiswa.toLowerCase().includes(q) ||
        p.kelas.toLowerCase().includes(q) ||
        p.alasan.toLowerCase().includes(q) ||
        (p.groupId && p.groupId.toLowerCase().includes(q)) ||
        (p.keteranganLainnya && p.keteranganLainnya.toLowerCase().includes(q)) ||
        (p.namaPenjemput && p.namaPenjemput.toLowerCase().includes(q)) ||
        p.petugasPiketName.toLowerCase().includes(q) ||
        typeLabel.includes(q);

      return matchStatus && matchType && matchSearch;
    });
  }, [permits, statusFilter, typeFilter, searchQuery]);

  // Selected Permits Object List
  const selectedPermits = useMemo(() => {
    return permits.filter((p) => selectedPermitIds.has(p.id));
  }, [permits, selectedPermitIds]);

  // Selected permits currently outside (applicable for "Tiba Kembali")
  const selectedOutsidePermits = useMemo(() => {
    return selectedPermits.filter((p) => p.status === 'SEDANG_KELUAR');
  }, [selectedPermits]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedPermitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all visible
  const handleToggleSelectAll = () => {
    if (selectedPermitIds.size === filteredPermits.length && filteredPermits.length > 0) {
      setSelectedPermitIds(new Set());
    } else {
      setSelectedPermitIds(new Set(filteredPermits.map((p) => p.id)));
    }
  };

  // Create or Update Permit
  const handleSavePermit = async (data: any, isEdit?: boolean) => {
    if (!currentUser) return;
    if (isEdit && data.id) {
      await StudentPermitService.updatePermit(data, currentUser);
    } else {
      await StudentPermitService.createPermit(data, currentUser);
    }
  };

  // Open Single Return prompt
  const handleOpenSingleReturn = (permit: StudentPermitRecord) => {
    setSingleReturnPermit(permit);
    setSingleReturnTime(formatTime(new Date()));
    setSingleReturnError(null);
  };

  // Execute Single Return
  const handleConfirmSingleReturn = async () => {
    if (!singleReturnPermit || !currentUser) return;
    try {
      if (singleReturnPermit.jamKeluar && singleReturnTime < singleReturnPermit.jamKeluar) {
        setSingleReturnError(
          `Jam kembali (${singleReturnTime} WIB) tidak boleh lebih awal dari jam keluar (${singleReturnPermit.jamKeluar} WIB).`
        );
        return;
      }
      await StudentPermitService.markReturned(singleReturnPermit.id, currentUser, singleReturnTime);
      setSingleReturnPermit(null);
    } catch (err: any) {
      setSingleReturnError(err.message || 'Gagal mencatat kembali siswa');
    }
  };

  // Open Batch Return Modal
  const handleOpenBatchReturn = () => {
    if (selectedOutsidePermits.length === 0) return;
    setBatchReturnTime(formatTime(new Date()));
    setBatchReturnError(null);
    setIsBatchReturnModalOpen(true);
  };

  // Execute Batch Return
  const handleConfirmBatchReturn = async () => {
    if (selectedOutsidePermits.length === 0 || !currentUser) return;
    setIsSubmittingBatchReturn(true);
    setBatchReturnError(null);

    try {
      // Validate time against all selected outside permits
      const invalidPermit = selectedOutsidePermits.find(
        (p) => p.jamKeluar && batchReturnTime < p.jamKeluar
      );
      if (invalidPermit) {
        setBatchReturnError(
          `Jam kembali (${batchReturnTime} WIB) lebih awal dari jam keluar siswa ${invalidPermit.namaSiswa} (${invalidPermit.jamKeluar} WIB). Sesuaikan jam kembali.`
        );
        setIsSubmittingBatchReturn(false);
        return;
      }

      const ids = selectedOutsidePermits.map((p) => p.id);
      const res = await StudentPermitService.markMultipleReturned(ids, batchReturnTime, currentUser);

      if (res.errors.length > 0) {
        setBatchReturnError(`Berhasil: ${res.successCount}. Beberapa gagal: ${res.errors.join(', ')}`);
      } else {
        // All succeeded, close modal and unselect
        setSelectedPermitIds(new Set());
        setIsBatchReturnModalOpen(false);
      }
    } catch (err: any) {
      setBatchReturnError(err.message || 'Gagal memproses kedatangan kembali');
    } finally {
      setIsSubmittingBatchReturn(false);
    }
  };

  // Batch Print
  const handleBatchPrint = () => {
    if (selectedPermits.length === 0) return;
    setPrintPermitsList(selectedPermits);
    setPrintPermit(null);
  };

  // Delete Permit
  const handleDeletePermit = async () => {
    if (!deleteConfirm || !currentUser) return;
    await StudentPermitService.deletePermit(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
    setSelectedPermitIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteConfirm.id);
      return next;
    });
  };

  // Send WhatsApp Alert to Parent
  const handleSendWaToParent = (permit: StudentPermitRecord) => {
    const jenisDisplay = getStudentPermitTypeDisplay(permit);
    const msg = `*PEMBERITAHUAN IZIN KELUAR SEKOLAH*
*${settings.schoolName}*

Yth. Orang Tua / Wali dari siswa:
👤 *Nama Siswa:* ${permit.namaSiswa}
🎓 *Kelas:* ${permit.kelas}
📅 *Waktu:* ${formatIndonesianDate(permit.tanggal)} (Pukul ${permit.jamKeluar} WIB)
🏷️ *Jenis Izin:* ${jenisDisplay}
📝 *Alasan:* ${permit.alasan}
👥 *Pendamping/Penjemput:* ${permit.namaPenjemput || 'Orang Tua / Wali'} (${permit.penjemput})

Siswa telah diberikan surat izin resmi oleh Petugas Piket Sekolah (*${permit.petugasPiketName}*).
Demikian informasi ini disampaikan. Terima kasih. 🙏`;

    setWaModalData({
      isOpen: true,
      phone: permit.noHpOrangTua || '',
      message: msg,
      title: `Kirim Notifikasi Izin ke Orang Tua (${permit.namaSiswa})`,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'No Surat',
      'Grup ID',
      'Tanggal',
      'Jam Keluar',
      'Jam Kembali',
      'Nama Siswa',
      'NISN',
      'Kelas',
      'Jenis Izin',
      'Alasan',
      'Penjemput',
      'No HP Ortu',
      'Guru Mapel',
      'Petugas Piket',
      'Status',
    ];
    const rows = filteredPermits.map((p) => [
      p.id,
      p.groupId || '-',
      p.tanggal,
      p.jamKeluar,
      p.jamKembali || '-',
      p.namaSiswa,
      p.nisn,
      p.kelas,
      getStudentPermitTypeDisplay(p),
      p.alasan,
      `${p.namaPenjemput || '-'} (${p.penjemput})`,
      p.noHpOrangTua || '-',
      p.guruPengajarName || '-',
      p.petugasPiketName,
      p.status,
    ]);

    ExportUtils.exportToCsv(`Rekap_Izin_Keluar_Siswa_${Date.now()}`, headers, rows);
  };

  // Metrics
  const todayPermits = permits.filter((p) => p.tanggal === todayISO);
  const activeOutside = permits.filter((p) => p.status === 'SEDANG_KELUAR');
  const sickLeaves = todayPermits.filter((p) => p.jenisIzin === 'SAKIT_PULANG');

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Izin Keluar Siswa & Dispensasi Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Penerbitan surat izin gerbang (tunggal & multi siswa), monitoring gerbang, dan rekap perizinan
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
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingPermit(null);
                setIsFormModalOpen(true);
              }}
            >
              + Terbitkan Surat Izin (Multi-Siswa)
            </Button>
          )}
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Izin Hari Ini</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {todayPermits.length} Siswa
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Surat Diterbitkan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Sedang di Luar</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {activeOutside.length} Siswa
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Belum Kembali ke Sekolah</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Pulang Sakit / Rujuk</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {sickLeaves.length} Siswa
            </div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">Observasi UKS / Ortu</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Total Seluruh Arsip</span>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {permits.length} Surat
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Database Izin Siswa</div>
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
                placeholder="Cari siswa, kelas, alasan, ID grup..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="SEDANG_KELUAR">Sedang di Luar</option>
                <option value="SUDAH_KEMBALI">Sudah Kembali</option>
                <option value="SELESAI_PULANG">Pulang Selesai</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Jenis Izin</option>
                <option value="SAKIT_PULANG">Sakit (Pulang)</option>
                <option value="URUSAN_KELUARGA">Urusan Keluarga</option>
                <option value="DISPENSASI_LOMBA">Dispensasi Lomba</option>
                <option value="KELUAR_SEBENTAR">Keluar Sebentar</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FLOATING BULK ACTIONS TOOLBAR */}
      {selectedPermitIds.size > 0 && (
        <div className="sticky top-4 z-30 p-3 sm:p-4 rounded-2xl bg-blue-600 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xs">
              {selectedPermitIds.size}
            </div>
            <div>
              <span className="font-bold text-xs sm:text-sm block">
                {selectedPermitIds.size} Surat Izin Siswa Terpilih
              </span>
              <span className="text-[11px] text-blue-100">
                {selectedOutsidePermits.length} siswa sedang di luar (dapat dicatat kembali)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {selectedOutsidePermits.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none"
                leftIcon={<LogIn className="w-3.5 h-3.5" />}
                onClick={handleOpenBatchReturn}
              >
                Catat Kembali Terpilih ({selectedOutsidePermits.length})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/30"
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              onClick={handleBatchPrint}
            >
              Cetak Terpilih ({selectedPermits.length})
            </Button>

            <button
              type="button"
              onClick={() => setSelectedPermitIds(new Set())}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-xs flex items-center gap-1"
              title="Batalkan Pilihan"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Batal</span>
            </button>
          </div>
        </div>
      )}

      {/* PERMITS LIST: RESPONSIVE MOBILE CARDS & DESKTOP TABLE */}
      {/* Mobile Card List (Hidden on tablet/desktop) */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="text-xs font-semibold text-blue-600 flex items-center gap-1.5 cursor-pointer"
          >
            {selectedPermitIds.size === filteredPermits.length && filteredPermits.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Pilih Semua ({filteredPermits.length})</span>
          </button>
        </div>

        {filteredPermits.length > 0 ? (
          filteredPermits.map((item) => {
            const isSelected = selectedPermitIds.has(item.id);
            return (
              <Card
                key={item.id}
                className={`overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(item.id)}
                        className="mt-0.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{item.namaSiswa}</span>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>🎓 {item.kelas}</span>
                          {item.nisn && item.nisn !== '-' && <span>• NISN: {item.nisn}</span>}
                          {item.groupId && (
                            <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                              Grup #{item.groupId.slice(-6)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant={
                        item.status === 'SEDANG_KELUAR'
                          ? 'warning'
                          : item.status === 'SUDAH_KEMBALI'
                          ? 'success'
                          : 'primary'
                      }
                      size="sm"
                    >
                      {item.status === 'SEDANG_KELUAR'
                        ? 'Sedang di Luar'
                        : item.status === 'SUDAH_KEMBALI'
                        ? 'Sudah Kembali'
                        : 'Pulang Selesai'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        item.jenisIzin === 'SAKIT_PULANG'
                          ? 'danger'
                          : item.jenisIzin === 'DISPENSASI_LOMBA'
                          ? 'success'
                          : item.jenisIzin === 'KELUAR_SEBENTAR'
                          ? 'warning'
                          : item.jenisIzin === 'LAINNYA'
                          ? 'info'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {getStudentPermitTypeDisplay(item)}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-500">
                      🕒 Keluar: <strong>{item.jamKeluar}</strong>
                      {item.jamKembali ? ` • Kembali: ${item.jamKembali}` : ''}
                    </span>
                  </div>

                  <div className="text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-slate-700 dark:text-slate-300 italic">
                      "{item.alasan}"
                    </p>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>👥 Pendamping: <strong>{item.namaPenjemput || '-'}</strong> ({item.penjemput})</span>
                      {item.noHpOrangTua && <span className="font-mono text-emerald-600">📞 {item.noHpOrangTua}</span>}
                    </div>
                  </div>

                  {/* Mobile Actions */}
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
                            setEditingPermit(item);
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
                        onClick={() => {
                          setPrintPermit(item);
                          setPrintPermitsList([]);
                        }}
                      >
                        Cetak
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.status === 'SEDANG_KELUAR' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 min-h-[36px] px-2.5"
                          leftIcon={<LogIn className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenSingleReturn(item)}
                        >
                          Tiba Kembali
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSendWaToParent(item)}
                        className="p-2 rounded-lg text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 cursor-pointer"
                        title="Kirim Notifikasi WA ke Orang Tua"
                      >
                        <MessageSquare className="w-4 h-4" />
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
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-slate-400 text-xs">
              Belum ada data izin keluar siswa untuk filter terpilih.
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
                <th className="p-4 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                    title="Pilih Semua / Batal Pilih"
                  >
                    {selectedPermitIds.size === filteredPermits.length && filteredPermits.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-4">Siswa & Kelas</th>
                <th className="p-4">Jenis Izin</th>
                <th className="p-4">Waktu Keluar / Kembali</th>
                <th className="p-4">Alasan & Penjemput</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPermits.length > 0 ? (
                filteredPermits.map((item) => {
                  const isSelected = selectedPermitIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/40 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(item.id)}
                          className="text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{item.namaSiswa}</span>
                          {item.groupId && (
                            <Badge variant="neutral" size="sm" className="font-mono text-[9px]">
                              Grup #{item.groupId.slice(-6)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                          {item.kelas} {item.nisn && item.nisn !== '-' ? `• NISN: ${item.nisn}` : ''}
                        </div>
                      </td>

                      <td className="p-4">
                        <Badge
                          variant={
                            item.jenisIzin === 'SAKIT_PULANG'
                              ? 'danger'
                              : item.jenisIzin === 'DISPENSASI_LOMBA'
                              ? 'success'
                              : item.jenisIzin === 'KELUAR_SEBENTAR'
                              ? 'warning'
                              : item.jenisIzin === 'LAINNYA'
                              ? 'info'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {getStudentPermitTypeDisplay(item)}
                        </Badge>
                      </td>

                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>{formatIndonesianDate(item.tanggal)}</div>
                        <div className="text-[11px] text-slate-500">
                          Keluar: <strong>{item.jamKeluar}</strong>{' '}
                          {item.jamKembali ? `• Kembali: ${item.jamKembali}` : ''}
                        </div>
                      </td>

                      <td className="p-4 max-w-xs">
                        <p className="text-slate-800 dark:text-slate-200 truncate">
                          "{item.alasan}"
                        </p>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          Dijemput: <strong>{item.namaPenjemput || '-'}</strong> ({item.penjemput})
                        </div>
                      </td>

                      <td className="p-4">
                        <Badge
                          variant={
                            item.status === 'SEDANG_KELUAR'
                              ? 'warning'
                              : item.status === 'SUDAH_KEMBALI'
                              ? 'success'
                              : 'primary'
                          }
                          size="sm"
                        >
                          {item.status === 'SEDANG_KELUAR'
                            ? 'Sedang di Luar'
                            : item.status === 'SUDAH_KEMBALI'
                            ? 'Sudah Kembali'
                            : 'Pulang Selesai'}
                        </Badge>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPermit(item);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Ubah Data Izin Siswa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Notify Parent WA */}
                          <button
                            type="button"
                            onClick={() => handleSendWaToParent(item)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Kirim Notifikasi WA ke Orang Tua Siswa"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Print Gate Pass */}
                          <button
                            type="button"
                            onClick={() => {
                              setPrintPermit(item);
                              setPrintPermitsList([]);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Cetak Surat Izin Gerbang"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Check-In Return */}
                          {item.status === 'SEDANG_KELUAR' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              leftIcon={<LogIn className="w-3.5 h-3.5" />}
                              onClick={() => handleOpenSingleReturn(item)}
                            >
                              Tiba Kembali
                            </Button>
                          )}

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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 text-xs">
                    Belum ada data izin keluar siswa untuk filter terpilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* PERMIT FORM MODAL (MULTI-SISWA) */}
      <StudentPermitFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingPermit(null);
        }}
        onSave={handleSavePermit}
        editingPermit={editingPermit}
        teachers={teachers}
      />

      {/* PRINT GATE PASS MODAL (SINGLE OR BATCH) */}
      <StudentPermitPrintModal
        isOpen={Boolean(printPermit || (printPermitsList && printPermitsList.length > 0))}
        onClose={() => {
          setPrintPermit(null);
          setPrintPermitsList([]);
        }}
        permit={printPermit}
        permits={printPermitsList}
        settings={settings}
      />

      {/* SINGLE CHECK-IN (TIBA KEMBALI) MODAL */}
      <Modal
        isOpen={Boolean(singleReturnPermit)}
        onClose={() => setSingleReturnPermit(null)}
        title="Catat Kedatangan Kembali Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
            Siswa <strong>{singleReturnPermit?.namaSiswa}</strong> ({singleReturnPermit?.kelas}) tercatat keluar pukul{' '}
            <strong>{singleReturnPermit?.jamKeluar} WIB</strong>.
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Jam Tiba Kembali di Sekolah (WIB) *
            </label>
            <input
              type="time"
              required
              value={singleReturnTime}
              onChange={(e) => setSingleReturnTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          {singleReturnError && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200">
              {singleReturnError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSingleReturnPermit(null)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmSingleReturn}>
              Konfirmasi Tiba Kembali
            </Button>
          </div>
        </div>
      </Modal>

      {/* BATCH CHECK-IN (TIBA KEMBALI MASSAL) MODAL */}
      <Modal
        isOpen={isBatchReturnModalOpen}
        onClose={() => setIsBatchReturnModalOpen(false)}
        title={`Catat Kembali ${selectedOutsidePermits.length} Siswa Terpilih (Massal)`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Petugas akan mencatat kedatangan kembali untuk <strong>{selectedOutsidePermits.length} siswa</strong> yang saat ini masih berstatus di luar. Setiap siswa akan diperbarui secara individual tanpa mempengaruhi kelompok lainnya.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Jam Kembali Masuk Sekolah (WIB) *
            </label>
            <input
              type="time"
              required
              value={batchReturnTime}
              onChange={(e) => setBatchReturnTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
            {selectedOutsidePermits.map((item, idx) => (
              <div key={item.id} className="p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {idx + 1}. {item.namaSiswa}
                  </span>
                  <span className="text-[10px] text-blue-600 ml-2 font-semibold">{item.kelas}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Keluar: {item.jamKeluar} WIB</span>
              </div>
            ))}
          </div>

          {batchReturnError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {batchReturnError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBatchReturnModalOpen(false)}
              disabled={isSubmittingBatchReturn}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSubmittingBatchReturn}
              onClick={handleConfirmBatchReturn}
            >
              Konfirmasi Tiba Kembali ({selectedOutsidePermits.length} Siswa)
            </Button>
          </div>
        </div>
      </Modal>

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
        title="Hapus Surat Izin Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Catatan Izin Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Siswa: <strong>{deleteConfirm?.namaSiswa}</strong> ({deleteConfirm?.kelas})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeletePermit}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
