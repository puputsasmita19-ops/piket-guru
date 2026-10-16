import { DialogForm } from '../../components/common/DialogForm';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  VisitorRecord,
  VisitorCategory,
  VISITOR_CATEGORIES,
} from '../../types/visitor.types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { UserProfile } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import {
  UserCheck,
  Building,
  Phone,
  CreditCard,
  Tag,
  Camera,
  Trash2,
  Users,
  AlertCircle,
  AlertTriangle,
  Save,
  Clock,
  FileText,
  Search,
  ChevronDown,
  X,
  Check,
  GraduationCap,
  Briefcase,
  Building2,
  Shield,
  Loader2,
} from '../../components/icons';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';
import { stampDocumentationPhoto, detectLocationForWatermark } from '../../services/watermark/watermarkService';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { SchoolSettings } from '../../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';

export interface RecipientOption {
  id: string; // Unique option ID (e.g. `teacher:tch-1`, `staff:stf-1`, `unit:tu`, `user:usr-1`)
  targetType: 'TEACHER' | 'STAFF' | 'UNIT' | 'USER' | 'CUSTOM';
  recipientId?: string; // id from collection (teacherId / staffId / unitCode)
  userId?: string; // linked user profile id
  displayName: string; // Nama Lengkap resmi
  subtitle?: string; // Mata Pelajaran, Jabatan, Divisi, atau Role
  badgeLabel?: string; // 'GURU', 'STAF', 'UNIT', 'KEPALA SEKOLAH'
  badgeColor?: string; // CSS color classes
  searchableText: string; // Lowercase blob for fast multi-field searching
}

// Preset official school units
const DEFAULT_SCHOOL_UNITS: Array<{ id: string; name: string; subtitle: string }> = [
  { id: 'unit-tu', name: 'Tata Usaha (TU)', subtitle: 'Layanan Administrasi & Persuratan' },
  { id: 'unit-bk', name: 'Bimbingan & Konseling (BK)', subtitle: 'Konsultasi Siswa & Orang Tua' },
  { id: 'unit-sarpras', name: 'Sarana & Prasarana (Sarpras)', subtitle: 'Logistik & Fasilitas Sekolah' },
  { id: 'unit-perpustakaan', name: 'Perpustakaan', subtitle: 'Layanan Koleksi & Literasi' },
  { id: 'unit-lab', name: 'Laboratorium Sekolah', subtitle: 'Lab Komputer & Lab IPA' },
  { id: 'unit-satpam', name: 'Pos Keamanan / Satpam', subtitle: 'Keamanan Lingkungan Sekolah' },
];

interface VisitorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Partial<VisitorRecord>,
    isEdit?: boolean
  ) => Promise<void>;
  editingVisitor?: VisitorRecord | null;
  teachers?: TeacherRecord[];
  staffList?: StaffRecord[];
  usersList?: UserProfile[];
  isLoadingMaster?: boolean;
}

