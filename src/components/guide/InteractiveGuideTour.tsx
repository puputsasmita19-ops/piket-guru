import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  HelpCircle,
  Check,
  MapPin,
  Users,
  CalendarDays,
  FileBarChart2,
  BookOpenCheck,
  Camera,
  Clock,
  Navigation,
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
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_STEPS: TourStep[] = [
  {
    id: 'admin-nav',
    targetTab: 'dashboard',
    selectors: ['[data-tour="sidebar-nav"]', '[data-tour="mobile-nav"]', 'aside', 'header'],
    title: 'Navigasi Utama',
    description: 'Gunakan panel navigasi untuk mengakses modul operasional, pengelola pengguna, dan laporan.',
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
    title: 'Lokasi Presensi GPS',
    description: 'Tentukan titik lokasi sekolah dan radius geofence di Pengaturan, lalu simpan sebagai acuan resmi.',
    icon: MapPin,
  },
  {
    id: 'admin-users',
    targetTab: 'users',
    selectors: ['[data-tour="users-table"]', '[data-tour="users-container"]', 'main'],
    title: 'Manajemen Pengguna',
    description: 'Kelola akun guru, penugasan piket, dan reset PIN operasional secara terpusat.',
    icon: Users,
  },
  {
    id: 'admin-schedules',
    targetTab: 'schedules',
    selectors: ['[data-tour="schedules-container"]', 'main'],
    title: 'Pengaturan Jadwal',
    description: 'Atur jadwal piket harian, jam kerja, dan batas toleransi keterlambatan.',
    icon: CalendarDays,
  },
  {
    id: 'admin-reports',
    targetTab: 'reports',
    selectors: ['[data-tour="reports-container"]', 'main'],
    title: 'Rekap & Cetak Laporan',
    description: 'Pantau rekapitulasi kehadiran harian dan cetak laporan resmi berstempel digital.',
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
      'main',
    ],
    title: 'Menu Presensi Piket',
    description: 'Buka menu ini untuk mencatat presensi masuk dan pulang piket harian Anda.',
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
    title: 'Verifikasi Lokasi GPS',
    description: 'Ketuk tombol perbarui posisi untuk memverifikasi lokasi Anda berada di dalam radius sekolah.',
    icon: MapPin,
  },
  {
    id: 'guru-selfie',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="camera-section"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Swafoto Verification',
    description: 'Ambil foto selfie sebagai bukti kehadiran visual dengan timestamp dan lokasi resmi.',
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
    description: 'Klik tombol presensi masuk atau pulang untuk mengirim data kehadiran ke server.',
    icon: Clock,
  },
  {
    id: 'guru-history',
    targetTab: 'attendance',
    selectors: [
      '[data-tour="my-history-section"]',
      '[data-tour="attendance-container"]',
    ],
    title: 'Riwayat Kehadiran',
    description: 'Periksa riwayat kehadiran harian dan status pengiriman data presensi Anda.',
    icon: FileBarChart2,
  },
];

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const InteractiveGuideTour: React.FC = () => {
  const { isGuideModalOpen, dismissGuideForSession } = useGuide();
  const { hasRole } = useAuth();
  const { activeTab, setActiveTab } = useNavigation();

  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const tourSteps = isAdmin ? ADMIN_STEPS : GURU_STEPS;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  // Reset to step 0 when tour opens
  useEffect(() => {
    if (isGuideModalOpen) {
      setCurrentStepIndex(0);
    }
  }, [isGuideModalOpen]);

  const currentStep = tourSteps[currentStepIndex] || tourSteps[0];

  // Function to find element on screen and update bounding box
  const updateTargetPosition = useCallback(() => {
    if (!isGuideModalOpen || !currentStep) return;

    let foundEl: HTMLElement | null = null;
    for (const selector of currentStep.selectors) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        foundEl = el;
        break;
      }
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
  }, [isGuideModalOpen, currentStep]);

  // Handle step activation: switch tab if needed, scroll element into view, update position
  useEffect(() => {
    if (!isGuideModalOpen || !currentStep) return;

    // 1. Switch active tab if step specifies a target tab and it differs from current
    if (currentStep.targetTab && activeTab !== currentStep.targetTab) {
      setActiveTab(currentStep.targetTab);
    }

    // 2. Wait briefly for DOM render, scroll to target element
    const timer = setTimeout(() => {
      let foundEl: HTMLElement | null = null;
      for (const selector of currentStep.selectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          foundEl = el;
          break;
        }
      }

      if (foundEl) {
        try {
          foundEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
      }

      // Re-measure after scroll
      setTimeout(() => {
        updateTargetPosition();
      }, 150);
    }, 200);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isGuideModalOpen, currentStep, activeTab, setActiveTab, updateTargetPosition]);

  // Recalculate rect on window resize or scroll
  useEffect(() => {
    if (!isGuideModalOpen) return;

    const handleScrollOrResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isGuideModalOpen, updateTargetPosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!isGuideModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissGuideForSession();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < tourSteps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          dismissGuideForSession();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGuideModalOpen, currentStepIndex, tourSteps.length, dismissGuideForSession]);

  if (!isGuideModalOpen || !currentStep) return null;

  const isLastStep = currentStepIndex === tourSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const StepIcon = currentStep.icon;

  // Calculate position for small guide box clear of target
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const cardWidth = isMobile ? Math.min(340, window.innerWidth - 32) : 320;
  const cardEstimatedHeight = 170;

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    if (isMobile) {
      // On mobile: check if target is in upper or lower half of screen
      const targetCenterY = targetRect.top + targetRect.height / 2;
      if (targetCenterY > window.innerHeight / 2) {
        // Target is at bottom -> Place card near top (below fixed header ~64px)
        cardStyle = {
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          width: cardWidth,
          zIndex: 9999,
        };
      } else {
        // Target is at top -> Place card near bottom (above bottom nav ~72px)
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

  const spotlightPadding = 6;

  return (
    <div className="select-none print:hidden">
      {/* Clear Backdrop Overlay (No Blur) */}
      <div
        className="fixed inset-0 z-[9990] bg-slate-900/20 dark:bg-slate-950/35 transition-opacity duration-200 pointer-events-auto"
        onClick={dismissGuideForSession}
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
          {/* Subtle Pointer Tag on target ring */}
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
        className="bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] p-3.5 space-y-2.5 text-left transition-all duration-200"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[var(--theme-card-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center shrink-0 border border-[var(--theme-primary-border)]/50">
              <StepIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
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
              onClick={dismissGuideForSession}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              title="Tutup Panduan (Esc)"
              aria-label="Tutup Panduan Interaktif"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 1 sentence direct action description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {currentStep.description}
        </p>

        {/* Action Buttons Footer */}
        <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-[var(--theme-card-border)]">
          <button
            type="button"
            onClick={dismissGuideForSession}
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
                onClick={dismissGuideForSession}
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
