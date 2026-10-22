import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  MapPin,
  Users,
  CalendarDays,
  FileBarChart2,
  BookOpenCheck,
  Camera,
  Clock,
  Navigation,
  Compass,
  Info,
} from '../icons';
import { useGuide } from '../../contexts/GuideContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { NavigationTab } from '../../types';
import { Button } from '../common/Button';
import { PERMISSIONS, PermissionKey } from '../../config/permissions';

export interface TourStep {
  id: string;
  targetTab: NavigationTab;
  selectors: string[];
  title: string;
  location: string;
  action: string;
  expectedResult: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: PermissionKey;
}

export const ADMIN_STEPS: TourStep[] = [
  {
    id: 'admin-nav',
    targetTab: 'dashboard',
    selectors: ['[data-tour="sidebar-nav"]', '[data-tour="mobile-nav"]', 'aside'],
    title: 'Navigasi Utama',
    location: 'Panel menu di samping kiri pada komputer',
    action: 'Buka menu navigasi untuk mengakses modul operasional, pengelola pengguna, dan laporan.',
    expectedResult: 'Menampilkan seluruh daftar menu operasional, manajemen, dan pengaturan.',
    icon: Navigation,
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: 'admin-location',
    targetTab: 'settings',
    selectors: [
      '[data-tour="settings-location-card"]',
      '[data-tour="settings-save-location"]',
      '#settings-location-section',
    ],
    title: 'Lokasi Presensi & Radius GPS',
    location: 'Menu Pengaturan > Titik Lokasi GPS',
    action: 'Atur latitude, longitude, dan radius sekolah, lalu klik "Simpan & Kunci Lokasi".',
    expectedResult: 'Titik koordinat resmi tersimpan di server sebagai acuan tunggal presensi guru.',
    icon: MapPin,
    requiredPermission: PERMISSIONS.SETTINGS_VIEW,
  },
  {
    id: 'admin-users',
    targetTab: 'users',
    selectors: ['[data-tour="users-table"]', '[data-tour="users-container"]'],
    title: 'Manajemen Pengguna & Akses',
    location: 'Menu Master Pengguna',
    action: 'Kelola akun guru, penugasan peran (role), dan reset PIN operasional.',
    expectedResult: 'Akun guru terdaftar dan siap digunakan untuk login serta presensi piket.',
    icon: Users,
    requiredPermission: PERMISSIONS.USERS_VIEW,
  },
  {
    id: 'admin-schedules',
    targetTab: 'schedules',
    selectors: ['[data-tour="schedules-container"]'],
    title: 'Pengaturan Jadwal Piket',
    location: 'Menu Jadwal Piket',
    action: 'Atur pembagian jadwal bertugas, jam kerja, dan toleransi keterlambatan.',
    expectedResult: 'Jadwal piket harian otomatis muncul pada halaman dasbor guru bersangkutan.',
    icon: CalendarDays,
    requiredPermission: PERMISSIONS.SCHEDULE_VIEW,
  },
  {
    id: 'admin-reports',
    targetTab: 'reports',
    selectors: ['[data-tour="reports-container"]'],
    title: 'Rekap & Laporan Resmi',
    location: 'Menu Laporan & Rekap',
    action: 'Pilih rentang tanggal presensi lalu unduh atau cetak rekapitulasi.',
    expectedResult: 'Dokumen rekapitulasi kehadiran piket siap dicetak atau diunduh.',
    icon: FileBarChart2,
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
  },
];

