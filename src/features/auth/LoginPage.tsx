import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Lock,
  Delete,
  School,
  AlertCircle,
  KeyRound,
  User,
  Sun,
  Moon,
  Search,
  ChevronDown,
  Check,
  X,
  Edit3,
  Palette,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  LogIn,
  HelpCircle,
  Phone,
  Mail,
  ExternalLink,
  ShieldAlert,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authService, UserSummaryItem } from '../../services/auth/authService';
import { APP_NAME, APP_SUBTITLE, DEFAULT_SCHOOL_SETTINGS, DEFAULT_LOGIN_SUPPORT_CONTACT, ROLE_LABELS } from '../../config/constants';
import { SchoolSettings, LoginContactType } from '../../types';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const LoginPage: React.FC = () => {
  const { loginWithPin, loginWithGoogle, isLoading, isTrustedDevice, setTrustedDevice } = useAuth();
  const {
    theme,
    setTheme,
    pastelTheme,
    setPastelTheme,
    isDark,
    pastelThemesList,
  } = useTheme();

  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [usersList, setUsersList] = useState<UserSummaryItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>('');
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [isContactAdminModalOpen, setIsContactAdminModalOpen] = useState<boolean>(false);

  // Real-time Indonesian date and time clock
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Combobox Search & Keyboard Nav State
  const [isComboboxOpen, setIsComboboxOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);

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
      setIsLoadingUsers(true);
      try {
        const users = await authService.getUsersList();
        setUsersList(users);
        if (users.length > 0 && !selectedIdentifier) {
          setSelectedIdentifier(users[0].loginId || users[0].nip || users[0].id);
        }
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Filter users by search query (case-insensitive & trimmed)
  const filteredUsers = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return usersList;

    return usersList.filter((u) => {
      const nameMatch = u.fullName.toLowerCase().includes(cleanQuery);
      const loginIdMatch = u.loginId?.toLowerCase().includes(cleanQuery);
      const nipMatch = u.nip?.toLowerCase().includes(cleanQuery);
      const nuptkMatch = u.nuptk?.toLowerCase().includes(cleanQuery);
      const roleLabel = ROLE_LABELS[u.role]?.toLowerCase() || '';
      const roleMatch = roleLabel.includes(cleanQuery) || u.role.toLowerCase().includes(cleanQuery);

      return nameMatch || loginIdMatch || nipMatch || nuptkMatch || roleMatch;
    });
  }, [usersList, searchQuery]);

  // Click outside to close combobox and theme picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
      if (themePickerRef.current && !themePickerRef.current.contains(event.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input on combobox open
  useEffect(() => {
    if (isComboboxOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isComboboxOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isComboboxOpen && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isComboboxOpen]);

  const handleGoogleLogin = async () => {
    if (isGoogleSubmitting || isSubmitting || isLoading) return;
    setIsGoogleSubmitting(true);
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await loginWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk dengan Google.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsGoogleSubmitting(false);
      setIsSubmitting(false);
    }
  };

  const handlePinInput = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      if (errorMessage) {
        setErrorMessage('');
        setHasError(false);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    if (errorMessage) {
      setErrorMessage('');
      setHasError(false);
    }
  };

  const handleClear = () => {
    setPin('');
    if (errorMessage) {
      setErrorMessage('');
      setHasError(false);
    }
  };

  const handleSelectUser = (user: UserSummaryItem) => {
    const identifier = user.loginId || user.nip || user.id;
    setSelectedIdentifier(identifier);
    setPin('');
    setErrorMessage('');
    setHasError(false);
    setIsComboboxOpen(false);
  };

  const handleComboboxKeyDown = (e: React.KeyboardEvent) => {
    if (!isComboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsComboboxOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredUsers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredUsers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredUsers.length > 0 && filteredUsers[highlightedIndex]) {
        handleSelectUser(filteredUsers[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsComboboxOpen(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isLoading) return;

    if (!selectedIdentifier.trim()) {
      setErrorMessage('Pilih akun pengguna atau masukkan ID login terlebih dahulu.');
      setHasError(false);
      return;
    }
    if (!pin.trim()) {
      setErrorMessage('Masukkan PIN terlebih dahulu.');
      setHasError(true);
      return;
    }
    if (pin.length !== 6) {
      setErrorMessage('Masukkan 6-digit PIN keamanan Anda.');
      setHasError(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setHasError(false);
    try {
      const res = await loginWithPin(selectedIdentifier, pin);
      if (!res.success) {
        const rawErr = (res.error || '').trim();
        let displayMsg = 'PIN salah. Silakan coba lagi.';
        let isCredentialError = false;

        // Distinguish network/connection failures
        if (
          rawErr.includes('koneksi') ||
          rawErr.includes('terhubung') ||
          rawErr.includes('network') ||
          rawErr.includes('Failed to fetch') ||
          rawErr.includes('NetworkError')
        ) {
          displayMsg = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';
        }
        // Distinguish rate limit / lockout / excessive attempts
        else if (
          res.isLocked ||
          (res.remainingAttempts !== undefined && res.remainingAttempts === 0) ||
          rawErr.includes('terkunci') ||
          rawErr.includes('percobaan') ||
          rawErr.includes('batas') ||
          rawErr.includes('serentak') ||
          rawErr.includes('detik')
        ) {
          const waitTime = res.remainingSeconds ? ` Tunggu ${res.remainingSeconds} detik.` : '';
          displayMsg = rawErr || `Akun ini terkunci sementara karena beberapa kali percobaan PIN salah.${waitTime} Silakan coba lagi nanti atau hubungi Admin.`;
        }
        // Distinguish account disabled or activation required
        else if (
          rawErr.includes('dinonaktifkan') ||
          rawErr.includes('aktivasi') ||
          rawErr.includes('Firebase')
        ) {
          displayMsg = rawErr;
        }
        // Distinguish server/database down errors
        else if (
          rawErr.includes('Database') ||
          rawErr.includes('database') ||
          rawErr.includes('server') ||
          rawErr.includes('sistem')
        ) {
          displayMsg = rawErr;
        } else {
          // Explicit authentication refusal for PIN credentials: "PIN salah. Silakan coba lagi."
          if (res.remainingAttempts !== undefined && res.remainingAttempts > 0 && res.remainingAttempts < 5) {
            displayMsg = `PIN salah. Sisa kesempatan: ${res.remainingAttempts} kali. Silakan coba lagi.`;
          } else {
            displayMsg = 'PIN salah. Silakan coba lagi.';
          }
          isCredentialError = true;
        }

        setErrorMessage(displayMsg);
        setHasError(isCredentialError);

        setTimeout(() => {
          const pinField = document.getElementById('pin-input-field');
          if (pinField) {
            pinField.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    } catch (err: any) {
      console.error('[AUTH] Login exception:', err);
      setErrorMessage('Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.');
      setHasError(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard listener for physical numpad / desktop typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if combobox search input or manual text input is active
      const activeTagName = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTagName === 'input' || activeTagName === 'textarea') {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        if (pin.length > 0) {
          e.preventDefault();
          handleClear();
        }
      } else if (e.key === 'Enter') {
        if (!isSubmitting && !isLoading) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pin, selectedIdentifier, isSubmitting, isLoading, isComboboxOpen]);

  // Handle Escape key to close contact modal
  useEffect(() => {
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isContactAdminModalOpen) {
        setIsContactAdminModalOpen(false);
      }
    };
    if (isContactAdminModalOpen) {
      window.addEventListener('keydown', handleModalKeyDown);
      return () => window.removeEventListener('keydown', handleModalKeyDown);
    }
  }, [isContactAdminModalOpen]);

  const selectedUser = usersList.find(
    (u) =>
      (u.loginId && u.loginId === selectedIdentifier) ||
      u.nip === selectedIdentifier ||
      u.id === selectedIdentifier ||
      u.userId === selectedIdentifier
  );

  const supportContact = schoolSettings.loginSupportContact || DEFAULT_LOGIN_SUPPORT_CONTACT;

  const validateContactTarget = (type: LoginContactType, target: string): string | null => {
    const val = (target || '').trim();
    if (!val) return 'Nomor tujuan atau alamat email bantuan belum dikonfigurasi.';
    if (type === 'whatsapp') {
      const cleanDigits = val.replace(/[^0-9]/g, '');
      if (cleanDigits.length < 9 || cleanDigits.length > 16) {
        return 'Nomor WhatsApp harus terdiri dari 9 - 16 digit angka.';
      }
    } else if (type === 'phone') {
      const cleanDigits = val.replace(/[^0-9]/g, '');
      if (cleanDigits.length < 6 || cleanDigits.length > 18) {
        return 'Nomor telepon harus terdiri dari 6 - 18 digit angka.';
      }
    } else if (type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return 'Format email bantuan tidak valid (contoh: admin@sekolah.sch.id).';
      }
    }
    return null;
  };

  const getContactInfo = () => {
    const type: LoginContactType = supportContact.contactType || 'whatsapp';
    const rawTarget = (supportContact.target || '').trim();
    const adminName = supportContact.adminName || 'Admin Piket Sekolah';
    const buttonLabel = supportContact.buttonLabel || 'Hubungi Admin';
    const initialMessage = supportContact.initialMessage || 'Halo Admin, saya membutuhkan bantuan terkait akses login akun Piket Guru.';

    const targetAccount = selectedUser
      ? `${selectedUser.fullName} (${selectedUser.loginId || selectedUser.nip || selectedUser.id})`
      : selectedIdentifier
      ? selectedIdentifier
      : '';

    const validationError = validateContactTarget(type, rawTarget);
    const hasValidTarget = !validationError && rawTarget.length > 0;
    let actionUrl = '';

    if (hasValidTarget) {
      const fullMessage = targetAccount
        ? `${initialMessage}\n(Akun Terpilih: ${targetAccount})`
        : initialMessage;

      if (type === 'whatsapp') {
        let clean = rawTarget.replace(/[^0-9]/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        actionUrl = `https://wa.me/${clean}?text=${encodeURIComponent(fullMessage)}`;
      } else if (type === 'phone') {
        const clean = rawTarget.replace(/[^0-9+]/g, '');
        actionUrl = `tel:${clean}`;
      } else if (type === 'email') {
        const subject = `Bantuan Login Sistem Piket - ${schoolSettings.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName}`;
        actionUrl = `mailto:${rawTarget}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
      }
    }

    return {
      type,
      target: rawTarget,
      adminName,
      buttonLabel,
      initialMessage,
      targetAccount,
      hasValidTarget,
      validationError,
      actionUrl,
    };
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col justify-start sm:justify-center items-center px-3 py-4 sm:p-6 selection:text-white transition-colors duration-200 relative overflow-x-hidden overflow-y-auto"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
      }}
    >
      {/* Top Controls: Theme & Color Palette Switcher */}
      <div className="w-full max-w-md flex items-center justify-end mb-3 px-1 sm:px-0 z-20" ref={themePickerRef}>
        <div className="flex items-center gap-2">
          {/* Pastel Palette Trigger Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/95 dark:bg-[var(--theme-card-bg)]/95 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-700 dark:text-slate-300 shadow-xs hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-all text-xs font-semibold cursor-pointer active:scale-95"
              title="Pilih Tema Warna Pastel"
              aria-label="Pilih Tema Warna Pastel"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
              <span className="text-[11px] hidden xs:inline sm:inline">
                {pastelThemesList.find((p) => p.id === pastelTheme)?.name || 'Tema'}
              </span>
            </button>

            {/* Theme Palette Dropdown Popover */}
            {showThemePicker && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-xl border border-slate-200 dark:border-[var(--theme-card-border)] p-2.5 z-50 text-xs animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Pilih Tema Pastel</span>
                  <span className="text-[9px] text-[var(--theme-primary-text)] font-semibold">
                    {pastelThemesList.find((p) => p.id === pastelTheme)?.name}
                  </span>
                </div>
                <div className="space-y-1 mt-1 max-h-56 overflow-y-auto pr-0.5">
                  {pastelThemesList.map((item) => {
                    const isSelected = pastelTheme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPastelTheme(item.id);
                          setShowThemePicker(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-bold border border-[var(--theme-primary-border)]'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center -space-x-1">
                            {item.swatchColors.map((col, idx) => (
                              <span
                                key={idx}
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: col }}
                              />
                            ))}
                          </div>
                          <div>
                            <span className="text-xs">{item.name}</span>
                            <p className="text-[9px] text-slate-400 font-normal leading-tight">
                              {item.tagline}
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/95 dark:bg-[var(--theme-card-bg)]/95 border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-700 dark:text-slate-300 shadow-xs hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-all text-xs font-semibold cursor-pointer active:scale-95"
            title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] hidden xs:inline sm:inline">Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                <span className="text-[11px] hidden xs:inline sm:inline">Gelap</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main App Card */}
      <div className="w-full max-w-md bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/90 dark:border-[var(--theme-card-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl space-y-4 sm:space-y-5 transition-colors duration-200">
        {/* Header Branding & Real-time Date/Time */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          {schoolSettings.logoUrl ? (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white dark:bg-[var(--theme-surface-subtle)] p-1 flex items-center justify-center mx-auto shadow-md border border-slate-200 dark:border-[var(--theme-card-border)]">
              <img
                src={schoolSettings.logoUrl}
                alt="Logo Sekolah"
                className="w-full h-full object-contain rounded-lg sm:rounded-xl"
              />
            </div>
          ) : (
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[var(--theme-primary)] flex items-center justify-center text-[var(--theme-primary-contrast)] mx-auto shadow-md shadow-[var(--theme-ring)]">
              <School className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {schoolSettings.appName || APP_NAME}
            </h1>
            <p className="text-[11px] sm:text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-semibold mt-0.5">
              {schoolSettings.appSubtitle || APP_SUBTITLE}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              {schoolSettings.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName}
            </p>

            {/* Real-time Indonesian Date and Clock */}
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full bg-slate-100 dark:bg-[var(--theme-surface-subtle)] border border-slate-200/70 dark:border-[var(--theme-card-border)] text-[10.5px] text-slate-600 dark:text-slate-300">
              <Calendar className="w-3 h-3 text-[var(--theme-primary)] flex-shrink-0" />
              <span>{formatIndonesianDate(currentTime)}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <Clock className="w-3 h-3 text-[var(--theme-primary)] flex-shrink-0" />
              <span className="font-mono font-medium tabular-nums">
                {new Intl.DateTimeFormat('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                  timeZone: 'Asia/Jakarta',
                }).format(currentTime)}{' '}
                WIB
              </span>
            </div>
          </div>
        </div>

        {/* User Account Selection / Searchable Combobox */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Pilih Pengguna / Petugas Piket:</span>
            {usersList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsManualInput(!isManualInput);
                  setIsComboboxOpen(false);
                }}
                className="text-[11px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                {isManualInput ? 'Pilih dari Daftar' : 'Input Manual ID'}
              </button>
            )}
          </div>

          {isManualInput || usersList.length === 0 ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={selectedIdentifier}
                onChange={(e) => {
                  setSelectedIdentifier(e.target.value);
                  setPin('');
                  setErrorMessage('');
                  setHasError(false);
                }}
                placeholder="Masukkan ID Login atau NIP..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-input-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none transition-colors placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Ketik ID Pengguna Anda (contoh: ADMIN-001, GURU-001, atau NIP).
              </p>
            </div>
          ) : (
            /* Searchable Combobox Container */
            <div className="relative" ref={comboboxRef}>
              {/* Combobox Trigger Button */}
              <button
                type="button"
                onClick={() => setIsComboboxOpen(!isComboboxOpen)}
                onKeyDown={handleComboboxKeyDown}
                className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[var(--theme-input-bg)] dark:hover:bg-[var(--theme-surface-subtle)] border border-slate-200 dark:border-[var(--theme-card-border)] text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none cursor-pointer transition-all flex items-center justify-between gap-2 text-left"
                aria-haspopup="listbox"
                aria-expanded={isComboboxOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    {selectedUser ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUser.fullName}{' '}
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {selectedUser.loginId ? `[${selectedUser.loginId}]` : selectedUser.nip ? `(${selectedUser.nip})` : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Pilih pengguna...</span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isComboboxOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Combobox Dropdown Popover */}
              {isComboboxOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--theme-card-border)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search Input in Dropdown Header */}
                  <div className="p-2 border-b border-slate-100 dark:border-[var(--theme-card-border)] bg-slate-50/50 dark:bg-[var(--theme-surface-subtle)]">
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleComboboxKeyDown}
                        placeholder="Cari nama atau ID login..."
                        className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-[var(--theme-input-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List of Users */}
                  <div
                    ref={listboxRef}
                    role="listbox"
                    className="max-h-56 overflow-y-auto p-1.5 space-y-1 scrollbar-thin"
                  >
                    {isLoadingUsers ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Memuat daftar pengguna...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Pengguna tidak ditemukan</p>
                        <p className="text-[11px]">Coba kata kunci nama atau ID login lain.</p>
                      </div>
                    ) : (
                      filteredUsers.map((u, idx) => {
                        const identifierValue = u.loginId || u.nip || u.id;
                        const isSelected = selectedIdentifier === identifierValue;
                        const isHighlighted = highlightedIndex === idx;

                        return (
                          <div
                            key={u.userId || u.id}
                            data-index={idx}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectUser(u)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs ${
                              isSelected
                                ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-semibold'
                                : isHighlighted
                                ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-900 dark:text-white'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {u.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                                  {u.fullName}
                                </div>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                                  {u.loginId && (
                                    <span className="bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.2 rounded">
                                      ID: {u.loginId}
                                    </span>
                                  )}
                                  {u.nip && (
                                    <span>
                                      NIP: {u.nip}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-[var(--theme-primary)] ml-1" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIN / Password Field with Eye Toggle & Keypad */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              PIN Keamanan (6 Digit):
            </label>

            {/* Direct Input Field with Eye Toggle Button */}
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Lock className={`w-4 h-4 transition-colors ${hasError ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`} />
              </div>
              <input
                id="pin-input-field"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(val);
                  if (errorMessage) {
                    setErrorMessage('');
                    setHasError(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="••••••"
                aria-label="6-digit PIN keamanan"
                aria-invalid={hasError ? 'true' : 'false'}
                aria-describedby={errorMessage ? 'pin-error-message' : undefined}
                className={`w-full pl-10 pr-12 py-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-input-bg)] text-slate-900 dark:text-white text-base sm:text-sm font-semibold tracking-widest focus:outline-none transition-all placeholder:tracking-widest placeholder:text-slate-400 min-h-[46px] border ${
                  hasError
                    ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 dark:ring-rose-500/30 focus:ring-2 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-[var(--theme-card-border)] focus:ring-2 focus:ring-[var(--theme-primary)]'
                }`}
              />

              {/* Show / Hide Toggle Button (Accessible & Ergonomic) */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1.5 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title={showPassword ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                aria-label={showPassword ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Error Message DIRECTLY BELOW INPUT */}
            {errorMessage && (
              <div
                id="pin-error-message"
                role="alert"
                aria-live="polite"
                className="mt-1.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span className="flex-1 font-medium">{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Virtual Numeric Keypad (Ergonomic for HP & Touch) */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isSubmitting || isLoading}
              onClick={() => handlePinInput(num)}
              className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[var(--theme-surface-subtle)] dark:hover:bg-[var(--theme-surface-hover)] active:bg-[var(--theme-primary)] active:text-white text-slate-800 dark:text-white text-base sm:text-lg font-bold transition-all duration-100 flex items-center justify-center border border-slate-200 dark:border-[var(--theme-card-border)] active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            disabled={isSubmitting || isLoading || pin.length === 0}
            onClick={handleClear}
            className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100/60 hover:bg-slate-200/80 dark:bg-[var(--theme-surface-subtle)]/70 dark:hover:bg-[var(--theme-surface-hover)] active:bg-slate-200 dark:active:bg-[var(--theme-surface-hover)] text-slate-500 dark:text-slate-400 text-xs font-semibold transition-all flex items-center justify-center border border-slate-200 dark:border-[var(--theme-card-border)] cursor-pointer disabled:opacity-40 min-h-[44px]"
          >
            HAPUS
          </button>

          <button
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={() => handlePinInput('0')}
            className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[var(--theme-surface-subtle)] dark:hover:bg-[var(--theme-surface-hover)] active:bg-[var(--theme-primary)] active:text-white text-slate-800 dark:text-white text-base sm:text-lg font-bold transition-all duration-100 flex items-center justify-center border border-slate-200 dark:border-[var(--theme-card-border)] active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            0
          </button>

          <button
            type="button"
            disabled={isSubmitting || isLoading || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Hapus satu angka"
            className="h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100/60 hover:bg-slate-200/80 dark:bg-[var(--theme-surface-subtle)]/70 dark:hover:bg-[var(--theme-surface-hover)] active:bg-slate-200 dark:active:bg-[var(--theme-surface-hover)] text-slate-600 dark:text-slate-300 text-base font-semibold transition-all flex items-center justify-center border border-slate-200 dark:border-[var(--theme-card-border)] cursor-pointer disabled:opacity-40 min-h-[44px]"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Companion Error Message Above Submit Button (Ensures full visibility on mobile viewports) */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-xs"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Pilihan Perangkat Pribadi vs Perangkat Bersama */}
        <div className="flex items-start gap-2.5 px-1 py-1 rounded-xl bg-slate-50/70 dark:bg-[var(--theme-surface-subtle)]/50 border border-slate-200/60 dark:border-[var(--theme-card-border)]/60">
          <input
            id="trusted-device-checkbox"
            type="checkbox"
            checked={isTrustedDevice}
            onChange={(e) => setTrustedDevice(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] w-4 h-4 cursor-pointer"
          />
          <label htmlFor="trusted-device-checkbox" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Perangkat Pribadi / Tepercaya</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Aktifkan draf & penyimpanan lokal persisten. Jangan centang jika menggunakan perangkat bersama.
            </span>
          </label>
        </div>

        {/* Submit Button (Ergonomic alternative to virtual pad) */}
        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={() => handleSubmit()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl sm:rounded-2xl bg-[var(--theme-primary)] hover:opacity-95 text-[var(--theme-primary-contrast,#ffffff)] font-bold text-xs sm:text-sm shadow-md shadow-[var(--theme-ring)] transition-all cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed min-h-[46px]"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>{isSubmitting ? 'Memeriksa…' : 'Masuk Sekarang'}</span>
        </button>

        {/* Admin Support Contact Action (Proportional & Ergonomic, Reset PIN removed) */}
        {supportContact.enabled !== false && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setIsContactAdminModalOpen(true)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 hover:bg-slate-100 dark:bg-[var(--theme-surface-subtle)] dark:hover:bg-[var(--theme-surface-hover)] text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              title={`Hubungi ${supportContact.adminName || 'Administrator'}`}
              aria-label={supportContact.buttonLabel || 'Hubungi Admin'}
            >
              {supportContact.contactType === 'whatsapp' ? (
                <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : supportContact.contactType === 'phone' ? (
                <Phone className="w-4 h-4 text-[var(--theme-primary)] flex-shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-[var(--theme-primary)] flex-shrink-0" />
              )}
              <span className="truncate">{supportContact.buttonLabel || 'Hubungi Admin'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Page Footer: Google Admin Login & App Creator Notice (Follows natural page flow) */}
      <footer className="w-full max-w-md mt-3 sm:mt-4 mb-2 px-2 flex items-center justify-center gap-3.5 z-10">
        {/* Google Icon Button */}
        <div className="relative group flex-shrink-0">
          <button
            type="button"
            disabled={isGoogleSubmitting || isSubmitting || isLoading}
            onClick={handleGoogleLogin}
            title="Masuk dengan Google sebagai Administrator"
            aria-label="Masuk dengan Google sebagai Administrator"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl sm:rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/90 dark:border-[var(--theme-card-border)] hover:border-[var(--theme-primary-border)] hover:bg-[var(--theme-primary-light)]/40 dark:hover:bg-[var(--theme-surface-subtle)] shadow-xs hover:shadow-md transition-all duration-150 flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-2 dark:focus:ring-offset-[var(--theme-card-bg)]"
          >
            {isGoogleSubmitting ? (
              <div className="w-5 h-5 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
          </button>

          {/* Floating Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900/90 dark:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-30 transition-opacity">
            <span>Masuk dengan Google sebagai Administrator</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/90 dark:border-t-slate-800" />
          </div>
        </div>

        {/* Developer Attribution */}
        <div className="text-left min-w-0 flex-1 leading-snug">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
            Dikembangkan oleh{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {schoolSettings.appCreator || DEFAULT_SCHOOL_SETTINGS.appCreator || 'Tim Pengembang Sistem Piket'}
            </span>
          </p>
        </div>
      </footer>

      {/* Modal: Kontak Administrator Sekolah */}
      {isContactAdminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          onClick={() => setIsContactAdminModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[var(--theme-card-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center flex-shrink-0">
                  {getContactInfo().type === 'whatsapp' ? (
                    <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : getContactInfo().type === 'phone' ? (
                    <Phone className="w-5 h-5 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]" />
                  ) : (
                    <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div>
                  <h2 id="contact-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {getContactInfo().buttonLabel || 'Hubungi Admin'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getContactInfo().adminName || 'Administrator Piket Sekolah'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContactAdminModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected User Context (if selected) */}
            {selectedUser && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Akun Anda</span>
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{selectedUser.fullName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {selectedUser.loginId ? `ID: ${selectedUser.loginId}` : selectedUser.nip ? `NIP: ${selectedUser.nip}` : ''}
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-[var(--theme-surface-subtle)] text-slate-700 dark:text-slate-300 flex-shrink-0">
                  {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                </span>
              </div>
            )}

            {/* School Profile Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/60 border border-slate-200 dark:border-[var(--theme-card-border)] space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {schoolSettings.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName}
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-snug">
                {schoolSettings.address || DEFAULT_SCHOOL_SETTINGS.address}
              </p>
            </div>

            {/* Contact Action Details */}
            <div className="space-y-3">
              {getContactInfo().hasValidTarget ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)]/80 border border-slate-200 dark:border-[var(--theme-card-border)] space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      {getContactInfo().type === 'whatsapp' ? (
                        <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : getContactInfo().type === 'phone' ? (
                        <Phone className="w-4 h-4 text-[var(--theme-primary)] flex-shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      )}
                      <span>
                        {getContactInfo().type === 'whatsapp'
                          ? 'WhatsApp Bantuan'
                          : getContactInfo().type === 'phone'
                          ? 'Panggilan Telepon'
                          : 'Email Bantuan'}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {getContactInfo().target}
                    </span>
                  </div>

                  {/* Initial Message Preview (for WhatsApp & Email) */}
                  {(getContactInfo().type === 'whatsapp' || getContactInfo().type === 'email') && getContactInfo().initialMessage && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pesan Awal Bantuan:</div>
                      <p className="italic whitespace-pre-wrap">{getContactInfo().initialMessage}</p>
                    </div>
                  )}

                  {/* Action Link Button */}
                  <a
                    href={getContactInfo().actionUrl}
                    target={getContactInfo().type === 'whatsapp' ? '_blank' : undefined}
                    rel={getContactInfo().type === 'whatsapp' ? 'noopener noreferrer' : undefined}
                    className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] hover:opacity-95 text-[var(--theme-primary-contrast,#ffffff)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    {getContactInfo().type === 'whatsapp' ? (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        <span>Buka Chat WhatsApp</span>
                      </>
                    ) : getContactInfo().type === 'phone' ? (
                      <>
                        <Phone className="w-4 h-4" />
                        <span>Panggil Nomor Telepon</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Kirim Email Bantuan</span>
                      </>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                  </a>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold">Kontak Belum Dikonfigurasi Lengkap</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Kontak bantuan belum dikonfigurasi secara lengkap oleh administrator sekolah. Silakan hubungi langsung pihak tata usaha atau pimpinan sekolah untuk bantuan akses akun.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Security Caution Note */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2 border border-slate-200/50 dark:border-[var(--theme-card-border)]">
              <ShieldAlert className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Catatan Keamanan:</strong> Jangan pernah menyertakan PIN atau kata sandi dalam pesan bantuan. Admin hanya memerlukan informasi Nama dan ID Login/NIP Anda untuk mereset akun.
              </span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsContactAdminModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[var(--theme-surface-subtle)] dark:hover:bg-[var(--theme-surface-hover)] border border-transparent dark:border-[var(--theme-card-border)] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
