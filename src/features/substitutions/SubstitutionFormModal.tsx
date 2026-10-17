import { DialogForm } from '../../components/common/DialogForm';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  TeacherSubstitutionRecord,
  AbsenceReason,
  SubstitutionStatus,
  ABSENCE_REASONS,
  getSubstitutionReasonDisplay,
  BatchSubstitutionItemResult,
} from '../../types/substitution.types';
import { TeacherRecord, StudentRecord, getTeacherDisplayIdentifier } from '../../types/master.types';
import { SchoolSettings, DayOfWeek } from '../../types';
import {
  LessonPeriodItem,
  getDayOfWeekFromDate,
  getPeriodsForDay,
  formatSelectedPeriodsDisplay,
} from '../../types/period.types';
import { useAuth } from '../../contexts/AuthContext';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SubstitutionService } from '../../services/firebase/substitutionService';
import {
  UserX,
  UserCheck,
  BookOpen,
  GraduationCap,
  Clock,
  AlertCircle,
  Search,
  CheckCircle2,
  Save,
  AlertTriangle,
  Trash2,
  Plus,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  X,
  Settings,
  Check,
} from '../../components/icons';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';

interface TeacherAssignmentEntry {
  assignmentId: string;
  mataPelajaran: string;
  kelas: string;
  selectedPeriodNumbers: number[];
  alasan: AbsenceReason;
  keteranganAlasan: string;
  isCustomReason: boolean;
  guruPenggantiId: string;
  guruPenggantiName: string;
  materiDanTugasSiswa: string;
  catatanPiket: string;
}

interface SelectedTeacherEntry {
  teacher: TeacherRecord;
  assignments: TeacherAssignmentEntry[];
  isExpanded: boolean;
}

interface SubstitutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (
    data: Partial<TeacherSubstitutionRecord>,
    isEdit?: boolean
  ) => Promise<void>;
  editingSubstitution?: TeacherSubstitutionRecord | null;
  teachers: TeacherRecord[];
  isLoadingTeachers?: boolean;
  teachersError?: string | null;
  settings?: SchoolSettings;
  onNavigateToSettings?: () => void;
}

/**
 * Parsing mata pelajaran dari string master guru menjadi daftar saran
 */
