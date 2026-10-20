import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import type { SchoolSettings } from '../../types';
import { BACKGROUND_LOGOUT_DELAYS, sanitizeSessionPolicy } from '../../types/sessionPolicy.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';

export function SessionPolicySettingsCard({ settings, onSaved }: { settings: SchoolSettings; onSaved: (settings: SchoolSettings) => void }) {
  const { currentUser, hasRole } = useAuth();
  const [draft, setDraft] = useState(() => sanitizeSessionPolicy(settings.sessionPolicy));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const policyJson = JSON.stringify(settings.sessionPolicy);
  useEffect(() => { if (!dirty && !saving) setDraft(sanitizeSessionPolicy(settings.sessionPolicy)); }, [policyJson, dirty, saving]);
  if (!hasRole('ADMIN')) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || saving) return;
    setSaving(true); setFeedback(''); setFailed(false);
    try {
      const result = await SchoolSettingsService.saveSessionPolicy(draft, currentUser.id);
      onSaved(result.settings); setDirty(false);
      setFeedback(result.confirmed ? 'Pengaturan sesi tersimpan dan berlaku untuk pengguna aktif.' : 'Perubahan terkirim. Periksa kembali saat koneksi stabil.');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Pengaturan sesi belum tersimpan.'); }
    finally { setSaving(false); }
  };
  return <Card className="text-slate-900 dark:text-slate-100"><CardHeader title="Keluar otomatis saat aplikasi ditinggalkan" subtitle="Atur kewajiban login ulang ketika pengguna berpindah aplikasi, tab, atau mengunci layar." /><CardContent>
    <form onSubmit={save} className="space-y-4 min-w-0">
      <label className="flex items-center justify-between gap-4 min-h-11 cursor-pointer"><span className="text-sm font-medium">Aktifkan keluar otomatis</span><input type="checkbox" role="switch" aria-label="Aktifkan keluar otomatis saat aplikasi ditinggalkan" checked={draft.backgroundLogoutEnabled} disabled={saving} onChange={e => { setDraft(v => ({ ...v, backgroundLogoutEnabled: e.target.checked })); setDirty(true); setFeedback(''); }} className="h-5 w-5 shrink-0 accent-[var(--theme-primary)]" /></label>
      <label className="history-field block min-w-0"><span>Jeda sebelum keluar otomatis</span><select aria-label="Jeda sebelum keluar otomatis" disabled={saving || !draft.backgroundLogoutEnabled} value={draft.backgroundDelaySeconds} onChange={e => { setDraft(v => ({ ...v, backgroundDelaySeconds: Number(e.target.value) })); setDirty(true); setFeedback(''); }} className="w-full min-h-11 mt-2 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3">{BACKGROUND_LOGOUT_DELAYS.map(seconds => <option key={seconds} value={seconds}>{seconds === 0 ? 'Langsung — wajib login ulang' : seconds < 60 ? `${seconds} detik` : `${seconds / 60} menit`}</option>)}</select></label>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Berlaku untuk semua akun dan perangkat. Jika kembali sebelum jeda berakhir, sesi tetap aktif. Setelah batas waktu, tab tetap terbuka pada halaman login.</p>
      <details className="rounded-xl border border-[var(--theme-card-border)] px-3"><summary className="min-h-11 flex items-center cursor-pointer text-xs font-medium">Perlindungan data & pengecualian</summary><p className="pb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Antrean offline dan draf yang sudah tersimpan tidak dihapus; masuk kembali dengan akun yang sama untuk melanjutkan. Login ulang memerlukan koneksi internet. Simpan pekerjaan sebelum berpindah aplikasi. Pemilih foto/berkas dan cetak mendapat pengecualian sementara maksimal 3 menit; penghubungan Google Drive maksimal 5 menit. Saat fitur OFF, batas inaktivitas yang sudah ada tetap berlaku.</p></details>
      {feedback && <p role={failed ? 'alert' : 'status'} className="text-sm leading-relaxed text-[var(--theme-primary-text)]">{feedback}</p>}
      <Button type="submit" disabled={saving || !dirty}>{saving ? 'Menyimpan…' : 'Simpan pengaturan sesi'}</Button>
    </form>
  </CardContent></Card>;
}
