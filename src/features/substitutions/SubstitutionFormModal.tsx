import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  TeacherSubstitutionRecord,
  AbsenceReason,
  SubstitutionStatus,
  ABSENCE_REASONS,
} from '../../types/substitution.types';
import { TeacherRecord, getTeacherDisplayIdentifier } from '../../types/master.types';
import { useAuth } from '../../contexts/AuthContext';
import { FirestoreService } from '../../services/firebase/firestoreService';
import {
  UserX,
  UserCheck,
  BookOpen,
  GraduationCap,
  Clock,
  FileSpreadsheet,
  AlertCircle,
  Search,
  HelpCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  Save,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';

interface SubstitutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Partial<TeacherSubstitutionRecord>,
    isEdit?: boolean
  ) => Promise<void>;
  editingSubstitution?: TeacherSubstitutionRecord | null;
  teachers: TeacherRecord[];
  isLoadingTeachers?: boolean;
  teachersError?: string | null;
}

const CLASS_LIST = [
  'X MIPA 1', 'X MIPA 2', 'X MIPA 3', 'X IPS 1', 'X IPS 2',
  'XI MIPA 1', 'XI MIPA 2', 'XI MIPA 3', 'XI IPS 1', 'XI IPS 2',
  'XII MIPA 1', 'XII MIPA 2', 'XII MIPA 3', 'XII IPS 1', 'XII IPS 2',
];

const DEFAULT_JAM_PELAJARAN = [
  'JP 1 - 2 (07.15 - 08.45)',
  'JP 3 - 4 (08.45 - 10.15)',
  'JP 5 - 6 (10.30 - 12.00)',
  'JP 7 - 8 (12.45 - 14.15)',
  'JP 9 - 10 (14.15 - 15.45)',
];

