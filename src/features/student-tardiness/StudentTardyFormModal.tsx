import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  StudentTardyRecord,
  TardyReason,
  DisciplineAction,
  TardyStatus,
} from '../../types/studentTardy.types';
import { StudentRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { StudentTardyService } from '../../services/firebase/studentTardyService';
import { StudentService } from '../../services/firebase/studentService';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
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
} from 'lucide-react';

interface StudentTardyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<StudentTardyRecord>, isEdit?: boolean) => Promise<void>;
  editingTardy?: StudentTardyRecord | null;
  settings?: SchoolSettings;
}

const CLASS_LIST = [
  'X MIPA 1', 'X MIPA 2', 'X MIPA 3', 'X IPS 1', 'X IPS 2',
  'XI MIPA 1', 'XI MIPA 2', 'XI MIPA 3', 'XI IPS 1', 'XI IPS 2',
  'XII MIPA 1', 'XII MIPA 2', 'XII MIPA 3', 'XII IPS 1', 'XII IPS 2',
];

export const StudentTardyFormModal: React.FC<StudentTardyFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTardy,
  settings,
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamDatang, setJamDatang] = useState(formatTime(new Date()));
  const [studentId, setStudentId] = useState<string | undefined>(undefined);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState('');
  const [alasan, setAlasan] = useState<TardyReason>('BANGUN_KESIANGAN');
  const [keteranganAlasan, setKeteranganAlasan] = useState('');
  const [pembinaan, setPembinaan] = useState<DisciplineAction>('LITERASI_PERPUSTAKAAN');
  const [keteranganPembinaan, setKeteranganPembinaan] = useState('');
  const [poinPelanggaran, setPoinPelanggaran] = useState(5);
  const [frekuensiBulanIni, setFrekuensiBulanIni] = useState(1);
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [catatanPetugas, setCatatanPetugas] = useState('');

  const [studentDirectory, setStudentDirectory] = useState<StudentRecord[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPreviewPhotoOpen, setIsPreviewPhotoOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Search input state for student picker
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Load student directory
  useEffect(() => {
    StudentService.bootstrapIfEmpty().then(() => {
      StudentService.getAllStudents().then((data) => {
        setStudentDirectory(data.filter((s) => s.isActive !== false));
      });
    });
  }, []);

  // Initialize or reset form state on open / editingTardy change
  useEffect(() => {
    if (isOpen) {
      if (editingTardy) {
        setTanggal(editingTardy.tanggal);
        setJamDatang(editingTardy.jamDatang);
        setStudentId(editingTardy.studentId);
        setNamaSiswa(editingTardy.namaSiswa);
        setStudentSearchTerm(editingTardy.namaSiswa);
        setNisn(editingTardy.nisn && editingTardy.nisn !== '-' ? editingTardy.nisn : '');
        setKelas(editingTardy.kelas);
        setAlasan(editingTardy.alasan);
        setKeteranganAlasan(editingTardy.keteranganAlasan || '');
        setPembinaan(editingTardy.pembinaan);
        setKeteranganPembinaan(editingTardy.keteranganPembinaan || '');
        setPoinPelanggaran(editingTardy.poinPelanggaran || 5);
        setFrekuensiBulanIni(editingTardy.frekuensiBulanIni || 1);
        setNoHpOrangTua(editingTardy.noHpOrangTua || '');
        setFotoUrl(editingTardy.fotoUrl);
        setCatatanPetugas(editingTardy.catatanPetugas || '');
      } else {
        const nowTime = formatTime(new Date());
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamDatang(nowTime);
        setStudentId(undefined);
        setNamaSiswa('');
        setStudentSearchTerm('');
        setNisn('');
        setKelas('');
        setAlasan('BANGUN_KESIANGAN');
        setKeteranganAlasan('');
        setPembinaan('LITERASI_PERPUSTAKAAN');
        setKeteranganPembinaan('');
        setPoinPelanggaran(5);
        setFrekuensiBulanIni(1);
        setNoHpOrangTua('');
        setFotoUrl(undefined);
        setCatatanPetugas('');
      }
      setErrorMessage(null);
      setFieldErrors({});
      setIsSubmitting(false);
      setIsStudentDropdownOpen(false);
    }
  }, [isOpen, editingTardy]);

  // Determine school bell entry limit (e.g. "07:00")
  const entryLimitTime = useMemo(() => {
    return settings?.workHours?.start || settings?.workHours?.checkInEnd || '07:00';
  }, [settings]);

  // Accurate minutes late calculation
  const minutesLate = useMemo(() => {
    if (!jamDatang || !jamDatang.trim() || !jamDatang.includes(':')) {
      return 0;
    }
    const [arrivalHStr, arrivalMStr] = jamDatang.split(':');
    const arrivalH = parseInt(arrivalHStr, 10);
    const arrivalM = parseInt(arrivalMStr, 10);
    if (isNaN(arrivalH) || isNaN(arrivalM)) {
      return 0;
    }

    const [limitHStr, limitMStr] = entryLimitTime.split(':');
    const limitH = parseInt(limitHStr, 10) || 7;
    const limitM = parseInt(limitMStr, 10) || 0;

    const arrivalInMinutes = arrivalH * 60 + arrivalM;
    const limitInMinutes = limitH * 60 + limitM;

    return Math.max(0, arrivalInMinutes - limitInMinutes);
  }, [jamDatang, entryLimitTime]);

  // Update tardy frequency count
  const refreshFrequencyCount = async (targetStudentId?: string, targetName?: string, targetKelas?: string) => {
    const sId = targetStudentId || studentId;
    const name = targetName || namaSiswa;
    const kl = targetKelas || kelas;

    if (sId || (name && name.trim())) {
      const count = await StudentTardyService.getStudentTardyCountThisMonth(
        sId || name,
        kl,
        tanggal,
        editingTardy ? editingTardy.id : undefined
      );
      const newFreq = count + 1;
      setFrekuensiBulanIni(newFreq);
      if (newFreq >= 3 && pembinaan === 'LITERASI_PERPUSTAKAAN') {
        setPembinaan('SURAT_PERINGATAN_ORTU');
        setPoinPelanggaran(15);
      }
    }
  };

  const handleSelectStudentFromDirectory = (std: StudentRecord) => {
    setStudentId(std.id);
    setNamaSiswa(std.nama);
    setStudentSearchTerm(std.nama);
    setNisn(std.nisn || '');
    setKelas(std.kelas || '');
    if (std.noHpOrangTua) {
      setNoHpOrangTua(std.noHpOrangTua);
    }
    setIsStudentDropdownOpen(false);

    if (fieldErrors.namaSiswa) setFieldErrors((prev) => ({ ...prev, namaSiswa: '' }));
    if (fieldErrors.kelas) setFieldErrors((prev) => ({ ...prev, kelas: '' }));

    refreshFrequencyCount(std.id, std.nama, std.kelas);
  };

  // Filter student directory for autocomplete
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return studentDirectory.slice(0, 8);
    const q = studentSearchTerm.toLowerCase();
    return studentDirectory
      .filter((s) => s.nama.toLowerCase().includes(q) || s.nisn?.toLowerCase().includes(q) || s.kelas?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [studentDirectory, studentSearchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate fields
    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!tanggal) {
      errors.tanggal = 'Tanggal kejadian wajib diisi';
      missing.push('Tanggal');
    }
    if (!jamDatang || !jamDatang.trim()) {
      errors.jamDatang = 'Jam tiba di gerbang wajib diisi';
      missing.push('Jam Tiba');
    }
    if (!namaSiswa || !namaSiswa.trim()) {
      errors.namaSiswa = 'Nama siswa wajib dipilih atau diisi';
      missing.push('Nama Siswa');
    }
    if (!kelas || !kelas.trim()) {
      errors.kelas = 'Kelas siswa wajib dipilih atau diisi';
      missing.push('Kelas Siswa');
    }

    // Reason validation for 'LAINNYA'
    if (alasan === 'LAINNYA') {
      const trimmedAlasan = keteranganAlasan.trim();
      if (!trimmedAlasan) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya wajib diisi';
        missing.push('Keterangan Alasan');
      } else if (trimmedAlasan.length > 300) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya tidak boleh lebih dari 300 karakter';
      }
    }

    // Discipline validation for 'LAINNYA'
    if (pembinaan === 'LAINNYA') {
      const trimmedPembinaan = keteranganPembinaan.trim();
      if (!trimmedPembinaan) {
        errors.keteranganPembinaan = 'Keterangan pembinaan lainnya wajib diisi';
        missing.push('Keterangan Pembinaan');
      } else if (trimmedPembinaan.length > 300) {
        errors.keteranganPembinaan = 'Keterangan pembinaan lainnya tidak boleh lebih dari 300 karakter';
      }
    }

    if (missing.length > 0 || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage(
        missing.length > 0
          ? `Bagian wajib belum lengkap: ${missing.join(', ')}. Harap lengkapi sebelum menyimpan.`
          : 'Terdapat isian yang belum sesuai. Harap periksa kembali formulir.'
      );
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const defaultStatus: TardyStatus = frekuensiBulanIni >= 3 ? 'PEMANGGILAN_ORTU' : 'DALAM_PEMBINAAN';
      const status: TardyStatus = editingTardy ? editingTardy.status : defaultStatus;

      const payload: Partial<StudentTardyRecord> = {
        ...(editingTardy ? { id: editingTardy.id } : {}),
        tanggal,
        jamDatang: jamDatang.trim(),
        menitTerlambat: minutesLate,
        studentId: studentId || undefined,
        namaSiswa: namaSiswa.trim(),
        nisn: nisn.trim() || '-',
        kelas: kelas.trim(),
        alasan,
        keteranganAlasan: alasan === 'LAINNYA' ? keteranganAlasan.trim() : undefined,
        pembinaan,
        keteranganPembinaan: pembinaan === 'LAINNYA' ? keteranganPembinaan.trim() : undefined,
        poinPelanggaran,
        frekuensiBulanIni,
        fotoUrl: fotoUrl || undefined,
        noHpOrangTua: noHpOrangTua.trim(),
        status,
        catatanPetugas: catatanPetugas.trim() || undefined,
        petugasPiketName: editingTardy?.petugasPiketName || currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: editingTardy?.petugasPiketId || currentUser?.id || 'usr-piket',
        createdAt: editingTardy?.createdAt,
        createdBy: editingTardy?.createdBy,
      };

      await onSave(payload, Boolean(editingTardy));
      onClose();
    } catch (err: any) {
      console.warn('[StudentTardyFormModal] Save tardy error:', err);
      const isPermDenied =
        err.code === 'permission-denied' ||
        err.message?.includes('permission-denied') ||
        err.message?.includes('Missing or insufficient permissions');

      setErrorMessage(
        isPermDenied
          ? 'Tidak memiliki izin menyimpan catatan keterlambatan siswa.'
          : err.message || 'Gagal menyimpan catatan keterlambatan.'
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
        title={editingTardy ? 'Ubah Catatan Siswa Terlambat' : 'Catat Siswa Terlambat di Pos Gerbang'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 sm:gap-6">
          {/* ========================================================================= */}
          {/* 1. BARIS IDENTITAS: NAMA SISWA & KELAS                                    */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 w-full">
            {/* Nama Siswa */}
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
                    if (fieldErrors.namaSiswa) setFieldErrors((prev) => ({ ...prev, namaSiswa: '' }));
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsStudentDropdownOpen(false), 250);
                    refreshFrequencyCount();
                  }}
                  placeholder="Ketik nama atau NISN siswa..."
                  className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.namaSiswa
                      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Autocomplete Dropdown */}
              {isStudentDropdownOpen && filteredStudents.length > 0 && (
                <div className="absolute z-40 left-0 right-0 top-full mt-1.5 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((std) => (
                    <div
                      key={std.id}
                      onMouseDown={() => handleSelectStudentFromDirectory(std)}
                      className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                    >
                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                        <span className="truncate">{std.nama}</span>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                          {std.kelas}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {std.nisn ? `NISN: ${std.nisn}` : 'NISN: -'} • {std.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {fieldErrors.namaSiswa && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.namaSiswa}</p>
              )}
            </div>

            {/* Kelas Siswa */}
            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
                <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Kelas Siswa *</span>
              </label>
              <input
                type="text"
                required
                list="tardy-classes-list"
                value={kelas}
                onChange={(e) => {
                  setKelas(e.target.value);
                  if (fieldErrors.kelas) setFieldErrors((prev) => ({ ...prev, kelas: '' }));
                }}
                onBlur={() => refreshFrequencyCount()}
                placeholder="Pilih/Ketik Kelas..."
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.kelas
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              <datalist id="tardy-classes-list">
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
          {/* 2. BARIS WAKTU: TANGGAL KEJADIAN & JAM TIBA (LEBAR PENUH FORMULIR)        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {/* Tanggal Kejadian */}
            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Tanggal Kejadian *</span>
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => {
                  setTanggal(e.target.value);
                  refreshFrequencyCount(studentId, namaSiswa, kelas);
                }}
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.tanggal
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              {fieldErrors.tanggal && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.tanggal}</p>
              )}
            </div>

            {/* Jam Tiba di Gerbang */}
            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
                <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Jam Tiba di Gerbang (WIB) *</span>
              </label>
              <input
                type="time"
                required
                value={jamDatang}
                onChange={(e) => {
                  setJamDatang(e.target.value);
                  if (fieldErrors.jamDatang) setFieldErrors((prev) => ({ ...prev, jamDatang: '' }));
                }}
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.jamDatang
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
              {fieldErrors.jamDatang && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{fieldErrors.jamDatang}</p>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. BARIS RINGKASAN: KARTU SELISIH & FREKUENSI (PISAH DARI INPUT WAKTU)    */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {/* Kartu Selisih Keterlambatan */}
            <div
              className={`min-w-0 w-full p-4 rounded-2xl border transition-all flex flex-col justify-center box-border ${
                minutesLate > 0
                  ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <span className="text-[11px] font-semibold opacity-80 block mb-1">
                Selisih Keterlambatan
              </span>
              <div className="text-base sm:text-lg font-mono font-extrabold flex items-center justify-between gap-2 flex-wrap">
                <span>{minutesLate > 0 ? `+${minutesLate} Menit` : '0 Menit (Tepat Waktu)'}</span>
                <span className="text-xs font-normal opacity-75 font-sans">
                  Batas Bel: {entryLimitTime} WIB
                </span>
              </div>
            </div>

            {/* Kartu Keterlambatan Ke- */}
            <div
              className={`min-w-0 w-full p-4 rounded-2xl border transition-all flex flex-col justify-center box-border ${
                frekuensiBulanIni >= 3
                  ? 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                  : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span className="text-[11px] font-semibold opacity-80 block mb-1">
                Frekuensi Bulan Berjalan ({tanggal.substring(0, 7)})
              </span>
              <div className="text-base sm:text-lg font-mono font-extrabold flex items-center justify-between gap-2 flex-wrap">
                <span>Keterlambatan Ke-{frekuensiBulanIni}</span>
                {frekuensiBulanIni >= 3 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-sans font-bold shadow-xs">
                    ⚠️ Kritis (≥3x)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. BARIS ALASAN KETERLAMBATAN & WHATSAPP ORANG TUA                         */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
                Alasan Keterlambatan *
              </label>
              <select
                value={alasan}
                onChange={(e) => {
                  const newAlasan = e.target.value as TardyReason;
                  setAlasan(newAlasan);
                  if (newAlasan !== 'LAINNYA') {
                    setKeteranganAlasan('');
                    if (fieldErrors.keteranganAlasan) {
                      setFieldErrors((prev) => ({ ...prev, keteranganAlasan: '' }));
                    }
                  }
                }}
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="BANGUN_KESIANGAN">⏰ Bangun Kesiangan</option>
                <option value="MACET_LALULINTAS">🚗 Terjebak Macet Lalu Lintas</option>
                <option value="KENDARAAN_MOGOK">🛵 Kendaraan Rusak / Mogok</option>
                <option value="HUJAN_LEBAT">🌧️ Cuaca Buruk / Hujan Lebat</option>
                <option value="MEMBANTU_ORANG_TUA">👨‍👩‍👦 Membantu Urusan Orang Tua</option>
                <option value="LAINNYA">📝 Lain-lain</option>
              </select>
            </div>

            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5 break-words">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>No. WhatsApp Orang Tua</span>
              </label>
              <input
                type="tel"
                value={noHpOrangTua}
                onChange={(e) => setNoHpOrangTua(e.target.value)}
                placeholder="Contoh: 081234567890 (Opsional)"
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* DYNAMIC FIELD: Keterangan Alasan Lainnya (Lebar Penuh) */}
          {alasan === 'LAINNYA' && (
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2 animate-fadeIn w-full box-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 break-words">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Keterangan Alasan Lainnya *</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {keteranganAlasan.length}/300
                </span>
              </div>
              <input
                type="text"
                maxLength={300}
                value={keteranganAlasan}
                onChange={(e) => {
                  setKeteranganAlasan(e.target.value);
                  if (fieldErrors.keteranganAlasan) {
                    setFieldErrors((prev) => ({ ...prev, keteranganAlasan: '' }));
                  }
                }}
                placeholder="Tuliskan alasan keterlambatan lainnya secara spesifik..."
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.keteranganAlasan
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                } text-xs text-slate-900 dark:text-white placeholder:text-slate-400 box-border focus:ring-2 focus:ring-amber-500 focus:outline-none`}
              />
              {fieldErrors.keteranganAlasan && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  {fieldErrors.keteranganAlasan}
                </p>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. BARIS BENTUK PEMBINAAN & POIN PELANGGARAN                              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 w-full">
            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
                Bentuk Pembinaan Kedisiplinan Piket *
              </label>
              <select
                value={pembinaan}
                onChange={(e) => {
                  const newPemb = e.target.value as DisciplineAction;
                  setPembinaan(newPemb);
                  if (newPemb !== 'LAINNYA') {
                    setKeteranganPembinaan('');
                    if (fieldErrors.keteranganPembinaan) {
                      setFieldErrors((prev) => ({ ...prev, keteranganPembinaan: '' }));
                    }
                  }
                }}
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="LITERASI_PERPUSTAKAAN">📚 Literasi Membaca Buku di Perpustakaan</option>
                <option value="PEMBERSIHAN_LINGKUNGAN">🧹 Kerja Bakti / Kebersihan Lingkungan Sekolah</option>
                <option value="LITERASI_ROHANI_IBADAH">📖 Tadarus / Doa & Pembinaan Rohani</option>
                <option value="IKRAR_KEDISIPLINAN">🫡 Pengucapan Ikrar Kedisiplinan & Hormat Bendera</option>
                <option value="PEMBINAAN_GURU_BK">🧑‍💼 Konseling Khusus Guru Bimbingan Konseling</option>
                <option value="SURAT_PERINGATAN_ORTU">✉️ Penerbitan Surat Panggilan Orang Tua</option>
                <option value="LAINNYA">📝 Lain-lain</option>
              </select>
            </div>

            <div className="min-w-0 w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
                Poin Pelanggaran
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={poinPelanggaran}
                onChange={(e) => setPoinPelanggaran(parseInt(e.target.value, 10) || 5)}
                className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* DYNAMIC FIELD: Keterangan Pembinaan Lainnya (Lebar Penuh) */}
          {pembinaan === 'LAINNYA' && (
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2 animate-fadeIn w-full box-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 break-words">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Keterangan Pembinaan Lainnya *</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {keteranganPembinaan.length}/300
                </span>
              </div>
              <input
                type="text"
                maxLength={300}
                value={keteranganPembinaan}
                onChange={(e) => {
                  setKeteranganPembinaan(e.target.value);
                  if (fieldErrors.keteranganPembinaan) {
                    setFieldErrors((prev) => ({ ...prev, keteranganPembinaan: '' }));
                  }
                }}
                placeholder="Tuliskan bentuk pembinaan kedisiplinan lainnya..."
                className={`w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.keteranganPembinaan
                    ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                } text-xs text-slate-900 dark:text-white placeholder:text-slate-400 box-border focus:ring-2 focus:ring-amber-500 focus:outline-none`}
              />
              {fieldErrors.keteranganPembinaan && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  {fieldErrors.keteranganPembinaan}
                </p>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. BARIS CATATAN PETUGAS PIKET (LEBAR PENUH)                              */}
          {/* ========================================================================= */}
          <div className="w-full min-w-0">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 break-words">
              Catatan Petugas Piket (Opsional)
            </label>
            <input
              type="text"
              value={catatanPetugas}
              onChange={(e) => setCatatanPetugas(e.target.value)}
              placeholder="Contoh: Siswa kooperatif, berjanji tidak mengulangi keterlambatan..."
              className="w-full max-w-full min-h-[48px] h-12 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white box-border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* ========================================================================= */}
          {/* 7. BARIS FOTO DOKUMENTASI GERBANG (LEBAR PENUH)                           */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 break-words">
                <Camera className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Foto Dokumentasi Siswa di Pos Gerbang</span>
              </label>

              {!fotoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs min-h-[40px] px-3.5"
                  leftIcon={<Camera className="w-4 h-4" />}
                  onClick={() => setIsCameraOpen(true)}
                >
                  + Ambil / Unggah Foto
                </Button>
              )}
            </div>

            {fotoUrl ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 w-full box-border">
                <div
                  onClick={() => setIsPreviewPhotoOpen(true)}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 cursor-pointer group shadow-sm shrink-0"
                  title="Klik untuk memperbesar foto"
                >
                  <img src={fotoUrl} alt="Foto Siswa Terlambat" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 min-w-0 w-full">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Foto dokumentasi terlampir</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Foto tersimpan aman di database sebagai bukti kehadiran pos.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-3"
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setIsPreviewPhotoOpen(true)}
                    >
                      Lihat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-3"
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      onClick={() => setIsCameraOpen(true)}
                    >
                      Ambil Ulang
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="text-xs h-8 px-3"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => setFotoUrl(undefined)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Belum ada foto dokumentasi terlampir (opsional).
              </p>
            )}
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
              leftIcon={editingTardy ? <Save className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            >
              {editingTardy ? 'Simpan Perubahan' : 'Catat & Mulai Pembinaan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(img) => {
          setFotoUrl(img);
          setIsCameraOpen(false);
        }}
      />

      {/* Photo Zoom Preview Modal */}
      {fotoUrl && (
        <Modal
          isOpen={isPreviewPhotoOpen}
          onClose={() => setIsPreviewPhotoOpen(false)}
          title="Foto Dokumentasi Siswa Terlambat"
          maxWidth="md"
        >
          <div className="space-y-3 text-center">
            <img
              src={fotoUrl}
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
