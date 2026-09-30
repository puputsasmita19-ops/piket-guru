import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { StudentTardyRecord, TardyReason, DisciplineAction, TardyStatus } from '../../types/studentTardy.types';
import { StudentRecord } from '../../types/master.types';
import { StudentTardyService } from '../../services/firebase/studentTardyService';
import { StudentService } from '../../services/firebase/studentService';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import {
  Clock,
  User,
  GraduationCap,
  AlertTriangle,
  Camera,
  Trash2,
  Phone,
  ShieldAlert,
  Search,
  Sparkles,
} from 'lucide-react';

interface StudentTardyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StudentTardyRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
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
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamDatang, setJamDatang] = useState(formatTime(new Date()));
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState(CLASS_LIST[0]);
  const [alasan, setAlasan] = useState<TardyReason>('BANGUN_KESIANGAN');
  const [keteranganAlasan, setKeteranganAlasan] = useState('');
  const [pembinaan, setPembinaan] = useState<DisciplineAction>('LITERASI_PERPUSTAKAAN');
  const [poinPelanggaran, setPoinPelanggaran] = useState(5);
  const [frekuensiBulanIni, setFrekuensiBulanIni] = useState(1);
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [catatanPetugas, setCatatanPetugas] = useState('');

  const [studentDirectory, setStudentDirectory] = useState<StudentRecord[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    StudentService.bootstrapIfEmpty().then(() => {
      StudentService.getAllStudents().then((data) => setStudentDirectory(data));
    });
  }, []);

  const handleSelectStudentFromDirectory = (std: StudentRecord) => {
    setNamaSiswa(std.nama);
    setNisn(std.nisn);
    if (CLASS_LIST.includes(std.kelas)) {
      setKelas(std.kelas);
    }
    if (std.noHpOrangTua) {
      setNoHpOrangTua(std.noHpOrangTua);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const nowTime = formatTime(new Date());
      setTanggal(new Date().toISOString().split('T')[0]);
      setJamDatang(nowTime);
      setNamaSiswa('');
      setNisn('');
      setKelas(CLASS_LIST[0]);
      setAlasan('BANGUN_KESIANGAN');
      setKeteranganAlasan('');
      setPembinaan('LITERASI_PERPUSTAKAAN');
      setPoinPelanggaran(5);
      setFrekuensiBulanIni(1);
      setNoHpOrangTua('');
      setFotoUrl(undefined);
      setCatatanPetugas('');
    }
  }, [isOpen]);

  // Calculate minutes late assuming 07:00 WIB school bell
  const calculateMinutesLate = (timeStr: string) => {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 7;
    const minutes = parseInt(parts[1]) || 0;
    const arrivalInMinutes = hours * 60 + minutes;
    const bellInMinutes = 7 * 60; // 07:00 WIB
    return Math.max(0, arrivalInMinutes - bellInMinutes);
  };

  const minutesLate = calculateMinutesLate(jamDatang);

  // Check chronic frequency when student name changes
  const handleNameBlur = async () => {
    if (namaSiswa.trim()) {
      const count = await StudentTardyService.getStudentTardyCountThisMonth(namaSiswa, kelas);
      const newCount = count + 1;
      setFrekuensiBulanIni(newCount);
      if (newCount >= 3) {
        setPembinaan('SURAT_PERINGATAN_ORTU');
        setPoinPelanggaran(15);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const status: TardyStatus = frekuensiBulanIni >= 3 ? 'PEMANGGILAN_ORTU' : 'DALAM_PEMBINAAN';

      await onSave({
        tanggal,
        jamDatang,
        menitTerlambat: minutesLate || 15,
        namaSiswa,
        nisn: nisn || '-',
        kelas,
        alasan,
        keteranganAlasan,
        pembinaan,
        poinPelanggaran,
        frekuensiBulanIni,
        fotoUrl,
        noHpOrangTua,
        status,
        catatanPetugas,
        petugasPiketName: currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: currentUser?.id || 'usr-piket',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Catat Siswa Terlambat di Pos Gerbang"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Nama Siswa & Kelas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Nama Lengkap Siswa</span>
                </label>
                {studentDirectory.length > 0 && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {studentDirectory.length} Siswa di Database
                  </span>
                )}
              </div>
              <input
                required
                list="tardy-students-datalist"
                value={namaSiswa}
                onChange={(e) => {
                  const val = e.target.value;
                  setNamaSiswa(val);
                  const matched = studentDirectory.find((s) => s.nama.toLowerCase() === val.toLowerCase());
                  if (matched) {
                    handleSelectStudentFromDirectory(matched);
                  }
                }}
                onBlur={handleNameBlur}
                placeholder="Ketik nama atau pilih siswa..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              />
              <datalist id="tardy-students-datalist">
                {studentDirectory.map((s) => (
                  <option key={s.id} value={s.nama}>
                    {s.kelas} • NISN: {s.nisn}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                <span>Kelas</span>
              </label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                {CLASS_LIST.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Jam Datang, Menit Terlambat & Frekuensi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span>Jam Tiba di Gerbang</span>
              </label>
              <input
                type="time"
                required
                value={jamDatang}
                onChange={(e) => setJamDatang(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Selisih Terlambat
              </label>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-mono font-bold text-xs text-center">
                + {minutesLate} Menit (Batas 07:00)
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Keterlambatan Ke-
              </label>
              <div className={`p-2.5 rounded-xl border font-mono font-bold text-xs text-center ${
                frekuensiBulanIni >= 3
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                Ke-{frekuensiBulanIni} Bulan Ini {frekuensiBulanIni >= 3 ? '⚠️ Kritis' : ''}
              </div>
            </div>
          </div>

          {/* Row 3: Alasan & No HP Ortu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Alasan Keterlambatan
              </label>
              <select
                value={alasan}
                onChange={(e) => setAlasan(e.target.value as TardyReason)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="BANGUN_KESIANGAN">⏰ Bangun Kesiangan</option>
                <option value="MACET_LALULINTAS">🚗 Terjebak Macet Lalu Lintas</option>
                <option value="KENDARAAN_MOGOK">🛵 Kendaraan Rusak / Mogok</option>
                <option value="HUJAN_LEBAT">🌧️ Cuaca Buruk / Hujan Lebat</option>
                <option value="MEMBANTU_ORANG_TUA">👨‍👩‍👦 Membantu Urusan Orang Tua</option>
                <option value="LAINNYA">📝 Alasan Lainnya</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>No. WhatsApp Orang Tua</span>
              </label>
              <input
                value={noHpOrangTua}
                onChange={(e) => setNoHpOrangTua(e.target.value)}
                placeholder="081234567890"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 4: Jenis Pembinaan & Poin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Bentuk Pembinaan Kedisiplinan Piket
              </label>
              <select
                value={pembinaan}
                onChange={(e) => setPembinaan(e.target.value as DisciplineAction)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="LITERASI_PERPUSTAKAAN">📚 Literasi Membaca Buku di Perpustakaan</option>
                <option value="PEMBERSIHAN_LINGKUNGAN">🧹 Kerja Bakti / Kebersihan Lingkungan Sekolah</option>
                <option value="LITERASI_ROHANI_IBADAH">📖 Tadarus / Doa & Pembinaan Rohani</option>
                <option value="IKRAR_KEDISIPLINAN">🫡 Pengucapan Ikrar Kedisiplinan & Hormat Bendera</option>
                <option value="PEMBINAAN_GURU_BK">🧑‍💼 Konseling Khusus Guru Bimbingan Konseling</option>
                <option value="SURAT_PERINGATAN_ORTU">✉️ Penerbitan Surat Panggilan Orang Tua</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Poin Pelanggaran
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={poinPelanggaran}
                onChange={(e) => setPoinPelanggaran(parseInt(e.target.value) || 5)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center"
              />
            </div>
          </div>

          {/* Row 5: Foto Kamera Capture */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>Foto Dokumentasi Siswa Terlambat di Pos</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                onClick={() => setIsCameraOpen(true)}
              >
                {fotoUrl ? 'Ambil Ulang Foto' : '+ Ambil Foto Siswa'}
              </Button>
            </div>

            {fotoUrl && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={fotoUrl} alt="Foto Siswa Terlambat" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotoUrl(undefined)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Catat & Mulai Pembinaan
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
