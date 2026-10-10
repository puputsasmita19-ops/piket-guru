import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
  IncidentPhoto,
  getIncidentCategoryDisplay,
} from '../../types/incident.types';
import { IncidentCategoryRecord } from '../../types/master.types';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../config/permissions';
import { formatTime } from '../../utils/dateUtils';
import {
  AlertTriangle,
  Camera,
  Trash2,
  User,
  MapPin,
  Clock,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { DraftService } from '../../services/offline/draftService';
import { SyncQueueService } from '../../services/offline/syncQueueService';

interface IncidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: IncidentRecord) => Promise<any>;
  editingIncident: IncidentRecord | null;
  categories: IncidentCategoryRecord[];
}

export const IncidentFormModal: React.FC<IncidentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingIncident,
  categories,
}) => {
  const { currentUser, hasPermission } = useAuth();

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [waktu, setWaktu] = useState<string>(formatTime(new Date()));
  const [kategori, setKategori] = useState<string>('SISWA');
  const [kategoriLainnya, setKategoriLainnya] = useState<string>('');
  const [tingkatKeparahan, setTingkatKeparahan] = useState<IncidentSeverity>('SEDANG');
  const [lokasi, setLokasi] = useState<string>('');
  const [pihakTerlibat, setPihakTerlibat] = useState<string>('');
  const [uraian, setUraian] = useState<string>('');
  const [tindakanAwal, setTindakanAwal] = useState<string>('');
  const [tindakLanjut, setTindakLanjut] = useState<string>('');
  const [status, setStatus] = useState<IncidentStatus>('BARU');
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [availableDraft, setAvailableDraft] = useState<{ updatedAt: string; data: any; attachments?: { [key: string]: Blob } } | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const draftKey = editingIncident?.id || 'new-incident';

  // Ensure 'LAINNYA' is always present as a stable option without duplicate entries
  const effectiveCategories = useMemo(() => {
    const list = [...categories];
    const hasLainnya = list.some(
      (c) => c.code === 'LAINNYA' || c.name.toLowerCase().includes('lain-lain')
    );
    if (!hasLainnya) {
      list.push({
        id: 'cat-99',
        code: 'LAINNYA',
        name: 'Lain-lain',
        description: 'Kejadian atau insiden khusus lainnya yang belum tercakup dalam pilihan standar.',
        severity: 'SEDANG',
        isActive: true,
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: new Date().toISOString(),
        createdBy: 'SYSTEM',
        updatedAt: new Date().toISOString(),
        updatedBy: 'SYSTEM',
      });
    }
    return list;
  }, [categories]);

  const hasWritePermission =
    hasPermission(PERMISSIONS.INCIDENT_CREATE) ||
    hasPermission(PERMISSIONS.INCIDENT_UPDATE) ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'KEPALA_SEKOLAH' ||
    currentUser?.role === 'GURU' ||
    currentUser?.role === 'TENAGA_KEPENDIDIKAN' ||
    currentUser?.role === 'SATPAM';

  useEffect(() => {
    if (editingIncident) {
      setTanggal(editingIncident.tanggal);
      setWaktu(editingIncident.waktu);
      setKategori(editingIncident.kategori);
      setKategoriLainnya(editingIncident.kategoriLainnya || '');
      setTingkatKeparahan(editingIncident.tingkatKeparahan);
      setLokasi(editingIncident.lokasi);
      setPihakTerlibat(editingIncident.pihakTerlibat);
      setUraian(editingIncident.uraian);
      setTindakanAwal(editingIncident.tindakanAwal);
      setTindakLanjut(editingIncident.tindakLanjut || '');
      setStatus(editingIncident.status);
      setPhotos(editingIncident.photos || []);
    } else {
      setTanggal(new Date().toISOString().split('T')[0]);
      setWaktu(formatTime(new Date()));
      setKategori(effectiveCategories[0]?.code || 'SISWA');
      setKategoriLainnya('');
      setTingkatKeparahan('SEDANG');
      setLokasi('');
      setPihakTerlibat('');
      setUraian('');
      setTindakanAwal('');
      setTindakLanjut('');
      setStatus('BARU');
      setPhotos([]);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setDebugInfo(null);
    setFieldErrors({});
    setIsSubmitting(false);
    setAvailableDraft(null);

    // Check for saved uncommitted draft
    if (isOpen && currentUser?.id && !editingIncident) {
      DraftService.getDraft(currentUser.id, 'INCIDENT', draftKey).then((saved) => {
        if (saved && saved.data) {
          setAvailableDraft({ updatedAt: saved.updatedAt, data: saved.data, attachments: saved.attachments });
        }
      });
    }
  }, [editingIncident, effectiveCategories, isOpen, currentUser?.id]);

  // Debounced auto-save draft while typing
  useEffect(() => {
    if (!isOpen || !hasWritePermission || !currentUser?.id || editingIncident) return;
    if (!lokasi.trim() && !pihakTerlibat.trim() && !uraian.trim() && !tindakanAwal.trim() && photos.length === 0) {
      return;
    }

    const saveAsync = async () => {
      // Convert photos to Blobs for IndexedDB attachment storage
      const attachments: { [key: string]: Blob } = {};
      const lightPhotos = await Promise.all(
        photos.map(async (p, idx) => {
          if (p.url.startsWith('data:')) {
            try {
              const blob = await DraftService.dataUrlToBlob(p.url);
              attachments[`photo_${idx}`] = blob;
              return { ...p, url: `attachment:photo_${idx}` };
            } catch {
              return p;
            }
          }
          return p;
        })
      );

      DraftService.saveDraftDebounced(currentUser.id, 'INCIDENT', draftKey, {
        tanggal,
        waktu,
        kategori,
        kategoriLainnya,
        tingkatKeparahan,
        lokasi,
        pihakTerlibat,
        uraian,
        tindakanAwal,
        tindakLanjut,
        status,
        photos: lightPhotos,
      }, attachments);
    };

    saveAsync().catch(() => {});
  }, [
    isOpen,
    hasWritePermission,
    currentUser?.id,
    editingIncident,
    tanggal,
    waktu,
    kategori,
    kategoriLainnya,
    tingkatKeparahan,
    lokasi,
    pihakTerlibat,
    uraian,
    tindakanAwal,
    tindakLanjut,
    status,
    photos,
    draftKey,
  ]);

  const handleRestoreDraft = async () => {
    if (!availableDraft?.data) return;
    const d = availableDraft.data;
    if (d.tanggal) setTanggal(d.tanggal);
    if (d.waktu) setWaktu(d.waktu);
    if (d.kategori) setKategori(d.kategori);
    if (d.kategoriLainnya !== undefined) setKategoriLainnya(d.kategoriLainnya);
    if (d.tingkatKeparahan) setTingkatKeparahan(d.tingkatKeparahan);
    if (d.lokasi !== undefined) setLokasi(d.lokasi);
    if (d.pihakTerlibat !== undefined) setPihakTerlibat(d.pihakTerlibat);
    if (d.uraian !== undefined) setUraian(d.uraian);
    if (d.tindakanAwal !== undefined) setTindakanAwal(d.tindakanAwal);
    if (d.tindakLanjut !== undefined) setTindakLanjut(d.tindakLanjut);
    if (d.status) setStatus(d.status);

    // Restore photos from attachments
    if (Array.isArray(d.photos) && d.photos.length > 0) {
      const restoredPhotos: IncidentPhoto[] = [];
      for (const p of d.photos) {
        if (p.url.startsWith('attachment:') && availableDraft.attachments) {
          const attachKey = p.url.replace('attachment:', '');
          const blob = availableDraft.attachments[attachKey];
          if (blob) {
            try {
              const dataUrl = await DraftService.blobToDataUrl(blob);
              restoredPhotos.push({ ...p, url: dataUrl });
              continue;
            } catch {}
          }
        }
        restoredPhotos.push(p);
      }
      setPhotos(restoredPhotos);
    }

    setAvailableDraft(null);
    setSuccessMessage('Draf laporan berhasil dipulihkan!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDiscardDraft = async () => {
    if (!currentUser?.id) return;
    await DraftService.deleteDraft(currentUser.id, 'INCIDENT', draftKey);
    setAvailableDraft(null);
  };

  const handleAddPhoto = (imageDataUrl: string) => {
    const newPhoto: IncidentPhoto = {
      id: `photo-${Date.now()}`,
      url: imageDataUrl,
      uploadedAt: new Date().toISOString(),
    };
    setPhotos((prev) => [...prev, newPhoto]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!hasWritePermission) {
      setErrorMessage('Tidak memiliki izin menyimpan laporan kejadian.');
      return;
    }

    // Validate mandatory fields
    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!tanggal) {
      errors.tanggal = 'Tanggal kejadian wajib diisi';
      missing.push('Tanggal');
    }
    if (!waktu.trim()) {
      errors.waktu = 'Waktu kejadian wajib diisi';
      missing.push('Waktu');
    }
    if (!lokasi.trim()) {
      errors.lokasi = 'Lokasi kejadian di sekolah wajib diisi';
      missing.push('Lokasi Kejadian');
    }
    if (!pihakTerlibat.trim()) {
      errors.pihakTerlibat = 'Pihak/siswa yang terlibat wajib diisi';
      missing.push('Pihak Terlibat');
    }
    if (!uraian.trim()) {
      errors.uraian = 'Uraian kronologis kejadian wajib diisi';
      missing.push('Uraian Kejadian');
    }
    if (!tindakanAwal.trim()) {
      errors.tindakanAwal = 'Tindakan awal oleh petugas piket wajib diisi';
      missing.push('Tindakan Awal');
    }

    // Validation for 'LAINNYA' category
    if (kategori === 'LAINNYA') {
      const trimmedLainnya = kategoriLainnya.trim();
      if (!trimmedLainnya) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya wajib diisi saat memilih kategori Lain-lain';
        missing.push('Keterangan Kategori Lainnya');
      } else if (trimmedLainnya.length > 300) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya tidak boleh melebihi 300 karakter';
      }
    }

    if (missing.length > 0 || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage(
        missing.length > 0
          ? `Bagian wajib belum lengkap: ${missing.join(', ')}. Harap lengkapi sebelum mengirim laporan.`
          : 'Terdapat isian yang belum sesuai. Harap periksa kembali formulir.'
      );
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    setDebugInfo(null);
    setIsSubmitting(true);

    const selectedCat = effectiveCategories.find((c) => c.code === kategori);
    const isLainnya = kategori === 'LAINNYA';

    const payload: IncidentRecord = {
      id: editingIncident ? editingIncident.id : `inc-${tanggal}-${Date.now()}`,
      tanggal,
      waktu: waktu.trim(),
      kategori,
      kategoriName: isLainnya ? 'Lain-lain' : selectedCat ? selectedCat.name : kategori,
      ...(isLainnya && kategoriLainnya.trim() ? { kategoriLainnya: kategoriLainnya.trim() } : {}),
      tingkatKeparahan,
      lokasi: lokasi.trim(),
      pihakTerlibat: pihakTerlibat.trim(),
      uraian: uraian.trim(),
      tindakanAwal: tindakanAwal.trim(),
      ...(tindakLanjut.trim() ? { tindakLanjut: tindakLanjut.trim() } : {}),
      penanggungJawab: editingIncident?.penanggungJawab || currentUser?.fullName || 'Petugas Piket',
      pelaporId: editingIncident?.pelaporId || currentUser?.id,
      pelaporName: editingIncident?.pelaporName || currentUser?.fullName || 'Petugas Piket',
      status,
      ...(photos.length > 0 ? { photos } : {}),
      createdAt: editingIncident ? editingIncident.createdAt : new Date().toISOString(),
      createdBy: editingIncident ? editingIncident.createdBy : currentUser?.fullName || 'Petugas',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'Petugas',
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline && currentUser) {
      try {
        await SyncQueueService.enqueue(
          currentUser,
          'INCIDENT_REPORT',
          'incidents',
          payload.id,
          payload
        );
        await DraftService.deleteDraft(currentUser.id, 'INCIDENT', draftKey);
        setSuccessMessage('Offline — Laporan kejadian tersimpan di antrean perangkat & akan dikirim otomatis!');
        setTimeout(() => onClose(), 1200);
      } catch (err: any) {
        setErrorMessage(`Gagal menyimpan antrean offline: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      await onSave(payload);
      if (currentUser) {
        await DraftService.deleteDraft(currentUser.id, 'INCIDENT', draftKey);
      }
      setSuccessMessage(editingIncident ? 'Perubahan laporan berhasil disimpan!' : 'Laporan kejadian berhasil dikirim!');
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
            'INCIDENT_REPORT',
            'incidents',
            payload.id,
            payload
          );
          await DraftService.deleteDraft(currentUser.id, 'INCIDENT', draftKey);
          setSuccessMessage('Koneksi terputus. Laporan kejadian diamankan di antrean sinkronisasi offline!');
          setTimeout(() => onClose(), 1400);
          return;
        } catch {}
      }

      console.warn('[IncidentFormModal] Submit incident failed:', {
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
        setErrorMessage('Tidak memiliki izin menyimpan laporan kejadian.');
      } else {
        setErrorMessage(err.message || 'Gagal mengirim laporan kejadian.');
      }
      setDebugInfo(`[${err.name || 'Error'}${err.code ? `:${err.code}` : ''}] ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingIncident ? 'Ubah Laporan Kejadian' : 'Lapor Kejadian / Insiden Baru'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Uncommitted Local Draft Banner */}
          {availableDraft && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold">Ditemukan draf laporan kejadian tersimpan di perangkat ini</p>
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

          {/* Header Row: Waktu, Kategori, Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Waktu Kejadian *</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => {
                    setTanggal(e.target.value);
                    if (fieldErrors.tanggal) setFieldErrors((prev) => ({ ...prev, tanggal: '' }));
                  }}
                  className={`w-full p-2.5 rounded-xl border ${
                    fieldErrors.tanggal
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-white dark:bg-slate-900 text-xs font-mono`}
                />
                <input
                  type="text"
                  value={waktu}
                  onChange={(e) => {
                    setWaktu(e.target.value);
                    if (fieldErrors.waktu) setFieldErrors((prev) => ({ ...prev, waktu: '' }));
                  }}
                  placeholder="08:30"
                  className={`w-24 p-2.5 rounded-xl border ${
                    fieldErrors.waktu
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-white dark:bg-slate-900 text-xs font-mono text-center`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Kategori Kejadian *</label>
              <select
                value={kategori}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setKategori(newCat);
                  if (newCat !== 'LAINNYA') {
                    setKategoriLainnya('');
                    if (fieldErrors.kategoriLainnya) {
                      setFieldErrors((prev) => ({ ...prev, kategoriLainnya: '' }));
                    }
                  }
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
              >
                {effectiveCategories.map((cat) => (
                  <option key={cat.id} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tingkat Keparahan</label>
              <select
                value={tingkatKeparahan}
                onChange={(e) => setTingkatKeparahan(e.target.value as IncidentSeverity)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                  tingkatKeparahan === 'KRITIS'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    : tingkatKeparahan === 'TINGGI'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <option value="RENDAH">RENDAH (Ringan)</option>
                <option value="SEDANG">SEDANG (Standar)</option>
                <option value="TINGGI">TINGGI (Serius)</option>
                <option value="KRITIS">KRITIS (Darurat)</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC FIELD: Keterangan Kategori Lainnya (wajib saat kategori === 'LAINNYA') */}
          {kategori === 'LAINNYA' && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Keterangan Kategori Lainnya *</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {kategoriLainnya.length}/300
                </span>
              </div>
              <input
                type="text"
                maxLength={300}
                value={kategoriLainnya}
                onChange={(e) => {
                  setKategoriLainnya(e.target.value);
                  if (fieldErrors.kategoriLainnya) {
                    setFieldErrors((prev) => ({ ...prev, kategoriLainnya: '' }));
                  }
                }}
                placeholder="Tuliskan jenis kejadian yang belum tersedia dalam pilihan."
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.kategoriLainnya
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                } text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none`}
              />
              {fieldErrors.kategoriLainnya ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  {fieldErrors.kategoriLainnya}
                </p>
              ) : (
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
                  Petunjuk: Masukkan kategori khusus secara spesifik (maksimal 300 karakter).
                </p>
              )}
            </div>
          )}

          {/* Lokasi & Pihak Terlibat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Lokasi Kejadian di Sekolah *</span>
              </label>
              <input
                type="text"
                value={lokasi}
                onChange={(e) => {
                  setLokasi(e.target.value);
                  if (fieldErrors.lokasi) setFieldErrors((prev) => ({ ...prev, lokasi: '' }));
                }}
                placeholder="Contoh: Lapangan Olahraga / Gerbang Depan / Toilet Lt. 2"
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.lokasi
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs`}
              />
              {fieldErrors.lokasi && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.lokasi}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                <span>Pihak / Siswa yang Terlibat *</span>
              </label>
              <input
                type="text"
                value={pihakTerlibat}
                onChange={(e) => {
                  setPihakTerlibat(e.target.value);
                  if (fieldErrors.pihakTerlibat) setFieldErrors((prev) => ({ ...prev, pihakTerlibat: '' }));
                }}
                placeholder="Contoh: Riko & Dimas (Kelas XI MIPA 1) / Orang Tua Siswa"
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.pihakTerlibat
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs`}
              />
              {fieldErrors.pihakTerlibat && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.pihakTerlibat}</p>
              )}
            </div>
          </div>

          {/* Uraian Kejadian */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Uraian Kronologis Kejadian *</span>
              <span className="text-[10px] text-slate-400 font-normal">Faktual & Objektif</span>
            </label>
            <textarea
              rows={3}
              value={uraian}
              onChange={(e) => {
                setUraian(e.target.value);
                if (fieldErrors.uraian) setFieldErrors((prev) => ({ ...prev, uraian: '' }));
              }}
              placeholder="Ceritakan kronologi singkat kejadian secara objektif dan jelas..."
              className={`w-full p-2.5 rounded-xl border ${
                fieldErrors.uraian
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            {fieldErrors.uraian && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.uraian}</p>
            )}
          </div>

          {/* Tindakan Awal Petugas Piket */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Tindakan Penanganan Awal oleh Petugas Piket *</span>
              <span className="text-[10px] text-slate-400 font-normal">Langkah Cepat Pertama</span>
            </label>
            <textarea
              rows={2}
              value={tindakanAwal}
              onChange={(e) => {
                setTindakanAwal(e.target.value);
                if (fieldErrors.tindakanAwal) setFieldErrors((prev) => ({ ...prev, tindakanAwal: '' }));
              }}
              placeholder="Tindakan pertama yang dilakukan (misal: evakuasi ke UKS, amankan pihak terlibat, dll)..."
              className={`w-full p-2.5 rounded-xl border ${
                fieldErrors.tindakanAwal
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            {fieldErrors.tindakanAwal && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.tindakanAwal}</p>
            )}
          </div>

          {/* Tindak Lanjut & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tindak Lanjut / Rujukan Kasus (Opsional)
              </label>
              <input
                type="text"
                value={tindakLanjut}
                onChange={(e) => setTindakLanjut(e.target.value)}
                placeholder="Contoh: Diteruskan ke Guru BK / Wali Kelas / Sarpras"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Kejadian</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="BARU">BARU</option>
                <option value="INVESTIGASI">INVESTIGASI</option>
                <option value="PENANGANAN">PENANGANAN</option>
                <option value="SELESAI">SELESAI</option>
              </select>
            </div>
          </div>

          {/* FOTO DOKUMENTASI KEJADIAN */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>Dokumentasi Foto Bukti ({photos.length})</span>
              </label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs min-h-[38px]"
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                onClick={() => setIsCameraOpen(true)}
              >
                + Ambil / Unggah Foto
              </Button>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-800 shadow-xs">
                    <img src={photo.url} alt="Bukti Kejadian" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-90 hover:opacity-100 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Belum ada foto dokumentasi kejadian terlampir (opsional).
              </p>
            )}
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="min-h-[44px] px-5 font-bold shadow-md"
              isLoading={isSubmitting}
              leftIcon={editingIncident ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            >
              {editingIncident ? 'Simpan Perubahan' : 'Kirim Laporan Kejadian'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleAddPhoto}
      />
    </>
  );
};
