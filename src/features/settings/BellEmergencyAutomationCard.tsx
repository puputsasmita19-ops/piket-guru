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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { SchoolBellService } from '../../services/audio/bellService';
import { EmergencyService } from '../../services/notifications/emergencyService';
import { EmergencyAlert, EmergencyType } from '../../types/security.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface BellEmergencyAutomationCardProps {
  schoolName: string;
}

interface ScheduledBell {
  id: string;
  time: string;
  label: string;
  toneType: string;
  description: string;
}

const DEFAULT_SCHEDULED_BELLS: ScheduledBell[] = [
  {
    id: 'bell_1',
    time: '06:45',
    label: 'Bel Masuk Sekolah & Apel Pagi',
    toneType: 'MORNING_IN',
    description: 'Chime Westminster klasik 4 ketukan menyambut kehadiran siswa dan guru.',
  },
  {
    id: 'bell_2',
    time: '07:15',
    label: 'Penutupan Gerbang Utama',
    toneType: 'PERIOD_CHANGE',
    description: 'Batas akhir toleransi hadir; dimulainya pencatatan siswa terlambat di Pos Piket.',
  },
  {
    id: 'bell_3',
    time: '09:45',
    label: 'Bel Istirahat Pertama',
    toneType: 'BREAK',
    description: 'Nada ceria 3 ketukan jeda istirahat dan kudapan pagi.',
  },
  {
    id: 'bell_4',
    time: '10:15',
    label: 'Bel Masuk Jam Pembelajaran Kedua',
    toneType: 'PERIOD_CHANGE',
    description: 'Nada double ding-dong pergantian jam belajar kelas.',
  },
  {
    id: 'bell_5',
    time: '12:00',
    label: 'Bel Istirahat Siang & Shalat Dzuhur',
    toneType: 'BREAK',
    description: 'Istirahat makan siang dan ibadah bersama civitas sekolah.',
  },
  {
    id: 'bell_6',
    time: '12:45',
    label: 'Bel Masuk Sesi Pembelajaran Siang',
    toneType: 'PERIOD_CHANGE',
    description: 'Melanjutkan pembelajaran jam sesi sore.',
  },
  {
    id: 'bell_7',
    time: '15:30',
    label: 'Bel Pulang Sekolah (Dismissal)',
    toneType: 'DISMISSAL',
    description: 'Melodi 4 nada penutupan hari pembelajaran dan pergantian piket.',
  },
];

export const BellEmergencyAutomationCard: React.FC<BellEmergencyAutomationCardProps> = ({
  schoolName,
}) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [nextBellCountdown, setNextBellCountdown] = useState<string>('');
  const [nextBellLabel, setNextBellLabel] = useState<string>('');

  // Panic Modal state
  const [isPanicModalOpen, setIsPanicModalOpen] = useState(false);
  const [selectedEmergencyType, setSelectedEmergencyType] = useState<EmergencyType>('EARTHQUAKE');
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

  // Compute Next Bell Countdown
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();
      const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

      let found = false;
      for (const bell of DEFAULT_SCHEDULED_BELLS) {
        const [bH, bM] = bell.time.split(':').map(Number);
        const bellTotalSeconds = bH * 3600 + bM * 60;

        if (bellTotalSeconds > currentTotalSeconds) {
          const diffSeconds = bellTotalSeconds - currentTotalSeconds;
          const hrs = Math.floor(diffSeconds / 3600);
          const mins = Math.floor((diffSeconds % 3600) / 60);
          const secs = diffSeconds % 60;
          setNextBellCountdown(
            `${hrs > 0 ? hrs + 'j ' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}d`
          );
          setNextBellLabel(`${bell.label} (${bell.time} WIB)`);
          found = true;
          break;
        }
      }

      if (!found) {
        setNextBellCountdown('Selesai hari ini');
        setNextBellLabel('Semua sesi bel hari ini telah terlewati');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

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
    setSelectedEmergencyType(type);
    if (type === 'EARTHQUAKE') {
      setEmergencyTitle('Gempa Bumi Terdeteksi');
      setEmergencyMessage('Semua civitas sekolah dimohon berlindung di bawah meja lalu evakuasi tertib ke Titik Kumpul Lapangan Utama.');
    } else if (type === 'FIRE') {
      setEmergencyTitle('Peringatan Kebakaran / Asap');
      setEmergencyMessage('Terdeteksi indikasi api/kebakaran. Segera evakuasi melalui tangga darurat dan jangan gunakan lift.');
    } else if (type === 'SECURITY') {
      setEmergencyTitle('Siaga Keamanan / Lockdown');
      setEmergencyMessage('Harap kunci pintu ruang kelas dan tetap berada di dalam ruangan hingga instruksi keamanan selesai.');
    } else {
      setEmergencyTitle('Pengumuman Darurat Penting');
      setEmergencyMessage('Seluruh guru piket dan koordinator harap segera berkumpul di Pos Komando Utama.');
    }
    setIsPanicModalOpen(true);
  };

  const handleBroadcastEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
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

      {/* PANIC BUTTONS SECTION */}
      <Card>
        <CardHeader
          title="Tombol Siaga Bencana & Sirine Darurat (Panic Broadcast)"
          subtitle="Mengirim sinyal darurat visual ke seluruh layar Kiosk, Command Center, serta menyuarakan sirine audio sintetis"
        />
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => openTriggerModal('EARTHQUAKE')}
              className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 hover:border-rose-400 text-left transition group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-white mt-3">
                Gempa Bumi
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Sirine getaran dan instruksi evakuasi ke lapangan terbuka.
              </p>
            </button>

            <button
              onClick={() => openTriggerModal('FIRE')}
              className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 hover:bg-orange-100 hover:border-orange-400 text-left transition group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-white mt-3">
                Kebakaran / Asap
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Sirine hi-lo ganda evakuasi gedung ke titik kumpul.
              </p>
            </button>

            <button
              onClick={() => openTriggerModal('SECURITY')}
              className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 hover:border-amber-400 text-left transition group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-white mt-3">
                Siaga Keamanan
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Penyusup / insiden fisik; kunci gerbang dan ruang kelas.
              </p>
            </button>

            <button
              onClick={() => openTriggerModal('GENERAL')}
              className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 hover:border-blue-400 text-left transition group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="font-extrabold text-xs text-slate-900 dark:text-white mt-3">
                Siaran Khusus
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Panggilan darurat tim piket atau pengumuman massal.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* SCHEDULED AUTOMATED BELL SECTION */}
      <Card>
        <CardHeader
          title="Jadwal Bel Sekolah Digital Otomatis"
          subtitle="Sinkronisasi jadwal pergantian jam belajar, istirahat, dan kepulangan siswa"
          action={
            <div className="flex items-center gap-2">
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
          {/* Next Bell Countdown Widget */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Bel Terjadwal Berikutnya:
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
                  <th className="p-3.5">Karakter Nada Audio</th>
                  <th className="p-3.5 text-center">Uji Dengar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEFAULT_SCHEDULED_BELLS.map((item) => (
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
