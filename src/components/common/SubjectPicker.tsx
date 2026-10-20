import React, { useId, useState } from 'react';
import { useSubjectCatalog } from '../../hooks/useSubjectCatalog';
import { subjectKey } from '../../types/subject.types';
import { Button } from './Button';

interface SubjectPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  className?: string;
  suggestions?: string[];
}
const inputStyle = 'w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100';

/** Native searchable suggestions also work on mobile and retain legacy values. */
export const SubjectPicker: React.FC<SubjectPickerProps> = ({ value, onChange, label, required, className = inputStyle, suggestions = [] }) => {
  const catalog = useSubjectCatalog();
  const id = useId();
  const active = catalog.entries.filter(row => row.isActive).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const known = new Set(catalog.entries.map(row => subjectKey(row.name)));
  const extra = [...new Set(suggestions)].filter(name => name.trim() && !known.has(subjectKey(name)));
  const inactive = catalog.entries.some(row => !row.isActive && subjectKey(row.name) === subjectKey(value));
  return <div className="min-w-0 space-y-1">
    <input aria-label={label} aria-describedby={`${id}-help`} autoComplete="off" required={required} maxLength={120} list={`${id}-options`} className={className} value={value} onChange={event => onChange(event.target.value)} onBlur={() => {
      const match = active.find(row => subjectKey(row.name) === subjectKey(value));
      if (match && match.name !== value) onChange(match.name);
    }} placeholder="Ketik atau pilih mata pelajaran" />
    <datalist id={`${id}-options`}>{active.map(row => <option key={row.id} value={row.name} label={row.code ? `${row.code} · ${row.name}` : row.name} />)}{extra.map(name => <option key={name} value={name} label="Saran dari data guru/jadwal" />)}</datalist>
    <p id={`${id}-help`} className="text-[11px] text-slate-500 dark:text-slate-400 break-words">{catalog.error || (catalog.loading ? 'Memuat saran mata pelajaran…' : inactive ? 'Mapel ini nonaktif pada master. Nilai lama tetap ditampilkan.' : 'Saran dari Master Mata Pelajaran. Isian lama atau manual tetap dapat digunakan.')}</p>
  </div>;
};

/** The structured array avoids splitting official subject names containing commas. */
export const TeacherSubjectPicker: React.FC<{ initial: string[] }> = ({ initial }) => {
  const [selected, setSelected] = useState(initial);
  const [draft, setDraft] = useState('');
  const { entries } = useSubjectCatalog();
  const canonical = (value: string) => entries.find(row => row.isActive && subjectKey(row.name) === subjectKey(value))?.name || value.trim();
  const effective = [...selected];
  if (draft.trim() && !effective.some(name => subjectKey(name) === subjectKey(draft))) effective.push(canonical(draft));
  const add = () => { setSelected(effective); setDraft(''); };
  return <div className="space-y-2 min-w-0">
    <input type="hidden" name="mataPelajaran" value={effective.join('; ')} />
    <input type="hidden" name="subjectNames" value={JSON.stringify(effective)} />
    <div className="flex flex-wrap gap-2">{selected.map(name => <span key={subjectKey(name)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2 text-xs min-w-0"><span className="break-words min-w-0">{name}</span><button type="button" aria-label={`Hapus mapel ${name}`} className="min-h-11 min-w-9" onClick={() => setSelected(previous => previous.filter(value => subjectKey(value) !== subjectKey(name)))}>×</button></span>)}</div>
    <div onKeyDown={event => { if (event.key === 'Enter' && draft.trim()) { event.preventDefault(); add(); } }}>
      <SubjectPicker label="Mata pelajaran guru" value={draft} onChange={setDraft} required={selected.length === 0} />
    </div>
    <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={!draft.trim()} onClick={add}>Tambah Mapel Guru</Button>
    <p className="text-[11px] text-slate-500">Guru dapat mengajar lebih dari satu mapel. Pilih saran, lalu tekan Tambah.</p>
  </div>;
};
