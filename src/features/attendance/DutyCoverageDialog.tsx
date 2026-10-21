import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { ScheduleItem, UserProfile } from '../../types';
import { DutyCoverageService, validateDutyCoverage } from '../../services/firebase/dutyCoverageService';
import { dutyCoverageId } from '../../utils/scheduleUtils';

interface Props {
  source: ScheduleItem | null;
  dateISO: string;
  allSchedules: ScheduleItem[];
  users: UserProfile[];
  actorName: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export const DutyCoverageDialog: React.FC<Props> = ({ source, dateISO, allSchedules, users, actorName, onClose, onSaved }) => {
  const [reason, setReason] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const existing = source ? allSchedules.find(s => s.id === dutyCoverageId(dateISO, source.id)) : undefined;
  const candidates = useMemo(() => users.filter(u => u.isActive === true && u.requiresActivation !== true &&
    ['GURU', 'TENAGA_KEPENDIDIKAN', 'ADMIN', 'KEPALA_SEKOLAH'].includes(u.role) && u.id !== source?.petugasId)
    .sort((a,b) => a.fullName.localeCompare(b.fullName, 'id-ID')), [users, source?.petugasId]);
  const replacementOptions = useMemo(() => [
    { value: '', label: 'Belum ada — Menunggu Pengganti', description: 'Tetapkan pengganti nanti' },
    ...candidates.map(user => ({
      value: user.id,
      label: user.fullName,
      description: user.role.replaceAll('_', ' '),
      keywords: [user.loginId, user.nip, user.nuptk].filter(Boolean).join(' '),
    })),
  ], [candidates]);
  const chosenOfficer = useMemo(() => users.find(user => user.id === replacementId), [users, replacementId]);

  useEffect(() => {
    if (!source) return;
    const previous = allSchedules.find(s => s.id === dutyCoverageId(dateISO, source.id));
    setReason(previous?.absenceReason || '');
    setReplacementId(previous?.status !== 'DIBATALKAN' ? previous?.petugasId || '' : '');
    setError(''); setBusy(false); setConfirmRestore(false);
  }, [source?.id, dateISO]);

  const save = async () => {
    if (!source || busy) return;
    setBusy(true); setError('');
    try {
      const input = { source, dateISO, reason, replacementUserId: replacementId, actorName, allSchedules, users };
      validateDutyCoverage(input, users);
      await DutyCoverageService.save(input);
      onSaved?.(replacementId ? 'Pengganti piket berhasil ditugaskan untuk tanggal ini.' : 'Berhalangan tercatat. Menunggu admin menetapkan pengganti.');
      onClose();
    } catch (e: any) { setError(e?.message || 'Penggantian gagal disimpan.'); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!existing || busy || !confirmRestore) return;
    setBusy(true); setError('');
    try {
      await DutyCoverageService.restore(existing, actorName);
      onSaved?.('Penggantian dibatalkan. Jadwal asli kembali aktif.');
      onClose();
    } catch (e: any) { setError(e?.message || 'Gagal membatalkan penggantian.'); }
    finally { setBusy(false); }
  };

  return <Modal isOpen={!!source} onClose={() => { if (!busy) onClose(); }} title="Guru Piket Berhalangan Mendadak" maxWidth="lg">
    {source && <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Jadwal yang akan dialihkan</p>
        <p className="font-bold text-slate-900 dark:text-white break-words">{source.petugasName}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{dateISO} · {source.ruangName} · {source.jamMulai}–{source.jamSelesai} WIB</p>
        <p className="text-xs text-slate-500 leading-relaxed">Perubahan hanya berlaku pada tanggal ini. Jadwal rutin dan riwayat sebelumnya tetap tersimpan.</p>
      </div>
      <label className="block text-sm font-semibold space-y-1.5"><span>1. Keterangan berhalangan hadir <span className="text-rose-600">*</span></span>
        <textarea rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: izin keluarga mendadak / sakit / tugas kedinasan" className="w-full min-h-24 p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 text-sm font-normal" />
        <span className="flex justify-between text-[11px] text-slate-500 font-normal"><span>Wajib 10–500 karakter untuk jejak audit.</span><span>{reason.trim().length}/500</span></span>
      </label>
      <div className="space-y-2">
        <label className="block text-sm font-semibold">2. Pilih petugas pengganti</label>
        <SearchableSelect
          label="Petugas Pengganti Piket"
          value={replacementId}
          onChange={setReplacementId}
          options={replacementOptions}
          disabled={busy}
          placeholder="Cari dan pilih nama pengganti"
        />
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Cari nama, ID login, NIP atau NUPTK. Jika belum tersedia, pilih “Menunggu Pengganti” dan tetapkan nanti.</p>
      </div>
      <div role="status" className={`rounded-xl border p-3 text-xs leading-relaxed ${replacementId ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'}`}>
        <p className="font-bold mb-1">3. Ringkasan penugasan</p>
        {replacementId ? <p><strong>{chosenOfficer?.fullName || 'Petugas terpilih'}</strong> akan bertugas menggantikan guru asli pada {dateISO}, menggunakan presensi GPS dan swafoto dari akun sendiri.</p>
          : <p>Guru asli akan ditandai <strong>Berhalangan</strong>, sementara jadwal berstatus <strong>Menunggu Pengganti</strong> dan tidak dihitung sebagai guru hadir.</p>}
      </div>
      {confirmRestore && existing && <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 space-y-2 text-xs text-rose-900 dark:text-rose-200">
        <p className="font-bold">Yakin ingin memulihkan jadwal asli?</p>
        <p>Penanganan berhalangan hari ini akan dibatalkan. Hanya bisa dilakukan bila petugas pengganti belum presensi.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirmRestore(false)} className="min-h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-800">Tidak, kembali</button>
          <button type="button" disabled={busy} onClick={restore} className="min-h-10 px-3 rounded-xl bg-rose-700 text-white font-semibold disabled:opacity-50">Ya, pulihkan jadwal asli</button>
        </div>
      </div>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-xs">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
        {existing && <button type="button" disabled={busy || confirmRestore} onClick={() => setConfirmRestore(true)} className="min-h-11 px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-50 sm:mr-auto" title="Pulihkan penugasan asli bila pengganti belum presensi">Pulihkan Jadwal Asli</button>}
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 px-3 rounded-xl border border-slate-200 text-xs font-semibold disabled:opacity-50">Tutup tanpa mengubah</button>
        <button type="button" disabled={busy || confirmRestore || reason.trim().length < 10} onClick={save} className="min-h-11 px-4 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold disabled:opacity-50">{busy ? 'Menyimpan…' : replacementId ? 'Simpan Guru Pengganti' : 'Catat Berhalangan'}</button>
      </div>
    </div>}
  </Modal>;
};
