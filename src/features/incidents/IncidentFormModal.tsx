import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import {
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
  IncidentPhoto,
} from '../../types/incident.types';
import { IncidentCategoryRecord } from '../../types/master.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import {
  AlertTriangle,
  Camera,
  Upload,
  Trash2,
  User,
  MapPin,
  Clock,
  Shield,
  FileText,
} from 'lucide-react';

interface IncidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: IncidentRecord) => Promise<void>;
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
  const { currentUser } = useAuth();

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [waktu, setWaktu] = useState<string>(formatTime(new Date()));
  const [kategori, setKategori] = useState<string>('SISWA');
  const [tingkatKeparahan, setTingkatKeparahan] = useState<IncidentSeverity>('SEDANG');
  const [lokasi, setLokasi] = useState<string>('');
  const [pihakTerlibat, setPihakTerlibat] = useState<string>('');
  const [uraian, setUraian] = useState<string>('');
  const [tindakanAwal, setTindakanAwal] = useState<string>('');
  const [tindakLanjut, setTindakLanjut] = useState<string>('');
  const [status, setStatus] = useState<IncidentStatus>('BARU');
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (editingIncident) {
      setTanggal(editingIncident.tanggal);
      setWaktu(editingIncident.waktu);
      setKategori(editingIncident.kategori);
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
      setKategori(categories[0]?.code || 'SISWA');
      setTingkatKeparahan('SEDANG');
      setLokasi('');
      setPihakTerlibat('');
      setUraian('');
      setTindakanAwal('');
      setTindakLanjut('');
      setStatus('BARU');
      setPhotos([]);
    }
  }, [editingIncident, categories, isOpen]);

  const handleAddPhoto = (imageDataUrl: string) => {
    const newPhoto: IncidentPhoto = {
      id: `photo-${Date.now()}`,
      url: imageDataUrl,
      uploadedAt: new Date().toISOString(),
    };
    setPhotos([...photos, newPhoto]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(photos.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCat = categories.find((c) => c.code === kategori);

    const payload: IncidentRecord = {
      id: editingIncident ? editingIncident.id : `inc-${tanggal}-${Date.now()}`,
      tanggal,
      waktu,
      kategori,
      kategoriName: selectedCat ? selectedCat.name : kategori,
      tingkatKeparahan,
      lokasi,
      pihakTerlibat,
      uraian,
      tindakanAwal,
      tindakLanjut,
      penanggungJawab: editingIncident ? editingIncident.penanggungJawab : currentUser?.fullName || 'Petugas Piket',
      status,
      photos,
      createdAt: editingIncident ? editingIncident.createdAt : new Date().toISOString(),
      createdBy: editingIncident ? editingIncident.createdBy : currentUser?.fullName || 'Petugas',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'Petugas',
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
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
        title={editingIncident ? 'Ubah Laporan Kejadian' : 'Lapor Kejadian / Insiden Baru'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header Row: Waktu, Kategori, Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Waktu Kejadian</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
                <input
                  type="text"
                  required
                  value={waktu}
                  onChange={(e) => setWaktu(e.target.value)}
                  placeholder="08:30"
                  className="w-24 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Kategori Kejadian</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
              >
                {categories.map((cat) => (
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

          {/* Lokasi & Pihak Terlibat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Lokasi Kejadian di Sekolah</span>
              </label>
              <input
                type="text"
                required
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                placeholder="Contoh: Lapangan Olahraga / Gerbang Depan / Toilet Lt. 2"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                <span>Pihak / Siswa yang Terlibat</span>
              </label>
              <input
                type="text"
                required
                value={pihakTerlibat}
                onChange={(e) => setPihakTerlibat(e.target.value)}
                placeholder="Contoh: Riko & Dimas (Kelas XI MIPA 1) / Orang Tua Siswa"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Uraian Kejadian */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Uraian Kronologis Kejadian
            </label>
            <textarea
              required
              rows={3}
              value={uraian}
              onChange={(e) => setUraian(e.target.value)}
              placeholder="Ceritakan kronologi singkat kejadian secara objektif dan jelas..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Tindakan Awal Petugas Piket */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Tindakan Penanganan Awal oleh Petugas Piket
            </label>
            <textarea
              required
              rows={2}
              value={tindakanAwal}
              onChange={(e) => setTindakanAwal(e.target.value)}
              placeholder="Tindakan pertama yang dilakukan (misal: evakuasi ke UKS, amankan pihak terlibat, dll)..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Tindak Lanjut & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tindak Lanjut / Rujukan Kasus
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
                className="text-xs"
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
                Belum ada foto dokumentasi kejadian terlampir.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
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
