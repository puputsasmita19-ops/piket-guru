import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { DutyBookStatus, ScheduleItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS, checkUserPermission } from '../../config/permissions';
import { formatIndonesianDate, getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import {
  Save,
  Send,
  CheckCheck,
  Lock,
  Unlock,
  AlertCircle,
  Sparkles,
  Shield,
  RotateCcw,
  CheckCircle2,
  FileText,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';

interface DutyBookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DutyBookRecord, originalUpdatedAt?: string) => Promise<void>;
  onSubmitJournal?: (record: DutyBookRecord, originalUpdatedAt?: string) => Promise<void>;
  onStatusChange: (record: DutyBookRecord, newStatus: DutyBookStatus, note?: string) => Promise<void>;
  onApproveAndComplete?: (record: DutyBookRecord) => Promise<void>;
  onRequestRevision?: (record: DutyBookRecord, reason: string) => Promise<void>;
  onUnlock?: (record: DutyBookRecord, reason: string) => Promise<void>;
  dutyBook: DutyBookRecord | null;
  schedules: ScheduleItem[];
}

export const DutyBookFormModal: React.FC<DutyBookFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSubmitJournal,
  onStatusChange,
  onApproveAndComplete,
  onRequestRevision,
  onUnlock,
  dutyBook,
  schedules,
}) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const isKepsek = hasRole('KEPALA_SEKOLAH');

  // Authority checks: distinguish viewing from writing
  const hasWritePermission =
    isAdmin ||
    checkUserPermission(currentUser?.permissions, PERMISSIONS.DUTYBOOK_CREATE) ||
    checkUserPermission(currentUser?.permissions, PERMISSIONS.DUTYBOOK_UPDATE) ||
    currentUser?.permissions?.includes('input_duty_book') ||
    currentUser?.permissions?.includes('*');

  const canApproveOrComplete =
    isAdmin ||
    isKepsek ||
    checkUserPermission(currentUser?.permissions, PERMISSIONS.DUTYBOOK_UNLOCK) ||
    checkUserPermission(currentUser?.permissions, PERMISSIONS.DUTYBOOK_VERIFY);

  const [tanggal, setTanggal] = useState<string>(getTodayISODate());
  const [hari, setHari] = useState<string>(getCurrentDayName());
  const [jamMulai, setJamMulai] = useState<string>('06:30');
  const [jamSelesai, setJamSelesai] = useState<string>('15:30');
  const [scheduleId, setScheduleId] = useState<string>('');
  const [petugasName, setPetugasName] = useState<string>('');
  const [ruangName, setRuangName] = useState<string>('');

  // 5 Mandatory Conditions + 1 Conclusion
  const [kondisiKeamanan, setKondisiKeamanan] = useState<string>('');
  const [kondisiKebersihan, setKondisiKebersihan] = useState<string>('');
  const [kondisiKelas, setKondisiKelas] = useState<string>('');
  const [kondisiFasilitas, setKondisiFasilitas] = useState<string>('');
  const [kondisiSiswa, setKondisiSiswa] = useState<string>('');
  const [catatanPiket, setCatatanPiket] = useState<string>('');

  // 2 Optional Sections
  const [kegiatanKhusus, setKegiatanKhusus] = useState<string>('');
  const [tindakLanjut, setTindakLanjut] = useState<string>('');

  const [status, setStatus] = useState<DutyBookStatus>('DRAFT');
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | undefined>(undefined);

  // In-flight state & inline feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<{ updatedAt: string; data: any } | null>(null);

  // Revision & Unlock dialogs
  const [showRevisionPrompt, setShowRevisionPrompt] = useState<boolean>(false);
  const [revisionReason, setRevisionReason] = useState<string>('');
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');

  const isOwner = !dutyBook || dutyBook.petugasId === currentUser?.id || isAdmin;
  const displayStatus = getDutyBookDisplayStatus(status);
  const isSelesai = displayStatus.stage === 'SELESAI';
  const isTerkirim = displayStatus.stage === 'TERKIRIM';
  const isReadOnly =
    !hasWritePermission ||
    (!isOwner && !isAdmin && !canApproveOrComplete) ||
    isSelesai ||
    (isTerkirim && !canApproveOrComplete);

  const draftKey = dutyBook?.id || `new-${tanggal}`;

  useEffect(() => {
    setErrorMessage(null);
    setDebugInfo(null);
    setSuccessMessage(null);
    setShowRevisionPrompt(false);
    setShowUnlockPrompt(false);
    setRevisionReason('');
    setUnlockReason('');
    setAvailableDraft(null);

    if (dutyBook) {
      setTanggal(dutyBook.tanggal);
      setHari(dutyBook.hari);
      setJamMulai(dutyBook.jamMulai || '06:30');
      setJamSelesai(dutyBook.jamSelesai || '15:30');
      setScheduleId(dutyBook.scheduleId || '');
      setPetugasName(dutyBook.petugasName || '');
      setRuangName(dutyBook.ruangName || '');
      setKondisiKeamanan(dutyBook.kondisiKeamanan || '');
      setKondisiKebersihan(dutyBook.kondisiKebersihan || '');
      setKondisiKelas(dutyBook.kondisiKelas || '');
      setKondisiFasilitas(dutyBook.kondisiFasilitas || '');
      setKondisiSiswa(dutyBook.kondisiSiswa || '');
      setCatatanPiket(dutyBook.catatanPiket || '');
      setKegiatanKhusus(dutyBook.kegiatanKhusus || '');
      setTindakLanjut(dutyBook.tindakLanjut || '');
      setStatus(dutyBook.status);
      setOriginalUpdatedAt(dutyBook.updatedAt);
    } else {
      const todayISO = getTodayISODate();
      setTanggal(todayISO);
      setHari(getCurrentDayName());
      setJamMulai('06:30');
      setJamSelesai('15:30');
      setScheduleId(schedules[0]?.id || 'sch-general');
      setPetugasName(currentUser?.fullName || '');
      setRuangName(schedules[0]?.ruangName || 'Gerbang & Pos Utama');
      setKondisiKeamanan('');
      setKondisiKebersihan('');
      setKondisiKelas('');
      setKondisiFasilitas('');
      setKondisiSiswa('');
      setCatatanPiket('');
      setKegiatanKhusus('');
      setTindakLanjut('');
      setStatus('DRAFT');
      setOriginalUpdatedAt(undefined);
    }

    // Check if there is an existing uncommitted draft for this user & record
    if (isOpen && currentUser?.id && (!dutyBook || dutyBook.status === 'DRAFT')) {
      const checkKey = dutyBook?.id || `new-${dutyBook?.tanggal || getTodayISODate()}`;
      DraftService.getDraft(currentUser.id, 'DUTY_BOOK', checkKey).then((saved) => {
        if (saved && saved.data) {
          setAvailableDraft({ updatedAt: saved.updatedAt, data: saved.data });
        }
      });
    }
  }, [dutyBook, schedules, currentUser, isOpen]);

  // Debounced auto-save draft while typing
  useEffect(() => {
    if (!isOpen || isReadOnly || !currentUser?.id) return;
    if (!kondisiKeamanan && !kondisiKebersihan && !kondisiKelas && !kondisiFasilitas && !kondisiSiswa && !catatanPiket) {
      return;
    }
    const targetKey = dutyBook?.id || `new-${tanggal}`;
    DraftService.saveDraftDebounced(currentUser.id, 'DUTY_BOOK', targetKey, {
      tanggal,
      hari,
      jamMulai,
      jamSelesai,
      scheduleId,
      petugasName,
      ruangName,
      kondisiKeamanan,
      kondisiKebersihan,
      kondisiKelas,
      kondisiFasilitas,
      kondisiSiswa,
      catatanPiket,
      kegiatanKhusus,
      tindakLanjut,
    });
  }, [
    isOpen,
    isReadOnly,
    currentUser?.id,
    tanggal,
    hari,
    jamMulai,
    jamSelesai,
    scheduleId,
    petugasName,
    ruangName,
    kondisiKeamanan,
    kondisiKebersihan,
    kondisiKelas,
    kondisiFasilitas,
    kondisiSiswa,
    catatanPiket,
    kegiatanKhusus,
    tindakLanjut,
    dutyBook?.id,
  ]);

  const handleRestoreDraft = () => {
    if (!availableDraft?.data) return;
    const d = availableDraft.data;
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.hari) setHari(d.hari);
    if (d.jamMulai) setJamMulai(d.jamMulai);
    if (d.jamSelesai) setJamSelesai(d.jamSelesai);
    if (d.scheduleId) setScheduleId(d.scheduleId);
    if (d.petugasName) setPetugasName(d.petugasName);
    if (d.ruangName) setRuangName(d.ruangName);
    if (d.kondisiKeamanan !== undefined) setKondisiKeamanan(d.kondisiKeamanan);
    if (d.kondisiKebersihan !== undefined) setKondisiKebersihan(d.kondisiKebersihan);
    if (d.kondisiKelas !== undefined) setKondisiKelas(d.kondisiKelas);
    if (d.kondisiFasilitas !== undefined) setKondisiFasilitas(d.kondisiFasilitas);
    if (d.kondisiSiswa !== undefined) setKondisiSiswa(d.kondisiSiswa);
    if (d.catatanPiket !== undefined) setCatatanPiket(d.catatanPiket);
    if (d.kegiatanKhusus !== undefined) setKegiatanKhusus(d.kegiatanKhusus);
    if (d.tindakLanjut !== undefined) setTindakLanjut(d.tindakLanjut);
    setAvailableDraft(null);
    setSuccessMessage('Draf berhasil dipulihkan!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDiscardDraft = async () => {
    if (!currentUser?.id) return;
    const targetKey = dutyBook?.id || `new-${tanggal}`;
    await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', targetKey);
    setAvailableDraft(null);
  };

  // Explicit user action to load standard format if requested
  const handleApplyStandardTemplates = () => {
    setKondisiKeamanan('Situasi keamanan gerbang dan lingkungan sekolah terpantau kondusif, aman, dan terkendali. Seluruh tamu melapor di pos piket.');
    setKondisiKebersihan('Seluruh koridor, ruang kelas, toilet, dan halaman bersih. Pengelolaan sampah berjalan tertib.');
    setKondisiKelas('KBM jam ke-1 s.d ke-8 berjalan tertib. Seluruh guru hadir tepat waktu sesuai jadwal pelajaran.');
    setKondisiFasilitas('Sarana dan prasarana sekolah (kelistrikan, air, bel sekolah) berfungsi normal tanpa kendala.');
    setKondisiSiswa('Kedisiplinan siswa terpantau baik, tidak ada perkelahian atau pelanggaran tata tertib berat.');
    setCatatanPiket('Kegiatan operasional sekolah hari ini berlangsung lancar.');
    setTindakLanjut('Lanjutkan pengawasan ketertiban seragam dan atribut upacara untuk hari esok.');
  };

  const constructPayload = (targetStatus: DutyBookStatus): DutyBookRecord => {
    const fallbackId = `book-${tanggal}-${dutyBook?.petugasId || currentUser?.id || 'usr-piket'}`;
    const id = dutyBook ? dutyBook.id : fallbackId;
    const payload: Record<string, any> = {
      id,
      scheduleId: scheduleId || 'sch-general',
      tanggal,
      hari,
      jamMulai,
      jamSelesai,
      petugasId: dutyBook?.petugasId || currentUser?.id || 'usr-piket',
      petugasName: petugasName.trim() || currentUser?.fullName || 'Petugas Piket',
      petugasRole: 'GURU',
      ruangName: ruangName.trim() || 'Pos Utama',
      kondisiKeamanan: kondisiKeamanan.trim(),
      kondisiKebersihan: kondisiKebersihan.trim(),
      kondisiKelas: kondisiKelas.trim(),
      kondisiFasilitas: kondisiFasilitas.trim(),
      kondisiSiswa: kondisiSiswa.trim(),
      catatanPiket: catatanPiket.trim(),
      status: targetStatus,
      createdAt: dutyBook?.createdAt || new Date().toISOString(),
      createdBy: dutyBook?.createdBy || currentUser?.fullName || 'Petugas',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'Petugas',
    };
    if (kegiatanKhusus.trim()) {
      payload.kegiatanKhusus = kegiatanKhusus.trim();
    }
    if (tindakLanjut.trim()) {
      payload.tindakLanjut = tindakLanjut.trim();
    }
    return payload as DutyBookRecord;
  };

  // 1. Simpan Draft: guru dapat menyimpan jurnal yang belum lengkap
  const handleSaveDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!hasWritePermission) {
      setErrorMessage('Akses ditolak: Anda tidak memiliki izin untuk menyimpan buku piket.');
      return;
    }

    setErrorMessage(null);
    setDebugInfo(null);
    setIsSubmitting(true);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const payload = constructPayload('DRAFT');

    if (isOffline && currentUser) {
      try {
        await SyncQueueService.enqueue(
          currentUser,
          'DUTYBOOK_SUBMIT',
          'dutyBooks',
          payload.id,
          { record: payload, isSubmitOnly: false }
        );
        await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
        setSuccessMessage('Offline — Draf jurnal tersimpan di perangkat dan masuk ke antrean kirim!');
        setTimeout(() => onClose(), 1200);
      } catch (err: any) {
        setErrorMessage(`Gagal menyimpan antrean offline: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      await onSave(payload, originalUpdatedAt);
      if (currentUser) {
        await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
      }
      setSuccessMessage('Draft jurnal berhasil disimpan!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      const isNetwork =
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('network') ||
        err?.code === 'unavailable' ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetwork && currentUser) {
        try {
          await SyncQueueService.enqueue(
            currentUser,
            'DUTYBOOK_SUBMIT',
            'dutyBooks',
            payload.id,
            { record: payload, isSubmitOnly: false }
          );
          await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
          setSuccessMessage('Koneksi terputus. Data diamankan ke antrean sinkronisasi offline!');
          setTimeout(() => onClose(), 1400);
          return;
        } catch {}
      }

      console.warn('[DutyBookForm] Save draft failed:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      const isPermissionDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions') ||
        err.message?.toLowerCase().includes('izin');

      const isSessionExpired =
        err.code === 'auth/user-token-expired' ||
        err.message?.includes('SESSION_REVOKED') ||
        err.message?.includes('auth/id-token-expired');

      if (isSessionExpired) {
        setErrorMessage('Sesi telah kedaluwarsa. Silakan masuk kembali.');
      } else if (isPermissionDenied) {
        setErrorMessage('Tidak memiliki izin menyimpan jurnal.');
      } else {
        setErrorMessage(err.message || 'Gagal menyimpan draft buku piket.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Kirim Jurnal: guru menekan "Kirim Jurnal" satu kali tanpa wajib simpan Draft dulu
  const handleSubmitJournal = async () => {
    if (isSubmitting) return;

    if (!hasWritePermission) {
      setErrorMessage('Tidak memiliki izin menyimpan jurnal.');
      return;
    }

    // Validate mandatory sections
    const missing: string[] = [];
    if (!petugasName.trim()) missing.push('Nama Petugas');
    if (!ruangName.trim()) missing.push('Pos / Ruang');
    if (!kondisiKeamanan.trim()) missing.push('Keamanan & Ketertiban');
    if (!kondisiKebersihan.trim()) missing.push('Kebersihan Lingkungan');
    if (!kondisiKelas.trim()) missing.push('KBM & Kehadiran Kelas');
    if (!kondisiFasilitas.trim()) missing.push('Sarana & Prasarana');
    if (!kondisiSiswa.trim()) missing.push('Kedisiplinan Siswa');
    if (!catatanPiket.trim()) missing.push('Catatan Kesimpulan Piket');

    if (missing.length > 0) {
      setErrorMessage(
        `Bagian wajib belum lengkap: ${missing.join(', ')}. Harap lengkapi sebelum mengirim jurnal.`
      );
      return;
    }

    setErrorMessage(null);
    setDebugInfo(null);
    setIsSubmitting(true);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const payload = constructPayload('DIAJUKAN');

    if (isOffline && currentUser) {
      try {
        await SyncQueueService.enqueue(
          currentUser,
          'DUTYBOOK_SUBMIT',
          'dutyBooks',
          payload.id,
          { record: payload, isSubmitOnly: true }
        );
        await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
        setSuccessMessage('Offline — Jurnal resmi tersimpan di antrean perangkat & akan dikirim otomatis!');
        setTimeout(() => onClose(), 1200);
      } catch (err: any) {
        setErrorMessage(`Gagal menyimpan antrean offline: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      if (onSubmitJournal) {
        await onSubmitJournal(payload, originalUpdatedAt);
      } else {
        await onStatusChange(payload, 'DIAJUKAN');
      }
      if (currentUser) {
        await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
      }
      setSuccessMessage('Jurnal resmi berhasil dikirim! Menunggu pengesahan.');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      const isNetwork =
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('network') ||
        err?.code === 'unavailable' ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetwork && currentUser) {
        try {
          await SyncQueueService.enqueue(
            currentUser,
            'DUTYBOOK_SUBMIT',
            'dutyBooks',
            payload.id,
            { record: payload, isSubmitOnly: true }
          );
          await DraftService.deleteDraft(currentUser.id, 'DUTY_BOOK', draftKey);
          setSuccessMessage('Koneksi terputus. Jurnal diamankan di antrean sinkronisasi offline!');
          setTimeout(() => onClose(), 1400);
          return;
        } catch {}
      }

      console.warn('[DutyBookForm] Submit journal failed:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      const isPermissionDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions') ||
        err.message?.toLowerCase().includes('izin');

      const isSessionExpired =
        err.code === 'auth/user-token-expired' ||
        err.message?.includes('SESSION_REVOKED') ||
        err.message?.includes('auth/id-token-expired');

      if (isSessionExpired) {
        setErrorMessage('Sesi telah kedaluwarsa. Silakan masuk kembali.');
      } else if (isPermissionDenied) {
        setErrorMessage('Tidak memiliki izin menyimpan jurnal.');
      } else {
        setErrorMessage(err.message || 'Gagal mengirim buku piket.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Sahkan & Selesaikan: satu langkah penyelesaian & penguncian otomatis
  const handleApproveAndComplete = async () => {
    if (!dutyBook || isSubmitting) return;
    setErrorMessage(null);
    setDebugInfo(null);
    setIsSubmitting(true);
    try {
      if (onApproveAndComplete) {
        await onApproveAndComplete(dutyBook);
      } else {
        await onStatusChange(dutyBook, 'DIKUNCI');
      }
      setSuccessMessage('Buku piket berhasil disahkan dan selesai (otomatis terkunci)!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.warn('[DutyBookForm] Approve duty book failed:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      const isPermissionDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions') ||
        err.message?.toLowerCase().includes('izin');

      if (isPermissionDenied) {
        setErrorMessage('Tidak memiliki izin untuk mengesahkan buku piket. Fitur ini memerlukan wewenang Kepala Sekolah atau Administrator.');
      } else {
        setErrorMessage(err.message || 'Gagal mengesahkan buku piket.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kembalikan ke Draft dengan alasan wajib
  const handleExecuteRevision = async () => {
    if (!dutyBook || isSubmitting) return;
    if (!revisionReason.trim()) {
      setErrorMessage('Alasan pengembalian jurnal ke draft wajib diisi.');
      return;
    }
    setErrorMessage(null);
    setDebugInfo(null);
    setIsSubmitting(true);
    try {
      if (onRequestRevision) {
        await onRequestRevision(dutyBook, revisionReason.trim());
      } else {
        await onStatusChange(dutyBook, 'DRAFT', revisionReason.trim());
      }
      setShowRevisionPrompt(false);
      setSuccessMessage('Jurnal berhasil dikembalikan ke status Draft untuk revisi.');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.warn('[DutyBookForm] Request revision failed:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      const isPermissionDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions') ||
        err.message?.toLowerCase().includes('izin');

      if (isPermissionDenied) {
        setErrorMessage('Tidak memiliki izin untuk meminta revisi buku piket.');
      } else {
        setErrorMessage(err.message || 'Gagal mengembalikan jurnal ke draft.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin buka kunci jurnal Selesai untuk koreksi dengan alasan wajib
  const handleExecuteUnlock = async () => {
    if (!dutyBook || !onUnlock || isSubmitting) return;
    if (!unlockReason.trim()) {
      setErrorMessage('Alasan pembukaan kunci untuk koreksi wajib diisi.');
      return;
    }
    setErrorMessage(null);
    setDebugInfo(null);
    setIsSubmitting(true);
    try {
      await onUnlock(dutyBook, unlockReason.trim());
      setShowUnlockPrompt(false);
      setSuccessMessage('Kunci arsip dibuka untuk koreksi (status kembali ke Draft).');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.warn('[DutyBookForm] Unlock duty book failed:', {
        name: err.name,
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      const isPermissionDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions') ||
        err.message?.toLowerCase().includes('izin');

      if (isPermissionDenied) {
        setErrorMessage('Akses ditolak: Hanya Administrator yang berwenang membuka kunci buku piket berstatus Selesai.');
      } else {
        setErrorMessage(err.message || 'Gagal membuka kunci buku piket.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Buku Piket Digital — ${formatIndonesianDate(tanggal)}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSaveDraft} className="space-y-6">
        {/* Uncommitted Local Draft Banner */}
        {availableDraft && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold">Ditemukan draf jurnal tersimpan di perangkat ini</p>
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

        {/* Status Pipeline Banner (Simplified 3 Stages) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Badge
              variant={displayStatus.variant}
              size="md"
              icon={isSelesai ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            >
              Tahap: {displayStatus.label}
            </Badge>
            <span className="text-xs text-slate-500 font-medium">
              Petugas: <strong>{petugasName || currentUser?.fullName || 'Petugas'}</strong>
            </span>
          </div>

          {!isSelesai && !isTerkirim && hasWritePermission && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              onClick={handleApplyStandardTemplates}
            >
              Isi Format Standar Otomatis
            </Button>
          )}
        </div>

        {/* View-Only Warning */}
        {!hasWritePermission && (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Mode Hanya Baca: Akun Anda memiliki izin melihat dan tidak dapat mengubah atau mengirim jurnal.</span>
          </div>
        )}

        {/* Ownership Notice */}
        {!isOwner && !isAdmin && hasWritePermission && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Mode Pratinjau: Jurnal ini ditugaskan kepada <strong>{petugasName}</strong>.</span>
          </div>
        )}

        {/* Terkirim notice for Teacher */}
        {isTerkirim && !canApproveOrComplete && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Jurnal telah terkirim dan sedang menunggu pengesahan oleh Admin atau Kepala Sekolah.</span>
          </div>
        )}

        {/* Selesai / Locked Notice */}
        {isSelesai && (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Dokumen buku piket ini telah <strong>Disahkan & Selesai</strong> (Arsip resmi terkunci).</span>
            </div>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                leftIcon={<Unlock className="w-3.5 h-3.5" />}
                onClick={() => setShowUnlockPrompt(true)}
              >
                Buka Kunci untuk Koreksi
              </Button>
            )}
          </div>
        )}

        {/* Prompt: Kembalikan ke Draft untuk Revisi */}
        {showRevisionPrompt && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 space-y-3">
            <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              Kembalikan Jurnal ke Draft untuk Revisi
            </h5>
            <textarea
              required
              rows={2}
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Masukkan alasan pengembalian/catatan revisi yang wajib diperbaiki guru (Wajib)..."
              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRevisionPrompt(false)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!revisionReason.trim() || isSubmitting}
                isLoading={isSubmitting}
                onClick={handleExecuteRevision}
              >
                Konfirmasi Kembalikan ke Draft
              </Button>
            </div>
          </div>
        )}

        {/* Prompt: Buka Kunci Arsip (Admin Only) */}
        {showUnlockPrompt && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 space-y-3">
            <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-rose-600" />
              Buka Kunci Dokumen Selesai untuk Koreksi (Admin)
            </h5>
            <input
              type="text"
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Masukkan alasan pembukaan kunci (Wajib untuk audit trail)..."
              className="w-full p-2.5 rounded-xl border border-rose-300 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowUnlockPrompt(false)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={!unlockReason.trim() || isSubmitting}
                isLoading={isSubmitting}
                onClick={handleExecuteUnlock}
              >
                Buka Kunci Sekarang
              </Button>
            </div>
          </div>
        )}

        {/* Identity & Shift Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">Petugas Piket</label>
            <input
              type="text"
              disabled={!isAdmin && isReadOnly}
              value={petugasName}
              onChange={(e) => setPetugasName(e.target.value)}
              placeholder="Nama lengkap petugas piket..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-75 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">Pos / Ruangan Piket</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={ruangName}
              onChange={(e) => setRuangName(e.target.value)}
              placeholder="Contoh: Gerbang & Pos Utama..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-75 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* 5 KONDISI WAJIB */}
        <div className="space-y-4 pt-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
            Kondisi Sekolah & Lingkungan (Wajib Saat Pengiriman)
          </div>

          {/* 1. Keamanan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>1. Kondisi Keamanan & Ketertiban Sekolah</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={kondisiKeamanan}
              onChange={(e) => setKondisiKeamanan(e.target.value)}
              placeholder="Catatan pos satpam, buku tamu, ketertiban gerbang, keamanan umum..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 2. Kebersihan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>2. Kondisi Kebersihan Lingkungan & Kantin</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={kondisiKebersihan}
              onChange={(e) => setKondisiKebersihan(e.target.value)}
              placeholder="Halaman, koridor, toilet, area kantin, pengelolaan tempat sampah..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 3. Kelas & KBM */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>3. Kondisi KBM & Kehadiran Guru Pengajar</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={kondisiKelas}
              onChange={(e) => setKondisiKelas(e.target.value)}
              placeholder="Kelancaran jam pembelajaran, guru berhalangan, kelas kosong/inval..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 4. Fasilitas & Sarpras */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>4. Kondisi Sarana, Prasarana & Fasilitas</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={kondisiFasilitas}
              onChange={(e) => setKondisiFasilitas(e.target.value)}
              placeholder="Kelistrikan, bel, proyektor, kran air, kunci ruang, perlengkapan..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 5. Siswa */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>5. Kedisiplinan & Perilaku Siswa</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={kondisiSiswa}
              onChange={(e) => setKondisiSiswa(e.target.value)}
              placeholder="Siswa terlambat, izin keluar sekolah, ketertiban seragam..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* Catatan Kesimpulan Piket */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>Catatan Kesimpulan Piket</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={catatanPiket}
              onChange={(e) => setCatatanPiket(e.target.value)}
              placeholder="Kesimpulan keseluruhan situasi piket pada hari ini..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* BAGIAN TAMBAHAN (OPSIONAL) */}
        <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Bagian Tambahan (Opsional)
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kegiatan Khusus Sekolah (Bila ada)
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={kegiatanKhusus}
              onChange={(e) => setKegiatanKhusus(e.target.value)}
              placeholder="Contoh: Upacara Bendera, Rapat Dinas, Sosialisasi, Kunjungan Tamu..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Rekomendasi Tindak Lanjut Esok Hari (Bila ada)
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              placeholder="Contoh: Koordinasi pengawasan gerbang belakang saat jam istirahat..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* INLINE STATUS FEEDBACK (NEAR BUTTONS) */}
        {errorMessage && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            {debugInfo && (
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-mono pl-6">
                Rincian Diagnostik: {debugInfo}
              </p>
            )}
          </div>
        )}

        {successMessage && (
          <div role="status" className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* WORKFLOW ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Tutup
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Guru / Petugas Action: Simpan Draft */}
            {!isSelesai && !isTerkirim && isOwner && hasWritePermission && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<Save className="w-3.5 h-3.5" />}
                onClick={() => handleSaveDraft()}
              >
                Simpan Draft
              </Button>
            )}

            {/* Guru / Petugas Action: Kirim Jurnal (Satu Klik Langsung) */}
            {!isSelesai && !isTerkirim && isOwner && hasWritePermission && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                onClick={handleSubmitJournal}
              >
                Kirim Jurnal
              </Button>
            )}

            {/* Admin/Kepsek on Terkirim: Kembalikan ke Draft */}
            {isTerkirim && canApproveOrComplete && !showRevisionPrompt && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                isLoading={isSubmitting}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => setShowRevisionPrompt(true)}
              >
                Kembalikan ke Draft
              </Button>
            )}

            {/* Admin/Kepsek on Terkirim: Sahkan & Selesaikan (Satu Klik) */}
            {isTerkirim && canApproveOrComplete && (
              <Button
                type="button"
                variant="success"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                onClick={handleApproveAndComplete}
              >
                Sahkan & Selesaikan
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
