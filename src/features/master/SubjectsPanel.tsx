import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubjectCatalog } from '../../hooks/useSubjectCatalog';
import { SubjectService, type SubjectInput } from '../../services/firebase/subjectService';
import type { SubjectRecord } from '../../types/subject.types';
import { Button } from '../../components/common/Button';
import { Card, CardContent } from '../../components/common/Card';
import { DialogForm } from '../../components/common/DialogForm';
import { Modal } from '../../components/common/Modal';
import { BookOpen, Plus } from '../../components/icons';

const field = 'w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100';
export const SubjectsPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const catalog = useSubjectCatalog();
  const canEdit = currentUser?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ input: SubjectInput; revision: string | null; uid: string } | null>(null);
  const [removing, setRemoving] = useState<(SubjectRecord & { ownerUid: string }) | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const owner = useRef(currentUser?.id); owner.current = currentUser?.id;
  const q = search.trim().toLocaleLowerCase('id-ID');
  const rows = catalog.entries.filter(row => (status === 'all' || row.isActive === (status === 'active')) && `${row.name} ${row.code}`.toLocaleLowerCase('id-ID').includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const pages = Math.max(1, Math.ceil(rows.length / 20)), activePage = Math.min(page, pages - 1);
  const update = (changes: Partial<SubjectInput>) => setEditor(previous => previous ? { ...previous, input: { ...previous.input, ...changes } } : null);
  const open = (row?: SubjectRecord) => { setError(''); setEditor({ input: row ? { ...row } : { id: crypto.randomUUID(), code: '', name: '', notes: '', isActive: true }, revision: row?.updatedAt || null, uid: currentUser?.id || '' }); };
  const perform = async (action: () => Promise<unknown>, deleted = false) => {
    if (!currentUser || !canEdit || operation.current) return;
    const uid = currentUser.id;
    operation.current = true; setBusy(true); setError('');
    try { await action(); if (owner.current === uid) { setEditor(null); setRemoving(null); setMessage(deleted ? 'Mapel dihapus dari master. Data guru, jadwal, dan riwayat yang sudah tersimpan tetap utuh.' : 'Mata pelajaran tersimpan. Pilihan pada formulir akan diperbarui otomatis.'); } }
    catch (err: any) { if (owner.current === uid) setError(err.message || 'Perubahan mata pelajaran gagal disimpan.'); }
    finally { operation.current = false; if (owner.current === uid) setBusy(false); }
  };
  useEffect(() => { setEditor(null); setRemoving(null); setError(''); setMessage(''); }, [currentUser?.id]);
  const visibleEditor = editor?.uid === currentUser?.id && canEdit ? editor : null;
  return <section aria-label="Master mata pelajaran" className="space-y-4 min-w-0">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 shrink-0" />Mata Pelajaran</h2><p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Daftar mapel untuk data guru, jadwal mengajar, dan guru inval.</p></div>{canEdit && <Button type="button" disabled={catalog.loading || !!catalog.error} className="min-h-11 shrink-0" leftIcon={<Plus className="w-4 h-4" />} onClick={() => open()}>Tambah Mata Pelajaran</Button>}</div>
    <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3"><label className="text-sm space-y-1"><span>Cari mata pelajaran</span><input aria-label="Cari master mata pelajaran" className={field} placeholder="Nama atau kode mapel" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label><label className="text-sm space-y-1"><span>Status</span><select aria-label="Status mata pelajaran" className={field} value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="all">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label></CardContent></Card>
    {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    {catalog.error ? <div role="alert" className="text-sm text-rose-700 dark:text-rose-300 space-y-2"><p>{catalog.error}</p><Button variant="outline" onClick={catalog.reload}>Coba Lagi</Button></div> : catalog.loading ? <p role="status" className="text-sm">Memuat master mata pelajaran…</p> : <>
      <p className="text-xs text-slate-500">{rows.length} mapel. Menampilkan maksimal 20 per halaman.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{rows.slice(activePage * 20, activePage * 20 + 20).map(row => <article key={row.id} data-subject-id={row.id} className="min-w-0"><Card><CardContent className="p-4 space-y-2"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold break-words min-w-0">{row.name}</h3><span className="text-xs shrink-0 text-slate-500">{row.isActive ? 'Aktif' : 'Nonaktif'}</span></div>{row.code && <p className="text-xs font-mono text-slate-500">{row.code}</p>}{row.notes && <p className="text-xs break-words text-slate-600 dark:text-slate-400">{row.notes}</p>}{canEdit && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="min-h-11" onClick={() => open(row)} aria-label={`Edit mapel ${row.name}`}>Edit / Status</Button><Button variant="ghost" size="sm" className="min-h-11" onClick={() => { setError(''); setRemoving({ ...row, ownerUid: currentUser?.id || '' }); }} aria-label={`Hapus mapel ${row.name}`}>Hapus</Button></div>}</CardContent></Card></article>)}</div>
      {!rows.length && <p className="p-6 text-center text-sm text-slate-500">Belum ada mata pelajaran yang sesuai. Tambahkan mapel atau ubah pencarian.</p>}
      {pages > 1 && <nav aria-label="Halaman master mata pelajaran" className="flex items-center justify-center gap-3"><Button variant="outline" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Sebelumnya</Button><span className="text-sm">{activePage + 1} / {pages}</span><Button variant="outline" disabled={activePage + 1 === pages} onClick={() => setPage(activePage + 1)}>Berikutnya</Button></nav>}
    </>}
    <Modal isOpen={!!visibleEditor} onClose={() => { if (!busy) setEditor(null); }} title={visibleEditor?.revision ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'} maxWidth="md">
      {visibleEditor && <DialogForm onSubmit={event => { event.preventDefault(); if (currentUser) void perform(() => SubjectService.save(visibleEditor.input, currentUser, visibleEditor.revision)); }} className="space-y-4" actions={<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Batal</Button><Button type="submit" isLoading={busy}>Simpan Mata Pelajaran</Button></div>}>
        {error && <p role="alert" tabIndex={-1} className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <label className="block text-sm space-y-1"><span>Nama mata pelajaran *</span><input aria-label="Nama mata pelajaran" required maxLength={120} className={field} value={visibleEditor.input.name} onChange={event => update({ name: event.target.value })} placeholder="Contoh: Matematika" /></label>
        <label className="block text-sm space-y-1"><span>Kode (opsional)</span><input aria-label="Kode mata pelajaran" maxLength={30} className={field} value={visibleEditor.input.code} onChange={event => update({ code: event.target.value })} placeholder="Contoh: MTK" /></label>
        <label className="block text-sm space-y-1"><span>Keterangan (opsional)</span><input aria-label="Keterangan mata pelajaran" maxLength={240} className={field} value={visibleEditor.input.notes} onChange={event => update({ notes: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={visibleEditor.input.isActive} onChange={event => update({ isActive: event.target.checked })} />Aktif dalam saran pilihan mapel</label><p className="text-xs text-slate-500">Perubahan master tidak mengganti nama mapel pada data guru, jadwal, atau riwayat lama secara otomatis.</p>
      </DialogForm>}
    </Modal>
    <Modal isOpen={!!removing && removing.ownerUid === currentUser?.id && canEdit} onClose={() => { if (!busy) setRemoving(null); }} title="Hapus Mata Pelajaran" maxWidth="sm"><div className="space-y-4"><p className="text-sm">Hapus {removing?.name} dari master? Data guru, jadwal, dan riwayat yang sudah tersimpan tidak ikut dihapus. Gunakan nonaktifkan bila mapel ingin disimpan untuk nanti.</p>{error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Batal</Button><Button variant="danger" isLoading={busy} onClick={() => { if (removing && currentUser) void perform(() => SubjectService.remove(removing, currentUser), true); }}>Hapus Mata Pelajaran</Button></div></div></Modal>
  </section>;
};
