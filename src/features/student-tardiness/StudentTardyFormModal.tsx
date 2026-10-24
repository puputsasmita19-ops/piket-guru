import { DialogForm } from '../../components/common/DialogForm';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  StudentTardyRecord,
  TardyReason,
  DisciplineAction,
  TardyStatus,
  calculateStudentTardiness,
  calculateTardyViolationPoints,
  getTardyReasonDisplay,
  getDisciplineActionDisplay,
} from '../../types/studentTardy.types';
import { StudentRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { StudentTardyService } from '../../services/firebase/studentTardyService';
import { StudentService } from '../../services/firebase/studentService';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime, formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';
import { stampDocumentationPhoto, detectLocationForWatermark } from '../../services/watermark/watermarkService';
import { DEFAULT_DOCUMENTATION_WATERMARK_CONFIG } from '../../types/watermark.types';
import {
  Calendar,
  Clock,
  User,
  GraduationCap,
  Camera,
  Trash2,
  Phone,
  Search,
  Sparkles,
  Eye,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Save,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldAlert,
  X,
} from '../../components/icons';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';

interface StudentTardyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<StudentTardyRecord>, isEdit?: boolean) => Promise<void>;
  editingTardy?: StudentTardyRecord | null;
  settings?: SchoolSettings;
}

export interface SelectedStudentEntry {
  student: StudentRecord;
  frekuensiBulanIni: number;
  isCustomized: boolean;
  jamDatang?: string;
  alasan?: TardyReason;
  keteranganAlasan?: string;
  pembinaan?: DisciplineAction;
  keteranganPembinaan?: string;
  catatanPetugas?: string;
  fotoUrl?: string;
}

