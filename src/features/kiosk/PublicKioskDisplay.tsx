import React, { useState, useEffect } from 'react';
import { appLogo } from '../../utils/reportBranding';
import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { getKioskPanels, kioskTickerText, kioskSlideIntervalMs } from './kioskPresentation';
import { AnnouncementRecord } from '../../types/announcement.types';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Radio,
  Maximize,
  Minimize,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import { SchoolBellService } from '../../services/audio/bellService';

interface PublicKioskDisplayProps {
  onClose: () => void;
  settings: SchoolSettings;
  schedules: ScheduleItem[];
  substitutions: TeacherSubstitutionRecord[];
  tardiness: StudentTardyRecord[];
  permits: StudentPermitRecord[];
  visitors: VisitorRecord[];
  announcements?: AnnouncementRecord[];
  isPreviewMode?: boolean;
  hasUnsavedChanges?: boolean;
}

export const PublicKioskDisplay: React.FC<PublicKioskDisplayProps> = ({
  onClose,
  settings,
  schedules,
  substitutions,
  tardiness,
  permits,
  visitors,
  announcements = [],
  isPreviewMode = false,
  hasUnsavedChanges = false,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const config = sanitizeLobbyTvConfig(settings.lobbyTv);
  const enabledPanels = getKioskPanels(config);
  const panelOrderKey = enabledPanels.join('|');
  const activePanel = enabledPanels[Math.min(currentSlide, enabledPanels.length - 1)];
  const label = `SLIDE ${Math.min(currentSlide + 1, enabledPanels.length)} / ${enabledPanels.length}`;
  const tickerText = kioskTickerText(config);
  const clock = new Intl.DateTimeFormat('id-ID', {
    timeZone: config.timezone, hour: '2-digit', minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined, hour12: config.timeFormat === '12h',
  }).format(currentTime);
  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: config.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(currentTime);
  const themeAccent = ({ default: '#60a5fa', sky: '#38bdf8', mint: '#34d399',
    lavender: '#c4b5fd', peach: '#fdba74', rose: '#fda4af' } as const)[config.theme];
  const densityPadding = config.densityScale === 'compact' ? 'p-4 sm:p-5' : config.densityScale === 'large' ? 'p-7 sm:p-12' : 'p-5 sm:p-8';
  const slideEffect = config.transition === 'none' ? '' : config.transition === 'fade'
    ? 'tv-transition-fade' : 'tv-transition-slide';

  const todayName = getCurrentDayName();
  const todayISO = getTodayISODate();

  const todaySchedules = getEffectiveSchedulesOnDate(schedules, todayISO);
  const todaySubs = substitutions.filter((s) => s.tanggal === todayISO);
  const todayTardy = tardiness.filter((t) => t.tanggal === todayISO);
  const activePermits = permits.filter((p) => p.tanggal === todayISO && p.status === 'SEDANG_KELUAR');
  const activeVisitors = visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG');


  // Navigator network status is an indicator, not a guarantee of Firestore sync.
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Follow saved panel order and rotation duration, including live updates.
  useEffect(() => { setCurrentSlide(0); }, [panelOrderKey]);
  useEffect(() => {
    if (!config.enabled || enabledPanels.length <= 1) return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % enabledPanels.length), kioskSlideIntervalMs(config));
    return () => clearInterval(timer);
  }, [config.enabled, enabledPanels.length, config.slideIntervalSec, panelOrderKey]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col justify-between select-none overflow-hidden font-sans ${config.colorMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}
      style={{ ['--kiosk-accent' as string]: themeAccent, ['--tv-transition-duration' as string]: `${config.transitionDurationMs}ms` }}>
      {/* BACKGROUND AMBIENT GLOW */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10" style={{ background: themeAccent }} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10" style={{ background: themeAccent }} />

      {/* TOP BAR: SCHOOL HEADER & LIVE CLOCK */}
      <header className={`relative z-10 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 border-b backdrop-blur-md ${config.colorMode === 'light' ? 'border-slate-300 bg-white' : 'border-slate-800/80 bg-slate-900/60'}`}>
        <div className="flex items-center gap-4">
          {config.showSchoolIdentity && <div className="w-12 h-12 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-cyan-500/10 border border-white/10">
            <img src={appLogo(settings)} alt="Logo aplikasi" className="w-full h-full object-contain rounded-xl" />
          </div>}
          <div>
            <div className="flex items-center gap-2.5">
              {config.showSchoolIdentity && <h1 className={`text-lg sm:text-2xl font-black tracking-tight uppercase ${config.colorMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {settings.schoolName}
              </h1>}
              {config.showConnectionStatus && <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/20 text-rose-500 border-rose-500/30'}`}>
                <Radio className="w-3 h-3" /> {isOnline ? 'Jaringan terhubung' : 'Offline'}
              </span>}
            </div>
            <p className={`text-xs font-medium ${config.colorMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              {config.customSubtitle}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE CLOCK & KIOSK CONTROLS */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            {config.showDate && <div className={`text-sm font-semibold ${config.colorMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>{date}</div>}
            <div className="text-2xl sm:text-3xl font-mono font-black tracking-wider" style={{ color: themeAccent }}>
              {clock}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {config.allowSound && <button
              onClick={() => {
                if (isMuted) SchoolBellService.playPeriodChangeBell(); // Only after an explicit user gesture.
                setIsMuted(previous => !previous);
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={isMuted ? 'Uji suara TV (bel sekali)' : 'Matikan indikator suara TV'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              title="Keluar Mode TV"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA: DYNAMIC SLIDES */}
      <main className={`relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col justify-center bg-slate-950 text-white ${densityPadding}`}>
        {isPreviewMode && <div role="status" className="mb-3 inline-flex self-start rounded-lg bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 text-xs text-amber-200 font-bold">
          PRATINJAU {hasUnsavedChanges ? '· Perubahan belum disimpan' : '· Sesuai pengaturan tersimpan'}
        </div>}
        {!config.enabled && <div className="p-8 text-center rounded-2xl bg-slate-900 text-white border border-slate-700"><h2 className="text-xl font-bold">TV Lobi dinonaktifkan oleh Administrator</h2><p className="mt-2 text-sm text-slate-400">Aktifkan kembali dari Pengaturan Sekolah → Pengaturan TV Lobi.</p></div>}
        {/* SLIDE 0: GURU PIKET BERTUGAS HARI INI */}
        {config.enabled && activePanel === 'duty_teachers' && (
          <div className={`space-y-6 ${slideEffect}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    GURU & PETUGAS PIKET BERTUGAS HARI INI
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hari {todayName} • Terbagi pada pos-pos strategis kampus
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-800">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySchedules.length > 0 ? (
                todaySchedules.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex items-center gap-4 hover:border-blue-500 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-lg flex items-center justify-center border border-blue-500/30 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-base text-white truncate">
                        {item.petugasName}
                      </div>
                      <div className="text-xs text-blue-400 font-medium truncate">
                        📍 {item.ruangName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        ⏰ {item.jamMulai} - {item.jamSelesai} WIB
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-slate-500 font-medium">
                  Belum ada jadwal guru piket yang diatur untuk hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 1: GURU BERHALANGAN & GURU INVAL PENGGANTI */}
        {config.enabled && activePanel === 'substitutions' && (
          <div className={`space-y-6 ${slideEffect}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    GURU BERHALANGAN & ALOKASI GURU INVAL (PENGGANTI)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Informasi kelas pengganti agar proses pembelajaran siswa tetap optimal
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 px-3 py-1 rounded-xl border border-purple-800">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySubs.length > 0 ? (
                todaySubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-rose-400 block">
                          Guru Berhalangan: {sub.guruBerhalanganName}
                        </span>
                        <div className="text-sm font-semibold text-slate-200">
                          {sub.mataPelajaran} • {sub.kelas} ({sub.jamPelajaran})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-300">
                        {sub.alasan.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <span className="text-slate-400 block font-medium">Guru Pengganti / Inval:</span>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5">
                        🧑‍🏫 {sub.guruPenggantiName || 'Dalam Koordinasi Tim Piket'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center text-slate-500 font-medium">
                  Seluruh guru mata pelajaran hadir lengkap pada hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 2: DAFTAR TAMU & PENGUNJUNG KAMPUS */}
        {config.enabled && activePanel === 'visitors' && (
          <div className={`space-y-6 ${slideEffect}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    BUKU TAMU & KUNJUNGAN RESMI SEKOLAH
                  </h2>
                  <p className="text-xs text-slate-400">
                    Daftar tamu dinas, orang tua siswa, dan mitra yang sedang berkunjung
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeVisitors.length > 0 ? (
                activeVisitors.map((vis) => (
                  <div
                    key={vis.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded">
                          {vis.nomorBadge}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          Tiba: {vis.jamMasuk} WIB
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white mt-1.5">{vis.namaTamu}</h4>
                      <p className="text-xs text-slate-400">{vis.instansiAsal}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      Bertemu: <strong className="text-white">{vis.tujuanBertemu}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-slate-500 font-medium">
                  Tidak ada tamu yang sedang aktif berada di area sekolah saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 3: KEDISIPLINAN & REKAP KAMPUS HARI INI */}
        {config.enabled && activePanel === 'discipline' && (
          <div className={`space-y-6 ${slideEffect}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    RINGKASAN KEDISIPLINAN & KETERTIBAN KAMPUS
                  </h2>
                  <p className="text-xs text-slate-400">
                    Statistik kedatangan siswa, izin keluar gerbang, dan pembinaan karakter
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-800">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Terlambat Hari Ini
                </span>
                <div className="text-4xl font-black text-rose-400 font-mono">
                  {todayTardy.length}
                </div>
                <p className="text-[11px] text-slate-500">Menjalani Pembinaan Piket</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Izin di Luar (Gate Pass)
                </span>
                <div className="text-4xl font-black text-amber-400 font-mono">
                  {activePermits.length}
                </div>
                <p className="text-[11px] text-slate-500">Dispensasi & Surat Resmi</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Pos Piket Siaga Aktif
                </span>
                <div className="text-4xl font-black text-emerald-400 font-mono">
                  {todaySchedules.length}
                </div>
                <p className="text-[11px] text-slate-500">Pos piket terjadwal</p>
              </div>
            </div>
          </div>
        )}
        {config.enabled && activePanel === 'announcements' && (
          <section className={`space-y-5 ${slideEffect}`} aria-label="Pengumuman dan agenda sekolah">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-3">
              <h2 className="text-xl font-bold flex items-center gap-3"><Sparkles className="w-6 h-6 text-cyan-400" /> PENGUMUMAN & AGENDA SEKOLAH</h2>
              <span className="text-xs font-bold text-cyan-400">{label}</span>
            </div>
            {announcements.filter(a => a.isActive && (!a.targetRole || a.targetRole === 'SEMUA')).length ?
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.filter(a => a.isActive && (!a.targetRole || a.targetRole === 'SEMUA')).slice(0, 8).map(a => (
                  <article key={a.id} className="bg-slate-900 text-white border border-slate-700 p-5 rounded-2xl">
                    <span className="text-[11px] text-cyan-300 font-bold">{a.priority}</span>
                    <h3 className="text-lg font-semibold mt-1">{a.title}</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-line line-clamp-5 mt-2">{a.content}</p>
                  </article>
                ))}
              </div> : <p className="rounded-xl p-8 bg-slate-900 text-slate-300 text-center">Belum ada pengumuman publik yang aktif.</p>}
          </section>
        )}
        {config.enabled && activePanel === 'school_identity' && (
          <section className={`space-y-6 text-center ${slideEffect}`} aria-label="Identitas sekolah">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-white p-3"><img src={appLogo(settings)} alt="Logo sekolah" className="w-full h-full object-contain" /></div>
            <h2 className="text-2xl sm:text-4xl font-black">{settings.schoolName}</h2>
            <p className="text-sm text-slate-400">{config.customSubtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-3xl mx-auto">
              <div className="rounded-2xl bg-slate-900 text-white p-5"><span className="block text-xs text-slate-400">NPSN</span><strong>{settings.npsn || '-'}</strong></div>
              <div className="rounded-2xl bg-slate-900 text-white p-5"><span className="block text-xs text-slate-400">Alamat Sekolah</span><strong>{settings.address || '-'}</strong></div>
            </div>
            <p className="text-xs text-slate-400">{label}</p>
          </section>
        )}
      </main>

      {/* BOTTOM RUNNING TICKER */}
      {config.enabled && config.tickerEnabled && tickerText && <footer className="relative z-10 bg-slate-900 border-t border-slate-800/80 px-8 py-3 flex items-center gap-4">
        <div className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shrink-0 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> PENGUMUMAN
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className={`inline-block font-semibold text-slate-300 ${config.tickerMode === 'marquee' ? 'animate-marquee' : ''} ${config.tickerFontSize === 'sm' ? 'text-xs' : config.tickerFontSize === 'lg' ? 'text-lg' : 'text-sm'}`}
            style={config.tickerMode === 'marquee' ? { animationDuration: config.tickerSpeed === 'slow' ? '65s' : config.tickerSpeed === 'fast' ? '20s' : '40s' } : undefined}>
            {tickerText}
          </div>
        </div>
      </footer>}
    </div>
  );
};
