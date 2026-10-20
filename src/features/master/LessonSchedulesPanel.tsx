import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOperationalSchoolSettings } from '../../hooks/useOperationalSchoolSettings';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { LessonScheduleService, type LessonScheduleInput } from '../../services/firebase/lessonScheduleService';
import type { DayOfWeek } from '../../types';
import type { TeacherRecord, StudentRecord } from '../../types/master.types';
import { ALL_DAYS_OF_WEEK, formatSelectedPeriodsDisplay } from '../../types/period.types';
import { getTeachingPeriods, isLessonScheduleDay, type LessonScheduleDay, type LessonScheduleEntry } from '../../types/lessonSchedule.types';
import { getTodayISODate } from '../../utils/dateUtils';
import { Button } from '../../components/common/Button';
import { Card, CardContent } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { DialogForm } from '../../components/common/DialogForm';
import { SubjectPicker } from '../../components/common/SubjectPicker';
import { getTeacherSubjects } from '../../types/master.types';
import { Plus, Edit2, Trash2, Calendar, Search } from '../../components/icons';

const field = 'w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100';
const blank = (): LessonScheduleInput => ({ id: crypto.randomUUID(), teacherId: '', subject: '', className: '', periodNumbers: [], validFrom: getTodayISODate(), validUntil: '', isActive: true, notes: '' });

