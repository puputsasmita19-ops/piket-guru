import React from 'react';
import { BookOpen, Play, X } from '../icons';
import { useGuide } from '../../contexts/GuideContext';
import { useAuth } from '../../contexts/AuthContext';

/** A one-time, non-modal invitation. Never navigates or opens camera without opt-in. */
export const GuideWelcomePrompt: React.FC = () => {
  const { isWelcomeGuideOpen, isGuideTourActive, dismissWelcomeGuide, startGuideTour } = useGuide();
  const { hasRole } = useAuth();
  if (!isWelcomeGuideOpen || isGuideTourActive) return null;
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  return (
    <aside className="guide-welcome-prompt print:hidden" aria-label="Pengenalan penggunaan Piket Guru">
      <div className="guide-welcome-heading">
        <span className="guide-welcome-icon" aria-hidden="true"><BookOpen className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <strong>Baru menggunakan Piket Guru?</strong>
          <p>{isAdmin ? 'Kenali navigasi, jadwal, dan laporan admin.' : 'Kenali GPS, swafoto, dan pengiriman presensi.'}</p>
        </div>
        <button type="button" onClick={dismissWelcomeGuide} aria-label="Lewati pengenalan" title="Lewati" className="guide-welcome-dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="guide-welcome-actions">
        <button type="button" onClick={dismissWelcomeGuide} className="guide-welcome-later">Lewati</button>
        <button type="button" onClick={() => startGuideTour('quick')} className="guide-welcome-start">
          <Play className="w-4 h-4" /> Mulai 3 Langkah
        </button>
      </div>
      <p className="guide-welcome-caption">Muncul sekali pada perangkat ini. Panduan bisa dibuka kembali melalui ikon ? di header.</p>
    </aside>
  );
};
