import type { CSSProperties } from 'react';
import type { NavigationTab } from '../types';

// Module identity is separate from the school's chosen overall theme.
// Muted accents keep module identity calm; solid actions retain white-text contrast.
export const MODULE_APPEARANCE = {
  dashboard: { label: 'Beranda', colorName: 'Indigo', accent: '#4d4ac6', darkInk: '#c8d3f7' },
  'command-center': { label: 'Pusat Komando', colorName: 'Sian', accent: '#1c6c86', darkInk: '#80e3f3' },
  kiosk: { label: 'TV Lobi', colorName: 'Fuchsia', accent: '#8b2a9e', darkInk: '#e7b6f5' },
  schedules: { label: 'Jadwal Piket', colorName: 'Violet', accent: '#6433bd', darkInk: '#c6bdf6' },
  attendance: { label: 'Presensi GPS', colorName: 'Hijau', accent: '#156f5c', darkInk: '#85e2c2' },
  'duty-book': { label: 'Buku Piket', colorName: 'Biru', accent: '#2850bc', darkInk: '#a1c9f6' },
  incidents: { label: 'Laporan Kejadian', colorName: 'Merah mawar', accent: '#a02347', darkInk: '#f0b0bc' },
  'student-tardiness': { label: 'Siswa Terlambat', colorName: 'Amber', accent: '#7f4525', darkInk: '#f0d472' },
  substitutions: { label: 'Guru Pengganti', colorName: 'Ungu', accent: '#702fb5', darkInk: '#d5bcf7' },
  'student-permits': { label: 'Izin Siswa', colorName: 'Biru langit', accent: '#146493', darkInk: '#90d4f5' },
  visitors: { label: 'Buku Tamu', colorName: 'Teal', accent: '#1d6e6d', darkInk: '#79e5d7' },
  reports: { label: 'Laporan & Rekap', colorName: 'Jingga', accent: '#a34623', darkInk: '#f0c18f' },
  users: { label: 'Master Pengguna', colorName: 'Merah muda', accent: '#a02760', darkInk: '#eeb3d7' },
  settings: { label: 'Pengaturan', colorName: 'Batu tulis', accent: '#475569', darkInk: '#cbd5e1' },
} as const satisfies Record<NavigationTab, { label: string; colorName: string; accent: string; darkInk: string }>;

export function getModuleStyle(module: NavigationTab | undefined): CSSProperties | undefined {
  if (!module) return undefined;
  const colors = MODULE_APPEARANCE[module];
  return { '--module-accent': colors.accent, '--module-dark-ink': colors.darkInk } as CSSProperties;
}
