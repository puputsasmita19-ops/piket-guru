import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentPermitRecord, StudentPermitType } from '../../types/studentPermit.types';
import { TeacherRecord } from '../../types/master.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import {
  FileText,
  User,
  GraduationCap,
  Phone,
  Clock,
  HeartPulse,
  Award,
  AlertCircle,
} from 'lucide-react';

interface StudentPermitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StudentPermitRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  teachers: TeacherRecord[];
}

const CLASS_LIST = [
  'X MIPA 1', 'X MIPA 2', 'X MIPA 3', 'X IPS 1', 'X IPS 2',
  'XI MIPA 1', 'XI MIPA 2', 'XI MIPA 3', 'XI IPS 1', 'XI IPS 2',
  'XII MIPA 1', 'XII MIPA 2', 'XII MIPA 3', 'XII IPS 1', 'XII IPS 2',
];

export const StudentPermitFormModal: React.FC<StudentPermitFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers,
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamKeluar, setJamKeluar] = useState(formatTime(new Date()));
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisn, setNisN] = useState('');
  const [kelas, setKelas] = useState(CLASS_LIST[0]);
  const [jenisIzin, setJenisIzin] = useState<StudentPermitType>('SAKIT_PULANG');
  const [alasan, setAlasan] = useState('');
  const [penjemput, setPenjemput] = useState<'ORANG_TUA' | 'SENDIRI' | 'GURU_PEMBINA' | 'WALI'>('ORANG_TUA');
  const [namaPenjemput, setNamaPenjemput] = useState('');
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [guruPengajarName, setGuruPengajarName] = useState('');
  const [catatanPetugas, setCatatanPetugas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTanggal(new Date().toISOString().split('T')[0]);
      setJamKeluar(formatTime(new Date()));
      setNamaSiswa('');
      setNisN('');
      setKelas(CLASS_LIST[0]);
      setJenisIzin('SAKIT_PULANG');
      setAlasan('');
      setPenjemput('ORANG_TUA');
      setNamaPenjemput('');
      setNoHpOrangTua('');
      setGuruPengajarName(teachers[0]?.fullName || '');
      setCatatanPetugas('');
    }
  }, [isOpen, teachers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const initialStatus = jenisIzin === 'KELUAR_SEBENTAR' || jenisIzin === 'DISPENSASI_LOMBA'
        ? 'SEDANG_KELUAR'
        : 'SELESAI_PULANG';

      await onSave({
        tanggal,
        jamKeluar,
        namaSiswa,
        nisn: nisn || '-',
        kelas,
        jenisIzin,
        alasan,
        penjemput,
        namaPenjemput: namaPenjemput || (penjemput === 'SENDIRI' ? 'Pulang Mandiri' : '-'),
        noHpOrangTua,
        guruPengajarName,
        petugasPiketName: currentUser?.fullName || 'Petugas Piket',
        petugasPiketId: currentUser?.id || 'usr-piket',
        status: initialStatus,
        catatanPetugas,
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
      title="Terbitkan Surat Izin Keluar Sekolah (Gate Pass)"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Nama Siswa & Kelas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>Nama Lengkap Siswa</span>
            </label>
            <input
              required
              value={namaSiswa}
              onChange={(e) => setNamaSiswa(e.target.value)}
              placeholder="Contoh: Muhammad Rizky Pratama"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            />
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

        {/* Row 2: Jenis Izin & Jam Keluar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Jenis Izin / Alasan Meninggalkan Sekolah
            </label>
            <select
              value={jenisIzin}
              onChange={(e) => setJenisIzin(e.target.value as StudentPermitType)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              <option value="SAKIT_PULANG">🩺 Sakit (Pulang ke Rumah / Dirujuk)</option>
              <option value="URUSAN_KELUARGA">👨‍👩‍👧 Urusan Keluarga Mendesak</option>
              <option value="DISPENSASI_LOMBA">🏆 Dispensasi Lomba / Tugas Sekolah</option>
              <option value="KELUAR_SEBENTAR">⏳ Izin Keluar Sebentar (Kembali Lagi)</option>
              <option value="LAINNYA">📝 Keperluan Lainnya</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Jam Meninggalkan Sekolah (WIB)</span>
            </label>
            <input
              type="time"
              required
              value={jamKeluar}
              onChange={(e) => setJamKeluar(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>
        </div>

        {/* Row 3: Penjemput & Kontak Ortu */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Didampingi / Dijemput Oleh
            </label>
            <select
              value={penjemput}
              onChange={(e) => setPenjemput(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="ORANG_TUA">👨‍👩‍👦 Dijemput Orang Tua</option>
              <option value="WALI">👤 Dijemput Wali / Kerabat</option>
              <option value="GURU_PEMBINA">🧑‍🏫 Didampingi Guru Pembina</option>
              <option value="SENDIRI">🚶 Pulang Mandiri (Atas Izin)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Penjemput / Wali
            </label>
            <input
              value={namaPenjemput}
              onChange={(e) => setNamaPenjemput(e.target.value)}
              placeholder="Contoh: Bapak Suryanto"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>No. WhatsApp Ortu</span>
            </label>
            <input
              value={noHpOrangTua}
              onChange={(e) => setNoHpOrangTua(e.target.value)}
              placeholder="081234567890"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
        </div>

        {/* Row 4: Guru Mapel Jam Berlangsung */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Guru Pengajar pada Jam Pelajaran Berlangsung
          </label>
          <input
            value={guruPengajarName}
            onChange={(e) => setGuruPengajarName(e.target.value)}
            placeholder="Pilih atau ketik nama guru mapel..."
            list="teachers-permit-list"
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
          />
          <datalist id="teachers-permit-list">
            {teachers.map((t) => (
              <option key={t.id} value={`${t.fullName} (${t.mataPelajaran})`} />
            ))}
          </datalist>
        </div>

        {/* Row 5: Keterangan & Alasan */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Uraian Rinci Alasan Izin
          </label>
          <textarea
            required
            rows={3}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Tuliskan keterangan detail alasan siswa diberikan izin meninggalkan sekolah..."
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
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Terbitkan Surat Izin Gerbang
          </Button>
        </div>
      </form>
    </Modal>
  );
};
