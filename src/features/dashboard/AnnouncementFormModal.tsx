import { DialogForm } from '../../components/common/DialogForm';
import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { AnnouncementPriority, AnnouncementRecord, AnnouncementSaveInput } from '../../types/announcement.types';
import { Megaphone, Save } from '../../components/icons';

interface AnnouncementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AnnouncementRecord | null;
  onSave: (data: AnnouncementSaveInput) => Promise<void>;
}

export const AnnouncementFormModal: React.FC<AnnouncementFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('INFO');
  const [targetRole, setTargetRole] = useState('SEMUA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialData?.title || ''); setContent(initialData?.content || '');
    setPriority(initialData?.priority || 'INFO'); setTargetRole(initialData?.targetRole || 'SEMUA'); setError('');
  }, [isOpen, initialData]);
  const close = () => { if (!submitting.current) onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!title.trim() || !content.trim()) { setError('Judul dan isi pengumuman wajib diisi.'); return; }
    submitting.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await onSave({ title, content, priority, targetRole, ...(initialData ? { id: initialData.id, expectedState: { updatedAt: initialData.updatedAt } } : {}) });
      onClose();
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      setError(code.includes('permission-denied')
        ? 'Penyimpanan ditolak. Periksa izin akun, pengaturan edit, dan Firestore Rules terbaru.'
        : code.includes('unavailable') || code.includes('failed-precondition')
          ? 'Pengumuman belum tersimpan. Periksa koneksi internet, lalu coba lagi. Isian Anda tetap tersedia.'
          : error instanceof Error ? error.message : 'Pengumuman gagal disimpan. Silakan coba lagi.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={initialData ? 'Edit Pengumuman' : 'Buat Pengumuman Papan Informasi Piket'}
      maxWidth="md"
    >
      <DialogForm onSubmit={handleSubmit} className="space-y-4" actions={<div className="app-form-actions flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={initialData ? <Save className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
          >
            {initialData ? 'Simpan Perubahan' : 'Publikasikan Informasi'}
          </Button>
        </div>}>
        {initialData && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Perubahan diterapkan pada pengumuman yang sama dan diterima pengguna online tanpa memuat ulang halaman.</p>}
        {error && <p role="alert" tabIndex={-1} className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 text-sm leading-relaxed">{error}</p>}
        <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-60">
        <div className="space-y-1">
          <label htmlFor="announcement-title" className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Judul Informasi / Instruksi
          </label>
          <input
            required
            id="announcement-title"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Kunjungan Pengawas Dinas Pendidikan..."
            className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-base sm:text-sm focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="announcement-priority" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Tingkat Prioritas
            </label>
            <select
              id="announcement-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-base sm:text-sm"
            >
              <option value="INFO">Informasi</option>
              <option value="PENTING">Penting</option>
              <option value="DARURAT">Darurat</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="announcement-target" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Sasaran Petugas
            </label>
            <select
              id="announcement-target"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-base sm:text-sm"
            >
              <option value="SEMUA">Semua Petugas</option>
              <option value="GURU">Guru Piket</option>
              <option value="TENDIK">Tendik / TU</option>
              <option value="SATPAM">Satpam / Gerbang</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="announcement-content" className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Isi Pengumuman / Catatan Arahan
          </label>
          <textarea
            required
            id="announcement-content"
            maxLength={10000}
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tuliskan arahan, pesan, atau instruksi khusus untuk tim piket..."
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-base sm:text-sm focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none leading-relaxed"
          />
        </div>
        </fieldset>
      </DialogForm>
    </Modal>
  );
};
