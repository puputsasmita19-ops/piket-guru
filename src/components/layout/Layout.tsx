import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { EmergencyBanner } from './EmergencyBanner';
import { ScrollToTop } from '../common/ScrollToTop';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150"
      style={{ backgroundColor: 'var(--theme-bg-app)' }}
    >
      <EmergencyBanner />
      <Header onToggleSidebar={() => setSidebarOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main id="main-content-scroll" className="flex-1 overflow-y-auto pb-20 lg:pb-8 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      <ScrollToTop targetSelector="#main-content-scroll" />
      <MobileNav onOpenMore={() => setSidebarOpen(true)} />
    </div>
  );
};
