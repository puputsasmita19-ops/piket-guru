import React, { useEffect, useState } from 'react';
import type { StudentRecord } from '../../types/master.types';
import type { IncidentStudentSnapshot } from '../../types/incident.types';
import { FirestoreService } from '../../services/firebase/firestoreService';

export function StudentMultiSelect({ value, onChange }: { value: IncidentStudentSnapshot[]; onChange: (value: IncidentStudentSnapshot[]) => void }) {
  const [students, setStudents] = useState<StudentRecord[]>([]), [query, setQuery] = useState(''), [error, setError] = useState('');
  useEffect(() => FirestoreService.subscribeToCollection<StudentRecord>('students', data => setStudents(data.filter(s => s.isActive !== false).sort((a,b) => a.nama.localeCompare(b.nama))), () => setError('Daftar siswa belum dapat dimuat. Coba kembali atau isi pihak lain secara manual.')), []);
  const matches = students.filter(s => `${s.nama} ${s.kelas} ${s.nis || ''} ${s.nisn || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="space-y-2"><label className="history-field"><span>Pilih siswa terlibat (bisa lebih dari satu)</span><input type="search" aria-label="Cari siswa terlibat" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama, kelas, NIS / NISN…"/></label>
    {value.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Siswa terpilih">{value.map(s => <button type="button" key={s.studentId} aria-label={`Hapus pilihan ${s.nama}`} onClick={() => onChange(value.filter(v => v.studentId !== s.studentId))} className="min-h-11 px-3 py-2 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] text-xs cursor-pointer">{s.nama} · {s.kelas} ×</button>)}</div>}
    <div className="max-h-48 overflow-y-auto overscroll-contain rounded-xl border border-[var(--theme-card-border)]" role="group" aria-label="Daftar siswa terlibat">{matches.slice(0, 30).map(s => <label className="flex items-center gap-3 min-h-11 px-3 py-2 text-xs border-b last:border-b-0 border-[var(--theme-card-border)] cursor-pointer" key={s.id}><input type="checkbox" aria-label={`${s.nama}, ${s.kelas}`} checked={value.some(v => v.studentId === s.id)} onChange={e => onChange(e.target.checked ? [...value, { studentId: s.id, nama: s.nama, kelas: s.kelas }] : value.filter(v => v.studentId !== s.id))}/><span className="min-w-0 break-words"><strong>{s.nama}</strong><span className="block text-[11px] text-slate-500 dark:text-slate-400">{s.kelas} · {s.nis || s.nisn || s.studentId || s.id}</span></span></label>)}{!matches.length && <p className="p-3 text-xs text-slate-500">Tidak ada siswa sesuai pencarian.</p>}</div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">{value.length} siswa dipilih.{matches.length > 30 ? ' Ketik lebih spesifik untuk mencari siswa lainnya.' : ''}</p>{error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
  </div>;
}
