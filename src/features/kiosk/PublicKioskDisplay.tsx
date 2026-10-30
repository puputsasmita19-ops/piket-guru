import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appLogo } from '../../utils/reportBranding';
import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { kioskSlideIntervalMs, kioskTickerText } from './kioskPresentation';
import { getKioskTheme } from './kioskTheme';
import { AnnouncementRecord } from '../../types/announcement.types';
import {
  ShieldCheck,
  UserCheck,
  Radio,
  Maximize,
  Minimize,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Video,
  Building2,
  BookOpenCheck,
  Clock3,
} from 'lucide-react';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { getTodayISODate } from '../../utils/dateUtils';
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

const KioskClock = React.memo(function KioskClock({
  timezone,
  showSeconds,
  showDate,
  timeFormat,
}: Pick<ReturnType<typeof sanitizeLobbyTvConfig>, 'timezone' | 'showSeconds' | 'showDate' | 'timeFormat'>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: timeFormat === '12h',
    }),
    [timezone, showSeconds, timeFormat]
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [timezone]
  );
  return (
    <div className="text-right tv-kiosk-clock">
      {showDate && <div className="tv-kiosk-date text-[11px] sm:text-xs uppercase tracking-[0.14em] font-semibold text-[var(--kiosk-muted)]">{dateFormatter.format(now)}</div>}
      <div className="tv-kiosk-time font-mono font-black tracking-[0.15em] text-[var(--kiosk-accent)] text-2xl sm:text-4xl lg:text-5xl">{timeFormatter.format(now)}</div>
    </div>
  );
});

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages.length ? pages : [[]];
};

const toLines = (value?: string[]) => (Array.isArray(value) ? value.filter(Boolean) : []);

function getYouTubeEmbedUrl(rawUrl?: string, autoplay = true, muted = true): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl.trim());
    let videoId = '';
    if (url.hostname.includes('youtu.be')) {
      videoId = url.pathname.replace('/', '').split('/')[0];
    } else if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
      else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      else videoId = url.searchParams.get('v') || '';
    }
    if (!videoId) return '';
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      controls: '1',
      autoplay: autoplay ? '1' : '0',
      mute: muted ? '1' : '0',
      loop: '1',
      playlist: videoId,
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return '';
  }
}

function infoCardClass(config: ReturnType<typeof sanitizeLobbyTvConfig>): string {
  const rounded = config.densityScale === 'large' ? 'rounded-[30px]' : 'rounded-[26px]';
  return `${rounded} border border-[var(--kiosk-border)] bg-[var(--kiosk-card)] shadow-[0_12px_36px_rgba(2,8,23,0.18)]`;
}

function densityClass(config: ReturnType<typeof sanitizeLobbyTvConfig>, target: 'title' | 'body' | 'small' | 'metric' | 'hero') {
  const size = config.densityScale;
  switch (target) {
    case 'hero':
      return size === 'large' ? 'text-4xl xl:text-5xl' : size === 'compact' ? 'text-2xl xl:text-3xl' : 'text-3xl xl:text-4xl';
    case 'metric':
      return size === 'large' ? 'text-4xl xl:text-5xl' : size === 'compact' ? 'text-2xl xl:text-3xl' : 'text-3xl xl:text-4xl';
    case 'title':
      return size === 'large' ? 'text-xl xl:text-2xl' : size === 'compact' ? 'text-base xl:text-lg' : 'text-lg xl:text-xl';
    case 'body':
      return size === 'large' ? 'text-base xl:text-lg' : size === 'compact' ? 'text-xs xl:text-sm' : 'text-sm xl:text-base';
    default:
      return size === 'large' ? 'text-sm xl:text-base' : size === 'compact' ? 'text-[11px] xl:text-xs' : 'text-xs xl:text-sm';
  }
}

