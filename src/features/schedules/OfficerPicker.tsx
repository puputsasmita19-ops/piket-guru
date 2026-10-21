import React, { useMemo, useState } from 'react';
import { Search } from '../../components/icons';
import { filterOfficerCandidates, type OfficerCandidate } from '../../utils/scheduleUtils';

interface Props {
  candidates: OfficerCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

/** Filtering never changes the selection, including selections outside the results. */
export const OfficerPicker: React.FC<Props> = ({ candidates, selected, onChange, multiple = false, disabled = false }) => {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterOfficerCandidates(candidates, search), [candidates, search]);
  // Keep the picker responsive even when the school's active staff list is large.
  // Search still includes every candidate; only initial DOM rendering is capped.
  const displayed = useMemo(() => visible.slice(0, search.trim() ? 80 : 40), [visible, search]);
  const allVisibleSelected = visible.length > 0 && visible.every(c => selected.includes(c.userId));
  const toggle = (id: string) => onChange(multiple ? (selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]) : [id]);
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <legend className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Petugas piket {multiple ? `(${selected.length} terpilih)` : ''}</legend>
    <div className="relative">
      <Search aria-hidden="true" className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
      <input type="search" aria-label="Cari petugas" placeholder="Cari nama, ID login, NIP / NUPTK…" value={search} onChange={e => setSearch(e.target.value)} className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
    </div>
    {multiple && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <button type="button" className="min-h-9 underline underline-offset-2" disabled={!visible.length} onClick={() => onChange(allVisibleSelected ? selected.filter(id => !visible.some(c => c.userId === id)) : [...new Set([...selected, ...visible.map(c => c.userId)])])}>{allVisibleSelected ? 'Batalkan hasil pencarian' : 'Pilih semua hasil'}</button>
      {selected.length > 0 && <button type="button" className="min-h-9 text-slate-500 underline" onClick={() => onChange([])}>Kosongkan pilihan</button>}
    </div>}
    <div className="max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
      {displayed.map(c => <label key={c.userId} className="flex items-center gap-3 p-3 min-h-12 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
        <input type={multiple ? 'checkbox' : 'radio'} name={multiple ? undefined : 'duty-officer'} checked={selected.includes(c.userId)} onChange={() => toggle(c.userId)} className="w-4 h-4 shrink-0 accent-[var(--theme-primary)]" />
        <span className="min-w-0 break-words"><span className="block text-sm font-medium">{c.fullName}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{c.loginId || c.nip || c.role}{c.mataPelajaran ? ` · ${c.mataPelajaran}` : ''}</span></span>
      </label>)}
      {!visible.length && <p className="p-4 text-sm text-slate-500" role="status">{candidates.length ? 'Tidak ada petugas yang sesuai pencarian.' : 'Belum ada akun petugas aktif.'}</p>}
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">{visible.length > displayed.length ? `${displayed.length} dari ${visible.length} petugas ditampilkan. Ketik nama untuk menemukan lainnya. ` : ""}Guru yang sudah terjadwal tetap dapat dipilih untuk hari lain.</p>
  </fieldset>;
};
