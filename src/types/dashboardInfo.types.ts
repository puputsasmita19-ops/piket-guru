export const DASHBOARD_INFO_PANELS = {
  announcements: 'Papan Pengumuman & Instruksi Piket',
  dutyRoster: 'Daftar Guru Bertugas Hari Ini',
  incidents: 'Laporan Insiden & Kejadian Terbaru',
  operations: 'Ringkasan Kegiatan Hari Ini',
} as const;
export type DashboardInfoPanel = keyof typeof DASHBOARD_INFO_PANELS;
export interface DashboardInfoConfig {
  enabled: boolean;
  autoPlay: boolean;
  intervalMs: number;
  panels: Record<DashboardInfoPanel, boolean>;
}
export const DASHBOARD_INFO_INTERVALS = [2000, 2500, 3000, 5000, 8000];
export function sanitizeDashboardInfoConfig(value?: Partial<DashboardInfoConfig> | null): DashboardInfoConfig {
  const v = value && typeof value === 'object' ? value : {};
  return {
    enabled: v.enabled !== false,
    autoPlay: v.autoPlay !== false,
    intervalMs: DASHBOARD_INFO_INTERVALS.includes(v.intervalMs!) ? v.intervalMs! : 3000,
    panels: Object.fromEntries(Object.keys(DASHBOARD_INFO_PANELS).map(key => [key, v.panels?.[key as DashboardInfoPanel] !== false])) as Record<DashboardInfoPanel, boolean>,
  };
}
