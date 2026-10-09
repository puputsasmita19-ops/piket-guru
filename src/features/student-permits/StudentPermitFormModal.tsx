import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  StudentPermitRecord,
  StudentPermitType,
  STUDENT_PERMIT_TYPES,
} from '../../types/studentPermit.types';
import { TeacherRecord, StudentRecord } from '../../types/master.types';
import { StudentService } from '../../services/firebase/studentService';
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
} from 'lucide-react';

interface StudentPermitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
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

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamKeluar, setJamKeluar] = useState(formatTime(new Date()));

  // Student selection state
  const [studentId, setStudentId] = useState<string | undefined>(undefined);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisn, setNisN] = useState('');
  const [kelas, setKelas] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Permit Type & Details
  const [jenisIzin, setJenisIzin] = useState<StudentPermitType>('SAKIT_PULANG');
  const [keteranganLainnya, setKeteranganLainnya] = useState('');
  const [alasan, setAlasan] = useState('');

  // Accompanying person
  const [penjemput, setPenjemput] = useState<'ORANG_TUA' | 'SENDIRI' | 'GURU_PEMBINA' | 'WALI'>('ORANG_TUA');
  const [namaPenjemput, setNamaPenjemput] = useState('');
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [guruPengajarName, setGuruPengajarName] = useState('');
  const [catatanPetugas, setCatatanPetugas] = useState('');

  // Master students directory
  const [studentDirectory, setStudentDirectory] = useState<StudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // Submission state & errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Concurrency detection
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null);
  const [hasConcurrencyConflict, setHasConcurrencyConflict] = useState(false);

  // Load students directory
  useEffect(() => {
    let isMounted = true;
    StudentService.bootstrapIfEmpty()
      .then(() => StudentService.getAllStudents())
      .then((data) => {
        if (isMounted) {
          setStudentDirectory(data);
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

  // Filter student candidates
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return studentDirectory.slice(0, 10);
    const q = studentSearchTerm.toLowerCase();
    return studentDirectory
      .filter(
        (s) =>
          s.nama.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.includes(q)) ||
          (s.kelas && s.kelas.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [studentDirectory, studentSearchTerm]);

  // Handle student selection
  const handleSelectStudent = (std: StudentRecord) => {
    setStudentId(std.id);
    setNamaSiswa(std.nama);
    setStudentSearchTerm(std.nama);
    setNisN(std.nisn || '');
    setKelas(std.kelas || '');
    if (std.noHpOrangTua) {
      setNoHpOrangTua(std.noHpOrangTua);
    }
    setIsStudentDropdownOpen(false);
    if (fieldErrors.namaSiswa || fieldErrors.kelas) {
      setFieldErrors((prev) => ({ ...prev, namaSiswa: '', kelas: '' }));
    }
  };

  // Reset or prefill form
  useEffect(() => {
    if (isOpen) {
      if (editingPermit) {
        setTanggal(editingPermit.tanggal || new Date().toISOString().split('T')[0]);
        setJamKeluar(editingPermit.jamKeluar || formatTime(new Date()));
        setStudentId(editingPermit.studentId);
        setNamaSiswa(editingPermit.namaSiswa || '');
        setStudentSearchTerm(editingPermit.namaSiswa || '');
        setNisN(editingPermit.nisn || '');
        setKelas(editingPermit.kelas || '');
        setJenisIzin(editingPermit.jenisIzin || 'SAKIT_PULANG');
        setKeteranganLainnya(editingPermit.keteranganLainnya || '');
        setAlasan(editingPermit.alasan || '');
        setPenjemput(editingPermit.penjemput || 'ORANG_TUA');
        setNamaPenjemput(editingPermit.namaPenjemput || '');
        setNoHpOrangTua(editingPermit.noHpOrangTua || '');
        setGuruPengajarName(editingPermit.guruPengajarName || '');
        setCatatanPetugas(editingPermit.catatanPetugas || '');
        setOriginalUpdatedAt(editingPermit.updatedAt || null);
      } else {
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamKeluar(formatTime(new Date()));
        setStudentId(undefined);
        setNamaSiswa('');
        setStudentSearchTerm('');
        setNisN('');
        setKelas('');
        setJenisIzin('SAKIT_PULANG');
        setKeteranganLainnya('');
        setAlasan('');
        setPenjemput('ORANG_TUA');
        setNamaPenjemput('');
        setNoHpOrangTua('');
        setGuruPengajarName('');
        setCatatanPetugas('');
        setOriginalUpdatedAt(null);
      }
      setHasConcurrencyConflict(false);
      setErrorMessage(null);
      setFieldErrors({});
      setIsStudentDropdownOpen(false);
      setIsSubmitting(false);
    }
  }, [isOpen, editingPermit]);

  // Real-time concurrency listener
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!namaSiswa.trim()) {
      errors.namaSiswa = 'Pilih siswa dari data master siswa';
      missing.push('Nama Siswa');
    }

    if (!kelas.trim()) {
      errors.kelas = 'Kelas siswa harus terisi sesuai data master siswa';
      missing.push('Kelas Siswa');
    }

    if (!tanggal) {
      errors.tanggal = 'Tanggal izin wajib diisi';
      missing.push('Tanggal');
    }

    if (!jamKeluar) {
      errors.jamKeluar = 'Jam keluar wajib diisi';
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

    if (!alasan.trim()) {
      errors.alasan = 'Uraian rincian alasan izin wajib diisi';
      missing.push('Uraian Alasan');
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
      const initialStatus =
        jenisIzin === 'KELUAR_SEBENTAR' || jenisIzin === 'DISPENSASI_LOMBA'
          ? 'SEDANG_KELUAR'
          : 'SELESAI_PULANG';

      const finalStatus = editingPermit ? editingPermit.status : initialStatus;

      const payload: Partial<StudentPermitRecord> = {
        ...(editingPermit ? { id: editingPermit.id } : {}),
        studentId: studentId || undefined,
        tanggal,
        jamKeluar,
        jamKembali: editingPermit?.jamKembali,
        namaSiswa: namaSiswa.trim(),
        nisn: nisn.trim() || '-',
        kelas: kelas.trim(),
        jenisIzin,
        keteranganLainnya: jenisIzin === 'LAINNYA' ? keteranganLainnya.trim() : undefined,
        alasan: alasan.trim(),
        penjemput,
        namaPenjemput:
          namaPenjemput.trim() ||
          (penjemput === 'SENDIRI'
            ? 'Pulang Mandiri'
            : penjemput === 'GURU_PEMBINA'
            ? 'Guru Pembina'
            : 'Orang Tua / Wali'),
        noHpOrangTua: noHpOrangTua.trim() || undefined,
        guruPengajarName: guruPengajarName.trim() || undefined,
        petugasPiketName: editingPermit?.petugasPiketName || currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: editingPermit?.petugasPiketId || currentUser?.id || 'usr-piket',
        status: finalStatus,
        catatanPetugas: catatanPetugas.trim() || undefined,
        createdAt: editingPermit?.createdAt,
        createdBy: editingPermit?.createdBy,
      };

      await onSave(payload, Boolean(editingPermit));
      onClose();
    } catch (err: any) {
      console.warn('[StudentPermitFormModal] Save error:', err);
      const isPermDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions');

      setErrorMessage(
        isPermDenied
          ? 'Tidak memiliki izin menyimpan surat izin siswa.'
          : err.message || 'Gagal menyimpan surat izin siswa.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPermit ? 'Ubah Surat Izin Keluar Siswa' : 'Terbitkan Surat Izin Keluar Sekolah (Gate Pass)'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 sm:gap-6">
        {/* CONCURRENCY WARNING */}
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
        {/* BARIS 1: NAMA SISWA & KELAS                                              */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 w-full">
          {/* Pencarian Nama Siswa */}
          <div className="min-w-0 w-full relative">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 break-words">
                <User className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Nama Lengkap Siswa *</span>
              </label>
              {studentDirectory.length > 0 && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  {studentDirectory.length} Siswa Terdaftar
                </span>
              )}
            </div>

            {isLoadingStudents ? (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                <span>Memuat data siswa...</span>
              </div>
            ) : (
              <div className="relative w-full min-w-0">
                <input
                  type="text"
                  required
                  value={studentSearchTerm}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentSearchTerm(val);
                    setNamaSiswa(val);
                    setIsStudentDropdownOpen(true);
                    if (fieldErrors.namaSiswa) {
                      setFieldErrors((prev) => ({ ...prev, namaSiswa: '' }));
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsStudentDropdownOpen(false), 250);
                  }}
                  placeholder="Ketik nama siswa untuk mencari..."
                  className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.namaSiswa
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                {/* Dropdown Hasil Pencarian Siswa */}
                {isStudentDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                    {studentDirectory.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Belum ada data master siswa.
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Tidak ditemukan siswa dengan nama "{studentSearchTerm}".
                      </div>
                    ) : (
                      filteredStudents.map((s) => (
                        <div
                          key={s.id}
                          onMouseDown={() => handleSelectStudent(s)}
                          className="p-3 hover:bg-blue-50/80 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                        >
                          <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                            <span className="truncate">{s.nama}</span>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                              {s.kelas || 'Tanpa Kelas'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center justify-between gap-2">
                            <span>{s.nisn ? `NISN: ${s.nisn}` : 'Tanpa NISN'}</span>
                            <span>{s.noHpOrangTua ? `📞 ${s.noHpOrangTua}` : 'No HP -'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {studentId && (
              <div className="flex items-center justify-between gap-2 mt-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-[11px]">
                <span className="text-blue-700 dark:text-blue-300 truncate">
                  Terhubung: <strong>{namaSiswa}</strong> ({kelas || 'Tanpa Kelas'})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudentId(undefined);
                    setNamaSiswa('');
                    setStudentSearchTerm('');
                    setKelas('');
                    setNisN('');
                  }}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                  title="Ganti Siswa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {fieldErrors.namaSiswa && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.namaSiswa}</p>
            )}
          </div>

          {/* Kelas Siswa (Otomatis dari Master) */}
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
              <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Kelas Siswa *</span>
            </label>
            <input
              type="text"
              required
              readOnly={Boolean(studentId)}
              value={kelas}
              onChange={(e) => {
                setKelas(e.target.value);
                if (fieldErrors.kelas) setFieldErrors((prev) => ({ ...prev, kelas: '' }));
              }}
              placeholder={studentId ? (kelas ? kelas : 'Belum ditentukan di master') : 'Pilih siswa terlebih dahulu'}
              className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                fieldErrors.kelas
                  ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800'
              } ${
                studentId
                  ? 'bg-slate-100 dark:bg-slate-800 font-bold text-blue-600 dark:text-blue-400 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
              } text-xs font-mono box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            />
            {fieldErrors.kelas && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.kelas}</p>
            )}
            {studentId && !kelas && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                Data kelas belum diatur pada master siswa.
              </p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 2: TANGGAL & JAM MENINGGALKAN SEKOLAH                               */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Tanggal Izin Keluar *</span>
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
              <span>Jam Meninggalkan Sekolah (WIB) *</span>
            </label>
            <input
              type="time"
              required
              value={jamKeluar}
              onChange={(e) => {
                setJamKeluar(e.target.value);
                if (fieldErrors.jamKeluar) setFieldErrors((prev) => ({ ...prev, jamKeluar: '' }));
              }}
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 3: JENIS IZIN & KETERANGAN KEPERLUAN LAINNYA                        */}
        {/* ========================================================================= */}
        <div className="space-y-4 w-full">
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
              Jenis Izin / Keperluan Meninggalkan Sekolah *
            </label>
            <select
              value={jenisIzin}
              onChange={(e) => {
                const newType = e.target.value as StudentPermitType;
                setJenisIzin(newType);
                if (newType !== 'LAINNYA' && fieldErrors.keteranganLainnya) {
                  setFieldErrors((prev) => ({ ...prev, keteranganLainnya: '' }));
                }
              }}
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {STUDENT_PERMIT_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kolom Keterangan Keperluan jika memilih Lain-lain */}
          {jenisIzin === 'LAINNYA' && (
            <div className="min-w-0 w-full p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-200 block break-words">
                  Keterangan Keperluan Lainnya *
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
                placeholder="Tuliskan keterangan keperluan izin siswa (wajib, maks. 300 karakter)..."
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.keteranganLainnya
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                } text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-amber-500 focus:outline-none`}
              />
              {fieldErrors.keteranganLainnya && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.keteranganLainnya}</p>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BARIS 4: PENDAMPINGAN / PENJEMPUT ORANG TUA / WALI                        */}
        {/* ========================================================================= */}
        <div className="space-y-3.5 w-full bg-slate-50/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="min-w-0 w-full">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2.5 break-words">
              <Users className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Didampingi / Dijemput Oleh *</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                { value: 'ORANG_TUA', label: '👨‍👩‍👦 Didampingi Orang Tua / Wali' },
                { value: 'WALI', label: '👤 Dijemput Wali / Kerabat Keluarga' },
                { value: 'GURU_PEMBINA', label: '🧑‍🏫 Didampingi Guru Pembina / Pendamping' },
                { value: 'SENDIRI', label: '🚶 Pulang Mandiri (Tanpa Pendamping)' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all text-xs font-semibold leading-snug ${
                    penjemput === opt.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="penjemput"
                    value={opt.value}
                    checked={penjemput === opt.value}
                    onChange={() => setPenjemput(opt.value as any)}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 shrink-0"
                  />
                  <span className="break-words">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Kolom Nama Penjemput & Kontak Ortu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="min-w-0 w-full">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
                Nama Pendamping / Penjemput
              </label>
              <input
                type="text"
                value={namaPenjemput}
                onChange={(e) => setNamaPenjemput(e.target.value)}
                placeholder={
                  penjemput === 'SENDIRI'
                    ? 'Pulang Mandiri (Tanpa Pendamping)'
                    : penjemput === 'GURU_PEMBINA'
                    ? 'Contoh: Drs. H. Ahmad Fauzi, M.Pd.'
                    : 'Contoh: Bapak Suryanto (Ayah Kandung)'
                }
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="min-w-0 w-full">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
                <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>No. WhatsApp Orang Tua / Wali</span>
              </label>
              <input
                type="tel"
                value={noHpOrangTua}
                onChange={(e) => setNoHpOrangTua(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 5: GURU MAPEL SAAT JAM BERLANGSUNG                                 */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
            Guru Pengajar pada Jam Pelajaran Berlangsung (Opsional)
          </label>
          <input
            type="text"
            list="teachers-permit-datalist"
            value={guruPengajarName}
            onChange={(e) => setGuruPengajarName(e.target.value)}
            placeholder="Pilih atau ketik nama guru pengajar di kelas..."
            className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <datalist id="teachers-permit-datalist">
            {teachers.map((t) => (
              <option key={t.id} value={`${t.fullName} (${t.mataPelajaran})`} />
            ))}
          </datalist>
        </div>

        {/* ========================================================================= */}
        {/* BARIS 6: URAIAN RINCIAN ALASAN & CATATAN PETUGAS                          */}
        {/* ========================================================================= */}
        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
            Uraian Rincian Alasan Izin Meninggalkan Sekolah *
          </label>
          <textarea
            required
            rows={3}
            value={alasan}
            onChange={(e) => {
              setAlasan(e.target.value);
              if (fieldErrors.alasan) setFieldErrors((prev) => ({ ...prev, alasan: '' }));
            }}
            placeholder="Tuliskan keterangan detail alasan siswa diberikan izin keluar gerbang sekolah..."
            className={`w-full max-w-full p-3 rounded-xl border ${
              fieldErrors.alasan
                ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800'
            } bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed`}
          />
          {fieldErrors.alasan && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.alasan}</p>
          )}
        </div>

        <div className="min-w-0 w-full space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block break-words">
            Catatan Tambahan Petugas Piket Pos Gerbang (Opsional)
          </label>
          <input
            type="text"
            value={catatanPetugas}
            onChange={(e) => setCatatanPetugas(e.target.value)}
            placeholder="Contoh: Siswa telah diperiksa di UKS dan dijemput orang tua di gerbang depan..."
            className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
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
            leftIcon={editingPermit ? <Save className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          >
            {editingPermit ? 'Simpan Perubahan Surat Izin' : 'Terbitkan Surat Izin Gerbang'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
