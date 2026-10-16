import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentRecord } from '../../types/master.types';
import { User, Phone, Smartphone, MapPin, Hash, Sparkles } from '../../components/icons';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: {
    id?: string;
    studentId?: string;
    nis?: string;
    nisn?: string;
    nama: string;
    kelas: string;
    jenisKelamin: 'L' | 'P';
    noHpOrangTua: string;
    noHpSiswa?: string;
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
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L');
  const [noHpOrangTua, setNoHpOrangTua] = useState('');
  const [noHpSiswa, setNoHpSiswa] = useState('');
  const [alamat, setAlamat] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingStudent) {
      setNis(editingStudent.nis || '');
      setNisn(editingStudent.nisn || '');
      setNama(editingStudent.nama || '');
      setKelas(editingStudent.kelas || '');
      setJenisKelamin(editingStudent.jenisKelamin || 'L');
      setNoHpOrangTua(editingStudent.noHpOrangTua || '');
      setNoHpSiswa(editingStudent.noHpSiswa || '');
      setAlamat(editingStudent.alamat || '');
      setIsActive(editingStudent.isActive !== false);
    } else {
      setNis('');
      setNisn('');
      setNama('');
      setKelas('');
      setJenisKelamin('L');
      setNoHpOrangTua('');
      setNoHpSiswa('');
      setAlamat('');
      setIsActive(true);
    }
    setError(null);
  }, [editingStudent, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setError('Nama lengkap siswa wajib diisi');
      return;
    }
    if (!kelas.trim()) {
      setError('Kelas / Rombel wajib diisi');
      return;
    }

    const cleanNisn = nisn.trim();
    if (cleanNisn && !/^\d{10}$/.test(cleanNisn)) {
      setError('NISN nasional wajib tepat 10 digit angka (contoh: 0081234567). Jika memiliki format nomor seperti 1481/080.531, masukkan ke kolom NIS Sekolah.');
      return;
    }

    if (!noHpOrangTua.trim()) {
      setError('Nomor HP / WhatsApp orang tua/wali wajib diisi untuk notifikasi piket');
      return;
    }

    // Validate noHpSiswa if provided
    const cleanNoHpSiswa = noHpSiswa.trim();
    if (cleanNoHpSiswa) {
      const phoneRegex = /^(\+62|62|0)8[0-9]{7,13}$/;
      if (!phoneRegex.test(cleanNoHpSiswa)) {
        setError('Format Nomor HP Siswa tidak valid. Gunakan awalan 08... atau +62... (contoh: 081234567890)');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        id: editingStudent?.id,
        studentId: editingStudent?.studentId,
        nis: nis.trim() || undefined,
        nisn: cleanNisn || undefined,
        nama: nama.trim(),
        kelas: kelas.trim(),
        jenisKelamin,
        noHpOrangTua: noHpOrangTua.trim(),
        noHpSiswa: cleanNoHpSiswa || '',
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                NIS (Nomor Induk Sekolah)
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">(Opsional)</span>
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Contoh: 1481/080.531"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                NISN (Identitas Nasional)
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">(10 Digit, Opsional)</span>
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder="Tepat 10 digit, e.g. 0081234567"
                maxLength={10}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>
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
              placeholder="Contoh: X-A, XI-MIPA-1"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nomor HP Siswa
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">(Opsional)</span>
            </div>
            <div className="relative">
              <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={noHpSiswa}
                onChange={(e) => setNoHpSiswa(e.target.value)}
                placeholder="0812xxxxxxxx atau +62..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400">Format 08... atau +62... Kosongkan jika siswa tidak memiliki HP.</p>
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
            <p className="text-[10px] text-slate-400">Kontak utama notifikasi & perizinan wali.</p>
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
