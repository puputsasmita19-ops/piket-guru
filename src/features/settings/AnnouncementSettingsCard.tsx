import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Save } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { sanitizeAnnouncementConfig, type AnnouncementConfig } from '../../types/announcement.types';
import type { SchoolSettings } from '../../types';

export const AnnouncementSettingsCard: React.FC<{ settings: SchoolSettings; onSaved: (settings: SchoolSettings) => void }> = ({ settings, onSaved }) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [draft, setDraft] = useState(() => sanitizeAnnouncementConfig(settings.announcementConfig));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [live, setLive] = useState<SchoolSettings | null>(null);
  // SettingsView loads its school profile once. Subscribe here without resetting an unsaved draft.
  useEffect(() => FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', setLive), []);
  const config = JSON.stringify((live || settings).announcementConfig);
  useEffect(() => {
    if (!dirty && !saving) setDraft(sanitizeAnnouncementConfig((live || settings).announcementConfig));
  }, [config, dirty, saving]);
  const change = (key: keyof AnnouncementConfig, value: boolean) => {
    setDraft(previous => ({ ...previous, [key]: value })); setDirty(true); setFeedback('');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !currentUser || saving) return;
    setSaving(true); setFeedback('');
    try {
      const result = await SchoolSettingsService.saveAnnouncementSettings(draft, currentUser.id);
      setLive(result.settings); onSaved(result.settings); setDirty(false);
      setFeedback(result.confirmed ? 'Pengaturan papan pengumuman tersimpan.' : 'Pengaturan terkirim. Periksa kembali saat koneksi stabil.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Pengaturan gagal disimpan. Coba lagi.'); }
    finally { setSaving(false); }
  };
  if (!isAdmin) return null;
  return <Card><CardHeader title="Papan Pengumuman" subtitle="Atur pengeditan informasi yang sudah diterbitkan." />
    <CardContent><form onSubmit={save} className="space-y-4">
      <div className="divide-y divide-[var(--theme-card-border)]">
        {([
          ['allowPublishedEditing', 'Izinkan edit pengumuman terbit', 'Admin dan kepala sekolah dapat mengubah judul, isi, prioritas, serta sasaran pengumuman.'],
          ['showUpdateInfo', 'Tampilkan keterangan pembaruan', 'Tampilkan waktu pembaruan dan nama pengedit di papan pengumuman.'],
        ] as const).map(([key, label, hint]) => <label key={key} className="flex items-center justify-between gap-4 min-h-[60px] py-3 cursor-pointer">
          <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{hint}</span></span>
          <span className="flex items-center justify-center w-11 h-11 shrink-0"><input type="checkbox" role="switch" aria-label={label} checked={draft[key]} disabled={saving} onChange={e => change(key, e.target.checked)} className="w-5 h-5 accent-[var(--theme-primary)]" /></span>
        </label>)}
      </div>
      <p className="text-xs leading-relaxed p-3 rounded-xl bg-[var(--theme-surface-subtle)]">Perubahan tersimpan diterima otomatis oleh pengguna yang sedang online. Tanggal terbit dan pembuat asli tetap dipertahankan. Pengaturan pemberitahuan melalui ikon lonceng tersedia di bawah.</p>
      {feedback && <p role="status" className="text-sm text-[var(--theme-primary-text)]">{feedback}</p>}
      <Button type="submit" disabled={saving || !dirty} isLoading={saving} leftIcon={<Save className="w-4 h-4" />} className="w-full sm:w-auto">Simpan pengaturan pengumuman</Button>
    </form></CardContent>
  </Card>;
};
