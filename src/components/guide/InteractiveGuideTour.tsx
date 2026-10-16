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
    location: 'Sidebar / Panel Navigasi Samping',
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
      '[data-tour="attendance-container"]',
      '[data-tour="attendance-nav"]',
    ],
    title: 'Presensi Masuk',
    location: 'Menu Presensi GPS',
    action: 'Di menu Presensi Piket, periksa lokasi lalu ambil swafoto. Tekan tombol kirim yang tersedia.',
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
    expectedResult: 'Foto selfie tersimpan dengan timestamp dan lokasi resmi.',
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
    action: 'Tekan tombol presensi masuk atau pulang untuk mengirim data ke server.',
    expectedResult: 'Presensi berhasil terkirim dan tercatat pada sistem.',
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

  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  // Filter tour steps based on user roles and actual permissions
  const tourSteps = useMemo(() => {
    const rawSteps = isAdmin ? ADMIN_STEPS : GURU_STEPS;
    const filtered = rawSteps.filter((s) => {
      if (s.requiredPermission && !hasPermission(s.requiredPermission)) {
        return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered : rawSteps;
  }, [isAdmin, hasPermission]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const tourMountedTimeRef = useRef<number>(0);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus and mount recording
  useEffect(() => {
    if (isGuideTourActive) {
      tourMountedTimeRef.current = Date.now();
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setCurrentStepIndex(0);
    }
  }, [isGuideTourActive]);

  const handleStopTour = useCallback(() => {
    stopGuideTour();
    setTargetRect(null);
    setTimeout(() => {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      } else {
        const guideBtn = document.querySelector('[data-tour="guide-help-button"]') as HTMLElement | null;
        guideBtn?.focus();
      }
    }, 60);
  }, [stopGuideTour]);

  const currentStep = tourSteps[currentStepIndex] || tourSteps[0];

  // Function to find element on screen and update bounding box
  const updateTargetPosition = useCallback(() => {
    if (!isGuideTourActive || !currentStep) return;

    let foundEl: HTMLElement | null = null;
    for (const selector of currentStep.selectors) {
      const els = document.querySelectorAll(selector);
      for (let i = 0; i < els.length; i++) {
        const el = els[i] as HTMLElement;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          const style = window.getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.right > 0 && rect.left < window.innerWidth) {
            foundEl = el;
            break;
          }
        }
      }
      if (foundEl) break;
    }

    if (foundEl) {
      const rect = foundEl.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [isGuideTourActive, currentStep]);

  // Handle step activation: switch tab if needed, auto-scroll only if outside viewport
  useEffect(() => {
    if (!isGuideTourActive || !currentStep) return;

    // 1. Switch active tab first if specified and differing
    if (currentStep.targetTab && activeTab !== currentStep.targetTab) {
      setActiveTab(currentStep.targetTab);
    }

    // 2. Wait for rendering and check if target is outside visible area
    const timer = setTimeout(() => {
      let foundEl: HTMLElement | null = null;
      for (const selector of currentStep.selectors) {
        const els = document.querySelectorAll(selector);
        for (let i = 0; i < els.length; i++) {
          const el = els[i] as HTMLElement;
          if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
            const rect = el.getBoundingClientRect();
            if (rect.right > 0 && rect.left < window.innerWidth) {
              foundEl = el;
              break;
            }
          }
        }
        if (foundEl) break;
      }

      if (foundEl) {
        const rect = foundEl.getBoundingClientRect();
        // Check if element is already fully visible in viewport
        const isFullyVisible =
          rect.top >= 70 &&
          rect.bottom <= window.innerHeight - 70 &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth;

        // Auto-scroll ONLY if target is outside visible area
        if (!isFullyVisible) {
          try {
            foundEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } catch {}
        }
      }

      updateTargetPosition();
    }, 120);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isGuideTourActive, currentStep, activeTab, setActiveTab, updateTargetPosition]);

  // Continuously verify and adjust position while tour is active
  useEffect(() => {
    if (!isGuideTourActive) return;

    updateTargetPosition();
    const interval = setInterval(() => {
      updateTargetPosition();
    }, 250);

    const handleScrollOrResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isGuideTourActive, currentStepIndex, updateTargetPosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!isGuideTourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleStopTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < tourSteps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          handleStopTour();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideTourActive, currentStepIndex, tourSteps.length, handleStopTour]);

  if (!isGuideTourActive || !currentStep) return null;

  const isLastStep = currentStepIndex === tourSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const StepIcon = currentStep.icon;

  // Responsive calculation for card placement clear of target
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const cardWidth = isMobile ? Math.min(360, window.innerWidth - 24) : 360;
  const cardEstimatedHeight = 230;

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    if (isMobile) {
      // Mobile positioning: avoid covering target element
      const targetCenterY = targetRect.top + targetRect.height / 2;
      if (targetCenterY > window.innerHeight / 2) {
        // Target is at bottom -> Place card near top (below fixed header ~72px)
        cardStyle = {
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          width: cardWidth,
          maxWidth: 'calc(100vw - 24px)',
          zIndex: 9999,
        };
      } else {
        // Target is at top -> Place card near bottom (above bottom nav ~76px)
        cardStyle = {
          position: 'fixed',
          bottom: 76,
          left: '50%',
          transform: 'translateX(-50%)',
          width: cardWidth,
          maxWidth: 'calc(100vw - 24px)',
          zIndex: 9999,
        };
      }
    } else {
      // Desktop: place card in direction with largest available space without overlapping target
      const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
      const spaceAbove = targetRect.top - 68;
      const spaceRight = window.innerWidth - (targetRect.left + targetRect.width);
      const spaceLeft = targetRect.left;

      if (spaceBelow >= cardEstimatedHeight + 16) {
        // Below target
        cardStyle = {
          position: 'fixed',
          top: targetRect.top + targetRect.height + 14,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - cardWidth - 16)),
          width: cardWidth,
          zIndex: 9999,
        };
      } else if (spaceAbove >= cardEstimatedHeight + 16) {
        // Above target
        cardStyle = {
          position: 'fixed',
          top: targetRect.top - cardEstimatedHeight - 14,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - cardWidth - 16)),
          width: cardWidth,
          zIndex: 9999,
        };
      } else if (spaceRight >= cardWidth + 16) {
        // Right of target
        cardStyle = {
          position: 'fixed',
          top: Math.max(72, Math.min(targetRect.top, window.innerHeight - cardEstimatedHeight - 16)),
          left: targetRect.left + targetRect.width + 14,
          width: cardWidth,
          zIndex: 9999,
        };
      } else {
        // Left of target
        cardStyle = {
          position: 'fixed',
          top: Math.max(72, Math.min(targetRect.top, window.innerHeight - cardEstimatedHeight - 16)),
          left: Math.max(16, targetRect.left - cardWidth - 14),
          width: cardWidth,
          zIndex: 9999,
        };
      }
    }
  } else {
    // Clear centered fallback when target element is not directly measured
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardWidth,
      maxWidth: 'calc(100vw - 24px)',
      zIndex: 9999,
    };
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (Date.now() - tourMountedTimeRef.current < 350) return;
    handleStopTour();
  };

  const spotlightPadding = 6;

  return (
    <div className="select-none print:hidden">
      {/* Clear Backdrop Overlay (No Blur, preserves element clarity) */}
      <div
        className="fixed inset-0 z-[9990] bg-slate-900/20 dark:bg-slate-950/35 transition-opacity duration-150 pointer-events-auto"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Clear Highlight Frame over Target Element with Theme Ring (Zero Blur) */}
      {targetRect && (
        <div
          className="fixed z-[9995] pointer-events-none transition-all duration-200 ease-out rounded-xl ring-2 ring-[var(--theme-primary)] shadow-[0_0_20px_var(--theme-ring)] bg-transparent motion-reduce:transition-none"
          style={{
            top: targetRect.top - spotlightPadding,
            left: targetRect.left - spotlightPadding,
            width: targetRect.width + spotlightPadding * 2,
            height: targetRect.height + spotlightPadding * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.28)',
          }}
        >
          {/* Pointer Tag on target ring */}
          <div className="absolute -top-2.5 left-3 px-1.5 py-0.5 rounded bg-[var(--theme-primary)] text-white text-[9px] font-bold shadow-xs uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping motion-reduce:animate-none" />
            <span>Target</span>
          </div>
        </div>
      )}

      {/* Compact Interactive Explanation Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Panduan Interaktif Penggunaan Aplikasi"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] p-4 space-y-3 text-left transition-all duration-150 motion-reduce:transition-none"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[var(--theme-card-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center shrink-0 border border-[var(--theme-primary-border)]/50">
              <StepIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {currentStep.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] bg-[var(--theme-primary-light)] px-2 py-0.5 rounded-md">
              {currentStepIndex + 1}/{tourSteps.length}
            </span>
            <button
              type="button"
              onClick={handleStopTour}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              title="Tutup Panduan (Esc)"
              aria-label="Tutup Panduan Interaktif"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clear feedback if target not yet mounted on screen */}
        {!targetRect && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Modul berada di: <strong>{currentStep.location}</strong></span>
            </div>
            {activeTab !== currentStep.targetTab && (
              <button
                type="button"
                onClick={() => setActiveTab(currentStep.targetTab)}
                className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 cursor-pointer"
              >
                Buka Tab
              </button>
            )}
          </div>
        )}

        {/* Step Breakdown: Lokasi, Tindakan, Hasil */}
        <div className="space-y-2 text-xs leading-relaxed">
          {/* Lokasi */}
          <div className="flex items-start gap-1.5">
            <span className="font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shrink-0 min-w-[54px]">
              Lokasi:
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {currentStep.location}
            </span>
          </div>

          {/* Tindakan */}
          <div className="flex items-start gap-1.5">
            <span className="font-bold text-slate-900 dark:text-white shrink-0 min-w-[54px]">
              Tindakan:
            </span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {currentStep.action}
            </span>
          </div>

          {/* Hasil */}
          <div className="flex items-start gap-1.5 bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/50 p-2 rounded-xl border border-slate-100 dark:border-[var(--theme-card-border)]">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 min-w-[54px]">
              Hasil:
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              {currentStep.expectedResult}
            </span>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-[var(--theme-card-border)]">
          <button
            type="button"
            onClick={handleStopTour}
            className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium px-1.5 py-1 rounded transition-colors cursor-pointer"
          >
            Lewati
          </button>

          <div className="flex items-center gap-1.5">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] py-1 px-2.5 min-h-[30px] cursor-pointer"
                leftIcon={<ChevronLeft className="w-3 h-3" />}
                onClick={() => setCurrentStepIndex((prev) => prev - 1)}
              >
                Kembali
              </Button>
            )}

            {!isLastStep ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="text-[11px] py-1 px-3 min-h-[30px] font-bold cursor-pointer"
                rightIcon={<ChevronRight className="w-3 h-3" />}
                onClick={() => setCurrentStepIndex((prev) => prev + 1)}
              >
                Berikutnya
              </Button>
            ) : (
              <Button
                type="button"
                variant="success"
                size="sm"
                className="text-[11px] py-1 px-3 min-h-[30px] font-bold cursor-pointer"
                leftIcon={<Check className="w-3 h-3" />}
                onClick={handleStopTour}
              >
                Selesai
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
