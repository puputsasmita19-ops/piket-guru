import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentRecord } from '../../types/master.types';
import { User, Phone, MapPin, Hash, Sparkles } from 'lucide-react';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: {
    id?: string;
    nisn: string;
    nama: string;
    kelas: string;
    jenisKelamin: 'L' | 'P';
    noHpOrangTua: string;
    alamat?: string;
    isActive: boolean;
  }) => Promise<void>;
  editingStudent: StudentRecord | null;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStudent,
}) => {
  const [nisn, setNisn] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('X MIPA 1');
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L');
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [alamat, setAlamat] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingStudent) {
      setNisn(editingStudent.nisn || '');
      setNama(editingStudent.nama || '');
      setKelas(editingStudent.kelas || 'X MIPA 1');
      setJenisKelamin(editingStudent.jenisKelamin || 'L');
      setNoHpOrangTua(editingStudent.noHpOrangTua || '');
      setAlamat(editingStudent.alamat || '');
      setIsActive(editingStudent.isActive !== false);
    } else {
      setNisn('');
      setNama('');
      setKelas('X MIPA 1');
      setJenisKelamin('L');
      setNoHpOrangTua('');
      setAlamat('');
      setIsActive(true);
    }
    setError(null);
  }, [editingStudent, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nisn.trim()) {
      setError('NISN siswa wajib diisi');
      return;
    }
    if (!nama.trim()) {
      setError('Nama lengkap siswa wajib diisi');
      return;
    }
    if (!noHpOrangTua.trim()) {
      setError('Nomor HP / WhatsApp orang tua/wali wajib diisi untuk notifikasi piket');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        id: editingStudent?.id,
        nisn: nisn.trim(),
        nama: nama.trim(),
        kelas: kelas.trim(),
        jenisKelamin,
        noHpOrangTua: noHpOrangTua.trim(),
        alamat: alamat.trim(),
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data siswa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nomor Induk Siswa Nasional (NISN) *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder="Contoh: 0081234567"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Kelas / Rombongan Belajar *
            </label>
            <input
              type="text"
              required
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              placeholder="Contoh: X MIPA 1, XI IPS 2"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Nama Lengkap Siswa *
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Muhammad Rizky Pratama"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Jenis Kelamin *
            </label>
            <select
              value={jenisKelamin}
              onChange={(e) => setJenisKelamin(e.target.value as 'L' | 'P')}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No. HP / WhatsApp Wali Murid *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                required
                value={noHpOrangTua}
                onChange={(e) => setNoHpOrangTua(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Alamat Domisili Siswa (Opsional)
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <textarea
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Jl. Mawar No. 12, Kel. Sukamaju..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="student-active-toggle"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
          />
          <label htmlFor="student-active-toggle" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            Status Siswa Aktif (Dapat dicatat terlambat, izin gerbang, dll.)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
            Simpan Data Siswa
          </Button>
        </div>
      </form>
    </Modal>
  );
};
