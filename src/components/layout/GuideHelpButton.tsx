import React, { useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import { useGuide } from '../../contexts/GuideContext';

export const GuideHelpButton: React.FC = () => {
  const { isGuideModalOpen, openGuideModal, closeGuideModal } = useGuide();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div data-tour="guide-help-button" className="relative inline-block">
      {/* Guide Help Header Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (isGuideModalOpen) {
            closeGuideModal();
          } else {
            openGuideModal();
          }
        }}
        aria-expanded={isGuideModalOpen}
        aria-haspopup="true"
        aria-label="Panduan penggunaan"
        title="Panduan penggunaan"
        className="p-2 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors relative cursor-pointer min-w-[40px] xs:min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95 shrink-0"
      >
        <HelpCircle className="w-5 h-5 shrink-0" />
      </button>
    </div>
  );
};

