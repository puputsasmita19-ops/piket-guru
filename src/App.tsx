/** @license SPDX-License-Identifier: Apache-2.0 */
import React, { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { GuideProvider } from './contexts/GuideContext';
import { LoginPage } from './features/auth/LoginPage';
const PublicVisitorCheckin = lazy(() => import('./features/visitors/PublicVisitorCheckin').then(module => ({ default: module.PublicVisitorCheckin })));
import { ViewErrorBoundary } from './components/common/ViewErrorBoundary';
import { PageLoading } from './components/common/PageLoading';
import { loadAuthenticatedShell } from './appBootstrap';
import { loginDiagnosticsEnabled } from './features/auth/loginDiagnostics';
const LoginDiagnosticsPanel = lazy(() => import('./features/auth/LoginDiagnosticsPanel'));

const AuthenticatedShell = lazy(loadAuthenticatedShell);

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    // Matikan popup context menu / copy paste saat user menekan lama (long press) di perangkat mobile
    const handleContextMenu = (e: MouseEvent | TouchEvent) => {
      const isMobile =
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.innerWidth < 1024;
      if (isMobile) {
        e.preventDefault();
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      const isMobile =
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.innerWidth < 1024;
      if (isMobile) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  const guestToken = new URLSearchParams(window.location.search).get('visitor-checkin');
  if (guestToken) return <Suspense fallback={<PageLoading fullScreen label="Membuka formulir tamu…" />}><PublicVisitorCheckin token={guestToken} /></Suspense>;
  if (isLoading) return <PageLoading fullScreen label="Memverifikasi sesi…" />;
  if (!isAuthenticated) return <LoginPage />;
  return (
    <ViewErrorBoundary resetKey="authenticated-shell">
      <Suspense fallback={<PageLoading fullScreen label="Menyiapkan dashboard…" />}>
        <AuthenticatedShell />
      </Suspense>
    </ViewErrorBoundary>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider>
          <GuideProvider>
            <AppContent />
            {loginDiagnosticsEnabled() && <Suspense fallback={null}><LoginDiagnosticsPanel /></Suspense>}
          </GuideProvider>
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
