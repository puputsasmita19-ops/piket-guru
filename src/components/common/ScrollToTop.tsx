import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';

export interface ScrollToTopProps {
  /**
   * Scroll threshold in pixels before the button appears. Default is 300px.
   */
  threshold?: number;
  /**
   * Optional CSS selector for custom scroll container. Defaults to 'main' and window.
   */
  targetSelector?: string;
  /**
   * Additional CSS classes for styling or positioning override
   */
  className?: string;
}

/**
 * Shared "Kembali ke atas" (Back to Top) button.
 * - Appears after scrolling ~300px.
 * - Works with both container scrolling (<main>) and window scrolling.
 * - Respects prefers-reduced-motion for smooth vs instant scroll.
 * - Meets 44x44px minimum touch target requirements.
 * - Hides when a modal/dialog is open.
 * - Hidden in print / print preview.
 * - Properly manages and cleans up event listeners across menu navigation.
 */
export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  threshold = 300,
  targetSelector = 'main',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { activeTab } = useNavigation();
  const observerRef = useRef<MutationObserver | null>(null);

  // Check whether any modal is currently open in the document
  const checkModalStatus = useCallback(() => {
    if (typeof document === 'undefined') return;
    const bodyOverflowHidden =
      document.body.style.overflow === 'hidden' ||
      document.documentElement.style.overflow === 'hidden';
    const hasModalDialog =
      document.querySelector('[role="dialog"]') !== null ||
      document.querySelector('.fixed.inset-0.z-50') !== null ||
      document.querySelector('[data-modal-open="true"]') !== null;

    setIsModalOpen(bodyOverflowHidden || hasModalDialog);
  }, []);

  // Check scroll position from main scroll container and window
  const checkScroll = useCallback(() => {
    if (typeof window === 'undefined') return;

    let maxScroll = 0;

    // Check window / document scroll
    const windowScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    maxScroll = Math.max(maxScroll, windowScroll);

    // Check target container scroll (usually <main>)
    if (targetSelector) {
      const container = document.querySelector(targetSelector);
      if (container) {
        maxScroll = Math.max(maxScroll, container.scrollTop);
      }
    }

    // Also check all potential overflow-y-auto elements within the main viewport
    const overflowContainers = document.querySelectorAll('main, [data-scroll-container="true"]');
    overflowContainers.forEach((el) => {
      maxScroll = Math.max(maxScroll, el.scrollTop);
    });

    setIsVisible(maxScroll >= threshold);
  }, [threshold, targetSelector]);

  // Handle click to scroll back to the top
  const handleScrollToTop = () => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    // 1. Scroll target container if available
    if (targetSelector) {
      const container = document.querySelector(targetSelector);
      if (container && container.scrollTop > 0) {
        container.scrollTo({ top: 0, behavior });
      }
    }

    // 2. Scroll all potential main scroll containers
    const overflowContainers = document.querySelectorAll('main, [data-scroll-container="true"]');
    overflowContainers.forEach((el) => {
      if (el.scrollTop > 0) {
        el.scrollTo({ top: 0, behavior });
      }
    });

    // 3. Scroll window & documentElement
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
      window.scrollTo({ top: 0, behavior });
    }
  };

  // Set up scroll listeners and modal mutation observer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial checks
    checkScroll();
    checkModalStatus();

    // Scroll listener on window
    const handleWindowScroll = () => {
      checkScroll();
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowScroll, { passive: true });

    // Scroll listener on main container
    let containerEl: Element | null = null;
    if (targetSelector) {
      containerEl = document.querySelector(targetSelector);
      if (containerEl) {
        containerEl.addEventListener('scroll', handleWindowScroll, { passive: true });
      }
    }

    // Also listen to any other main scroll containers
    const mainEls = document.querySelectorAll('main');
    mainEls.forEach((el) => {
      el.addEventListener('scroll', handleWindowScroll, { passive: true });
    });

    // Set up MutationObserver to detect modal open/close (e.g. style changes or new DOM nodes)
    const observer = new MutationObserver(() => {
      checkModalStatus();
      checkScroll();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true,
    });
    observerRef.current = observer;

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowScroll);
      if (containerEl) {
        containerEl.removeEventListener('scroll', handleWindowScroll);
      }
      mainEls.forEach((el) => {
        el.removeEventListener('scroll', handleWindowScroll);
      });
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [checkScroll, checkModalStatus, targetSelector, activeTab]);

  // Re-evaluate on navigation tab change
  useEffect(() => {
    // Give time for view transition to render, then re-check
    const timer = setTimeout(() => {
      checkScroll();
      checkModalStatus();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, checkScroll, checkModalStatus]);

  // Only show if scrolled past threshold and no modal is active
  const shouldShow = isVisible && !isModalOpen;

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
      className={`fixed z-30 flex items-center justify-center rounded-2xl print:hidden cursor-pointer
        w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px]
        right-4 bottom-20 lg:bottom-8 lg:right-8
        bg-white/95 dark:bg-[var(--theme-card-bg)]/95 text-slate-700 dark:text-slate-200
        hover:text-[var(--theme-primary)] dark:hover:text-[var(--theme-primary-text)] hover:bg-white dark:hover:bg-[var(--theme-card-bg)]
        hover:border-[var(--theme-primary-border)] dark:hover:border-[var(--theme-primary-border)]
        active:scale-95 active:bg-slate-100 dark:active:bg-[var(--theme-surface-subtle)]
        border border-slate-200/90 dark:border-[var(--theme-card-border)]
        shadow-lg hover:shadow-xl shadow-slate-900/10 dark:shadow-black/40
        backdrop-blur-md transition-all duration-300 motion-reduce:transition-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950
        ${
          shouldShow
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
        }
        ${className}
      `}
      style={{
        // Respect mobile safe-area-inset-bottom
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
    </button>
  );
};
