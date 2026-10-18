import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import { sanitizeLoginAppearance, type LoginAppearanceConfig } from '../../types/loginAppearance.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { LoginBackdrop } from '../auth/LoginBackdrop';

export function LoginAppearanceSettingsCard({ settings, onSaved }: { settings: SchoolSettings; onSaved: (value: SchoolSettings) => void }) {
  const { currentUser } = useAuth();
  const [draft, setDraft] = useState(() => sanitizeLoginAppearance(settings.loginAppearance));
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const configKey = JSON.stringify(settings.loginAppearance);
  useEffect(() => { if (!dirty && !busy) setDraft(sanitizeLoginAppearance(settings.loginAppearance)); }, [configKey, dirty, busy]);
  if (currentUser?.role !== 'ADMIN') return null;
  const edit = (patch: Partial<LoginAppearanceConfig>) => { setDraft(v => ({ ...v, ...patch })); setDirty(true); setMessage(''); setError(''); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !dirty) return; setBusy(true); setError(''); setMessage('');
    try { const result = await SchoolSettingsService.saveLoginAppearanceSettings(draft, currentUser.id); onSaved(result.settings); setDirty(false); setMessage(result.confirmed ? 'Tampilan login tersimpan. Berlaku saat halaman login dibuka kembali.' : 'Pengaturan terkirim. Periksa kembali saat koneksi stabil.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Pengaturan belum tersimpan.'); } finally { setBusy(false); }
  };
  return <Card><CardHeader title="Tampilan halaman login" subtitle="Motion background dan teks pengembang untuk mobile serta desktop." /><CardContent><form onSubmit={save} className="space-y-5">
    <fieldset disabled={busy} className="space-y-4 min-w-0">
      <label className="history-field"><span>Pemakaian data latar</span><select aria-label="Pemakaian data latar" value={draft.mediaPolicy} onChange={e => edit({ mediaPolicy: e.target.value as LoginAppearanceConfig['mediaPolicy'] })}><option value="economy">Hemat (disarankan)</option><option value="adaptive">Adaptif sesuai koneksi</option><option value="always">Izinkan video</option></select></label>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Mode hemat memakai gradasi bergerak tanpa mengunduh foto atau video latar. Mode adaptif memakai gradasi bila koneksi lambat, hemat data aktif, atau jenis koneksi tidak dapat dideteksi. Deteksi koneksi cepat tidak berarti Wi-Fi.</p>
      <Button type="button" variant="outline" onClick={() => edit({ mediaPolicy: 'economy', background: 'gradient', speed: 'slow', intensity: 'soft' })}>Gunakan mode hemat</Button>
      <label className="flex items-center justify-between gap-4 min-h-11"><span className="text-sm font-medium">Aktifkan motion background</span><input type="checkbox" role="switch" checked={draft.motionEnabled} onChange={e => edit({ motionEnabled: e.target.checked })} className="w-5 h-5 shrink-0 accent-[var(--theme-primary)]" /></label>
      <div className="grid gap-4 sm:grid-cols-2 min-w-0">
        <label className="history-field"><span>Jenis latar login</span><select aria-label="Jenis latar login" disabled={!draft.motionEnabled || draft.mediaPolicy === 'economy'} value={draft.mediaPolicy === 'economy' ? 'gradient' : draft.background} onChange={e => edit({ background: e.target.value as LoginAppearanceConfig['background'] })}><option value="ocean">Laut & langit — video acuan</option><option value="gradient">Gradasi lembut — mengikuti tema</option></select></label>
        <label className="history-field"><span>Kecepatan latar</span><select aria-label="Kecepatan latar" disabled={!draft.motionEnabled} value={draft.speed} onChange={e => edit({ speed: e.target.value as LoginAppearanceConfig['speed'] })}><option value="slow">Lambat</option><option value="normal">Normal</option><option value="fast">Cepat</option></select></label>
        <label className="history-field"><span>Intensitas latar</span><select aria-label="Intensitas latar" disabled={!draft.motionEnabled} value={draft.intensity} onChange={e => edit({ intensity: e.target.value as LoginAppearanceConfig['intensity'] })}><option value="soft">Lembut</option><option value="clear">Lebih jelas</option></select></label>
      </div>
      <div aria-label="Pratinjau latar login" className="relative h-48 rounded-2xl overflow-hidden border border-[var(--theme-card-border)] bg-[var(--theme-bg-app)] grid place-items-center"><LoginBackdrop config={draft} preview /><div className="relative z-10 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-5 text-center shadow-sm"><p className="text-sm font-semibold">PIKET GURU</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pratinjau warna dan intensitas</p></div></div>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Jika diizinkan, video sekitar 626 KB dimuat setelah tampilan awal login, tanpa suara; gambar cadangan sekitar 15 KB. Mode hemat tidak memuat keduanya. Gerakan dijeda saat tab tidak aktif. Pratinjau mengikuti mode hemat; pratinjau video memakai gambar diam.</p>
      <label className="flex items-center justify-between gap-4 min-h-11"><span className="text-sm font-medium">Teks pengembang berjalan</span><input type="checkbox" role="switch" checked={draft.runningCredit} onChange={e => edit({ runningCredit: e.target.checked })} className="w-5 h-5 shrink-0 accent-[var(--theme-primary)]" /></label>
      <label className="history-field"><span>Durasi satu putaran teks</span><select aria-label="Durasi satu putaran teks" disabled={!draft.runningCredit} value={draft.creditDuration} onChange={e => edit({ creditDuration: Number(e.target.value) })}>{[20,30,45,60].map(n => <option key={n} value={n}>{n} detik</option>)}</select></label>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Ketuk teks pengembang di login untuk jeda/putar. Jika gerakan dikurangi pada perangkat, teks tampil diam dan utuh. Nama pengembang mengikuti Profil Sekolah.</p>
    </fieldset>
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}{message && <p role="status" className="text-sm text-[var(--theme-primary-text)]">{message}</p>}
    <Button type="submit" disabled={!dirty || busy} isLoading={busy}>Simpan tampilan login</Button>
  </form></CardContent></Card>;
}
