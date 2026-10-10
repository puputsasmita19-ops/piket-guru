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
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  Check,
  X,
  RotateCcw,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { APP_NAME, DEFAULT_SCHOOL_SETTINGS, ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate, formatTimeWithSeconds } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProfileModal } from '../../features/auth/ProfileModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SchoolBellService } from '../../services/audio/bellService';
import { SchoolSettings } from '../../types';
import { OfflineSyncBadge } from './OfflineSyncBadge';
import { UnsavedOfflineWarningModal } from '../common/UnsavedOfflineWarningModal';
import { OfflineStorage } from '../../services/offline/offlineStorage';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isDesktopSidebarHidden?: boolean;
  onToggleDesktopSidebar?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: 'BELL' | 'SECURITY' | 'BACKUP';
  time: string;
  isRead: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Bel Sekolah Digital Siaga',
    description: 'Jadwal bel masuk, jeda istirahat, dan kepulangan aktif tersinkronisasi.',
    category: 'BELL',
    time: 'Hari ini',
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'Geofence & Keamanan Siber',
    description: 'Radius kehadiran guru terkunci; seluruh aksi tercatat pada audit trail.',
    category: 'SECURITY',
    time: 'Hari ini',
    isRead: false,
  },
  {
    id: 'notif-3',
    title: 'Snapshot & Pemulihan Bencana',
    description: 'Titik cadangan siap digunakan untuk 1-click disaster recovery.',
    category: 'BACKUP',
    time: 'Hari ini',
    isRead: false,
  },
];

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isDesktopSidebarHidden = false,
  onToggleDesktopSidebar,
}) => {
  const { theme, setTheme, pastelTheme, setPastelTheme, isDark, pastelThemesList } = useTheme();
  const { currentUser, logout } = useAuth();
  const { activeTab, subView } = useNavigation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [appName, setAppName] = useState(DEFAULT_SCHOOL_SETTINGS.appName || APP_NAME);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_SCHOOL_SETTINGS.logoUrl || '');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [unsavedCounts, setUnsavedCounts] = useState({ pending: 0, drafts: 0 });

  const handleInitiateLogout = async () => {
    setShowUserMenu(false);
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

  // Automatically close notifications and menus whenever user navigates or activeTab/subView changes
  useEffect(() => {
    setShowNotifications(false);
    setShowThemeMenu(false);
    setShowUserMenu(false);
  }, [activeTab, subView]);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const stored = localStorage.getItem('piket_notifications_list');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return DEFAULT_NOTIFICATIONS;
  });

  const [isPlayingBell, setIsPlayingBell] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnreadNotif = unreadCount > 0;

  // Handle global escape key to close popups
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowThemeMenu(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const saveNotifications = (items: NotificationItem[]) => {
    setNotifications(items);
    try {
      localStorage.setItem('piket_notifications_list', JSON.stringify(items));
    } catch {}
  };

  const handleMarkNotificationsAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    saveNotifications(updated);
  };

  const handleToggleSingleNotifRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, isRead: !n.isRead } : n
    );
    saveNotifications(updated);
  };

  const handleTestSchoolBell = () => {
    setIsPlayingBell(true);
    SchoolBellService.playSchoolBell();
    setTimeout(() => {
      setIsPlayingBell(false);
    }, 2800);
  };

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
        className="shrink-0 sticky top-0 z-30 backdrop-blur-md border-b border-slate-200/80 dark:border-[var(--theme-card-border)] transition-colors"
        style={{ backgroundColor: 'var(--theme-header-bg)' }}
      >
        <div className="flex items-center justify-between px-2.5 sm:px-6 h-16">
          {/* Left Side: Logo & School Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2 sm:mr-3">
            {/* Mobile Sidebar Trigger */}
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
              aria-label="Buka Menu Navigasi"
              title="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Hide/Show Toggle */}
            {onToggleDesktopSidebar && (
              <button
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
            )}

            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0 flex-1">
              {logoUrl ? (
                <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[var(--theme-card-bg)] p-0.5 flex items-center justify-center shadow-md shadow-[var(--theme-ring)] border border-slate-200 dark:border-[var(--theme-card-border)] shrink-0">
                  <img src={logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain rounded-lg" />
                </div>
              ) : (
                <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center shadow-md shadow-[var(--theme-ring)] font-bold text-xs xs:text-base sm:text-lg shrink-0">
                  P
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-xs xs:text-sm sm:text-lg whitespace-nowrap shrink-0">
                    {appName}
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]/50 shrink-0">
                    v1.0.1
                  </span>
                </div>
                <p className="text-[9px] xs:text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[120px] xs:max-w-[170px] sm:max-w-xs leading-tight">
                  {schoolName}
                </p>
              </div>
            </div>
          </div>

          {/* Center: Live Date & Time (Desktop) */}
          <div className="hidden md:flex flex-col items-center shrink-0 px-2">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {formatIndonesianDate(currentTime)}
            </div>
            <div className="text-[11px] font-mono text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-bold tracking-wide">
              {formatTimeWithSeconds(currentTime)}
            </div>
          </div>

          {/* Right Side: Connection Status, Notifications, Theme Switcher & User Profile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Offline Sync & Connection Status Button */}
            <OfflineSyncBadge />

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors relative cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                title="Pusat Notifikasi & Bel Sekolah"
                aria-label="Pusat Notifikasi dan Bel Sekolah"
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotif && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--theme-primary)] ring-2 ring-white dark:ring-[var(--theme-card-bg)] animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[0.5px] sm:bg-transparent"
                    onClick={() => setShowNotifications(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="dialog"
                    aria-label="Pusat Siaran dan Notifikasi"
                    className="fixed top-16 left-3.5 right-3.5 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 w-auto sm:w-[420px] max-w-[calc(100vw-28px)] bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-[var(--theme-card-border)] z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[min(580px,calc(100vh-5rem))] overflow-hidden"
                  >
                    {/* Header Panel */}
                    <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/70 dark:bg-[var(--theme-surface-subtle)] shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary)] flex items-center justify-center shrink-0 border border-[var(--theme-primary-border)]/50">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                Pusat Siaran & Notifikasi
                              </h3>
                              {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--theme-primary)] text-white shrink-0">
                                  {unreadCount} Baru
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              Pemberitahuan & kontrol siaran bel sekolah
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[var(--theme-surface-hover)] transition-colors cursor-pointer shrink-0"
                          aria-label="Tutup Pusat Notifikasi"
                          title="Tutup (Esc)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Action & Status Subheader */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60 dark:border-[var(--theme-card-border)] text-xs gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua notifikasi dibaca'}
                        </span>
                        {hasUnreadNotif ? (
                          <button
                            type="button"
                            onClick={handleMarkNotificationsAsRead}
                            className="text-[11px] font-bold text-[var(--theme-primary-text)] hover:underline flex items-center gap-1 cursor-pointer bg-[var(--theme-primary-light)] px-2.5 py-1 rounded-lg border border-[var(--theme-primary-border)] active:scale-95 transition-all shrink-0"
                            title="Tandai seluruh notifikasi sudah dibaca"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tandai Semua Dibaca
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Semua Dibaca
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
                      {/* Bell School Quick Test Action */}
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-[var(--theme-primary-light)]/70 via-slate-50 to-[var(--theme-primary-light)]/30 dark:from-[var(--theme-primary-light)]/15 dark:via-slate-800/40 dark:to-slate-800/20 border border-[var(--theme-primary-border)]/70 dark:border-slate-700/60 shadow-xs flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[var(--theme-primary)] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 xs:mt-0">
                            <Volume2 className={`w-4 h-4 ${isPlayingBell ? 'animate-bounce' : ''}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <span>Uji Nada Bel Sekolah</span>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" title="Sistem Bel Siap" />
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 break-words whitespace-normal">
                              Simulasi nada Westminster Quarters 4-fase
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestSchoolBell}
                          disabled={isPlayingBell}
                          className="w-full xs:w-auto px-3.5 py-2 text-xs font-bold bg-[var(--theme-primary)] hover:brightness-95 active:brightness-90 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs active:scale-95 disabled:opacity-75"
                          title="Putar nada bel sekolah sekarang"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isPlayingBell ? 'animate-spin' : ''}`} />
                          <span>{isPlayingBell ? 'Memutar Bel...' : 'Putar Bel'}</span>
                        </button>
                      </div>

                      {/* Notifications List */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                          <span>Daftar Pemberitahuan</span>
                          <span>{notifications.length} Info</span>
                        </div>

                        {notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 rounded-2xl border transition-all ${
                              notif.isRead
                                ? 'bg-slate-50/70 dark:bg-[var(--theme-surface-subtle)]/30 border-slate-200/60 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400'
                                : 'bg-[var(--theme-primary-light)]/40 dark:bg-[var(--theme-primary-light)]/15 border-[var(--theme-primary-border)] dark:border-[var(--theme-primary)]/40 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Category Icon */}
                              <div
                                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                                  notif.category === 'BELL'
                                    ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]'
                                    : notif.category === 'SECURITY'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                                }`}
                              >
                                {notif.category === 'BELL' && <Clock className="w-4 h-4" />}
                                {notif.category === 'SECURITY' && <ShieldCheck className="w-4 h-4" />}
                                {notif.category === 'BACKUP' && <Sparkles className="w-4 h-4" />}
                              </div>

                              {/* Notification Text and Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className={`font-bold text-xs leading-snug break-words ${
                                      notif.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'
                                    }`}>
                                      {notif.title}
                                    </span>
                                    {!notif.isRead && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[var(--theme-primary)] text-white shrink-0">
                                        Baru
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">
                                    {notif.time}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-300/90 mt-1 leading-relaxed break-words whitespace-normal">
                                  {notif.description}
                                </p>

                                {/* Action Bar */}
                                <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-[var(--theme-card-border)] flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                                    {notif.isRead ? 'Status: Sudah dibaca' : 'Status: Belum dibaca'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSingleNotifRead(notif.id)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                      notif.isRead
                                        ? 'text-slate-600 dark:text-slate-300 hover:text-[var(--theme-primary-text)] hover:bg-slate-200/50 dark:hover:bg-[var(--theme-surface-subtle)]'
                                        : 'text-[var(--theme-primary-text)] bg-white dark:bg-[var(--theme-card-bg)] border border-[var(--theme-primary-border)] hover:brightness-95 shadow-xs font-bold'
                                    }`}
                                    title={notif.isRead ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'}
                                  >
                                    {notif.isRead ? (
                                      <>
                                        <RotateCcw className="w-3 h-3 text-slate-400" />
                                        <span>Tandai Belum Dibaca</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3 text-[var(--theme-primary)]" />
                                        <span>Tandai Dibaca</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Theme Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                title="Ganti Tema & Warna"
                aria-label="Pengaturan Tema & Warna"
              >
                {isDark ? <Moon className="w-4 h-4 text-[var(--theme-primary)]" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </button>

              {showThemeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-xl border border-slate-200 dark:border-[var(--theme-card-border)] p-2.5 z-50 text-xs font-medium animate-in fade-in duration-100">
                    {/* Mode Section */}
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Mode Tampilan
                    </div>
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                          theme === 'light'
                            ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] font-bold'
                            : 'border-slate-100 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500 mb-0.5" />
                        <span className="text-[10px]">Terang</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] font-bold'
                            : 'border-slate-100 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-indigo-400 mb-0.5" />
                        <span className="text-[10px]">Gelap</span>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                          theme === 'system'
                            ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)] font-bold'
                            : 'border-slate-100 dark:border-[var(--theme-card-border)] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5 text-slate-500 mb-0.5" />
                        <span className="text-[10px]">Sistem</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-[var(--theme-card-border)] my-1.5" />

                    {/* Pastel Theme Section */}
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Warna Pastel</span>
                      <span className="text-[9px] text-[var(--theme-primary-text)] font-semibold">
                        {pastelThemesList.find((p) => p.id === pastelTheme)?.name}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                      {pastelThemesList.map((item) => {
                        const isSelected = pastelTheme === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setPastelTheme(item.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-bold border border-[var(--theme-primary-border)]'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0"
                                style={{ backgroundColor: item.primaryColor }}
                              />
                              <span className="text-xs truncate">{item.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Mini Card */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center justify-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                  aria-label="Menu Pengguna & Profil"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden shrink-0">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                      {currentUser.fullName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-medium">
                      {ROLE_LABELS[currentUser.role]}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-xl border border-slate-200 dark:border-[var(--theme-card-border)] p-3 z-50 animate-in fade-in duration-100">
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
                          onClick={() => {
                            setShowUserMenu(false);
                            setIsProfileOpen(true);
                          }}
                          className="w-full text-left px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <User className="w-4 h-4 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]" /> Profil & Ganti PIN
                        </button>
                        <button
                          onClick={handleInitiateLogout}
                          className="w-full text-left px-2.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg font-medium cursor-pointer flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" /> Keluar Sesi
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
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
