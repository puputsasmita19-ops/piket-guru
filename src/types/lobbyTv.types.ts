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
    tickerMessages: cleanedMessages.length > 0 ? cleanedMessages : DEFAULT_LOBBY_TV_CONFIG.tickerMessages,
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
  };
}
