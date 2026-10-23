import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { APP_PERMISSION_ITEMS, PERMISSIONS as ALL_PERMISSIONS } from '../../config/permissions';
import type { UserProfile } from '../../types';
import { db } from '../../services/firebase/firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';

/** Mass changes are transactions per user, read live to avoid clobbering concurrent edits. */
const RESTRICTED = new Set([
  'users.view', 'users.create', 'users.update', 'users.delete',
  'settings.update', 'backup.view', 'backup.create', 'backup.restore',
]);
const PERMISSIONS = [...new Set(Object.values(ALL_PERMISSIONS))]
  .filter(id => !RESTRICTED.has(id) && id !== '*')
  .map(id => ({ id, label: APP_PERMISSION_ITEMS.find(item => item.id === id)?.label || id.replaceAll('_', ' ').replaceAll('.', ' · '),
    category: APP_PERMISSION_ITEMS.find(item => item.id === id)?.category || 'Lainnya' }));

export function BulkPermissionsModal({ isOpen, onClose, users, actor }: {
  isOpen: boolean; onClose: () => void; users: UserProfile[]; actor: UserProfile | null;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [mode, setMode] = useState<'ADD' | 'REMOVE'>('ADD');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const eligible = useMemo(() => users.filter(u => u.isActive !== false && u.role !== 'ADMIN' && u.id !== actor?.id && !(u.permissions || []).includes('*')),
    [users, actor?.id]);
  const found = useMemo(() => eligible.filter(u => `${u.fullName} ${u.loginId || ''} ${u.nip || ''}`.toLowerCase().includes(search.toLowerCase())), [eligible, search]);
  const selected = eligible.filter(u => selectedIds.includes(u.id));
  const toggle = (id: string) => setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const save = async () => {
    if (!actor || actor.role !== 'ADMIN' || !selected.length || !selectedPerms.length || busy) return;
    if (!window.confirm(`${mode === 'ADD' ? 'Tambahkan' : 'Cabut'} ${selectedPerms.length} izin pada ${selected.length} akun? Izin lain tetap dipertahankan.`)) return;
    setBusy(true); setResult('');
    let success = 0; const failed: string[] = [];
    for (const user of selected) {
      try {
        await runTransaction(db, async transaction => {
          const ref = doc(db, 'users', user.id);
          const snap = await transaction.get(ref);
          if (!snap.exists() || snap.data().role === 'ADMIN' || snap.data().isActive === false) throw new Error('Akun tidak memenuhi syarat');
          const old: string[] = Array.isArray(snap.data().permissions) ? snap.data().permissions : [];
          if (old.includes('*')) throw new Error('Akun wildcard tidak boleh diubah massal');
          const after = mode === 'ADD' ? [...new Set([...old, ...selectedPerms])] : old.filter(p => !selectedPerms.includes(p));
          if (after.length === old.length && after.every((p, i) => p === old[i])) return;
          const updatedAt = new Date().toISOString();
          transaction.update(ref, { permissions: after, updatedAt });
          const audit = doc(collection(db, 'auditLogs'));
          transaction.set(audit, {
            id: audit.id, timestamp: updatedAt, userId: actor.id, userName: actor.fullName,
            role: actor.role, action: 'UPDATE', module: 'USERS', status: 'SUCCESS',
            target: user.fullName, recordId: user.id,
            details: `Hak akses massal (${mode}): ${selectedPerms.join(', ')}. Izin lain tidak diganti.`,
          });
        });
        success++;
      } catch (e: any) { failed.push(`${user.fullName}: ${e?.message || 'gagal'}`); }
    }
    setResult(`${success} akun diproses. ${failed.length} gagal.${failed.length ? '\n' + failed.slice(0, 12).join('\n') : ''}`);
    setBusy(false);
    if (!failed.length) setSelectedIds([]);
  };
  return <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title="Hak Akses Massal · Admin" maxWidth="2xl">
    <div className="space-y-4 text-xs">
      <p className="text-slate-600 dark:text-slate-300">Pilih beberapa pengguna dan izin. Izin lain tidak akan ditimpa. Akun ADMIN atau wildcard (*) tidak diproses secara massal.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="font-semibold">Tindakan</label>
        <select value={mode} disabled={busy} onChange={e => setMode(e.target.value as 'ADD' | 'REMOVE')} className="rounded-xl border p-3 bg-[var(--theme-card-bg)] min-h-11">
          <option value="ADD">Tambahkan izin</option><option value="REMOVE">Cabut izin</option>
        </select>
      </div>
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>1. Pilih akun ({selected.length})</strong>
          <button className="underline font-semibold min-h-10" type="button" disabled={busy} onClick={() => setSelectedIds([...new Set([...selectedIds, ...found.map(u => u.id)])])}>Pilih semua hasil pencarian</button>
          <button className="underline min-h-10" type="button" disabled={busy} onClick={() => setSelectedIds([])}>Kosongkan</button>
        </div>
        <input aria-label="Cari pengguna untuk hak akses massal" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau ID Login" className="w-full rounded-xl border p-3 min-h-11 bg-[var(--theme-card-bg)]" />
        <div className="max-h-48 overflow-y-auto rounded-xl border divide-y divide-slate-200 dark:divide-slate-700">
          {found.map(u => <label key={u.id} className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer"><input type="checkbox" disabled={busy} checked={selectedIds.includes(u.id)} onChange={() => toggle(u.id)} /><span className="min-w-0 flex-1"><strong className="block">{u.fullName}</strong><span className="text-slate-500">{u.loginId || '-'} · {u.role}</span></span></label>)}
          {!found.length && <p className="p-3">Tidak ada akun yang cocok.</p>}
        </div>
      </section>
      <section className="space-y-2"><strong>2. Pilih jenis hak akses ({selectedPerms.length})</strong>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {PERMISSIONS.map(permission => <label key={permission.id} className="flex items-start gap-2 border rounded-xl p-2.5 cursor-pointer min-h-11"><input type="checkbox" disabled={busy} checked={selectedPerms.includes(permission.id)} onChange={() => setSelectedPerms(p => p.includes(permission.id) ? p.filter(x => x !== permission.id) : [...p, permission.id])} /><span>{permission.label}<small className="block text-slate-500">{permission.category}</small></span></label>)}
        </div>
      </section>
      <p className="rounded-xl bg-amber-50 text-amber-900 p-3">Pratinjau: <strong>{mode === 'ADD' ? 'Tambah' : 'Cabut'} {selectedPerms.length} izin</strong> pada <strong>{selected.length} akun</strong>. Izin lain dan role akun tetap. Hak akses efektif juga dipengaruhi role bawaan.</p>
      {result && <p role="status" className="whitespace-pre-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-3">{result}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>Tutup</Button><Button variant="primary" disabled={!selected.length || !selectedPerms.length || busy || actor?.role !== 'ADMIN'} isLoading={busy} onClick={save}>Terapkan ke {selected.length} Akun</Button></div>
    </div>
  </Modal>;
}
