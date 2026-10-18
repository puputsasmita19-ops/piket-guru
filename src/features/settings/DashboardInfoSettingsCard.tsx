import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Save } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import { DASHBOARD_INFO_INTERVALS, DASHBOARD_INFO_PANELS, sanitizeDashboardInfoConfig, type DashboardInfoConfig, type DashboardInfoPanel } from '../../types/dashboardInfo.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { getDashboardWelcome, WELCOME_CATEGORIES, WELCOME_INTERVALS, WELCOME_TEMPLATES, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';
import { useMinuteClock } from '../../hooks/useMinuteClock';

function WelcomePreview({ config }: { config: DashboardWelcomeConfig }) {
  const { greeting, message } = getDashboardWelcome(config, useMinuteClock());
  return <div aria-label="Pratinjau sapaan dashboard" className="rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-surface-subtle)] p-4 space-y-1">
    <p className="text-xs text-slate-500 dark:text-slate-400">{greeting}</p>
    <p className="text-lg font-semibold">Halo, Admin</p>
    {message && <p className="text-xs leading-relaxed break-words text-slate-600 dark:text-slate-300">{message}</p>}
  </div>;
}

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
  const changeWelcome = (patch: Partial<DashboardWelcomeConfig>) => change({ welcome: { ...draft.welcome, ...patch } });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !currentUser || saving) return;
    if (draft.welcome.enabled && draft.welcome.mode === 'custom' && !draft.welcome.customMessage.trim()) {
      setFailed(true); setFeedback('Isi kalimat sendiri terlebih dahulu atau pilih template yang tersedia.'); return;
    }
    setSaving(true); setFeedback(''); setFailed(false);
    try {
      const result = await SchoolSettingsService.saveDashboardInfoSettings(draft, currentUser.id);
      onSaved(result.settings); setDirty(false);
      setFeedback(result.confirmed ? 'Pengaturan info dashboard tersimpan dan diterapkan pada dashboard pengguna.' : 'Pengaturan terkirim. Periksa kembali saat koneksi stabil.');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Pengaturan belum tersimpan. Coba kembali.'); }
    finally { setSaving(false); }
  };
  if (!admin) return null;
  return <Card><CardHeader title="Sapaan & Flash Info Dashboard" subtitle="Atur kalimat penyemangat dan informasi sekolah untuk dashboard mobile maupun desktop." /><CardContent>
    <form onSubmit={save} className="space-y-5">
      <section aria-labelledby="dashboard-welcome-settings" className="space-y-4 min-w-0">
        <div><h3 id="dashboard-welcome-settings" className="text-sm font-semibold">Sapaan dashboard</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Sapaan otomatis mengikuti WIB: pagi 04.00–10.59, siang 11.00–14.59, sore 15.00–17.59, dan malam 18.00–03.59.</p></div>
        <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer"><span className="text-sm font-medium">Tampilkan kalimat penyemangat</span><input type="checkbox" role="switch" checked={draft.welcome.enabled} disabled={saving} onChange={e => changeWelcome({ enabled: e.target.checked })} className="w-5 h-5 shrink-0 accent-[var(--theme-primary)]" /></label>
        <fieldset disabled={saving || !draft.welcome.enabled} className="grid gap-4 sm:grid-cols-2 min-w-0 disabled:opacity-60">
          <label className="history-field min-w-0"><span>Cara menampilkan kalimat</span><select aria-label="Cara menampilkan kalimat" value={draft.welcome.mode} onChange={e => changeWelcome({ mode: e.target.value as DashboardWelcomeConfig['mode'] })}>
            <option value="fixed">Tetap — pilih template</option><option value="daily">Otomatis setiap hari</option><option value="interval">Otomatis berkala</option><option value="custom">Kalimat sendiri</option>
          </select></label>
          {draft.welcome.mode === 'fixed' && <label className="history-field min-w-0 sm:col-span-2"><span>Template kalimat</span><select aria-label="Template kalimat" value={draft.welcome.templateId} onChange={e => changeWelcome({ templateId: e.target.value })}>{Object.entries(WELCOME_CATEGORIES).filter(([key]) => key !== 'all').map(([key, label]) => <optgroup key={key} label={label}>{WELCOME_TEMPLATES.filter(t => t.category === key).map(t => <option key={t.id} value={t.id}>{t.text}</option>)}</optgroup>)}</select></label>}
          {(draft.welcome.mode === 'daily' || draft.welcome.mode === 'interval') && <label className="history-field min-w-0"><span>Kategori kalimat otomatis</span><select aria-label="Kategori kalimat otomatis" value={draft.welcome.category} onChange={e => changeWelcome({ category: e.target.value as DashboardWelcomeConfig['category'] })}>{Object.entries(WELCOME_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
          {draft.welcome.mode === 'interval' && <label className="history-field min-w-0"><span>Jeda pergantian kalimat</span><select aria-label="Jeda pergantian kalimat" value={draft.welcome.intervalMinutes} onChange={e => changeWelcome({ intervalMinutes: Number(e.target.value) })}>{WELCOME_INTERVALS.map(minutes => <option key={minutes} value={minutes}>{minutes} menit</option>)}</select></label>}
          {draft.welcome.mode === 'custom' && <label className="history-field min-w-0 sm:col-span-2"><span>Kalimat sendiri</span><textarea aria-label="Kalimat sendiri" value={draft.welcome.customMessage} maxLength={180} rows={3} required={draft.welcome.enabled} placeholder="Tulis kalimat singkat yang ramah untuk warga sekolah…" onChange={e => changeWelcome({ customMessage: e.target.value })} /><span className="font-normal text-slate-500">{draft.welcome.customMessage.length}/180 karakter</span></label>}
        </fieldset>
        <WelcomePreview config={draft.welcome} />
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Tersedia 15 template siap pakai. Mode harian berganti saat tanggal WIB berubah; mode berkala mengikuti jeda yang dipilih. Pengaturan berlaku untuk semua pengguna setelah disimpan. Kalimat tetap tampil saat flash info dinonaktifkan.</p>
      </section>
      <h3 className="border-t border-[var(--theme-card-border)] pt-5 text-sm font-semibold">Flash info sekolah</h3>
      <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer"><span><span className="block font-semibold text-sm">Tampilkan flash info</span><span className="text-xs text-slate-500 dark:text-slate-400">Tambahkan panel info setelah slide kegiatan, sesuai hak akses pengguna.</span></span><input type="checkbox" role="switch" checked={draft.enabled} disabled={saving} onChange={e => change({ enabled: e.target.checked })} className="w-5 h-5 accent-[var(--theme-primary)] shrink-0" /></label>
      <fieldset disabled={saving || !draft.enabled} className="space-y-4 disabled:opacity-60">
        <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer"><span className="text-sm font-semibold">Ganti slide otomatis</span><input type="checkbox" role="switch" checked={draft.autoPlay} onChange={e => change({ autoPlay: e.target.checked })} className="w-5 h-5 accent-[var(--theme-primary)]" /></label>
        <label className="block text-xs font-semibold">Jeda pergantian slide<select value={draft.intervalMs} disabled={!draft.autoPlay} onChange={e => change({ intervalMs: Number(e.target.value) })} className="block w-full sm:max-w-xs min-h-[44px] mt-2 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3">{DASHBOARD_INFO_INTERVALS.map(ms => <option key={ms} value={ms}>{(ms / 1000).toLocaleString('id-ID')} detik</option>)}</select></label>
        <div><p className="text-sm font-semibold mb-2">Informasi yang ditampilkan</p><div className="grid sm:grid-cols-2 gap-2">{Object.entries(DASHBOARD_INFO_PANELS).map(([key, label]) => <label key={key} className="flex items-center gap-3 min-h-[44px] border border-[var(--theme-card-border)] rounded-xl p-3 text-xs cursor-pointer"><input type="checkbox" checked={draft.panels[key as DashboardInfoPanel]} onChange={e => change({ panels: { ...draft.panels, [key]: e.target.checked } })} className="w-4 h-4 shrink-0 accent-[var(--theme-primary)]" />{label}</label>)}</div></div>
      </fieldset>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Pilihan jeda tersedia dari 2 sampai 60 detik. Waktu baca dimulai setelah animasi selesai. Data mengikuti pembaruan dashboard yang sudah tersedia. Pengguna dapat menggeser ke samping, menjeda, atau mengganti slide dengan tombol. Pergantian berhenti saat panel sedang dibaca dengan kursor/fokus, tab tidak aktif, atau perangkat mengurangi gerakan. Saat flash info OFF, slide kegiatan tetap tersedia sendiri. Papan pengumuman tetap dapat dibuka dari panel maupun notifikasi.</p>
      {feedback && <p role={failed ? 'alert' : 'status'} className="text-sm text-[var(--theme-primary-text)]">{feedback}</p>}
      <Button type="submit" disabled={!dirty || saving} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>Simpan info dashboard</Button>
    </form>
  </CardContent></Card>;
}
