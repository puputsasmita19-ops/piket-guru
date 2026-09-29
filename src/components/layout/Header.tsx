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
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME, DEFAULT_SCHOOL_SETTINGS, ROLE_LABELS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProfileModal } from '../../features/auth/ProfileModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { theme, setTheme, isDark } = useTheme();
  const { currentUser, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
                  {DEFAULT_SCHOOL_SETTINGS.schoolName}
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

          {/* Right Side: Network Status, Theme Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Status Online Realtime Indicator */}
            <div className="hidden sm:flex items-center">
              <Badge variant="success" size="sm" icon={<Wifi className="w-3 h-3" />}>
                Online
              </Badge>
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
