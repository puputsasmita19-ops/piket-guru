import { NotificationBell } from './NotificationBell';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  ShieldCheck,
  User,
  ChevronDown,
  Menu,
  LogOut,
  KeyRound,
  Bell,
  Check,
  X,
  RotateCcw,
  PanelLeftOpen,
  PanelLeftClose,
} from '../icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useGuide } from '../../contexts/GuideContext';
import { APP_NAME, DEFAULT_SCHOOL_SETTINGS, ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate, formatShortIndonesianDate, formatTimeWithSeconds, formatTimeRaw } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProfileModal } from '../../features/auth/ProfileModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SchoolSettings } from '../../types';
import { OfflineSyncBadge } from './OfflineSyncBadge';
import { GuideHelpButton } from './GuideHelpButton';
import { UnsavedOfflineWarningModal } from '../common/UnsavedOfflineWarningModal';
import { OfflineStorage } from '../../services/offline/offlineStorage';
import { Tooltip } from '../common/Tooltip';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isDesktopSidebarHidden?: boolean;
  onToggleDesktopSidebar?: () => void;
}

type HeaderPanel = 'none' | 'sync' | 'guide' | 'notifications' | 'theme' | 'user';

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isDesktopSidebarHidden = false,
  onToggleDesktopSidebar,
}) => {
  const { theme, setTheme, pastelTheme, setPastelTheme, isDark, pastelThemesList } = useTheme();
  const { currentUser, logout } = useAuth();
  const { activeTab, subView } = useNavigation();
  const { isGuideMenuOpen, openGuideMenu, closeGuideMenu } = useGuide();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [appName, setAppName] = useState(DEFAULT_SCHOOL_SETTINGS.appName || APP_NAME);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_SCHOOL_SETTINGS.logoUrl || '');

  const [activePanel, setActivePanel] = useState<HeaderPanel>('none');

  const handleTogglePanel = (panel: HeaderPanel) => {
    if (activePanel === panel) {
      setActivePanel('none');
      if (panel === 'guide') closeGuideMenu();
    } else {
      setActivePanel(panel);
      if (panel === 'guide') {
        openGuideMenu();
      } else {
        closeGuideMenu();
      }
    }
  };

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [unsavedCounts, setUnsavedCounts] = useState({ pending: 0, drafts: 0 });

  const handleInitiateLogout = async () => {
    setActivePanel('none');
    if (!currentUser?.id) {
      await logout();
      return;
    }
    try {
      const queueItems = await OfflineStorage.getSyncItemsByUser(currentUser.id);
      const drafts = await OfflineStorage.listDraftsByUser(currentUser.id);
      const pending = queueItems.filter((i) => i.status === 'PENDING_NETWORK' || i.status === 'NEEDS_ACTION').length;
      if (pending > 0 || drafts.length > 0) {
        setUnsavedCounts({ pending, drafts: drafts.length });
        setShowLogoutWarning(true);
      } else {
        await logout();
      }
    } catch {
      await logout();
    }
  };

  const handleConfirmLogout = async (purgeUserData: boolean) => {
    setShowLogoutWarning(false);
    await logout({ purgeUserData });
  };

  const [notificationConfig, setNotificationConfig] = useState<SchoolSettings['notificationConfig']>();

  const previousNavigationRef = useRef({ activeTab, subView });

  // Automatically close panels ONLY when activeTab or subView actually changes
  useEffect(() => {
    const previous = previousNavigationRef.current;

    // Perubahan context atau render ulang bukan pergantian halaman.
    if (
      previous.activeTab === activeTab &&
      previous.subView === subView
    ) {
      return;
    }

    previousNavigationRef.current = { activeTab, subView };

    setActivePanel('none');
    closeGuideMenu();
  }, [activeTab, subView, closeGuideMenu]);

  // Handle global escape key to close popups
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePanel('none');
        closeGuideMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeGuideMenu]);

  // Sync online/offline network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = FirestoreService.subscribeToDocument<SchoolSettings>(
      'settings',
      'school_config',
      (config) => {
        setNotificationConfig(config?.notificationConfig);
        if (config) {
          if (config.schoolName) {
            setSchoolName(config.schoolName);
          }
          if (config.appName) {
            setAppName(config.appName);
          }
          if (config.logoUrl !== undefined) {
            setLogoUrl(config.logoUrl);
          }
        }
      }
    );
    return () => unsub();
  }, []);

  return (
    <>
      <header
        className="app-topbar shrink-0 sticky top-0 z-40 border-b border-slate-200/80 dark:border-[var(--theme-card-border)] transition-colors"
        style={{ backgroundColor: 'var(--theme-header-bg)' }}
      >
        <div className="app-header-inner max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4 w-full">
            {/* Left Section: Mobile Menu + Date/Time (Mobile) OR Sidebar Toggle + App Identity (Desktop) */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink-0 lg:max-w-[35%]">
              {/* Mobile Sidebar Trigger */}
              <Tooltip content="Buka menu navigasi utama" position="bottom">
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="hidden min-[400px]:flex lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95"
                  aria-label="Buka Menu Navigasi"
                  title="Buka Menu Navigasi"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </Tooltip>

              {/* Desktop Sidebar Hide/Show Toggle */}
              {onToggleDesktopSidebar && (
                <Tooltip content={isDesktopSidebarHidden ? "Tampilkan panel menu navigasi" : "Sembunyikan panel menu navigasi"} position="bottom">
                  <button
                    type="button"
                    onClick={onToggleDesktopSidebar}
                    className={`hidden lg:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95 ${
                      isDesktopSidebarHidden
                        ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-semibold'
                        : ''
                    }`}
                    aria-label={isDesktopSidebarHidden ? 'Tampilkan panel menu (Ctrl+B)' : 'Sembunyikan panel menu (Ctrl+B)'}
                    title={isDesktopSidebarHidden ? 'Tampilkan panel menu' : 'Sembunyikan panel menu'}
                  >
                    {isDesktopSidebarHidden ? (
                      <PanelLeftOpen className="w-5 h-5 text-[var(--theme-primary)]" />
                    ) : (
                      <PanelLeftClose className="w-5 h-5" />
                    )}
                  </button>
                </Tooltip>
              )}

              {/* Realtime Date & Time Block on Mobile (< sm) */}
              <div className="lg:hidden flex flex-col justify-center leading-tight select-none font-mono tabular-nums text-left shrink-0">
                <span className="text-[10px] min-[360px]:text-[11px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">
                  <span className="inline min-[360px]:hidden">{`${String(currentTime.getDate()).padStart(2, '0')}/${String(currentTime.getMonth() + 1).padStart(2, '0')}/${currentTime.getFullYear()}`}</span>
                  <span className="hidden min-[360px]:inline">{formatShortIndonesianDate(currentTime)}</span>
                </span>
                <span className="text-[11px] min-[360px]:text-[12px] font-extrabold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] tracking-wider whitespace-nowrap">
                  {formatTimeRaw(currentTime)}
                </span>
              </div>

              {/* App Identity on Desktop (>= sm) */}
              <div className="hidden lg:flex items-center gap-2 sm:gap-3 min-w-0">
                {logoUrl ? (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[var(--theme-card-bg)] p-0.5 flex items-center justify-center shadow-md shadow-[var(--theme-ring)] border border-slate-200 dark:border-[var(--theme-card-border)] shrink-0">
                    <img src={logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain rounded-lg" />
                  </div>
                ) : (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center shadow-md shadow-[var(--theme-ring)] font-bold text-base sm:text-lg shrink-0">
                    P
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-sm sm:text-lg truncate min-w-0">
                      {appName}
                    </span>
                    <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]/50 shrink-0">
                      v1.0.1
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px] sm:max-w-xs leading-tight">
                    {schoolName}
                  </p>
                </div>
              </div>
            </div>

            {/* Center Section: Realtime Date & Time on Desktop (>= sm) */}
            <div className="hidden lg:flex flex-col items-center justify-center px-1 sm:px-4 shrink-0 text-center select-none font-mono tabular-nums">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {formatIndonesianDate(currentTime)}
              </div>
              <div className="text-[11px] font-mono text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-bold tracking-wide">
                {formatTimeWithSeconds(currentTime)}
              </div>
            </div>

            {/* Right Section: Icons, Profile & Logout */}
            <div className="app-header-actions flex items-center justify-end gap-0 min-[400px]:gap-1 sm:gap-1.5 md:gap-2 min-w-0 flex-1 lg:flex-none">
              {/* Shared Transparent Backdrop (Below Header z-40, Non-blurring, Header items stay 100% interactive) */}
              {activePanel !== 'none' && (
                <div
                  className="fixed inset-0 z-30 bg-transparent"
                  onClick={() => {
                    setActivePanel('none');
                    closeGuideMenu();
                  }}
                  aria-hidden="true"
                />
              )}

              {/* 1. Offline Sync & Connection Status Button */}
              <OfflineSyncBadge
                isOpen={activePanel === 'sync'}
                onToggle={() => handleTogglePanel('sync')}
                onClose={() => setActivePanel('none')}
              />

              {/* 2. Guide Help Button (Icon Bantuan ?) */}
              <GuideHelpButton
                isOpen={activePanel === 'guide'}
                onToggle={() => handleTogglePanel('guide')}
                onClose={() => {
                  setActivePanel('none');
                  closeGuideMenu();
                }}
              />

              <NotificationBell isOpen={activePanel === 'notifications'} onToggle={() => handleTogglePanel('notifications')} onClose={() => setActivePanel('none')} config={notificationConfig} />

              {/* 4. Pengaturan Tampilan & Warna Tema Button */}
              <div className="relative">
                <Tooltip content="Pengaturan mode tampilan & warna tema" position="bottom">
                  <button
                    type="button"
                    onClick={() => handleTogglePanel('theme')}
                    className={`p-2 sm:p-2.5 rounded-xl transition-colors relative cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95 shrink-0 ${
                      activePanel === 'theme'
                        ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-bold ring-2 ring-[var(--theme-primary-border)]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)]'
                    }`}
                    title="Pengaturan Tampilan & Warna Tema"
                    aria-label="Pengaturan Tampilan dan Warna Tema"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    )}
                  </button>
                </Tooltip>

                {activePanel === 'theme' && (
                  <div
                    role="dialog"
                    aria-label="Pengaturan Tampilan dan Warna Tema"
                    onClick={(e) => e.stopPropagation()}
                    className="fixed top-16 left-3.5 right-3.5 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 w-auto sm:w-[320px] max-w-[calc(100vw-28px)] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-[var(--theme-card-border)] z-50 animate-in fade-in zoom-in-95 duration-150 p-3.5 sm:p-4 text-xs font-medium"
                  >
                    {/* Title Bar */}
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-[var(--theme-card-border)]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary)] flex items-center justify-center font-bold shrink-0">
                          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                            Pengaturan Tampilan
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Pilih mode & skema warna antarmuka
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePanel('none')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-hover)] transition-colors cursor-pointer shrink-0"
                        aria-label="Tutup Menu Tampilan"
                        title="Tutup (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bagian 1: Mode Tampilan */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-0.5">
                        Mode Tampilan
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                            theme === 'light'
                              ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] shadow-xs'
                              : 'border-slate-200/80 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Terang</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                            theme === 'dark'
                              ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] shadow-xs'
                              : 'border-slate-200/80 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Gelap</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme('system')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                            theme === 'system'
                              ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] shadow-xs'
                              : 'border-slate-200/80 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Sistem</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-[var(--theme-card-border)] my-3" />

                    {/* Bagian 2: Warna Tema */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-0.5">
                        <span>Warna Tema</span>
                        <span className="text-[10px] text-[var(--theme-primary-text)] font-semibold normal-case truncate max-w-[120px]">
                          {pastelThemesList.find((p) => p.id === pastelTheme)?.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pastelThemesList.map((item) => {
                          const isSelected = pastelTheme === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setPastelTheme(item.id)}
                              className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left active:scale-95 ${
                                isSelected
                                  ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] font-bold shadow-xs'
                                  : 'border-slate-200/80 dark:border-[var(--theme-card-border)] text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-[var(--theme-surface-subtle)]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded-full border border-black/15 dark:border-white/25 shadow-xs shrink-0"
                                  style={{ backgroundColor: item.primaryColor }}
                                />
                                <span className="text-xs font-semibold truncate">
                                  {item.name.replace('Tema ', '')}
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. User name & profile dropdown */}
              {currentUser && (
                <div className="relative min-w-0 shrink">
                  <button
                    type="button"
                    onClick={() => handleTogglePanel('user')}
                    className={`max-w-full flex items-center justify-center gap-1.5 p-1 xs:p-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] active:scale-95 ${
                      activePanel === 'user'
                        ? 'bg-[var(--theme-primary-light)] ring-2 ring-[var(--theme-primary-border)]'
                        : 'hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)]'
                    }`}
                    aria-label="Menu Pengguna & Profil"
                    title="Menu Pengguna & Profil"
                  >
                    <div className="min-w-0 text-left">
                      <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white truncate max-w-[72px] sm:max-w-[120px]">
                        {(currentUser.fullName.trim().split(/\s+/)[0] || 'Pengguna').toLocaleUpperCase('id-ID')}
                      </div>
                      <div className="hidden lg:block text-[10px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-medium">
                        {ROLE_LABELS[currentUser.role]}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
                  </button>

                  {activePanel === 'user' && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="fixed top-16 right-3.5 left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 w-[calc(100vw-28px)] sm:w-64 max-w-[280px] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-[var(--theme-card-border)] p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="border-b border-slate-100 dark:border-[var(--theme-card-border)] pb-2.5 mb-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {currentUser.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          NIP: {currentUser.nip}
                        </p>
                        <div className="mt-1.5">
                          <Badge variant="primary" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                            {ROLE_LABELS[currentUser.role]}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePanel('none');
                            setIsProfileOpen(true);
                          }}
                          className="w-full text-left px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] rounded-lg flex items-center gap-2 cursor-pointer font-medium transition-colors"
                        >
                          <User className="w-4 h-4 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]" /> Profil & Ganti PIN
                        </button>
                        <button
                          type="button"
                          onClick={handleInitiateLogout}
                          className="w-full text-left px-2.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg font-medium cursor-pointer flex items-center gap-2 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Keluar Sesi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Profile & PIN Management Dialog */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Warning Dialog when logging out with unsynced drafts / queue items */}
      <UnsavedOfflineWarningModal
        isOpen={showLogoutWarning}
        onClose={() => setShowLogoutWarning(false)}
        pendingCount={unsavedCounts.pending}
        draftsCount={unsavedCounts.drafts}
        onConfirmLogout={handleConfirmLogout}
      />
    </>
  );
};
