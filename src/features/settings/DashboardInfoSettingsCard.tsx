import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Save } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import { DASHBOARD_INFO_INTERVALS, DASHBOARD_INFO_PANELS, sanitizeDashboardInfoConfig, type DashboardInfoConfig, type DashboardInfoPanel } from '../../types/dashboardInfo.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';

export function DashboardInfoSettingsCard({ settings, onSaved }: { settings: SchoolSettings; onSaved: (value: SchoolSettings) => void }) {
  const { currentUser, hasRole } = useAuth();
  const admin = hasRole('ADMIN');
  const [draft, setDraft] = useState(() => sanitizeDashboardInfoConfig(settings.dashboardInfoConfig));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const configJson = JSON.stringify(settings.dashboardInfoConfig);
  useEffect(() => { if (!dirty && !saving) setDraft(sanitizeDashboardInfoConfig(settings.dashboardInfoConfig)); }, [configJson, dirty, saving]);
  const change = (patch: Partial<DashboardInfoConfig>) => { setDraft(v => ({ ...v, ...patch })); setDirty(true); setFeedback(''); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !currentUser || saving) return;
    setSaving(true); setFeedback(''); setFailed(false);
    try {
      const result = await SchoolSettingsService.saveDashboardInfoSettings(draft, currentUser.id);
      onSaved(result.settings); setDirty(false);
      setFeedback(result.confirmed ? 'Pengaturan flash info tersimpan dan diterapkan pada dashboard pengguna.' : 'Pengaturan terkirim. Periksa kembali saat koneksi stabil.');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Pengaturan belum tersimpan. Coba kembali.'); }
    finally { setSaving(false); }
  };
  if (!admin) return null;
  return <Card><CardHeader title="Flash Info Dashboard" subtitle="Banner kegiatan dan informasi sekolah dalam satu rangkaian slide horizontal di atas pintasan." /><CardContent>
    <form onSubmit={save} className="space-y-5">
      <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer"><span><span className="block font-semibold text-sm">Tampilkan flash info</span><span className="text-xs text-slate-500 dark:text-slate-400">Tambahkan panel info setelah slide kegiatan, sesuai hak akses pengguna.</span></span><input type="checkbox" role="switch" checked={draft.enabled} disabled={saving} onChange={e => change({ enabled: e.target.checked })} className="w-5 h-5 accent-[var(--theme-primary)] shrink-0" /></label>
      <fieldset disabled={saving || !draft.enabled} className="space-y-4 disabled:opacity-60">
        <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer"><span className="text-sm font-semibold">Ganti slide otomatis</span><input type="checkbox" role="switch" checked={draft.autoPlay} onChange={e => change({ autoPlay: e.target.checked })} className="w-5 h-5 accent-[var(--theme-primary)]" /></label>
        <label className="block text-xs font-semibold">Jeda pergantian slide<select value={draft.intervalMs} disabled={!draft.autoPlay} onChange={e => change({ intervalMs: Number(e.target.value) })} className="block w-full sm:max-w-xs min-h-[44px] mt-2 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3">{DASHBOARD_INFO_INTERVALS.map(ms => <option key={ms} value={ms}>{(ms / 1000).toLocaleString('id-ID')} detik</option>)}</select></label>
        <div><p className="text-sm font-semibold mb-2">Informasi yang ditampilkan</p><div className="grid sm:grid-cols-2 gap-2">{Object.entries(DASHBOARD_INFO_PANELS).map(([key, label]) => <label key={key} className="flex items-center gap-3 min-h-[44px] border border-[var(--theme-card-border)] rounded-xl p-3 text-xs cursor-pointer"><input type="checkbox" checked={draft.panels[key as DashboardInfoPanel]} onChange={e => change({ panels: { ...draft.panels, [key]: e.target.checked } })} className="w-4 h-4 shrink-0 accent-[var(--theme-primary)]" />{label}</label>)}</div></div>
      </fieldset>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Pilihan jeda tersedia dari 2 sampai 60 detik. Waktu baca dimulai setelah animasi selesai. Data mengikuti pembaruan dashboard yang sudah tersedia. Pengguna dapat menggeser ke samping, menjeda, atau mengganti slide dengan tombol. Pergantian berhenti saat panel sedang dibaca dengan kursor/fokus, tab tidak aktif, atau perangkat mengurangi gerakan. Saat flash info OFF, slide kegiatan tetap tersedia sendiri. Papan pengumuman tetap dapat dibuka dari panel maupun notifikasi.</p>
      {feedback && <p role={failed ? 'alert' : 'status'} className="text-sm text-[var(--theme-primary-text)]">{feedback}</p>}
      <Button type="submit" disabled={!dirty || saving} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>Simpan flash info</Button>
    </form>
  </CardContent></Card>;
}
