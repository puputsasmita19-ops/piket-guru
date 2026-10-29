import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { AdminAttendanceService, isoToWibTime, readAttendanceAuditTrail } from '../../services/firebase/adminAttendanceService';
import { MISSING_CHECKOUT_EVIDENCE_LABELS, type MissingCheckoutEvidenceChannel } from '../../utils/missedCheckoutCorrectionPolicy';
import { verifyMissingCheckoutCandidate } from '../../services/firebase/missingCheckoutService';
import { getTodayISODate } from '../../utils/dateUtils';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

type AttendanceAction = 'edit' | 'delete';
export type AdminAttendanceSelection = { record: AttendanceRecord; mode: AttendanceAction; source?: 'missing-checkout' };

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
  const [evidenceChannel, setEvidenceChannel] = useState<MissingCheckoutEvidenceChannel | ''>('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [attested, setAttested] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditEntries, setAuditEntries] = useState<Awaited<ReturnType<typeof readAttendanceAuditTrail>> | null>(null);

  useEffect(() => {
    setJamMasuk(record ? isoToWibTime(record.jamMasuk) : '');
    setJamPulang(record ? isoToWibTime(record.jamPulang) : '');
    setStatus(record?.status || 'DALAM_LOKASI');
    setKeterangan(record?.keteranganCheckout || '');
    setReason(''); setError(''); setBusy(false);
    setEvidenceChannel(''); setEvidenceNote(''); setAttested(false);
    setAuditExpanded(false); setAuditBusy(false); setAuditError(''); setAuditEntries(null);
  }, [record?.id, record?.updatedAt, selection?.mode]);

  if (!record || !selection || !hasRole('ADMIN')) return null;

  const isMissing = selection.source === 'missing-checkout';
  const loadAudit = async () => {
    if (auditBusy || !currentUser || isOffline) return;
    if (auditExpanded) { setAuditExpanded(false); return; }
    setAuditExpanded(true); setAuditBusy(true); setAuditError('');
    try { setAuditEntries(await readAttendanceAuditTrail(record.id, currentUser.id)); }
    catch (cause) { setAuditEntries(null); setAuditError(cause instanceof Error ? cause.message : 'Gagal membaca audit.'); }
    finally { setAuditBusy(false); }
  };

  const submit = async () => {
    if (!currentUser || busy || isOffline) return;
    setBusy(true); setError('');
    try {
      if (selection.source === 'missing-checkout') {
        // Recheck once more immediately before the audited transaction.
        await verifyMissingCheckoutCandidate(currentUser.id, record, getTodayISODate());
      }
      await AdminAttendanceService.change(record, {
        jamMasuk, jamPulang: jamPulang || null, status, keteranganCheckout: keterangan, alasan: reason,
        ...(isMissing ? { missingCheckoutEvidence: {
          channel: evidenceChannel as MissingCheckoutEvidenceChannel, note: evidenceNote, acknowledged: attested,
        } } : {}),
      }, selection.mode, currentUser.fullName);
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
      <button type="button" disabled={busy || isOffline || reason.trim().length < 10 || reason.trim().length > 500 || (isMissing && (!jamPulang || !evidenceChannel || evidenceNote.trim().length < 10 || evidenceNote.trim().length > 300 || !attested))}
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
      {isMissing && <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
        <p className="font-bold">Koreksi checkout terlewat (bukan checkout otomatis)</p>
        <p>Waktu pulang harus diketahui dari bukti/konfirmasi, bukan perkiraan. Tanyakan kepada guru dan periksa antrean sinkronisasi offline sebelum mengisi.</p>
        <p>Jam masuk, status GPS dan bukti asli tidak dapat diubah melalui koreksi ini.</p>
      </div>}
      {selection.mode === 'edit' ? <>
        <p className="text-xs text-slate-600 dark:text-slate-300">Koreksi waktu dan status administrasi saja. Identitas, tanggal, bukti foto serta koordinat GPS asli tetap dipertahankan. Perubahan dicatat dalam audit.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold space-y-1.5">Jam masuk (WIB) <input aria-label="Jam masuk" readOnly={isMissing} className={`${inputClass} ${isMissing ? 'opacity-65 cursor-not-allowed' : ''}`} type="time" value={jamMasuk} onChange={e => { if (!isMissing) setJamMasuk(e.target.value); }} /></label>
          <label className="text-xs font-bold space-y-1.5">Jam pulang (WIB) <input aria-label="Jam pulang" className={inputClass} type="time" value={jamPulang} onChange={e => setJamPulang(e.target.value)} /></label>
        </div>
        <p className="text-[11px] text-slate-500">{isMissing ? 'Jam pulang wajib diisi dengan jam yang dikonfirmasi untuk tanggal ini (WIB), setelah jam masuk. Jika belum ada bukti, jangan koreksi.' : 'Kosongkan jam pulang jika presensi pulang belum terjadi. Waktu pulang harus setelah masuk pada tanggal yang sama.'}</p>
        <label className="block text-xs font-bold space-y-1.5">Status presensi (koreksi manual)
          <select value={status} disabled={isMissing} className={inputClass} onChange={e => setStatus(e.target.value as AttendanceStatus)}>
            <option value="DALAM_LOKASI">Dalam Lokasi</option>
            <option value="DI_LUAR_LOKASI">Di Luar Lokasi</option>
            <option value="GPS_ERROR">GPS Error</option>
            <option value="AKURASI_RENDAH">Akurasi Rendah</option>
          </select>
        </label>
        {isMissing && <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <p className="text-sm font-bold">Verifikasi sumber jam pulang</p>
          <label className="block text-xs font-bold space-y-1.5">Sumber konfirmasi <span className="text-rose-600">*</span>
            <select className={inputClass} value={evidenceChannel} onChange={e => setEvidenceChannel(e.target.value as MissingCheckoutEvidenceChannel | '')}>
              <option value="">Pilih sumber bukti…</option>
              {Object.entries(MISSING_CHECKOUT_EVIDENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold space-y-1.5">Catatan konfirmasi (tanpa data sensitif) <span className="text-rose-600">*</span>
            <textarea className={inputClass} rows={2} maxLength={300} value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)} placeholder="Contoh: Guru mengonfirmasi jam 15.10 WIB pada 29/10, tidak ada antrean sinkronisasi aktif." />
            <span className="block text-[11px] text-slate-500">{evidenceNote.trim().length}/300 · minimal 10 karakter</span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed cursor-pointer">
            <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Saya sudah memeriksa sumber jam pulang dan mengonfirmasi tidak ada checkout guru yang masih menunggu sinkronisasi. Data yang dimasukkan adalah koreksi administratif, bukan rekaman presensi GPS asli.</span>
          </label>
        </div>}
        <label className="block text-xs font-bold space-y-1.5">Keterangan presensi / pulang
          <textarea className={inputClass} rows={2} maxLength={500} value={keterangan} onChange={e => setKeterangan(e.target.value)} />
        </label>
      </> : <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">Penghapusan permanen menghilangkan presensi dari rekap dan statistik. Jejak audit tetap tersimpan. Tindakan ini tidak dapat dibatalkan otomatis.</p>}
      <label className="block text-xs font-bold space-y-1.5">Alasan {selection.mode === 'delete' ? 'penghapusan' : 'koreksi'} <span className="text-rose-600">*</span>
        <textarea className={inputClass} rows={3} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="Tuliskan alasan yang jelas (minimal 10 karakter)…" />
        <span className="block text-[11px] text-slate-500">{reason.trim().length}/500 · Wajib 10–500 karakter</span>
      </label>
      <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
        <button type="button" onClick={() => void loadAudit()} disabled={auditBusy || isOffline} aria-expanded={auditExpanded} className="text-xs font-semibold text-sky-700 dark:text-sky-300 underline disabled:opacity-50">
          {auditExpanded ? 'Tutup Jejak Audit' : 'Lihat Jejak Audit Presensi (Server)'}
        </button>
        {auditExpanded && <div className="max-h-56 overflow-y-auto space-y-2 text-xs">
          {auditBusy && <p role="status">Memuat jejak audit dari server…</p>}
          {auditError && <p role="alert" className="text-rose-700">{auditError}</p>}
          {auditEntries && !auditEntries.length && <p className="text-slate-500">Belum ada koreksi Admin pada catatan ini.</p>}
          {auditEntries?.map(entry => <div key={entry.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 space-y-1">
            <p className="font-bold">{entry.action === 'DELETE' ? 'Penghapusan' : 'Koreksi'} · {entry.userName} · {entry.timestamp ? formatIndonesianDate(entry.timestamp) : '-'} {entry.timestamp ? formatTime(entry.timestamp) : ''}</p>
            <p>Alasan: {String(entry.metadata.alasan || '-')}</p>
            <p>Masuk: {formatTime(entry.metadata.before?.jamMasuk)} → {formatTime(entry.metadata.after?.jamMasuk)}</p>
            <p>Pulang: {formatTime(entry.metadata.before?.jamPulang)} → {formatTime(entry.metadata.after?.jamPulang)}</p>
            {entry.metadata.missingCheckoutEvidence && <p>Konfirmasi: {MISSING_CHECKOUT_EVIDENCE_LABELS[entry.metadata.missingCheckoutEvidence.channel as MissingCheckoutEvidenceChannel] || '-'} · {String(entry.metadata.missingCheckoutEvidence.note || '-')}</p>}
            <p className="break-all text-slate-500">Audit ID: {entry.id}</p>
          </div>)}
          {auditEntries && auditEntries.length >= 100 && <p className="text-amber-700">Hasil dibatasi 100 log. Gunakan Audit Log Sistem untuk penelusuran penuh.</p>}
        </div>}
      </div>
      {isOffline && <p className="text-xs text-amber-700" role="alert">Anda sedang offline. Edit/hapus hanya dapat dilakukan secara online.</p>}
      {error && <p role="alert" className="text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  </Modal>;
};
