import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Tv,
  CalendarDays,
  MapPin,
  BookOpenCheck,
  AlertTriangle,
  UserCheck,
  FileText,
  UserX,
  Clock,
  FileBarChart2,
  Users,
  Settings,
  X,
  ChevronRight,
} from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationTab } from '../../types';
import { PERMISSIONS, PermissionKey } from '../../config/permissions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeTab, setActiveTab } = useNavigation();
  const { hasPermission } = useAuth();

  const mainMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    { id: 'command-center', label: 'Pusat Komando & Peta', icon: Radio, permission: PERMISSIONS.COMMAND_CENTER_VIEW, badge: 'Live HUD' },
    { id: 'kiosk', label: 'Mode TV Lobi (Kiosk)', icon: Tv, permission: PERMISSIONS.KIOSK_VIEW, badge: 'Smart TV' },
    { id: 'schedules', label: 'Jadwal Piket', icon: CalendarDays, permission: PERMISSIONS.SCHEDULE_VIEW, badge: 'Hari ini' },
    { id: 'attendance', label: 'Presensi GPS', icon: MapPin, permission: PERMISSIONS.ATTENDANCE_VIEW },
    { id: 'duty-book', label: 'Buku Piket Digital', icon: BookOpenCheck, permission: PERMISSIONS.DUTYBOOK_VIEW },
    { id: 'incidents', label: 'Laporan Kejadian', icon: AlertTriangle, permission: PERMISSIONS.INCIDENT_VIEW },
    { id: 'student-tardiness', label: 'Siswa Terlambat', icon: Clock, permission: PERMISSIONS.STUDENT_TARDY_VIEW },
    { id: 'substitutions', label: 'Guru Inval / Pengganti', icon: UserX, permission: PERMISSIONS.SUBSTITUTIONS_VIEW },
    { id: 'student-permits', label: 'Izin Siswa & Gerbang', icon: FileText, permission: PERMISSIONS.STUDENT_PERMITS_VIEW },
    { id: 'visitors', label: 'Buku Tamu Digital', icon: UserCheck, permission: PERMISSIONS.VISITORS_VIEW },
  ];

  const adminMenuItems: MenuItem[] = [
    { id: 'reports', label: 'Laporan & Rekap', icon: FileBarChart2, permission: PERMISSIONS.REPORTS_VIEW },
    { id: 'users', label: 'Master Pengguna', icon: Users, permission: PERMISSIONS.USERS_VIEW },
    { id: 'settings', label: 'Pengaturan Sekolah', icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
  ];

  const visibleMainItems = mainMenuItems.filter((item) => hasPermission(item.permission));
  const visibleAdminItems = adminMenuItems.filter((item) => hasPermission(item.permission));

  const handleMenuClick = (tab: NavigationTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-[var(--theme-card-bg)] border-r border-slate-200/80 dark:border-[var(--theme-card-border)] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header (Mobile Only for Close Button) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[var(--theme-card-border)] lg:hidden">
          <span className="font-bold text-slate-900 dark:text-white text-base">Menu Navigasi</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Duty Section */}
          {visibleMainItems.length > 0 && (
            <div>
              <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Tugas & Piket
              </div>
              <nav className="space-y-1">
                {visibleMainItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] active:scale-[0.98] ${
                        isActive
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-sm shadow-[var(--theme-ring)]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-[var(--theme-primary-light)] hover:text-[var(--theme-primary-text)] dark:hover:bg-[var(--theme-primary-light)] dark:hover:text-[var(--theme-primary-text)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-white/20 text-inherit'
                              : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-500 dark:text-slate-400 group-hover:bg-white group-hover:text-[var(--theme-primary)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && !isActive && (
                        <span className="text-[10px] bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)] px-1.5 py-0.5 rounded-lg font-bold">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-90" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Management Section */}
          {visibleAdminItems.length > 0 && (
            <div>
              <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Administrasi & Data
              </div>
              <nav className="space-y-1">
                {visibleAdminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] active:scale-[0.98] ${
                        isActive
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-sm shadow-[var(--theme-ring)]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-[var(--theme-primary-light)] hover:text-[var(--theme-primary-text)] dark:hover:bg-[var(--theme-primary-light)] dark:hover:text-[var(--theme-primary-text)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-white/20 text-inherit'
                              : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-500 dark:text-slate-400 group-hover:bg-white group-hover:text-[var(--theme-primary)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-90" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/50 dark:bg-[var(--theme-surface-subtle)]/50">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Piket Guru v1.0.1</span>
            <p className="mt-0.5">Sistem Manajemen Presensi & Buku Piket Digital</p>
          </div>
        </div>
      </aside>
    </>
  );
};
