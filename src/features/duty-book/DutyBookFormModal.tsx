import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { DutyBookStatus, ScheduleItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate, getCurrentDayName } from '../../utils/dateUtils';
import {
  Save,
  Send,
  CheckCircle2,
  CheckCheck,
  Lock,
  Unlock,
  AlertCircle,
  Sparkles,
  Shield,
  Trash2,
} from 'lucide-react';

interface DutyBookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DutyBookRecord) => Promise<void>;
  onStatusChange: (record: DutyBookRecord, newStatus: DutyBookStatus, note?: string) => Promise<void>;
  onUnlock?: (record: DutyBookRecord, reason: string) => Promise<void>;
  dutyBook: DutyBookRecord | null;
  schedules: ScheduleItem[];
}

export const DutyBookFormModal: React.FC<DutyBookFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onStatusChange,
  onUnlock,
  dutyBook,
  schedules,
}) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const isKepsek = hasRole('KEPALA_SEKOLAH');

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hari, setHari] = useState<string>(getCurrentDayName());
  const [jamMulai, setJamMulai] = useState<string>('06:30');
  const [jamSelesai, setJamSelesai] = useState<string>('15:30');
  const [scheduleId, setScheduleId] = useState<string>('');
  const [petugasName, setPetugasName] = useState<string>('');
  const [ruangName, setRuangName] = useState<string>('');

  // 7 Sections
  const [kondisiKeamanan, setKondisiKeamanan] = useState<string>('');
  const [kondisiKebersihan, setKondisiKebersihan] = useState<string>('');
  const [kondisiKelas, setKondisiKelas] = useState<string>('');
  const [kondisiFasilitas, setKondisiFasilitas] = useState<string>('');
  const [kondisiSiswa, setKondisiSiswa] = useState<string>('');
  const [kegiatanKhusus, setKegiatanKhusus] = useState<string>('');
  const [catatanPiket, setCatatanPiket] = useState<string>('');
  const [tindakLanjut, setTindakLanjut] = useState<string>('');

  const [status, setStatus] = useState<DutyBookStatus>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<boolean>(false);

  const isLocked = status === 'DIKUNCI';
  const isReadOnly = isLocked && !isAdmin;

  useEffect(() => {
    if (dutyBook) {
      setTanggal(dutyBook.tanggal);
      setHari(dutyBook.hari);
      setJamMulai(dutyBook.jamMulai);
      setJamSelesai(dutyBook.jamSelesai);
      setScheduleId(dutyBook.scheduleId);
      setPetugasName(dutyBook.petugasName);
      setRuangName(dutyBook.ruangName);
      setKondisiKeamanan(dutyBook.kondisiKeamanan || '');
      setKondisiKebersihan(dutyBook.kondisiKebersihan || '');
      setKondisiKelas(dutyBook.kondisiKelas || '');
      setKondisiFasilitas(dutyBook.kondisiFasilitas || '');
      setKondisiSiswa(dutyBook.kondisiSiswa || '');
      setKegiatanKhusus(dutyBook.kegiatanKhusus || '');
      setCatatanPiket(dutyBook.catatanPiket || '');
      setTindakLanjut(dutyBook.tindakLanjut || '');
      setStatus(dutyBook.status);
    } else {
      const todayISO = new Date().toISOString().split('T')[0];
      setTanggal(todayISO);
      setHari(getCurrentDayName());
      setJamMulai('06:30');
      setJamSelesai('15:30');
      setScheduleId(schedules[0]?.id || 'sch-general');
      setPetugasName(currentUser?.fullName || 'Petugas Piket');
      setRuangName(schedules[0]?.ruangName || 'Gerbang & Area Utama');
      setKondisiKeamanan('');
      setKondisiKebersihan('');
      setKondisiKelas('');
      setKondisiFasilitas('');
      setKondisiSiswa('');
      setKegiatanKhusus('');
      setCatatanPiket('');
      setTindakLanjut('');
      setStatus('DRAFT');
    }
  }, [dutyBook, schedules, currentUser, isOpen]);

  // Quick template helpers
  const applyStandardTemplates = () => {
    setKondisiKeamanan('Situasi keamanan gerbang dan lingkungan sekolah terpantau kondusif, aman, dan terkendali. Tamu mengisi buku tamu di pos satpam.');
    setKondisiKebersihan('Seluruh koridor, ruang kelas, toilet, dan halaman bersih dan rapi. Tempat sampah terkelola dengan baik.');
    setKondisiKelas('KBM jam ke-1 s.d ke-8 berjalan tertib. Seluruh guru hadir tepat waktu sesuai jadwal pelajaran.');
    setKondisiFasilitas('Sarana dan prasarana sekolah (listrik, air, bel, proyektor) berfungsi normal tanpa kendala.');
    setKondisiSiswa('Kedisiplinan siswa terpantau baik, tidak ada perkelahian atau pelanggaran berat.');
    setCatatanPiket('Kegiatan operasional sekolah hari ini berlangsung lancar.');
    setTindakLanjut('Lanjutkan pengawasan ketertiban seragam dan atribut upacara untuk hari esok.');
  };

  const constructPayload = (): DutyBookRecord => {
    return {
      id: dutyBook ? dutyBook.id : `book-${tanggal}-${Date.now()}`,
      scheduleId,
      tanggal,
      hari,
      jamMulai,
      jamSelesai,
      petugasId: dutyBook?.petugasId || currentUser?.id || 'usr-001',
      petugasName,
      petugasRole: 'GURU',
      ruangName,
      kondisiKeamanan,
      kondisiKebersihan,
      kondisiKelas,
      kondisiFasilitas,
      kondisiSiswa,
      kegiatanKhusus,
      catatanPiket,
      tindakLanjut,
      status,
      createdAt: dutyBook?.createdAt || new Date().toISOString(),
      createdBy: dutyBook?.createdBy || currentUser?.fullName || 'Petugas',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || 'Petugas',
    };
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = constructPayload();
      await onSave(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus: DutyBookStatus) => {
    setIsSubmitting(true);
    try {
      const payload = constructPayload();
      await onStatusChange(payload, nextStatus);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteUnlock = async () => {
    if (!dutyBook || !onUnlock || !unlockReason) return;
    setIsSubmitting(true);
    try {
      await onUnlock(dutyBook, unlockReason);
      setShowUnlockPrompt(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Buku Piket Digital — ${formatIndonesianDate(tanggal)}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSaveDraft} className="space-y-6">
        {/* Status Pipeline Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Badge
              variant={
                status === 'DIKUNCI'
                  ? 'neutral'
                  : status === 'DISETUJUI'
                  ? 'success'
                  : status === 'DIVERIFIKASI'
                  ? 'info'
                  : status === 'DIAJUKAN'
                  ? 'warning'
                  : 'primary'
              }
              size="md"
              icon={status === 'DIKUNCI' ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            >
              Tahapan: {status}
            </Badge>
            <span className="text-xs text-slate-500 font-medium">
              Petugas: <strong>{petugasName}</strong>
            </span>
          </div>

          {!isLocked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              onClick={applyStandardTemplates}
            >
              Isi Format Standar Otomatis
            </Button>
          )}
        </div>

        {/* Locked Warning */}
        {isLocked && (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Dokumen buku piket ini telah <strong>DIKUNCI</strong> dan bersifat permanen (arsip resmi).</span>
            </div>
            {isAdmin && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="text-xs"
                leftIcon={<Unlock className="w-3.5 h-3.5" />}
                onClick={() => setShowUnlockPrompt(true)}
              >
                Buka Kunci (Admin)
              </Button>
            )}
          </div>
        )}

        {/* Unlock Reason Prompt */}
        {showUnlockPrompt && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in duration-150">
            <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200">
              Konfirmasi Pembukaan Kunci Dokumen Arsip
            </h5>
            <input
              type="text"
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Masukkan alasan pembukaan kunci (Wajib untuk audit log)..."
              className="w-full p-2.5 rounded-xl border border-rose-300 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowUnlockPrompt(false)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={!unlockReason}
                onClick={handleExecuteUnlock}
              >
                Buka Kunci Sekarang
              </Button>
            </div>
          </div>
        )}

        {/* 7 JURNAL SECTIONS */}
        <div className="space-y-4">
          {/* 1. Keamanan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>1. Kondisi Keamanan & Ketertiban Sekolah</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              disabled={isReadOnly}
              value={kondisiKeamanan}
              onChange={(e) => setKondisiKeamanan(e.target.value)}
              placeholder="Catatan gerbang, tamu luar, pos keamanan, ketertiban umum..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 2. Kebersihan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>2. Kondisi Kebersihan Lingkungan & Kantin</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              disabled={isReadOnly}
              value={kondisiKebersihan}
              onChange={(e) => setKondisiKebersihan(e.target.value)}
              placeholder="Kondisi halaman, koridor, toilet, pengelolaan sampah kantin..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 3. Kelas & KBM */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>3. Kondisi KBM & Kehadiran Guru Pengajar</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              disabled={isReadOnly}
              value={kondisiKelas}
              onChange={(e) => setKondisiKelas(e.target.value)}
              placeholder="Kelancaran jam KBM, guru izin/berhalangan hadir, penugasan mandiri..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 4. Fasilitas & Sarpras */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>4. Kondisi Sarana, Prasarana & Fasilitas</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              disabled={isReadOnly}
              value={kondisiFasilitas}
              onChange={(e) => setKondisiFasilitas(e.target.value)}
              placeholder="Kondisi kelistrikan, proyektor, kran air, kunci kelas, fasilitas lab..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 5. Siswa */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>5. Kedisiplinan & Perilaku Siswa</span>
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              disabled={isReadOnly}
              value={kondisiSiswa}
              onChange={(e) => setKondisiSiswa(e.target.value)}
              placeholder="Siswa terlambat, izin keluar gerbang, seragam, kedisiplinan..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 6. Kegiatan Khusus */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              6. Kegiatan Khusus Sekolah (Opsional)
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={kegiatanKhusus}
              onChange={(e) => setKegiatanKhusus(e.target.value)}
              placeholder="Contoh: Upacara Hari Senin, Senam Pagi, Kunjungan Dinas Pengawas..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-70 disabled:bg-slate-50"
            />
          </div>

          {/* 7. Catatan Kesimpulan & Tindak Lanjut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Catatan Kesimpulan Piket
              </label>
              <textarea
                rows={2}
                disabled={isReadOnly}
                value={catatanPiket}
                onChange={(e) => setCatatanPiket(e.target.value)}
                placeholder="Kesimpulan umum shift piket hari ini..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-70 disabled:bg-slate-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tindak Lanjut / Rekomendasi Esok Hari
              </label>
              <textarea
                rows={2}
                disabled={isReadOnly}
                value={tindakLanjut}
                onChange={(e) => setTindakLanjut(e.target.value)}
                placeholder="Rekomendasi untuk shift piket esok hari..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs disabled:opacity-70 disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* WORKFLOW ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Draft Save */}
            {!isLocked && (
              <Button
                type="submit"
                variant="outline"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Simpan Draft
              </Button>
            )}

            {/* Advance to DIAJUKAN */}
            {status === 'DRAFT' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                onClick={() => handleAdvanceStatus('DIAJUKAN')}
              >
                Ajukan Jurnal
              </Button>
            )}

            {/* Advance to DIVERIFIKASI */}
            {status === 'DIAJUKAN' && (isAdmin || isKepsek) && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={() => handleAdvanceStatus('DIVERIFIKASI')}
              >
                Verifikasi Jurnal
              </Button>
            )}

            {/* Advance to DISETUJUI */}
            {status === 'DIVERIFIKASI' && (isAdmin || isKepsek) && (
              <Button
                type="button"
                variant="success"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                onClick={() => handleAdvanceStatus('DISETUJUI')}
              >
                Setujui Jurnal (Kepsek)
              </Button>
            )}

            {/* Advance to DIKUNCI */}
            {status === 'DISETUJUI' && isAdmin && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={isSubmitting}
                leftIcon={<Lock className="w-3.5 h-3.5" />}
                onClick={() => handleAdvanceStatus('DIKUNCI')}
              >
                Kunci Arsip Permanen
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
