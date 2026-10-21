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

  useEffect(() => {
    if (!source) return;
    const previous = allSchedules.find(s => s.id === dutyCoverageId(dateISO, source.id));
    setReason(previous?.absenceReason || '');
    setReplacementId(previous?.status !== 'DIBATALKAN' ? previous?.petugasId || '' : '');
    setError(''); setBusy(false);
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
    if (!existing || busy || !window.confirm('Batalkan penanganan berhalangan dan pulihkan penugasan asli pada tanggal ini?')) return;
    setBusy(true); setError('');
    try {
      await DutyCoverageService.restore(existing, actorName);
      onSaved?.('Penggantian dibatalkan. Jadwal asli kembali aktif.');
      onClose();
    } catch (e: any) { setError(e?.message || 'Gagal membatalkan penggantian.'); }
    finally { setBusy(false); }
  };

  return <Modal isOpen={!!source} onClose={() => { if (!busy) onClose(); }} title="Guru Piket Berhalangan Mendadak" maxWidth="lg">
    {source && <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-sm space-y-1">
        <p className="font-bold text-slate-900 dark:text-white">{source.petugasName}</p>
        <p className="text-xs text-slate-500">{dateISO} · {source.ruangName} · {source.jamMulai}–{source.jamSelesai} WIB</p>
        <p className="text-xs text-slate-500">Hanya mengubah penugasan pada tanggal ini. Jadwal mingguan dan riwayat lama tetap utuh.</p>
      </div>
      <label className="block text-sm font-semibold">Keterangan berhalangan hadir <span className="text-rose-600">*</span>
        <textarea rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: mendadak izin keluarga / sakit / tugas kedinasan" className="w-full mt-1 min-h-24 p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 text-sm" />
        <span className="text-[11px] text-slate-500 font-normal">Wajib 10–500 karakter untuk jejak penugasan.</span>
      </label>
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold">Petugas pengganti</label>
        <SearchableSelect
          label="Petugas Pengganti Piket"
          value={replacementId}
          onChange={setReplacementId}
          options={replacementOptions}
          disabled={busy}
          placeholder="Cari dan pilih nama pengganti"
        />
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Ketuk pilihan di atas untuk mencari nama, ID login, atau NIP/NUPTK.
          Pilih “Menunggu Pengganti” jika belum ada petugas yang ditetapkan.
        </p>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl">Pengganti yang dipilih menggunakan presensi GPS dan swafoto dengan akun miliknya sendiri. Status menunggu pengganti tidak dihitung sebagai guru yang hadir.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-xs">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
        {existing && <button type="button" disabled={busy} onClick={restore} className="min-h-11 px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-50 mr-auto">Pulihkan Jadwal</button>}
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 px-3 rounded-xl border border-slate-200 text-xs font-semibold disabled:opacity-50">Batal</button>
        <button type="button" disabled={busy} onClick={save} className="min-h-11 px-4 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan Penugasan Hari Ini'}</button>
      </div>
    </div>}
  </Modal>;
};
