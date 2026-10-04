import React, { useState, useEffect } from 'react';
import {
  Lock,
  Delete,
  ShieldCheck,
  School,
  AlertCircle,
  KeyRound,
  User,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authService, UserSummaryItem } from '../../services/auth/authService';
import { APP_NAME, APP_SUBTITLE, DEFAULT_SCHOOL_SETTINGS, ROLE_LABELS } from '../../config/constants';
import { Badge } from '../../components/common/Badge';
import { SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';

export const LoginPage: React.FC = () => {
  const { loginWithPin, loginWithGoogle, isLoading } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [usersList, setUsersList] = useState<UserSummaryItem[]>([]);
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dynamic School & App Branding Settings
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    try {
      const cached = localStorage.getItem('piket_guru_school_config');
      if (cached) {
        return { ...DEFAULT_SCHOOL_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SCHOOL_SETTINGS;
  });

  useEffect(() => {
    fetch('/api/auth/public-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setSchoolSettings((prev) => ({ ...prev, ...data.config }));
          try {
            localStorage.setItem('piket_guru_school_config', JSON.stringify(data.config));
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        console.warn('Could not fetch public config:', err);
      });
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await authService.getUsersList();
      setUsersList(users);
      if (users.length > 0) {
        setSelectedIdentifier(users[0].loginId || users[0].nip || users[0].id);
      }
    };
    fetchUsers();
  }, []);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await loginWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk dengan Google.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinInput = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      setErrorMessage('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage('');
  };

  const handleQuickSelect = (identifier: string) => {
    setSelectedIdentifier(identifier);
    setPin('');
    setErrorMessage('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedIdentifier) {
      setErrorMessage('Pilih akun pengguna terlebih dahulu.');
      return;
    }
    if (pin.length !== 6) {
      setErrorMessage('Masukkan 6-digit PIN keamanan Anda.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await loginWithPin(selectedIdentifier, pin);
      if (!res.success) {
        setErrorMessage(res.error || 'Autentikasi gagal.');
        setPin('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto submit when 6 digits are typed
  useEffect(() => {
    if (pin.length === 6 && selectedIdentifier && !isSubmitting) {
      handleSubmit();
    }
  }, [pin]);

  const selectedUser = usersList.find(
    (u) =>
      (u.loginId && u.loginId === selectedIdentifier) ||
      u.nip === selectedIdentifier ||
      u.id === selectedIdentifier ||
      u.userId === selectedIdentifier
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white transition-colors duration-200 relative">
      {/* Top Controls: Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold cursor-pointer active:scale-95"
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* App Card */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 transition-colors duration-200">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          {schoolSettings.logoUrl ? (
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 p-1 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10 border border-slate-200 dark:border-slate-700">
              <img
                src={schoolSettings.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
              <School className="w-8 h-8" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {schoolSettings.appName || APP_NAME}
            </h1>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
              {schoolSettings.appSubtitle || APP_SUBTITLE}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {schoolSettings.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName}
            </p>
          </div>
        </div>

        {/* Google Authentication for Super Admin / Administrator */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-800 dark:text-white font-semibold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Masuk dengan Google (Akun Administrator)</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">Atau Masuk dengan PIN Piket</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>
        </div>

        {/* User Account Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>{usersList.length > 0 ? 'Pilih Pengguna / Petugas Piket:' : 'ID Login / NIP Pengguna:'}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">PIN 6-Digit Terdaftar</span>
          </label>
          {usersList.length > 0 ? (
            <select
              value={selectedIdentifier}
              onChange={(e) => handleQuickSelect(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer transition-colors"
            >
              {usersList.map((u) => {
                const identifierValue = u.loginId || u.nip || u.id;
                return (
                  <option key={u.userId} value={identifierValue} className="text-slate-900 dark:text-white bg-white dark:bg-slate-800">
                    {u.fullName} {u.loginId ? `[${u.loginId}]` : u.nip ? `(NIP: ${u.nip})` : ''} - ({ROLE_LABELS[u.role]})
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={selectedIdentifier}
              onChange={(e) => {
                setSelectedIdentifier(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Contoh: ADMIN-001, GURU-001, atau NIP"
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          )}
        </div>

        {/* Selected User Badge */}
        {selectedUser && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {selectedUser.fullName.charAt(0)}
              </div>
              <div className="truncate max-w-[200px]">
                <div className="text-slate-900 dark:text-white font-bold truncate">{selectedUser.fullName}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {selectedUser.loginId ? `ID: ${selectedUser.loginId}` : ''}
                  {selectedUser.loginId && selectedUser.nip ? ' • ' : ''}
                  {selectedUser.nip ? `NIP: ${selectedUser.nip}` : ''}
                  {!selectedUser.loginId && !selectedUser.nip ? `UID: ${selectedUser.id}` : ''}
                </div>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              {ROLE_LABELS[selectedUser.role]}
            </Badge>
          </div>
        )}

        {/* PIN Indicator Dots */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 py-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > index
                    ? 'bg-blue-600 border-blue-500 scale-110 shadow-sm shadow-blue-500/50'
                    : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Virtual Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isSubmitting || isLoading}
              onClick={() => handlePinInput(num)}
              className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 active:bg-blue-600 active:text-white text-slate-800 dark:text-white text-lg font-bold transition-all duration-100 flex items-center justify-center border border-slate-200 dark:border-slate-700/60 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={handleClear}
            className="h-13 rounded-2xl bg-slate-100/60 hover:bg-slate-200/80 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 active:bg-slate-200 dark:active:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold transition-all flex items-center justify-center border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50"
          >
            HAPUS
          </button>

          <button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={() => handlePinInput('0')}
            className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 active:bg-blue-600 active:text-white text-slate-800 dark:text-white text-lg font-bold transition-all duration-100 flex items-center justify-center border border-slate-200 dark:border-slate-700/60 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-slate-100/60 hover:bg-slate-200/80 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 active:bg-slate-200 dark:active:bg-slate-700 text-slate-600 dark:text-slate-300 text-base font-semibold transition-all flex items-center justify-center border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Creator Footer Notice */}
        <div className="pt-2 text-center text-[11px] text-slate-500 dark:text-slate-500 flex flex-col items-center justify-center gap-1.5 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Otentikasi Aman • Enkripsi Salted SHA-256</span>
          </div>
          {schoolSettings.appCreator ? (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <span>Dikembangkan oleh:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{schoolSettings.appCreator}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
