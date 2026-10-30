export type TvTransitionType = 'none' | 'fade' | 'slide';
export type TvTickerSpeed = 'slow' | 'normal' | 'fast';
export type TvTickerFontSize = 'sm' | 'md' | 'lg';
export type TvDensityScale = 'compact' | 'standard' | 'large';
export type TvThemeOption = 'default' | 'sky' | 'mint' | 'lavender' | 'peach' | 'rose';
export type TvColorMode = 'dark' | 'light';

export type TvPanelId =
  | 'duty_teachers'     // Guru & Petugas Piket Hari Ini
  | 'substitutions'     // Guru Inval & Alokasi Pengganti
  | 'visitors'          // Buku Tamu & Kunjungan Resmi
  | 'discipline'        // Ringkasan Kedisiplinan & Ketertiban
  | 'announcements'     // Pengumuman & Agenda Penting
  | 'school_identity';  // Profil & Identitas Sekolah

export interface LobbyTvConfig {
  enabled: boolean;
  // Rotation & Animation
  transition: TvTransitionType;
  transitionDurationMs: number; // e.g. 500
  slideIntervalSec: number;      // e.g. 10
  enabledPanels: TvPanelId[];
  // Ticker (Teks Berjalan)
  tickerEnabled: boolean;
  tickerMessages: string[];
  tickerSpeed: TvTickerSpeed;
  tickerFontSize: TvTickerFontSize;
  tickerMode: 'marquee' | 'static';
  // Clock & Date
  showSeconds: boolean;
  timeFormat: '24h' | '12h';
  showDate: boolean;
  timezone: string; // e.g. 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'
  // Layout & Styling
  densityScale: TvDensityScale;
  theme: TvThemeOption;
  colorMode: TvColorMode;
  showSchoolIdentity: boolean;
  showConnectionStatus: boolean;
  allowSound: boolean;
  customSubtitle?: string;
  profileVideoUrl?: string;
  profileVideoEnabled?: boolean;
  profileVideoAutoplay?: boolean;
  profileVideoDurationSec?: number;
  /** Pinned player beside informational slides (mutually exclusive with the full video slide). */
  profileVideoPinned?: boolean;
  profileVideoPinSide?: 'left' | 'right';
  profileVideoPinSize?: 'small' | 'medium';
  profileVideoTitle?: string;
  profileVideoSubtitle?: string;
  schoolVision?: string;
  schoolMissions?: string[];
  schoolRules?: string[];
}

export const ALL_TV_PANELS: { id: TvPanelId; label: string; description: string }[] = [
  {
    id: 'duty_teachers',
    label: 'Guru & Petugas Piket Hari Ini',
    description: 'Daftar petugas piket aktif per pos, waktu shift, dan status siaga.',
  },
  {
    id: 'substitutions',
    label: 'Guru Inval & Alokasi Pengganti',
    description: 'Informasi guru berhalangan dan penugasan guru inval untuk kelas terdampak.',
  },
  {
    id: 'visitors',
    label: 'Buku Tamu & Kunjungan Resmi',
    description: 'Daftar tamu kedinasan atau orang tua yang sedang aktif berkunjung.',
  },
  {
    id: 'discipline',
    label: 'Ringkasan Kedisiplinan & Ketertiban',
    description: 'Statistik real-time siswa terlambat, izin gerbang, dan pos pengawasan.',
  },
  {
    id: 'announcements',
    label: 'Pengumuman & Agenda Sekolah',
    description: 'Pemberitahuan khusus, jadwal kegiatan, dan informasi penting kampus.',
  },
  {
    id: 'school_identity',
    label: 'Profil & Identitas Sekolah',
    description: 'Logo, visi misi, NPSN, akreditasi, pimpinan, dan kontak resmi sekolah.',
  },
];

