import React, { useEffect, useState } from 'react';
import { Bell, Save } from '../../components/icons';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import { NOTIFICATION_MODULES, sanitizeNotificationConfig, type NotificationConfig, type NotificationModule } from '../../types/notification.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';

export const NotificationSettingsCard: React.FC<{ settings: SchoolSettings; onSaved: (settings: SchoolSettings) => void }> = ({ settings, onSaved }) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [draft, setDraft] = useState(() => sanitizeNotificationConfig(settings.notificationConfig));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const configJson = JSON.stringify(settings.notificationConfig);
  useEffect(() => { if (!dirty && !saving) setDraft(sanitizeNotificationConfig(settings.notificationConfig)); }, [configJson, dirty, saving]);
  const change = (patch: Partial<NotificationConfig>) => { setDraft(d => ({ ...d, ...patch })); setDirty(true); setFeedback(''); };
  const toggle = (key: 'enabled' | 'sessionEvents' | 'operationalUpdates' | 'announcements', label: string, description: string) => <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
    <span className="min-w-0"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span><span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</span></span>
    <input type="checkbox" role="switch" checked={draft[key]} onChange={e => change({ [key]: e.target.checked })} disabled={!isAdmin || saving || (key !== 'enabled' && !draft.enabled)} className="w-5 h-5 shrink-0 accent-[var(--theme-primary)] cursor-pointer" />
  </label>;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !currentUser || saving) return;
    setSaving(true); setFeedback('');
    try {
      const result = await SchoolSettingsService.saveNotificationSettings(draft, currentUser.id);
      onSaved(result.settings); setDirty(false);
      setFeedback(result.confirmed ? 'Pengaturan notifikasi tersimpan dan diterapkan ke pengguna yang sedang online.' : 'Pengaturan terkirim. Periksa kembali setelah koneksi stabil.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan. Silakan coba lagi.'); }
    finally { setSaving(false); }
  };
  return <Card><CardHeader title="Notifikasi Realtime" subtitle="Atur informasi pada ikon lonceng untuk seluruh pengguna. Hak akses menu tetap berlaku." />
    <CardContent><form onSubmit={save} className="space-y-5">
      <div className="divide-y divide-[var(--theme-card-border)]">
        {toggle('enabled', 'Aktifkan notifikasi aplikasi', 'Pembaruan langsung saat aplikasi terbuka dan terhubung ke internet.')}
        {toggle('sessionEvents', 'Riwayat masuk & keluar pribadi', 'Setiap akun hanya melihat login dan logout miliknya. Logout terlihat saat masuk kembali.')}
        {toggle('operationalUpdates', 'Pembaruan dari pengguna lain', 'Ringkasan data baru, perubahan, dan status pada menu yang dapat diakses pengguna.')}
        {toggle('announcements', 'Papan pengumuman & instruksi khusus piket', 'Pengumuman aktif mengikuti sasaran penerima. Pengeditan pengumuman ditandai sebagai informasi baru.')}
      </div>
      <fieldset disabled={!isAdmin || saving || !draft.enabled || !draft.operationalUpdates} className="space-y-3 disabled:opacity-60">
        <legend className="text-sm font-bold mb-3">Sumber pembaruan data</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{Object.entries(NOTIFICATION_MODULES).map(([key, module]) => <label key={key} className="flex items-center gap-3 min-h-[44px] px-3 py-2 border border-[var(--theme-card-border)] rounded-xl text-xs cursor-pointer"><input type="checkbox" checked={draft.modules[key as NotificationModule]} onChange={e => change({ modules: { ...draft.modules, [key]: e.target.checked } })} className="w-4 h-4 accent-[var(--theme-primary)]" />{module.label}</label>)}</div>
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-xs font-semibold space-y-2"><span className="block">Rentang aktivitas</span><select disabled={!isAdmin || saving} value={draft.historyDays} onChange={e => change({ historyDays: Number(e.target.value) })} className="w-full min-h-[44px] border border-[var(--theme-card-border)] rounded-xl px-3 bg-[var(--theme-card-bg)]">{[1, 3, 7].map(n => <option key={n} value={n}>{n} hari terakhir</option>)}</select></label>
        <label className="text-xs font-semibold space-y-2"><span className="block">Batas informasi ditampilkan</span><select disabled={!isAdmin || saving} value={draft.maxItems} onChange={e => change({ maxItems: Number(e.target.value) })} className="w-full min-h-[44px] border border-[var(--theme-card-border)] rounded-xl px-3 bg-[var(--theme-card-bg)]">{[20, 30, 50].map(n => <option key={n} value={n}>{n} informasi terbaru</option>)}</select></label>
      </div>
      <div className="p-3 rounded-xl bg-[var(--theme-surface-subtle)] text-xs text-slate-600 dark:text-slate-300 leading-relaxed"><Bell className="w-4 h-4 inline mr-1.5" />Buat informasi admin melalui Dashboard → Papan Pengumuman & Instruksi Khusus Piket. Data foto dan isi sensitif tidak disalin ke notifikasi aktivitas. Batas rentang menyaring tampilan, bukan menghapus data atau log audit.</div>
      {feedback && <p role="status" className="text-sm font-medium text-[var(--theme-primary-text)]">{feedback}</p>}
      {isAdmin && <Button type="submit" disabled={saving || !dirty} className="w-full sm:w-auto"><Save className="w-4 h-4 mr-2" />{saving ? 'Menyimpan…' : 'Simpan pengaturan notifikasi'}</Button>}
    </form></CardContent>
  </Card>;
};