export const GURU_STEPS: TourStep[] = [
  {
    id: 'guru-attendance',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="attendance-tabs"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Presensi Masuk',
    location: 'Menu Presensi GPS',
    action: 'Pilih Formulir Presensi. Siapkan izin lokasi dan kamera pada HP Anda. Ikuti langkah lokasi, foto, lalu kirim.',
    expectedResult: 'Pastikan muncul status presensi berhasil.',
    icon: BookOpenCheck,
    requiredPermission: PERMISSIONS.ATTENDANCE_VIEW,
  },
  {
    id: 'guru-gps',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="gps-status"]',
      '[data-tour="refresh-gps-button"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Pembaruan & Status GPS',
    location: 'Seksi Status Lokasi GPS',
    action: 'Ketuk tombol "Perbarui Lokasi GPS" untuk memverifikasi koordinat posisi Anda.',
    expectedResult: 'Status lokasi menampilkan jarak posisi Anda terhadap radius resmi sekolah.',
    icon: MapPin,
    requiredPermission: PERMISSIONS.ATTENDANCE_VIEW,
  },
  {
    id: 'guru-selfie',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="camera-section"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Kamera Swafoto',
    location: 'Seksi Swafoto Kehadiran',
    action: 'Ambil foto selfie secara langsung sebagai bukti kehadiran visual.',
    expectedResult: 'Foto selfie tersimpan dengan tanggal, jam, dan lokasi pengambilan foto.',
    icon: Camera,
    requiredPermission: PERMISSIONS.ATTENDANCE_CREATE,
  },
  {
    id: 'guru-submit',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="attendance-actions"]',
      '[data-tour="checkin-button"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Kirim Presensi',
    location: 'Tombol Presensi Masuk / Pulang',
    action: 'Sesudah lokasi dan foto siap, ketuk Presensi Masuk. Saat selesai bertugas, gunakan Presensi Pulang.',
    expectedResult: 'Periksa pesan berhasil dan riwayat presensi; jangan menekan tombol berulang kali.',
    icon: Clock,
    requiredPermission: PERMISSIONS.ATTENDANCE_CREATE,
  },
  {
    id: 'guru-dutybook',
    targetTab: 'duty-book',
    selectors: [
      '[data-tour="duty-book-container"]',
      '[data-tour="my-history-section"]',
    ],
    title: 'Buku Piket & Status Data',
    location: 'Menu Buku Piket Digital',
    action: 'Buka Buku Piket untuk mencatat jurnal harian dan memeriksa data lokal yang belum terkirim.',
    expectedResult: 'Jurnal piket tersimpan dan data tersinkronisasi ke server.',
    icon: BookOpenCheck,
    requiredPermission: PERMISSIONS.DUTYBOOK_VIEW,
  },
];