export const DEFAULT_LOBBY_TV_CONFIG: LobbyTvConfig = {
  enabled: true,
  transition: 'slide',
  transitionDurationMs: 500,
  slideIntervalSec: 10,
  enabledPanels: [
    'duty_teachers',
    'substitutions',
    'visitors',
    'discipline',
    'announcements',
    'school_identity',
  ],
  tickerEnabled: true,
  tickerMessages: [
    'Selamat Datang di lingkungan sekolah kami. Harap seluruh tamu melapor dan mengenakan Visitor Badge di Pos Piket.',
    'Siswa yang meninggalkan area sekolah saat jam belajar wajib membawa Surat Izin Resmi dari Guru Piket.',
    'Mari bersama-sama menjaga ketertiban, kebersihan, dan keselamatan lingkungan belajar bersama.',
  ],
  tickerSpeed: 'normal',
  tickerFontSize: 'md',
  tickerMode: 'marquee',
  showSeconds: true,
  timeFormat: '24h',
  showDate: true,
  timezone: 'Asia/Jakarta',
  theme: 'default',
  colorMode: 'dark',
  densityScale: 'standard',
  showSchoolIdentity: true,
  showConnectionStatus: true,
  allowSound: false,
  customSubtitle: 'Pusat Informasi & Pemantauan Operasional Sekolah Terpadu',
  profileVideoUrl: '',
  profileVideoEnabled: true,
  profileVideoAutoplay: true,
  profileVideoDurationSec: 90,
  profileVideoPinned: false,
  profileVideoPinSide: 'right',
  profileVideoPinSize: 'small',
  profileVideoTitle: 'Video Profil Utama Sekolah',
  profileVideoSubtitle: 'Sematan video YouTube agar hemat penyimpanan server sekolah',
  schoolVision: 'Mewujudkan sekolah yang unggul dalam prestasi, berkarakter, dan adaptif terhadap perkembangan zaman.',
  schoolMissions: [
    'Menumbuhkan budaya disiplin, santun, dan bertanggung jawab.',
    'Meningkatkan mutu pembelajaran dan layanan pendidikan secara berkelanjutan.',
    'Mengembangkan literasi digital, kolaborasi, dan kepedulian warga sekolah.',
  ],
  schoolRules: [
    'Gunakan seragam lengkap dan atribut sesuai ketentuan sekolah.',
    'Datang tepat waktu dan mengikuti pembelajaran dengan tertib.',
    'Menjaga kebersihan, keamanan, dan kenyamanan lingkungan sekolah.',
    'Tamu wajib melapor ke petugas piket dan mengenakan badge pengunjung.',
  ],
};

/**
 * Strips HTML tags and entities to ensure plain text only, preventing HTML/script execution.
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}


function normalizeTextLines(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? stripHtml(entry) : ''))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Sanitizes and fills missing fields in older configurations with safe defaults.
 */