export const LessonSchedulesPanel: React.FC<{ teachers: TeacherRecord[]; students: StudentRecord[] }> = ({ teachers, students }) => {
  const { currentUser } = useAuth();
  const settings = useOperationalSchoolSettings();
  const canEdit = currentUser?.role === 'ADMIN';
  const [day, setDay] = useState<DayOfWeek>('SENIN');
  const key = `${currentUser?.id || ''}:${day}`;
  const [source, setSource] = useState<{ key: string; data: LessonScheduleDay | null }>({ key: '', data: null });
  const [readError, setReadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ input: LessonScheduleInput; revision: string | null } | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [removing, setRemoving] = useState<LessonScheduleEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const operation = useRef(false);
  const owner = useRef(currentUser?.id); owner.current = currentUser?.id;
  useEffect(() => {
    let active = true;
    setSource({ key: '', data: null }); setReadError(''); setPage(0);
    if (!currentUser?.id) return;
    const stop = FirestoreService.subscribeToDocument<LessonScheduleDay>('lessonSchedules', day, data => {
      if (active) {
        if (data && (!isLessonScheduleDay(data) || data.id !== day)) { setSource({ key: '', data: null }); setReadError('Format master jadwal tidak valid. Periksa data atau pulihkan cadangan jadwal yang benar.'); return; }
        setSource({ key, data: data || null }); setReadError('');
      }
    }, err => {
      if (active) { setSource({ key: '', data: null }); setReadError((err as any).code === 'permission-denied' ? 'Akses master jadwal ditolak. Admin perlu menerapkan Firestore Rules dari pembaruan ini.' : 'Jadwal belum dapat dimuat. Periksa koneksi lalu coba lagi.'); }
    });
    return () => { active = false; stop(); };
  }, [key, attempt]);
  useEffect(() => { setEditor(null); setRemoving(null); setError(''); setMessage(''); }, [currentUser?.id]);
  const rows = source.key === key ? source.data?.entries || [] : [];
  const loading = source.key !== key && !readError;
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id-ID');
    return rows.filter(e => [teachers.find(t => t.id === e.teacherId)?.fullName || e.teacherName, e.subject, e.className].some(s => s.toLocaleLowerCase('id-ID').includes(q)))
      .sort((a, b) => Math.min(...a.periodNumbers) - Math.min(...b.periodNumbers) || a.className.localeCompare(b.className));
  }, [rows, teachers, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20)), activePage = Math.min(page, pageCount - 1);
  const periods = getTeachingPeriods(settings.lessonPeriodConfig, day, editor?.input.validFrom || getTodayISODate());
  const classes = [...new Set(students.filter(s => s.isActive !== false && s.kelas?.trim()).map(s => s.kelas.trim()))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  const selectedTeacher = teachers.find(t => t.id === editor?.input.teacherId);
  const teacherOptions = teachers.filter(t => t.id === editor?.input.teacherId || `${t.fullName} ${t.mataPelajaran || ''} ${t.idGuru || ''}`.toLocaleLowerCase('id-ID').includes(teacherSearch.trim().toLocaleLowerCase('id-ID'))).sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
  const subjects = [...new Set([...getTeacherSubjects(selectedTeacher), ...rows.filter(e => e.teacherId === selectedTeacher?.id).map(e => e.subject)])];
  const update = (changes: Partial<LessonScheduleInput>) => setEditor(prev => prev ? { ...prev, input: { ...prev.input, ...changes } } : null);
  const openEditor = (entry?: LessonScheduleEntry) => {
    setError(''); setTeacherSearch(''); setEditor({ input: entry ? { ...entry, periodNumbers: [...entry.periodNumbers] } : blank(), revision: entry?.updatedAt || null });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || !currentUser || operation.current || !canEdit) return;
    const uid = currentUser.id;
    operation.current = true; setSaving(true); setError('');
    try {
      await LessonScheduleService.save(day, editor.input, currentUser, editor.revision);
      if (owner.current === uid) { setEditor(null); setMessage('Jadwal tersimpan. Formulir inval akan menggunakan jadwal ini sesuai hari dan tanggal berlakunya.'); }
    } catch (err: any) { if (owner.current === uid) setError(err.message || 'Jadwal gagal disimpan.'); }
    finally { operation.current = false; if (owner.current === uid) setSaving(false); }
  };
  const remove = async () => {
    if (!removing || !currentUser || operation.current || !canEdit) return;
    const uid = currentUser.id;
    operation.current = true; setSaving(true); setError('');
    try { await LessonScheduleService.remove(day, removing, currentUser); if (owner.current === uid) { setRemoving(null); setMessage('Jadwal dihapus dari master. Riwayat inval yang sudah tersimpan tetap utuh.'); } }
    catch (err: any) { if (owner.current === uid) setError(err.message || 'Jadwal gagal dihapus.'); }
    finally { operation.current = false; if (owner.current === uid) setSaving(false); }
  };
  return <section aria-label="Master jadwal pelajaran" className="space-y-4 min-w-0">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 shrink-0" />Jadwal Pelajaran</h2><p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Jadwal mengajar mingguan untuk pengisian otomatis guru inval. Berulang setiap minggu selama tanggal berlaku.</p></div>
      {canEdit && <Button type="button" onClick={() => openEditor()} disabled={loading || !!readError} leftIcon={<Plus className="w-4 h-4" />} className="min-h-11 shrink-0">Tambah Jadwal Pelajaran</Button>}
    </div>
    <Card><CardContent className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
      <label className="text-sm space-y-1"><span>Hari mengajar</span><select aria-label="Hari mengajar" className={field} value={day} onChange={e => { setDay(e.target.value as DayOfWeek); setMessage(''); }}>{ALL_DAYS_OF_WEEK.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select></label>
      <label className="text-sm space-y-1"><span>Cari jadwal</span><div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input aria-label="Cari jadwal pelajaran" className={`${field} pl-9`} placeholder="Nama guru, mata pelajaran, atau kelas" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div></label>
    </CardContent></Card>
    {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    {readError && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300 space-y-2"><p>{readError}</p><Button type="button" variant="outline" onClick={() => setAttempt(n => n + 1)}>Coba Lagi</Button></div>}
    {loading ? <p role="status" className="text-sm">Memuat jadwal pelajaran…</p> : !readError && <>
      <p className="text-xs text-slate-500">{filtered.length} rincian pada hari {ALL_DAYS_OF_WEEK.find(d => d.code === day)?.label}. Maksimal 20 ditampilkan per halaman.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.slice(activePage * 20, (activePage + 1) * 20).map(entry => <article key={entry.id} data-lesson-id={entry.id} className="min-w-0"><Card><CardContent className="p-4 space-y-2 min-w-0">
          <div className="flex justify-between items-start gap-2"><h3 className="font-semibold text-sm break-words min-w-0">{teachers.find(t => t.id === entry.teacherId)?.fullName || entry.teacherName}</h3><span className={`text-xs shrink-0 ${entry.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>{entry.isActive ? 'Aktif' : 'Nonaktif'}</span></div>
          <p className="text-sm break-words">{entry.subject} · {entry.className}</p><p className="text-sm text-slate-600 dark:text-slate-400">JP {entry.periodNumbers.join(', ')}</p>
          <p className="text-xs text-slate-500">Berlaku {entry.validFrom}{entry.validUntil ? ` sampai ${entry.validUntil}` : ' dan seterusnya'}</p>
          {entry.notes && <p className="text-xs break-words">{entry.notes}</p>}
          {canEdit && <div className="flex gap-2 pt-1"><Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => openEditor(entry)} leftIcon={<Edit2 className="w-4 h-4" />}>Edit Jadwal</Button><Button type="button" size="sm" variant="ghost" className="min-h-11" aria-label={`Hapus jadwal ${entry.teacherName} ${entry.className}`} onClick={() => { setError(''); setRemoving(entry); }} leftIcon={<Trash2 className="w-4 h-4" />}>Hapus</Button></div>}
        </CardContent></Card></article>)}
      </div>
      {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Belum ada jadwal yang sesuai. Pilih hari lain atau tambahkan jadwal pelajaran.</p>}
      {pageCount > 1 && <nav aria-label="Halaman jadwal pelajaran" className="flex items-center justify-center gap-3"><Button variant="outline" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Sebelumnya</Button><span className="text-sm">{activePage + 1} / {pageCount}</span><Button variant="outline" disabled={activePage + 1 === pageCount} onClick={() => setPage(activePage + 1)}>Berikutnya</Button></nav>}
    </>}
    <Modal isOpen={!!editor} onClose={() => { if (!saving) setEditor(null); }} title={editor?.revision ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'} maxWidth="lg">
      {editor && <DialogForm onSubmit={save} className="space-y-4" actions={<div className="flex gap-2 justify-end"><Button type="button" variant="outline" disabled={saving} onClick={() => setEditor(null)}>Batal</Button><Button type="submit" isLoading={saving}>Simpan Jadwal</Button></div>}>
        {error && <p role="alert" tabIndex={-1} className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <p className="text-sm">Hari: <strong>{ALL_DAYS_OF_WEEK.find(d => d.code === day)?.label}</strong>. Untuk hari lain, pilih hari tersebut lalu tambah jadwal baru.</p>
        <label className="block text-sm space-y-1"><span>Cari guru</span><input aria-label="Cari guru pengajar" className={field} value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} placeholder="Cari nama atau mata pelajaran" /></label>
        <label className="block text-sm space-y-1"><span>Guru pengajar *</span><select aria-label="Guru pengajar" required className={field} value={editor.input.teacherId} onChange={e => { const t = teachers.find(t => t.id === e.target.value); update({ teacherId: e.target.value, subject: getTeacherSubjects(t)[0] || '' }); }}><option value="">Pilih guru dari master guru</option>{teacherOptions.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm space-y-1"><span>Mata pelajaran *</span><SubjectPicker label="Mata pelajaran" required value={editor.input.subject} onChange={value => update({ subject: value })} suggestions={subjects} /></label>
          <label className="block text-sm space-y-1"><span>Kelas *</span><input aria-label="Kelas jadwal" required maxLength={80} list="lesson-classes" className={field} value={editor.input.className} onChange={e => update({ className: e.target.value })} placeholder="Pilih saran atau ketik kelas" /><datalist id="lesson-classes">{classes.map(s => <option key={s} value={s} />)}</datalist></label>
          <label className="block text-sm space-y-1"><span>Mulai berlaku *</span><input aria-label="Mulai berlaku jadwal" required type="date" className={field} value={editor.input.validFrom} onChange={e => update({ validFrom: e.target.value })} /></label>
          <label className="block text-sm space-y-1"><span>Akhir berlaku (opsional)</span><input aria-label="Akhir berlaku jadwal" type="date" min={editor.input.validFrom} className={field} value={editor.input.validUntil} onChange={e => update({ validUntil: e.target.value })} /></label>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm mb-2">Jam pelajaran *</legend>{periods.length ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{periods.map(p => <label key={p.id} className="flex items-center gap-2 p-2 min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"><input type="checkbox" aria-label={`Pilih JP ${p.periodNumber}`} checked={editor.input.periodNumbers.includes(p.periodNumber)} onChange={e => update({ periodNumbers: e.target.checked ? [...editor.input.periodNumbers, p.periodNumber].sort((a, b) => a - b) : editor.input.periodNumbers.filter(n => n !== p.periodNumber) })} /><span>JP {p.periodNumber}<span className="block text-slate-500">{p.startTime}–{p.endTime}</span></span></label>)}</div> : <p className="text-sm text-amber-700 dark:text-amber-300">Atur JP hari ini terlebih dahulu di Pengaturan Sekolah → Jam Pelajaran, sesuai tanggal mulai berlaku.</p>}
          {editor.input.periodNumbers.some(n => !periods.some(p => p.periodNumber === n)) && <p className="text-xs text-amber-700 dark:text-amber-300">Ada JP lama yang tidak tersedia. Sesuaikan pilihan sebelum mengaktifkan jadwal. <button type="button" className="underline min-h-11" onClick={() => update({ periodNumbers: editor.input.periodNumbers.filter(n => periods.some(p => p.periodNumber === n)) })}>Bersihkan JP lama</button></p>}
          {editor.input.periodNumbers.length > 0 && <p className="text-xs text-slate-500">{formatSelectedPeriodsDisplay(periods.filter(p => editor.input.periodNumbers.includes(p.periodNumber))).combinedDisplay}</p>}
        </fieldset>
        <label className="block text-sm space-y-1"><span>Keterangan (opsional)</span><input aria-label="Keterangan jadwal" maxLength={240} className={field} value={editor.input.notes} onChange={e => update({ notes: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={editor.input.isActive} onChange={e => update({ isActive: e.target.checked })} />Jadwal aktif untuk pengisian inval</label>
      </DialogForm>}
    </Modal>
    <Modal isOpen={!!removing} onClose={() => { if (!saving) setRemoving(null); }} title="Hapus Jadwal Pelajaran" maxWidth="sm">
      <div className="space-y-4"><p className="text-sm">Hapus jadwal {removing?.teacherName}, {removing?.subject}, kelas {removing?.className}? Riwayat inval yang sudah tercatat tetap disimpan.</p>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setRemoving(null)}>Batal</Button><Button variant="danger" isLoading={saving} onClick={remove}>Hapus Jadwal</Button></div></div>
    </Modal>
  </section>;
};