function SectionHeader({ icon, title, badge, config }: { icon: React.ReactNode; title: string; badge?: string; config: ReturnType<typeof sanitizeLobbyTvConfig> }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] flex items-center justify-center text-[var(--kiosk-accent)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className={`font-black tracking-tight text-[var(--kiosk-text)] ${densityClass(config, 'title')}`}>{title}</h3>
        </div>
      </div>
      {badge && <span className="shrink-0 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold border border-[var(--kiosk-border)] bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)]">{badge}</span>}
    </div>
  );
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
  const [todayISO, setTodayISO] = useState(getTodayISODate);
  const [rotationTick, setRotationTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const mainRef = useRef<HTMLElement>(null);

  const config = useMemo(() => sanitizeLobbyTvConfig(settings.lobbyTv), [settings.lobbyTv]);
  const kioskTheme = getKioskTheme(config);
  const tickerText = kioskTickerText(config);
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
  } as React.CSSProperties;

  const todaySchedules = useMemo(() => getEffectiveSchedulesOnDate(schedules, todayISO), [schedules, todayISO]);
  const todaySubs = useMemo(() => substitutions.filter((s) => s.tanggal === todayISO), [substitutions, todayISO]);
  const todayTardy = useMemo(() => tardiness.filter((t) => t.tanggal === todayISO), [tardiness, todayISO]);
  const activePermits = useMemo(() => permits.filter((p) => p.tanggal === todayISO && p.status === 'SEDANG_KELUAR'), [permits, todayISO]);
  const activeVisitors = useMemo(() => visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG'), [visitors]);
  const publicAnnouncements = useMemo(() => announcements.filter((a) => a.isActive && (!a.targetRole || a.targetRole === 'SEMUA')), [announcements]);
  const missionLines = useMemo(() => toLines(config.schoolMissions), [config.schoolMissions]);
  const ruleLines = useMemo(() => toLines(config.schoolRules), [config.schoolRules]);
  const embedVideoUrl = useMemo(() => getYouTubeEmbedUrl(config.profileVideoUrl, true, !config.allowSound || isMuted), [config.profileVideoUrl, config.allowSound, isMuted]);
  const densityOuterPadding = config.densityScale === 'large' ? 'p-4 sm:p-6 lg:p-7' : config.densityScale === 'compact' ? 'p-3 sm:p-4 lg:p-5' : 'p-4 sm:p-5 lg:p-6';

  const teacherPages = useMemo(() => chunk(todaySchedules, config.densityScale === 'large' ? 3 : config.densityScale === 'compact' ? 4 : 4), [todaySchedules, config.densityScale]);
  const visitorPages = useMemo(() => chunk(activeVisitors, config.densityScale === 'large' ? 2 : 3), [activeVisitors, config.densityScale]);
  const announcementPages = useMemo(() => chunk(publicAnnouncements, config.densityScale === 'large' ? 3 : 4), [publicAnnouncements, config.densityScale]);
  const substitutionPages = useMemo(() => chunk(todaySubs, config.densityScale === 'large' ? 2 : 3), [todaySubs, config.densityScale]);
  const rulesPages = useMemo(() => chunk(ruleLines, config.densityScale === 'large' ? 4 : 5), [ruleLines, config.densityScale]);

  const infoSections = useMemo(() => {
    const sections: Array<{ key: string; title: string; badge: string; render: () => React.ReactNode }> = [];
    if (config.enabledPanels.includes('discipline')) {
      sections.push({
        key: 'discipline',
        title: 'Ringkasan Kedisiplinan',
        badge: 'Live',
        render: () => (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3 text-center">
              <div className={`font-black text-[var(--kiosk-danger)] font-mono ${densityClass(config, 'metric')}`}>{todayTardy.length}</div>
              <p className={`mt-1 font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>Siswa terlambat</p>
            </div>
            <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3 text-center">
              <div className={`font-black text-[var(--kiosk-warning)] font-mono ${densityClass(config, 'metric')}`}>{activePermits.length}</div>
              <p className={`mt-1 font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>Izin keluar</p>
            </div>
            <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3 text-center">
              <div className={`font-black text-[var(--kiosk-success)] font-mono ${densityClass(config, 'metric')}`}>{todaySchedules.length}</div>
              <p className={`mt-1 font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>Pos siaga</p>
            </div>
          </div>
        ),
      });
    }
    if (config.enabledPanels.includes('substitutions')) {
      sections.push({
        key: 'substitutions',
        title: 'Guru Berhalangan & Pengganti',
        badge: todaySubs.length ? `${todaySubs.length} data` : 'Nihil',
        render: () => {
          const page = substitutionPages[rotationTick % substitutionPages.length] || [];
          return page.length ? (
            <div className="mt-4 space-y-3">
              {page.map((sub) => (
                <div key={sub.id} className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-black text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>{sub.guruBerhalanganName || 'Guru tidak diketahui'}</p>
                      <p className={`text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>{sub.mapel} • {sub.kelas}</p>
                    </div>
                    <span className="rounded-full px-2 py-1 text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/20">{sub.alasan?.replaceAll('_', ' ') || 'Berhalangan'}</span>
                  </div>
                  <p className={`font-semibold text-[var(--kiosk-success)] ${densityClass(config, 'body')}`}>Pengganti: {sub.guruPenggantiName || 'Dalam koordinasi tim piket'}</p>
                </div>
              ))}
            </div>
          ) : <p className={`mt-4 rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4 text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Tidak ada guru berhalangan hari ini.</p>;
        },
      });
    }
    sections.push({
      key: 'rules',
      title: 'Tata Tertib & Imbauan',
      badge: ruleLines.length ? `${ruleLines.length} poin` : 'Default',
      render: () => {
        const page = rulesPages[rotationTick % rulesPages.length] || [];
        return (
          <div className="mt-4 space-y-3">
            {(page.length ? page : ['Belum ada tata tertib khusus yang disetel.']).map((rule, index) => (
              <div key={`${rule}-${index}`} className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] px-3 py-2.5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] font-black text-xs">{index + 1 + (rotationTick % rulesPages.length) * (config.densityScale === 'large' ? 4 : 5)}</div>
                <p className={`font-semibold text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>{rule}</p>
              </div>
            ))}
          </div>
        );
      },
    });
    if (config.enabledPanels.includes('announcements')) {
      sections.push({
        key: 'announcements',
        title: 'Pengumuman Sekolah',
        badge: publicAnnouncements.length ? `${publicAnnouncements.length} aktif` : 'Belum ada',
        render: () => {
          const page = announcementPages[rotationTick % announcementPages.length] || [];
          return page.length ? (
            <div className="mt-4 space-y-3">
              {page.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full px-2 py-1 text-[10px] font-bold bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] border border-[var(--kiosk-border)]">{item.priority}</span>
                  </div>
                  <h4 className={`font-black text-[var(--kiosk-text)] leading-tight ${densityClass(config, 'body')}`}>{item.title}</h4>
                  <p className={`text-[var(--kiosk-muted)] line-clamp-3 ${densityClass(config, 'small')}`}>{item.content}</p>
                </article>
              ))}
            </div>
          ) : <p className={`mt-4 rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4 text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Belum ada pengumuman publik aktif.</p>;
        },
      });
    }
    return sections;
  }, [config, todayTardy.length, activePermits.length, todaySchedules.length, todaySubs, ruleLines, rulesPages, publicAnnouncements, announcementPages, substitutionPages, rotationTick]);

  const currentTeacherPage = teacherPages[rotationTick % teacherPages.length] || [];
  const currentVisitorPage = visitorPages[rotationTick % visitorPages.length] || [];
  const currentInfoSection = infoSections[rotationTick % infoSections.length] || infoSections[0];

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const refreshDay = () => setTodayISO(getTodayISODate());
    const timer = window.setInterval(refreshDay, 60_000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    const timer = window.setTimeout(() => setRotationTick((prev) => prev + 1), kioskSlideIntervalMs(config));
    return () => window.clearTimeout(timer);
  }, [config, rotationTick]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [rotationTick]);

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
    <div className="tv-kiosk-viewport fixed inset-0 z-50 flex flex-col select-none overflow-hidden font-sans bg-[var(--kiosk-bg)] text-[var(--kiosk-text)]" style={kioskVars} data-kiosk-mode={kioskTheme.mode} data-kiosk-theme={config.theme} data-tv-density={config.densityScale}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 left-[10%] h-72 w-72 rounded-full blur-3xl opacity-10" style={{ background: themeAccent }} />
        <div className="absolute bottom-0 right-[8%] h-80 w-80 rounded-full blur-3xl opacity-10" style={{ background: themeAccent }} />
      </div>

      <header className="relative z-10 p-3 sm:p-4 lg:p-5">
        <div className={`${infoCardClass(config)} px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-5`}>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {config.showSchoolIdentity && (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] bg-white/95 p-2 border border-white/30 shadow-lg shrink-0">
                  <img src={appLogo(settings)} alt="Logo sekolah" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--kiosk-border)] bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] text-[10px] sm:text-xs font-black tracking-[0.16em] uppercase">Commercial Smart Signage • Lobby Display</div>
                <h1 className={`mt-2 font-black leading-[0.95] tracking-tight max-w-[56rem] ${densityClass(config, 'hero')}`}>{settings.schoolName}</h1>
                <p className={`mt-2 font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>{config.customSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 xl:justify-end">
              <div className="flex flex-wrap items-center gap-2 md:max-w-[28rem] xl:justify-end">
                <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] px-4 py-3 min-w-[13rem]">
                  <div className="flex items-center gap-2 text-[var(--kiosk-accent)] font-black uppercase tracking-wide text-[11px] sm:text-xs"><Video className="w-4 h-4" /> Sistem Informasi Real-Time</div>
                </div>
                {config.showConnectionStatus && (
                  <div className={`rounded-2xl border px-4 py-3 min-w-[12rem] ${isOnline ? 'bg-emerald-500/14 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/14 text-rose-300 border-rose-500/20'}`}>
                    <div className="flex items-center gap-2 font-black uppercase tracking-wide text-[11px] sm:text-xs"><Radio className="w-4 h-4" /> Status: {isOnline ? 'Online' : 'Offline'}</div>
                  </div>
                )}
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-200 px-4 py-3 min-w-[11rem]">
                  <div className="font-black uppercase tracking-wide text-[11px] sm:text-xs">Ringkasan Hari Ini</div>
                  <div className="text-sm sm:text-base font-bold mt-0.5">Guru: {todaySchedules.length} • Tamu: {activeVisitors.length}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end">
                <KioskClock timezone={config.timezone} showDate={config.showDate} showSeconds={config.showSeconds} timeFormat={config.timeFormat} />
                <div className="flex items-center gap-2">
                  {config.allowSound && (
                    <button
                      onClick={() => {
                        if (isMuted) SchoolBellService.playPeriodChangeBell();
                        setIsMuted((previous) => !previous);
                      }}
                      className="p-3 rounded-2xl bg-[var(--kiosk-inset)] hover:bg-[var(--kiosk-hover)] border border-[var(--kiosk-border)] text-[var(--kiosk-muted)] transition-colors"
                      title={isMuted ? 'Uji suara TV (bel sekali)' : 'Matikan indikator suara TV'}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5 text-[var(--kiosk-danger)]" /> : <Volume2 className="w-5 h-5 text-[var(--kiosk-success)]" />}
                    </button>
                  )}
                  <button onClick={toggleFullscreen} className="p-3 rounded-2xl bg-[var(--kiosk-inset)] hover:bg-[var(--kiosk-hover)] border border-[var(--kiosk-border)] text-[var(--kiosk-muted)] transition-colors" title="Layar penuh">
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                  <button onClick={onClose} className="p-3 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white transition-colors" title="Keluar mode TV">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {(isPreviewMode || hasUnsavedChanges) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {isPreviewMode && <span className="rounded-full px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Pratinjau draf lokal</span>}
              {hasUnsavedChanges && <span className="rounded-full px-3 py-1 text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">Ada perubahan yang belum disimpan</span>}
            </div>
          )}
        </div>
      </header>

      <main ref={mainRef} className={`relative z-10 flex-1 min-h-0 overflow-y-auto ${densityOuterPadding}`}>
        {!config.enabled ? (
          <div className={`${infoCardClass(config)} p-8 text-center`}>
            <h2 className={`font-black ${densityClass(config, 'hero')}`}>TV Lobi dinonaktifkan oleh Administrator</h2>
            <p className={`mt-3 text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Aktifkan kembali dari Pengaturan Sekolah → Pengaturan TV Lobi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 auto-rows-fr">
            <section className={`xl:col-span-7 ${infoCardClass(config)} ${densityOuterPadding} flex flex-col gap-4 min-h-[28rem]`}>
              <SectionHeader icon={<Video className="w-5 h-5" />} title={config.profileVideoTitle || 'Video Profil Utama Sekolah'} badge="YouTube Embed" config={config} />
              <p className={`text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>{config.profileVideoSubtitle || 'Sematkan tautan YouTube resmi sekolah agar tidak membebani penyimpanan server.'}</p>
              {embedVideoUrl ? (
                <div className="relative flex-1 min-h-[18rem] lg:min-h-[24rem] rounded-[24px] overflow-hidden border border-[var(--kiosk-border)] bg-black/20">
                  <iframe
                    title={config.profileVideoTitle || 'Video profil sekolah'}
                    src={embedVideoUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-[18rem] lg:min-h-[24rem] rounded-[24px] border border-dashed border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] flex flex-col items-center justify-center text-center px-6">
                  <MonitorPlaceholder config={config} />
                </div>
              )}
            </section>

            {config.enabledPanels.includes('school_identity') && (<section className={`xl:col-span-5 ${infoCardClass(config)} ${densityOuterPadding} min-h-[20rem]`}>
              <SectionHeader icon={<Building2 className="w-5 h-5" />} title="Profil, Visi & Misi Sekolah" badge="Identitas" config={config} />
              <div className="mt-4 grid grid-cols-1 gap-3 xl:gap-4">
                <div className="rounded-[24px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4">
                  <p className={`uppercase tracking-[0.16em] font-black text-[var(--kiosk-accent)] ${densityClass(config, 'small')}`}>Visi Utama Sekolah</p>
                  <p className={`mt-2 font-bold italic leading-snug text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>“{config.schoolVision || 'Belum ada visi sekolah yang diatur.'}”</p>
                </div>
                <div className="rounded-[24px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4">
                  <p className={`uppercase tracking-[0.16em] font-black text-[var(--kiosk-accent)] ${densityClass(config, 'small')}`}>Misi Sekolah</p>
                  <div className="mt-3 space-y-2.5">
                    {missionLines.length ? missionLines.slice(0, 5).map((line, index) => (
                      <div key={`${line}-${index}`} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] font-black text-xs">{index + 1}</div>
                        <p className={`font-semibold leading-snug text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>{line}</p>
                      </div>
                    )) : <p className={`text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Belum ada misi sekolah yang diatur.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4">
                    <p className={`text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>NPSN</p>
                    <p className={`font-black mt-1 ${densityClass(config, 'body')}`}>{settings.npsn || '-'}</p>
                  </div>
                  <div className="rounded-[22px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4">
                    <p className={`text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>Kontak</p>
                    <p className={`font-black mt-1 break-words ${densityClass(config, 'body')}`}>{settings.phone || settings.email || '-'}</p>
                  </div>
                </div>
              </div>
            </section>)}

            {config.enabledPanels.includes('visitors') && (<section className={`xl:col-span-7 ${infoCardClass(config)} ${densityOuterPadding} min-h-[14rem]`}>
              <SectionHeader icon={<UserCheck className="w-5 h-5" />} title="Buku Tamu Lobi" badge={`Hari ini: ${activeVisitors.length} registrasi`} config={config} />
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
                <div className="rounded-[24px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-4 text-center">
                  <div className={`font-black font-mono text-[var(--kiosk-success)] ${densityClass(config, 'metric')}`}>{activeVisitors.length}</div>
                  <p className={`mt-2 font-semibold text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>Tamu aktif berada di sekolah</p>
                  <p className={`mt-1 text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>Menggunakan data registrasi yang sedang berlangsung</p>
                </div>
                <div className="space-y-3">
                  {currentVisitorPage.length ? currentVisitorPage.map((visitor) => (
                    <div key={visitor.id} className="rounded-[22px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`font-black text-[var(--kiosk-text)] ${densityClass(config, 'body')}`}>{visitor.namaTamu}</p>
                        <p className={`text-[var(--kiosk-muted)] break-words ${densityClass(config, 'small')}`}>{visitor.instansiAsal || 'Umum'} • Bertemu: {visitor.tujuanBertemu || '-'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold border border-[var(--kiosk-border)] bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)]">{visitor.nomorBadge || 'Badge'}</span>
                        <p className={`mt-2 text-[var(--kiosk-success)] font-bold ${densityClass(config, 'small')}`}>{visitor.jamMasuk || '-'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-[22px] border border-dashed border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-5 text-center">
                      <p className={`font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Belum ada registrasi tamu yang aktif hari ini.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>)}

            {config.enabledPanels.includes('duty_teachers') && (<section className={`xl:col-span-2 ${infoCardClass(config)} ${densityOuterPadding} min-h-[14rem]`}>
              <SectionHeader icon={<ShieldCheck className="w-5 h-5" />} title="Guru Piket" badge={todaySchedules.length ? `${todaySchedules.length} petugas` : 'Belum ada'} config={config} />
              <div className="mt-4 space-y-3">
                {currentTeacherPage.length ? currentTeacherPage.map((schedule) => (
                  <div key={schedule.id} className="rounded-[22px] border border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-3">
                    <p className={`font-black text-[var(--kiosk-text)] leading-tight ${densityClass(config, 'body')}`}>{schedule.petugasName}</p>
                    <p className={`mt-1 text-[var(--kiosk-muted)] ${densityClass(config, 'small')}`}>{schedule.petugasRole || 'Guru Piket'} • {schedule.ruangName || 'Pos Piket'}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold bg-[var(--kiosk-soft)] text-[var(--kiosk-accent)] border border-[var(--kiosk-border)]">
                      <Clock3 className="w-3 h-3" /> {schedule.jamMulai} – {schedule.jamSelesai}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-[var(--kiosk-border)] bg-[var(--kiosk-inset)] p-5 text-center">
                    <p className={`font-semibold text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Belum ada guru piket terjadwal hari ini.</p>
                  </div>
                )}
              </div>
            </section>)}

            <section className={`xl:col-span-3 ${infoCardClass(config)} ${densityOuterPadding} min-h-[14rem]`}>
              <SectionHeader icon={<BookOpenCheck className="w-5 h-5" />} title={currentInfoSection?.title || 'Informasi Sekolah'} badge={currentInfoSection?.badge || 'Info'} config={config} />
              {currentInfoSection?.render()}
            </section>
          </div>
        )}
      </main>

      {config.enabled && config.tickerEnabled && tickerText && (
        <footer data-ticker-size={config.tickerFontSize} className="tv-kiosk-ticker relative z-10 bg-[var(--kiosk-card)] border-t border-[var(--kiosk-border)] px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="tv-type-ticker-label px-3 py-1 rounded-xl bg-[var(--kiosk-accent)] text-[var(--kiosk-accent-ink)] font-mono font-bold shrink-0 flex items-center gap-1.5 text-xs sm:text-sm">
            <Sparkles className="w-3.5 h-3.5" /> PENGUMUMAN
          </div>
          <div className="flex-1 overflow-hidden whitespace-nowrap">
            <div
              className={`tv-type-ticker inline-block font-semibold text-[var(--kiosk-muted)] ${config.tickerMode === 'marquee' ? 'animate-marquee' : ''} ${config.tickerFontSize === 'sm' ? 'text-xs' : config.tickerFontSize === 'lg' ? 'text-lg' : 'text-sm'}`}
              style={config.tickerMode === 'marquee' ? { animationDuration: config.tickerSpeed === 'slow' ? '65s' : config.tickerSpeed === 'fast' ? '20s' : '40s' } : undefined}
            >
              {tickerText}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

function MonitorPlaceholder({ config }: { config: ReturnType<typeof sanitizeLobbyTvConfig> }) {
  return (
    <>
      <div className="w-20 h-20 rounded-full bg-[var(--kiosk-soft)] flex items-center justify-center text-[var(--kiosk-accent)]">
        <Video className="w-10 h-10" />
      </div>
      <h3 className={`mt-4 font-black text-[var(--kiosk-text)] ${densityClass(config, 'title')}`}>Sematkan Link Video Profil YouTube</h3>
      <p className={`mt-2 max-w-xl text-[var(--kiosk-muted)] ${densityClass(config, 'body')}`}>Belum ada tautan video profil sekolah. Tambahkan URL YouTube pada Pengaturan TV Lobi agar video tampil di layar tanpa mengunggah file ke server sekolah.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] sm:text-xs font-bold text-[var(--kiosk-accent)]">
        <span className="rounded-full px-3 py-1 border border-[var(--kiosk-border)] bg-[var(--kiosk-soft)]">Mendukung youtube.com</span>
        <span className="rounded-full px-3 py-1 border border-[var(--kiosk-border)] bg-[var(--kiosk-soft)]">Mendukung youtu.be</span>
      </div>
    </>
  );
}