export function sanitizeLobbyTvConfig(raw?: Partial<LobbyTvConfig> | null): LobbyTvConfig {
  if (!raw) return { ...DEFAULT_LOBBY_TV_CONFIG };

  const validPanels: TvPanelId[] = [
    'duty_teachers',
    'substitutions',
    'visitors',
    'discipline',
    'announcements',
    'school_identity',
  ];

  const rawPanels = Array.isArray(raw.enabledPanels) ? raw.enabledPanels : [];
  const filteredPanels = rawPanels.filter((p): p is TvPanelId => validPanels.includes(p as TvPanelId));
  const enabledPanels = filteredPanels.length > 0 ? filteredPanels : DEFAULT_LOBBY_TV_CONFIG.enabledPanels;

  const rawMessages = Array.isArray(raw.tickerMessages) ? raw.tickerMessages : [];
  const cleanedMessages = rawMessages
    .map((m) => (typeof m === 'string' ? stripHtml(m) : ''))
    .filter((m) => m.length > 0);
  const cleanedMissions = normalizeTextLines(raw.schoolMissions, 8);
  const cleanedRules = normalizeTextLines(raw.schoolRules, 10);
  const profileVideoUrl = typeof raw.profileVideoUrl === 'string' ? stripHtml(raw.profileVideoUrl) : '';
  const profileVideoTitle = typeof raw.profileVideoTitle === 'string' ? stripHtml(raw.profileVideoTitle) : '';
  const profileVideoSubtitle = typeof raw.profileVideoSubtitle === 'string' ? stripHtml(raw.profileVideoSubtitle) : '';
  const schoolVision = typeof raw.schoolVision === 'string' ? stripHtml(raw.schoolVision) : '';

  return {
    enabled: raw.enabled !== false,
    transition: raw.transition === 'none' || raw.transition === 'fade' || raw.transition === 'slide'
      ? raw.transition
      : DEFAULT_LOBBY_TV_CONFIG.transition,
    transitionDurationMs: Number.isFinite(raw.transitionDurationMs) && raw.transitionDurationMs! >= 0
      ? Math.max(100, Math.min(2000, Number(raw.transitionDurationMs)))
      : DEFAULT_LOBBY_TV_CONFIG.transitionDurationMs,
    slideIntervalSec: Number.isFinite(raw.slideIntervalSec) && raw.slideIntervalSec! >= 3
      ? Math.max(3, Math.min(120, Number(raw.slideIntervalSec)))
      : DEFAULT_LOBBY_TV_CONFIG.slideIntervalSec,
    enabledPanels,
    tickerEnabled: raw.tickerEnabled !== false,
    tickerMessages: Array.isArray(raw.tickerMessages) ? cleanedMessages : [...DEFAULT_LOBBY_TV_CONFIG.tickerMessages],
    tickerSpeed: raw.tickerSpeed === 'slow' || raw.tickerSpeed === 'fast' ? raw.tickerSpeed : 'normal',
    tickerFontSize: raw.tickerFontSize === 'sm' || raw.tickerFontSize === 'lg' ? raw.tickerFontSize : 'md',
    tickerMode: raw.tickerMode === 'static' ? 'static' : 'marquee',
    showSeconds: raw.showSeconds !== false,
    timeFormat: raw.timeFormat === '12h' ? '12h' : '24h',
    showDate: raw.showDate !== false,
    timezone: raw.timezone && ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(raw.timezone)
      ? raw.timezone
      : 'Asia/Jakarta',
    densityScale: raw.densityScale === 'compact' || raw.densityScale === 'large' ? raw.densityScale : 'standard',
    theme: raw.theme && ['default', 'sky', 'mint', 'lavender', 'peach', 'rose'].includes(raw.theme)
      ? raw.theme
      : 'default',
    colorMode: raw.colorMode === 'light' ? 'light' : 'dark',
    showSchoolIdentity: raw.showSchoolIdentity !== false,
    showConnectionStatus: raw.showConnectionStatus !== false,
    allowSound: Boolean(raw.allowSound),
    customSubtitle: raw.customSubtitle ? stripHtml(raw.customSubtitle) : DEFAULT_LOBBY_TV_CONFIG.customSubtitle,
    profileVideoUrl: profileVideoUrl || DEFAULT_LOBBY_TV_CONFIG.profileVideoUrl,
    profileVideoEnabled: raw.profileVideoEnabled !== false,
    profileVideoPinned: raw.profileVideoPinned === true,
    profileVideoPinSide: raw.profileVideoPinSide === 'left' ? 'left' : 'right',
    profileVideoPinSize: raw.profileVideoPinSize === 'medium' ? 'medium' : 'small',
    profileVideoAutoplay: raw.profileVideoAutoplay !== false,
    profileVideoDurationSec: typeof raw.profileVideoDurationSec === 'number' && Number.isFinite(raw.profileVideoDurationSec)
      ? Math.max(15, Math.min(600, Math.round(raw.profileVideoDurationSec)))
      : 90,
    profileVideoTitle: profileVideoTitle || DEFAULT_LOBBY_TV_CONFIG.profileVideoTitle,
    profileVideoSubtitle: profileVideoSubtitle || DEFAULT_LOBBY_TV_CONFIG.profileVideoSubtitle,
    schoolVision: schoolVision || DEFAULT_LOBBY_TV_CONFIG.schoolVision,
    schoolMissions: cleanedMissions.length ? cleanedMissions : [...(DEFAULT_LOBBY_TV_CONFIG.schoolMissions || [])],
    schoolRules: cleanedRules.length ? cleanedRules : [...(DEFAULT_LOBBY_TV_CONFIG.schoolRules || [])],
  };
}

/**
 * Compares two LobbyTvConfig objects for deep structural and value equality.
 * Sanitizes both objects first to guarantee comparison consistency.
 * Preserves panel order and ticker messages order as semantic differences.
 */
