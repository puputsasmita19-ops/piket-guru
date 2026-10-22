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
import { clipGuideFocus, getGuideAreas, needsGuideScroll } from './guidePositioning';
import type { GuideRect } from './guidePositioning';

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
      '[data-tour="refresh-gps-button"]',
      '[data-tour="gps-status"]',
    ],
    title: 'Pembaruan & Status GPS',
    location: 'Seksi Status Lokasi GPS',
    action: 'Perhatikan tombol Perbarui GPS yang disorot. Setelah panduan ditutup, ketuk tombol itu untuk memperbarui posisi Anda.',
    expectedResult: 'Status lokasi menampilkan jarak posisi Anda terhadap radius resmi sekolah.',
    icon: MapPin,
    requiredPermission: PERMISSIONS.ATTENDANCE_VIEW,
  },
  {
    id: 'guru-selfie',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="selfie-trigger"]',
      '[data-tour="camera-section"]',
    ],
    title: 'Kamera Swafoto',
    location: 'Seksi Swafoto Kehadiran',
    action: 'Perhatikan tombol Ambil Swafoto yang disorot. Sebelum mengirim presensi masuk, gunakan kamera untuk mengambil foto diri.',
    expectedResult: 'Foto selfie tersimpan dengan tanggal, jam, dan lokasi pengambilan foto.',
    icon: Camera,
    requiredPermission: PERMISSIONS.ATTENDANCE_CREATE,
  },
  {
    id: 'guru-submit',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="checkin-button"]',
      '[data-tour="checkout-button"]',
      '[data-tour="attendance-complete"]',
      '[data-tour="attendance-actions"]',
    ],
    title: 'Kirim Presensi',
    location: 'Tombol Presensi Masuk / Pulang',
    action: 'Lihat tombol yang disorot. Setelah lokasi dan foto siap, kirim Presensi Masuk. Saat selesai bertugas, kirim Presensi Pulang.',
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

type TargetState = 'searching' | 'found' | 'missing';

/** Locate actual UI controls rather than generic page containers. Off-screen elements are valid: we scroll to them. */
function findGuideTarget(selectors: string[]): { element: HTMLElement; selector: string } | null {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || !element.getClientRects().length) continue;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    return { element, selector };
  }
  return null;
}

