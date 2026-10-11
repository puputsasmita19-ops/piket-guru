import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { useGuide } from '../../contexts/GuideContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { NavigationTab } from '../../types';
import { Button } from '../common/Button';

export interface TourStep {
  id: string;
  targetTab: NavigationTab;
  selectors: string[];
  title: string;
  location: string;
  action: string;
  expectedResult: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_STEPS: TourStep[] = [
  {
    id: 'admin-nav',
    targetTab: 'dashboard',
    selectors: ['[data-tour="sidebar-nav"]', '[data-tour="mobile-nav"]', 'aside'],
    title: 'Navigasi Utama',
    location: 'Sidebar / Panel Navigasi Samping',
    action: 'Buka menu navigasi untuk mengakses modul operasional, pengelola pengguna, dan laporan.',
    expectedResult: 'Menampilkan seluruh daftar menu operasional, manajemen, dan pengaturan.',
    icon: Navigation,
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
  },
];

const GURU_STEPS: TourStep[] = [
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
  const { hasRole } = useAuth();
  const { activeTab, setActiveTab } = useNavigation();

  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const tourSteps = isAdmin ? ADMIN_STEPS : GURU_STEPS;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const tourMountedTimeRef = useRef<number>(0);

  // Reset to step 0 and record mount time when tour opens
  useEffect(() => {
    if (isGuideTourActive) {
      tourMountedTimeRef.current = Date.now();
      setCurrentStepIndex(0);
    }
  }, [isGuideTourActive]);

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
          // Ensure element is horizontally within layout (not hidden in offscreen sidebars)
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

  // Handle step activation: switch tab if needed and scroll element into view
  useEffect(() => {
    if (!isGuideTourActive || !currentStep) return;

    // 1. Switch active tab if step specifies a target tab and it differs from current
    if (currentStep.targetTab && activeTab !== currentStep.targetTab) {
      setActiveTab(currentStep.targetTab);
    }

    // 2. Wait briefly for DOM render, scroll to target element if found
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
        try {
          foundEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
      }

      updateTargetPosition();
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isGuideTourActive, currentStep, activeTab, setActiveTab, updateTargetPosition]);

  // Continuously verify and adjust position while tour is active
  useEffect(() => {
    if (!isGuideTourActive) return;

    updateTargetPosition();
    const interval = setInterval(() => {
      updateTargetPosition();
    }, 200);

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
        stopGuideTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < tourSteps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          stopGuideTour();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideTourActive, currentStepIndex, tourSteps.length, stopGuideTour]);

  if (!isGuideTourActive || !currentStep) return null;

  const isLastStep = currentStepIndex === tourSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const StepIcon = currentStep.icon;

  // Calculate position for small guide box clear of target
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const cardWidth = isMobile ? Math.min(350, window.innerWidth - 32) : 340;
  const cardEstimatedHeight = 220;

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    if (isMobile) {
      // On mobile: check if target is in upper or lower half of screen
      const targetCenterY = targetRect.top + targetRect.height / 2;
      if (targetCenterY > window.innerHeight / 2) {
        // Target is at bottom -> Place card near top (below fixed header ~72px)
        cardStyle = {
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          width: cardWidth,
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
          zIndex: 9999,
        };
      }
    } else {
      // On desktop: place smart tooltip box near target element without overlapping
      const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
      const spaceAbove = targetRect.top;
      const spaceRight = window.innerWidth - (targetRect.left + targetRect.width);

      if (spaceBelow >= cardEstimatedHeight + 16) {
        // Below target
        cardStyle = {
          position: 'fixed',
          top: targetRect.top + targetRect.height + 12,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - cardWidth - 16)),
          width: cardWidth,
          zIndex: 9999,
        };
      } else if (spaceAbove >= cardEstimatedHeight + 16) {
        // Above target
        cardStyle = {
          position: 'fixed',
          top: targetRect.top - cardEstimatedHeight - 12,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - cardWidth - 16)),
          width: cardWidth,
          zIndex: 9999,
        };
      } else if (spaceRight >= cardWidth + 16) {
        // To the right of target
        cardStyle = {
          position: 'fixed',
          top: Math.max(16, Math.min(targetRect.top, window.innerHeight - cardEstimatedHeight - 16)),
          left: targetRect.left + targetRect.width + 12,
          width: cardWidth,
          zIndex: 9999,
        };
      } else {
        // To the left of target
        cardStyle = {
          position: 'fixed',
          top: Math.max(16, Math.min(targetRect.top, window.innerHeight - cardEstimatedHeight - 16)),
          left: Math.max(16, targetRect.left - cardWidth - 12),
          width: cardWidth,
          zIndex: 9999,
        };
      }
    }
  } else {
    // Fallback position centered if target rect not yet measured
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardWidth,
      zIndex: 9999,
    };
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Prevent immediate close from the click event that launched the tour
    if (Date.now() - tourMountedTimeRef.current < 350) return;
    stopGuideTour();
  };

  const spotlightPadding = 6;

  return (
    <div className="select-none print:hidden">
      {/* Clear Backdrop Overlay (No Blur) */}
      <div
        className="fixed inset-0 z-[9990] bg-slate-900/20 dark:bg-slate-950/35 transition-opacity duration-200 pointer-events-auto"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Clear Highlight Frame over Target Element with Theme Ring */}
      {targetRect && (
        <div
          className="fixed z-[9995] pointer-events-none transition-all duration-300 ease-out rounded-xl ring-2 ring-[var(--theme-primary)] shadow-[0_0_20px_var(--theme-ring)] bg-transparent"
          style={{
            top: targetRect.top - spotlightPadding,
            left: targetRect.left - spotlightPadding,
            width: targetRect.width + spotlightPadding * 2,
            height: targetRect.height + spotlightPadding * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.25)',
          }}
        >
          {/* Pointer Tag on target ring */}
          <div className="absolute -top-2.5 left-3 px-1.5 py-0.5 rounded bg-[var(--theme-primary)] text-white text-[9px] font-bold shadow-xs uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
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
        className="bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] p-4 space-y-3 text-left transition-all duration-200"
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
              onClick={stopGuideTour}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              title="Tutup Panduan (Esc)"
              aria-label="Tutup Panduan Interaktif"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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
            onClick={stopGuideTour}
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
                onClick={stopGuideTour}
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

