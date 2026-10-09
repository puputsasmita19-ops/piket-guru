import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  VisitorRecord,
  VisitorCategory,
  VISITOR_CATEGORIES,
} from '../../types/visitor.types';
import { TeacherRecord } from '../../types/master.types';
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
} from 'lucide-react';

interface VisitorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Partial<VisitorRecord>,
    isEdit?: boolean
  ) => Promise<void>;
  editingVisitor?: VisitorRecord | null;
  teachers: TeacherRecord[];
}

export const VisitorFormModal: React.FC<VisitorFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingVisitor = null,
  teachers = [],
}) => {
  const { currentUser } = useAuth();

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
  const [tujuanBertemu, setTujuanBertemu] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [catatanPetugas, setCatatanPetugas] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Concurrency detection
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null);
  const [hasConcurrencyConflict, setHasConcurrencyConflict] = useState(false);

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
        setTujuanBertemu(editingVisitor.tujuanBertemu || '');
        setKeperluan(editingVisitor.keperluan || '');
        setFotoUrl(editingVisitor.fotoUrl);
        setCatatanPetugas(editingVisitor.catatanPetugas || '');
        setOriginalUpdatedAt(editingVisitor.updatedAt || null);
      } else {
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
        setTujuanBertemu(teachers[0]?.fullName ? `${teachers[0].fullName} (${teachers[0].mataPelajaran})` : 'Kepala Sekolah');
        setKeperluan('');
        setFotoUrl(undefined);
        setCatatanPetugas('');
        setOriginalUpdatedAt(null);
      }
      setHasConcurrencyConflict(false);
      setErrorMessage(null);
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, editingVisitor, teachers]);

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

    if (!tujuanBertemu.trim()) {
      errors.tujuanBertemu = 'Pihak/guru yang dituju wajib diisi';
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
      const payload: Partial<VisitorRecord> = {
        ...(editingVisitor ? { id: editingVisitor.id } : {}),
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
        tujuanBertemu: tujuanBertemu.trim(),
        keperluan: keperluan.trim(),
        fotoUrl: fotoUrl || undefined,
        status: editingVisitor ? editingVisitor.status : 'SEDANG_BERKUNJUNG',
        catatanPetugas: catatanPetugas.trim() || undefined,
        petugasPiketName: editingVisitor?.petugasPiketName || currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: editingVisitor?.petugasPiketId || currentUser?.id || 'usr-piket',
        createdAt: editingVisitor?.createdAt,
        createdBy: editingVisitor?.createdBy,
      };

      await onSave(payload, Boolean(editingVisitor));
      onClose();
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
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 sm:gap-5">
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

          {/* Row 3: Kategori & Keterangan Lain-lain */}
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
                    <option key={cat.code} value={cat.code}>
                      {cat.icon} {cat.label}
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

          {/* Row 4: Pihak yang Dituju & No Identitas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Pihak / Guru yang Dituju *</span>
              </label>
              <input
                type="text"
                required
                value={tujuanBertemu}
                onChange={(e) => {
                  setTujuanBertemu(e.target.value);
                  if (fieldErrors.tujuanBertemu) setFieldErrors((prev) => ({ ...prev, tujuanBertemu: '' }));
                }}
                placeholder="Nama Guru / Kepala Sekolah / Staf..."
                list="teachers-list"
                className={`w-full p-2.5 rounded-xl border ${
                  fieldErrors.tujuanBertemu
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              <datalist id="teachers-list">
                <option value="Dr. Hj. Siti Rohmah, M.Pd. (Kepala Sekolah)" />
                {teachers.map((t) => (
                  <option key={t.id} value={`${t.fullName} (${t.mataPelajaran})`} />
                ))}
              </datalist>
              {fieldErrors.tujuanBertemu && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.tujuanBertemu}</p>
              )}
            </div>

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
                <img src={fotoUrl} alt="Foto Tamu" className="w-full h-full object-cover" />
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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
          </div>
        </form>
      </Modal>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(img) => setFotoUrl(img)}
      />
    </>
  );
};