export const StudentTardyFormModal: React.FC<StudentTardyFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTardy,
  settings,
}) => {
  const { currentUser } = useAuth();
  const [targetStudentIdForPhoto, setTargetStudentIdForPhoto] = useState<string | null>(null);

  // Settings for student entry limit & tolerance
  const entryLimitTime = useMemo(() => {
    return (
      settings?.studentTardyConfig?.entryLimit ||
      settings?.workHours?.start ||
      '07:00'
    );
  }, [settings]);

  const toleranceMinutes = useMemo(() => {
    return settings?.studentTardyConfig?.toleranceMinutes ?? 0;
  }, [settings]);

  // Master Student Directory
  const [studentDirectory, setStudentDirectory] = useState<StudentRecord[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Multi-Student Selected List
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudentEntry[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Shared defaults
  const [tanggal, setTanggal] = useState(getTodayISODate());
  const [sharedJamDatang, setSharedJamDatang] = useState(formatTime(new Date()));
  const [sharedAlasan, setSharedAlasan] = useState<TardyReason>('BANGUN_KESIANGAN');
  const [sharedKeteranganAlasan, setSharedKeteranganAlasan] = useState('');
  const [sharedPembinaan, setSharedPembinaan] = useState<DisciplineAction>('LITERASI_PERPUSTAKAAN');
  const [sharedKeteranganPembinaan, setSharedKeteranganPembinaan] = useState('');
  const [sharedCatatanPetugas, setSharedCatatanPetugas] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  // Creation uses each student's own attachment; editing uses the existing record.
  const displayPhoto = editingTardy ? fotoUrl : selectedStudents.length === 1 ? selectedStudents[0].fotoUrl : undefined;

  // Single edit mode fallback states
  const [singleStudentName, setSingleStudentName] = useState('');
  const [singleStudentKelas, setSingleStudentKelas] = useState('');
  const [singleStudentNisn, setSingleStudentNisn] = useState('');
  const [singleStudentPhone, setSingleStudentPhone] = useState('');
  const [singleStudentPoin, setSingleStudentPoin] = useState(5);
  const [singleStudentFreq, setSingleStudentFreq] = useState(1);

  // Modals & UI states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPreviewPhotoOpen, setIsPreviewPhotoOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Summary & Batch Save Result Modal
  const [showSummaryConfirm, setShowSummaryConfirm] = useState(false);
  const [batchResults, setBatchResults] = useState<{
    results: Array<{
      studentId: string;
      namaSiswa: string;
      kelas: string;
      success: boolean;
      record?: StudentTardyRecord;
      error?: string;
    }>;
    allSuccessful: boolean;
  } | null>(null);

  // Request ID for idempotent retry
  const batchRequestIdRef = useRef<string>('');

  // Load student directory on mount
  useEffect(() => {
    StudentService.bootstrapIfEmpty().then(() => {
      StudentService.getAllStudents().then((data) => {
        setStudentDirectory(data.filter((s) => s.isActive !== false));
      });
    });
  }, []);

  // Initialize or reset form state
  useEffect(() => {
    if (isOpen) {
      batchRequestIdRef.current = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      setShowSummaryConfirm(false);
      setBatchResults(null);
      setErrorMessage(null);
      setFieldErrors({});
      setIsStudentDropdownOpen(false);
      setExpandedStudentId(null);

      if (editingTardy) {
        // Single Edit Mode
        setTanggal(editingTardy.tanggal);
        setSharedJamDatang(editingTardy.jamDatang);
        setSingleStudentName(editingTardy.namaSiswa);
        setSingleStudentKelas(editingTardy.kelas);
        setSingleStudentNisn(editingTardy.nisn && editingTardy.nisn !== '-' ? editingTardy.nisn : '');
        setSingleStudentPhone(editingTardy.noHpOrangTua || '');
        setSharedAlasan(editingTardy.alasan);
        setSharedKeteranganAlasan(editingTardy.keteranganAlasan || '');
        setSharedPembinaan(editingTardy.pembinaan);
        setSharedKeteranganPembinaan(editingTardy.keteranganPembinaan || '');
        setSingleStudentPoin(editingTardy.poinPelanggaran || 5);
        setSingleStudentFreq(editingTardy.frekuensiBulanIni || 1);
        setFotoUrl(editingTardy.fotoUrl);
        setSharedCatatanPetugas(editingTardy.catatanPetugas || '');
        setSelectedStudents([]);
      } else {
        // Multi Student Mode
        const nowTime = formatTime(new Date());
        setTanggal(getTodayISODate());
        setSharedJamDatang(nowTime);
        setSharedAlasan('BANGUN_KESIANGAN');
        setSharedKeteranganAlasan('');
        setSharedPembinaan('LITERASI_PERPUSTAKAAN');
        setSharedKeteranganPembinaan('');
        setSharedCatatanPetugas('');
        setFotoUrl(undefined);
        setSelectedStudents([]);
        setStudentSearchTerm('');
      }
    }
  }, [isOpen, editingTardy]);

  // Autocomplete student filter
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return studentDirectory.slice(0, 8);
    const q = studentSearchTerm.toLowerCase();
    return studentDirectory
      .filter((s) => {
        const nameMatch = s.nama.toLowerCase().includes(q);
        const nisMatch = s.nis ? s.nis.toLowerCase().includes(q) : false;
        const nisnMatch = s.nisn ? s.nisn.toLowerCase().includes(q) : false;
        const studentIdMatch = s.id ? s.id.toLowerCase().includes(q) : false;
        const kelasMatch = s.kelas ? s.kelas.toLowerCase().includes(q) : false;
        return nameMatch || nisMatch || nisnMatch || studentIdMatch || kelasMatch;
      })
      .slice(0, 10);
  }, [studentDirectory, studentSearchTerm]);

  // Add student to multi-select list
  const handleAddStudent = async (std: StudentRecord) => {
    // Prevent duplicate selection by unique studentId
    if (selectedStudents.some((entry) => entry.student.id === std.id)) {
      setErrorMessage(`Siswa "${std.nama}" (${std.kelas}) sudah terpilih dalam daftar.`);
      setIsStudentDropdownOpen(false);
      return;
    }

    setErrorMessage(null);
    setStudentSearchTerm('');
    setIsStudentDropdownOpen(false);

    // Fetch individual monthly frequency for this student
    const count = await StudentTardyService.getStudentTardyCountThisMonth(
      std.id,
      std.kelas,
      tanggal
    );

    const newEntry: SelectedStudentEntry = {
      student: std,
      frekuensiBulanIni: count + 1,
      isCustomized: false,
    };

    setSelectedStudents((prev) => [...prev, newEntry]);
  };

  // Re-fetch individual monthly frequency when tanggal changes
  useEffect(() => {
    if (selectedStudents.length === 0) return;
    let isCancelled = false;

    Promise.all(
      selectedStudents.map(async (entry) => {
        const count = await StudentTardyService.getStudentTardyCountThisMonth(
          entry.student.id,
          entry.student.kelas,
          tanggal
        );
        return {
          ...entry,
          frekuensiBulanIni: count + 1,
        };
      })
    ).then((updated) => {
      if (!isCancelled) {
        setSelectedStudents(updated);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [tanggal]);

  // Remove student from selected list
  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.student.id !== studentId));
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
    }
  };

  // Update customization for individual student
  const handleUpdateStudentCustomization = (
    studentId: string,
    updates: Partial<SelectedStudentEntry>
  ) => {
    setSelectedStudents((prev) =>
      prev.map((s) => (s.student.id === studentId ? { ...s, ...updates, isCustomized: true } : s))
    );
  };

  // Reset student customization back to shared values
  const handleResetStudentCustomization = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.map((s) =>
        s.student.id === studentId
          ? {
              ...s,
              isCustomized: false,
              jamDatang: undefined,
              alasan: undefined,
              keteranganAlasan: undefined,
              pembinaan: undefined,
              keteranganPembinaan: undefined,
              catatanPetugas: undefined,
            }
          : s
      )
    );
  };

  // Shared arrival calculation preview
  const sharedCalc = useMemo(() => {
    return calculateStudentTardiness(sharedJamDatang, entryLimitTime, toleranceMinutes);
  }, [sharedJamDatang, entryLimitTime, toleranceMinutes]);

  // Count of students with customized arrival time
  const customizedTimesCount = useMemo(() => {
    return selectedStudents.filter((s) => s.isCustomized && s.jamDatang).length;
  }, [selectedStudents]);

  // Validate form before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!tanggal) {
      errors.tanggal = 'Tanggal kejadian wajib diisi.';
    }

    if (editingTardy) {
      if (!sharedJamDatang || !sharedJamDatang.trim()) {
        errors.jamDatang = 'Jam tiba di gerbang wajib diisi.';
      }
      if (!singleStudentName.trim()) {
        errors.namaSiswa = 'Nama siswa wajib diisi.';
      }
      if (!singleStudentKelas.trim()) {
        errors.kelas = 'Kelas siswa wajib diisi.';
      }
    } else {
      if (selectedStudents.length === 0) {
        errors.students = 'Pilih minimal satu siswa dari pencarian master siswa.';
      }
      if (!sharedJamDatang || !sharedJamDatang.trim()) {
        errors.sharedJamDatang = 'Jam tiba bersama wajib diisi.';
      }
    }

    if (sharedAlasan === 'LAINNYA' && !sharedKeteranganAlasan.trim()) {
      errors.sharedKeteranganAlasan = 'Keterangan alasan lainnya wajib diisi.';
    }

    if (sharedPembinaan === 'LAINNYA' && !sharedKeteranganPembinaan.trim()) {
      errors.sharedKeteranganPembinaan = 'Keterangan pembinaan lainnya wajib diisi.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorMessage(Object.values(errors)[0]);
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Open summary before save
  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingTardy) {
      // In single edit mode, submit directly
      executeSingleSave();
    } else {
      // In multi-student mode, show confirmation summary
      setShowSummaryConfirm(true);
    }
  };

  // Execute single save for editing an existing record
  const executeSingleSave = async () => {
    if (!currentUser || !editingTardy) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const calc = calculateStudentTardiness(sharedJamDatang, entryLimitTime, toleranceMinutes);
      const minutesLate = calc.minutesLate ?? 0;
      const points = calculateTardyViolationPoints(minutesLate);

      const payload: Partial<StudentTardyRecord> = {
        id: editingTardy.id,
        updatedAt: editingTardy.updatedAt,
        studentId: editingTardy.studentId,
        createdAt: editingTardy.createdAt,
        createdBy: editingTardy.createdBy,
        tanggal,
        jamDatang: sharedJamDatang,
        menitTerlambat: minutesLate,
        namaSiswa: singleStudentName.trim(),
        kelas: singleStudentKelas.trim(),
        nisn: singleStudentNisn.trim() || '-',
        noHpOrangTua: singleStudentPhone.trim(),
        alasan: sharedAlasan,
        keteranganAlasan: sharedAlasan === 'LAINNYA' ? sharedKeteranganAlasan.trim() : undefined,
        pembinaan: sharedPembinaan,
        keteranganPembinaan: sharedPembinaan === 'LAINNYA' ? sharedKeteranganPembinaan.trim() : undefined,
        poinPelanggaran: points,
        frekuensiBulanIni: singleStudentFreq,
        fotoUrl,
        catatanPetugas: sharedCatatanPetugas.trim() || undefined,
        ruleSnapshot: {
          entryLimit: entryLimitTime,
          toleranceMinutes,
        },
      };

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        let attachments: { [key: string]: Blob } | undefined = undefined;
        if (fotoUrl && fotoUrl.startsWith('data:image/')) {
          const blob = await DraftService.dataUrlToBlob(fotoUrl);
          attachments = { tardy_photo: blob };
        }

        await SyncQueueService.enqueue(
          currentUser,
          'TARDY_REPORT',
          'studentTardiness',
          payload.id!,
          payload,
          attachments
        );

        onClose();
        return;
      }

      await onSave(payload, true);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan perubahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute batch save for multi-student input
  const executeBatchSave = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const ruleSnapshot = {
      entryLimit: entryLimitTime,
      toleranceMinutes,
    };

    const payloads = selectedStudents.map((entry) => {
      const effectiveJam = entry.isCustomized && entry.jamDatang ? entry.jamDatang : sharedJamDatang;
      const effectiveAlasan = entry.isCustomized && entry.alasan ? entry.alasan : sharedAlasan;
      const effectiveKetAlasan = entry.isCustomized && entry.keteranganAlasan !== undefined
        ? entry.keteranganAlasan
        : sharedKeteranganAlasan;
      const effectivePembinaan = entry.isCustomized && entry.pembinaan ? entry.pembinaan : sharedPembinaan;
      const effectiveKetPembinaan = entry.isCustomized && entry.keteranganPembinaan !== undefined
        ? entry.keteranganPembinaan
        : sharedKeteranganPembinaan;
      const effectiveCatatan = entry.isCustomized && entry.catatanPetugas !== undefined
        ? entry.catatanPetugas
        : sharedCatatanPetugas;

      const calc = calculateStudentTardiness(effectiveJam, entryLimitTime, toleranceMinutes);
      const minutesLate = calc.minutesLate ?? 0;
      const points = calculateTardyViolationPoints(minutesLate);

      return {
        studentId: entry.student.id,
        namaSiswa: entry.student.nama,
        kelas: entry.student.kelas,
        nisn: entry.student.nisn || entry.student.nis || '-',
        noHpOrangTua: entry.student.noHpOrangTua || '',
        tanggal,
        jamDatang: effectiveJam,
        menitTerlambat: minutesLate,
        menitTerlambatAsli: minutesLate,
        alasan: effectiveAlasan,
        keteranganAlasan: effectiveAlasan === 'LAINNYA' ? effectiveKetAlasan.trim() : undefined,
        pembinaan: effectivePembinaan,
        keteranganPembinaan: effectivePembinaan === 'LAINNYA' ? effectiveKetPembinaan.trim() : undefined,
        poinPelanggaran: points,
        frekuensiBulanIni: entry.frekuensiBulanIni,
        fotoUrl: entry.fotoUrl,
        catatanPetugas: effectiveCatatan.trim() || undefined,
        ruleSnapshot,
      };
    });

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      try {
        for (let i = 0; i < selectedStudents.length; i++) {
          const entry = selectedStudents[i];
          const payload = payloads[i];
          const recId = StudentTardyService.getBatchRecordId(tanggal, entry.student.id, batchRequestIdRef.current);

          let attachments: { [key: string]: Blob } | undefined = undefined;
          const studentPhoto = entry.fotoUrl;
          if (studentPhoto && studentPhoto.startsWith('data:image/')) {
            const blob = await DraftService.dataUrlToBlob(studentPhoto);
            attachments = { tardy_photo: blob };
          }

          await SyncQueueService.enqueue(
            currentUser,
            'TARDY_REPORT',
            'studentTardiness',
            recId,
            { ...payload, id: recId, batchRequestId: batchRequestIdRef.current },
            attachments
          );
        }

        setShowSummaryConfirm(false);
        onClose();
        return;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal menyimpan antrean offline.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const batchRes = await StudentTardyService.saveBatchTardyStudents(
        payloads,
        currentUser,
        batchRequestIdRef.current
      );

      setBatchResults(batchRes);
      setShowSummaryConfirm(false);

      if (batchRes.allSuccessful) {
        // Records were already saved by the batch service. The parent listens
        // to Firestore; calling onSave here would write the first record twice.
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan catatan siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry only the failed students
  const handleRetryFailedStudents = () => {
    if (!batchResults) return;
    const failedIds = new Set(
      batchResults.results.filter((r) => !r.success).map((r) => r.studentId)
    );
    // Keep only the failed students in selected list
    setSelectedStudents((prev) => prev.filter((s) => failedIds.has(s.student.id)));
    setBatchResults(null);
    setShowSummaryConfirm(true);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          editingTardy
            ? 'Ubah Catatan Siswa Terlambat'
            : 'Catat Siswa Terlambat di Pos Gerbang'
        }
        maxWidth="2xl"
      >
        <DialogForm onSubmit={handleInitiateSubmit} noValidate className="w-full min-w-0 max-w-full space-y-5" actions={<div className="app-form-actions flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Clock className="w-4 h-4" />}
            >
              {editingTardy
                ? 'Simpan Perubahan'
                : `Simpan Catatan (${selectedStudents.length} Siswa)`}
            </Button>
          </div>}>
          {/* ========================================================================= */}
          {/* BAGIAN 1: PEMILIHAN SISWA (MULTI-SELECT DENGAN PENCARIAN MASTER DATA)      */}
          {/* ========================================================================= */}
          {!editingTardy ? (
            <div className="w-full min-w-0 max-w-full p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Pilih Siswa (Bisa Pilih Beberapa Sekaligus) *</span>
                </label>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {selectedStudents.length} Siswa Terpilih
                </span>
              </div>

              {/* Search Autocomplete Input */}
              <div className="relative w-full min-w-0 max-w-full">
                <div className="relative w-full min-w-0 max-w-full">
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onFocus={() => setIsStudentDropdownOpen(true)}
                    onChange={(e) => {
                      setStudentSearchTerm(e.target.value);
                      setIsStudentDropdownOpen(true);
                      if (fieldErrors.students) setFieldErrors((p) => ({ ...p, students: '' }));
                    }}
                    placeholder="Ketik nama, NIS, NISN, atau kelas untuk mencari & menambah siswa..."
                    className="block w-full min-w-0 max-w-full min-h-[44px] pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Dropdown Options */}
                {isStudentDropdownOpen && filteredStudents.length > 0 && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1.5 w-full min-w-0 max-h-56 overflow-x-hidden overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudents.map((std) => {
                      const isAlreadySelected = selectedStudents.some(
                        (s) => s.student.id === std.id
                      );
                      return (
                        <div
                          key={std.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!isAlreadySelected) handleAddStudent(std);
                          }}
                          className={`p-3 text-xs transition-colors flex items-center justify-between gap-2 ${
                            isAlreadySelected
                              ? 'bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed opacity-60'
                              : 'hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="min-w-0 font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{std.nama}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                                {std.kelas}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 break-words [overflow-wrap:anywhere]">
                              {std.nisn ? `NISN: ${std.nisn}` : std.nis ? `NIS: ${std.nis}` : `ID: ${std.id}`}
                              {std.noHpOrangTua ? ` • WA Ortu: ${std.noHpOrangTua}` : ' • (Tanpa no HP)'}
                            </div>
                          </div>

                          {isAlreadySelected ? (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded shrink-0">
                              Sudah Dipilih
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                              + Tambah
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Students List (Ringkasan Siswa Terpilih) */}
              {selectedStudents.length > 0 ? (
                <div className="w-full min-w-0 max-w-full space-y-2 pt-2">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    <span>Daftar Siswa Terpilih:</span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-800 dark:bg-sky-950 dark:text-sky-200" data-r65="active">R65</span>
                  </div>

                  <div className="w-full min-w-0 max-w-full space-y-3 max-h-80 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
                    {selectedStudents.map((entry, idx) => {
                      const effectiveJam =
                        entry.isCustomized && entry.jamDatang ? entry.jamDatang : sharedJamDatang;
                      const calc = calculateStudentTardiness(
                        effectiveJam,
                        entryLimitTime,
                        toleranceMinutes
                      );
                      const isExpanded = expandedStudentId === entry.student.id;

                      return (
                        <div
                          key={entry.student.id}
                          className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs space-y-3 shadow-xs"
                        >
                          {/* R65: identitas, status, dan aksi dipisah agar tidak melebar di HP. */}
                          <div className="flex w-full min-w-0 max-w-full items-start gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="whitespace-normal break-words [overflow-wrap:anywhere] text-sm font-bold leading-snug text-slate-900 dark:text-white">
                                {entry.student.nama}
                              </p>
                              <p className="mt-1 whitespace-normal break-words [overflow-wrap:anywhere] text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                Kelas: <strong>{entry.student.kelas}</strong>
                                {entry.student.noHpOrangTua && <> · Ortu: {entry.student.noHpOrangTua}</>}
                              </p>
                            </div>
                          </div>

                          {/* Status bebas turun baris; frekuensi tidak mendorong tombol keluar kartu. */}
                          <div className="flex w-full min-w-0 max-w-full flex-wrap items-start gap-2">
                            <span
                              className={`min-w-0 flex-[1_1_9rem] whitespace-normal break-words [overflow-wrap:anywhere] rounded-lg px-3 py-2 text-[11px] font-semibold leading-snug ${
                                calc.minutesLate === null
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : calc.isLate
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {calc.displayText}
                            </span>
                            <span
                              className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold tabular-nums ${
                                entry.frekuensiBulanIni >= 3
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              Ke-{entry.frekuensiBulanIni}
                            </span>
                          </div>

                          {/* Tiga tombol besar dalam grid, masing-masing punya label yang terlihat. */}
                          <div className="grid w-full min-w-0 max-w-full grid-cols-3 gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setTargetStudentIdForPhoto(entry.student.id);
                                setIsCameraOpen(true);
                              }}
                              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                                entry.fotoUrl
                                  ? 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              }`}
                              aria-label={entry.fotoUrl ? `Ganti foto ${entry.student.nama}` : `Ambil foto ${entry.student.nama}`}
                              title={entry.fotoUrl ? 'Ganti foto siswa' : 'Ambil foto siswa'}
                            >
                              <Camera className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 truncate">{entry.fotoUrl ? 'Foto Ada' : 'Foto'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedStudentId(isExpanded ? null : entry.student.id)}
                              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                                entry.isCustomized
                                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              }`}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Tutup' : 'Buka'} penyesuaian ${entry.student.nama}`}
                              title="Sesuaikan nilai individual"
                            >
                              <Sliders className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 truncate">Atur</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudent(entry.student.id)}
                              className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-1.5 py-2 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                              aria-label={`Hapus ${entry.student.nama} dari daftar`}
                              title="Hapus dari daftar"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 truncate">Hapus</span>
                            </button>
                          </div>

                          {/* Accordion: Penyesuaian Individual per Siswa */}
                          {isExpanded && (
                            <div className="w-full min-w-0 max-w-full overflow-hidden pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl animate-in fade-in">
                              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                <span className="min-w-0 break-words [overflow-wrap:anywhere] text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  Penyesuaian Khusus: {entry.student.nama}
                                </span>
                                {entry.isCustomized && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetStudentCustomization(entry.student.id)}
                                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                  >
                                    Reset ke Nilai Bersama
                                  </button>
                                )}
                              </div>

                              <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Jam Tiba Individual:
                                  </label>
                                  <input
                                    type="time"
                                    value={entry.jamDatang || sharedJamDatang}
                                    onChange={(e) =>
                                      handleUpdateStudentCustomization(entry.student.id, {
                                        jamDatang: e.target.value,
                                      })
                                    }
                                    className="w-full min-w-0 max-w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-base sm:text-xs font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Alasan Individual:
                                  </label>
                                  <select
                                    value={entry.alasan || sharedAlasan}
                                    onChange={(e) =>
                                      handleUpdateStudentCustomization(entry.student.id, {
                                        alasan: e.target.value as TardyReason,
                                      })
                                    }
                                    className="w-full min-w-0 max-w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs font-medium"
                                  >
                                    <option value="BANGUN_KESIANGAN">Bangun Kesiangan</option>
                                    <option value="MACET_LALULINTAS">Macet Lalu Lintas</option>
                                    <option value="KENDARAAN_MOGOK">Kendaraan Mogok</option>
                                    <option value="HUJAN_LEBAT">Hujan Lebat</option>
                                    <option value="MEMBANTU_ORANG_TUA">Membantu Orang Tua</option>
                                    <option value="LAINNYA">Lain-lain</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Bentuk Pembinaan:
                                  </label>
                                  <select
                                    value={entry.pembinaan || sharedPembinaan}
                                    onChange={(e) =>
                                      handleUpdateStudentCustomization(entry.student.id, {
                                        pembinaan: e.target.value as DisciplineAction,
                                      })
                                    }
                                    className="w-full min-w-0 max-w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs font-medium"
                                  >
                                    <option value="LITERASI_PERPUSTAKAAN">Literasi Perpustakaan</option>
                                    <option value="PEMBERSIHAN_LINGKUNGAN">Kebersihan Lingkungan</option>
                                    <option value="LITERASI_ROHANI_IBADAH">Tadarus / Ibadah</option>
                                    <option value="IKRAR_KEDISIPLINAN">Ikrar Kedisiplinan</option>
                                    <option value="PEMBINAAN_GURU_BK">Konseling Guru BK</option>
                                    <option value="SURAT_PERINGATAN_ORTU">Panggilan Orang Tua</option>
                                    <option value="LAINNYA">Lain-lain</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  Belum ada siswa yang dipilih. Cari dan pilih siswa di atas untuk mencatat keterlambatan.
                </div>
              )}
            </div>
          ) : (
            /* Mode Single Edit untuk Catatan yang Sudah Ada */
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Identitas Siswa yang Diperbarui:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Nama Siswa *
                  </label>
                  <input
                    type="text"
                    required
                    value={singleStudentName}
                    onChange={(e) => setSingleStudentName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={singleStudentKelas}
                    onChange={(e) => setSingleStudentKelas(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGIAN 2: NILAI AWAL BERSAMA (TANGGAL, JAM TIBA, ATURAN & SELISIH)        */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-500" />
                <span>Nilai Awal Bersama (Berlaku untuk Semua Siswa Terpilih)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Batas Bel: {entryLimitTime} WIB {toleranceMinutes > 0 ? `(Tol: ${toleranceMinutes} mnt)` : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tanggal Kejadian */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Tanggal Kejadian *</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                />
              </div>

              {/* Jam Tiba di Gerbang */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-4 h-4 text-rose-500" />
                  <span>Jam Tiba Bersama (WIB) *</span>
                </label>
                <input
                  type="time"
                  required
                  value={sharedJamDatang}
                  onChange={(e) => setSharedJamDatang(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Pratinjau Perhitungan Keterlambatan Bersama */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                sharedCalc.minutesLate === null
                  ? 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : sharedCalc.isLate
                  ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div>
                <span className="font-bold block">Status Perhitungan Keterlambatan Bersama:</span>
                <span className="text-[11px] opacity-80">
                  Batas Jam Masuk: {entryLimitTime} WIB &bull; Toleransi: {toleranceMinutes} Menit
                </span>
              </div>
              <div className="font-mono font-extrabold text-sm sm:text-base">
                {sharedCalc.displayText}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 3: ALASAN BERSAMA & BENTUK PEMBINAAN BERSAMA                       */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Alasan Keterlambatan Bersama *
              </label>
              <select
                value={sharedAlasan}
                onChange={(e) => {
                  const a = e.target.value as TardyReason;
                  setSharedAlasan(a);
                  if (a !== 'LAINNYA') setSharedKeteranganAlasan('');
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
              >
                <option value="BANGUN_KESIANGAN">⏰ Bangun Kesiangan</option>
                <option value="MACET_LALULINTAS">Terjebak Macet Lalu Lintas</option>
                <option value="KENDARAAN_MOGOK">Kendaraan Rusak / Mogok</option>
                <option value="HUJAN_LEBAT">Cuaca Buruk / Hujan Lebat</option>
                <option value="MEMBANTU_ORANG_TUA">Membantu Urusan Orang Tua</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Bentuk Pembinaan Kedisiplinan Bersama *
              </label>
              <select
                value={sharedPembinaan}
                onChange={(e) => {
                  const p = e.target.value as DisciplineAction;
                  setSharedPembinaan(p);
                  if (p !== 'LAINNYA') setSharedKeteranganPembinaan('');
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
              >
                <option value="LITERASI_PERPUSTAKAAN">Literasi Membaca Buku di Perpustakaan</option>
                <option value="PEMBERSIHAN_LINGKUNGAN">Kerja Bakti / Kebersihan Lingkungan Sekolah</option>
                <option value="LITERASI_ROHANI_IBADAH">Tadarus / Doa & Pembinaan Rohani</option>
                <option value="IKRAR_KEDISIPLINAN">Pengucapan Ikrar Kedisiplinan & Hormat Bendera</option>
                <option value="PEMBINAAN_GURU_BK">Konseling Khusus Guru Bimbingan Konseling</option>
                <option value="SURAT_PERINGATAN_ORTU">Penerbitan Surat Panggilan Orang Tua</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>
            </div>
          </div>

          {/* Keterangan Alasan Lainnya jika LAINNYA */}
          {sharedAlasan === 'LAINNYA' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5 text-xs">
              <label className="font-bold text-amber-900 dark:text-amber-200 block">
                Keterangan Alasan Bersama Lainnya *
              </label>
              <input
                type="text"
                required
                maxLength={300}
                value={sharedKeteranganAlasan}
                onChange={(e) => setSharedKeteranganAlasan(e.target.value)}
                placeholder="Tuliskan alasan keterlambatan lainnya secara spesifik..."
                className="w-full p-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}

          {/* Keterangan Pembinaan Lainnya jika LAINNYA */}
          {sharedPembinaan === 'LAINNYA' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5 text-xs">
              <label className="font-bold text-amber-900 dark:text-amber-200 block">
                Keterangan Pembinaan Bersama Lainnya *
              </label>
              <input
                type="text"
                required
                maxLength={300}
                value={sharedKeteranganPembinaan}
                onChange={(e) => setSharedKeteranganPembinaan(e.target.value)}
                placeholder="Tuliskan bentuk pembinaan kedisiplinan lainnya..."
                className="w-full p-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGIAN 4: CATATAN & FOTO DOKUMENTASI GERBANG                             */}
          {/* ========================================================================= */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Catatan Petugas Piket (Opsional)
            </label>
            <input
              type="text"
              value={sharedCatatanPetugas}
              onChange={(e) => setSharedCatatanPetugas(e.target.value)}
              placeholder="Contoh: Siswa diarahkan ke perpustakaan untuk literasi sebelum masuk kelas jam ke-2..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          {/* Foto Dokumentasi */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Foto Dokumentasi Siswa Terlambat
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedStudents.length > 1
                    ? 'Mode banyak siswa: Lampirkan foto pada kartu masing-masing siswa di daftar atas agar watermark tercantum sesuai nama siswa yang bersangkutan.'
                    : displayPhoto
                    ? 'Foto terlampir dengan watermark resmi'
                    : 'Opsional sebagai bukti visual kedatangan di pos gerbang'}
                </span>
              </div>
            </div>

            {selectedStudents.length <= 1 ? (
              <div className="flex items-center gap-2">
                {displayPhoto ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setIsPreviewPhotoOpen(true)}
                    >
                      Lihat Foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (selectedStudents.length === 1) {
                          setTargetStudentIdForPhoto(selectedStudents[0].student.id);
                        }
                        setIsCameraOpen(true);
                      }}
                    >
                      Ganti
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setFotoUrl(undefined);
                        if (selectedStudents.length === 1) {
                          setSelectedStudents((prev) =>
                            prev.map((s) => ({ ...s, fotoUrl: undefined }))
                          );
                        }
                      }}
                    >
                      Hapus
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Camera className="w-3.5 h-3.5" />}
                    disabled={!editingTardy && selectedStudents.length === 0}
                    onClick={() => {
                      if (selectedStudents.length === 1) {
                        setTargetStudentIdForPhoto(selectedStudents[0].student.id);
                      }
                      setIsCameraOpen(true);
                    }}
                  >
                    Ambil Foto Siswa
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
                Pilih foto per siswa di daftar atas
              </span>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div role="alert" tabIndex={-1} className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          
        </DialogForm>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI RINGKASAN SEBELUM SIMPAN (REQUIREMENT 4)                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showSummaryConfirm}
        onClose={() => setShowSummaryConfirm(false)}
        title="Konfirmasi Ringkasan Pencatatan Siswa Terlambat"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Periksa ringkasan berikut sebelum menyimpan. Setiap siswa akan dicatat secara individual di database untuk akurasi rekapitulasi dan pembinaan:
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Jumlah Siswa:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {selectedStudents.length} Siswa
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal Kejadian:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatIndonesianDate(tanggal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Batas Masuk & Toleransi:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {entryLimitTime} WIB (Tol: {toleranceMinutes} mnt)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jam Tiba:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {customizedTimesCount > 0
                  ? `${sharedJamDatang} WIB (${customizedTimesCount} siswa disesuaikan)`
                  : `${sharedJamDatang} WIB (Bersama)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Alasan & Pembinaan:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {getTardyReasonDisplay({ alasan: sharedAlasan })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSummaryConfirm(false)}
              disabled={isSubmitting}
            >
              Kembali Periksa
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Save className="w-4 h-4" />}
              onClick={executeBatchSave}
            >
              Konfirmasi & Simpan Semua
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL HASIL PENYIMPANAN BATCH & RETRY (REQUIREMENT 4)                      */}
      {/* ========================================================================= */}
      {batchResults && !batchResults.allSuccessful && (
        <Modal
          isOpen={true}
          onClose={() => setBatchResults(null)}
          title="Hasil Penyimpanan Sebagian Siswa"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-900 dark:text-amber-200">
              Beberapa catatan siswa gagal disimpan (misalnya karena duplikasi kejadian pada tanggal yang sama). Anda dapat mencoba lagi hanya untuk siswa yang gagal.
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {batchResults.results.map((res) => (
                <div
                  key={res.studentId}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    res.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800'
                  }`}
                >
                  <div>
                    <span className="font-bold block">{res.namaSiswa} ({res.kelas})</span>
                    {res.error && <span className="text-[11px] text-rose-600 block">{res.error}</span>}
                  </div>
                  <span className="font-bold text-[10px] uppercase">
                    {res.success ? 'Berhasil' : 'Gagal'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchResults(null);
                  onClose();
                }}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleRetryFailedStudents}
              >
                Coba Lagi Siswa yang Gagal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setTargetStudentIdForPhoto(null);
        }}
        onCapture={(img) => {
          if (targetStudentIdForPhoto) {
            setSelectedStudents((prev) =>
              prev.map((s) => (s.student.id === targetStudentIdForPhoto ? { ...s, fotoUrl: img } : s))
            );
            setTargetStudentIdForPhoto(null);
          } else {
            setFotoUrl(img);
          }
          setIsCameraOpen(false);
        }}
        title={
          targetStudentIdForPhoto
            ? `Foto Siswa: ${selectedStudents.find((s) => s.student.id === targetStudentIdForPhoto)?.student.nama || 'Siswa'}`
            : 'Foto Dokumentasi Siswa Terlambat'
        }
        subtitle="Foto otomatis dibubuhi watermark resmi panel bawah (identitas siswa, kelas, waktu tiba WIB, dan GPS jika ada)"
        watermarkProcessor={async (canvas, capturedAt, isUpload) => {
          const coords = await detectLocationForWatermark();
          const targetStudent = targetStudentIdForPhoto
            ? selectedStudents.find((s) => s.student.id === targetStudentIdForPhoto)
            : selectedStudents.length === 1
            ? selectedStudents[0]
            : null;
          const studentName = targetStudent ? targetStudent.student.nama : singleStudentName;
          const studentKelas = targetStudent ? targetStudent.student.kelas : singleStudentKelas;
          const briefIdentity = `Siswa: ${studentName || 'Siswa'}${studentKelas ? ` • Kelas: ${studentKelas}` : ''}`;

          return stampDocumentationPhoto(
            canvas,
            {
              module: 'STUDENT_TARDY',
              schoolName: settings?.schoolName || 'Sekolah',
              schoolLogoUrl: settings?.logoUrl,
              officerName: currentUser?.fullName || 'Petugas Piket',
              officerId: currentUser?.id,
              documentationTime: capturedAt,
              eventDate: tanggal,
              eventTime: targetStudent?.jamDatang || sharedJamDatang,
              isUploadedPhoto: isUpload,
              briefIdentity,
              coords,
              notes: targetStudent?.alasan || sharedAlasan,
            },
            settings?.documentationWatermark || DEFAULT_DOCUMENTATION_WATERMARK_CONFIG
          );
        }}
      />

      {/* Photo Zoom Preview Modal */}
      {displayPhoto && (
        <Modal
          isOpen={isPreviewPhotoOpen}
          onClose={() => setIsPreviewPhotoOpen(false)}
          title="Foto Dokumentasi Siswa Terlambat"
          maxWidth="md"
        >
          <div className="space-y-3 text-center">
            <img
              src={displayPhoto}
              alt="Preview Siswa Terlambat"
              className="w-full max-h-[70vh] object-contain rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
            />
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsPreviewPhotoOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
