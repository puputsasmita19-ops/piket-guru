import { DialogForm } from '../../components/common/DialogForm';
import { Navigation } from '../../components/icons';
import { Plus } from '../../components/icons';
import { Check } from '../../components/icons';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  StudentPermitRecord,
  StudentPermitType,
  STUDENT_PERMIT_TYPES,
  getStudentPermitTypeDisplay,
  BatchStudentPermitPayload,
  BatchPermitResult,
  StudentPermitItemInput,
} from '../../types/studentPermit.types';
import { TeacherRecord, StudentRecord, getStudentIdentifierInfo } from '../../types/master.types';
import { StudentService } from '../../services/firebase/studentService';
import { StudentPermitService } from '../../services/firebase/studentPermitService';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import {
  FileText,
  User,
  GraduationCap,
  Phone,
  Clock,
  AlertCircle,
  Sparkles,
  Search,
  Save,
  Users,
  AlertTriangle,
  Loader2,
  X,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sliders,
  RefreshCw,
  Send,
} from '../../components/icons';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';

interface SelectedStudentEntry {
  student: StudentRecord;
  isCustomized: boolean;
  jamKeluar?: string;
  targetReturnTime?: string;
  alasan?: string;
  penjemput?: 'ORANG_TUA' | 'SENDIRI' | 'GURU_PEMBINA' | 'WALI';
  namaPenjemput?: string;
  noHpKhusus?: string;
  isExpanded?: boolean;
  requestId: string;
}

interface StudentPermitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (
    data: Partial<StudentPermitRecord>,
    isEdit?: boolean
  ) => Promise<void>;
  editingPermit?: StudentPermitRecord | null;
  teachers: TeacherRecord[];
}

