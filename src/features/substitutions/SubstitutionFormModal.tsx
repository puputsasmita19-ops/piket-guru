import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { TeacherSubstitutionRecord, AbsenceReason, SubstitutionStatus } from '../../types/substitution.types';
import { TeacherRecord } from '../../types/master.types';
import { useAuth } from '../../contexts/AuthContext';
import {
  UserX,
  UserCheck,
  BookOpen,
  GraduationCap,
  Clock,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

interface SubstitutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<TeacherSubstitutionRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  teachers: TeacherRecord[];
}

const CLASS_LIST = [
  'X MIPA 1', 'X MIPA 2', 'X MIPA 3', 'X IPS 1', 'X IPS 2',
  'XI MIPA 1', 'XI MIPA 2', 'XI MIPA 3', 'XI IPS 1', 'XI IPS 2',
  'XII MIPA 1', 'XII MIPA 2', 'XII MIPA 3', 'XII IPS 1', 'XII IPS 2',
];

export const SubstitutionFormModal: React.FC<SubstitutionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers,
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [guruBerhalanganId, setGuruBerhalanganId] = useState('');
  const [guruBerhalanganName, setGuruBerhalanganName] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [alasan, setAlasan] = useState<AbsenceReason>('SAKIT');
  const [keteranganAlasan, setKeteranganAlasan] = useState('');
  const [kelas, setKelas] = useState(CLASS_LIST[0]);
  const [jamPelajaran, setJamPelajaran] = useState('JP 1 - 2 (07.15 - 08.45)');
  const [guruPenggantiId, setGuruPenggantiId] = useState('');
  const [guruPenggantiName, setGuruPenggantiName] = useState('');
  const [materiDanTugasSiswa, setMateriDanTugasSiswa] = useState('');
  const [catatanPiket, setCatatanPiket] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && teachers.length > 0) {
      setTanggal(new Date().toISOString().split('T')[0]);
      const initialTeacher = teachers[0];
      setGuruBerhalanganId(initialTeacher.id);
      setGuruBerhalanganName(initialTeacher.fullName);
      setMataPelajaran(initialTeacher.mataPelajaran);
      setAlasan('SAKIT');
      setKeteranganAlasan('');
      setKelas(CLASS_LIST[0]);
      setJamPelajaran('JP 1 - 2 (07.15 - 08.45)');
      setGuruPenggantiId('');
      setGuruPenggantiName('');
      setMateriDanTugasSiswa('');
      setCatatanPiket('');
    }
  }, [isOpen, teachers]);

  const handleSelectAbsentTeacher = (teacherId: string) => {
    const t = teachers.find((tch) => tch.id === teacherId);
    if (t) {
      setGuruBerhalanganId(t.id);
      setGuruBerhalanganName(t.fullName);
      setMataPelajaran(t.mataPelajaran);
    }
  };

  const handleSelectSubstituteTeacher = (subId: string) => {
    if (!subId) {
      setGuruPenggantiId('');
      setGuruPenggantiName('');
      return;
    }
    const t = teachers.find((tch) => tch.id === subId);
    if (t) {
      setGuruPenggantiId(t.id);
      setGuruPenggantiName(t.fullName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const status: SubstitutionStatus = guruPenggantiName ? 'TERTUGASKAN' : 'MENUNGGU_GURU_INVAL';

      await onSave({
        tanggal,
        guruBerhalanganId,
        guruBerhalanganName,
        mataPelajaran,
        alasan,
        keteranganAlasan,
        kelas,
        jamPelajaran,
        guruPenggantiId: guruPenggantiId || undefined,
        guruPenggantiName: guruPenggantiName || undefined,
        materiDanTugasSiswa,
        status,
        catatanPiket,
        petugasPiketName: currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: currentUser?.id || 'usr-piket',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Catat Guru Berhalangan & Tugas Inval Pengganti"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Guru Berhalangan & Mata Pelajaran */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-rose-500" />
              <span>Guru yang Berhalangan Hadir</span>
            </label>
            <select
              value={guruBerhalanganId}
              onChange={(e) => handleSelectAbsentTeacher(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.mataPelajaran})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Mata Pelajaran</span>
            </label>
            <input
              required
              value={mataPelajaran}
              onChange={(e) => setMataPelajaran(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
        </div>

        {/* Row 2: Alasan & Rincian Alasan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Alasan Berhalangan Hadir
            </label>
            <select
              value={alasan}
              onChange={(e) => setAlasan(e.target.value as AbsenceReason)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="SAKIT">🩺 Sakit (Surat Dokter / Izin)</option>
              <option value="DINAS_LUAR">🏛️ Tugas Kedinasan Luar / Pelatihan</option>
              <option value="CUTI_TAHUNAN">📅 Cuti Tahunan / Resmi</option>
              <option value="CUTI_MELAHIRKAN">👶 Cuti Melahirkan</option>
              <option value="IZIN_MENDESAK">👨‍👩‍👧 Izin Keperluan Mendesak</option>
              <option value="TANPA_KETERANGAN">⚠️ Tanpa Keterangan (Alpha)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Keterangan Alasan Tambahan
            </label>
            <input
              value={keteranganAlasan}
              onChange={(e) => setKeteranganAlasan(e.target.value)}
              placeholder="Contoh: Menghadiri Workshop MGMP..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
        </div>

        {/* Row 3: Kelas & Jam Pelajaran */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
              <span>Kelas yang Ditinggalkan</span>
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

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Jam Pelajaran (JP) & Waktu</span>
            </label>
            <input
              required
              value={jamPelajaran}
              onChange={(e) => setJamPelajaran(e.target.value)}
              placeholder="Contoh: JP 1 - 2 (07.15 - 08.45)"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>
        </div>

        {/* Row 4: Guru Inval / Pengganti */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Guru Pengganti / Inval yang Ditugaskan (Opsional)</span>
          </label>
          <select
            value={guruPenggantiId}
            onChange={(e) => handleSelectSubstituteTeacher(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <option value="">-- Belum Ditugaskan (Menunggu Guru Inval) --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                🧑‍🏫 {t.fullName} ({t.mataPelajaran})
              </option>
            ))}
          </select>
        </div>

        {/* Row 5: Materi & Tugas Siswa */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Materi & Tugas yang Ditinggalkan untuk Siswa
          </label>
          <textarea
            required
            rows={3}
            value={materiDanTugasSiswa}
            onChange={(e) => setMateriDanTugasSiswa(e.target.value)}
            placeholder="Tuliskan instruksi materi, latihan buku paket/LKS, modul, atau penugasan mandiri siswa..."
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
          />
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
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Simpan & Terbitkan Tugas Inval
          </Button>
        </div>
      </form>
    </Modal>
  );
};
