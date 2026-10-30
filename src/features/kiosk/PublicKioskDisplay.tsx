import React, { useState, useEffect, useMemo, useRef } from 'react';
import { appLogo } from '../../utils/reportBranding';
import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { getKioskPanels, getKioskFrames, kioskPanelPageSize, kioskTickerText, kioskSlideIntervalMs } from './kioskPresentation';
import { getKioskTheme } from './kioskTheme';
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
  Megaphone,
  MonitorPlay,
  Play,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';
import { SchoolBellService } from '../../services/audio/bellService';
import { parseYouTubeVideoId, makeYouTubeEmbedUrl } from './youtubeProfile';

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

/** Isolate the one-second clock update so large carousel lists do not re-render every second. */
const KioskClock = React.memo(function KioskClock({
  timezone, showSeconds, showDate, timeFormat,
}: Pick<ReturnType<typeof sanitizeLobbyTvConfig>, 'timezone' | 'showSeconds' | 'showDate' | 'timeFormat'>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined, hour12: timeFormat === '12h',
  }), [timezone, showSeconds, timeFormat]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }), [timezone]);
  const clock = timeFormatter.format(now);
  const date = showDate ? dateFormatter.format(now) : '';
  return <div className="text-right tv-kiosk-clock">
    {showDate && <div className="tv-kiosk-date font-semibold text-[var(--kiosk-muted)]">{date}</div>}
    <div className="tv-kiosk-time font-mono font-black tracking-wider text-[var(--kiosk-accent)]">{clock}</div>
  </div>;
});

type SlidePhase = 'idle' | 'exit' | 'enter';