const TOUR_PERMISSIONS = [...new Set([...ADMIN_STEPS, ...GURU_STEPS].map(step => step.requiredPermission).filter((value): value is PermissionKey => Boolean(value)))];

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const InteractiveGuideTour: React.FC = () => {
  const { isGuideTourActive, stopGuideTour } = useGuide();
  const { hasRole, hasPermission } = useAuth();
  const { activeTab, setActiveTab } = useNavigation();
  const navigateRef = useRef(setActiveTab);
  navigateRef.current = setActiveTab;
  // Permission functions are recreated by AuthContext on render. Derive stable primitive
  // dependencies so opening a step never tears down/restarts all DOM measurements.
  const adminTour = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const permissionSignature = TOUR_PERMISSIONS.filter(permission => hasPermission(permission)).join('|');
  const steps = useMemo(() => [...(adminTour ? ADMIN_STEPS : GURU_STEPS), {
    id: 'sync-status', targetTab: 'dashboard' as NavigationTab, selectors: ['[data-tour="sync-status"]'], title: 'Saat internet terputus',
    location: 'Ikon koneksi di header atas', action: 'Simpan formulir. Periksa antrean pada ikon koneksi; biarkan aplikasi terbuka saat internet kembali.',
    expectedResult: 'Antrean terkirim otomatis. Draf belum dikirim tetap perlu dibuka dan dikirim sendiri.', icon: Info, requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  }].filter(step => !step.requiredPermission || permissionSignature.split('|').includes(step.requiredPermission)), [adminTour, permissionSignature]);
  const [index, setIndex] = useState(0), [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [dock, setDock] = useState<'top' | 'bottom'>('bottom');
  const [size, setSize] = useState({ width: window.innerWidth, height: window.visualViewport?.height || window.innerHeight, card: 270 });
  const cardRef = useRef<HTMLDivElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const close = useCallback(() => { stopGuideTour(); setTargetRect(null); requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true })); }, [stopGuideTour]);
  useEffect(() => { if (isGuideTourActive) { setIndex(0); previousFocus.current = document.activeElement as HTMLElement; requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true })); } }, [isGuideTourActive]);
  useEffect(() => {
    if (!isGuideTourActive || !step) return;
    if (activeTab !== step.targetTab) navigateRef.current(step.targetTab);

    let frame = 0;
    let polling: ReturnType<typeof setInterval> | null = null;
    let scrolled = false;
    let foundTarget = false;
    let lastRect = '';
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.visualViewport?.height || window.innerHeight;
        const card = cardRef.current?.offsetHeight || 270;
        setSize(prev => prev.width === width && prev.height === height && prev.card === card ? prev : { width, height, card });
        const selectors = step.id === 'admin-nav' && width < 1024 ? ['[data-tour="mobile-nav"]'] : step.selectors;
        const target = selectors.map(selector => document.querySelector<HTMLElement>(selector)).find(el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().right > 0 && el.getBoundingClientRect().left < width);
        if (!target) {
          foundTarget = false;
          if (lastRect !== 'null') { lastRect = 'null'; setTargetRect(null); }
          return;
        }
        foundTarget = true;
        // On mobile, smooth scrolling moved the floating card during taps and
        // made users press Lanjut repeatedly. Keep the guide anchored instead.
        if (!scrolled && width >= 768) {
          scrolled = true;
          const rect = target.getBoundingClientRect();
          if (rect.top < 70 || rect.bottom > height - 90) target.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
        const fixedControl = !!target.closest('header, [data-tour="mobile-nav"]');
        const r = target.getBoundingClientRect();
        const nextDock = r.top > height / 2 ? 'top' : 'bottom';
        if (width >= 768) setDock(nextDock);
        const effectiveDock = width < 768 ? 'bottom' : nextDock;
        const cardTop = effectiveDock === 'top' ? 76 : Math.max(76, height - card - 84);
        const top = Math.max(fixedControl ? 8 : 68, r.top, effectiveDock === 'top' ? cardTop + card + 14 : 0);
        const bottom = Math.min(height - (fixedControl ? 8 : 76), r.bottom, effectiveDock === 'bottom' ? cardTop - 14 : height);
        const rect = bottom > top ? { top, left: Math.max(8, r.left), width: Math.min(width - 16, r.width), height: bottom - top } : null;
        const signature = JSON.stringify(rect);
        if (signature !== lastRect) { lastRect = signature; setTargetRect(rect); }
      });
    };

    const resize = new ResizeObserver(measure);
    if (cardRef.current) resize.observe(cardRef.current);
    // Only poll briefly while the target tab/lazy component is mounting. Do NOT
    // observe the entire React root: doing so causes repeated reflows/renders.
    let attempts = 0;
    polling = setInterval(() => {
      attempts += 1;
      if (foundTarget || attempts >= 25) {
        if (polling) clearInterval(polling);
        polling = null;
      } else measure();
    }, 240);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      if (polling) clearInterval(polling);
      resize.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isGuideTourActive, step, activeTab]);
  useEffect(() => {
    if (!isGuideTourActive) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab') return;
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []), first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !cardRef.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [isGuideTourActive, close]);
  if (!isGuideTourActive || !step) return null;
  const mobile = size.width < 768, width = Math.min(360, size.width - 24), maxTop = Math.max(76, size.height - size.card - 84);
  const top = mobile ? maxTop : dock === 'top' ? 76 : maxTop;
  const left = mobile ? (size.width - width) / 2 : Math.max(12, Math.min(targetRect?.left || (size.width - width) / 2, size.width - width - 12));
  return <div className="guide-layer print:hidden">
    <div className="guide-blocker" aria-hidden="true"/>
    {targetRect && <div data-guide-spotlight className="guide-spotlight" style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8 }}/ >}
    <section ref={cardRef} role="dialog" aria-modal="true" aria-label="Panduan Interaktif Penggunaan Aplikasi" aria-describedby="guide-action" tabIndex={-1} className="guide-card" style={{ width, left, top: Math.min(top, maxTop), maxHeight: Math.max(180, size.height - 150) }}>
      <div className="guide-heading"><span className="guide-progress">Langkah {index + 1} dari {steps.length}</span><button type="button" onClick={close} aria-label="Tutup Panduan Interaktif"><X className="w-4 h-4"/></button></div>
      <h2>{step.title}</h2><p className="guide-location">{step.id === 'admin-nav' && mobile ? 'Menu di bagian bawah layar; ketuk Lainnya untuk menu lengkap.' : step.location}</p>
      <p id="guide-action">{step.action}</p><p className="guide-result"><Check className="w-4 h-4 shrink-0"/>{step.expectedResult}</p>
      {!targetRect && <p className="guide-location">Cari bagian ini di menu {step.targetTab === 'dashboard' ? 'Beranda' : step.location}. Anda tetap dapat melanjutkan panduan.</p>}
      <footer><button type="button" onClick={close}>Tutup dulu</button><div><Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Kembali</Button><Button type="button" size="sm" onClick={() => index === steps.length - 1 ? close() : setIndex(i => i + 1)}>{index === steps.length - 1 ? 'Selesai' : 'Lanjut'}</Button></div></footer>
    </section>
  </div>;
};
