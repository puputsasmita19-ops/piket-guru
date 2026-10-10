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
  Pin,
  PinOff,
  PanelLeftClose,
} from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationTab } from '../../types';
import { PERMISSIONS, PermissionKey } from '../../config/permissions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktopHidden?: boolean;
  onToggleDesktopHide?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

interface MenuItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isDesktopHidden = false,
  onToggleDesktopHide,
  isPinned = true,
  onTogglePin,
}) => {
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
        aria-label="Panel Navigasi Aplikasi"
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-[var(--theme-card-bg)] border-r border-slate-200/80 dark:border-[var(--theme-card-border)] flex flex-col transition-all duration-200 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDesktopHidden
            ? 'lg:-translate-x-full lg:w-0 lg:border-r-0 lg:overflow-hidden lg:invisible lg:p-0'
            : 'lg:translate-x-0 lg:w-64 lg:visible'
        } ${
          isPinned
            ? 'lg:relative lg:top-0 lg:bottom-auto lg:h-full lg:z-10'
            : 'lg:relative lg:top-0 lg:bottom-auto lg:h-auto lg:min-h-[calc(100vh-4rem)] lg:z-0'
        }`}
      >
        {/* Sidebar Controls Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/70 dark:bg-[var(--theme-surface-subtle)]/70 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-tight">
              Panel Navigasi
            </span>
            {isPinned && !isDesktopHidden && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-md">
                Tersemat
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Pin / Unpin (Freeze) Button */}
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className={`hidden lg:flex p-1.5 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
                  isPinned
                    ? 'text-[var(--theme-primary)] bg-[var(--theme-primary-light)] font-bold'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[var(--theme-surface-subtle)]'
                }`}
                aria-label={isPinned ? 'Lepas sematan menu (Menu ikut tergulir)' : 'Sematkan menu (Freeze menu tetap di posisi)'}
                title={isPinned ? 'Lepas sematan menu (Lepas Freeze)' : 'Sematkan menu (Freeze / Diam saat digulir)'}
              >
                {isPinned ? (
                  <Pin className="w-4 h-4 fill-current rotate-45" />
                ) : (
                  <PinOff className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Desktop Hide Button */}
            {onToggleDesktopHide && (
              <button
                type="button"
                onClick={onToggleDesktopHide}
                className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[36px] min-h-[36px] items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                aria-label="Sembunyikan panel menu (Ctrl+B)"
                title="Sembunyikan panel menu"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
              aria-label="Tutup panel navigasi"
              title="Tutup panel navigasi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-6">
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
        <div className="p-4 border-t border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/50 dark:bg-[var(--theme-surface-subtle)]/50 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Piket Guru v1.0.1</span>
            <p className="mt-0.5">Sistem Manajemen Presensi & Buku Piket Digital</p>
          </div>
        </div>
      </aside>
    </>
  );
};