export const SubstitutionFormModal: React.FC<SubstitutionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSubstitution = null,
  teachers = [],
  isLoadingTeachers = false,
  teachersError = null,
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Absent Teacher state
  const [guruBerhalanganId, setGuruBerhalanganId] = useState('');
  const [guruBerhalanganName, setGuruBerhalanganName] = useState('');
  const [absentSearchTerm, setAbsentSearchTerm] = useState('');
  const [isAbsentDropdownOpen, setIsAbsentDropdownOpen] = useState(false);

  // Subject & Multi-subject handling
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [detectedSubjects, setDetectedSubjects] = useState<string[]>([]);

  // Reason state
  const [alasan, setAlasan] = useState<AbsenceReason>('SAKIT');
  const [keteranganAlasan, setKeteranganAlasan] = useState('');

  // Class & Time
  const [kelas, setKelas] = useState(CLASS_LIST[0]);
  const [jamPelajaran, setJamPelajaran] = useState(DEFAULT_JAM_PELAJARAN[0]);

  // Substitute Teacher state
  const [guruPenggantiId, setGuruPenggantiId] = useState('');
  const [guruPenggantiName, setGuruPenggantiName] = useState('');
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);

  // Task & Notes
  const [materiDanTugasSiswa, setMateriDanTugasSiswa] = useState('');
  const [catatanPiket, setCatatanPiket] = useState('');

  // Concurrency tracking
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | undefined>(undefined);
  const [concurrencyConflict, setConcurrencyConflict] = useState(false);

  // Submission & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const draftKey = useMemo(() => {
    return editingSubstitution ? `edit_${editingSubstitution.id}` : 'new_substitution';
  }, [editingSubstitution]);

  const [availableDraft, setAvailableDraft] = useState<{ updatedAt: string; data: any } | null>(null);

  // Reset or prefill form when modal opens or editingSubstitution changes
  useEffect(() => {
    if (isOpen) {
      setAvailableDraft(null);
      if (editingSubstitution) {
        setTanggal(editingSubstitution.tanggal || new Date().toISOString().split('T')[0]);
        setGuruBerhalanganId(editingSubstitution.guruBerhalanganId || '');
        setGuruBerhalanganName(editingSubstitution.guruBerhalanganName || '');
        setAbsentSearchTerm(editingSubstitution.guruBerhalanganName || '');
        setIsAbsentDropdownOpen(false);
        setMataPelajaran(editingSubstitution.mataPelajaran || '');

        // Find teacher to parse detected subjects
        const matchedTeacher = teachers.find((t) => t.id === editingSubstitution.guruBerhalanganId);
        if (matchedTeacher) {
          setDetectedSubjects(parseTeacherSubjects(matchedTeacher.mataPelajaran));
        } else {
          setDetectedSubjects(parseTeacherSubjects(editingSubstitution.mataPelajaran));
        }

        setAlasan(editingSubstitution.alasan || 'SAKIT');
        setKeteranganAlasan(editingSubstitution.keteranganAlasan || '');
        setKelas(editingSubstitution.kelas || CLASS_LIST[0]);
        setJamPelajaran(editingSubstitution.jamPelajaran || DEFAULT_JAM_PELAJARAN[0]);
        setGuruPenggantiId(editingSubstitution.guruPenggantiId || '');
        setGuruPenggantiName(editingSubstitution.guruPenggantiName || '');
        setSubSearchTerm(editingSubstitution.guruPenggantiName || '');
        setIsSubDropdownOpen(false);
        setMateriDanTugasSiswa(editingSubstitution.materiDanTugasSiswa || '');
        setCatatanPiket(editingSubstitution.catatanPiket || '');
        setOriginalUpdatedAt(editingSubstitution.updatedAt);
        setConcurrencyConflict(false);
      } else {
        setTanggal(new Date().toISOString().split('T')[0]);
        setGuruBerhalanganId('');
        setGuruBerhalanganName('');
        setAbsentSearchTerm('');
        setIsAbsentDropdownOpen(false);
        setMataPelajaran('');
        setDetectedSubjects([]);
        setAlasan('SAKIT');
        setKeteranganAlasan('');
        setKelas(CLASS_LIST[0]);
        setJamPelajaran(DEFAULT_JAM_PELAJARAN[0]);
        setGuruPenggantiId('');
        setGuruPenggantiName('');
        setSubSearchTerm('');
        setIsSubDropdownOpen(false);
        setMateriDanTugasSiswa('');
        setCatatanPiket('');
        setOriginalUpdatedAt(undefined);
        setConcurrencyConflict(false);

        // Check for saved uncommitted draft
        if (currentUser?.id) {
          DraftService.getDraft(currentUser.id, 'SUBSTITUTION', draftKey).then((saved) => {
            if (saved && saved.data) {
              setAvailableDraft({ updatedAt: saved.updatedAt, data: saved.data });
            }
          });
        }
      }
      setErrorMessage(null);
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, editingSubstitution, teachers, currentUser?.id, draftKey]);

  // Debounced auto-save draft while typing
  useEffect(() => {
    if (!isOpen || !currentUser?.id || editingSubstitution) return;
    if (!guruBerhalanganName.trim() && !mataPelajaran.trim() && !materiDanTugasSiswa.trim()) return;

    DraftService.saveDraftDebounced(currentUser.id, 'SUBSTITUTION', draftKey, {
      tanggal,
      guruBerhalanganId,
      guruBerhalanganName,
      mataPelajaran,
      alasan,
      keteranganAlasan,
      kelas,
      jamPelajaran,
      guruPenggantiId,
      guruPenggantiName,
      materiDanTugasSiswa,
      catatanPiket,
    });
  }, [
    isOpen,
    currentUser?.id,
    editingSubstitution,
    tanggal,
    guruBerhalanganId,
    guruBerhalanganName,
    mataPelajaran,
    alasan,
    keteranganAlasan,
    kelas,
    jamPelajaran,
    guruPenggantiId,
    guruPenggantiName,
    materiDanTugasSiswa,
    catatanPiket,
    draftKey,
  ]);

  const handleRestoreDraft = () => {
    if (!availableDraft?.data) return;
    const d = availableDraft.data;
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.guruBerhalanganId !== undefined) setGuruBerhalanganId(d.guruBerhalanganId);
    if (d.guruBerhalanganName) {
      setGuruBerhalanganName(d.guruBerhalanganName);
      setAbsentSearchTerm(d.guruBerhalanganName);
    }
    if (d.mataPelajaran) setMataPelajaran(d.mataPelajaran);
    if (d.alasan) setAlasan(d.alasan);
    if (d.keteranganAlasan !== undefined) setKeteranganAlasan(d.keteranganAlasan);
    if (d.kelas) setKelas(d.kelas);
    if (d.jamPelajaran) setJamPelajaran(d.jamPelajaran);
    if (d.guruPenggantiId !== undefined) setGuruPenggantiId(d.guruPenggantiId);
    if (d.guruPenggantiName) {
      setGuruPenggantiName(d.guruPenggantiName);
      setSubSearchTerm(d.guruPenggantiName);
    }
    if (d.materiDanTugasSiswa) setMateriDanTugasSiswa(d.materiDanTugasSiswa);
    if (d.catatanPiket !== undefined) setCatatanPiket(d.catatanPiket);

    setAvailableDraft(null);
  };

  const handleDiscardDraft = async () => {
    if (!currentUser?.id) return;
    await DraftService.deleteDraft(currentUser.id, 'SUBSTITUTION', draftKey);
    setAvailableDraft(null);
  };

  // Real-time concurrency listener when editing an existing substitution
  useEffect(() => {
    if (isOpen && editingSubstitution?.id && originalUpdatedAt) {
      const unsub = FirestoreService.subscribeToDocument<TeacherSubstitutionRecord>(
        'substitutions',
        editingSubstitution.id,
        (currentDoc) => {
          if (currentDoc && currentDoc.updatedAt && currentDoc.updatedAt !== originalUpdatedAt) {
            setConcurrencyConflict(true);
          }
        }
      );
      return () => {
        unsub();
      };
    }
  }, [isOpen, editingSubstitution?.id, originalUpdatedAt]);

  // Helper to parse subject strings (supports comma, semicolon, slash delimiters)
  const parseTeacherSubjects = (mapelStr?: string): string[] => {
    if (!mapelStr || !mapelStr.trim()) return [];
    return mapelStr
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  // Filter absent teacher candidate list
  const filteredAbsentTeachers = useMemo(() => {
    if (!absentSearchTerm.trim()) return teachers.slice(0, 8);
    const q = absentSearchTerm.toLowerCase();
    return teachers
      .filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          (t.nip && t.nip.toLowerCase().includes(q)) ||
          (t.nuptk && t.nuptk.toLowerCase().includes(q)) ||
          (t.nik && t.nik.toLowerCase().includes(q)) ||
          (t.idGuru && t.idGuru.toLowerCase().includes(q)) ||
          (t.mataPelajaran && t.mataPelajaran.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [teachers, absentSearchTerm]);

  // Eligible substitute teachers (excludes the currently absent teacher)
  const eligibleSubstituteTeachers = useMemo(() => {
    return teachers.filter((t) => t.id !== guruBerhalanganId);
  }, [teachers, guruBerhalanganId]);

  // Filter substitute teacher candidate list
  const filteredSubTeachers = useMemo(() => {
    if (!subSearchTerm.trim()) return eligibleSubstituteTeachers.slice(0, 8);
    const q = subSearchTerm.toLowerCase();
    return eligibleSubstituteTeachers
      .filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          (t.nip && t.nip.toLowerCase().includes(q)) ||
          (t.nuptk && t.nuptk.toLowerCase().includes(q)) ||
          (t.nik && t.nik.toLowerCase().includes(q)) ||
          (t.idGuru && t.idGuru.toLowerCase().includes(q)) ||
          (t.mataPelajaran && t.mataPelajaran.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [eligibleSubstituteTeachers, subSearchTerm]);

  // Select absent teacher handler
  const handleSelectAbsentTeacher = (teacher: TeacherRecord) => {
    setGuruBerhalanganId(teacher.id);
    setGuruBerhalanganName(teacher.fullName);
    setAbsentSearchTerm(teacher.fullName);
    setIsAbsentDropdownOpen(false);

    // If this teacher was selected as substitute, reset substitute
    if (guruPenggantiId === teacher.id) {
      setGuruPenggantiId('');
      setGuruPenggantiName('');
      setSubSearchTerm('');
    }

    // Parse subjects
    const subjects = parseTeacherSubjects(teacher.mataPelajaran);
    setDetectedSubjects(subjects);

    if (subjects.length === 1) {
      setMataPelajaran(subjects[0]);
    } else if (subjects.length > 1) {
      if (!subjects.includes(mataPelajaran)) {
        setMataPelajaran('');
      }
    } else {
      setMataPelajaran(teacher.mataPelajaran || '');
    }

    if (fieldErrors.guruBerhalangan) {
      setFieldErrors((prev) => ({ ...prev, guruBerhalangan: '' }));
    }
  };

  // Select substitute teacher handler
  const handleSelectSubstituteTeacher = (teacher: TeacherRecord | null) => {
    if (!teacher) {
      setGuruPenggantiId('');
      setGuruPenggantiName('');
      setSubSearchTerm('');
    } else {
      setGuruPenggantiId(teacher.id);
      setGuruPenggantiName(teacher.fullName);
      setSubSearchTerm(teacher.fullName);
    }
    setIsSubDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!tanggal) {
      errors.tanggal = 'Tanggal wajib diisi';
      missing.push('Tanggal');
    }
    if (!guruBerhalanganId || !guruBerhalanganName.trim()) {
      errors.guruBerhalangan = 'Pilih guru yang berhalangan hadir dari daftar';
      missing.push('Guru Berhalangan');
    }
    if (!mataPelajaran || !mataPelajaran.trim()) {
      errors.mataPelajaran = 'Mata pelajaran wajib diisi / dipilih';
      missing.push('Mata Pelajaran');
    }
    if (!kelas || !kelas.trim()) {
      errors.kelas = 'Kelas wajib dipilih';
      missing.push('Kelas');
    }
    if (!jamPelajaran || !jamPelajaran.trim()) {
      errors.jamPelajaran = 'Jam pelajaran wajib diisi';
      missing.push('Jam Pelajaran');
    }

    // Reason validation for 'LAINNYA'
    if (alasan === 'LAINNYA') {
      const trimmedAlasan = keteranganAlasan.trim();
      if (!trimmedAlasan) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya wajib diisi';
        missing.push('Keterangan Alasan Lainnya');
      } else if (trimmedAlasan.length > 300) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya tidak boleh lebih dari 300 karakter';
      }
    }

    if (!materiDanTugasSiswa || !materiDanTugasSiswa.trim()) {
      errors.materiDanTugasSiswa = 'Materi & instruksi tugas siswa wajib diisi';
      missing.push('Materi & Tugas Siswa');
    }

    if (missing.length > 0 || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage(
        missing.length > 0
          ? `Bagian wajib belum lengkap: ${missing.join(', ')}. Harap periksa formulir.`
          : 'Terdapat isian yang belum sesuai. Harap periksa kembali formulir.'
      );
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const defaultStatus: SubstitutionStatus = guruPenggantiName ? 'TERTUGASKAN' : 'MENUNGGU_GURU_INVAL';
      const status: SubstitutionStatus = editingSubstitution ? editingSubstitution.status : defaultStatus;

      const payload: Partial<TeacherSubstitutionRecord> = {
        ...(editingSubstitution ? { id: editingSubstitution.id } : {}),
        tanggal,
        guruBerhalanganId,
        guruBerhalanganName: guruBerhalanganName.trim(),
        mataPelajaran: mataPelajaran.trim(),
        alasan,
        keteranganAlasan: keteranganAlasan.trim() || undefined,
        kelas: kelas.trim(),
        jamPelajaran: jamPelajaran.trim(),
        guruPenggantiId: guruPenggantiId || undefined,
        guruPenggantiName: guruPenggantiName.trim() || undefined,
        materiDanTugasSiswa: materiDanTugasSiswa.trim(),
        status,
        catatanPiket: catatanPiket.trim() || undefined,
        petugasPiketName: editingSubstitution?.petugasPiketName || currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: editingSubstitution?.petugasPiketId || currentUser?.id || 'usr-piket',
        createdAt: editingSubstitution?.createdAt,
        createdBy: editingSubstitution?.createdBy,
      };

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline && currentUser) {
        try {
          const recId = payload.id || `sub-${payload.tanggal}-${Date.now().toString(36)}`;
          await SyncQueueService.enqueue(
            currentUser,
            'SUBSTITUTION_REPORT',
            'substitutions',
            recId,
            { record: { ...payload, id: recId }, isUpdate: Boolean(editingSubstitution) }
          );
          await DraftService.deleteDraft(currentUser.id, 'SUBSTITUTION', draftKey);
          onClose();
        } catch (err: any) {
          setErrorMessage(`Gagal menyimpan antrean offline: ${err.message}`);
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      try {
        await onSave(payload, Boolean(editingSubstitution));
        if (currentUser) {
          await DraftService.deleteDraft(currentUser.id, 'SUBSTITUTION', draftKey);
        }
        onClose();
      } catch (err: any) {
        const isNetwork =
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('network') ||
          err?.code === 'unavailable' ||
          (typeof navigator !== 'undefined' && !navigator.onLine);

        if (isNetwork && currentUser) {
          try {
            const recId = payload.id || `sub-${payload.tanggal}-${Date.now().toString(36)}`;
            await SyncQueueService.enqueue(
              currentUser,
              'SUBSTITUTION_REPORT',
              'substitutions',
              recId,
              { record: { ...payload, id: recId }, isUpdate: Boolean(editingSubstitution) }
            );
            await DraftService.deleteDraft(currentUser.id, 'SUBSTITUTION', draftKey);
            onClose();
            return;
          } catch {}
        }
        throw err;
      }
    } catch (err: any) {
      console.warn('[SubstitutionFormModal] Save substitution error:', err);
      const isPermDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions');

      setErrorMessage(
        isPermDenied
          ? 'Tidak memiliki izin menyimpan data guru inval / pengganti.'
          : err.message || 'Gagal menyimpan catatan guru inval.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSubstitution ? 'Ubah Catatan Guru Berhalangan & Tugas Inval' : 'Catat Guru Berhalangan & Tugas Inval Pengganti'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 sm:gap-6">
        {/* DRAFT RECOVERY BANNER */}
        {availableDraft && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                <Save className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold">Ditemukan draf guru inval tersimpan di perangkat ini</p>
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

        {concurrencyConflict && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Perhatian: Data laporan ini telah diperbarui oleh pengguna lain sejak formulir dibuka.
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BARIS WAKTU & TANGGAL                                                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Tanggal Berhalangan Hadir *</span>
            </label>
            <input
              type="date"
              required
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Jam Pelajaran (JP) & Waktu *</span>
            </label>
            <input
              type="text"
              required
              list="jam-pelajaran-list"
              value={jamPelajaran}
              onChange={(e) => {
                setJamPelajaran(e.target.value);
                if (fieldErrors.jamPelajaran) setFieldErrors((prev) => ({ ...prev, jamPelajaran: '' }));
              }}
              placeholder="Pilih atau ketik JP (contoh: JP 1 - 2 (07.15 - 08.45))"
              className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                fieldErrors.jamPelajaran
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            <datalist id="jam-pelajaran-list">
              {DEFAULT_JAM_PELAJARAN.map((jp) => (
                <option key={jp} value={jp} />
              ))}
            </datalist>
            {fieldErrors.jamPelajaran && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.jamPelajaran}</p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 1: GURU YANG BERHALANGAN HADIR                                      */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full relative">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 break-words">
              <UserX className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Guru yang Berhalangan Hadir *</span>
            </label>
            {teachers.length > 0 && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3" />
                {teachers.length} Guru Terdaftar
              </span>
            )}
          </div>

          {isLoadingTeachers ? (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
              <span>Memuat data guru dari database...</span>
            </div>
          ) : teachersError ? (
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Gagal memuat data master guru: {teachersError}</span>
            </div>
          ) : teachers.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Belum ada data guru terdaftar di Data Master.</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  Silakan tambahkan data guru terlebih dahulu melalui menu <strong>Data Master → Guru</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full min-w-0">
              <input
                type="text"
                required
                value={absentSearchTerm}
                onFocus={() => setIsAbsentDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setAbsentSearchTerm(val);
                  setIsAbsentDropdownOpen(true);
                  if (fieldErrors.guruBerhalangan) {
                    setFieldErrors((prev) => ({ ...prev, guruBerhalangan: '' }));
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setIsAbsentDropdownOpen(false), 250);
                }}
                placeholder="Cari & pilih guru yang berhalangan hadir (nama / NIP / NUPTK)..."
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.guruBerhalangan
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

              {/* Autocomplete Dropdown */}
              {isAbsentDropdownOpen && filteredAbsentTeachers.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAbsentTeachers.map((t) => {
                    const idInfo = getTeacherDisplayIdentifier(t);
                    return (
                      <div
                        key={t.id}
                        onMouseDown={() => handleSelectAbsentTeacher(t)}
                        className="p-3 hover:bg-rose-50/80 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                      >
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                          <span className="truncate">{t.fullName}</span>
                          {t.mataPelajaran && (
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                              {t.mataPelajaran}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {idInfo.displayBadge} • {t.statusKepegawaian || 'Guru'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {fieldErrors.guruBerhalangan && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.guruBerhalangan}</p>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BARIS 2: MATA PELAJARAN & KELAS                                           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {/* Mata Pelajaran */}
          <div className="min-w-0 w-full space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 break-words">
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Mata Pelajaran yang Diajarkan *</span>
            </label>

            {/* Multi-subject selector if teacher teaches > 1 subject */}
            {detectedSubjects.length > 1 && (
              <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 block">
                  Pilih salah satu mapel guru ini:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {detectedSubjects.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setMataPelajaran(sub);
                        if (fieldErrors.mataPelajaran) setFieldErrors((prev) => ({ ...prev, mataPelajaran: '' }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        mataPelajaran === sub
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-blue-100'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              required
              value={mataPelajaran}
              onChange={(e) => {
                setMataPelajaran(e.target.value);
                if (fieldErrors.mataPelajaran) setFieldErrors((prev) => ({ ...prev, mataPelajaran: '' }));
              }}
              placeholder="Contoh: Matematika, Bahasa Indonesia..."
              className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                fieldErrors.mataPelajaran
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            {fieldErrors.mataPelajaran && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.mataPelajaran}</p>
            )}
          </div>

          {/* Kelas yang Ditinggalkan */}
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
              <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Kelas yang Ditinggalkan *</span>
            </label>
            <input
              type="text"
              required
              list="tardy-classes-list-sub"
              value={kelas}
              onChange={(e) => {
                setKelas(e.target.value);
                if (fieldErrors.kelas) setFieldErrors((prev) => ({ ...prev, kelas: '' }));
              }}
              placeholder="Pilih atau ketik kelas..."
              className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                fieldErrors.kelas
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            <datalist id="tardy-classes-list-sub">
              {CLASS_LIST.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {fieldErrors.kelas && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.kelas}</p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 3: ALASAN BERHALANGAN & KETERANGAN ALASAN                           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
              Alasan Berhalangan Hadir *
            </label>
            <select
              value={alasan}
              onChange={(e) => {
                const newAlasan = e.target.value as AbsenceReason;
                setAlasan(newAlasan);
                if (newAlasan !== 'LAINNYA' && fieldErrors.keteranganAlasan) {
                  setFieldErrors((prev) => ({ ...prev, keteranganAlasan: '' }));
                }
              }}
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ABSENCE_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
                {alasan === 'LAINNYA' ? 'Keterangan alasan lainnya *' : 'Keterangan Alasan Tambahan (Opsional)'}
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {keteranganAlasan.length}/300
              </span>
            </div>
            <input
              type="text"
              maxLength={300}
              required={alasan === 'LAINNYA'}
              value={keteranganAlasan}
              onChange={(e) => {
                setKeteranganAlasan(e.target.value);
                if (fieldErrors.keteranganAlasan) {
                  setFieldErrors((prev) => ({ ...prev, keteranganAlasan: '' }));
                }
              }}
              placeholder={
                alasan === 'LAINNYA'
                  ? 'Tuliskan jenis alasan lainnya secara spesifik (wajib)...'
                  : 'Contoh: Menghadiri Workshop MGMP Matematika...'
              }
              className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                fieldErrors.keteranganAlasan
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : alasan === 'LAINNYA'
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              } text-xs text-slate-900 dark:text-white placeholder:text-slate-400 box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            {fieldErrors.keteranganAlasan && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.keteranganAlasan}</p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 4: GURU PENGGANTI / INVAL (OPSIONAL)                                */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full relative">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 break-words">
              <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Guru Pengganti / Inval yang Ditugaskan (Opsional)</span>
            </label>
            {guruPenggantiName && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Tertugaskan
              </span>
            )}
          </div>

          <div className="relative w-full min-w-0">
            <input
              type="text"
              value={subSearchTerm}
              onFocus={() => setIsSubDropdownOpen(true)}
              onChange={(e) => {
                const val = e.target.value;
                setSubSearchTerm(val);
                setIsSubDropdownOpen(true);
                if (!val.trim()) {
                  setGuruPenggantiId('');
                  setGuruPenggantiName('');
                }
              }}
              onBlur={() => {
                setTimeout(() => setIsSubDropdownOpen(false), 250);
              }}
              placeholder="Pilih guru pengganti (inval) atau kosongkan jika belum ditugaskan..."
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300 placeholder:text-slate-400 box-border focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

            {/* Dropdown for substitute teacher */}
            {isSubDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                {/* Option to unassign */}
                <div
                  onMouseDown={() => handleSelectSubstituteTeacher(null)}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors flex items-center gap-2 text-slate-500 italic"
                >
                  <span>-- Belum Ditugaskan (Menunggu Guru Inval) --</span>
                </div>

                {filteredSubTeachers.map((t) => {
                  const idInfo = getTeacherDisplayIdentifier(t);
                  return (
                    <div
                      key={t.id}
                      onMouseDown={() => handleSelectSubstituteTeacher(t)}
                      className="p-3 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                    >
                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                        <span className="truncate">🧑‍🏫 {t.fullName}</span>
                        {t.mataPelajaran && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                            {t.mataPelajaran}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {idInfo.displayBadge} • {t.statusKepegawaian || 'Guru'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 5: MATERI & TUGAS SISWA                                             */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
            Materi & Instruksi Tugas yang Ditinggalkan untuk Siswa *
          </label>
          <textarea
            required
            rows={3}
            value={materiDanTugasSiswa}
            onChange={(e) => {
              setMateriDanTugasSiswa(e.target.value);
              if (fieldErrors.materiDanTugasSiswa) {
                setFieldErrors((prev) => ({ ...prev, materiDanTugasSiswa: '' }));
              }
            }}
            placeholder="Tuliskan materi yang dibahas, nomor halaman buku paket/LKS, latihan soal, atau instruksi pengerjaan tugas mandiri/kelompok..."
            className={`w-full max-w-full p-3 rounded-xl border ${
              fieldErrors.materiDanTugasSiswa
                ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800'
            } bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed`}
          />
          {fieldErrors.materiDanTugasSiswa && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.materiDanTugasSiswa}</p>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BARIS 6: CATATAN TIM PIKET                                                */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
            Catatan Tambahan Petugas Piket (Opsional)
          </label>
          <input
            type="text"
            value={catatanPiket}
            onChange={(e) => setCatatanPiket(e.target.value)}
            placeholder="Contoh: Tugas telah dikirim ke Ketua Kelas dan Guru Inval telah standby..."
            className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[48px] h-12 px-5 text-xs font-semibold"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="min-h-[48px] h-12 px-6 font-bold shadow-md text-xs"
            isLoading={isSubmitting}
            leftIcon={editingSubstitution ? <Save className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
          >
            {editingSubstitution ? 'Simpan Perubahan Tugas Inval' : 'Simpan & Terbitkan Tugas Inval'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
