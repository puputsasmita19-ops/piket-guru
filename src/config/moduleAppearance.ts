import type { CSSProperties } from 'react';
import type { NavigationTab } from '../types';

// All modules follow the selected app palette. SVG icons are neutral in CSS.
// Keep module IDs/labels stable so navigation, permissions and print keep working.
export const MODULE_APPEARANCE = {
  dashboard: { label: 'Beranda', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  'command-center': { label: 'Pusat Komando', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  kiosk: { label: 'TV Lobi', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  schedules: { label: 'Jadwal Piket', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  'attendance-monitor': { label: 'Monitoring Piket', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  attendance: { label: 'Presensi GPS', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  'duty-book': { label: 'Buku Piket', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  incidents: { label: 'Laporan Kejadian', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  'student-tardiness': { label: 'Siswa Terlambat', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  substitutions: { label: 'Guru Pengganti', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  'student-permits': { label: 'Izin Siswa', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  visitors: { label: 'Buku Tamu', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  reports: { label: 'Laporan & Rekap', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  users: { label: 'Master Pengguna', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
  settings: { label: 'Pengaturan', colorName: 'Tema aplikasi', accent: 'var(--theme-primary)', darkInk: 'var(--theme-primary-text)' },
} as const satisfies Record<NavigationTab, { label: string; colorName: string; accent: string; darkInk: string }>;

export function getModuleStyle(module: NavigationTab | undefined): CSSProperties | undefined {
  if (!module) return undefined;
  const colors = MODULE_APPEARANCE[module];
  return { '--module-accent': colors.accent, '--module-dark-ink': colors.darkInk } as CSSProperties;
}
