import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  BookOpenCheck,
  MoreHorizontal,
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 lg:hidden shadow-lg pb-safe">
      <div
        className="grid h-16 max-w-lg mx-auto items-center px-1"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-1.5 transition-colors cursor-pointer ${
            isMoreActive
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isMoreActive ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
            <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Lainnya</span>
        </button>
      </div>
    </nav>
  );
};
