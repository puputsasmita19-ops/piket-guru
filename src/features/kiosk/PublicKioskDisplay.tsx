import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar,
  Clock,
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
  Building,
  GraduationCap,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Award,
  BookOpen,
} from 'lucide-react';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { AnnouncementRecord } from '../../types/announcement.types';
import { LobbyTvConfig, sanitizeLobbyTvConfig, TvPanelId } from '../../types/lobbyTv.types';
import { SchoolBellService } from '../../services/audio/bellService';
import { formatIndonesianDate, getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';

interface PublicKioskDisplayProps {
  onClose: () => void;
  settings: SchoolSettings;
  schedules?: ScheduleItem[];
  substitutions?: TeacherSubstitutionRecord[];
  tardiness?: StudentTardyRecord[];
  permits?: StudentPermitRecord[];
  visitors?: VisitorRecord[];
  announcements?: AnnouncementRecord[];
  isPreviewMode?: boolean;
}

export const PublicKioskDisplay: React.FC<PublicKioskDisplayProps> = ({
  onClose,
  settings,
  schedules = [],
  substitutions = [],
  tardiness = [],
  permits = [],
  visitors = [],
  announcements = [],
  isPreviewMode = false,
}) => {
  // Sanitize and guarantee safe configuration
  const config: LobbyTvConfig = useMemo(
    () => sanitizeLobbyTvConfig(settings.lobbyTv),
    [settings.lobbyTv]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(!config.allowSound);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date>(() => new Date());
  const [staticTickerIndex, setStaticTickerIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Listen to OS prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    try {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  // Active dates
  const todayName = getCurrentDayName();
  const todayISO = getTodayISODate();

  // Filtered operational records for public consumption (safe, non-sensitive)
  const todaySchedules = useMemo(
    () => schedules.filter((s) => s.hari === todayName),
    [schedules, todayName]
  );
  const todaySubs = useMemo(
    () => substitutions.filter((s) => s.tanggal === todayISO),
    [substitutions, todayISO]
  );
  const todayTardy = useMemo(
    () => tardiness.filter((t) => t.tanggal === todayISO),
    [tardiness, todayISO]
  );
  const activePermits = useMemo(
    () => permits.filter((p) => p.tanggal === todayISO && p.status === 'SEDANG_KELUAR'),
    [permits, todayISO]
  );
  const activeVisitors = useMemo(
    () => visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG'),
    [visitors]
  );
  const activeAnnouncements = useMemo(
    () => announcements.filter((a) => a.isActive !== false),
    [announcements]
  );

  // Enabled panels in custom order
  const activePanels: TvPanelId[] = useMemo(() => {
    return config.enabledPanels.length > 0
      ? config.enabledPanels
      : ['duty_teachers', 'substitutions', 'visitors', 'discipline'];
  }, [config.enabledPanels]);

  // Keep slide index in valid range if panels change dynamically
  useEffect(() => {
    if (currentSlideIndex >= activePanels.length) {
      setCurrentSlideIndex(0);
    }
  }, [activePanels.length, currentSlideIndex]);

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastSyncTime(new Date());
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update sync timestamp when data updates
  useEffect(() => {
    setLastSyncTime(new Date());
  }, [schedules, substitutions, tardiness, permits, visitors, announcements, settings]);

  // 1. Accurate Realtime Clock with Tab Visibility / Wake Resync
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const clockTimer = setInterval(updateTime, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateTime();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', updateTime);

    return () => {
      clearInterval(clockTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', updateTime);
    };
  }, []);

  // 2. Slide Carousel Timer with Pause and Configurable Interval
  useEffect(() => {
    if (isPaused || activePanels.length <= 1) return;

    const intervalMs = Math.max(3000, config.slideIntervalSec * 1000);
    const slideTimer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % activePanels.length);
    }, intervalMs);

    return () => clearInterval(slideTimer);
  }, [isPaused, activePanels.length, config.slideIntervalSec]);

  // 3. Static Ticker Rotation Timer (when tickerMode === 'static')
  useEffect(() => {
    if (!config.tickerEnabled || config.tickerMode !== 'static' || config.tickerMessages.length <= 1) {
      return;
    }
    const tickerTimer = setInterval(() => {
      setStaticTickerIndex((prev) => (prev + 1) % config.tickerMessages.length);
    }, 7000);

    return () => clearInterval(tickerTimer);
  }, [config.tickerEnabled, config.tickerMode, config.tickerMessages.length]);

  // 4. Fullscreen & Escape Key Handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'k') {
        // Space / K to pause or resume rotation
        setIsPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => (prev + 1) % activePanels.length);
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => (prev - 1 + activePanels.length) % activePanels.length);
      } else if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, activePanels.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const target = containerRef.current || document.documentElement;
      target.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Time formatter respecting timezone, 12h/24h, and seconds
  const formattedTime = useMemo(() => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: config.timezone || 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: config.timeFormat === '12h',
      };
      if (config.showSeconds) {
        options.second = '2-digit';
      }
      return new Intl.DateTimeFormat('id-ID', options).format(currentTime);
    } catch {
      return currentTime.toLocaleTimeString('id-ID');
    }
  }, [currentTime, config.timezone, config.timeFormat, config.showSeconds]);

  // Date formatter respecting school timezone
  const formattedDate = useMemo(() => {
    if (!config.showDate) return null;
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: config.timezone || 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(currentTime);
    } catch {
      return formatIndonesianDate(currentTime);
    }
  }, [currentTime, config.showDate, config.timezone]);

  // Last sync time formatted
  const formattedSyncTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: config.timezone || 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(lastSyncTime);
    } catch {
      return lastSyncTime.toLocaleTimeString('id-ID');
    }
  }, [lastSyncTime, config.timezone]);

  // Density Scaling classes
  const densityStyles = useMemo(() => {
    switch (config.densityScale) {
      case 'compact':
        return {
          headerH: 'py-3 px-6',
          titleSize: 'text-lg sm:text-xl',
          cardPadding: 'p-3.5',
          bodySize: 'text-xs',
          gridGap: 'gap-3',
          iconSize: 'w-8 h-8',
        };
      case 'large':
        return {
          headerH: 'py-6 px-10',
          titleSize: 'text-2xl sm:text-3xl',
          cardPadding: 'p-6',
          bodySize: 'text-base',
          gridGap: 'gap-6',
          iconSize: 'w-14 h-14',
        };
      case 'standard':
      default:
        return {
          headerH: 'py-4 sm:py-5 px-8',
          titleSize: 'text-xl sm:text-2xl',
          cardPadding: 'p-5',
          bodySize: 'text-sm',
          gridGap: 'gap-4',
          iconSize: 'w-11 h-11',
        };
    }
  }, [config.densityScale]);

  // Ticker animation speed classes
  const tickerSpeedClass = useMemo(() => {
    switch (config.tickerSpeed) {
      case 'slow':
        return 'animate-marquee-slow';
      case 'fast':
        return 'animate-marquee-fast';
      case 'normal':
      default:
        return 'animate-marquee';
    }
  }, [config.tickerSpeed]);

  const tickerFontClass = useMemo(() => {
    switch (config.tickerFontSize) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-base font-bold';
      case 'md':
      default:
        return 'text-sm font-semibold';
    }
  }, [config.tickerFontSize]);

  // Transition style respecting prefers-reduced-motion
  const transitionClass = useMemo(() => {
    if (prefersReducedMotion || config.transition === 'none') return '';
    if (config.transition === 'fade') return 'tv-transition-fade';
    return 'tv-transition-slide';
  }, [prefersReducedMotion, config.transition]);

  const currentPanelId = activePanels[currentSlideIndex] || 'duty_teachers';

  return (
    <div
      ref={containerRef}
      data-pastel-theme={config.theme}
      className={`fixed inset-0 z-50 flex flex-col justify-between select-none overflow-hidden font-sans transition-colors duration-300 ${
        config.colorMode === 'dark' ? 'dark bg-slate-950 text-white' : 'light bg-slate-100 text-slate-900'
      }`}
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: config.colorMode === 'dark' ? '#f8fafc' : '#0f172a',
      }}
    >
      {/* AMBIENT BACKGROUND GLOW */}
      <div className="absolute top-0 left-1/4 w-[36rem] h-[36rem] bg-[var(--theme-primary)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[36rem] h-[36rem] bg-[var(--theme-primary-hover)]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP NOTIFICATION (PREVIEW OR OFFLINE MODE) */}
      {(isPreviewMode || !isOnline) && (
        <div className="relative z-30 px-4 py-1.5 flex items-center justify-between text-xs font-semibold backdrop-blur-md transition-all shadow-xs border-b border-black/10">
          {isPreviewMode ? (
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 bg-amber-500/20 px-3 py-0.5 rounded-full mx-auto">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span>
                Mode Pratinjau Interaktif (Konfigurasi Draf Lokal — Belum Tersimpan di Server)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 bg-rose-500/20 px-3 py-0.5 rounded-full mx-auto">
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              <span>Mode Offline — Menampilkan data tersimpan terakhir ({formattedSyncTime}) tanpa gangguan</span>
            </div>
          )}
        </div>
      )}

      {/* TOP BAR: SCHOOL BRANDING, LIVE CLOCK & KIOSK CONTROLS */}
      <header
        className={`relative z-20 flex items-center justify-between border-b border-slate-200/60 dark:border-[var(--theme-card-border)] backdrop-blur-md transition-colors ${densityStyles.headerH}`}
        style={{ backgroundColor: 'var(--theme-header-bg)' }}
      >
        {/* Left: School Identity */}
        <div className="flex items-center gap-4 min-w-0">
          {settings.logoUrl ? (
            <div className={`${densityStyles.iconSize} rounded-2xl bg-white p-1 flex items-center justify-center shadow-md border border-slate-200 shrink-0`}>
              <img
                src={settings.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className={`${densityStyles.iconSize} rounded-2xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast,#ffffff)] flex items-center justify-center font-black text-xl shadow-lg shadow-[var(--theme-ring)] shrink-0`}>
              <Building className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`font-black tracking-tight uppercase truncate leading-tight ${densityStyles.titleSize}`}>
                {settings.schoolName}
              </h1>

              {config.showConnectionStatus && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0 border ${
                  isOnline
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}>
                  {isOnline ? (
                    <>
                      <Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> TERHUBUNG • {formattedSyncTime}
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-500" /> OFFLINE
                    </>
                  )}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              {config.customSubtitle || settings.appSubtitle || 'Pusat Informasi & Pemantauan Operasional Sekolah Terpadu'}
            </p>
          </div>
        </div>

        {/* Right: Digital Realtime Clock & Interactive Controls */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            {formattedDate && (
              <div className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {formattedDate}
              </div>
            )}
            <div
              className="text-2xl sm:text-4xl font-mono font-black tracking-wider text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formattedTime}
            </div>
          </div>

          {/* TV Controls (Pause, Volume, Prev/Next, Fullscreen, Close) */}
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/10 dark:border-white/10">
            {activePanels.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSlideIndex((prev) => (prev - 1 + activePanels.length) % activePanels.length)
                  }
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Panel Sebelumnya (Panah Kiri)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title={isPaused ? 'Lanjutkan Rotasi Otomatis (Spasi)' : 'Jeda Rotasi Layar (Spasi)'}
                >
                  {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentSlideIndex((prev) => (prev + 1) % activePanels.length)
                  }
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Panel Berikutnya (Panah Kanan)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {config.allowSound && (
              <button
                type="button"
                onClick={() => {
                  if (isMuted) SchoolBellService.playPeriodChangeBell();
                  setIsMuted(!isMuted);
                }}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Audio Bel' : 'Bisukan Suara'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh (F / Esc)' : 'Layar Penuh (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white transition-colors cursor-pointer ml-1"
              title="Keluar Mode TV (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA: SAFE VIEWPORT FIT 16:9 */}
      <main className="relative z-10 flex-1 px-8 py-5 flex flex-col justify-center overflow-hidden">
        {/* PANEL 1: GURU & PETUGAS PIKET HARI INI */}
        {currentPanelId === 'duty_teachers' && (
          <div
            key={`panel-duty-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--theme-primary-light)] text-[var(--theme-primary)] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    GURU & PETUGAS PIKET SIAGA HARI INI
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hari {todayName} • Siaga operasional dan pendampingan di pos strategis sekolah
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${densityStyles.gridGap}`}>
              {todaySchedules.length > 0 ? (
                todaySchedules.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md flex items-center gap-4 hover:border-[var(--theme-primary-border)] transition-all ${densityStyles.cardPadding}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-black text-lg flex items-center justify-center border border-[var(--theme-primary-border)] shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base text-slate-900 dark:text-white truncate">
                        {item.petugasName}
                      </div>
                      <div className="text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-semibold truncate mt-0.5">
                        📍 {item.ruangName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        ⏰ {item.jamMulai} - {item.jamSelesai} WIB
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center rounded-3xl bg-white/60 dark:bg-[var(--theme-card-bg)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-500 font-medium">
                  Belum ada penugasan guru piket yang terjadwal untuk hari ini ({todayName}).
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 2: GURU BERHALANGAN & GURU INVAL (PENGGANTI) */}
        {currentPanelId === 'substitutions' && (
          <div
            key={`panel-subs-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    GURU BERHALANGAN & ALOKASI GURU INVAL (PENGGANTI)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Informasi kelas pengganti agar aktivitas belajar mengajar siswa tetap berlangsung tertib
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 ${densityStyles.gridGap}`}>
              {todaySubs.length > 0 ? (
                todaySubs.map((sub) => (
                  <div
                    key={sub.id}
                    className={`rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md flex flex-col justify-between gap-3 ${densityStyles.cardPadding}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-rose-500 dark:text-rose-400 block">
                          Guru Berhalangan: {sub.guruBerhalanganName}
                        </span>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          {sub.mataPelajaran} • Kelas {sub.kelas} ({sub.jamPelajaran})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        {sub.alasan.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200/70 dark:border-[var(--theme-card-border)] text-xs">
                      <span className="text-slate-400 block font-medium">Guru Pengganti / Inval:</span>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                        🧑‍🏫 {sub.guruPenggantiName || 'Sedang Dikoordinasikan Tim Piket'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center rounded-3xl bg-white/60 dark:bg-[var(--theme-card-bg)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-500 font-medium">
                  Seluruh guru mata pelajaran terjadwal hadir lengkap pada hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 3: BUKU TAMU & KUNJUNGAN RESMI SEKOLAH */}
        {currentPanelId === 'visitors' && (
          <div
            key={`panel-visitors-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    BUKU TAMU & KUNJUNGAN RESMI SEKOLAH
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daftar tamu dinas, mitra kerjasama, dan orang tua siswa yang sedang berada di area kampus
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${densityStyles.gridGap}`}>
              {activeVisitors.length > 0 ? (
                activeVisitors.map((vis) => (
                  <div
                    key={vis.id}
                    className={`rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md flex flex-col justify-between gap-2.5 ${densityStyles.cardPadding}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] bg-[var(--theme-primary-light)] px-2.5 py-0.5 rounded-lg border border-[var(--theme-primary-border)]">
                          Badge #{vis.nomorBadge}
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Tiba: {vis.jamMasuk} WIB
                        </span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-1.5 truncate">
                        {vis.namaTamu}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {vis.instansiAsal || 'Keluarga / Wali Murid'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)] text-xs text-slate-600 dark:text-slate-300 truncate">
                      Tujuan: <strong className="text-slate-900 dark:text-white">{vis.tujuanBertemu}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center rounded-3xl bg-white/60 dark:bg-[var(--theme-card-bg)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-500 font-medium">
                  Tidak ada tamu luar yang sedang aktif berada di area sekolah saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 4: RINGKASAN KEDISIPLINAN & KETERTIBAN KAMPUS */}
        {currentPanelId === 'discipline' && (
          <div
            key={`panel-discipline-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    RINGKASAN KEDISIPLINAN & KETERTIBAN KAMPUS
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Statistik real-time pengawasan gerbang sekolah, izin keluar, dan kesiapsiagaan pos
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-8 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-lg text-center space-y-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Terlambat Hari Ini
                </span>
                <div className="text-5xl font-black text-rose-500 font-mono">
                  {todayTardy.length}
                </div>
                <p className="text-xs text-slate-500">Dalam Penanganan & Pembinaan Piket</p>
              </div>

              <div className="p-8 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-lg text-center space-y-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Izin di Luar (Gate Pass)
                </span>
                <div className="text-5xl font-black text-amber-500 font-mono">
                  {activePermits.length}
                </div>
                <p className="text-xs text-slate-500">Dispensasi Resmi Guru Piket</p>
              </div>

              <div className="p-8 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-lg text-center space-y-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  Pos Piket Siaga Aktif
                </span>
                <div className="text-5xl font-black text-emerald-500 font-mono">
                  {todaySchedules.length}
                </div>
                <p className="text-xs text-slate-500">Pos Terjadwal Tercover Penuh</p>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 5: PENGUMUMAN & AGENDA SEKOLAH */}
        {currentPanelId === 'announcements' && (
          <div
            key={`panel-announcements-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    PENGUMUMAN & AGENDA KHUSUS SEKOLAH
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Informasi resmi pimpinan dan panitia kegiatan sekolah
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${densityStyles.gridGap}`}>
              {activeAnnouncements.length > 0 ? (
                activeAnnouncements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md flex flex-col justify-between gap-3 ${densityStyles.cardPadding}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.priority === 'DARURAT'
                            ? 'bg-rose-500/20 text-rose-500'
                            : item.priority === 'PENTING'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {item.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.date}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                        {item.content}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-[var(--theme-card-border)] pt-2 truncate">
                      Oleh: {item.authorName} ({item.authorRole})
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center rounded-3xl bg-white/60 dark:bg-[var(--theme-card-bg)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-500 font-medium">
                  Belum ada pengumuman khusus yang diterbitkan saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 6: PROFIL & IDENTITAS SEKOLAH */}
        {currentPanelId === 'school_identity' && (
          <div
            key={`panel-identity-${currentSlideIndex}`}
            className={`space-y-4 max-w-7xl mx-auto w-full ${transitionClass}`}
            style={{ animationDuration: `${config.transitionDurationMs}ms` }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`font-black tracking-tight ${densityStyles.titleSize}`}>
                    PROFIL & IDENTITAS RESMI SEKOLAH
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lembaga pendidikan berkualitas, aman, dan berkarakter
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                SLIDE {currentSlideIndex + 1} / {activePanels.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Visi & NPSN */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">
                  <Award className="w-4 h-4" />
                  <span>IDENTITAS SATUAN PENDIDIKAN</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {settings.schoolName}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {settings.address}
                </p>
                <div className="pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)] flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-300">
                  <span>NPSN: {settings.npsn || '20109988'}</span>
                  <span>Kota: {settings.reportCity || 'Jakarta'}</span>
                </div>
              </div>

              {/* Card 2: Pimpinan & Koordinator */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>PIMPINAN & KOORDINATOR PIKET</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Kepala Sekolah:</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {settings.principalName || 'Pimpinan Sekolah'}
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Koordinator Piket:</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {settings.coordinatorName || 'Koordinator Harian'}
                  </div>
                </div>
              </div>

              {/* Card 3: Semester Akademik & Kontak */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-md space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <BookOpen className="w-4 h-4" />
                  <span>TAHUN AJARAN & KONTAK</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Tahun Ajaran {settings.academicSemester?.academicYear || '2026/2027'}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Layanan Pengaduan & Informasi Piket Sekolah Terintegrasi.
                </p>
                <div className="pt-2 border-t border-slate-100 dark:border-[var(--theme-card-border)] text-xs text-slate-600 dark:text-slate-300">
                  Telepon: {settings.phone || '021-78901234'} • Email: {settings.email || 'info@sekolah.sch.id'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM RUNNING TICKER / STATIC ANNOUNCEMENT BAR */}
      {config.tickerMessages.length > 0 && (
        <footer
          className="relative z-20 border-t border-slate-200/80 dark:border-[var(--theme-card-border)] px-8 py-2.5 flex items-center gap-4 transition-colors shrink-0"
          style={{ backgroundColor: 'var(--theme-card-bg)' }}
        >
          {/* Ticker Badge */}
          <div className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast,#ffffff)] font-mono font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm shadow-[var(--theme-ring)]">
            <Sparkles className="w-3.5 h-3.5" /> PENGUMUMAN
          </div>

          {/* Marquee Mode, Static Mode, or Static Fallback when ticker is disabled */}
          <div className="flex-1 overflow-hidden min-h-[1.75rem] flex items-center">
            {config.tickerEnabled && !prefersReducedMotion && config.tickerMode === 'marquee' ? (
              <div className="whitespace-nowrap overflow-hidden w-full">
                <div className={`inline-block ${tickerSpeedClass} ${tickerFontClass} text-slate-700 dark:text-slate-200 leading-normal`}>
                  {config.tickerMessages.join(' ••• ')}
                </div>
              </div>
            ) : (
              <div className="w-full truncate animate-in fade-in duration-300">
                <span className={`${tickerFontClass} text-slate-700 dark:text-slate-200 truncate block leading-normal`}>
                  📢 {config.tickerMessages[staticTickerIndex % config.tickerMessages.length]}
                </span>
              </div>
            )}
          </div>

          {/* Slide Indicator Dots */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {activePanels.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentSlideIndex === idx
                    ? 'w-6 bg-[var(--theme-primary)]'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`Pindah ke Slide #${idx + 1}`}
              />
            ))}
          </div>
        </footer>
      )}
    </div>
  );
};
