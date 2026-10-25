import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import type { SchoolSettings } from '../../types';
import { BACKGROUND_LOGOUT_DELAYS, formatBackgroundLogoutDelay, sanitizeSessionPolicy } from '../../types/sessionPolicy.types';
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['mobile', 'desktop'] as const).map(device => {
          const title = device === 'mobile' ? 'Mobile / Tablet' : 'Desktop / Laptop';
          const policy = draft[device];
          return <fieldset key={device} disabled={saving} className="min-w-0 rounded-xl border border-[var(--theme-card-border)] p-3 space-y-3">
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer"><span className="text-sm">Keluar saat aplikasi ditinggalkan</span><input type="checkbox" role="switch" aria-label={`Keluar otomatis ${title}`} checked={policy.backgroundLogoutEnabled} onChange={e => { setDraft(v => ({ ...v, [device]: { ...v[device], backgroundLogoutEnabled: e.target.checked } })); setDirty(true); setFeedback(''); }} className="h-5 w-5 shrink-0 accent-[var(--theme-primary)]" /></label>
            <label className="history-field block min-w-0"><span>Jeda sebelum keluar</span><select aria-label={`Jeda keluar ${title}`} disabled={saving || !policy.backgroundLogoutEnabled} value={policy.backgroundDelaySeconds} onChange={e => { setDraft(v => ({ ...v, [device]: { ...v[device], backgroundDelaySeconds: Number(e.target.value) } })); setDirty(true); setFeedback(''); }} className="w-full min-h-11 mt-2 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3">{BACKGROUND_LOGOUT_DELAYS.map(seconds => <option key={seconds} value={seconds}>{formatBackgroundLogoutDelay(seconds)}{seconds === 1800 ? ' — direkomendasikan' : ''}</option>)}</select></label>
          </fieldset>;
        })}
      </div>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Disarankan 30 menit pada HP/tablet pribadi. Untuk desktop/laptop pribadi, fitur ini boleh OFF karena batas tanpa aktivitas 30 menit tetap berlaku. Perangkat bersama sebaiknya menggunakan jeda lebih singkat, tetapi pengaturan ini berlaku untuk <strong>semua pengguna berdasarkan jenis perangkat</strong>, bukan per perangkat pribadi/bersama. Nilai yang sudah tersimpan tidak berubah sampai Admin menyimpannya.</p>
      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">Jeda di atas dihitung sejak aplikasi ditinggalkan, bukan sejak interaksi terakhir. Pilihan 1–2 jam hanya memperpanjang jeda background; sistem tetap memiliki logout inaktivitas terpisah setelah 30 menit tanpa interaksi, yang dapat lebih dulu mengakhiri sesi.</p>
      <details className="rounded-xl border border-[var(--theme-card-border)] px-3"><summary className="min-h-11 flex items-center cursor-pointer text-xs font-medium">Perlindungan data & pengecualian</summary><p className="pb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Antrean offline dan draf yang sudah tersimpan tidak dihapus; masuk kembali dengan akun yang sama untuk melanjutkan. Login ulang memerlukan koneksi internet. Simpan pekerjaan sebelum berpindah aplikasi. Pemilih foto/berkas dan cetak mendapat pengecualian sementara maksimal 3 menit; penghubungan Google Drive maksimal 5 menit. Saat fitur OFF, batas inaktivitas 30 menit yang sudah ada tetap berlaku. Pengelompokan berdasarkan jenis perangkat dari browser, bukan lebar jendela.</p></details>
      {feedback && <p role={failed ? 'alert' : 'status'} className="text-sm leading-relaxed text-[var(--theme-primary-text)]">{feedback}</p>}
      <Button type="submit" disabled={saving || !dirty}>{saving ? 'Menyimpan…' : 'Simpan pengaturan sesi'}</Button>
    </form>
  </CardContent></Card>;
}