export function areLobbyTvConfigsEqual(
  a?: Partial<LobbyTvConfig> | null,
  b?: Partial<LobbyTvConfig> | null
): boolean {
  const cleanA = sanitizeLobbyTvConfig(a);
  const cleanB = sanitizeLobbyTvConfig(b);

  if (cleanA.enabled !== cleanB.enabled) return false;
  if (cleanA.transition !== cleanB.transition) return false;
  if (cleanA.transitionDurationMs !== cleanB.transitionDurationMs) return false;
  if (cleanA.slideIntervalSec !== cleanB.slideIntervalSec) return false;
  if (cleanA.tickerEnabled !== cleanB.tickerEnabled) return false;
  if (cleanA.tickerSpeed !== cleanB.tickerSpeed) return false;
  if (cleanA.tickerFontSize !== cleanB.tickerFontSize) return false;
  if (cleanA.tickerMode !== cleanB.tickerMode) return false;
  if (cleanA.showSeconds !== cleanB.showSeconds) return false;
  if (cleanA.timeFormat !== cleanB.timeFormat) return false;
  if (cleanA.showDate !== cleanB.showDate) return false;
  if (cleanA.timezone !== cleanB.timezone) return false;
  if (cleanA.densityScale !== cleanB.densityScale) return false;
  if (cleanA.theme !== cleanB.theme) return false;
  if (cleanA.colorMode !== cleanB.colorMode) return false;
  if (cleanA.showSchoolIdentity !== cleanB.showSchoolIdentity) return false;
  if (cleanA.showConnectionStatus !== cleanB.showConnectionStatus) return false;
  if (cleanA.allowSound !== cleanB.allowSound) return false;
  if ((cleanA.customSubtitle || '') !== (cleanB.customSubtitle || '')) return false;
  if ((cleanA.profileVideoUrl || '') !== (cleanB.profileVideoUrl || '')) return false;
  if (cleanA.profileVideoEnabled !== cleanB.profileVideoEnabled) return false;
  if (cleanA.profileVideoPinned !== cleanB.profileVideoPinned) return false;
  if (cleanA.profileVideoPinSide !== cleanB.profileVideoPinSide) return false;
  if (cleanA.profileVideoPinSize !== cleanB.profileVideoPinSize) return false;
  if (cleanA.profileVideoAutoplay !== cleanB.profileVideoAutoplay) return false;
  if (cleanA.profileVideoDurationSec !== cleanB.profileVideoDurationSec) return false;
  if ((cleanA.profileVideoTitle || '') !== (cleanB.profileVideoTitle || '')) return false;
  if ((cleanA.profileVideoSubtitle || '') !== (cleanB.profileVideoSubtitle || '')) return false;
  if ((cleanA.schoolVision || '') !== (cleanB.schoolVision || '')) return false;

  if ((cleanA.schoolMissions || []).length !== (cleanB.schoolMissions || []).length) return false;
  for (let i = 0; i < (cleanA.schoolMissions || []).length; i++) {
    if (cleanA.schoolMissions?.[i] !== cleanB.schoolMissions?.[i]) return false;
  }

  if ((cleanA.schoolRules || []).length !== (cleanB.schoolRules || []).length) return false;
  for (let i = 0; i < (cleanA.schoolRules || []).length; i++) {
    if (cleanA.schoolRules?.[i] !== cleanB.schoolRules?.[i]) return false;
  }

  // Compare enabledPanels respecting array length and exact order
  if (cleanA.enabledPanels.length !== cleanB.enabledPanels.length) return false;
  for (let i = 0; i < cleanA.enabledPanels.length; i++) {
    if (cleanA.enabledPanels[i] !== cleanB.enabledPanels[i]) return false;
  }

  // Compare tickerMessages respecting array length and exact order
  if (cleanA.tickerMessages.length !== cleanB.tickerMessages.length) return false;
  for (let i = 0; i < cleanA.tickerMessages.length; i++) {
    if (cleanA.tickerMessages[i] !== cleanB.tickerMessages[i]) return false;
  }

  return true;
}

