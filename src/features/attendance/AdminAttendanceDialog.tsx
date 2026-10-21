import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { AdminAttendanceService, isoToWibTime } from '../../services/firebase/adminAttendanceService';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

type AttendanceAction = 'edit' | 'delete';
export type AdminAttendanceSelection = { record: AttendanceRecord; mode: AttendanceAction };

export const AdminAttendanceDialog: React.FC<{
  selection: AdminAttendanceSelection | null;
  onClose: () => void;
  onCompleted: (message: string) => void;
}> = ({ selection, onClose, onCompleted }) => {
  const { currentUser, hasRole, isOffline } = useAuth();
  const record = selection?.record;
  const [jamMasuk, setJamMasuk] = useState('');
  const [jamPulang, setJamPulang] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('DALAM_LOKASI');
  const [keterangan, setKeterangan] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setJamMasuk(record ? isoToWibTime(record.jamMasuk) : '');
    setJamPulang(record ? isoToWibTime(record.jamPulang) : '');
    setStatus(record?.status || 'DALAM_LOKASI');
    setKeterangan(record?.keteranganCheckout || '');
    setReason(''); setError(''); setBusy(false);
  }, [record?.id, record?.updatedAt, selection?.mode]);

  if (!record || !selection || !hasRole('ADMIN')) return null;

  const submit = async () => {
    if (!currentUser || busy || isOffline) return;
    setBusy(true); setError('');
    try {
      await AdminAttendanceService.change(record, { jamMasuk, jamPulang: jamPulang || null, status, keteranganCheckout: keterangan, alasan: reason }, selection.mode, currentUser.fullName);
      onCompleted(selection.mode === 'delete' ? 'Riwayat presensi berhasil dihapus dan diaudit.' : 'Riwayat presensi berhasil dikoreksi dan diaudit.');
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Tidak dapat menyimpan perubahan. Periksa sambungan dan izin akun.');
    } finally { setBusy(false); }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-900 dark:text-white';
  return <Modal
    isOpen={Boolean(selection)} onClose={() => { if (!busy) onClose(); }}
    title={selection.mode === 'edit' ? 'Koreksi Riwayat Presensi · Admin' : 'Konfirmasi Hapus Presensi · Admin'} maxWidth="lg"
    footer={<>
      <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 disabled:opacity-50">Batal</button>
      <button type="button" disabled={busy || isOffline || reason.trim().length < 10 || reason.trim().length > 500}
        onClick={submit} className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 ${selection.mode === 'delete' ? 'bg-rose-700' : 'bg-[var(--theme-primary)]'}`}>
        {busy ? 'Memproses…' : selection.mode === 'delete' ? 'Ya, Hapus Presensi' : 'Simpan Koreksi'}
      </button>
    </>}
  >
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed">
        <div className="font-bold text-slate-900 dark:text-white">{record.userName}</div>
        <div>{formatIndonesianDate(record.tanggal)} · Masuk {formatTime(record.jamMasuk)} · Pulang {formatTime(record.jamPulang)}</div>
        <div className="text-slate-500 break-all">ID: {record.id}</div>
      </div>
      {selection.mode === 'edit' ? <>
        <p className="text-xs text-slate-600 dark:text-slate-300">Koreksi waktu dan status administrasi saja. Identitas, tanggal, bukti foto serta koordinat GPS asli tetap dipertahankan. Perubahan dicatat dalam audit.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold space-y-1.5">Jam masuk (WIB) <input aria-label="Jam masuk" className={inputClass} type="time" value={jamMasuk} onChange={e => setJamMasuk(e.target.value)} /></label>
          <label className="text-xs font-bold space-y-1.5">Jam pulang (WIB) <input aria-label="Jam pulang" className={inputClass} type="time" value={jamPulang} onChange={e => setJamPulang(e.target.value)} /></label>
        </div>
        <p className="text-[11px] text-slate-500">Kosongkan jam pulang jika presensi pulang belum terjadi. Waktu pulang harus setelah masuk pada tanggal yang sama.</p>
        <label className="block text-xs font-bold space-y-1.5">Status presensi (koreksi manual)
          <select value={status} className={inputClass} onChange={e => setStatus(e.target.value as AttendanceStatus)}>
            <option value="DALAM_LOKASI">Dalam Lokasi</option>
            <option value="DI_LUAR_LOKASI">Di Luar Lokasi</option>
            <option value="GPS_ERROR">GPS Error</option>
            <option value="AKURASI_RENDAH">Akurasi Rendah</option>
          </select>
        </label>
        <label className="block text-xs font-bold space-y-1.5">Keterangan presensi / pulang
          <textarea className={inputClass} rows={2} maxLength={500} value={keterangan} onChange={e => setKeterangan(e.target.value)} />
        </label>
      </> : <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">Penghapusan permanen menghilangkan presensi dari rekap dan statistik. Jejak audit tetap tersimpan. Tindakan ini tidak dapat dibatalkan otomatis.</p>}
      <label className="block text-xs font-bold space-y-1.5">Alasan {selection.mode === 'delete' ? 'penghapusan' : 'koreksi'} <span className="text-rose-600">*</span>
        <textarea className={inputClass} rows={3} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="Tuliskan alasan yang jelas (minimal 10 karakter)…" />
        <span className="block text-[11px] text-slate-500">{reason.trim().length}/500 · Wajib 10–500 karakter</span>
      </label>
      {isOffline && <p className="text-xs text-amber-700" role="alert">Anda sedang offline. Edit/hapus hanya dapat dilakukan secara online.</p>}
      {error && <p role="alert" className="text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  </Modal>;
};