/** YouTube loads only while its slide is visible; no video bytes are stored in Firebase. */
const ProfileVideoSlide: React.FC<{
  videoId: string;
  autoplay: boolean;
  manualPlaying: boolean;
  onManualPlay: () => void;
  onResumeRotation: () => void;
}> = ({ videoId, autoplay, manualPlaying, onManualPlay, onResumeRotation }) => {
  const [loaded, setLoaded] = useState(autoplay);
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const youtubeLink = `https://www.youtube.com/watch?v=${videoId}`;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--kiosk-border)] bg-black aspect-video min-h-[180px]">
        {loaded ? (
          <iframe
            title="Video profil sekolah"
            src={makeYouTubeEmbedUrl(videoId, true)}
            className="absolute inset-0 w-full h-full"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
          />
        ) : (
          <button type="button" className="absolute inset-0 w-full h-full flex items-center justify-center group cursor-pointer" onClick={() => { setLoaded(true); onManualPlay(); }} aria-label="Putar video profil sekolah">
            <img className="absolute inset-0 w-full h-full object-cover opacity-80" src={thumbnail} alt="Pratinjau video profil sekolah" loading="lazy" />
            <span className="relative z-10 rounded-full p-5 border border-white/30 bg-black/60 text-white group-hover:scale-110 transition-transform"><Play className="w-9 h-9 fill-current" /></span>
            <span className="absolute bottom-5 left-5 text-white font-bold text-sm drop-shadow-lg">Klik untuk memutar video</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between text-xs text-[var(--kiosk-muted)]">
        <span>Video diputar dari YouTube; tidak tersimpan di server sekolah. Autoplay dapat dibatasi oleh browser TV.</span>
        <div className="flex flex-wrap gap-2">
          {manualPlaying && <button onClick={onResumeRotation} type="button" className="px-3 py-2 rounded-xl bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] border border-[var(--kiosk-border)] font-semibold">Lanjutkan rotasi slide</button>}
          <a href={youtubeLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-[var(--kiosk-border)] bg-[var(--kiosk-card)] text-[var(--kiosk-accent)] font-semibold px-3 py-2"><ExternalLink className="w-4 h-4"/> Buka di YouTube</a>
        </div>
      </div>
    </div>
  );
};

/** A single YouTube player stays mounted while informational slides rotate. */
const PinnedProfileVideo = React.memo(function PinnedProfileVideo({
  videoId, title, autoplay,
}: { videoId: string; title: string; autoplay: boolean }) {
  const [playing, setPlaying] = useState(autoplay);
  const [collapsed, setCollapsed] = useState(false);
  // A change to Admin's autoplay preference should stop/start the player without waiting for reload.
  useEffect(() => { setPlaying(autoplay); }, [autoplay]);
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <aside className="tv-kiosk-pinned-player rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-card)] p-3 shadow-lg" aria-label="Video profil sekolah disematkan">
      <div className="mb-3 flex items-center justify-between gap-2 min-w-0">
        <div className="flex min-w-0 items-center gap-2 text-[var(--kiosk-text)]">
          <MonitorPlay aria-hidden="true" className="h-5 w-5 text-[var(--kiosk-accent)] shrink-0" strokeWidth={1.7}/>
          <strong className="truncate text-sm font-bold" title={title}>{title}</strong>
        </div>
        <button type="button" className="shrink-0 rounded-lg bg-[var(--kiosk-inset)] px-2 py-1.5 text-xs text-[var(--kiosk-muted)] hover:bg-[var(--kiosk-hover)]" onClick={() => setCollapsed(current => !current)} aria-expanded={!collapsed} aria-label={collapsed ? 'Tampilkan video sematan' : 'Sembunyikan video sematan'}>
          {collapsed ? 'Tampilkan' : 'Ciutkan'}
        </button>
      </div>
      {!collapsed && <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {playing ? <iframe
          title={`YouTube - ${title}`}
          src={makeYouTubeEmbedUrl(videoId, playing)}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="eager"
        /> : <button type="button" className="absolute inset-0 w-full h-full cursor-pointer group" aria-label="Putar video profil sekolah" onClick={() => setPlaying(true)}>
          <img src={thumbnail} loading="lazy" alt="Pratinjau video YouTube" className="w-full h-full object-cover opacity-85" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/65 text-white p-3 transition-transform group-hover:scale-105"><Play className="w-6 h-6 fill-current" /></span></span>
        </button>}
      </div>}
      {!collapsed && <p className="mt-2 text-xs text-[var(--kiosk-muted)]">Video tetap tampil selama slide berganti. Streaming memakai kuota internet TV.</p>}
    </aside>
  );
});

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidePhase, setSlidePhase] = useState<SlidePhase>('idle');
  const [todayISO, setTodayISO] = useState(getTodayISODate);
  const mainRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [manualVideoPlayback, setManualVideoPlayback] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const config = useMemo(() => sanitizeLobbyTvConfig(settings.lobbyTv), [settings.lobbyTv]);
  const enabledPanels = getKioskPanels(config);
  const todayName = getCurrentDayName();
  const todaySchedules = useMemo(() => getEffectiveSchedulesOnDate(schedules, todayISO), [schedules, todayISO]);
  const todaySubs = useMemo(() => substitutions.filter(s => s.tanggal === todayISO), [substitutions, todayISO]);
  const todayTardy = useMemo(() => tardiness.filter(t => t.tanggal === todayISO), [tardiness, todayISO]);
  const activePermits = useMemo(() => permits.filter(p => p.tanggal === todayISO && p.status === 'SEDANG_KELUAR'), [permits, todayISO]);
  const activeVisitors = useMemo(() => visitors.filter(v => v.status === 'SEDANG_BERKUNJUNG'), [visitors]);
  const publicAnnouncements = useMemo(() => announcements.filter(a => a.isActive && (!a.targetRole || a.targetRole === 'SEMUA')), [announcements]);
  const videoId = parseYouTubeVideoId(config.profileVideoUrl);
  const videoPinned = Boolean(videoId && config.profileVideoEnabled && config.profileVideoPinned);
  const videoPanelEnabled = Boolean(videoId && config.profileVideoEnabled && !config.profileVideoPinned);
  const baseFrames = getKioskFrames(enabledPanels, {
    duty_teachers: todaySchedules.length,
    substitutions: todaySubs.length,
    visitors: activeVisitors.length,
    announcements: publicAnnouncements.length,
  }, config.densityScale);
  // Preserve the exact R90-B panel order. A valid YouTube link adds one final slide.
  const frames: Array<(typeof baseFrames)[number] | { panel: 'video_profile'; page: 0; pages: 1 }> = [
    ...baseFrames,
    ...(videoPanelEnabled ? [{ panel: 'video_profile' as const, page: 0 as const, pages: 1 as const }] : []),
  ];
  const frameKey = frames.map(f => `${f.panel}:${f.pages}`).join('|');
  const activeFrame = frames[Math.min(currentSlide, frames.length - 1)] ?? { panel: enabledPanels[0], page: 0, pages: 1 };
  const activePanel = activeFrame.panel;
  const label = `SLIDE ${Math.min(currentSlide + 1, frames.length)} / ${frames.length}${activeFrame.pages > 1 ? ` • BAGIAN ${activeFrame.page + 1}/${activeFrame.pages}` : ''}`;
  const tickerText = kioskTickerText(config);
  // Duration depends on message length, not a fixed blank gap before first appearance.
  const tickerDurationSec = Math.max(12, Math.min(140, Math.round(tickerText.length / (config.tickerSpeed === 'slow' ? 6 : config.tickerSpeed === 'fast' ? 16 : 10))));
  const pageStart = (panel: (typeof baseFrames)[number]['panel']) => activeFrame.page * kioskPanelPageSize(panel, config.densityScale);
  const pageEnd = (panel: (typeof baseFrames)[number]['panel']) => pageStart(panel) + kioskPanelPageSize(panel, config.densityScale);
  const kioskTheme = getKioskTheme(config);
  const themeAccent = kioskTheme.accent;
  const kioskVars = {
    '--kiosk-accent': kioskTheme.accent,
    '--kiosk-accent-ink': kioskTheme.accentInk,
    '--kiosk-success': kioskTheme.success,
    '--kiosk-warning': kioskTheme.warning,
    '--kiosk-danger': kioskTheme.danger,
    '--kiosk-bg': kioskTheme.background,
    '--kiosk-card': kioskTheme.card,
    '--kiosk-inset': kioskTheme.inset,
    '--kiosk-text': kioskTheme.text,
    '--kiosk-muted': kioskTheme.muted,
    '--kiosk-subtle': kioskTheme.subtle,
    '--kiosk-border': kioskTheme.border,
    '--kiosk-hover': kioskTheme.hover,
    '--kiosk-soft': kioskTheme.soft,
    '--tv-transition-half': `${Math.max(70, Math.round(config.transitionDurationMs / 2))}ms`,
    '--tv-density-offset': config.densityScale === 'large' ? '8px' : config.densityScale === 'compact' ? '-2px' : '2px',
  } as React.CSSProperties;
  const densityPadding = config.densityScale === 'compact' ? 'p-4 sm:p-5' : config.densityScale === 'large' ? 'p-7 sm:p-12' : 'p-5 sm:p-8';


  // Navigator network status is an indicator, not a guarantee of Firestore sync.
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Updating the day once per minute avoids 1Hz re-renders and keeps an unattended TV current after midnight.
  useEffect(() => {
    const refreshDay = () => setTodayISO(getTodayISODate());
    const timer = window.setInterval(refreshDay, 60_000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshDay); };
  }, []);

  // A transition exits first, switches content while invisible, then gently enters.
  // Timers are cancelled on changes/unmount; reduced-motion users see an immediate switch.
  useEffect(() => { setCurrentSlide(0); setSlidePhase('idle'); }, [frameKey]);
  useEffect(() => {
    if (!config.enabled || frames.length <= 1 || slidePhase !== 'idle' || (activePanel === 'video_profile' && manualVideoPlayback)) return;
    const timer = window.setTimeout(() => {
      if (config.transition === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCurrentSlide(index => (index + 1) % frames.length);
      } else {
        setSlidePhase('exit');
      }
    }, activePanel === 'video_profile' ? (config.profileVideoDurationSec ?? 90) * 1000 : kioskSlideIntervalMs(config));
    return () => window.clearTimeout(timer);
  }, [config.enabled, config.transition, config.slideIntervalSec, config.profileVideoDurationSec, frames.length, frameKey, currentSlide, slidePhase, activePanel, manualVideoPlayback]);

  useEffect(() => {
    if (slidePhase !== 'exit') return;
    const timer = window.setTimeout(() => {
      setCurrentSlide(index => (index + 1) % frames.length);
      setSlidePhase('enter');
    }, Math.max(70, Math.round(config.transitionDurationMs / 2)));
    return () => window.clearTimeout(timer);
  }, [slidePhase, frames.length, config.transitionDurationMs]);

  useEffect(() => {
    if (slidePhase !== 'enter') return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setSlidePhase('idle'));
    });
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); };
  }, [slidePhase]);

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [currentSlide]);
  useEffect(() => { if (activePanel !== 'video_profile') setManualVideoPlayback(false); }, [activePanel]);

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
    <div className={`tv-kiosk-viewport fixed inset-0 z-50 flex flex-col justify-between select-none overflow-hidden font-sans bg-[var(--kiosk-bg)] text-[var(--kiosk-text)]`}
      style={kioskVars} data-kiosk-mode={kioskTheme.mode} data-kiosk-theme={config.theme} data-tv-density={config.densityScale}>
      {/* BACKGROUND AMBIENT GLOW */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10" style={{ background: themeAccent }} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10" style={{ background: themeAccent }} />

      {/* TOP BAR: SCHOOL HEADER & LIVE CLOCK */}
      <header className={`relative z-10 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between flex-wrap gap-3 border-b border-[var(--kiosk-border)] bg-[var(--kiosk-card)]`}>
        <div className="flex items-center min-w-0 gap-4">
          {config.showSchoolIdentity && <div className="w-12 h-12 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-cyan-500/10 border border-white/10">
            <img src={appLogo(settings)} alt="Logo aplikasi" className="w-full h-full object-contain rounded-xl" />
          </div>}
          <div>
            <div className="flex items-center gap-2.5">
              {config.showSchoolIdentity && <h1 className={`tv-kiosk-school-name font-black tracking-tight uppercase text-[var(--kiosk-text)] max-w-[52vw] line-clamp-2 break-words`}>
                {settings.schoolName}
              </h1>}
              {config.showConnectionStatus && <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/20 text-rose-500 border-rose-500/30'}`}>
                <Radio className="w-3 h-3" /> {isOnline ? 'Jaringan terhubung' : 'Offline'}
              </span>}
            </div>
            <p className={`text-xs font-medium text-[var(--kiosk-muted)]`}>
              {config.customSubtitle}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE CLOCK & KIOSK CONTROLS */}
        <div className="flex items-center gap-6">
          <KioskClock timezone={config.timezone} showDate={config.showDate}
            showSeconds={config.showSeconds} timeFormat={config.timeFormat} />

          <div className="flex items-center gap-2">
            {config.allowSound && <button
              onClick={() => {
                if (isMuted) SchoolBellService.playPeriodChangeBell(); // Only after an explicit user gesture.
                setIsMuted(previous => !previous);
              }}
              className="p-2.5 rounded-xl bg-[var(--kiosk-inset)] hover:bg-[var(--kiosk-hover)] text-[var(--kiosk-muted)] transition-colors cursor-pointer"
              title={isMuted ? 'Uji suara TV (bel sekali)' : 'Matikan indikator suara TV'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-[var(--kiosk-danger)]" /> : <Volume2 className="w-4 h-4 text-[var(--kiosk-success)]" />}
            </button>}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-[var(--kiosk-inset)] hover:bg-[var(--kiosk-hover)] text-[var(--kiosk-muted)] transition-colors cursor-pointer"
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
      <main ref={mainRef} className={`tv-kiosk-main relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col justify-start bg-[var(--kiosk-bg)] text-[var(--kiosk-text)] ${densityPadding}`}>
        <div className="tv-kiosk-content-layout w-full my-auto" data-pinned={videoPinned} data-pin-side={config.profileVideoPinSide} data-pin-size={config.profileVideoPinSize}>
        <div className="tv-kiosk-stage w-full min-w-0" data-motion={config.transition} data-phase={slidePhase}>
        {isPreviewMode && <div role="status" className="mb-3 inline-flex self-start rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5 text-xs text-amber-800 font-bold">
          PRATINJAU {hasUnsavedChanges ? '· Perubahan belum disimpan' : '· Sesuai pengaturan tersimpan'}
        </div>}
        {!config.enabled && <div className="p-8 text-center rounded-2xl bg-[var(--kiosk-card)] text-[var(--kiosk-text)] border border-[var(--kiosk-border)]"><h2 className="tv-type-title text-xl font-bold">TV Lobi dinonaktifkan oleh Administrator</h2><p className="mt-2 text-sm text-[var(--kiosk-muted)]">Aktifkan kembali dari Pengaturan Sekolah → Pengaturan TV Lobi.</p></div>}
        {/* SLIDE 0: GURU PIKET BERTUGAS HARI INI */}
        {config.enabled && activePanel === 'duty_teachers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--kiosk-accent)] text-[var(--kiosk-accent-ink)] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="tv-type-title text-xl font-bold text-[var(--kiosk-text)]">
                    GURU & PETUGAS PIKET BERTUGAS HARI INI
                  </h2>
                  <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">
                    Hari {todayName} • Terbagi pada pos-pos strategis kampus
                  </p>
                </div>
              </div>
              <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-3 py-1 rounded-xl border border-[var(--kiosk-border)]">
                {label}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${config.densityScale === 'large' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}>
              {todaySchedules.length > 0 ? (
                todaySchedules.slice(pageStart('duty_teachers'), pageEnd('duty_teachers')).map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] flex items-center gap-4 hover:border-[var(--kiosk-accent)] transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] font-bold text-lg flex items-center justify-center border border-[var(--kiosk-border)] shrink-0">
                      {pageStart('duty_teachers') + idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="tv-type-name font-bold text-base text-[var(--kiosk-text)] break-words">
                        {item.petugasName}
                      </div>
                      <div className="tv-type-meta text-xs text-[var(--kiosk-accent)] font-medium truncate">
                        📍 {item.ruangName}
                      </div>
                      <div className="tv-type-meta text-[11px] font-mono text-[var(--kiosk-muted)] mt-1">
                        ⏰ {item.jamMulai} - {item.jamSelesai} WIB
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-[var(--kiosk-subtle)] font-medium">
                  Belum ada jadwal guru piket yang diatur untuk hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 1: GURU BERHALANGAN & GURU INVAL PENGGANTI */}
        {config.enabled && activePanel === 'substitutions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="tv-type-title text-xl font-bold text-[var(--kiosk-text)]">
                    GURU BERHALANGAN & ALOKASI GURU INVAL (PENGGANTI)
                  </h2>
                  <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">
                    Informasi kelas pengganti agar proses pembelajaran siswa tetap optimal
                  </p>
                </div>
              </div>
              <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-3 py-1 rounded-xl border border-[var(--kiosk-border)]">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySubs.length > 0 ? (
                todaySubs.slice(pageStart('substitutions'), pageEnd('substitutions')).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-[var(--kiosk-danger)] block">
                          Guru Berhalangan: {sub.guruBerhalanganName}
                        </span>
                        <div className="tv-type-body text-sm font-semibold text-[var(--kiosk-text)]">
                          {sub.mataPelajaran} • {sub.kelas} ({sub.jamPelajaran})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--kiosk-inset)] text-[10px] font-bold text-[var(--kiosk-muted)]">
                        {sub.alasan.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--kiosk-inset)] border border-[var(--kiosk-border)] tv-type-body">
                      <span className="tv-type-body text-[var(--kiosk-muted)] block font-medium">Guru Pengganti / Inval:</span>
                      <div className="tv-type-name font-bold text-[var(--kiosk-success)] text-sm mt-0.5 break-words">
                        🧑‍🏫 {sub.guruPenggantiName || 'Dalam Koordinasi Tim Piket'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center text-[var(--kiosk-subtle)] font-medium">
                  Seluruh guru mata pelajaran hadir lengkap pada hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 2: DAFTAR TAMU & PENGUNJUNG KAMPUS */}
        {config.enabled && activePanel === 'visitors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="tv-type-title text-xl font-bold text-[var(--kiosk-text)]">
                    BUKU TAMU & KUNJUNGAN RESMI SEKOLAH
                  </h2>
                  <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">
                    Daftar tamu dinas, orang tua siswa, dan mitra yang sedang berkunjung
                  </p>
                </div>
              </div>
              <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-3 py-1 rounded-xl border border-[var(--kiosk-border)]">
                {label}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${config.densityScale === 'large' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}>
              {activeVisitors.length > 0 ? (
                activeVisitors.slice(pageStart('visitors'), pageEnd('visitors')).map((vis) => (
                  <div
                    key={vis.id}
                    className="p-4 rounded-2xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-2 py-0.5 rounded">
                          {vis.nomorBadge}
                        </span>
                        <span className="tv-type-meta text-[10px] text-[var(--kiosk-success)] font-semibold">
                          Tiba: {vis.jamMasuk} WIB
                        </span>
                      </div>
                      <h4 className="tv-type-name font-bold text-sm text-[var(--kiosk-text)] mt-1.5 break-words">{vis.namaTamu}</h4>
                      <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">{vis.instansiAsal}</p>
                    </div>

                    <div className="pt-2 border-t border-[var(--kiosk-border)] text-[11px] text-[var(--kiosk-muted)]">
                      Bertemu: <strong className="text-[var(--kiosk-text)]">{vis.tujuanBertemu}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-[var(--kiosk-subtle)] font-medium">
                  Tidak ada tamu yang sedang aktif berada di area sekolah saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 3: KEDISIPLINAN & REKAP KAMPUS HARI INI */}
        {config.enabled && activePanel === 'discipline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="tv-type-title text-xl font-bold text-[var(--kiosk-text)]">
                    RINGKASAN KEDISIPLINAN & KETERTIBAN KAMPUS
                  </h2>
                  <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">
                    Statistik kedatangan siswa, izin keluar gerbang, dan pembinaan karakter
                  </p>
                </div>
              </div>
              <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-3 py-1 rounded-xl border border-[var(--kiosk-border)]">
                {label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center space-y-2">
                <span className="tv-type-body text-xs text-[var(--kiosk-muted)] uppercase font-bold tracking-wider">
                  Siswa Terlambat Hari Ini
                </span>
                <div className="tv-type-metric text-4xl font-black text-[var(--kiosk-danger)] font-mono">
                  {todayTardy.length}
                </div>
                <p className="tv-type-meta text-[11px] text-[var(--kiosk-subtle)]">Menjalani Pembinaan Piket</p>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center space-y-2">
                <span className="tv-type-body text-xs text-[var(--kiosk-muted)] uppercase font-bold tracking-wider">
                  Siswa Izin di Luar (Gate Pass)
                </span>
                <div className="tv-type-metric text-4xl font-black text-[var(--kiosk-warning)] font-mono">
                  {activePermits.length}
                </div>
                <p className="tv-type-meta text-[11px] text-[var(--kiosk-subtle)]">Dispensasi & Surat Resmi</p>
              </div>

              <div className="p-6 rounded-3xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center space-y-2">
                <span className="tv-type-body text-xs text-[var(--kiosk-muted)] uppercase font-bold tracking-wider">
                  Pos Piket Siaga Aktif
                </span>
                <div className="tv-type-metric text-4xl font-black text-[var(--kiosk-success)] font-mono">
                  {todaySchedules.length}
                </div>
                <p className="tv-type-meta text-[11px] text-[var(--kiosk-subtle)]">Pos piket terjadwal</p>
              </div>
            </div>
          </div>
        )}
        {config.enabled && activePanel === 'announcements' && (
          <section className="space-y-5" aria-label="Pengumuman dan agenda sekolah">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--kiosk-border)] pb-3">
              <h2 className="tv-type-title text-xl font-bold flex items-center gap-3"><Megaphone className="w-6 h-6 text-[var(--kiosk-accent)]" strokeWidth={1.7} /> PENGUMUMAN & AGENDA SEKOLAH</h2>
              <span className="tv-type-meta text-xs font-bold text-[var(--kiosk-accent)]">{label}</span>
            </div>
            {publicAnnouncements.length ?
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicAnnouncements.slice(pageStart('announcements'), pageEnd('announcements')).map(a => (
                  <article key={a.id} className="bg-[var(--kiosk-card)] text-[var(--kiosk-text)] border border-[var(--kiosk-border)] p-5 rounded-2xl">
                    <span className="tv-type-meta text-[11px] text-[var(--kiosk-accent)] font-bold">{a.priority}</span>
                    <h3 className="tv-type-name text-lg font-semibold mt-1 break-words">{a.title}</h3>
                    <p className="tv-type-body text-sm text-[var(--kiosk-muted)] whitespace-pre-line line-clamp-5 mt-2 break-words">{a.content}</p>
                  </article>
                ))}
              </div> : <p className="rounded-xl p-8 bg-[var(--kiosk-card)] text-[var(--kiosk-muted)] text-center">Belum ada pengumuman publik yang aktif.</p>}
          </section>
        )}
        {/* R90-D: optional YouTube video profile slide, other R90-B panels remain unchanged. */}
        {config.enabled && activePanel === 'video_profile' && videoId && (
          <section className="space-y-5" aria-label="Video profil sekolah">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] flex items-center justify-center border border-[var(--kiosk-border)]">
                  <MonitorPlay className="w-5 h-5" strokeWidth={1.7} />
                </div>
                <div>
                  <h2 className="tv-type-title text-xl font-bold text-[var(--kiosk-text)]">{config.profileVideoTitle || 'VIDEO PROFIL SEKOLAH'}</h2>
                  <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">{config.profileVideoSubtitle || 'Video profil resmi sekolah melalui YouTube'}</p>
                </div>
              </div>
              <span className="tv-type-meta text-xs font-mono font-bold text-[var(--kiosk-accent)] bg-[var(--kiosk-soft)] px-3 py-1 rounded-xl border border-[var(--kiosk-border)]">{label}</span>
            </div>
            <ProfileVideoSlide
              key={videoId}
              videoId={videoId}
              autoplay={Boolean(config.profileVideoAutoplay)}
              onManualPlay={() => setManualVideoPlayback(true)}
              onResumeRotation={() => setManualVideoPlayback(false)}
              manualPlaying={manualVideoPlayback}
            />
          </section>
        )}
        {config.enabled && activePanel === 'school_identity' && (
          <section className="space-y-6 text-center" aria-label="Identitas sekolah">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-white p-3"><img src={appLogo(settings)} alt="Logo sekolah" className="w-full h-full object-contain" /></div>
            <h2 className="tv-type-hero font-black">{settings.schoolName}</h2>
            <p className="tv-type-body text-sm text-[var(--kiosk-muted)]">{config.customSubtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-3xl mx-auto">
              <div className="rounded-2xl bg-[var(--kiosk-card)] text-[var(--kiosk-text)] p-5"><span className="tv-type-body block text-xs text-[var(--kiosk-muted)]">NPSN</span><strong>{settings.npsn || '-'}</strong></div>
              <div className="rounded-2xl bg-[var(--kiosk-card)] text-[var(--kiosk-text)] p-5"><span className="tv-type-body block text-xs text-[var(--kiosk-muted)]">Alamat Sekolah</span><strong>{settings.address || '-'}</strong></div>
            </div>
            <p className="tv-type-body text-xs text-[var(--kiosk-muted)]">{label}</p>
          </section>
        )}
        </div>
        {videoPinned && videoId && <PinnedProfileVideo
          key={videoId}
          videoId={videoId}
          title={config.profileVideoTitle || 'Video Profil Sekolah'}
          autoplay={Boolean(config.profileVideoAutoplay)}
        />}
        </div>
      </main>

      {/* R90-E: seamless scrolling; the first copy begins immediately and the second takes its place. */}
      {config.enabled && config.tickerEnabled && tickerText && <footer data-ticker-size={config.tickerFontSize} className="tv-kiosk-ticker relative z-10 bg-[var(--kiosk-card)] border-t border-[var(--kiosk-border)] px-4 sm:px-8 py-3 flex items-center gap-4">
        <div className="tv-type-ticker-label px-3 py-1 rounded-lg bg-[var(--kiosk-accent)] text-[var(--kiosk-accent-ink)] font-mono font-bold shrink-0 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5" strokeWidth={1.7} /> PENGUMUMAN
        </div>
        <div className="tv-kiosk-ticker-window flex-1 min-w-0 overflow-hidden" role="marquee" aria-label="Teks pengumuman sekolah">
          {config.tickerMode === 'marquee' ? <div className="tv-kiosk-ticker-track tv-type-ticker font-semibold text-[var(--kiosk-muted)]" style={{ '--tv-ticker-duration': `${tickerDurationSec}s` } as React.CSSProperties}>
            <span className="tv-kiosk-ticker-copy">{tickerText}</span>
            <span className="tv-kiosk-ticker-copy" aria-hidden="true">{tickerText}</span>
          </div> : <div className="tv-kiosk-ticker-static tv-type-ticker font-semibold text-[var(--kiosk-muted)] truncate" title={tickerText}>{tickerText}</div>}
        </div>
      </footer>}
    </div>
  );
};