export const VisitorFormModal: React.FC<VisitorFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingVisitor = null,
  teachers = [],
  staffList = [],
  usersList = [],
  isLoadingMaster = false,
}) => {
  const { currentUser } = useAuth();

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    try {
      const cached = localStorage.getItem('piket_guru_school_config');
      if (cached) return { ...DEFAULT_SCHOOL_SETTINGS, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_SCHOOL_SETTINGS;
  });

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamMasuk, setJamMasuk] = useState(formatTime(new Date()));
  const [jamKeluar, setJamKeluar] = useState<string | undefined>(undefined);
  const [namaTamu, setNamaTamu] = useState('');
  const [instansiAsal, setInstansiAsal] = useState('');
  const [kategori, setKategori] = useState<VisitorCategory>('UMUM');
  const [keteranganLainnya, setKeteranganLainnya] = useState('');
  const [noHp, setNoHp] = useState('');
  const [nomorIdentitas, setNomorIdentitas] = useState('');
  const [nomorBadge, setNomorBadge] = useState('TAMU-01');

  // Recipient / Host States (Combobox)
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientOption | null>(null);
  const [tujuanBertemu, setTujuanBertemu] = useState(''); // Text representation / snapshot
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState<'ALL' | 'TEACHER' | 'STAFF' | 'UNIT'>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const [keperluan, setKeperluan] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const pendingRecordId = useRef('');
  useEffect(() => {
    if (isOpen) pendingRecordId.current = editingVisitor?.id || `vis-${crypto.randomUUID()}`;
  }, [isOpen, editingVisitor?.id]);
  const [catatanPetugas, setCatatanPetugas] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [availableDraft, setAvailableDraft] = useState<{ updatedAt: string; data: any; attachments?: { [key: string]: Blob } } | null>(null);

  const draftKey = editingVisitor?.id || 'new-visitor';

  // Refs for Combobox
  const comboboxContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Concurrency detection
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null);
  const [hasConcurrencyConflict, setHasConcurrencyConflict] = useState(false);

  // ---------------------------------------------------------------------------
  // Build unified recipient options list (Deduplicated & Cleaned)
  // ---------------------------------------------------------------------------
  const recipientOptions = useMemo<RecipientOption[]>(() => {
    const list: RecipientOption[] = [];
    const seenUserIds = new Set<string>();
    const seenTeacherIds = new Set<string>();
    const seenStaffIds = new Set<string>();

    // 1. Teachers
    teachers.forEach((t) => {
      if (!t.fullName) return;
      seenTeacherIds.add(t.id);
      if (t.userId) seenUserIds.add(t.userId);

      const nipPart = t.nip && t.nip !== '-' ? `NIP ${t.nip}` : '';
      const nuptkPart = t.nuptk && t.nuptk !== '-' ? `NUPTK ${t.nuptk}` : '';
      const subjectPart = t.mataPelajaran ? t.mataPelajaran.trim() : '';
      const idGuruPart = t.idGuru ? `ID ${t.idGuru}` : '';

      const subtitle = [subjectPart, nipPart || nuptkPart || idGuruPart].filter(Boolean).join(' • ');

      const searchKeywords = [
        t.fullName,
        t.mataPelajaran || '',
        t.nip || '',
        t.nuptk || '',
        t.idGuru || '',
        t.id || '',
        'guru',
        'pengajar',
      ].join(' ').toLowerCase();

      list.push({
        id: `teacher:${t.id}`,
        targetType: 'TEACHER',
        recipientId: t.id,
        userId: t.userId,
        displayName: t.fullName.trim(),
        subtitle: subtitle || 'Guru Pengajar',
        badgeLabel: 'GURU',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
        searchableText: searchKeywords,
      });
    });

    // 2. Staff / Tenaga Kependidikan
    staffList.forEach((s) => {
      if (!s.fullName) return;
      seenStaffIds.add(s.id);
      if (s.userId) seenUserIds.add(s.userId);

      const nipPart = s.nip && s.nip !== '-' ? `NIP ${s.nip}` : '';
      const divisiPart = s.divisi ? s.divisi.trim() : '';
      const jabatanPart = s.jabatan ? s.jabatan.trim() : '';
      const subtitle = [jabatanPart || divisiPart, nipPart].filter(Boolean).join(' • ');

      const searchKeywords = [
        s.fullName,
        s.divisi || '',
        s.jabatan || '',
        s.nip || '',
        s.id || '',
        'staf',
        'staff',
        'karyawan',
      ].join(' ').toLowerCase();

      list.push({
        id: `staff:${s.id}`,
        targetType: 'STAFF',
        recipientId: s.id,
        userId: s.userId,
        displayName: s.fullName.trim(),
        subtitle: subtitle || 'Tenaga Kependidikan',
        badgeLabel: 'STAF',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        searchableText: searchKeywords,
      });
    });

    // 3. User Accounts (Headmaster, Admin, BK, etc. that might not be in teachers/staff)
    usersList.forEach((u) => {
      if (!u.fullName || !u.isActive) return;
      if (seenUserIds.has(u.id)) return; // Deduplicated by userId
      seenUserIds.add(u.id);

      const roleBadge = u.role === 'KEPALA_SEKOLAH' ? 'KEPALA SEKOLAH' : u.role === 'ADMIN' ? 'ADMINISTRATOR' : u.role;
      const nipPart = u.nip && u.nip !== '-' ? `NIP ${u.nip}` : '';
      const loginPart = u.loginId ? `ID: ${u.loginId}` : '';
      const subtitle = [roleBadge, nipPart || loginPart].filter(Boolean).join(' • ');

      const searchKeywords = [
        u.fullName,
        u.loginId || '',
        u.nip || '',
        u.role || '',
        'kepala sekolah',
        'admin',
      ].join(' ').toLowerCase();

      list.push({
        id: `user:${u.id}`,
        targetType: 'USER',
        userId: u.id,
        displayName: u.fullName.trim(),
        subtitle,
        badgeLabel: u.role === 'KEPALA_SEKOLAH' ? 'KEPALA SEKOLAH' : 'AKUN RESMI',
        badgeColor:
          u.role === 'KEPALA_SEKOLAH'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        searchableText: searchKeywords,
      });
    });

    // 4. Preset Official School Units (Tata Usaha, BK, dsb)
    DEFAULT_SCHOOL_UNITS.forEach((unit) => {
      list.push({
        id: `unit:${unit.id}`,
        targetType: 'UNIT',
        recipientId: unit.id,
        displayName: unit.name,
        subtitle: unit.subtitle,
        badgeLabel: 'UNIT / DIVISI',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        searchableText: `${unit.name} ${unit.subtitle} tata usaha bk bimbingan konseling sarpras perpus unit`.toLowerCase(),
      });
    });

    return list;
  }, [teachers, staffList, usersList]);

  // Filtered recipient list based on search and active tab
  const filteredRecipients = useMemo(() => {
    let result = recipientOptions;

    // Filter by type tab
    if (activeTypeTab === 'TEACHER') {
      result = result.filter((r) => r.targetType === 'TEACHER');
    } else if (activeTypeTab === 'STAFF') {
      result = result.filter((r) => r.targetType === 'STAFF');
    } else if (activeTypeTab === 'UNIT') {
      result = result.filter((r) => r.targetType === 'UNIT');
    }

    // Filter by search query
    const q = recipientSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => r.searchableText.includes(q));
    }

    return result;
  }, [recipientOptions, activeTypeTab, recipientSearchQuery]);

  // ---------------------------------------------------------------------------
  // Initialize form when modal opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      if (editingVisitor) {
        setTanggal(editingVisitor.tanggal || new Date().toISOString().split('T')[0]);
        setJamMasuk(editingVisitor.jamMasuk || formatTime(new Date()));
        setJamKeluar(editingVisitor.jamKeluar);
        setNamaTamu(editingVisitor.namaTamu || '');
        setInstansiAsal(editingVisitor.instansiAsal || '');
        setKategori(editingVisitor.kategori || 'UMUM');
        setKeteranganLainnya(editingVisitor.keteranganLainnya || '');
        setNoHp(editingVisitor.noHp || '');
        setNomorIdentitas(editingVisitor.nomorIdentitas || '');
        setNomorBadge(editingVisitor.nomorBadge || 'TAMU-01');

        const initialTujuan = editingVisitor.tujuanBertemu || '';
        setTujuanBertemu(initialTujuan);

        // Attempt to match with existing recipient options
        let matched: RecipientOption | undefined;
        if (editingVisitor.tujuanRecipientId) {
          matched = recipientOptions.find(
            (r) => r.recipientId === editingVisitor.tujuanRecipientId || r.id === editingVisitor.tujuanRecipientId
          );
        }
        if (!matched && editingVisitor.tujuanUserId) {
          matched = recipientOptions.find((r) => r.userId === editingVisitor.tujuanUserId);
        }
        if (!matched && initialTujuan) {
          const cleanName = initialTujuan.toLowerCase().trim();
          matched = recipientOptions.find((r) => {
            const disp = r.displayName.toLowerCase().trim();
            return disp === cleanName || cleanName.startsWith(disp) || disp.startsWith(cleanName);
          });
        }

        if (matched) {
          setSelectedRecipient(matched);
        } else if (initialTujuan) {
          // Custom snapshot from legacy record
          setSelectedRecipient({
            id: `custom:legacy`,
            targetType: editingVisitor.tujuanTargetType || 'CUSTOM',
            recipientId: editingVisitor.tujuanRecipientId,
            userId: editingVisitor.tujuanUserId,
            displayName: initialTujuan,
            subtitle: editingVisitor.tujuanDetail || 'Tujuan Tercatat',
            badgeLabel: 'TERCATAT',
            badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            searchableText: initialTujuan.toLowerCase(),
          });
        } else {
          setSelectedRecipient(null);
        }

        setKeperluan(editingVisitor.keperluan || '');
        setFotoUrl(editingVisitor.fotoUrl);
        setCatatanPetugas(editingVisitor.catatanPetugas || '');
        setOriginalUpdatedAt(editingVisitor.updatedAt || null);
      } else {
        // Mode Baru: DO NOT select first teacher automatically (biarkan kosong agar pengguna memilih secara sadar)
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamMasuk(formatTime(new Date()));
        setJamKeluar(undefined);
        setNamaTamu('');
        setInstansiAsal('');
        setKategori('UMUM');
        setKeteranganLainnya('');
        setNoHp('');
        setNomorIdentitas('');
        setNomorBadge(`TAMU-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`);
        setTujuanBertemu('');
        setSelectedRecipient(null);
        setKeperluan('');
        setFotoUrl(undefined);
        setCatatanPetugas('');
        setOriginalUpdatedAt(null);
      }

      setHasConcurrencyConflict(false);
      setErrorMessage(null);
      setFieldErrors({});
      setIsSubmitting(false);
      setAvailableDraft(null);
      setIsComboboxOpen(false);
      setRecipientSearchQuery('');
      setActiveTypeTab('ALL');
      setHighlightedIndex(-1);

      // Check for saved uncommitted draft
      if (currentUser?.id && !editingVisitor) {
        DraftService.getDraft(currentUser.id, 'VISITOR', draftKey).then((saved) => {
          if (saved && saved.data) {
            setAvailableDraft({ updatedAt: saved.updatedAt, data: saved.data, attachments: saved.attachments });
          }
        });
      }
    }
  }, [isOpen, editingVisitor, recipientOptions, currentUser?.id, draftKey]);

  // Click outside to close combobox popover
  useEffect(() => {
    if (!isComboboxOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxContainerRef.current && !comboboxContainerRef.current.contains(e.target as Node)) {
        setIsComboboxOpen(false);
        setRecipientSearchQuery('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isComboboxOpen]);

  // Focus search input when combobox opens
  useEffect(() => {
    if (isComboboxOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isComboboxOpen]);

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (isComboboxOpen && highlightedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll('[data-combobox-item]');
      const activeEl = items[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isComboboxOpen]);

  // Debounced auto-save draft while typing
  useEffect(() => {
    if (!isOpen || !currentUser?.id || editingVisitor) return;
    if (!namaTamu.trim() && !instansiAsal.trim() && !keperluan.trim() && !tujuanBertemu.trim() && !fotoUrl) return;

    const saveAsync = async () => {
      const attachments: { [key: string]: Blob } = {};
      let cleanFotoUrl = fotoUrl;

      if (fotoUrl && fotoUrl.startsWith('data:')) {
        try {
          const blob = await DraftService.dataUrlToBlob(fotoUrl);
          attachments['visitor_photo'] = blob;
          cleanFotoUrl = 'attachment:visitor_photo';
        } catch {}
      }

      DraftService.saveDraftDebounced(currentUser.id, 'VISITOR', draftKey, {
        tanggal,
        jamMasuk,
        jamKeluar,
        namaTamu,
        instansiAsal,
        kategori,
        keteranganLainnya,
        noHp,
        nomorIdentitas,
        nomorBadge,
        tujuanBertemu,
        tujuanRecipientId: selectedRecipient?.recipientId || selectedRecipient?.id,
        tujuanUserId: selectedRecipient?.userId,
        tujuanTargetType: selectedRecipient?.targetType,
        tujuanDetail: selectedRecipient?.subtitle,
        keperluan,
        fotoUrl: cleanFotoUrl,
        pendingRecordId: pendingRecordId.current,
        catatanPetugas,
      }, attachments);
    };

    saveAsync().catch(() => {});
  }, [
    isOpen,
    currentUser?.id,
    editingVisitor,
    tanggal,
    jamMasuk,
    jamKeluar,
    namaTamu,
    instansiAsal,
    kategori,
    keteranganLainnya,
    noHp,
    nomorIdentitas,
    nomorBadge,
    tujuanBertemu,
    selectedRecipient,
    keperluan,
    fotoUrl,
    catatanPetugas,
    draftKey,
  ]);

  const handleRestoreDraft = async () => {
    if (!availableDraft?.data) return;
    const d = availableDraft.data;
    if (typeof d.pendingRecordId === 'string' && d.pendingRecordId.startsWith('vis-')) pendingRecordId.current = d.pendingRecordId;
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.jamMasuk) setJamMasuk(d.jamMasuk);
    if (d.jamKeluar !== undefined) setJamKeluar(d.jamKeluar);
    if (d.namaTamu) setNamaTamu(d.namaTamu);
    if (d.instansiAsal !== undefined) setInstansiAsal(d.instansiAsal);
    if (d.kategori) setKategori(d.kategori);
    if (d.keteranganLainnya !== undefined) setKeteranganLainnya(d.keteranganLainnya);
    if (d.noHp !== undefined) setNoHp(d.noHp);
    if (d.nomorIdentitas !== undefined) setNomorIdentitas(d.nomorIdentitas);
    if (d.nomorBadge) setNomorBadge(d.nomorBadge);
    if (d.tujuanBertemu) {
      setTujuanBertemu(d.tujuanBertemu);
      const matched = recipientOptions.find(
        (r) =>
          r.id === d.tujuanRecipientId ||
          r.recipientId === d.tujuanRecipientId ||
          r.displayName.toLowerCase() === d.tujuanBertemu.toLowerCase()
      );
      if (matched) setSelectedRecipient(matched);
      else {
        setSelectedRecipient({
          id: 'custom:draft',
          targetType: d.tujuanTargetType || 'CUSTOM',
          recipientId: d.tujuanRecipientId,
          userId: d.tujuanUserId,
          displayName: d.tujuanBertemu,
          subtitle: d.tujuanDetail || 'Draf Kunjungan',
          badgeLabel: 'DRAF',
          badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
          searchableText: d.tujuanBertemu.toLowerCase(),
        });
      }
    }
    if (d.keperluan) setKeperluan(d.keperluan);
    if (d.catatanPetugas !== undefined) setCatatanPetugas(d.catatanPetugas);

    if (d.fotoUrl?.startsWith('attachment:') && availableDraft.attachments?.['visitor_photo']) {
      try {
        const dataUrl = await DraftService.blobToDataUrl(availableDraft.attachments['visitor_photo']);
        setFotoUrl(dataUrl);
      } catch {}
    } else if (d.fotoUrl) {
      setFotoUrl(d.fotoUrl);
    }

    setAvailableDraft(null);
  };

  const handleDiscardDraft = async () => {
    if (!currentUser?.id) return;
    await DraftService.deleteDraft(currentUser.id, 'VISITOR', draftKey);
    setAvailableDraft(null);
  };

  // Real-time concurrency listener
  useEffect(() => {
    if (isOpen && editingVisitor?.id && originalUpdatedAt) {
      const unsub = FirestoreService.subscribeToDocument<VisitorRecord>(
        'visitors',
        editingVisitor.id,
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
  }, [isOpen, editingVisitor?.id, originalUpdatedAt]);

  // ---------------------------------------------------------------------------
  // Combobox Select & Keyboard Navigation Handlers
  // ---------------------------------------------------------------------------
  const handleSelectRecipient = (opt: RecipientOption) => {
    setSelectedRecipient(opt);
    setTujuanBertemu(opt.displayName);
    setIsComboboxOpen(false);
    setRecipientSearchQuery('');
    setHighlightedIndex(-1);
    if (fieldErrors.tujuanBertemu) {
      setFieldErrors((prev) => ({ ...prev, tujuanBertemu: '' }));
    }
  };

  const handleClearRecipient = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRecipient(null);
    setTujuanBertemu('');
    setRecipientSearchQuery('');
    setHighlightedIndex(-1);
    setIsComboboxOpen(false);
  };

  const handleComboboxKeyDown = (e: React.KeyboardEvent) => {
    if (!isComboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsComboboxOpen(true);
        setRecipientSearchQuery('');
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsComboboxOpen(false);
      setRecipientSearchQuery('');
      setHighlightedIndex(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredRecipients.length ? 0 : next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredRecipients.length - 1 : next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredRecipients.length) {
        handleSelectRecipient(filteredRecipients[highlightedIndex]);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Form Submission
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!namaTamu.trim()) {
      errors.namaTamu = 'Nama lengkap tamu wajib diisi';
      missing.push('Nama Tamu');
    }

    if (!instansiAsal.trim()) {
      errors.instansiAsal = 'Instansi atau lembaga asal wajib diisi';
      missing.push('Instansi Asal');
    }

    if (!nomorBadge.trim()) {
      errors.nomorBadge = 'Nomor badge tamu wajib diisi';
      missing.push('Nomor Badge');
    }

    // Recipient selection validation: must have selected a valid recipient OR has non-empty tujuanBertemu
    const finalTujuanSnapshot = tujuanBertemu.trim();
    if (!finalTujuanSnapshot) {
      errors.tujuanBertemu = 'Pihak/guru yang dituju wajib dipilih dari daftar';
      missing.push('Pihak Dituju');
    }

    if (!keperluan.trim()) {
      errors.keperluan = 'Maksud dan keperluan kunjungan wajib diisi';
      missing.push('Keperluan Kunjungan');
    }

    if (kategori === 'LAINNYA') {
      const trimmedKet = keteranganLainnya.trim();
      if (!trimmedKet) {
        errors.keteranganLainnya = 'Keterangan kategori tamu lainnya wajib diisi';
        missing.push('Keterangan Kategori Tamu');
      } else if (trimmedKet.length > 300) {
        errors.keteranganLainnya = 'Keterangan kategori tidak boleh lebih dari 300 karakter';
      }
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
      const visitorId = editingVisitor?.id || pendingRecordId.current || `vis-${crypto.randomUUID()}`;
      pendingRecordId.current = visitorId;

      const payload: Partial<VisitorRecord> = {
        id: visitorId,
        tanggal,
        jamMasuk,
        jamKeluar: editingVisitor?.jamKeluar || jamKeluar,
        namaTamu: namaTamu.trim(),
        instansiAsal: instansiAsal.trim(),
        kategori,
        keteranganLainnya: kategori === 'LAINNYA' ? keteranganLainnya.trim() : undefined,
        noHp: noHp.trim() || '',
        nomorIdentitas: nomorIdentitas.trim() || '',
        nomorBadge: nomorBadge.trim(),
        tujuanBertemu: finalTujuanSnapshot,
        tujuanRecipientId: selectedRecipient?.recipientId || (editingVisitor ? editingVisitor.tujuanRecipientId : undefined),
        tujuanUserId: selectedRecipient?.userId || (editingVisitor ? editingVisitor.tujuanUserId : undefined),
        tujuanTargetType: selectedRecipient?.targetType || (editingVisitor ? editingVisitor.tujuanTargetType : 'CUSTOM'),
        tujuanDetail: selectedRecipient?.subtitle || (editingVisitor ? editingVisitor.tujuanDetail : undefined),
        keperluan: keperluan.trim(),
        fotoUrl: fotoUrl || undefined,
        status: editingVisitor ? editingVisitor.status : 'SEDANG_BERKUNJUNG',
        catatanPetugas: catatanPetugas.trim() || undefined,
        petugasPiketName: editingVisitor?.petugasPiketName || currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: editingVisitor?.petugasPiketId || currentUser?.id || 'usr-piket',
        createdAt: editingVisitor?.createdAt,
        createdBy: editingVisitor?.createdBy,
      };

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline && currentUser) {
        try {
          const recId = payload.id || `vis-${payload.tanggal}-${Date.now().toString(36)}`;
          await SyncQueueService.enqueue(
            currentUser,
            'VISITOR_REPORT',
            'visitors',
            recId,
            { record: { ...payload, id: recId }, isUpdate: Boolean(editingVisitor) }
          );
          await DraftService.deleteDraft(currentUser.id, 'VISITOR', draftKey);
          onClose();
        } catch (err: any) {
          setErrorMessage(`Gagal menyimpan antrean offline: ${err.message}`);
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      try {
        await onSave(payload, Boolean(editingVisitor));
        if (currentUser) {
          await DraftService.deleteDraft(currentUser.id, 'VISITOR', draftKey);
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
            const recId = payload.id || `vis-${payload.tanggal}-${Date.now().toString(36)}`;
            await SyncQueueService.enqueue(
              currentUser,
              'VISITOR_REPORT',
              'visitors',
              recId,
              { record: { ...payload, id: recId }, isUpdate: Boolean(editingVisitor) }
            );
            await DraftService.deleteDraft(currentUser.id, 'VISITOR', draftKey);
            onClose();
            return;
          } catch {}
        }
        throw err;
      }
    } catch (err: any) {
      console.warn('[VisitorFormModal] Save error:', err);
      const isPermDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions');

      setErrorMessage(
        isPermDenied
          ? 'Tidak memiliki izin menyimpan catatan buku tamu.'
          : err.message || 'Gagal menyimpan catatan buku tamu.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingVisitor ? 'Ubah Catatan Buku Tamu' : 'Registrasi Tamu Masuk (Check-In)'}
        maxWidth="lg"
      >
        <DialogForm onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 sm:gap-5" actions={<div className="app-form-actions flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] px-5 text-xs font-semibold"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="min-h-[44px] px-6 font-bold shadow-md text-xs"
              isLoading={isSubmitting}
              leftIcon={editingVisitor ? <Save className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            >
              {editingVisitor ? 'Simpan Perubahan Buku Tamu' : 'Check-In & Berikan Badge'}
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
                  <p className="font-bold">Ditemukan draf isian buku tamu tersimpan di perangkat ini</p>
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

          {/* CONCURRENCY WARNING */}
          {hasConcurrencyConflict && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Peringatan: Dokumen ini telah diperbarui oleh pengguna lain.</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Data kunjungan tamu ini baru saja diubah di server. Jika Anda melanjutkan penyimpanan, perubahan tersebut akan ditimpa.
                </p>
              </div>
            </div>
          )}

          {/* Row 1: Tanggal & Jam Masuk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Tanggal Kunjungan *</span>
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Jam Masuk (WIB) *</span>
              </label>
              <input
                type="time"
                required
                value={jamMasuk}
                onChange={(e) => setJamMasuk(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Nama Tamu & Instansi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Nama Lengkap Tamu *</span>
              </label>
              <input
                type="text"
                required
                value={namaTamu}
                onChange={(e) => {
                  setNamaTamu(e.target.value);
                  if (fieldErrors.namaTamu) setFieldErrors((prev) => ({ ...prev, namaTamu: '' }));
                }}
                placeholder="Contoh: Ir. Hendra Gunawan"
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.namaTamu
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              {fieldErrors.namaTamu && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.namaTamu}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-500" />
                <span>Instansi / Lembaga Asal *</span>
              </label>
              <input
                type="text"
                required
                value={instansiAsal}
                onChange={(e) => {
                  setInstansiAsal(e.target.value);
                  if (fieldErrors.instansiAsal) setFieldErrors((prev) => ({ ...prev, instansiAsal: '' }));
                }}
                placeholder="Contoh: Dinas Pendidikan / Orang Tua Siswa"
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.instansiAsal
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              {fieldErrors.instansiAsal && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.instansiAsal}</p>
              )}
            </div>
          </div>

          {/* Row 3: Kategori & No Badge */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kategori Tamu *
                </label>
                <select
                  value={kategori}
                  onChange={(e) => {
                    const newCat = e.target.value as VisitorCategory;
                    setKategori(newCat);
                    if (newCat !== 'LAINNYA' && fieldErrors.keteranganLainnya) {
                      setFieldErrors((prev) => ({ ...prev, keteranganLainnya: '' }));
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {VISITOR_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>No. WhatsApp Tamu</span>
                </label>
                <input
                  type="tel"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-500" />
                  <span>Nomor Badge Tamu *</span>
                </label>
                <input
                  type="text"
                  required
                  value={nomorBadge}
                  onChange={(e) => {
                    setNomorBadge(e.target.value);
                    if (fieldErrors.nomorBadge) setFieldErrors((prev) => ({ ...prev, nomorBadge: '' }));
                  }}
                  placeholder="TAMU-01"
                  className={`w-full p-2.5 rounded-xl border ${
                    fieldErrors.nomorBadge
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />
                {fieldErrors.nomorBadge && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.nomorBadge}</p>
                )}
              </div>
            </div>

            {/* Kolom Keterangan Kategori jika Lain-lain */}
            {kategori === 'LAINNYA' && (
              <div className="min-w-0 w-full p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-200 block break-words">
                    Keterangan Kategori Tamu *
                  </label>
                  <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                    {keteranganLainnya.length}/300
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={keteranganLainnya}
                  onChange={(e) => {
                    setKeteranganLainnya(e.target.value);
                    if (fieldErrors.keteranganLainnya) {
                      setFieldErrors((prev) => ({ ...prev, keteranganLainnya: '' }));
                    }
                  }}
                  placeholder="Tuliskan spesifikasi kategori tamu (wajib, maks. 300 karakter)..."
                  className={`w-full p-2.5 rounded-xl border ${
                    fieldErrors.keteranganLainnya
                      ? 'border-rose-500 bg-rose-50/40'
                      : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                  } text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none`}
                />
                {fieldErrors.keteranganLainnya && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.keteranganLainnya}</p>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* Row 4: Searchable Combobox Pihak/Guru yang Dituju & No Identitas          */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Searchable Combobox Field */}
            <div className="space-y-1 relative" ref={comboboxContainerRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Pihak / Guru yang Dituju *</span>
                </label>
                {isLoadingMaster && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    <span>Memuat master...</span>
                  </span>
                )}
              </div>

              {/* Combobox Trigger Box */}
              <div className="relative">
                <div
                  role="combobox"
                  tabIndex={0}
                  aria-haspopup="listbox"
                  aria-expanded={isComboboxOpen}
                  onClick={() => {
                    const willOpen = !isComboboxOpen;
                    setIsComboboxOpen(willOpen);
                    if (willOpen) {
                      // Buka dropdown dengan pencarian kosong (tanpa menjadikan nama lama sebagai filter)
                      setRecipientSearchQuery('');
                      setHighlightedIndex(-1);
                    }
                  }}
                  onKeyDown={handleComboboxKeyDown}
                  className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                    fieldErrors.tujuanBertemu
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : isComboboxOpen
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedRecipient ? (
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                        {selectedRecipient.targetType === 'TEACHER' ? (
                          <GraduationCap className="w-3.5 h-3.5" />
                        ) : selectedRecipient.targetType === 'UNIT' ? (
                          <Building2 className="w-3.5 h-3.5" />
                        ) : selectedRecipient.targetType === 'STAFF' ? (
                          <Briefcase className="w-3.5 h-3.5" />
                        ) : (
                          <Users className="w-3.5 h-3.5" />
                        )}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 truncate">
                      {selectedRecipient ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {selectedRecipient.displayName}
                          </span>
                          {selectedRecipient.subtitle && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden xs:inline">
                              • {selectedRecipient.subtitle}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Pilih atau cari guru / pihak yang dituju...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions in trigger: Clear Button & Chevron */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {selectedRecipient && (
                      <button
                        type="button"
                        onClick={handleClearRecipient}
                        title="Hapus Pilihan"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isComboboxOpen ? 'rotate-180 text-blue-500' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Combobox Dropdown Popover */}
                {isComboboxOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    style={{ maxHeight: '380px' }}
                  >
                    {/* Popover Header with Search Box */}
                    <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 space-y-2">
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={recipientSearchQuery}
                          onChange={(e) => {
                            setRecipientSearchQuery(e.target.value);
                            setHighlightedIndex(0);
                          }}
                          onKeyDown={handleComboboxKeyDown}
                          placeholder="Ketik nama, NIP, NUPTK, mapel, atau unit..."
                          className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        {recipientSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setRecipientSearchQuery('');
                              searchInputRef.current?.focus();
                            }}
                            className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filter category tabs (Semua, Guru, Staf, Unit) */}
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveTypeTab('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                            activeTypeTab === 'ALL'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Semua ({recipientOptions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTypeTab('TEACHER')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                            activeTypeTab === 'TEACHER'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Guru ({teachers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTypeTab('STAFF')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                            activeTypeTab === 'STAFF'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Staf ({staffList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTypeTab('UNIT')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                            activeTypeTab === 'UNIT'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          Unit ({DEFAULT_SCHOOL_UNITS.length})
                        </button>
                      </div>
                    </div>

                    {/* Popover Options Listbox */}
                    <div
                      ref={listboxRef}
                      role="listbox"
                      className="max-h-56 overflow-y-auto p-1.5 space-y-1 scrollbar-thin text-left divide-y divide-slate-100 dark:divide-slate-800/40"
                    >
                      {isLoadingMaster ? (
                        <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                          <span>Memuat daftar guru dan staf...</span>
                        </div>
                      ) : filteredRecipients.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            Pihak tidak ditemukan
                          </p>
                          <p className="text-[11px]">
                            {recipientSearchQuery
                              ? `Tidak ada hasil pencarian untuk "${recipientSearchQuery}".`
                              : 'Belum ada data guru/staf terdaftar.'}
                          </p>
                        </div>
                      ) : (
                        filteredRecipients.map((opt, idx) => {
                          const isSelected = selectedRecipient?.id === opt.id;
                          const isHighlighted = idx === highlightedIndex;

                          return (
                            <div
                              key={opt.id}
                              data-combobox-item
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectRecipient(opt)}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              className={`p-2 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2.5 ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800'
                                  : isHighlighted
                                  ? 'bg-slate-100/80 dark:bg-slate-800/80'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className="mt-0.5 shrink-0">
                                  {opt.targetType === 'TEACHER' ? (
                                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs">
                                      <GraduationCap className="w-3.5 h-3.5" />
                                    </div>
                                  ) : opt.targetType === 'UNIT' ? (
                                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xs">
                                      <Building2 className="w-3.5 h-3.5" />
                                    </div>
                                  ) : opt.targetType === 'STAFF' ? (
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs">
                                      <Briefcase className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs">
                                      <Shield className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                                      {opt.displayName}
                                    </span>
                                    {opt.badgeLabel && (
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          opt.badgeColor || 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {opt.badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                  {opt.subtitle && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                      {opt.subtitle}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Popover Footer Info */}
                    <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Tekan ↑↓ untuk navigasi, Enter untuk memilih</span>
                      <button
                        type="button"
                        onClick={() => setIsComboboxOpen(false)}
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {fieldErrors.tujuanBertemu && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.tujuanBertemu}</p>
              )}
            </div>

            {/* Nomor Identitas */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>No. KTP / SIM / Kartu Identitas</span>
              </label>
              <input
                type="text"
                value={nomorIdentitas}
                onChange={(e) => setNomorIdentitas(e.target.value)}
                placeholder="Contoh: 3174051203800002"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 5: Keperluan Kunjungan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Maksud & Keperluan Kunjungan *
            </label>
            <textarea
              required
              rows={2}
              value={keperluan}
              onChange={(e) => {
                setKeperluan(e.target.value);
                if (fieldErrors.keperluan) setFieldErrors((prev) => ({ ...prev, keperluan: '' }));
              }}
              placeholder="Jelaskan secara singkat keperluan kunjungan tamu..."
              className={`w-full p-2.5 rounded-xl border ${
                fieldErrors.keperluan
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed`}
            />
            {fieldErrors.keperluan && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.keperluan}</p>
            )}
          </div>

          {/* Row 6: Catatan Petugas */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Catatan Tambahan Petugas Piket (Opsional)
            </label>
            <input
              type="text"
              value={catatanPetugas}
              onChange={(e) => setCatatanPetugas(e.target.value)}
              placeholder="Contoh: Tamu telah diarahkan ke Ruang Pertemuan Kepala Sekolah..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Foto Bukti Tamu / KTP */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>Foto Wajah / Dokumen Identitas Tamu (Opsional)</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs min-h-[36px]"
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                onClick={() => setIsCameraOpen(true)}
              >
                {fotoUrl ? 'Ambil Ulang Foto' : '+ Ambil Foto Tamu'}
              </Button>
            </div>

            {fotoUrl && (
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <AuthenticatedImage src={fotoUrl} alt="Foto Tamu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotoUrl(undefined)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white cursor-pointer shadow-sm hover:bg-rose-700"
                  title="Hapus Foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          
        </DialogForm>
      </Modal>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(img) => setFotoUrl(img)}
        title="Dokumentasi Tamu Sekolah"
        subtitle="Foto otomatis diberi watermark panel bawah resmi (identitas tamu, instansi, waktu WIB, dan GPS jika ada)"
        watermarkProcessor={async (canvas, capturedAt, isUpload) => {
          const coords = await detectLocationForWatermark();
          const briefIdentity = `Tamu: ${namaTamu || 'Tamu Umum'}${instansiAsal ? ` • Instansi: ${instansiAsal}` : ''}${tujuanBertemu ? ` • Bertemu: ${tujuanBertemu}` : ''}`;

          return stampDocumentationPhoto(
            canvas,
            {
              module: 'VISITOR',
              schoolName: schoolSettings.schoolName,
              schoolLogoUrl: schoolSettings.logoUrl,
              officerName: currentUser?.fullName || 'Petugas Piket',
              officerId: currentUser?.id,
              documentationTime: capturedAt,
              eventDate: tanggal,
              eventTime: jamMasuk,
              isUploadedPhoto: isUpload,
              briefIdentity,
              coords,
              notes: keperluan ? keperluan.slice(0, 75) : undefined,
            },
            schoolSettings.documentationWatermark
          );
        }}
      />
    </>
  );
};
