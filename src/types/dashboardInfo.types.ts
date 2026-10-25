import { sanitizeDashboardWelcomeConfig, type DashboardWelcomeConfig } from './dashboardWelcome.types';

export const DASHBOARD_INFO_PANELS = {
  announcements: 'Papan Pengumuman & Instruksi Piket',
  dutyRoster: 'Daftar Guru Bertugas Hari Ini',
  dutyRosterTomorrow: 'Daftar Guru Bertugas Besok',
  substitutions: 'Guru Berhalangan & Tugas Inval',
  incidents: 'Laporan Insiden & Kejadian Terbaru',
  operations: 'Ringkasan Kegiatan Hari Ini',
} as const;
export type DashboardInfoPanel = keyof typeof DASHBOARD_INFO_PANELS;
export interface NameMarqueeConfig { enabled: boolean; durationSeconds: number; }
export function sanitizeNameMarqueeConfig(value?: Partial<NameMarqueeConfig> | null): NameMarqueeConfig {
  // Existing school documents do not have nameMarquee yet. R76 previously
  // dereferenced `value.durationSeconds` even when value was undefined/null,
  // crashing Dashboard and possibly public login/user summary rendering.
  const requestedDuration = value?.durationSeconds;
  const durationSeconds = typeof requestedDuration === 'number'
    && [8, 12, 16, 20, 28].includes(requestedDuration)
    ? requestedDuration
    : 16;
  return {
    enabled: value?.enabled !== false,
    durationSeconds,
  };
}
export interface DashboardInfoConfig {
  enabled: boolean;
  autoPlay: boolean;
  intervalMs: number;
  panels: Record<DashboardInfoPanel, boolean>;
  welcome?: DashboardWelcomeConfig;
  nameMarquee?: NameMarqueeConfig;
}
export const DASHBOARD_INFO_INTERVALS = [2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000, 20000, 30000, 45000, 60000];
export function sanitizeDashboardInfoConfig(value?: Partial<DashboardInfoConfig> | null): DashboardInfoConfig & { welcome: DashboardWelcomeConfig } {
  const v = value && typeof value === 'object' ? value : {};
  return {
    enabled: v.enabled !== false,
    autoPlay: v.autoPlay !== false,
    intervalMs: DASHBOARD_INFO_INTERVALS.includes(v.intervalMs!) ? v.intervalMs! : 3000,
    panels: Object.fromEntries(Object.keys(DASHBOARD_INFO_PANELS).map(key => [key,
      key === 'dutyRosterTomorrow' && v.panels?.dutyRosterTomorrow === undefined
        ? v.panels?.dutyRoster !== false
        : v.panels?.[key as DashboardInfoPanel] !== false,
    ])) as Record<DashboardInfoPanel, boolean>,
    welcome: sanitizeDashboardWelcomeConfig(v.welcome),
    nameMarquee: sanitizeNameMarqueeConfig(v.nameMarquee),
  };
}
