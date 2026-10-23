import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Volume2,
  AlertOctagon,
  Flame,
  ShieldAlert,
  Megaphone,
  CheckCircle2,
  Radio,
  Send,
  BellRing,
  VolumeX,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { SchoolBellService } from '../../services/audio/bellService';
import { EmergencyService } from '../../services/notifications/emergencyService';
import { EmergencyAlert, EmergencyType } from '../../types/security.types';
import { normalizeCommandCenterConfig, EMERGENCY_TYPES, BELL_DAY_LABELS, type CommandCenterConfig } from '../../types/commandCenterConfig.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface BellEmergencyAutomationCardProps {
  schoolName: string;
  config?: CommandCenterConfig;
  onConfigureEmergency?: (type: EmergencyType) => void;
  onConfigureSchedule?: () => void;
  onConfigureCustom?: () => void;
  onConfigureCommandPost?: () => void;
}

/** Time display is always interpreted in the school's WIB timezone, not device timezone. */
function wibClock(now: Date): {day: number; seconds: number} {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta', hour:'2-digit', minute:'2-digit', second:'2-digit', weekday:'short', hourCycle:'h23'}).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)?.value || '';
  const days: Record<string, number> = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return { day: days[part('weekday')] ?? 0, seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')) };
}

export const BellEmergencyAutomationCard: React.FC<BellEmergencyAutomationCardProps> = ({
  schoolName,
  config,
  onConfigureEmergency,
  onConfigureSchedule,
  onConfigureCustom,
  onConfigureCommandPost,
}) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const liveConfig = React.useMemo(() => normalizeCommandCenterConfig(config), [config]);
  const bellSchedule = liveConfig.scheduledBells;

  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [nextBellCountdown, setNextBellCountdown] = useState<string>('');
  const [nextBellLabel, setNextBellLabel] = useState<string>('');

  // Panic Modal state
  const [isPanicModalOpen, setIsPanicModalOpen] = useState(false);
  const [selectedEmergencyType, setSelectedEmergencyType] = useState<EmergencyType>('EARTHQUAKE');
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [emergencyTitle, setEmergencyTitle] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [playAudioAlert, setPlayAudioAlert] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    const unsub = EmergencyService.subscribeToActiveEmergency((alert) => {
      setActiveEmergency(alert);
    });

    return () => unsub();
  }, []);

  // Reference countdown only: this module never schedules or broadcasts a sound by itself.
  useEffect(() => {
    const updateCountdown = () => {
      const {day, seconds} = wibClock(new Date());
      const next = bellSchedule.filter(bell => bell.isActive && bell.days.includes(day) && /^\d{2}:\d{2}$/.test(bell.time))
        .map(bell => ({bell, seconds: Number(bell.time.slice(0,2))*3600 + Number(bell.time.slice(3,5))*60}))
        .find(entry => entry.seconds > seconds);
      if (!next) {
        setNextBellCountdown('Selesai hari ini');
        setNextBellLabel('Tidak ada sesi berikutnya hari ini');
        return;
      }
      const diffSeconds = next.seconds - seconds;
      const hrs = Math.floor(diffSeconds / 3600);
      const mins = Math.floor((diffSeconds % 3600) / 60);
      const secs = diffSeconds % 60;
      setNextBellCountdown(`${hrs > 0 ? hrs+'j ' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}d`);
      setNextBellLabel(`${next.bell.label} (${next.bell.time} WIB)`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [bellSchedule]);

  const handleRequestPushNotification = async () => {
    const perm = await EmergencyService.requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      EmergencyService.sendDesktopNotification('Piket Guru Digital', {
        body: 'Notifikasi desktop aktif! Anda akan menerima siaran bel dan darurat sekolah secara instan.',
      });
      setToastMessage('Izin notifikasi desktop berhasil diaktifkan!');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleTestTone = (toneType: string) => {
    SchoolBellService.playToneByType(toneType);
    setToastMessage(`Memutar simulasi audio nada: ${toneType}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openTriggerModal = (type: EmergencyType) => {
    const template = liveConfig.emergencyTemplates[type];
    setSelectedEmergencyType(type);
    setSelectedCustomId(null);
    setEmergencyTitle(template.title);
    setEmergencyMessage(template.message);
    setIsPanicModalOpen(true);
  };

  const openCustomScenario = (id: string) => {
    const scenario = liveConfig.customEmergencies.find(item => item.id === id && item.isActive);
    if (!scenario) return;
    setSelectedCustomId(id);
    setSelectedEmergencyType('GENERAL'); // Existing backend enum: custom scenario classified as GENERAL.
    setEmergencyTitle(scenario.title);
    setEmergencyMessage(scenario.message);
    setIsPanicModalOpen(true);
  };

  const handleBroadcastEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (selectedCustomId && !liveConfig.customEmergencies.some(item => item.id === selectedCustomId && item.isActive)) {
      setToastMessage('Jenis siaga ini sudah diubah atau dinonaktifkan oleh Admin. Buka kembali panduannya.');
      setIsPanicModalOpen(false);
      return;
    }
    setIsBroadcasting(true);
    try {
      await EmergencyService.triggerEmergency(
        selectedEmergencyType,
        emergencyTitle,
        emergencyMessage,
        currentUser,
        playAudioAlert
      );
      setIsPanicModalOpen(false);
      setToastMessage('🚨 Siaran Siaga Darurat berhasil diaktifkan ke seluruh sistem!');
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleResolveEmergency = async () => {
    if (!currentUser) return;
    await EmergencyService.resolveEmergency(
      currentUser,
      'Situasi darurat telah terkendali dan alarm dinonaktifkan oleh Administrator.'
    );
    setToastMessage('Status Siaga Darurat telah berhasil dicabut.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* EMERGENCY ACTIVE ALERT BOX */}
      {activeEmergency && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-600 text-white shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/20 animate-pulse">
                <AlertOctagon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <span>🚨 SIAGA AKTIF: {activeEmergency.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 font-mono">
                    {activeEmergency.type}
                  </span>
                </div>
                <p className="text-xs text-white/90 mt-0.5">{activeEmergency.message}</p>
                <p className="text-[10px] text-white/75 mt-1 font-mono">
                  Diaktifkan oleh: {activeEmergency.triggeredByName} • {formatIndonesianDate(activeEmergency.triggeredAt)}
                </p>
              </div>
            </div>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResolveEmergency}
                className="bg-white text-rose-700 hover:bg-rose-50 border-white text-xs font-bold shrink-0"
              >
                Hentikan & Selesaikan Siaga
              </Button>
            )}
          </div>
        </div>
      )}

      {/* School-specific location, synchronized with Command Center config. */}
      <section aria-label="Lokasi Pusat Komando" className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 bg-white dark:bg-[var(--theme-card-bg)] space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold">Lokasi Pusat Komando: {liveConfig.commandPost.primary}</h3>
          {isAdmin && onConfigureCommandPost && <button type="button" onClick={onConfigureCommandPost} className="min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Atur Lokasi</button>}
        </div>
        {liveConfig.commandPost.details && <p className="text-xs whitespace-pre-wrap break-words">{liveConfig.commandPost.details}</p>}
        {liveConfig.commandPost.alternate && <p className="text-xs"><strong>Posko alternatif:</strong> {liveConfig.commandPost.alternate}</p>}
        {liveConfig.commandPost.assemblyPoint && <p className="text-xs"><strong>Titik kumpul:</strong> {liveConfig.commandPost.assemblyPoint}</p>}
      </section>

      {/* PANIC BUTTONS SECTION: titles, descriptions and operator notes come from Firebase config. */}
      <Card>
        <CardHeader
          title="Tombol Siaga & Darurat"
          subtitle="Pilih jenis kejadian untuk meninjau arahan. Siaran baru berjalan setelah operator mengonfirmasi."
          action={isAdmin && onConfigureEmergency ? <Button type="button" variant="outline" size="sm" onClick={() => onConfigureEmergency('EARTHQUAKE')}>Pengaturan Siaga</Button> : undefined}
        />
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMERGENCY_TYPES.map(type => {
              const option = liveConfig.emergencyOptions[type];
              const Icon = type === 'EARTHQUAKE' ? AlertOctagon : type === 'FIRE' ? Flame : type === 'SECURITY' ? ShieldAlert : Megaphone;
              return <div key={type} className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-3 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center"><Icon className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1"><h4 className="font-bold text-sm text-slate-900 dark:text-white break-words">{option.label}</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words mt-1">{option.description}</p></div>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button type="button" onClick={() => openTriggerModal(type)} disabled={isBroadcasting} className="min-h-11 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 disabled:opacity-50">Tinjau Siaga</button>
                  {isAdmin && onConfigureEmergency && <button type="button" onClick={() => onConfigureEmergency(type)} className="min-h-11 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800" aria-label={`Atur ${option.label}`}>Atur</button>}
                </div>
              </div>;
            })}
          </div>
          {liveConfig.customEmergencies.filter(item => item.isActive).length > 0 && <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
            <h4 className="text-xs font-bold">Bencana / Siaga Tambahan Sekolah</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveConfig.customEmergencies.filter(item=>item.isActive).map(item => <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
                <div><h5 className="text-sm font-bold break-words">{item.label}</h5><p className="text-xs text-slate-500 mt-1 break-words">{item.description}</p></div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 px-3 text-xs font-bold" onClick={()=>openCustomScenario(item.id)}>Tinjau Siaga</button>
                  {isAdmin && onConfigureCustom && <button type="button" className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs" onClick={onConfigureCustom}>Atur</button>}
                </div>
              </div>)}
            </div>
          </div>}
          <p className="text-[11px] text-slate-500">Tombol <strong>Atur</strong> membuka editor khusus admin. Mengubah teks dan checklist tidak otomatis membunyikan sirene atau mengirim siaran.</p>
        </CardContent>
      </Card>

      {/* SCHEDULED AUTOMATED BELL SECTION */}
      <Card>
        <CardHeader
          title="Jadwal Bel Sekolah (Referensi)"
          subtitle="Dapat diedit admin: jam, hari, nada dan keterangan. Jadwal ini tidak memutar suara otomatis."
          action={
            <div className="flex items-center gap-2">
              {isAdmin && onConfigureSchedule && <Button type="button" variant="outline" size="sm" onClick={onConfigureSchedule}>Atur Jadwal</Button>}
              {notificationPermission !== 'granted' ? (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<BellRing className="w-3.5 h-3.5 text-blue-500" />}
                  onClick={handleRequestPushNotification}
                  className="text-xs"
                >
                  Aktifkan Notifikasi Desktop
                </Button>
              ) : (
                <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                  Push Notifikasi Aktif
                </Badge>
              )}
            </div>
          }
        />
        <CardContent className="p-5 sm:p-6 space-y-5">
          <p className="text-xs text-amber-800 dark:text-amber-300 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
            Jadwal bel di bawah hanya referensi dan hitung mundur. Audio hanya dimainkan saat tombol <strong>Putar</strong> ditekan di perangkat ini. Tidak ada alarm atau siaran otomatis ke pengguna lain.
          </p>
          {/* Next Bell Countdown Widget */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Sesi Bel Referensi Berikutnya:
              </div>
              <div className="text-base sm:text-lg font-black">{nextBellLabel}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/20">
              <div className="text-[10px] text-blue-200 uppercase font-semibold">Hitung Mundur</div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                {nextBellCountdown}
              </div>
            </div>
          </div>

          {/* Bell Schedule Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Waktu (WIB)</th>
                  <th className="p-3.5">Nama Sesi Bel</th>
                  <th className="p-3.5">Hari / Nada</th>
                  <th className="p-3.5 text-center">Uji Dengar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bellSchedule.filter(item => item.isActive).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.time}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.description}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[10px] text-slate-500">
                      <p className="mb-1">{item.days.map(day => BELL_DAY_LABELS[day]).join(', ')}</p>
                      <Badge variant="primary" size="sm">
                        {item.toneType}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleTestTone(item.toneType)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-xs font-semibold transition cursor-pointer"
                        title="Uji Putar Bunyi"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Putar</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!bellSchedule.some(item => item.isActive) && <tr><td colSpan={4} className="p-5 text-center text-xs text-slate-500">Tidak ada bel yang aktif. Admin dapat mengaturnya pada tab Jadwal Bel di atas.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PANIC BROADCAST TRIGGER MODAL */}
      <Modal
        isOpen={isPanicModalOpen}
        onClose={() => setIsPanicModalOpen(false)}
        title="Konfirmasi Penyiaran Siaga Darurat"
        maxWidth="md"
      >
        <form onSubmit={handleBroadcastEmergency} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs leading-relaxed">
            <span className="font-bold">Perhatian:</span> Penyiaran ini akan mengaktifkan banner siaga darurat pada seluruh sesi yang sedang aktif dan membunyikan sirine alarm secara instan.
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-3 bg-amber-50/50 dark:bg-amber-950/30 space-y-2 text-xs">
            {(() => {
              const custom = selectedCustomId ? liveConfig.customEmergencies.find(item => item.id === selectedCustomId && item.isActive) : null;
              const option = custom || liveConfig.emergencyOptions[selectedEmergencyType];
              const contact = liveConfig.emergencyContacts.find(c => c.id === option.contactId);
              return <>
                <p className="font-bold text-amber-900 dark:text-amber-100">Checklist operator — {option.label}</p>
                <p className="text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap break-words">{option.operatorChecklist}</p>
                {custom && <p className="text-amber-800 dark:text-amber-200">Jenis tambahan menggunakan kategori umum (GENERAL) pada riwayat peringatan.</p>}
                <p className="text-amber-900 dark:text-amber-200">Posko: <strong>{liveConfig.commandPost.primary}</strong>{liveConfig.commandPost.details ? ` · ${liveConfig.commandPost.details}` : ''}</p>
                {contact && <p className="text-amber-900 dark:text-amber-200">Kontak rujukan: <strong>{contact.label}</strong> · {contact.number} (tidak dihubungi otomatis)</p>}
              </>;
            })()}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Judul Peringatan Darurat
            </label>
            <input
              required
              value={emergencyTitle}
              onChange={(e) => setEmergencyTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Isi Pesan & Arahan Evakuasi
            </label>
            <textarea
              required
              rows={3}
              value={emergencyMessage}
              onChange={(e) => setEmergencyMessage(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs leading-relaxed"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={playAudioAlert}
              onChange={(e) => setPlayAudioAlert(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
            />
            <span>Bunyikan sirine audio otomatis melalui speaker perangkat</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPanicModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isBroadcasting}
              leftIcon={<Radio className="w-4 h-4" />}
            >
              Siarkan Sekarang Juga
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
