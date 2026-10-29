import React, { useEffect, useState } from 'react';
import { Clock, Save } from '../../components/icons';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { SchoolSettings } from '../../types';
import {
  CHECKOUT_REMINDER_DELAYS, CHECKOUT_REMINDER_SNOOZES,
  normalizeCheckoutReminderConfig, type CheckoutReminderConfig,
} from '../../types/checkoutReminder.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';

interface Props {
  settings: SchoolSettings;
  settingsReady: boolean;
  onSaved: (settings: SchoolSettings) => void;
}

/** A separate form intentionally does not submit the school profile/GPS form. */
export function CheckoutReminderSettingsCard({ settings, settingsReady, onSaved }: Props) {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [draft, setDraft] = useState<CheckoutReminderConfig>(() => normalizeCheckoutReminderConfig(settings.checkoutReminderConfig));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const configJson = JSON.stringify(settings.checkoutReminderConfig);

  useEffect(() => {
    if (!dirty && !saving) setDraft(normalizeCheckoutReminderConfig(settings.checkoutReminderConfig));
  }, [configJson, dirty, saving]);

  if (!isAdmin) return null;
  const change = (patch: Partial<CheckoutReminderConfig>) => {
    setDraft(previous => ({ ...previous, ...patch }));
    setDirty(true);
    setMessage('');
    setError(false);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !currentUser?.id || saving || !settingsReady || !dirty) return;
    setSaving(true);
    setMessage('');
    setError(false);
    try {
      const previous = normalizeCheckoutReminderConfig(settings.checkoutReminderConfig);
      const result = await SchoolSettingsService.saveCheckoutReminderConfig(draft, currentUser.id, previous);
      onSaved(result.settings);
      setDirty(false);
      setMessage(result.confirmed
        ? 'Pengingat Presensi berhasil disimpan. Perubahan berlaku pada dashboard guru yang tersambung.'
        : 'Perubahan berhasil dikirim, tetapi verifikasi baca ulang belum tersedia. Muat ulang setelah jaringan stabil; jangan menyimpan dua kali.');
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Pengaturan pengingat belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div id="pengingat-presensi" className="scroll-mt-6">
      <Card>
        <CardHeader title="Pengingat Presensi" subtitle="Pengaturan Admin untuk pengingat checkout pada dashboard guru (R89-D)." />
        <CardContent>
          <form onSubmit={save} className="space-y-5 min-w-0">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--theme-card-border)] p-3 cursor-pointer">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">Aktifkan pengingat presensi pulang</span>
                <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Tampilkan pengingat kepada guru yang telah presensi masuk tetapi belum presensi pulang.</span>
              </span>
              <input type="checkbox" role="switch" aria-label="Aktifkan pengingat presensi pulang" checked={draft.enabled}
                disabled={saving || !settingsReady} onChange={event => change({ enabled: event.target.checked })}
                className="h-5 w-5 shrink-0 accent-[var(--theme-primary)]" />
            </label>
            <fieldset disabled={!draft.enabled || saving || !settingsReady} className="grid grid-cols-1 sm:grid-cols-2 gap-4 disabled:opacity-60">
              <label className="min-w-0 space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="block">Mulai ingatkan setelah jam pulang dibuka</span>
                <select value={draft.delayMinutes} onChange={event => change({ delayMinutes: Number(event.target.value) })}
                  aria-label="Jeda mulai pengingat setelah jam presensi pulang dibuka"
                  className="w-full min-h-11 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3 text-sm">
                  {CHECKOUT_REMINDER_DELAYS.map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? 'Langsung saat dibuka (disarankan)' : `${minutes} menit setelah dibuka`}</option>)}
                </select>
              </label>
              <label className="min-w-0 space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="block">Durasi tombol “Ingatkan lagi”</span>
                <select value={draft.snoozeMinutes} onChange={event => change({ snoozeMinutes: Number(event.target.value) })}
                  aria-label="Durasi tunda pengingat presensi"
                  className="w-full min-h-11 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] px-3 text-sm">
                  {CHECKOUT_REMINDER_SNOOZES.map(minutes => <option key={minutes} value={minutes}>{minutes} menit{minutes === 20 ? ' (disarankan)' : ''}</option>)}
                </select>
              </label>
            </fieldset>
            <label className={`flex items-center justify-between gap-4 rounded-xl border border-[var(--theme-card-border)] p-3 cursor-pointer ${!draft.enabled ? 'opacity-60' : ''}`}>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Tampilkan petunjuk pada mode presensi bebas</span>
                <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Pengingat ringan tanpa jam tertentu ketika mode presensi bebas aktif dan guru belum checkout.</span>
              </span>
              <input type="checkbox" role="switch" aria-label="Petunjuk presensi pulang pada mode bebas"
                checked={draft.freeModeHintEnabled} disabled={!draft.enabled || saving || !settingsReady}
                onChange={event => change({ freeModeHintEnabled: event.target.checked })}
                className="h-5 w-5 shrink-0 accent-[var(--theme-primary)]" />
            </label>
            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--theme-surface-subtle)] p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Jam acuan mengikuti jadwal pulang tiap hari di bagian <strong>Konfigurasi Jam Shift</strong>. Pengingat hanya muncul ketika dashboard guru dibuka, bukan notifikasi push atau WhatsApp. Tidak mencatat checkout otomatis, tidak mengubah pengaturan logout, dan tidak mengubah monitoring R89-C.</p>
            </div>
            {!settingsReady && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Status pengaturan sekolah belum siap. Muat ulang halaman saat terhubung ke server.</p>}
            {message && <p role={error ? 'alert' : 'status'} className={`text-xs leading-relaxed ${error ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{message}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {dirty && <Button type="button" variant="outline" disabled={saving} onClick={() => { setDraft(normalizeCheckoutReminderConfig(settings.checkoutReminderConfig)); setDirty(false); setMessage(''); setError(false); }}>Batalkan perubahan</Button>}
              <Button type="submit" disabled={!settingsReady || saving || !dirty} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                Simpan Pengingat Presensi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