export const InteractiveGuideTour: React.FC = () => {
  const { isGuideTourActive, stopGuideTour } = useGuide();
  const { hasRole, hasPermission } = useAuth();
  const { activeTab, setActiveTab } = useNavigation();
  const navigateRef = useRef(setActiveTab);
  navigateRef.current = setActiveTab;
  const adminTour = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const permissionSignature = TOUR_PERMISSIONS.filter(permission => hasPermission(permission)).join('|');
  const steps = useMemo(() => [...(adminTour ? ADMIN_STEPS : GURU_STEPS), {
    id: 'sync-status', targetTab: 'dashboard' as NavigationTab, selectors: ['[data-tour="sync-status"]'], title: 'Saat internet terputus',
    location: 'Ikon koneksi di header atas', action: 'Simpan formulir. Periksa antrean pada ikon koneksi; biarkan aplikasi terbuka saat internet kembali.',
    expectedResult: 'Antrean terkirim otomatis. Draf belum dikirim tetap perlu dibuka dan dikirim sendiri.', icon: Info, requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  }].filter(step => !step.requiredPermission || permissionSignature.split('|').includes(step.requiredPermission)), [adminTour, permissionSignature]);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<GuideRect | null>(null);
  const [targetState, setTargetState] = useState<TargetState>('searching');
  const [targetSelector, setTargetSelector] = useState('');
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 375 : window.innerWidth,
    height: typeof window === 'undefined' ? 760 : (window.visualViewport?.height || window.innerHeight),
    card: 280,
  }));
  const cardRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const mobile = size.width < 768;
  const bottomNavStep = mobile && step?.id === 'admin-nav';
  const headerBottom = typeof document !== 'undefined' ? document.querySelector('.app-topbar')?.getBoundingClientRect().bottom || 64 : 64;
  const areas = getGuideAreas(size.width, size.height, size.card, headerBottom, bottomNavStep);

  const close = useCallback(() => {
    stopGuideTour();
    setTargetRect(null);
    requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
  }, [stopGuideTour]);

  useEffect(() => {
    if (!isGuideTourActive) return;
    setIndex(0);
    previousFocus.current = document.activeElement as HTMLElement;
    document.documentElement.classList.add('guide-tour-active');
    requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    return () => document.documentElement.classList.remove('guide-tour-active');
  }, [isGuideTourActive]);

  useEffect(() => {
    if (!isGuideTourActive || !step) return;
    if (activeTab !== step.targetTab) navigateRef.current(step.targetTab);
    setTargetRect(null);
    setTargetState('searching');
    setTargetSelector('');

    let frame = 0;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let tries = 0;
    let scrolledToTarget = false;
    let previousSignature = '';
    let focusElement: HTMLElement | null = null;
    let originalScrollMargin = '';

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.visualViewport?.height || window.innerHeight;
        const card = cardRef.current?.offsetHeight || 280;
        setSize(previous => previous.width === width && previous.height === height && previous.card === card
          ? previous : { width, height, card });

        const header = document.querySelector('.app-topbar')?.getBoundingClientRect().bottom || 64;
        const isMobileNav = step.id === 'admin-nav' && width < 1024;
        const selectors = isMobileNav ? ['[data-tour="mobile-nav"]'] : step.selectors;
        const hit = findGuideTarget(selectors);
        if (!hit) {
          if (previousSignature !== 'none') {
            previousSignature = 'none';
            setTargetRect(null);
          }
          return;
        }
        const { element, selector } = hit;
        setTargetState('found');
        setTargetSelector(previous => previous === selector ? previous : selector);

        const fixedNavigation = Boolean(element.closest('.app-mobile-nav'));
        const region = getGuideAreas(width, height, card, header, fixedNavigation);
        const bounds = element.getBoundingClientRect();
        const rect = { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height };

        // Scroll ONCE per step to reveal the real control above the tutorial card.
        // The temporary bottom padding allows the last controls to reach the visible zone.
        if (!scrolledToTarget && !fixedNavigation && needsGuideScroll(rect, region.focusTop, region.focusBottom)) {
          scrolledToTarget = true;
          focusElement = element;
          originalScrollMargin = element.style.scrollMarginTop;
          element.style.scrollMarginTop = `${Math.round(region.focusTop + 12)}px`;
          element.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
          requestAnimationFrame(measure);
          return;
        }
        const clipped = clipGuideFocus(rect, width, region.focusTop, region.focusBottom);
        const signature = JSON.stringify(clipped);
        if (signature !== previousSignature) {
          previousSignature = signature;
          setTargetRect(clipped);
        }
      });
    };

    // Lazy-loaded pages may mount after navigation. Brief, bounded retries avoid
    // a heavy MutationObserver on the entire app (which caused delayed taps on mobile).
    retryTimer = setInterval(() => {
      tries += 1;
      if (findGuideTarget(step.id === 'admin-nav' && window.innerWidth < 1024 ? ['[data-tour="mobile-nav"]'] : step.selectors)) {
        if (retryTimer) clearInterval(retryTimer);
        retryTimer = null;
      } else if (tries >= 18) {
        if (retryTimer) clearInterval(retryTimer);
        retryTimer = null;
        setTargetState('missing');
      }
      measure();
    }, 200);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (cardRef.current) observer?.observe(cardRef.current);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', measure, { passive: true });
    measure();

    return () => {
      cancelAnimationFrame(frame);
      if (retryTimer) clearInterval(retryTimer);
      observer?.disconnect();
      if (focusElement) focusElement.style.scrollMarginTop = originalScrollMargin;
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isGuideTourActive, step, activeTab]);

  useEffect(() => {
    if (!isGuideTourActive) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !cardRef.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [isGuideTourActive, close]);

  if (!isGuideTourActive || !step) return null;
  const width = Math.min(370, size.width - 24);
  const left = Math.max(12, Math.min((size.width - width) / 2, size.width - width - 12));
  const cardTop = areas.cardTop;
  const complete = targetSelector === '[data-tour="attendance-complete"]';
  const targetLabel = complete ? 'Presensi hari ini sudah lengkap' : step.location;
  const missingReason = step.id === 'guru-selfie'
    ? 'Tombol swafoto hanya tampil sebelum presensi masuk. Jika Anda sudah check-in, langkah ini tidak perlu diulang.'
    : 'Bagian ini tidak sedang ditampilkan. Anda bisa menutup panduan, kembali ke menu terkait, lalu mencoba lagi.';

  return <div className="guide-layer print:hidden">
    <div className="guide-blocker" aria-hidden="true" />
    {targetRect && <>
      <div data-guide-spotlight className="guide-spotlight" style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8 }} />
      <div className="guide-target-flag" style={{ top: targetRect.top > 118 ? targetRect.top - 31 : targetRect.top + targetRect.height + 7, left: Math.max(12, Math.min(targetRect.left, size.width - 180)) }} aria-hidden="true">
        <MapPin className="w-3.5 h-3.5" /> Bagian yang dimaksud
      </div>
    </>}
    <section ref={cardRef} role="dialog" aria-modal="true" aria-label="Panduan Interaktif Penggunaan Aplikasi" aria-describedby="guide-action" tabIndex={-1}
      className="guide-card guide-card-guided" style={{ width, left, top: cardTop, maxHeight: mobile ? Math.min(315, Math.max(200, size.height * .44)) : Math.max(180, size.height - 150) }}>
      <div className="guide-heading"><span className="guide-progress">Langkah {index + 1} dari {steps.length}</span><button type="button" onClick={close} aria-label="Tutup Panduan Interaktif"><X className="w-4 h-4" /></button></div>
      <h2>{step.title}</h2>
      <p className="guide-location">{step.id === 'admin-nav' && mobile ? 'Menu bawah layar; ketuk Lainnya untuk menu lengkap.' : targetLabel}</p>
      <p id="guide-action">{complete ? 'Presensi masuk dan pulang sudah selesai. Bagian yang disorot menunjukkan status tersebut.' : step.action}</p>
      <p className="guide-result"><Check className="w-4 h-4 shrink-0" />{step.expectedResult}</p>
      {targetState === 'found' && targetRect && <p className="guide-focus-note" role="status">Lihat area yang diberi garis sorot. Tutup panduan untuk mencoba tombolnya.</p>}
      {targetState === 'searching' && !targetRect && <p className="guide-location" role="status">Menunjukkan lokasi fitur…</p>}
      {targetState === 'missing' && !targetRect && <p className="guide-missing-note" role="status">{missingReason}</p>}
      <footer><button type="button" onClick={close}>Tutup dulu</button><div><Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}>Kembali</Button><Button type="button" size="sm" onClick={() => index === steps.length - 1 ? close() : setIndex(value => Math.min(steps.length - 1, value + 1))}>{index === steps.length - 1 ? 'Selesai' : 'Lanjut'}</Button></div></footer>
    </section>
  </div>;
};
