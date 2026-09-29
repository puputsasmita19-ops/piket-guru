import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { VisitorRecord, VisitorCategory } from '../../types/visitor.types';
import { TeacherRecord } from '../../types/master.types';
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
} from 'lucide-react';

interface VisitorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<VisitorRecord, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  teachers: TeacherRecord[];
}

export const VisitorFormModal: React.FC<VisitorFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers,
}) => {
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamMasuk, setJamMasuk] = useState(formatTime(new Date()));
  const [namaTamu, setNamaTamu] = useState('');
  const [instansiAsal, setInstansiAsal] = useState('');
  const [kategori, setKategori] = useState<VisitorCategory>('UMUM');
  const [noHp, setNoHp] = useState('');
  const [nomorIdentitas, setNomorIdentitas] = useState('');
  const [nomorBadge, setNomorBadge] = useState('TAMU-01');
  const [tujuanBertemu, setTujuanBertemu] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined);
  const [catatanPetugas, setCatatanPetugas] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTanggal(new Date().toISOString().split('T')[0]);
      setJamMasuk(formatTime(new Date()));
      setNamaTamu('');
      setInstansiAsal('');
      setKategori('UMUM');
      setNoHp('');
      setNomorIdentitas('');
      setNomorBadge(`TAMU-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`);
      setTujuanBertemu(teachers[0]?.fullName || 'Kepala Sekolah');
      setKeperluan('');
      setFotoUrl(undefined);
      setCatatanPetugas('');
    }
  }, [isOpen, teachers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        tanggal,
        jamMasuk,
        namaTamu,
        instansiAsal,
        kategori,
        noHp,
        nomorIdentitas,
        nomorBadge,
        tujuanBertemu,
        keperluan,
        fotoUrl,
        status: 'SEDANG_BERKUNJUNG',
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
      <Modal isOpen={isOpen} onClose={onClose} title="Registrasi Tamu Masuk (Check-In)" maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Nama Tamu & Instansi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Nama Lengkap Tamu</span>
              </label>
              <input
                required
                value={namaTamu}
                onChange={(e) => setNamaTamu(e.target.value)}
                placeholder="Contoh: Ir. Hendra Gunawan"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-500" />
                <span>Instansi / Lembaga Asal</span>
              </label>
              <input
                required
                value={instansiAsal}
                onChange={(e) => setInstansiAsal(e.target.value)}
                placeholder="Contoh: Dinas Pendidikan / Orang Tua Siswa"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Row 2: Kategori, No HP, No Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Kategori Tamu</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as VisitorCategory)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="DINAS_INSTANSI">🏢 Dinas / Instansi Pemerintah</option>
                <option value="ORANG_TUA">👨‍👩‍👧 Orang Tua / Wali Siswa</option>
                <option value="VENDOR_MITRA">🚚 Mitra / Vendor / Supplier</option>
                <option value="ALUMNI">🎓 Alumni Sekolah</option>
                <option value="UMUM">👤 Tamu Umum</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>No. WhatsApp Tamu</span>
              </label>
              <input
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="081234567890"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                <span>Nomor Badge Tamu</span>
              </label>
              <input
                required
                value={nomorBadge}
                onChange={(e) => setNomorBadge(e.target.value)}
                placeholder="TAMU-01"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center"
              />
            </div>
          </div>

          {/* Row 3: Pihak yang Dituju & No Identitas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Pihak / Guru yang Dituju</span>
              </label>
              <input
                required
                value={tujuanBertemu}
                onChange={(e) => setTujuanBertemu(e.target.value)}
                placeholder="Nama Guru / Kepala Sekolah / Staf..."
                list="teachers-list"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <datalist id="teachers-list">
                <option value="Dr. Hj. Siti Rohmah, M.Pd. (Kepala Sekolah)" />
                {teachers.map((t) => (
                  <option key={t.id} value={`${t.fullName} (${t.mataPelajaran})`} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>No. KTP / SIM / Kartu Identitas</span>
              </label>
              <input
                value={nomorIdentitas}
                onChange={(e) => setNomorIdentitas(e.target.value)}
                placeholder="Contoh: 3174051203800002"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 4: Keperluan Kunjungan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Maksud & Keperluan Kunjungan
            </label>
            <textarea
              required
              rows={2}
              value={keperluan}
              onChange={(e) => setKeperluan(e.target.value)}
              placeholder="Jelaskan secara singkat keperluan kunjungan tamu..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Foto Bukti Tamu / KTP */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span>Foto Wajah / Dokumen Identitas Tamu</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                onClick={() => setIsCameraOpen(true)}
              >
                {fotoUrl ? 'Ambil Ulang Foto' : '+ Ambil Foto Tamu'}
              </Button>
            </div>

            {fotoUrl && (
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={fotoUrl} alt="Foto Tamu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotoUrl(undefined)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} leftIcon={<UserCheck className="w-4 h-4" />}>
              Check-In & Berikan Badge
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
