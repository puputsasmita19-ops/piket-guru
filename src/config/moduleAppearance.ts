import type { CSSProperties } from 'react';
import type { NavigationTab } from '../types';

// Module identity is separate from the school's chosen overall theme.
// Every solid accent supports white action text; dark-mode ink is lighter.
export const MODULE_APPEARANCE = {
  dashboard: { label: 'Beranda', colorName: 'Indigo', accent: '#4f46e5', darkInk: '#c7d2fe' },
  'command-center': { label: 'Pusat Komando', colorName: 'Sian', accent: '#0e7490', darkInk: '#67e8f9' },
  kiosk: { label: 'TV Lobi', colorName: 'Fuchsia', accent: '#a21caf', darkInk: '#f0abfc' },
  schedules: { label: 'Jadwal Piket', colorName: 'Violet', accent: '#6d28d9', darkInk: '#c4b5fd' },
  attendance: { label: 'Presensi GPS', colorName: 'Hijau', accent: '#047857', darkInk: '#6ee7b7' },
  'duty-book': { label: 'Buku Piket', colorName: 'Biru', accent: '#1d4ed8', darkInk: '#93c5fd' },
  incidents: { label: 'Laporan Kejadian', colorName: 'Merah mawar', accent: '#be123c', darkInk: '#fda4af' },
  'student-tardiness': { label: 'Siswa Terlambat', colorName: 'Amber', accent: '#92400e', darkInk: '#fcd34d' },
  substitutions: { label: 'Guru Pengganti', colorName: 'Ungu', accent: '#7e22ce', darkInk: '#d8b4fe' },
  'student-permits': { label: 'Izin Siswa', colorName: 'Biru langit', accent: '#0369a1', darkInk: '#7dd3fc' },
  visitors: { label: 'Buku Tamu', colorName: 'Teal', accent: '#0f766e', darkInk: '#5eead4' },
  reports: { label: 'Laporan & Rekap', colorName: 'Jingga', accent: '#c2410c', darkInk: '#fdba74' },
  users: { label: 'Master Pengguna', colorName: 'Merah muda', accent: '#be185d', darkInk: '#f9a8d4' },
  settings: { label: 'Pengaturan', colorName: 'Batu tulis', accent: '#475569', darkInk: '#cbd5e1' },
} as const satisfies Record<NavigationTab, { label: string; colorName: string; accent: string; darkInk: string }>;

export function getModuleStyle(module: NavigationTab | undefined): CSSProperties | undefined {
  if (!module) return undefined;
  const colors = MODULE_APPEARANCE[module];
  return { '--module-accent': colors.accent, '--module-dark-ink': colors.darkInk } as CSSProperties;
}