export const StudentPermitFormModal: React.FC<StudentPermitFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPermit = null,
  teachers = [],
}) => {
  const { currentUser } = useAuth();

  // Mode: Edit single permit vs Create (Multi-Student)
  const isEditMode = Boolean(editingPermit);

  // Form Step: 'FORM' | 'SUMMARY' | 'RESULT'
  const [currentStep, setCurrentStep] = useState<'FORM' | 'SUMMARY' | 'RESULT'>('FORM');

  // Shared Values (Nilai Bersama)
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamKeluarUmum, setJamKeluarUmum] = useState(formatTime(new Date()));
  const [targetReturnTimeUmum, setTargetReturnTimeUmum] = useState('');
  const [jenisIzin, setJenisIzin] = useState<StudentPermitType>('SAKIT_PULANG');
  const [keteranganLainnya, setKeteranganLainnya] = useState('');
  const [alasanUmum, setAlasanUmum] = useState('');
  const [penjemputUmum, setPenjemputUmum] = useState<'ORANG_TUA' | 'SENDIRI' | 'GURU_PEMBINA' | 'WALI'>('ORANG_TUA');
  const [namaPenjemputUmum, setNamaPenjemputUmum] = useState('');
  const [guruPengajarName, setGuruPengajarName] = useState('');
  const [catatanPetugas, setCatatanPetugas] = useState('');

  // Single permit state (for edit mode)
  const [singleStudentId, setSingleStudentId] = useState<string | undefined>(undefined);
  const [singleNamaSiswa, setSingleNamaSiswa] = useState('');
  const [singleNisn, setSingleNisn] = useState('');
  const [singleKelas, setSingleKelas] = useState('');
  const [singleNoHpOrangTua, setSingleNoHpOrangTua] = useState('');

  // Multi-Student state
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudentEntry[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Group Identifier for current creation session
  const [sessionGroupId, setSessionGroupId] = useState(`grp-${Date.now().toString(36)}`);

  // Master students directory
  const [studentDirectory, setStudentDirectory] = useState<StudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // Active permit conflicts (students currently outside)
  const [activeConflicts, setActiveConflicts] = useState<Record<string, StudentPermitRecord>>({});
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Batch Result state
  const [batchResult, setBatchResult] = useState<BatchPermitResult | null>(null);

  // Submission state & errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [availableDraft, setAvailableDraft] = useState<{ updatedAt: string; data: any } | null>(null);

  const draftKey = editingPermit?.id || 'new-permit-multi';

  // Concurrency detection for edit mode
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null);
  const [hasConcurrencyConflict, setHasConcurrencyConflict] = useState(false);

  // Load students directory fresh from master
  useEffect(() => {
    let isMounted = true;
    setIsLoadingStudents(true);
    StudentService.getAllStudents()
      .then((data) => {
        if (isMounted) {
          // Sort active students first, then alphabetical
          const sorted = [...data].sort((a, b) => a.nama.localeCompare(b.nama));
          setStudentDirectory(sorted);
          setIsLoadingStudents(false);
        }
      })
      .catch((err) => {
        console.warn('Error fetching student directory:', err);
        if (isMounted) setIsLoadingStudents(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter students based on name, NIS, NISN, or Class
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return studentDirectory.slice(0, 10);
    const q = studentSearchTerm.toLowerCase();
    return studentDirectory
      .filter((s) => {
        const matchName = s.nama.toLowerCase().includes(q);
        const matchNis = s.nis && s.nis.toLowerCase().includes(q);
        const matchNisn = s.nisn && s.nisn.toLowerCase().includes(q);
        const matchId = s.studentId && s.studentId.toLowerCase().includes(q);
        const matchKelas = s.kelas && s.kelas.toLowerCase().includes(q);
        return matchName || matchNis || matchNisn || matchId || matchKelas;
      })
      .slice(0, 15);
  }, [studentDirectory, studentSearchTerm]);

  // Check active conflicts whenever selectedStudents or tanggal changes
  useEffect(() => {
    if (isEditMode || selectedStudents.length === 0) {
      setActiveConflicts({});
      return;
    }

    let isMounted = true;
    setIsCheckingConflicts(true);
    const ids = selectedStudents.map((s) => s.student.id);

    StudentPermitService.getActivePermitsForStudents(ids, tanggal)
      .then((conflicts) => {
        if (isMounted) {
          setActiveConflicts(conflicts);
          setIsCheckingConflicts(false);
        }
      })
      .catch((err) => {
        console.warn('Error checking active permits:', err);
        if (isMounted) setIsCheckingConflicts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudents, tanggal, isEditMode]);

  // Reset or prefill form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('FORM');
      setBatchResult(null);
      setErrorMessage(null);
      setFieldErrors({});

      if (editingPermit) {
        // Edit mode (single permit)
        setTanggal(editingPermit.tanggal || new Date().toISOString().split('T')[0]);
        setJamKeluarUmum(editingPermit.jamKeluar || formatTime(new Date()));
        setTargetReturnTimeUmum(editingPermit.targetReturnTime || '');
        setSingleStudentId(editingPermit.studentId);
        setSingleNamaSiswa(editingPermit.namaSiswa || '');
        setSingleNisn(editingPermit.nisn || '');
        setSingleKelas(editingPermit.kelas || '');
        setSingleNoHpOrangTua(editingPermit.noHpOrangTua || '');
        setJenisIzin(editingPermit.jenisIzin || 'SAKIT_PULANG');
        setKeteranganLainnya(editingPermit.keteranganLainnya || '');
        setAlasanUmum(editingPermit.alasan || '');
        setPenjemputUmum(editingPermit.penjemput || 'ORANG_TUA');
        setNamaPenjemputUmum(editingPermit.namaPenjemput || '');
        setGuruPengajarName(editingPermit.guruPengajarName || '');
        setCatatanPetugas(editingPermit.catatanPetugas || '');
        setOriginalUpdatedAt(editingPermit.updatedAt || null);
        setSelectedStudents([]);
      } else {
        // New multi-student mode
        const newGroupId = `grp-${Date.now().toString(36)}`;
        setSessionGroupId(newGroupId);
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamKeluarUmum(formatTime(new Date()));
        setTargetReturnTimeUmum('');
        setJenisIzin('SAKIT_PULANG');
        setKeteranganLainnya('');
        setAlasanUmum('');
        setPenjemputUmum('ORANG_TUA');
        setNamaPenjemputUmum('');
        setGuruPengajarName('');
        setCatatanPetugas('');
        setSelectedStudents([]);
        setStudentSearchTerm('');
        setOriginalUpdatedAt(null);
      }

      setHasConcurrencyConflict(false);
      setIsStudentDropdownOpen(false);
      setIsSubmitting(false);
      setAvailableDraft(null);

      // Check for saved local draft (new mode only)
      if (currentUser?.id && !editingPermit) {
        DraftService.getDraft(currentUser.id, 'STUDENT_PERMIT', draftKey).then((saved) => {
          if (saved && saved.data) {
            setAvailableDraft({ updatedAt: saved.updatedAt, data: saved.data });
          }
        });
      }
    }
  }, [isOpen, editingPermit, currentUser?.id, draftKey]);

  // Debounced auto-save draft while filling
  useEffect(() => {
    if (!isOpen || !currentUser?.id || editingPermit || currentStep !== 'FORM') return;
    if (selectedStudents.length === 0 && !alasanUmum.trim()) return;

    DraftService.saveDraftDebounced(currentUser.id, 'STUDENT_PERMIT', draftKey, {
      sessionGroupId,
      tanggal,
      jamKeluarUmum,
      targetReturnTimeUmum,
      jenisIzin,
      keteranganLainnya,
      alasanUmum,
      penjemputUmum,
      namaPenjemputUmum,
      guruPengajarName,
      catatanPetugas,
      selectedStudentIds: selectedStudents.map((s) => s.student.id),
    });
  }, [
    isOpen,
    currentUser?.id,
    editingPermit,
    currentStep,
    sessionGroupId,
    tanggal,
    jamKeluarUmum,
    targetReturnTimeUmum,
    jenisIzin,
    keteranganLainnya,
    alasanUmum,
    penjemputUmum,
    namaPenjemputUmum,
    guruPengajarName,
    catatanPetugas,
    selectedStudents,
    draftKey,
  ]);

  const handleRestoreDraft = () => {
    if (!availableDraft?.data) return;
    const d = availableDraft.data;
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.jamKeluarUmum) setJamKeluarUmum(d.jamKeluarUmum);
    if (d.targetReturnTimeUmum !== undefined) setTargetReturnTimeUmum(d.targetReturnTimeUmum);
    if (d.jenisIzin) setJenisIzin(d.jenisIzin);
    if (d.keteranganLainnya !== undefined) setKeteranganLainnya(d.keteranganLainnya);
    if (d.alasanUmum) setAlasanUmum(d.alasanUmum);
    if (d.penjemputUmum) setPenjemputUmum(d.penjemputUmum);
    if (d.namaPenjemputUmum !== undefined) setNamaPenjemputUmum(d.namaPenjemputUmum);
    if (d.guruPengajarName !== undefined) setGuruPengajarName(d.guruPengajarName);
    if (d.catatanPetugas !== undefined) setCatatanPetugas(d.catatanPetugas);

    if (Array.isArray(d.selectedStudentIds) && studentDirectory.length > 0) {
      const restored = d.selectedStudentIds
        .map((id: string) => studentDirectory.find((s) => s.id === id))
        .filter(Boolean) as StudentRecord[];

      setSelectedStudents(
        restored.map((std) => ({
          student: std,
          isCustomized: false,
          isExpanded: false,
          requestId: `req-${sessionGroupId}-${std.id}`,
        }))
      );
    }

    setAvailableDraft(null);
  };

  const handleDiscardDraft = async () => {
    if (!currentUser?.id) return;
    await DraftService.deleteDraft(currentUser.id, 'STUDENT_PERMIT', draftKey);
    setAvailableDraft(null);
  };

  // Real-time concurrency listener for edit mode
  useEffect(() => {
    if (isOpen && editingPermit?.id && originalUpdatedAt) {
      const unsub = FirestoreService.subscribeToDocument<StudentPermitRecord>(
        'studentPermits',
        editingPermit.id,
        (doc) => {
          if (doc && doc.updatedAt && originalUpdatedAt && doc.updatedAt !== originalUpdatedAt) {
            setHasConcurrencyConflict(true);
          }
        }
      );
      return () => {
        unsub();
      };
    }
  }, [isOpen, editingPermit?.id, originalUpdatedAt]);

  // Add student to selection
  const handleAddStudent = (std: StudentRecord) => {
    if (selectedStudents.some((s) => s.student.id === std.id)) {
      return; // Cegah pemilihan duplikat
    }

    const newEntry: SelectedStudentEntry = {
      student: std,
      isCustomized: false,
      isExpanded: false,
      requestId: `req-${sessionGroupId}-${std.id}`,
    };

    setSelectedStudents((prev) => [...prev, newEntry]);
    setStudentSearchTerm('');
    setIsStudentDropdownOpen(false);

    if (fieldErrors.selectedStudents) {
      setFieldErrors((prev) => ({ ...prev, selectedStudents: '' }));
    }
  };

  // Remove individual student
  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.student.id !== studentId));
  };

  // Toggle customize individual student
  const handleToggleCustomize = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.map((s) => {
        if (s.student.id !== studentId) return s;
        const nextCustomized = !s.isCustomized;
        return {
          ...s,
          isCustomized: nextCustomized,
          isExpanded: nextCustomized ? true : s.isExpanded,
          jamKeluar: nextCustomized ? s.jamKeluar || jamKeluarUmum : undefined,
          targetReturnTime: nextCustomized ? s.targetReturnTime || targetReturnTimeUmum : undefined,
          alasan: nextCustomized ? s.alasan || alasanUmum : undefined,
          penjemput: nextCustomized ? s.penjemput || penjemputUmum : undefined,
          namaPenjemput: nextCustomized ? s.namaPenjemput || namaPenjemputUmum : undefined,
          noHpKhusus: nextCustomized ? s.noHpKhusus || s.student.noHpOrangTua : undefined,
        };
      })
    );
  };

  // Toggle expand individual student card
  const handleToggleExpand = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.map((s) => (s.student.id === studentId ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  };

  // Update customized field for a student
  const handleUpdateStudentCustom = (studentId: string, fields: Partial<SelectedStudentEntry>) => {
    setSelectedStudents((prev) =>
      prev.map((s) => (s.student.id === studentId ? { ...s, ...fields } : s))
    );
  };

  // Apply shared escort to all students explicitly
  const handleApplyEscortToAll = () => {
    setSelectedStudents((prev) =>
      prev.map((s) => ({
        ...s,
        penjemput: penjemputUmum,
        namaPenjemput: namaPenjemputUmum,
      }))
    );
  };

  // Validate form before summary
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (isEditMode) {
      if (!singleNamaSiswa.trim()) {
        errors.singleNamaSiswa = 'Nama siswa wajib diisi';
        missing.push('Nama Siswa');
      }
      if (!singleKelas.trim()) {
        errors.singleKelas = 'Kelas siswa wajib diisi';
        missing.push('Kelas Siswa');
      }
    } else {
      if (selectedStudents.length === 0) {
        errors.selectedStudents = 'Pilih minimal satu siswa untuk diterbitkan surat izin';
        missing.push('Siswa Terpilih');
      }

      // Check if any selected student currently has active conflict
      const hasConflict = selectedStudents.some((s) => activeConflicts[s.student.id]);
      if (hasConflict) {
        errors.activeConflict =
          'Terdapat siswa yang masih berstatus SEDANG_KELUAR (belum tercatat kembali). Hapus siswa tersebut atau catat kembali terlebih dahulu.';
      }
    }

    if (!tanggal) {
      errors.tanggal = 'Tanggal izin wajib diisi';
      missing.push('Tanggal');
    }

    if (!jamKeluarUmum) {
      errors.jamKeluarUmum = 'Jam keluar wajib diisi';
      missing.push('Jam Keluar');
    }

    if (jenisIzin === 'LAINNYA') {
      const trimmedKet = keteranganLainnya.trim();
      if (!trimmedKet) {
        errors.keteranganLainnya = 'Keterangan keperluan lainnya wajib diisi';
        missing.push('Keterangan Keperluan');
      } else if (trimmedKet.length > 300) {
        errors.keteranganLainnya = 'Keterangan keperluan tidak boleh lebih dari 300 karakter';
      }
    }

    if (!alasanUmum.trim()) {
      errors.alasanUmum = 'Uraian rincian alasan izin wajib diisi';
      missing.push('Uraian Alasan');
    }

    if (missing.length > 0 || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage(
        errors.activeConflict
          ? errors.activeConflict
          : missing.length > 0
          ? `Bagian wajib belum lengkap: ${missing.join(', ')}. Harap periksa formulir.`
          : 'Terdapat isian yang belum sesuai. Harap periksa kembali formulir.'
      );
      return false;
    }

    setErrorMessage(null);
    setFieldErrors({});
    return true;
  };

  // Advance to summary
  const handleProceedToSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setCurrentStep('SUMMARY');
    }
  };

  // Submit batch or single permit
  const handleExecuteSave = async () => {
    if (isSubmitting || !currentUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditMode && editingPermit) {
        // Edit mode (single)
        const payload: Partial<StudentPermitRecord> = {
          id: editingPermit.id,
          groupId: editingPermit.groupId,
          studentId: singleStudentId,
          tanggal,
          jamKeluar: jamKeluarUmum,
          targetReturnTime: targetReturnTimeUmum || undefined,
          jamKembali: editingPermit.jamKembali,
          namaSiswa: singleNamaSiswa.trim(),
          nisn: singleNisn.trim() || '-',
          kelas: singleKelas.trim(),
          jenisIzin,
          keteranganLainnya: jenisIzin === 'LAINNYA' ? keteranganLainnya.trim() : undefined,
          alasan: alasanUmum.trim(),
          penjemput: penjemputUmum,
          namaPenjemput:
            namaPenjemputUmum.trim() ||
            (penjemputUmum === 'SENDIRI'
              ? 'Pulang Mandiri'
              : penjemputUmum === 'GURU_PEMBINA'
              ? 'Guru Pembina'
              : 'Orang Tua / Wali'),
          noHpOrangTua: singleNoHpOrangTua.trim() || undefined,
          guruPengajarName: guruPengajarName.trim() || undefined,
          petugasPiketName: editingPermit.petugasPiketName || currentUser.fullName,
          petugasPiketId: editingPermit.petugasPiketId || currentUser.id,
          status: editingPermit.status,
          catatanPetugas: catatanPetugas.trim() || undefined,
        };

        if (onSave) {
          await onSave(payload, true);
        } else {
          await StudentPermitService.updatePermit(payload as any, currentUser);
        }

        onClose();
        return;
      }

      // Multi-Student creation
      const studentItems: StudentPermitItemInput[] = selectedStudents.map((s) => ({
        requestId: s.requestId,
        studentId: s.student.id,
        namaSiswa: s.student.nama,
        nisn: s.student.nisn || s.student.nis || '-',
        kelas: s.student.kelas || 'Tanpa Kelas',
        noHpOrangTua: s.student.noHpOrangTua,
        isCustomized: s.isCustomized,
        jamKeluar: s.jamKeluar,
        targetReturnTime: s.targetReturnTime,
        alasan: s.alasan,
        penjemput: s.penjemput,
        namaPenjemput: s.namaPenjemput,
        noHpKhusus: s.noHpKhusus,
      }));

      const batchPayload: BatchStudentPermitPayload = {
        groupId: sessionGroupId,
        tanggal,
        jamKeluarUmum,
        targetReturnTimeUmum: targetReturnTimeUmum || undefined,
        jenisIzinUmum: jenisIzin,
        keteranganLainnyaUmum: jenisIzin === 'LAINNYA' ? keteranganLainnya.trim() : undefined,
        alasanUmum: alasanUmum.trim(),
        penjemputUmum,
        namaPenjemputUmum: namaPenjemputUmum.trim() || undefined,
        guruPengajarName: guruPengajarName.trim() || undefined,
        catatanPetugas: catatanPetugas.trim() || undefined,
        students: studentItems,
      };

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        // Antrekan secara offline
        for (const item of studentItems) {
          const recId = item.requestId || `pmt-${tanggal}-${sessionGroupId}-${item.studentId}`;
          await SyncQueueService.enqueue(
            currentUser,
            'PERMIT_REPORT',
            'studentPermits',
            recId,
            {
              record: {
                id: recId,
                groupId: sessionGroupId,
                studentId: item.studentId,
                namaSiswa: item.namaSiswa,
                nisn: item.nisn,
                kelas: item.kelas,
                tanggal,
                jamKeluar: item.jamKeluar || jamKeluarUmum,
                jenisIzin,
                alasan: item.alasan || alasanUmum,
                penjemput: item.penjemput || penjemputUmum,
                namaPenjemput: item.namaPenjemput || namaPenjemputUmum,
                noHpOrangTua: item.noHpKhusus || item.noHpOrangTua,
                petugasPiketName: currentUser.fullName,
                petugasPiketId: currentUser.id,
                status:
                  jenisIzin === 'KELUAR_SEBENTAR' || jenisIzin === 'DISPENSASI_LOMBA'
                    ? 'SEDANG_KELUAR'
                    : 'SELESAI_PULANG',
              },
              isUpdate: false,
            }
          );
        }
        await DraftService.deleteDraft(currentUser.id, 'STUDENT_PERMIT', draftKey);
        onClose();
        return;
      }

      // Eksekusi createBatchPermits di Firestore
      const res = await StudentPermitService.createBatchPermits(batchPayload, currentUser);
      setBatchResult(res);

      if (res.failureCount === 0) {
        // Semua berhasil
        await DraftService.deleteDraft(currentUser.id, 'STUDENT_PERMIT', draftKey);
        onClose();
      } else {
        // Ada yang gagal, tampilkan Result step agar pengguna dapat meninjau dan retry
        setCurrentStep('RESULT');
        // Hapus siswa yang sudah berhasil dari state formulir, pertahankan siswa yang gagal
        const succeededIds = new Set(res.items.filter((i) => i.success).map((i) => i.studentId));
        setSelectedStudents((prev) => prev.filter((s) => !succeededIds.has(s.student.id)));
      }
    } catch (err: any) {
      console.warn('[StudentPermitFormModal] Execution error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan surat izin siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry failed items
  const handleRetryFailed = async () => {
    setCurrentStep('SUMMARY');
    await handleExecuteSave();
  };

  // RENDER MODAL TITLE
  const modalTitle = isEditMode
    ? 'Ubah Surat Izin Keluar Siswa'
    : currentStep === 'SUMMARY'
    ? 'Konfirmasi & Ringkasan Penerbitan Surat Izin'
    : currentStep === 'RESULT'
    ? 'Hasil Penerbitan Surat Izin Gerbang'
    : 'Terbitkan Surat Izin Keluar Sekolah (Gate Pass)';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth={currentStep === 'SUMMARY' || currentStep === 'RESULT' ? 'lg' : '2xl'}
    >
      {/* ========================================================================= */}
      {/* STEP 1: FORM INPUT UTAMA (MULTI-SISWA ATAU EDIT)                          */}
      {/* ========================================================================= */}
      {currentStep === 'FORM' && (
        <DialogForm onSubmit={handleProceedToSummary} noValidate className="flex flex-col gap-5 sm:gap-6" actions={<div className="app-form-actions flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-4 text-xs font-semibold"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="h-11 px-6 font-bold text-xs"
              isLoading={isSubmitting}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {isEditMode
                ? 'Lanjut ke Ringkasan Perubahan'
                : `Lanjut ke Ringkasan (${selectedStudents.length} Siswa)`}
            </Button>
          </div>}>
          {/* Uncommitted Local Draft Banner */}
          {availableDraft && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold">Ditemukan draf penerbitan izin tersimpan di perangkat ini</p>
                  <p className="text-amber-700 dark:text-amber-400">
                    Terakhir diperbarui pada {new Date(availableDraft.updatedAt).toLocaleTimeString('id-ID')} WIB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                >
                  Lanjutkan Draf
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
                  title="Buang Draf"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Buang</span>
                </button>
              </div>
            </div>
          )}

          {/* CONCURRENCY WARNING (Edit Mode) */}
          {hasConcurrencyConflict && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Peringatan: Dokumen ini telah diperbarui oleh pengguna lain.</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Data izin siswa ini baru saja diubah di server. Jika Anda melanjutkan penyimpanan, perubahan terbaru tersebut akan ditimpa.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1: PEMILIHAN SISWA (MULTI-SELECT DI MODE BARU)                    */}
          {/* ========================================================================= */}
          {isEditMode ? (
            /* Mode Ubah Single Permit */
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 w-full bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  <span>Nama Lengkap Siswa *</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleNamaSiswa}
                  onChange={(e) => setSingleNamaSiswa(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-500" />
                  <span>Kelas Siswa *</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleKelas}
                  onChange={(e) => setSingleKelas(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>
          ) : (
            /* Mode Terbitkan Multi-Siswa */
            <div className="space-y-3 w-full bg-slate-50/70 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Pilih Siswa (Multi-Select) *</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-lg">
                    {selectedStudents.length} Siswa Terpilih
                  </span>
                  {selectedStudents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudents([])}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>
              </div>

              {/* Input Pencarian Siswa */}
              <div className="relative w-full">
                <input
                  type="text"
                  value={studentSearchTerm}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                  onChange={(e) => {
                    setStudentSearchTerm(e.target.value);
                    setIsStudentDropdownOpen(true);
                  }}
                  placeholder="Ketik nama siswa, NIS, NISN, atau kelas (contoh: Ahmad, 008123, X MIPA)..."
                  className="w-full h-12 px-3.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                {/* Dropdown Pencarian Siswa */}
                {isStudentDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Pilih siswa untuk ditambahkan ke izin keluar:</span>
                      <button
                        type="button"
                        onClick={() => setIsStudentDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Tutup <X className="w-3.5 h-3.5 ml-1" />
                      </button>
                    </div>
                    {isLoadingStudents ? (
                      <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Memuat data siswa...</span>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Tidak ditemukan siswa dengan kata kunci "{studentSearchTerm}".
                      </div>
                    ) : (
                      filteredStudents.map((s) => {
                        const isSelected = selectedStudents.some((item) => item.student.id === s.id);
                        const idInfo = getStudentIdentifierInfo(s);
                        return (
                          <div
                            key={s.id}
                            onMouseDown={() => {
                              if (!isSelected) {
                                handleAddStudent(s);
                              }
                            }}
                            className={`p-3 text-xs flex items-center justify-between gap-3 transition-colors ${
                              isSelected
                                ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed'
                                : 'hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-slate-900 dark:text-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold flex items-center gap-2">
                                <span className="truncate">{s.nama}</span>
                                {isSelected && (
                                  <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded font-normal shrink-0">
                                    Sudah Dipilih
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">{s.kelas || 'Tanpa Kelas'}</span>
                                <span>•</span>
                                <span>{idInfo.displayBadge}</span>
                                {s.noHpOrangTua && (
                                  <>
                                    <span>•</span>
                                    <span><Phone className="w-3.5 h-3.5 mr-1" />{s.noHpOrangTua}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? 'ghost' : 'outline'}
                              className="text-[11px] h-7 px-2 shrink-0"
                              disabled={isSelected}
                            >
                              {isSelected ? <><Check className="w-3 h-3 mr-1" />Terpilih</> : <><Plus className="w-3 h-3 mr-1" />Tambah</>}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Daftar Siswa Terpilih (Chips / Cards) */}
              {selectedStudents.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedStudents.map((item, index) => {
                      const idInfo = getStudentIdentifierInfo(item.student);
                      const hasConflict = Boolean(activeConflicts[item.student.id]);
                      const conflict = activeConflicts[item.student.id];

                      return (
                        <div
                          key={item.student.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                            hasConflict
                              ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-bold truncate">
                              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <span className="truncate">{item.student.nama}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap font-mono">
                              <span className="font-bold text-blue-600 dark:text-blue-400">{item.student.kelas}</span>
                              <span>•</span>
                              <span>{idInfo.displayBadge}</span>
                            </div>

                            {/* Alert jika siswa masih berstatus SEDANG_KELUAR */}
                            {hasConflict && conflict && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Masih di luar ({conflict.jamKeluar} WIB)</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(item.student.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                            title="Hapus Siswa Ini"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  Belum ada siswa yang dipilih. Cari dan pilih siswa di atas.
                </div>
              )}

              {fieldErrors.selectedStudents && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.selectedStudents}</p>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: DATA BERSAMA (SHARED INITIAL VALUES)                           */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Ketentuan Waktu & Keperluan Bersama</span>
            </h3>

            {/* Tanggal & Jam Keluar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tanggal Izin Keluar *
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Jam Meninggalkan Sekolah (WIB) *
                </label>
                <input
                  type="time"
                  required
                  value={jamKeluarUmum}
                  onChange={(e) => setJamKeluarUmum(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Jenis Izin */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Jenis Izin / Keperluan Meninggalkan Sekolah *
                </label>
                <select
                  value={jenisIzin}
                  onChange={(e) => setJenisIzin(e.target.value as StudentPermitType)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {STUDENT_PERMIT_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>{t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keterangan Tambahan jika LAINNYA */}
              {jenisIzin === 'LAINNYA' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                    <span>Keterangan Keperluan Lainnya *</span>
                    <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                      {keteranganLainnya.length}/300
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={300}
                    value={keteranganLainnya}
                    onChange={(e) => setKeteranganLainnya(e.target.value)}
                    placeholder="Tuliskan keterangan keperluan izin siswa (wajib, maks. 300 karakter)..."
                    className="w-full h-10 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  {fieldErrors.keteranganLainnya && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.keteranganLainnya}</p>
                  )}
                </div>
              )}

              {/* Estimasi Jam Kembali (Jika KELUAR_SEBENTAR) */}
              {jenisIzin === 'KELUAR_SEBENTAR' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 space-y-1">
                  <label className="text-xs font-bold text-blue-900 dark:text-blue-200 block">
                    Estimasi Jam Kembali ke Sekolah (Opsional)
                  </label>
                  <input
                    type="time"
                    value={targetReturnTimeUmum}
                    onChange={(e) => setTargetReturnTimeUmum(e.target.value)}
                    className="w-full sm:w-48 h-9 px-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Uraian Alasan Bersama */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Uraian Rincian Alasan Izin *
              </label>
              <textarea
                required
                rows={3}
                value={alasanUmum}
                onChange={(e) => setAlasanUmum(e.target.value)}
                placeholder="Tuliskan keterangan detail alasan siswa diberikan izin keluar gerbang sekolah..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {fieldErrors.alasanUmum && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.alasanUmum}</p>
              )}
            </div>

            {/* PENDAMPING BERSAMA & OPSI TERAPKAN KE SELURUH SISWA */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Pendamping / Penjemput Awal *</span>
                </label>
                {selectedStudents.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-7 px-2.5 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                    onClick={handleApplyEscortToAll}
                  >
                    Terapkan Pendamping Ini ke Semua Siswa
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: 'ORANG_TUA', label: 'Orang Tua / Wali', icon: Users },
                  { value: 'WALI', label: 'Kerabat / Wali', icon: User },
                  { value: 'GURU_PEMBINA', label: 'Guru Pembina', icon: GraduationCap },
                  { value: 'SENDIRI', label: 'Pulang Mandiri', icon: Navigation },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-semibold ${
                      penjemputUmum === opt.value
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="penjemputUmum"
                      value={opt.value}
                      checked={penjemputUmum === opt.value}
                      onChange={() => setPenjemputUmum(opt.value as any)}
                      className="w-3.5 h-3.5 text-emerald-600"
                    />
                    <span className="inline-flex items-center gap-1.5"><opt.icon className="w-4 h-4" />{opt.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nama Pendamping / Penjemput
                  </label>
                  <input
                    type="text"
                    value={namaPenjemputUmum}
                    onChange={(e) => setNamaPenjemputUmum(e.target.value)}
                    placeholder={
                      penjemputUmum === 'SENDIRI'
                        ? 'Pulang Mandiri'
                        : penjemputUmum === 'GURU_PEMBINA'
                        ? 'Nama Guru Pembina...'
                        : 'Nama Orang Tua / Wali...'
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                {isEditMode && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      No. WhatsApp Orang Tua / Wali
                    </label>
                    <input
                      type="tel"
                      value={singleNoHpOrangTua}
                      onChange={(e) => setSingleNoHpOrangTua(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Guru Mapel & Catatan Petugas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Guru Pengajar saat Jam Berlangsung (Opsional)
                </label>
                <input
                  type="text"
                  list="teachers-permit-datalist"
                  value={guruPengajarName}
                  onChange={(e) => setGuruPengajarName(e.target.value)}
                  placeholder="Ketik atau pilih nama guru..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
                <datalist id="teachers-permit-datalist">
                  {teachers.map((t) => (
                    <option key={t.id} value={`${t.fullName} (${t.mataPelajaran})`} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Tambahan Petugas Gerbang (Opsional)
                </label>
                <input
                  type="text"
                  value={catatanPetugas}
                  onChange={(e) => setCatatanPetugas(e.target.value)}
                  placeholder="Contoh: Diantar ke pos satpam..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: KUSTOMISASI RINCIAN PER SISWA (SESUAIKAN PER SISWA)           */}
          {/* ========================================================================= */}
          {!isEditMode && selectedStudents.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  <span>Kustomisasi Rincian Khusus Per Siswa (Opsional)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {selectedStudents.filter((s) => s.isCustomized).length} dari {selectedStudents.length} disesuaikan
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Secara default semua siswa menggunakan jam keluar, alasan, dan pendamping bersama. Klik "Sesuaikan" jika siswa memiliki jam keluar, alasan, atau pendamping yang berbeda. Nomor kontak orang tua diambil langsung dari data master masing-masing siswa.
              </p>

              <div className="space-y-2">
                {selectedStudents.map((entry, idx) => (
                  <div
                    key={entry.student.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden"
                  >
                    <div className="p-3 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {idx + 1}. {entry.student.nama}
                        </span>
                        <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                          {entry.student.kelas}
                        </Badge>
                        {entry.isCustomized && (
                          <Badge variant="primary" size="sm" className="text-[10px]">
                            Disesuaikan
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCustomize(entry.student.id)}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                            entry.isCustomized
                              ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                          }`}
                        >
                          {entry.isCustomized ? 'Gunakan Nilai Bersama' : 'Sesuaikan Rincian'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleExpand(entry.student.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {entry.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Rincian Khusus Siswa saat Expanded */}
                    {entry.isExpanded && (
                      <div className="p-3.5 space-y-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                        {entry.isCustomized ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                                  Jam Keluar Khusus (WIB)
                                </label>
                                <input
                                  type="time"
                                  value={entry.jamKeluar || jamKeluarUmum}
                                  onChange={(e) =>
                                    handleUpdateStudentCustom(entry.student.id, { jamKeluar: e.target.value })
                                  }
                                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                                  No. Kontak Orang Tua / Penjemput
                                </label>
                                <input
                                  type="tel"
                                  value={entry.noHpKhusus || entry.student.noHpOrangTua || ''}
                                  onChange={(e) =>
                                    handleUpdateStudentCustom(entry.student.id, { noHpKhusus: e.target.value })
                                  }
                                  placeholder="Nomor kontak..."
                                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                                Alasan Khusus Siswa Ini
                              </label>
                              <input
                                type="text"
                                value={entry.alasan || alasanUmum}
                                onChange={(e) =>
                                  handleUpdateStudentCustom(entry.student.id, { alasan: e.target.value })
                                }
                                placeholder="Alasan khusus siswa..."
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                                  Pendamping Khusus
                                </label>
                                <select
                                  value={entry.penjemput || penjemputUmum}
                                  onChange={(e) =>
                                    handleUpdateStudentCustom(entry.student.id, {
                                      penjemput: e.target.value as any,
                                    })
                                  }
                                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                                >
                                  <option value="ORANG_TUA">Orang Tua / Wali</option>
                                  <option value="WALI">Kerabat / Wali</option>
                                  <option value="GURU_PEMBINA">Guru Pembina</option>
                                  <option value="SENDIRI">Pulang Mandiri</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                                  Nama Penjemput Khusus
                                </label>
                                <input
                                  type="text"
                                  value={entry.namaPenjemput !== undefined ? entry.namaPenjemput : namaPenjemputUmum}
                                  onChange={(e) =>
                                    handleUpdateStudentCustom(entry.student.id, {
                                      namaPenjemput: e.target.value,
                                    })
                                  }
                                  placeholder="Nama penjemput..."
                                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>
                              Menggunakan nilai bersama: Pukul <strong>{jamKeluarUmum} WIB</strong>, Pendamping:{' '}
                              <strong>{namaPenjemputUmum || penjemputUmum}</strong>.
                            </span>
                            <span className="font-mono text-emerald-600">
                              <Phone className="w-3.5 h-3.5 mr-1" /> {entry.student.noHpOrangTua || 'No HP -'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Actions */}
          
        </DialogForm>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: SUMMARY PREVIEW SEBELUM MENYIMPAN (KONFIRMASI AKHIR)              */}
      {/* ========================================================================= */}
      {currentStep === 'SUMMARY' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Tinjau Ringkasan Sebelum Penerbitan Surat Izin</span>
            </h4>
            <p className="mt-1 text-slate-600 dark:text-slate-300 text-[11px]">
              Setiap siswa akan mendapatkan nomor surat izin tersendiri dengan ID grup bersama:{' '}
              <strong className="font-mono text-blue-700 dark:text-blue-300">#{sessionGroupId}</strong>.
            </p>
          </div>

          {/* Metadata Umum Ringkas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Tanggal Izin</span>
              <strong className="text-slate-900 dark:text-white">{tanggal}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Jenis Izin</span>
              <strong className="text-blue-600 dark:text-blue-400">{getStudentPermitTypeDisplay(jenisIzin)}</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Jam Keluar Umum</span>
              <strong className="text-slate-900 dark:text-white font-mono">{jamKeluarUmum} WIB</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Total Siswa</span>
              <strong className="text-emerald-600 font-bold">
                {isEditMode ? 1 : selectedStudents.length} Siswa
              </strong>
            </div>
          </div>

          {/* Tabel / Kartu Daftar Siswa & Rinciannya */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-3">Nama Siswa & Kelas</th>
                  <th className="p-3">Jam Keluar</th>
                  <th className="p-3">Pendamping / Kontak</th>
                  <th className="p-3">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isEditMode ? (
                  <tr>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {singleNamaSiswa}
                      <span className="text-[10px] text-blue-600 font-semibold block">{singleKelas}</span>
                    </td>
                    <td className="p-3 font-mono font-bold">{jamKeluarUmum} WIB</td>
                    <td className="p-3">
                      <div>{namaPenjemputUmum || penjemputUmum}</div>
                      <div className="text-[10px] font-mono text-emerald-600">{singleNoHpOrangTua || '-'}</div>
                    </td>
                    <td className="p-3 italic text-slate-600 dark:text-slate-300 truncate max-w-xs">"{alasanUmum}"</td>
                  </tr>
                ) : (
                  selectedStudents.map((item, idx) => {
                    const jam = item.isCustomized && item.jamKeluar ? item.jamKeluar : jamKeluarUmum;
                    const alasan = item.isCustomized && item.alasan ? item.alasan : alasanUmum;
                    const penjemput = item.isCustomized && item.penjemput ? item.penjemput : penjemputUmum;
                    const namaPenj = item.isCustomized && item.namaPenjemput ? item.namaPenjemput : namaPenjemputUmum;
                    const phone = item.noHpKhusus || item.student.noHpOrangTua;

                    return (
                      <tr key={item.student.id}>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {idx + 1}. {item.student.nama}
                          </div>
                          <div className="text-[10px] text-blue-600 font-semibold">{item.student.kelas}</div>
                        </td>
                        <td className="p-3 font-mono font-bold whitespace-nowrap">{jam} WIB</td>
                        <td className="p-3">
                          <div>{namaPenj || penjemput}</div>
                          <div className="text-[10px] font-mono text-emerald-600"><Phone className="w-3.5 h-3.5 mr-1" /> {phone || '-'}</div>
                        </td>
                        <td className="p-3 italic text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          "{alasan}"
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-4 text-xs font-semibold"
              onClick={() => setCurrentStep('FORM')}
              disabled={isSubmitting}
            >
              ← Kembali Ubah Isian
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-11 px-6 font-bold text-xs"
              isLoading={isSubmitting}
              onClick={handleExecuteSave}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Konfirmasi & Terbitkan Surat Izin
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: RESULT SCREEN (JIKA ADA KEGAGALAN PARSIAL ATAU RETRY)             */}
      {/* ========================================================================= */}
      {currentStep === 'RESULT' && batchResult && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border text-xs ${
              batchResult.failureCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <h4 className="font-bold text-sm flex items-center gap-2">
              {batchResult.failureCount > 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Penerbitan Selesai Sebagian</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Semua Surat Izin Berhasil Diterbitkan</span>
                </>
              )}
            </h4>
            <p className="mt-1 text-[11px]">
              Berhasil: <strong>{batchResult.successCount}</strong> siswa • Gagal:{' '}
              <strong className="text-rose-600">{batchResult.failureCount}</strong> siswa.
            </p>
          </div>

          {/* Rincian Status per Siswa */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {batchResult.items.map((item, idx) => (
              <div key={item.studentId} className="p-3 text-xs flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {idx + 1}. {item.namaSiswa} ({item.kelas})
                  </div>
                  {item.error ? (
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">{item.error}</div>
                  ) : (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {item.permitId}</div>
                  )}
                </div>

                <Badge variant={item.success ? 'success' : 'danger'} size="sm">
                  {item.success ? 'Berhasil' : 'Gagal'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-4 text-xs font-semibold"
              onClick={onClose}
            >
              Tutup & Selesai
            </Button>

            {batchResult.failureCount > 0 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="h-11 px-5 font-bold text-xs"
                isLoading={isSubmitting}
                onClick={handleRetryFailed}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Coba Lagi Siswa Gagal ({batchResult.failureCount})
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
