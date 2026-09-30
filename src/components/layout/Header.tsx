import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Wifi,
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
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME, DEFAULT_SCHOOL_SETTINGS, ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProfileModal } from '../../features/auth/ProfileModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { SchoolSettings } from '../../types';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { theme, setTheme, isDark } = useTheme();
  const { currentUser, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
        if (config && config.schoolName) {
          setSchoolName(config.schoolName);
        }
      }
    );
    return () => unsub();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between px-3 sm:px-6 h-16">
          {/* Left Side: Logo & School Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-lg">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-base sm:text-lg">
                    {APP_NAME}
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[160px] sm:max-w-xs">
                  {schoolName}
                </p>
              </div>
            </div>
          </div>

          {/* Center: Live Date & Time (Desktop) */}
          <div className="hidden md:flex flex-col items-center">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {formatIndonesianDate(currentTime)}
            </div>
            <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold tracking-wide">
              {formatTime(currentTime)}
            </div>
          </div>

          {/* Right Side: Network Status, Notifications, Theme Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Status Online Realtime Indicator */}
            <div className="hidden sm:flex items-center">
              <Badge variant="success" size="sm" icon={<Wifi className="w-3 h-3" />}>
                Online
              </Badge>
            </div>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
                title="Pusat Notifikasi & Bel Sekolah"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in duration-100 text-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-blue-600" />
                        Pusat Siaran & Notifikasi
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                        Sistem Aktif
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                          <Clock className="w-3 h-3 text-blue-500" />
                          Bel Sekolah Digital Siaga
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Jadwal bel masuk, jeda istirahat, dan kepulangan aktif tersinkronisasi.
                        </p>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          Geofence & Keamanan Siber
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Radius kehadiran guru terkunci; seluruh aksi tercatat pada audit trail.
                        </p>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Snapshot & Pemulihan Bencana
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Titik cadangan siap digunakan untuk 1-click disaster recovery.
                        </p>
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
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Ganti Tema"
              >
                {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </button>

              {showThemeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                  <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-xs font-medium">
                    <button
                      onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                        theme === 'light' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" /> Terang
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                        theme === 'dark' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-indigo-400" /> Gelap
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                        theme === 'system' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5 text-slate-500" /> Sistem
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Mini Card */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                      {currentUser.fullName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      {ROLE_LABELS[currentUser.role]}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in duration-100">
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {currentUser.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          NIP: {currentUser.nip}
                        </p>
                        <div className="mt-1.5">
                          <Badge variant="primary" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
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
                          className="w-full text-left px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Profil & Ganti PIN
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
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
    </>
  );
};
