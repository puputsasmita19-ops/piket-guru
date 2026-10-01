import React, { useEffect, useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Checks if current runtime is a mobile device / screen
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isMobileScreen = window.innerWidth < 1024;
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  return (isTouch && isMobileScreen) || isMobileUserAgent || isMobileScreen;
};

export const MobileExitConfirmModal: React.FC = () => {
  const { isAuthenticated, logout, currentUser } = useAuth();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const isGuardActiveRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !isMobileDevice()) {
      isGuardActiveRef.current = false;
      return;
    }

    // Set up the history guard once when user is authenticated on mobile
    if (!isGuardActiveRef.current) {
      try {
        window.history.pushState({ appExitGuard: true }, document.title, window.location.href);
        isGuardActiveRef.current = true;
      } catch {
        // ignore
      }
    }

    const handlePopState = () => {
      if (!isMobileDevice() || !isAuthenticated) return;

      // User pressed the device back button on mobile
      // Re-push guard state to stay on current screen
      try {
        window.history.pushState({ appExitGuard: true }, document.title, window.location.href);
      } catch {
        // ignore
      }

      // Show exit confirmation modal
      setShowExitConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAuthenticated]);

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    isGuardActiveRef.current = false;
    await logout();
  };

  if (!isAuthenticated || !isMobileDevice()) return null;

  return (
    <Modal
      isOpen={showExitConfirm}
      onClose={handleCancelExit}
      title="Konfirmasi Keluar Aplikasi"
      maxWidth="sm"
    >
      <div className="space-y-4 text-center py-2">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            Keluar dari Aplikasi Piket Guru?
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
            Anda menekan tombol kembali pada perangkat mobile. Apakah Anda yakin ingin mengakhiri sesi dan keluar dari sistem piket sekolah?
          </p>
        </div>

        {currentUser && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            Akun aktif: <strong>{currentUser.fullName}</strong> ({currentUser.role})
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="md"
            className="w-full sm:w-auto"
            onClick={handleCancelExit}
          >
            Batal / Tetap di Aplikasi
          </Button>
          <Button
            variant="danger"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleConfirmExit}
          >
            Ya, Keluar Aplikasi
          </Button>
        </div>
      </div>
    </Modal>
  );
};

