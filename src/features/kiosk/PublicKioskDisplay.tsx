import './kioskDisplay.css';
import { tvTypography, tvPageCapacity, tvChunks, tvTextPages, tvAnnouncementBudget, tvSubstitutionDetails } from './tvLayout';
import { ALL_TV_PANELS } from '../../types/lobbyTv.types';
import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { appLogo } from '../../utils/reportBranding';
import { Megaphone } from '../../components/icons';
import { MapPin } from '../../components/icons';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Minimize, Maximize, X, Volume2, VolumeX, Wifi, WifiOff, ChevronLeft, ChevronRight, Pause, Play } from '../../components/icons';
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
  hasUnsavedChanges?: boolean;
}

const EMPTY_RECORDS: never[] = [];
interface TvPage {
  panel: TvPanelId;
  index: number;
  count: number;
  rows: (ScheduleItem | TeacherSubstitutionRecord | VisitorRecord)[];
  columns: number;
  tileIndex?: number;
  substitutionDetails?: ReturnType<typeof tvSubstitutionDetails>[number];
  message: { record: AnnouncementRecord; content: string; part: number; parts: number } | null;
}

export const PublicKioskDisplay: React.FC<PublicKioskDisplayProps> = ({
  onClose,
  settings,
  schedules = EMPTY_RECORDS,
  substitutions = EMPTY_RECORDS,
  tardiness = EMPTY_RECORDS,
  permits = EMPTY_RECORDS,
  visitors = EMPTY_RECORDS,
  announcements = EMPTY_RECORDS,
  isPreviewMode = false,
  hasUnsavedChanges = false,
}) => {
  // Sanitize and guarantee safe configuration
  const config: LobbyTvConfig = useMemo(
    () => sanitizeLobbyTvConfig(settings.lobbyTv),
    [settings.lobbyTv]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight, contentWidth: window.innerWidth - 64, contentHeight: Math.max(240, window.innerHeight - 250) }));
  useEffect(() => {
    const update = () => {
      const root = containerRef.current, main = mainRef.current;
      if (!root || !main) return;
      const next = { width: root.clientWidth, height: root.clientHeight, contentWidth: main.clientWidth - 40, contentHeight: main.clientHeight - 40 };
      setViewport(old => Object.keys(next).every(key => old[key as keyof typeof old] === next[key as keyof typeof next]) ? old : next);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (containerRef.current) observer?.observe(containerRef.current);
    if (mainRef.current) observer?.observe(mainRef.current);
    window.addEventListener('resize', update); update();
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, []);
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
    () => getEffectiveSchedulesOnDate(schedules, todayISO),
    [schedules, todayISO]
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

  const type = useMemo(() => tvTypography(viewport.width, viewport.height, config.densityScale), [viewport.width, viewport.height, config.densityScale]);
  const pages = useMemo(() => activePanels.flatMap<TvPage>(panel => {
    const capacity = tvPageCapacity(panel, viewport.contentWidth, viewport.contentHeight, type.scale, config.densityScale);
    const rows = panel === 'duty_teachers' ? todaySchedules : panel === 'substitutions' ? todaySubs : panel === 'visitors' ? activeVisitors : [];
    const recordPages = tvChunks<ScheduleItem | TeacherSubstitutionRecord | VisitorRecord>(rows, capacity.size);
    if ((panel === 'school_identity' || panel === 'discipline') && (viewport.contentWidth < 1100 || (config.densityScale === 'large' && viewport.contentWidth < 1500))) {
      return [0, 1, 2].map(tileIndex => ({ panel, index: tileIndex, count: 3, rows: [], columns: 1, tileIndex, message: null }));
    }
    if (panel === 'announcements') {
      const messages = activeAnnouncements.flatMap(record => tvTextPages(record.content, tvAnnouncementBudget(viewport.contentWidth, viewport.contentHeight, type)).map((content, part, segments) => ({ record, content, part, parts: segments.length })));
      return (messages.length ? messages : [null]).map((message, index, all) => ({ panel, index, count: all.length, rows: [], columns: 1, message }));
    }
    if (panel === 'substitutions' && todaySubs.length) {
      return todaySubs.flatMap(row => tvSubstitutionDetails(row).map(substitutionDetails => ({ row, substitutionDetails })))
        .map(({ row, substitutionDetails }, index, all) => ({ panel, index, count: all.length, rows: [row], columns: 1, substitutionDetails, message: null }));
    }
    return recordPages.map((records, index, all) => ({ panel, index, count: all.length, rows: records, columns: capacity.columns, message: null }));
  }), [activePanels, todaySchedules, todaySubs, activeVisitors, activeAnnouncements, viewport.contentWidth, viewport.contentHeight, type, config.densityScale]);

  // Keep slide index in valid range if panels change dynamically
  useEffect(() => {
    if (currentSlideIndex >= pages.length) {
      setCurrentSlideIndex(0);
    }
  }, [pages.length, currentSlideIndex]);

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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', updateTime);

    return () => {
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', updateTime);
    };
  }, []);

  // 2. Slide Carousel Timer with Pause and Configurable Interval
  useEffect(() => {
    if (isPaused || pages.length <= 1) return;

    const intervalMs = Math.max(3000, config.slideIntervalSec * 1000);
    const slideTimer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % pages.length);
    }, intervalMs);

    return () => clearTimeout(slideTimer);
  }, [isPaused, pages.length, config.slideIntervalSec, currentSlideIndex]);

  // 4. Fullscreen & Escape Key Handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.target instanceof HTMLElement && e.target.closest('button,input,select,textarea,a')) return;
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        // Space / K to pause or resume rotation
        setIsPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => (prev + 1) % pages.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => (prev - 1 + pages.length) % pages.length);
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
  }, [onClose, pages.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const target = containerRef.current || document.documentElement;
      if (target.requestFullscreen) void target.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
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

  const page = pages[Math.min(currentSlideIndex, pages.length - 1)];
  const currentPanelId = page.panel;
  const panelTitle = ALL_TV_PANELS.find(panel => panel.id === currentPanelId)?.label || 'Informasi Sekolah';
  const captions: Record<TvPanelId, string> = {
    duty_teachers: `${todayName} · ${todaySchedules.length} penugasan hari ini`,
    substitutions: `${todaySubs.length} penugasan pengganti hari ini`,
    visitors: `${activeVisitors.length} kunjungan sedang berlangsung`,
    discipline: 'Ringkasan pencatatan dan pengawasan hari ini',
    announcements: 'Informasi resmi dan agenda sekolah',
    school_identity: 'Identitas dan layanan informasi sekolah',
  };
  const tickerSize = Math.max(18, ({ sm: 24, md: 30, lg: 38 }[config.tickerFontSize]) * type.scale);
  const tickerPages = useMemo(() => config.tickerMessages.flatMap(message => tvTextPages(message,
    Math.max(40, Math.floor((viewport.width - 220 * type.scale) / (tickerSize * .65)) * 1.4))), [config.tickerMessages, viewport.width, type.scale, tickerSize]);
  useEffect(() => {
    if (!config.tickerEnabled || (!prefersReducedMotion && config.tickerMode !== 'static') || tickerPages.length <= 1) return;
    const timer = setInterval(() => setStaticTickerIndex(index => (index + 1) % tickerPages.length), 7000);
    return () => clearInterval(timer);
  }, [config.tickerEnabled, config.tickerMode, tickerPages.length, prefersReducedMotion]);
  const transitionClass = prefersReducedMotion || config.transition === 'none' ? '' : config.transition === 'fade' ? 'tv-transition-fade' : 'tv-transition-slide';
  const palettes = { default: ['#854d0e', '#fcd34d'], sky: ['#075985', '#7dd3fc'], mint: ['#065f46', '#6ee7b7'], lavender: ['#6b21a8', '#d8b4fe'], peach: ['#9a3412', '#fdba74'], rose: ['#9f1239', '#fda4af'] };
  const style = Object.fromEntries(Object.entries(type).map(([key, value]) => [`--tv-${key}`, key === 'scale' ? value : `${value}px`])) as React.CSSProperties;
  const panelNames: Record<TvPanelId, string> = { duty_teachers: 'Piket', substitutions: 'Inval', visitors: 'Tamu', discipline: 'Ketertiban', announcements: 'Pengumuman', school_identity: 'Sekolah' };
  const advance = (step: number) => setCurrentSlideIndex(index => (index + step + pages.length) % pages.length);
  return <div ref={containerRef} className={`tv-display tv-${config.colorMode}`} data-tv-density={config.densityScale} data-panel={currentPanelId}
    style={{ ...style, '--tv-accent': palettes[config.theme][config.colorMode === 'dark' ? 1 : 0], '--tv-ticker-size': `${tickerSize}px` } as React.CSSProperties}>
    {(isPreviewMode || !isOnline) && <div className="tv-notice" role="status">{isPreviewMode
      ? hasUnsavedChanges ? 'Pratinjau TV Lobi · Draf belum disimpan' : 'Pratinjau TV Lobi'
      : `Offline · Data tersimpan terakhir ${formattedSyncTime}`}</div>}
    <header className="tv-header">
      <div className="tv-brand">
        {config.showSchoolIdentity && appLogo(settings) && <img className="tv-logo" src={appLogo(settings)} alt="Logo aplikasi" />}
        <div className="tv-brand-copy"><h1>{config.showSchoolIdentity ? settings.schoolName : 'Informasi Sekolah'}</h1><p>{config.customSubtitle || settings.appSubtitle || 'Informasi Sekolah'}</p>
          {config.showConnectionStatus && <p className="tv-connection">{isOnline ? <Wifi /> : <WifiOff />}{isOnline ? `Terhubung · Pembaruan ${formattedSyncTime}` : 'Koneksi terputus'}</p>}
        </div>
      </div>
      <div className="tv-clock"><time>{formattedTime}</time>{formattedDate && <p>{formattedDate}</p>}</div>
      <nav className="tv-controls" aria-label="Kontrol TV Lobi">
        <button type="button" title="Panel Sebelumnya (Panah Kiri)" aria-label="Layar sebelumnya" disabled={pages.length < 2} onClick={() => advance(-1)}><ChevronLeft /></button>
        <button type="button" title={isPaused ? 'Lanjutkan Rotasi Otomatis (Spasi)' : 'Jeda Rotasi Layar (Spasi)'} aria-label={isPaused ? 'Putar informasi TV' : 'Jeda informasi TV'} aria-pressed={isPaused} onClick={() => setIsPaused(value => !value)}>{isPaused ? <Play /> : <Pause />}</button>
        <button type="button" title="Panel Berikutnya (Panah Kanan)" aria-label="Layar berikutnya" disabled={pages.length < 2} onClick={() => advance(1)}><ChevronRight /></button>
        {config.allowSound && <button type="button" aria-label={isMuted ? 'Nyalakan audio' : 'Bisukan audio'} onClick={() => { if (isMuted) SchoolBellService.playPeriodChangeBell(); setIsMuted(value => !value); }}>{isMuted ? <VolumeX /> : <Volume2 />}</button>}
        <button type="button" title="Layar Penuh (F)" aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} onClick={toggleFullscreen}>{isFullscreen ? <Minimize /> : <Maximize />}</button>
        <button type="button" title="Keluar Mode TV (Esc)" aria-label="Tutup mode TV" onClick={onClose}><X /></button>
      </nav>
    </header>
    <main ref={mainRef} className="tv-main">
      <section key={`${currentPanelId}:${page.index}`} className={`tv-panel ${transitionClass}`} style={{ animationDuration: `${config.transitionDurationMs}ms` }} aria-label={panelTitle}>
        <div className="tv-panel-heading"><div><h2>{panelTitle}</h2><p>{captions[currentPanelId]}</p></div><span className="tv-page-badge">Halaman {page.index + 1} / {page.count}</span></div>
        {['duty_teachers', 'substitutions', 'visitors'].includes(currentPanelId) && <div className="tv-grid" style={{ gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))` }}>
          {page.rows.length ? page.rows.map((record, index) => {
            if (currentPanelId === 'duty_teachers') {
              const row = record as ScheduleItem;
              return <article key={row.id} className="tv-record tv-duty" data-record-id={row.id}><span className="tv-record-number">{page.index * tvPageCapacity(currentPanelId, viewport.contentWidth, viewport.contentHeight, type.scale, config.densityScale).size + index + 1}</span><div className="tv-record-body"><h3>{row.petugasName}</h3><p className="tv-accent tv-with-icon"><MapPin />{row.ruangName}</p><p className="tv-secondary tv-with-icon"><Clock />{row.jamMulai}–{row.jamSelesai} WIB</p></div></article>;
            }
            if (currentPanelId === 'substitutions') {
              const row = record as TeacherSubstitutionRecord;
              return <article key={row.id} className={`tv-record tv-substitution ${viewport.width >= 1000 ? 'tv-sub-wide' : ''}`} data-record-id={row.id}>
                <div className="tv-sub-summary">
                  <p className="tv-label">Guru berhalangan</p><h3>{row.guruBerhalanganName}</h3>
                  <p className="tv-secondary">{row.mataPelajaran} · {row.kelas}</p><p className="tv-secondary">{row.jamPelajaran}</p>
                  <div className="tv-sub-detail tv-sub-absence"><span className="tv-label">Keterangan berhalangan hadir: </span><span className="tv-sub-copy">{page.substitutionDetails?.reason}</span></div>
                </div>
                <div className="tv-replacement">
                  <p className="tv-label">Guru pengganti / inval</p><h3 className="tv-accent">{row.guruPenggantiName || 'Sedang dikoordinasikan'}</h3>
                  <div className="tv-sub-detail tv-sub-task"><p className="tv-label">Tindak lanjut / tugas kelas</p><p className="tv-sub-copy">{page.substitutionDetails?.task}</p></div>
                  {page.substitutionDetails && page.substitutionDetails.parts > 1 && <p className="tv-label">Keterangan dan tugas · Bagian {page.substitutionDetails.part + 1} / {page.substitutionDetails.parts}</p>}
                </div>
              </article>;
            }
            const row = record as VisitorRecord;
            return <article key={row.id} className="tv-record" data-record-id={row.id}><div className="tv-row"><span className="tv-label tv-accent">Badge #{row.nomorBadge || '—'}</span><span className="tv-label">{row.jamMasuk} WIB</span></div><h3>{row.namaTamu}</h3><p className="tv-secondary">{row.instansiAsal || 'Keluarga / wali murid'}</p><div className="tv-replacement"><p className="tv-label">Pihak yang dituju</p><p className="tv-secondary tv-strong">{row.tujuanBertemu || '—'}</p></div></article>;
          }) : <div className="tv-empty">{currentPanelId === 'duty_teachers' ? 'Belum ada jadwal piket yang tercatat hari ini.' : currentPanelId === 'substitutions' ? 'Belum ada penugasan inval yang tercatat hari ini.' : 'Tidak ada kunjungan yang sedang berlangsung.'}</div>}
        </div>}
        {currentPanelId === 'discipline' && <div className="tv-grid tv-statistics" style={page.tileIndex !== undefined ? { gridTemplateColumns: '1fr' } : undefined}>
          {[{ label: 'Siswa terlambat', value: todayTardy.length, detail: 'Tercatat hari ini' }, { label: 'Izin siswa di luar', value: activePermits.length, detail: 'Izin masih berlangsung' }, { label: 'Penugasan piket', value: todaySchedules.length, detail: 'Terjadwal hari ini' }].filter((_, index) => page.tileIndex === undefined || page.tileIndex === index).map(row => <article className="tv-record tv-stat" key={row.label}><h3>{row.label}</h3><strong className="tv-metric">{row.value}</strong><p className="tv-secondary">{row.detail}</p></article>)}
        </div>}
        {currentPanelId === 'announcements' && (page.message ? <article className="tv-record tv-announcement" data-announcement-id={page.message.record.id}>
          <div className="tv-row"><span className="tv-label tv-accent">{page.message.record.priority || 'INFO'}{page.message.parts > 1 ? ` · Bagian ${page.message.part + 1} / ${page.message.parts}` : ''}</span><span className="tv-label">{page.message.record.date}</span></div>
          <h3 style={page.message.record.title.length > 120 ? { fontSize: 'var(--tv-body)' } : undefined}>{page.message.record.title}</h3><p className="tv-announcement-copy">{page.message.content}</p><p className="tv-label">{page.message.record.authorName}{page.message.part < page.message.parts - 1 ? ' · Pesan berlanjut pada layar berikutnya' : ''}</p>
        </article> : <div className="tv-empty">Belum ada pengumuman aktif.</div>)}
        {currentPanelId === 'school_identity' && <div className="tv-grid tv-identity" style={page.tileIndex !== undefined ? { gridTemplateColumns: '1fr' } : undefined}>
          {(page.tileIndex === undefined || page.tileIndex === 0) && <article className="tv-record"><p className="tv-label tv-accent">Identitas sekolah</p><h3>{settings.schoolName}</h3><p className="tv-secondary">{settings.address || 'Alamat belum diisi'}</p><p className="tv-secondary">NPSN: {settings.npsn || '—'}</p></article>}
          {(page.tileIndex === undefined || page.tileIndex === 1) && <article className="tv-record"><p className="tv-label tv-accent">Kepala sekolah</p><h3>{settings.principalName || 'Belum diisi'}</h3><div className="tv-replacement"><p className="tv-label">Koordinator piket</p><h3>{settings.coordinatorName || 'Belum diisi'}</h3></div></article>}
          {(page.tileIndex === undefined || page.tileIndex === 2) && <article className="tv-record"><p className="tv-label tv-accent">Tahun pelajaran & kontak</p><h3>{settings.academicSemester?.academicYear || 'Belum diisi'}</h3><p className="tv-secondary">{settings.phone || 'Telepon belum diisi'}</p><p className="tv-secondary">{settings.email || 'Email belum diisi'}</p></article>}
        </div>}
        {currentPanelId !== 'substitutions' && <p className="tv-page-caption">{isPaused ? 'Rotasi dijeda' : `Berganti otomatis setiap ${config.slideIntervalSec} detik`}{page.count > 1 ? ` · Semua data ditampilkan bergiliran dalam ${page.count} halaman` : ''}</p>}
      </section>
    </main>
    {tickerPages.length > 0 && <aside className="tv-ticker" aria-label="Teks informasi sekolah"><span className="tv-ticker-label"><Megaphone />Informasi</span><div className="tv-ticker-window">
      {config.tickerEnabled && !prefersReducedMotion && config.tickerMode === 'marquee' ? <div className="tv-marquee" style={{ animationDuration: `${Math.max(24, config.tickerMessages.join(' ').length / ({ slow: 6, normal: 10, fast: 16 }[config.tickerSpeed]))}s` }}><span>{config.tickerMessages.join(' • ')}</span><span aria-hidden="true">{config.tickerMessages.join(' • ')}</span></div>
        : <p className="tv-ticker-static">{tickerPages[(config.tickerEnabled ? staticTickerIndex : 0) % tickerPages.length]}</p>}
    </div></aside>}
    <footer className="tv-footer"><div className="tv-panel-tabs" aria-label="Pilihan panel TV">{activePanels.map(panel => <button key={panel} type="button" aria-current={panel === currentPanelId ? 'page' : undefined} onClick={() => setCurrentSlideIndex(pages.findIndex(item => item.panel === panel))}>{panelNames[panel]}</button>)}</div><span>Layar {Math.min(currentSlideIndex + 1, pages.length)} / {pages.length}</span></footer>
  </div>;
};