function parseTeacherSubjectSuggestions(rawSubject?: string): string[] {
  if (!rawSubject || !rawSubject.trim()) return [];
  const parts = rawSubject
    .split(/[,;&/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '-');
  return parts.length > 0 ? parts : [rawSubject.trim()];
}

export const SubstitutionFormModal: React.FC<SubstitutionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSubstitution = null,
  teachers = [],
  isLoadingTeachers = false,
  teachersError = null,
  settings,
  onNavigateToSettings,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const todayIso = getTodayISODate();

  // =========================================================================
  // STATE MASTER KELAS DARI DATA SISWA AKTIF
  // =========================================================================
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingClasses(true);
    setClassesError(null);

    const unsubStudents = FirestoreService.subscribeToCollection<StudentRecord>(
      'students',
      (data) => {
        setStudents(data);
        setIsLoadingClasses(false);
        setClassesError(null);
      },
      (err) => {
        console.warn('Gagal berlangganan data siswa untuk master kelas:', err);
        setClassesError(err.message || 'Gagal mengambil data kelas dari server.');
        setIsLoadingClasses(false);
      }
    );

    return () => {
      unsubStudents();
    };
  }, [isOpen]);

  // Daftar kelas unik dari siswa aktif
  const activeClasses = useMemo(() => {
    const activeStudents = students.filter(
      (s) => s.isActive !== false && s.kelas && s.kelas.trim() !== ''
    );
    const unique = Array.from(new Set(activeStudents.map((s) => s.kelas.trim())));
    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  // Existing substitutions pada tanggal terpilih untuk deteksi konflik
  const [existingDaySubs, setExistingDaySubs] = useState<TeacherSubstitutionRecord[]>([]);

  // =========================================================================
  // FORM SHARED VALUES
  // =========================================================================
  const [tanggal, setTanggal] = useState(todayIso);
  const [sharedAlasan, setSharedAlasan] = useState<AbsenceReason>('SAKIT');
  const [sharedKeteranganAlasan, setSharedKeteranganAlasan] = useState('');
  const [sharedMateriTugas, setSharedMateriTugas] = useState('');
  const [sharedCatatanPiket, setSharedCatatanPiket] = useState('');

  // =========================================================================
  // MULTI-TEACHER SELECTION & DETAIL ASSIGNMENTS
  // =========================================================================
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedTeachers, setSelectedTeachers] = useState<SelectedTeacherEntry[]>([]);

  // Request ID untuk retry yang idempotent
  const [batchRequestId, setBatchRequestId] = useState<string>(() => `req-${Date.now().toString(36)}`);

  // Sub-modals
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchSubstitutionItemResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambil data penugasan yang sudah ada pada tanggal yang dipilih
  useEffect(() => {
    if (!isOpen || !tanggal) return;
    FirestoreService.getAll<TeacherSubstitutionRecord>('substitutions').then((all) => {
      setExistingDaySubs(all.filter((s) => s.tanggal === tanggal));
    });
  }, [isOpen, tanggal]);

  // Hitung hari dalam seminggu dan JP yang tersedia pada hari tersebut
  const dayOfWeek: DayOfWeek = useMemo(() => {
    return getDayOfWeekFromDate(tanggal);
  }, [tanggal]);

  const availablePeriodsForDay: LessonPeriodItem[] = useMemo(() => {
    return getPeriodsForDay(settings?.lessonPeriodConfig, dayOfWeek);
  }, [settings?.lessonPeriodConfig, dayOfWeek]);

  const isPeriodConfigured = Boolean(
    settings?.lessonPeriodConfig &&
      settings.lessonPeriodConfig.periods &&
      settings.lessonPeriodConfig.periods.length > 0
  );

  // Klik di luar dropdown pencarian guru
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTeacherDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Inisialisasi atau Reset Form ketika Modal Dibuka / editingSubstitution berubah
  useEffect(() => {
    if (!isOpen) return;

    setBatchRequestId(`req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsSummaryModalOpen(false);
    setIsResultModalOpen(false);
    setBatchResults([]);

    if (editingSubstitution) {
      // MODE EDIT TUNGGAL: Isi dengan data yang sedang diedit
      setTanggal(editingSubstitution.tanggal || todayIso);
      setSharedAlasan(editingSubstitution.alasan || 'SAKIT');
      setSharedKeteranganAlasan(editingSubstitution.keteranganAlasan || '');
      setSharedMateriTugas(editingSubstitution.materiDanTugasSiswa || '');
      setSharedCatatanPiket(editingSubstitution.catatanPiket || '');

      const matchedTeacher = teachers.find(
        (t) =>
          t.id === editingSubstitution.guruBerhalanganId ||
          t.userId === editingSubstitution.guruBerhalanganId ||
          t.fullName.toLowerCase() === editingSubstitution.guruBerhalanganName.toLowerCase()
      );

      const placeholderTeacher: TeacherRecord = matchedTeacher || {
        id: editingSubstitution.guruBerhalanganId || `tch-temp-${Date.now()}`,
        fullName: editingSubstitution.guruBerhalanganName || 'Guru Berhalangan',
        mataPelajaran: editingSubstitution.mataPelajaran || '',
        nip: '-',
        pangkatGolongan: '-',
        statusKepegawaian: '-',
        phone: '-',
        email: '-',
        createdAt: new Date().toISOString(),
        createdBy: 'System',
        updatedAt: new Date().toISOString(),
        updatedBy: 'System',
      };

      const initialPeriods = editingSubstitution.selectedPeriodNumbers || [];

      setSelectedTeachers([
        {
          teacher: placeholderTeacher,
          isExpanded: true,
          assignments: [
            {
              assignmentId: `asg-${editingSubstitution.id}`,
              mataPelajaran: editingSubstitution.mataPelajaran || '',
              kelas: editingSubstitution.kelas || '',
              selectedPeriodNumbers: initialPeriods,
              alasan: editingSubstitution.alasan || 'SAKIT',
              keteranganAlasan: editingSubstitution.keteranganAlasan || '',
              isCustomReason: true,
              guruPenggantiId: editingSubstitution.guruPenggantiId || '',
              guruPenggantiName: editingSubstitution.guruPenggantiName || '',
              materiDanTugasSiswa: editingSubstitution.materiDanTugasSiswa || '',
              catatanPiket: editingSubstitution.catatanPiket || '',
            },
          ],
        },
      ]);
    } else {
      // MODE INPUT BARU
      setTanggal(todayIso);
      setSharedAlasan('SAKIT');
      setSharedKeteranganAlasan('');
      setSharedMateriTugas('');
      setSharedCatatanPiket('');
      setTeacherSearchTerm('');
      setSelectedTeachers([]);
    }
  }, [isOpen, editingSubstitution]);

  // Filter daftar guru untuk dropdown pencarian
  const filteredTeacherSearch = useMemo(() => {
    const q = teacherSearchTerm.trim().toLowerCase();
    const selectedIds = new Set(selectedTeachers.map((st) => st.teacher.id));

    return teachers.filter((t) => {
      if (selectedIds.has(t.id)) return false;
      if (!q) return true;

      const nameMatch = t.fullName.toLowerCase().includes(q);
      const nipMatch = t.nip && t.nip !== '-' ? t.nip.toLowerCase().includes(q) : false;
      const nuptkMatch = t.nuptk && t.nuptk !== '-' ? t.nuptk.toLowerCase().includes(q) : false;
      const idGuruMatch = t.idGuru ? t.idGuru.toLowerCase().includes(q) : false;
      const idMatch = t.id.toLowerCase().includes(q);
      const userMatch = t.userId ? t.userId.toLowerCase().includes(q) : false;
      const mapelMatch = t.mataPelajaran ? t.mataPelajaran.toLowerCase().includes(q) : false;

      return nameMatch || nipMatch || nuptkMatch || idGuruMatch || idMatch || userMatch || mapelMatch;
    });
  }, [teachers, teacherSearchTerm, selectedTeachers]);

  // Tambah guru ke daftar terpilih
  const handleSelectTeacher = (teacher: TeacherRecord) => {
    // Cegah duplikasi guru
    if (selectedTeachers.some((st) => st.teacher.id === teacher.id)) {
      setErrorMessage(`Guru "${teacher.fullName}" sudah terpilih dalam daftar.`);
      return;
    }

    // Ambil saran mapel pertama dari master guru jika tersedia
    const suggestions = parseTeacherSubjectSuggestions(teacher.mataPelajaran);
    const initialMapel = suggestions.length > 0 ? suggestions[0] : '';

    const newEntry: SelectedTeacherEntry = {
      teacher,
      isExpanded: true,
      assignments: [
        {
          assignmentId: `asg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          mataPelajaran: initialMapel,
          kelas: activeClasses.length > 0 ? activeClasses[0] : '',
          selectedPeriodNumbers: availablePeriodsForDay.length > 0 ? [availablePeriodsForDay[0].periodNumber] : [],
          alasan: sharedAlasan,
          keteranganAlasan: sharedKeteranganAlasan,
          isCustomReason: false,
          guruPenggantiId: '',
          guruPenggantiName: '',
          materiDanTugasSiswa: sharedMateriTugas,
          catatanPiket: sharedCatatanPiket,
        },
      ],
    };

    setSelectedTeachers((prev) => [...prev, newEntry]);
    setTeacherSearchTerm('');
    setIsTeacherDropdownOpen(false);
    setErrorMessage(null);
  };

  // Hapus guru dari daftar terpilih
  const handleRemoveTeacher = (teacherId: string) => {
    setSelectedTeachers((prev) => prev.filter((st) => st.teacher.id !== teacherId));
  };

  // Toggle collapse/expand kartu guru
  const handleToggleExpandTeacher = (teacherId: string) => {
    setSelectedTeachers((prev) =>
      prev.map((st) =>
        st.teacher.id === teacherId ? { ...st, isExpanded: !st.isExpanded } : st
      )
    );
  };

  // Tambah rincian kelas/JP untuk seorang guru
  const handleAddAssignmentForTeacher = (teacherId: string) => {
    setSelectedTeachers((prev) =>
      prev.map((entry) => {
        if (entry.teacher.id !== teacherId) return entry;

        const suggestions = parseTeacherSubjectSuggestions(entry.teacher.mataPelajaran);
        const defaultMapel =
          entry.assignments.length > 0
            ? entry.assignments[entry.assignments.length - 1].mataPelajaran
            : suggestions[0] || '';

        const newAssignment: TeacherAssignmentEntry = {
          assignmentId: `asg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          mataPelajaran: defaultMapel,
          kelas: activeClasses.length > 0 ? activeClasses[0] : '',
          selectedPeriodNumbers: [],
          alasan: sharedAlasan,
          keteranganAlasan: sharedKeteranganAlasan,
          isCustomReason: false,
          guruPenggantiId: '',
          guruPenggantiName: '',
          materiDanTugasSiswa: sharedMateriTugas,
          catatanPiket: sharedCatatanPiket,
        };

        return {
          ...entry,
          isExpanded: true,
          assignments: [...entry.assignments, newAssignment],
        };
      })
    );
  };

  // Hapus rincian penugasan tertentu pada seorang guru
  const handleRemoveAssignment = (teacherId: string, assignmentId: string) => {
    setSelectedTeachers((prev) =>
      prev.map((entry) => {
        if (entry.teacher.id !== teacherId) return entry;
        if (entry.assignments.length <= 1) return entry; // Pertahankan minimal 1
        return {
          ...entry,
          assignments: entry.assignments.filter((a) => a.assignmentId !== assignmentId),
        };
      })
    );
  };

  // Perbarui field rincian penugasan guru
  const handleUpdateAssignment = (
    teacherId: string,
    assignmentId: string,
    updates: Partial<TeacherAssignmentEntry>
  ) => {
    setSelectedTeachers((prev) =>
      prev.map((entry) => {
        if (entry.teacher.id !== teacherId) return entry;
        return {
          ...entry,
          assignments: entry.assignments.map((a) =>
            a.assignmentId === assignmentId ? { ...a, ...updates } : a
          ),
        };
      })
    );
  };

  // Toggle pilihan JP pada rincian tertentu
  const handleTogglePeriod = (
    teacherId: string,
    assignmentId: string,
    periodNumber: number
  ) => {
    setSelectedTeachers((prev) =>
      prev.map((entry) => {
        if (entry.teacher.id !== teacherId) return entry;
        return {
          ...entry,
          assignments: entry.assignments.map((a) => {
            if (a.assignmentId !== assignmentId) return a;
            const current = a.selectedPeriodNumbers || [];
            const updated = current.includes(periodNumber)
              ? current.filter((p) => p !== periodNumber)
              : [...current, periodNumber].sort((x, y) => x - y);
            return {
              ...a,
              selectedPeriodNumbers: updated,
            };
          }),
        };
      })
    );
  };

  // Deteksi konflik jadwal guru pengganti secara real-time
  const getSubstituteConflictWarning = (
    substituteId: string,
    periodNumbers: number[],
    currentTeacherId: string,
    currentAssignmentId: string
  ): string | null => {
    if (!substituteId) return null;

    // 1. Cek terhadap catatan yang sudah ada di database hari ini
    const conflictServer = SubstitutionService.checkSubstituteConflict({
      tanggal,
      substituteId,
      periodNumbers,
      existingSubstitutions: existingDaySubs,
    });
    if (conflictServer.hasConflict) {
      return conflictServer.reason || 'Guru pengganti sudah memiliki jadwal lain pada jam ini.';
    }

    // 2. Cek terhadap penugasan lain dalam form saat ini
    for (const entry of selectedTeachers) {
      for (const a of entry.assignments) {
        if (a.assignmentId === currentAssignmentId) continue;
        if (a.guruPenggantiId === substituteId) {
          const overlap = a.selectedPeriodNumbers.some((p) => periodNumbers.includes(p));
          if (overlap) {
            return `Guru pengganti sudah ditugaskan pada Kelas ${a.kelas} (menggantikan ${entry.teacher.fullName}) pada JP yang sama dalam input ini.`;
          }
        }
      }
    }

    return null;
  };

  // Hitung total penugasan yang akan dibuat
  const totalAssignmentsCount = useMemo(() => {
    return selectedTeachers.reduce((acc, curr) => acc + curr.assignments.length, 0);
  }, [selectedTeachers]);

  // Validasi seluruh input sebelum membuka ringkasan
  const validateFormBeforeSubmit = (): boolean => {
    if (selectedTeachers.length === 0) {
      setErrorMessage('Pilih minimal 1 guru yang berhalangan hadir.');
      return false;
    }

    if (!isPeriodConfigured) {
      setErrorMessage(
        'Jadwal jam pelajaran sekolah (JP) belum dikonfigurasi. Administrator harus mengatur jam pelajaran terlebih dahulu.'
      );
      return false;
    }

    if (activeClasses.length === 0) {
      setErrorMessage('Belum ada kelas aktif dari master siswa sekolah. Tambahkan data siswa terlebih dahulu.');
      return false;
    }

    for (const entry of selectedTeachers) {
      for (let i = 0; i < entry.assignments.length; i++) {
        const a = entry.assignments[i];

        if (!a.mataPelajaran || !a.mataPelajaran.trim()) {
          setErrorMessage(
            `Mata pelajaran untuk guru ${entry.teacher.fullName} (Rincian #${i + 1}) wajib diisi.`
          );
          return false;
        }

        if (!a.kelas || !a.kelas.trim()) {
          setErrorMessage(
            `Kelas untuk guru ${entry.teacher.fullName} (Rincian #${i + 1}) wajib dipilih.`
          );
          return false;
        }

        if (!a.selectedPeriodNumbers || a.selectedPeriodNumbers.length === 0) {
          setErrorMessage(
            `Pilih minimal 1 nomor JP yang terdampak untuk ${entry.teacher.fullName} di Kelas ${a.kelas}.`
          );
          return false;
        }

        // Validasi: Guru pengganti tidak boleh sama dengan guru berhalangan
        if (a.guruPenggantiId && a.guruPenggantiId === entry.teacher.id) {
          setErrorMessage(
            `Guru pengganti untuk ${entry.teacher.fullName} di Kelas ${a.kelas} tidak boleh sama dengan guru yang berhalangan.`
          );
          return false;
        }

        if (!a.materiDanTugasSiswa || !a.materiDanTugasSiswa.trim()) {
          setErrorMessage(
            `Materi dan tugas siswa untuk ${entry.teacher.fullName} (Kelas ${a.kelas}) wajib diisi agar pembelajaran siswa tetap terarah.`
          );
          return false;
        }
      }
    }

    setErrorMessage(null);
    return true;
  };

  // Buka dialog ringkasan
  const handleOpenSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateFormBeforeSubmit()) {
      setIsSummaryModalOpen(true);
    }
  };

  // Eksekusi penyimpanan ke Firestore
  const handleConfirmSave = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingSubstitution && onSave) {
        // Mode edit tunggal
        const singleEntry = selectedTeachers[0];
        const singleAssignment = singleEntry?.assignments[0];
        if (!singleAssignment) return;

        const selectedPeriodsList = availablePeriodsForDay.filter((p) =>
          singleAssignment.selectedPeriodNumbers.includes(p.periodNumber)
        );
        const periodsDisplay = formatSelectedPeriodsDisplay(selectedPeriodsList);

        const payload: Partial<TeacherSubstitutionRecord> = {
          id: editingSubstitution.id,
          tanggal,
          guruBerhalanganId: singleEntry.teacher.id,
          guruBerhalanganName: singleEntry.teacher.fullName,
          mataPelajaran: singleAssignment.mataPelajaran.trim(),
          alasan: singleAssignment.alasan,
          keteranganAlasan: singleAssignment.keteranganAlasan.trim() || undefined,
          kelas: singleAssignment.kelas.trim(),
          jamPelajaran: periodsDisplay.combinedDisplay,
          selectedPeriodNumbers: singleAssignment.selectedPeriodNumbers,
          periodSnapshot: periodsDisplay.snapshots,
          sourceClassOrigin: 'Data Siswa Aktif',
          guruPenggantiId: singleAssignment.guruPenggantiId || undefined,
          guruPenggantiName: singleAssignment.guruPenggantiName || undefined,
          materiDanTugasSiswa: singleAssignment.materiDanTugasSiswa.trim(),
          catatanPiket: singleAssignment.catatanPiket.trim() || undefined,
          status: singleAssignment.guruPenggantiId ? 'TERTUGASKAN' : 'MENUNGGU_GURU_INVAL',
          petugasPiketId: currentUser.id,
          petugasPiketName: currentUser.fullName,
        };

        await onSave(payload, true);
        setIsSummaryModalOpen(false);
        onClose();
        return;
      }

      // Mode Batch
      const itemsToSave: Array<
        Omit<TeacherSubstitutionRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'id'> & { id?: string }
      > = [];

      selectedTeachers.forEach((entry) => {
        entry.assignments.forEach((a) => {
          const selectedPeriodsList = availablePeriodsForDay.filter((p) =>
            a.selectedPeriodNumbers.includes(p.periodNumber)
          );
          const periodsDisplay = formatSelectedPeriodsDisplay(selectedPeriodsList);

          itemsToSave.push({
            tanggal,
            guruBerhalanganId: entry.teacher.id,
            guruBerhalanganName: entry.teacher.fullName,
            mataPelajaran: a.mataPelajaran.trim(),
            alasan: a.alasan,
            keteranganAlasan: a.keteranganAlasan.trim() || undefined,
            kelas: a.kelas.trim(),
            jamPelajaran: periodsDisplay.combinedDisplay,
            selectedPeriodNumbers: a.selectedPeriodNumbers,
            periodSnapshot: periodsDisplay.snapshots,
            sourceClassOrigin: 'Data Siswa Aktif',
            guruPenggantiId: a.guruPenggantiId || undefined,
            guruPenggantiName: a.guruPenggantiName || undefined,
            materiDanTugasSiswa: a.materiDanTugasSiswa.trim(),
            catatanPiket: a.catatanPiket.trim() || undefined,
            status: a.guruPenggantiId ? 'TERTUGASKAN' : 'MENUNGGU_GURU_INVAL',
            petugasPiketId: currentUser.id,
            petugasPiketName: currentUser.fullName,
          });
        });
      });

      const res = await SubstitutionService.saveBatchSubstitutions({
        items: itemsToSave,
        user: currentUser,
        batchRequestId,
      });

      setBatchResults(res.results);
      setIsSummaryModalOpen(false);
      setIsResultModalOpen(true);

      if (res.allSuccessful) {
        // Jika semua sukses, tutup form setelah feedback
        setTimeout(() => {
          setIsResultModalOpen(false);
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan penugasan guru inval.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry hanya untuk penugasan yang gagal
  const handleRetryFailedItems = async () => {
    if (!currentUser) return;
    const failedResults = batchResults.filter((r) => !r.success);
    if (failedResults.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const itemsToRetry: Array<
        Omit<TeacherSubstitutionRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'id'> & { id?: string }
      > = [];

      selectedTeachers.forEach((entry) => {
        entry.assignments.forEach((a) => {
          const isFailed = failedResults.some(
            (fr) =>
              fr.guruBerhalanganId === entry.teacher.id &&
              fr.kelas === a.kelas &&
              (fr.substitutionId === a.assignmentId || fr.jamPelajaran.includes(`JP ${a.selectedPeriodNumbers[0]}`))
          );

          if (isFailed) {
            const selectedPeriodsList = availablePeriodsForDay.filter((p) =>
              a.selectedPeriodNumbers.includes(p.periodNumber)
            );
            const periodsDisplay = formatSelectedPeriodsDisplay(selectedPeriodsList);

            itemsToRetry.push({
              id: a.assignmentId.startsWith('inv-') ? a.assignmentId : undefined,
              tanggal,
              guruBerhalanganId: entry.teacher.id,
              guruBerhalanganName: entry.teacher.fullName,
              mataPelajaran: a.mataPelajaran.trim(),
              alasan: a.alasan,
              keteranganAlasan: a.keteranganAlasan.trim() || undefined,
              kelas: a.kelas.trim(),
              jamPelajaran: periodsDisplay.combinedDisplay,
              selectedPeriodNumbers: a.selectedPeriodNumbers,
              periodSnapshot: periodsDisplay.snapshots,
              sourceClassOrigin: 'Data Siswa Aktif',
              guruPenggantiId: a.guruPenggantiId || undefined,
              guruPenggantiName: a.guruPenggantiName || undefined,
              materiDanTugasSiswa: a.materiDanTugasSiswa.trim(),
              catatanPiket: a.catatanPiket.trim() || undefined,
              status: a.guruPenggantiId ? 'TERTUGASKAN' : 'MENUNGGU_GURU_INVAL',
              petugasPiketId: currentUser.id,
              petugasPiketName: currentUser.fullName,
            });
          }
        });
      });

      const res = await SubstitutionService.saveBatchSubstitutions({
        items: itemsToRetry,
        user: currentUser,
        batchRequestId, // Gunakan batchRequestId tetap untuk memastikan idempotensi
      });

      // Update hasil batch
      setBatchResults((prev) => {
        return prev.map((old) => {
          const updated = res.results.find(
            (r) => r.guruBerhalanganId === old.guruBerhalanganId && r.kelas === old.kelas
          );
          return updated || old;
        });
      });

      if (res.allSuccessful) {
        setTimeout(() => {
          setIsResultModalOpen(false);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal melakukan retry penyimpanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isSummaryModalOpen && !isResultModalOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <UserX className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>
              {editingSubstitution
                ? 'Edit Data Guru Berhalangan & Tugas Inval'
                : 'Pencatatan Guru Berhalangan & Penugasan Inval'}
            </span>
          </div>
        }
        maxWidth="4xl"
      >
        <DialogForm onSubmit={handleOpenSummary} className="space-y-6" actions={<div className="app-form-actions flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500">
              Setiap rincian penugasan akan disimpan sebagai dokumen tersendiri yang terhubung dengan ID grup massal.
            </span>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="md" onClick={onClose}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={selectedTeachers.length === 0}
                leftIcon={<ArrowRight className="w-4 h-4" />}
              >
                Tinjau Ringkasan ({totalAssignmentsCount} Penugasan)
              </Button>
            </div>
          </div>}>
          {/* TOP ERROR MESSAGE */}
          {errorMessage && (
            <div role="alert" tabIndex={-1} className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PERINGATAN KETIKA JP BELUM DIKONFIGURASI */}
          {!isPeriodConfigured && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Belum Ada Pengaturan Jam Pelajaran Sekolah</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Jadwal jam pelajaran (JP) belum dikonfigurasi di pengaturan sekolah. Pengaturan JP diperlukan agar nomor jam pelajaran, interval waktu, dan perbedaan jadwal antarhari (Senin-Kamis vs Jumat) dihitung secara resmi.
              </p>
              {isAdmin && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onNavigateToSettings) onNavigateToSettings();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer shadow-xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Buka Menu Jam Pelajaran di Pengaturan Admin</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGIAN 1: PARAMETER BERSAMA (TANGGAL & ALASAN AWAL)                       */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Waktu Kejadian & Nilai Awal Bersama</span>
              </span>
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                Hari {dayOfWeek} ({availablePeriodsForDay.length} JP Aktif)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tanggal */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tanggal Berhalangan Hadir *
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              {/* Alasan Bersama */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Alasan Berhalangan Hadir (Nilai Awal) *
                </label>
                <select
                  value={sharedAlasan}
                  onChange={(e) => {
                    const newAlasan = e.target.value as AbsenceReason;
                    setSharedAlasan(newAlasan);
                    // Update juga ke guru yang belum mengkustomisasi alasan
                    setSelectedTeachers((prev) =>
                      prev.map((entry) => ({
                        ...entry,
                        assignments: entry.assignments.map((a) =>
                          a.isCustomReason ? a : { ...a, alasan: newAlasan }
                        ),
                      }))
                    );
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {ABSENCE_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>{r.icon} {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keterangan Alasan Bersama jika Lainnya atau Opsional */}
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Keterangan Tambahan / Surat Izin (Nilai Awal)
              </label>
              <input
                type="text"
                placeholder="Contoh: Menghadiri Lokakarya Guru Penggerak di Dinas Pendidikan..."
                value={sharedKeteranganAlasan}
                onChange={(e) => {
                  setSharedKeteranganAlasan(e.target.value);
                  setSelectedTeachers((prev) =>
                    prev.map((entry) => ({
                      ...entry,
                      assignments: entry.assignments.map((a) =>
                        a.isCustomReason ? a : { ...a, keteranganAlasan: e.target.value }
                      ),
                    }))
                  );
                }}
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 2: MULTI-SELECT GURU BERHALANGAN DENGAN PENCARIAN CEPAT           */}
          {/* ========================================================================= */}
          {!editingSubstitution && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-blue-600" />
                    <span>Pilih Guru Berhalangan Hadir (Multi-Select) *</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Cari berdasarkan nama lengkap, NIP, NUPTK, Kode Pegawai, atau mata pelajaran.
                  </p>
                </div>

                <Badge variant="primary" className="text-xs font-bold">
                  {selectedTeachers.length} Guru Dipilih
                </Badge>
              </div>

              {/* SEARCH DROPDOWN INPUT */}
              <div className="relative" ref={teacherDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik nama guru, NIP, NUPTK, atau ID login untuk mencari & menambah guru..."
                    value={teacherSearchTerm}
                    onChange={(e) => {
                      setTeacherSearchTerm(e.target.value);
                      setIsTeacherDropdownOpen(true);
                    }}
                    onFocus={() => setIsTeacherDropdownOpen(true)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>

                {/* DROPDOWN HASIL PENCARIAN */}
                {isTeacherDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {isLoadingTeachers ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Memuat data guru dari server...
                      </div>
                    ) : filteredTeacherSearch.length > 0 ? (
                      filteredTeacherSearch.map((t) => {
                        const idInfo = getTeacherDisplayIdentifier(t);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTeacher(t)}
                            className="w-full p-3 text-left hover:bg-blue-50/70 dark:hover:bg-blue-950/40 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white">
                                {t.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {idInfo.displayBadge} &bull; Mapel: {t.mataPelajaran || '-'}
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold shrink-0">
                              + Tambah
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {teacherSearchTerm
                          ? 'Tidak ada guru yang cocok dengan pencarian.'
                          : 'Semua guru sudah dipilih atau belum ada data guru.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CHIPS GURU TERPILIH */}
              {selectedTeachers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedTeachers.map((st) => (
                    <span
                      key={st.teacher.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-900 dark:text-blue-200"
                    >
                      <span>{st.teacher.fullName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeacher(st.teacher.id)}
                        className="text-blue-500 hover:text-rose-600 cursor-pointer ml-1"
                        title="Hapus dari daftar pilihan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGIAN 3: RINCIAN PENUGASAN TIAP GURU (MATA PELAJARAN, KELAS, JP, INVAL)  */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Rincian Kelas, Jam Pelajaran & Guru Pengganti Per Guru</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Setiap guru dapat memiliki lebih dari satu kelas atau JP yang ditinggalkan.
                </p>
              </div>

              <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                Total: {totalAssignmentsCount} Penugasan
              </span>
            </div>

            {/* DAFTAR KARTU GURU */}
            {selectedTeachers.length > 0 ? (
              selectedTeachers.map((st, teacherIdx) => {
                const teacherIdInfo = getTeacherDisplayIdentifier(st.teacher);
                const subjectSuggestions = parseTeacherSubjectSuggestions(st.teacher.mataPelajaran);

                return (
                  <div
                    key={st.teacher.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs space-y-3 p-4"
                  >
                    {/* Header Guru */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {teacherIdx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {st.teacher.fullName}
                          </h4>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {teacherIdInfo.displayBadge} &bull; Mapel Utama: {st.teacher.mataPelajaran || '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="text-[10px]">
                          {st.assignments.length} Kelas / Jam
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleToggleExpandTeacher(st.teacher.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title={st.isExpanded ? 'Sembunyikan rincian guru' : 'Tampilkan rincian guru'}
                        >
                          {st.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {!editingSubstitution && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeacher(st.teacher.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Hapus guru ini dari daftar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ringkasan saat kartu diciutkan (collapsed) */}
                    {!st.isExpanded && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 pb-1">
                        <span className="truncate pr-2">
                          {st.assignments.map((a) => `${a.kelas || 'Belum pilih kelas'} (${a.selectedPeriodNumbers.length > 0 ? `JP ${a.selectedPeriodNumbers.join(', ')}` : 'Belum pilih JP'})`).join(' • ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleExpandTeacher(st.teacher.id)}
                          className="text-blue-600 dark:text-blue-400 font-semibold text-[11px] hover:underline shrink-0"
                        >
                          Buka Penugasan
                        </button>
                      </div>
                    )}

                    {/* DAFTAR PENUGASAN UNTUK GURU INI (HANYA DITAMPILKAN JIKA EXPANDED) */}
                    {st.isExpanded && (
                      <>
                        <div className="space-y-4 pt-1">
                      {st.assignments.map((assignment, asgIdx) => {
                        const conflictWarning = getSubstituteConflictWarning(
                          assignment.guruPenggantiId,
                          assignment.selectedPeriodNumbers,
                          st.teacher.id,
                          assignment.assignmentId
                        );

                        return (
                          <div
                            key={assignment.assignmentId}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
                          >
                            {/* Baris Atas Rincian */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                Penugasan #{asgIdx + 1} untuk {st.teacher.fullName}
                              </span>

                              {st.assignments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveAssignment(st.teacher.id, assignment.assignmentId)
                                  }
                                  className="text-rose-600 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Hapus Penugasan Ini</span>
                                </button>
                              )}
                            </div>

                            {/* Grid Mapel & Kelas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Mata Pelajaran */}
                              <div>
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                  Mata Pelajaran yang Ditinggalkan *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={assignment.mataPelajaran}
                                  onChange={(e) =>
                                    handleUpdateAssignment(st.teacher.id, assignment.assignmentId, {
                                      mataPelajaran: e.target.value,
                                    })
                                  }
                                  placeholder="Contoh: Matematika Peminatan..."
                                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                                />
                                {subjectSuggestions.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="text-[10px] text-slate-400">Saran Mapel:</span>
                                    {subjectSuggestions.map((sug) => (
                                      <button
                                        key={sug}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAssignment(st.teacher.id, assignment.assignmentId, {
                                            mataPelajaran: sug,
                                          })
                                        }
                                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                      >
                                        {sug}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Pilihan Kelas (Dari Data Siswa Aktif) */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                                    Kelas yang Ditinggalkan *
                                  </label>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Sumber: Data Siswa Aktif
                                  </span>
                                </div>

                                {isLoadingClasses ? (
                                  <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-400">
                                    Memuat daftar kelas aktif...
                                  </div>
                                ) : classesError ? (
                                  <div className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700">
                                    {classesError}
                                  </div>
                                ) : activeClasses.length === 0 ? (
                                  <div className="p-2 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
                                    Belum ada data siswa / kelas aktif di sistem.
                                  </div>
                                ) : (
                                  <select
                                    required
                                    value={assignment.kelas}
                                    onChange={(e) =>
                                      handleUpdateAssignment(st.teacher.id, assignment.assignmentId, {
                                        kelas: e.target.value,
                                      })
                                    }
                                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                                  >
                                    <option value="" disabled>-- Pilih Kelas Aktif --
                                    </option>
                                    {activeClasses.map((cls) => (
                                      <option key={cls} value={cls}>{cls}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {/* Peringatan jika kelas terpilih sudah nonaktif / tidak ada di master */}
                                {assignment.kelas &&
                                  !isLoadingClasses &&
                                  activeClasses.length > 0 &&
                                  !activeClasses.includes(assignment.kelas) && (
                                    <div className="mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>
                                        Kelas <strong>{assignment.kelas}</strong> tidak lagi aktif pada master data siswa. Silakan pilih kelas aktif yang berlaku.
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>

                            {/* PILIHAN JAM PELAJARAN (JP) DARI KONFIGURASI HARI TERSEBUT */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Jam Pelajaran (JP) yang Terdampak *</span>
                                </label>

                                <span className="text-[10px] font-mono text-slate-500">
                                  Jadwal Hari {dayOfWeek} ({availablePeriodsForDay.length} JP)
                                </span>
                              </div>

                              {availablePeriodsForDay.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                    {availablePeriodsForDay.map((p) => {
                                      const isSelected = assignment.selectedPeriodNumbers.includes(
                                        p.periodNumber
                                      );
                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() =>
                                            handleTogglePeriod(
                                              st.teacher.id,
                                              assignment.assignmentId,
                                              p.periodNumber
                                            )
                                          }
                                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                                          }`}
                                        >
                                          <div className="font-bold text-xs flex items-center justify-between">
                                            <span>JP {p.periodNumber}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                          </div>
                                          <div
                                            className={`text-[10px] font-mono mt-0.5 ${
                                              isSelected ? 'text-blue-100' : 'text-slate-500'
                                            }`}
                                          >
                                            {p.startTime} - {p.endTime}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Rangkuman Waktu Terpilih */}
                                  {assignment.selectedPeriodNumbers.length > 0 && (
                                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                                      <span>Rangkuman Jam Terpilih:</span>
                                      <span>
                                        {
                                          formatSelectedPeriodsDisplay(
                                            availablePeriodsForDay.filter((p) =>
                                              assignment.selectedPeriodNumbers.includes(p.periodNumber)
                                            )
                                          ).combinedDisplay
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-400 italic">
                                  Tidak ada jam pelajaran aktif yang terdaftar untuk hari {dayOfWeek}. Konfigurasikan jam pelajaran di Pengaturan Admin.
                                </div>
                              )}
                            </div>

                            {/* GURU PENGGANTI (INVAL) & STATUS BENTROK */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Guru Pengganti / Inval (Opsional)</span>
                                </label>
                                <span className="text-[10px] text-slate-400">
                                  Dapat dikosongkan (Status: Belum Ditugaskan)
                                </span>
                              </div>

                              <select
                                value={assignment.guruPenggantiId}
                                onChange={(e) => {
                                  const subId = e.target.value;
                                  const subTeacher = teachers.find((t) => t.id === subId);
                                  handleUpdateAssignment(st.teacher.id, assignment.assignmentId, {
                                    guruPenggantiId: subId,
                                    guruPenggantiName: subTeacher ? subTeacher.fullName : '',
                                  });
                                }}
                                className={`w-full p-2 rounded-xl border bg-white dark:bg-slate-900 text-xs font-semibold ${
                                  assignment.guruPenggantiId
                                    ? 'border-emerald-400 text-emerald-900 dark:text-emerald-200'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <option value="">-- Belum Ditugaskan (Menunggu Inval) --</option>
                                {teachers
                                  .filter((t) => t.id !== st.teacher.id) // Guru pengganti tidak boleh sama dengan guru berhalangan
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      <GraduationCap className="w-3.5 h-3.5 mr-1" /> {t.fullName} ({t.mataPelajaran || 'Guru'})
                                    </option>
                                  ))}
                              </select>

                              {/* PERINGATAN BENTROK JADWAL GURU PENGGANTI */}
                              {conflictWarning && (
                                <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Peringatan Bentrok:</strong> {conflictWarning}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* MATERI DAN TUGAS SISWA */}
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                Materi dan Instruksi Tugas Siswa di Kelas *
                              </label>
                              <textarea
                                required
                                rows={2}
                                value={assignment.materiDanTugasSiswa}
                                onChange={(e) =>
                                  handleUpdateAssignment(st.teacher.id, assignment.assignmentId, {
                                    materiDanTugasSiswa: e.target.value,
                                  })
                                }
                                placeholder="Tuliskan tugas mandiri/kelompok, nomor halaman modul, atau lembar kerja siswa yang harus dikerjakan di kelas..."
                                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tombol Tambah Kelas / JP untuk guru ini */}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => handleAddAssignmentForTeacher(st.teacher.id)}
                      >
                        + Tambah Kelas / JP untuk {st.teacher.fullName}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
              })
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs">
                Belum ada guru yang dipilih. Silakan cari dan pilih guru pada kolom pencarian di atas.
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          
        </DialogForm>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL RINGKASAN SEBELUM SIMPAN                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Ringkasan Penugasan Guru Berhalangan & Inval"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
            <div>
              <span className="font-bold text-blue-900 dark:text-blue-200 block">
                Pencatatan Massal Guru Inval
              </span>
              <span className="text-[11px] text-blue-700 dark:text-blue-300">
                Tanggal: {formatIndonesianDate(tanggal)} ({dayOfWeek})
              </span>
            </div>
            <Badge variant="primary" className="text-xs font-mono font-bold">
              {totalAssignmentsCount} Penugasan ({selectedTeachers.length} Guru)
            </Badge>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900">
            {selectedTeachers.map((entry) =>
              entry.assignments.map((a, idx) => {
                const selectedPeriodsList = availablePeriodsForDay.filter((p) =>
                  a.selectedPeriodNumbers.includes(p.periodNumber)
                );
                const periodsDisplay = formatSelectedPeriodsDisplay(selectedPeriodsList);

                return (
                  <div
                    key={a.assignmentId}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {entry.teacher.fullName} &bull; {a.mataPelajaran}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Kelas: <strong>{a.kelas}</strong> &bull; Waktu: {periodsDisplay.combinedDisplay}
                      </div>
                    </div>

                    <div className="text-right sm:shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.guruPenggantiId
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {a.guruPenggantiName ? `Inval: ${a.guruPenggantiName}` : 'Belum Ditugaskan'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsSummaryModalOpen(false)}
              disabled={isSubmitting}
            >
              Kembali Edit
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleConfirmSave}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Konfirmasi & Simpan Semua Penugasan
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL HASIL PENYIMPANAN BATCH & RETRY KHUSUS YANG GAGAL                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResultModalOpen}
        onClose={() => {
          setIsResultModalOpen(false);
          onClose();
        }}
        title="Laporan Status Penyimpanan Penugasan"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            {batchResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  res.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                }`}
              >
                {res.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {res.guruBerhalanganName} ({res.kelas} - {res.jamPelajaran})
                  </div>
                  {res.success ? (
                    <div className="text-[11px] opacity-90">
                      Berhasil disimpan &bull; Inval: {res.guruPenggantiName || 'Belum Ditugaskan'}
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                      Gagal: {res.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tombol aksi */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            {batchResults.some((r) => !r.success) ? (
              <>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setIsResultModalOpen(false);
                    onClose();
                  }}
                >
                  Tutup
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={handleRetryFailedItems}
                  isLoading={isSubmitting}
                >
                  Coba Lagi Rincian Gagal
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setIsResultModalOpen(false);
                  onClose();
                }}
              >
                Selesai
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};
