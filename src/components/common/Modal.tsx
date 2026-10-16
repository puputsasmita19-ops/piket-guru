import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../icons';
import { useModuleAppearance } from '../../contexts/ModuleAppearanceContext';
import { getModuleStyle } from '../../config/moduleAppearance';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

// A camera/confirmation dialog can be opened above another form. Only the top
// dialog handles Escape/Tab, and body scrolling stays locked until all close.
const openDialogs: symbol[] = [];
let savedOverflow = '';
let savedPaddingRight = '';

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'lg' }) => {
  const module = useModuleAppearance();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const tokenRef = useRef(Symbol('dialog'));
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const token = tokenRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openDialogs.length === 0) {
      savedOverflow = document.body.style.overflow;
      savedPaddingRight = document.body.style.paddingRight;
      const scrollbar = document.documentElement.clientWidth > 0
        ? Math.max(0, window.innerWidth - document.documentElement.clientWidth) : 0;
      if (scrollbar) document.body.style.paddingRight = `${(parseFloat(getComputedStyle(document.body).paddingRight) || 0) + scrollbar}px`;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.push(token);
    const frame = requestAnimationFrame(() => {
      if (openDialogs.at(-1) === token && !panelRef.current?.contains(document.activeElement)) {
        panelRef.current?.focus({ preventScroll: true });
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== token || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === 'Tab' && panelRef.current) {
        const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); panelRef.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      const position = openDialogs.indexOf(token);
      const wasTop = position === openDialogs.length - 1;
      if (position !== -1) openDialogs.splice(position, 1);
      if (openDialogs.length === 0) {
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
      }
      if (wasTop && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl' };
  return createPortal(
    <div data-module={module} style={getModuleStyle(module)} className="app-dialog-overlay fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="app-dialog-backdrop absolute inset-0 bg-slate-950/55" aria-hidden="true"
        onClick={() => { if (openDialogs.at(-1) === tokenRef.current) closeRef.current(); }} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`app-dialog relative flex flex-col w-full ${widths[maxWidth]} bg-white dark:bg-[var(--theme-card-bg)] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] outline-none`}>
        <div className="app-dialog-header flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-[var(--theme-card-border)] shrink-0">
          <h2 id={titleId} className="text-base font-bold leading-snug text-slate-900 dark:text-white min-w-0 self-center">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup dialog" title="Tutup"
            className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[var(--theme-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="app-dialog-body min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 text-slate-700 dark:text-slate-300 text-sm">{children}</div>
        {footer && <div className="app-dialog-footer flex flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-5 bg-[var(--theme-card-bg)] border-t border-slate-100 dark:border-[var(--theme-card-border)] shrink-0">{footer}</div>}
      </div>
    </div>, document.body
  );
};
