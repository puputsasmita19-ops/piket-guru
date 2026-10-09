import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  BookOpenCheck,
  LayoutGrid,
} from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationTab } from '../../types';
import { PERMISSIONS, PermissionKey } from '../../config/permissions';

interface MobileNavProps {
  onOpenMore: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenMore }) => {
  const { activeTab, setActiveTab } = useNavigation();
  const { hasPermission } = useAuth();

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    permission: PermissionKey;
  }> = [
    { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    { id: 'schedules', label: 'Jadwal', icon: CalendarDays, permission: PERMISSIONS.SCHEDULE_VIEW },
    { id: 'attendance', label: 'Presensi', icon: MapPin, permission: PERMISSIONS.ATTENDANCE_VIEW },
    { id: 'duty-book', label: 'Buku Piket', icon: BookOpenCheck, permission: PERMISSIONS.DUTYBOOK_VIEW },
  ];

  const visibleItems = navItems.filter((i) => hasPermission(i.permission));
  const primaryTabIds: NavigationTab[] = ['dashboard', 'schedules', 'attendance', 'duty-book'];
  const isMoreActive = !primaryTabIds.includes(activeTab);

  return (
    <nav
      aria-label="Navigasi Utama Mobile"
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t border-slate-200/80 dark:border-[var(--theme-card-border)] lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-safe transition-colors duration-200 print:hidden"
      style={{ backgroundColor: 'var(--theme-header-bg)' }}
    >
      <div
        className="grid h-16 max-w-lg mx-auto items-center px-1.5 sm:px-3"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[44px] py-1 px-1 rounded-2xl cursor-pointer transition-all duration-150 active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-primary)] ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {/* Squircle Pastel Container for Icon */}
              <div
                className={`relative w-10 h-8 sm:w-11 sm:h-9 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-md shadow-[var(--theme-ring)] scale-105'
                    : 'bg-slate-100/80 dark:bg-[var(--theme-surface-subtle)]/80 text-slate-600 dark:text-slate-400 group-hover:bg-[var(--theme-primary-light)] group-hover:text-[var(--theme-primary)]'
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-150 ${isActive ? 'scale-105' : ''}`} />

                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-[var(--theme-card-bg)] bg-emerald-400"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] mt-1 tracking-tight leading-tight transition-colors ${
                  isActive
                    ? 'font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]'
                    : 'font-medium text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={onOpenMore}
          aria-label="Menu Lainnya"
          aria-expanded="false"
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[44px] py-1 px-1 rounded-2xl cursor-pointer transition-all duration-150 active:scale-95 motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-primary)] ${
            isMoreActive
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {/* Squircle Container */}
          <div
            className={`relative w-10 h-8 sm:w-11 sm:h-9 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              isMoreActive
                ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-md shadow-[var(--theme-ring)] scale-105'
                : 'bg-slate-100/80 dark:bg-[var(--theme-surface-subtle)]/80 text-slate-600 dark:text-slate-400 group-hover:bg-[var(--theme-primary-light)] group-hover:text-[var(--theme-primary)]'
            }`}
          >
            <LayoutGrid className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-150 ${isMoreActive ? 'scale-105' : ''}`} />
            {isMoreActive && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-[var(--theme-card-bg)] bg-emerald-400"
                aria-hidden="true"
              />
            )}
          </div>

          <span
            className={`text-[10px] mt-1 tracking-tight leading-tight transition-colors ${
              isMoreActive
                ? 'font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]'
                : 'font-medium text-slate-600 dark:text-slate-400'
            }`}
          >
            Lainnya
          </span>
        </button>
      </div>
    </nav>
  );
};
