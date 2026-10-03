import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  MapPin,
  Download,
  Upload,
  Save,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Camera,
  HardDrive,
  Palette,
  FileText,
  History,
  Image as ImageIcon,
  Trash2,
  Calendar,
  Wand2,
  Copy,
  Clock,
  Sliders,
  ChevronRight,
  Sun,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { RestoreConfirmModal } from './RestoreConfirmModal';
import { ThemeSettingsCard } from './ThemeSettingsCard';
import { SecurityCenterCard } from './SecurityCenterCard';
import { BellEmergencyAutomationCard } from './BellEmergencyAutomationCard';
import { SnapshotManagerCard } from './SnapshotManagerCard';
import { AuditForensicViewer } from './AuditForensicViewer';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { BackupService, BackupPayload } from '../../services/backup/backupService';
import { LocationService } from '../../services/location/locationService';
import { useAuth } from '../../contexts/AuthContext';
import { SchoolSettings, UserProfile, DayOfWeek, DayShiftDetail } from '../../types';
import { AuditLogRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS, DEFAULT_DAILY_SCHEDULES } from '../../config/constants';

type SettingsTab = 'school' | 'security' | 'bell' | 'snapshots' | 'backup' | 'theme' | 'audit';

const ALL_OPERATIONAL_DAYS: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

export const SettingsView: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // School Form State
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [npsn, setNpsn] = useState(DEFAULT_SCHOOL_SETTINGS.npsn);
  const [address, setAddress] = useState(DEFAULT_SCHOOL_SETTINGS.address);
  const [appName, setAppName] = useState(DEFAULT_SCHOOL_SETTINGS.appName || 'PIKET GURU');
  const [appSubtitle, setAppSubtitle] = useState(
    DEFAULT_SCHOOL_SETTINGS.appSubtitle || 'Jadwal & Buku Piket Digital Sekolah'
  );
  const [appCreator, setAppCreator] = useState(
    DEFAULT_SCHOOL_SETTINGS.appCreator || 'Tim Pengembang Sistem Piket'
  );
  const [logoUrl, setLogoUrl] = useState(DEFAULT_SCHOOL_SETTINGS.logoUrl || '');
  const [schoolLat, setSchoolLat] = useState(DEFAULT_SCHOOL_SETTINGS.schoolLat);
  const [schoolLng, setSchoolLng] = useState(DEFAULT_SCHOOL_SETTINGS.schoolLng);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(
    DEFAULT_SCHOOL_SETTINGS.allowedRadiusMeters
  );
  const [startHour, setStartHour] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.start || '06:30');
  const [endHour, setEndHour] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.end || '15:30');
  const [checkInStart, setCheckInStart] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.checkInStart || '06:00');
  const [checkInEnd, setCheckInEnd] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.checkInEnd || '07:30');
  const [checkOutStart, setCheckOutStart] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.checkOutStart || '14:30');
  const [checkOutEnd, setCheckOutEnd] = useState(DEFAULT_SCHOOL_SETTINGS.workHours?.checkOutEnd || '17:00');
  const [activeDays, setActiveDays] = useState<DayOfWeek[]>(
    DEFAULT_SCHOOL_SETTINGS.workHours?.activeDays || ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
  );

  // Per-day Shift & Attendance configuration state (CR-AUTOMATED-DAILY-SHIFT)
  const [dailySchedules, setDailySchedules] = useState<Record<DayOfWeek, DayShiftDetail>>(
    (DEFAULT_SCHOOL_SETTINGS.workHours?.dailySchedules as Record<DayOfWeek, DayShiftDetail>) || DEFAULT_DAILY_SCHEDULES
  );
  const [selectedDayConfig, setSelectedDayConfig] = useState<DayOfWeek>('SENIN');

  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [locationErrorBanner, setLocationErrorBanner] = useState<string | null>(null);

  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Load Settings, Users, and Logs
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) {
        setSettings(data);
        setSchoolName(data.schoolName);
        setNpsn(data.npsn);
        setAddress(data.address);
        if (data.appName) setAppName(data.appName);
        if (data.appSubtitle) setAppSubtitle(data.appSubtitle);
        if (data.appCreator) setAppCreator(data.appCreator);
        if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl);
        setSchoolLat(data.schoolLat);
        setSchoolLng(data.schoolLng);
        setAllowedRadiusMeters(data.allowedRadiusMeters);
        setStartHour(data.workHours?.start || '06:30');
        setEndHour(data.workHours?.end || '15:30');
        setCheckInStart(data.workHours?.checkInStart || '06:00');
        setCheckInEnd(data.workHours?.checkInEnd || '07:30');
        setCheckOutStart(data.workHours?.checkOutStart || '14:30');
        setCheckOutEnd(data.workHours?.checkOutEnd || '17:00');
        if (data.workHours?.activeDays) setActiveDays(data.workHours.activeDays);

        if (data.workHours?.dailySchedules) {
          setDailySchedules(data.workHours.dailySchedules as Record<DayOfWeek, DayShiftDetail>);
        } else if (data.workHours) {
          const generated: Record<DayOfWeek, DayShiftDetail> = { ...DEFAULT_DAILY_SCHEDULES };
          ALL_OPERATIONAL_DAYS.forEach((d) => {
            generated[d] = {
              start: data.workHours?.start || '06:30',
              end: d === 'JUMAT' ? '11:45' : (data.workHours?.end || '15:30'),
              checkInStart: data.workHours?.checkInStart || '06:00',
              checkInEnd: data.workHours?.checkInEnd || '07:30',
              checkOutStart: d === 'JUMAT' ? '11:30' : (data.workHours?.checkOutStart || '14:30'),
              checkOutEnd: data.workHours?.checkOutEnd || '17:00',
              isActive: data.workHours?.activeDays ? data.workHours.activeDays.includes(d) : d !== 'MINGGU',
            };
          });
          setDailySchedules(generated);
        }
      }
    });

    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {
      setUsers(data);
    });

    const unsubLogs = FirestoreService.subscribeToCollection<AuditLogRecord>('auditLogs', (data) => {
      setAuditLogs(
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  // 1. Terapkan jam input utama ke seluruh hari operasional aktif
  const handleApplyCurrentHoursToAllActiveDays = () => {
    const updated: Record<DayOfWeek, DayShiftDetail> = { ...dailySchedules };
    ALL_OPERATIONAL_DAYS.forEach((d) => {
      const isDayActive = activeDays.includes(d);
      updated[d] = {
        start: startHour,
        end: endHour,
        checkInStart,
        checkInEnd,
        checkOutStart,
        checkOutEnd,
        isActive: isDayActive,
      };
    });
    setDailySchedules(updated);
    setSaveSuccessBanner('Jam shift & rentang presensi saat ini berhasil diterapkan otomatis ke seluruh hari!');
    setTimeout(() => setSaveSuccessBanner(null), 4000);
  };

  // 2. Preset Otomatis Standar Sekolah Nasional (Jumat pulang awal)
  const handleApplySchoolStandardPreset = () => {
    const standardDays: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    setActiveDays(standardDays);
    const updated: Record<DayOfWeek, DayShiftDetail> = { ...DEFAULT_DAILY_SCHEDULES };
    setDailySchedules(updated);
    setStartHour(updated.SENIN.start);
    setEndHour(updated.SENIN.end);
    setCheckInStart(updated.SENIN.checkInStart);
    setCheckInEnd(updated.SENIN.checkInEnd);
    setCheckOutStart(updated.SENIN.checkOutStart);
    setCheckOutEnd(updated.SENIN.checkOutEnd);
    setSaveSuccessBanner('Preset Standar Sekolah berhasil diterapkan (Senin-Kamis normal, Jumat pulang awal, Sabtu fleksibel)!');
    setTimeout(() => setSaveSuccessBanner(null), 4000);
  };

  // 3. Preset Otomatis 5 Hari (Full Day School: Senin - Jumat)
  const handleApplyFullDayPreset = () => {
    const fdsDays: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
    setActiveDays(fdsDays);
    const updated: Record<DayOfWeek, DayShiftDetail> = { ...dailySchedules };
    ALL_OPERATIONAL_DAYS.forEach((d) => {
      const isFds = fdsDays.includes(d);
      updated[d] = {
        start: '06:30',
        end: d === 'JUMAT' ? '15:00' : '16:00',
        checkInStart: '06:00',
        checkInEnd: '07:00',
        checkOutStart: d === 'JUMAT' ? '14:30' : '15:30',
        checkOutEnd: '17:30',
        isActive: isFds,
      };
    });
    setDailySchedules(updated);
    setStartHour('06:30');
    setEndHour('16:00');
    setCheckInStart('06:00');
    setCheckInEnd('07:00');
    setCheckOutStart('15:30');
    setCheckOutEnd('17:30');
    setSaveSuccessBanner('Preset 5 Hari Kerja (Full Day School: Sen-Jum) berhasil diterapkan otomatis!');
    setTimeout(() => setSaveSuccessBanner(null), 4000);
  };

  // Update specific day shift field
  const handleUpdateDaySchedule = (day: DayOfWeek, field: keyof DayShiftDetail, value: any) => {
    setDailySchedules((prev) => {
      const current = prev[day] || {
        start: startHour,
        end: endHour,
        checkInStart,
        checkInEnd,
        checkOutStart,
        checkOutEnd,
        isActive: activeDays.includes(day),
      };
      const updatedDay = { ...current, [field]: value };
      
      // if field is isActive, also synchronize activeDays list
      if (field === 'isActive') {
        if (value) {
          if (!activeDays.includes(day)) setActiveDays([...activeDays, day]);
        } else {
          setActiveDays(activeDays.filter((d) => d !== day));
        }
      }
      return {
        ...prev,
        [day]: updatedDay,
      };
    });
  };

  // Copy schedule from one day to all other active days
  const handleCopyDayScheduleToAll = (sourceDay: DayOfWeek) => {
    const src = dailySchedules[sourceDay];
    if (!src) return;
    const updated: Record<DayOfWeek, DayShiftDetail> = { ...dailySchedules };
    ALL_OPERATIONAL_DAYS.forEach((d) => {
      if (d !== sourceDay && activeDays.includes(d)) {
        updated[d] = {
          ...src,
          isActive: true,
        };
      }
    });
    setDailySchedules(updated);
    setSaveSuccessBanner(`Jadwal & jam presensi hari ${sourceDay} berhasil disalin ke seluruh hari aktif!`);
    setTimeout(() => setSaveSuccessBanner(null), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setLogoUrl(res);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- SAVE SCHOOL PROFILE & GPS ---
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    setIsSavingSchool(true);
    try {
      const updated: SchoolSettings = {
        schoolName,
        npsn,
        address,
        appName: appName.trim() || 'PIKET GURU',
        appSubtitle: appSubtitle.trim() || 'Jadwal & Buku Piket Digital Sekolah',
        appCreator: appCreator.trim(),
        logoUrl: logoUrl.trim(),
        schoolLat,
        schoolLng,
        allowedRadiusMeters,
        workHours: {
          start: startHour,
          end: endHour,
          checkInStart,
          checkInEnd,
          checkOutStart,
          checkOutEnd,
          activeDays,
          dailySchedules,
        },
      };

      await FirestoreService.setDocument('settings', 'school_config', updated);
      setSettings(updated);
      try {
        localStorage.setItem('piket_guru_school_config', JSON.stringify(updated));
      } catch {
        // ignore
      }

      await FirestoreService.logAudit({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        action: 'UPDATE',
        module: 'SETTINGS',
        details: `Memperbarui konfigurasi sekolah, logo, jadwal hari operasional (${activeDays.join(', ')}), branding login & geofence (${allowedRadiusMeters}m)`,
      });

      setSaveSuccessBanner('Pengaturan profil sekolah, logo, jam kerja/hari shift, & koordinat GPS berhasil disimpan!');
      setTimeout(() => setSaveSuccessBanner(null), 4000);
    } finally {
      setIsSavingSchool(false);
    }
  };

  // --- AUTO-DETECT CURRENT GPS ---
  const handleDetectCurrentLocation = async () => {
    setIsDetectingLocation(true);
    setLocationErrorBanner(null);
    try {
      const pos = await LocationService.getCurrentPosition();
      setSchoolLat(parseFloat(pos.latitude.toFixed(6)));
      setSchoolLng(parseFloat(pos.longitude.toFixed(6)));
      setSaveSuccessBanner(
        `Berhasil mendeteksi koordinat perangkat: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`
      );
      setTimeout(() => setSaveSuccessBanner(null), 4000);
    } catch (err: any) {
      setLocationErrorBanner(
        err.message || 'Gagal membaca koordinat GPS perangkat. Pastikan izin lokasi aktif.'
      );
      setTimeout(() => setLocationErrorBanner(null), 6000);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // --- BACKUP DOWNLOAD ---
  const handleDownloadBackup = async () => {
    if (!currentUser) return;
    setIsBackingUp(true);
    try {
      const backup = await BackupService.createFullBackup(currentUser);
      BackupService.downloadBackupFile(backup);
    } finally {
      setIsBackingUp(false);
    }
  };

  // --- RESTORE UPLOAD HANDLER ---
  const handleFileRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const validation = BackupService.validateBackupSchema(json);
        if (!validation.isValid) {
          setRestoreError(validation.error || 'Berkas cadangan tidak valid.');
          return;
        }
        setRestorePayload(json);
      } catch (err) {
        setRestoreError('Berkas bukan format JSON yang valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- CONFIRM RESTORE EXECUTE ---
  const handleExecuteRestore = async (payload: BackupPayload) => {
    if (!currentUser) return;
    const result = await BackupService.restoreFullBackup(payload, currentUser);
    setSaveSuccessBanner(
      `Pemulihan database berhasil! ${result.restoredCount} dokumen telah disinkronkan ke Firestore.`
    );
    setTimeout(() => setSaveSuccessBanner(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Pengaturan Sistem, Keamanan & Otomasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tata kelola profil instansi, Geofence presensi, audit forensik, snapshot darurat, dan bel sekolah otomatis
          </p>
        </div>

        {/* Tab Switcher (CR-006: Clean layout aligned with adjacent menus, no truncation) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl overflow-x-auto max-w-full scrollbar-thin">
          <button
            onClick={() => setActiveTab('school')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'school'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            Profil & GPS
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'security'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Keamanan Siber
          </button>
          <button
            onClick={() => setActiveTab('bell')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'bell'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            Bel & Darurat
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'snapshots'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-indigo-500" />
            Snapshot Cloud
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
            Backup JSON
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'theme'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-purple-500" />
            Tema
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-500" />
            Audit Forensik ({auditLogs.length})
          </button>
        </div>
      </div>

      {saveSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">{saveSuccessBanner}</span>
        </div>
      )}

      {locationErrorBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-bold">{locationErrorBanner}</span>
        </div>
      )}

      {/* TAB 1: SCHOOL PROFILE & GEOFENCE */}
      {activeTab === 'school' && (
        <form onSubmit={handleSaveSchoolSettings} className="space-y-6">
          <Card>
            <CardHeader
              title="Informasi Profil & Identitas Sekolah"
              subtitle="Data resmi yang tercetak pada kop surat buku piket dan laporan resmi"
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nama Resmi Sekolah / Lembaga
                  </label>
                  <input
                    required
                    disabled={!isAdmin}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nomor Pokok Sekolah Nasional (NPSN)
                  </label>
                  <input
                    required
                    disabled={!isAdmin}
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alamat Lengkap Sekolah
                </label>
                <input
                  required
                  disabled={!isAdmin}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card Kustomisasi Tampilan Halaman Login & Identitas Aplikasi */}
          <Card>
            <CardHeader
              title="Kustomisasi Tampilan Halaman Login & Identitas Aplikasi"
              subtitle="Sesuaikan nama aplikasi, keterangan/subtitle, dan nama pembuat yang tampil di halaman login sistem"
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Nama Aplikasi di Halaman Login</span>
                    <span className="text-[10px] text-slate-400 font-normal">Default: PIKET GURU</span>
                  </label>
                  <input
                    disabled={!isAdmin}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Contoh: PIKET GURU"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Nama Pembuat / Pengembang Aplikasi</span>
                    <span className="text-[10px] text-slate-400 font-normal">Tampil di footer login</span>
                  </label>
                  <input
                    disabled={!isAdmin}
                    value={appCreator}
                    onChange={(e) => setAppCreator(e.target.value)}
                    placeholder="Contoh: Tim IT Sekolah / Nama Pembuat"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Keterangan / Subtitle Aplikasi di Halaman Login</span>
                  <span className="text-[10px] text-slate-400 font-normal">Default: Jadwal & Buku Piket Digital Sekolah</span>
                </label>
                <input
                  disabled={!isAdmin}
                  value={appSubtitle}
                  onChange={(e) => setAppSubtitle(e.target.value)}
                  placeholder="Contoh: Jadwal & Buku Piket Digital Sekolah"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Logo Management */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      <span>Logo Resmi Sekolah / Aplikasi</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tampil pada halaman login, bilah atas (header), kop buku piket, dan laporan
                    </p>
                  </div>

                  {logoUrl && isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 text-xs self-start sm:self-auto cursor-pointer"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => setLogoUrl('')}
                    >
                      Hapus / Reset Logo
                    </Button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Current Logo / Placeholder */}
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-xs">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-6 h-6 mx-auto opacity-60" />
                        <span className="text-[9px] block">Default</span>
                      </div>
                    )}
                  </div>

                  {/* Upload & URL input */}
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="file"
                      ref={logoFileInputRef}
                      onChange={handleLogoFileUpload}
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                      className="hidden"
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isAdmin}
                        leftIcon={<Upload className="w-3.5 h-3.5 text-blue-500" />}
                        onClick={() => logoFileInputRef.current?.click()}
                        className="text-xs cursor-pointer"
                      >
                        Unggah Gambar Logo
                      </Button>
                      <span className="text-[10px] text-slate-400">Format: PNG, JPG, WebP, SVG (Maks. 2MB)</span>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="url"
                        disabled={!isAdmin}
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Atau tempel URL gambar logo eksternal (https://...)"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1.5 shadow-inner">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Pratinjau Tampilan Header & Footer Login:
                </div>
                {logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 p-1 flex items-center justify-center mx-auto shadow-md">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <div className="text-lg font-black text-white tracking-tight">{appName || 'PIKET GURU'}</div>
                <div className="text-xs text-blue-400 font-semibold">{appSubtitle || 'Jadwal & Buku Piket Digital Sekolah'}</div>
                <div className="text-[11px] text-slate-400">{schoolName || 'Nama Sekolah'}</div>
                {appCreator && (
                  <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/80 mt-2 flex items-center justify-center gap-1">
                    <span>Dikembangkan oleh:</span>
                    <span className="text-slate-200 font-semibold">{appCreator}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Konfigurasi Geofencing GPS & Toleransi Radius Presensi"
              subtitle="Koordinat titik pusat sekolah dan batas toleransi jarak kehadiran guru piket"
              action={
                isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    isLoading={isDetectingLocation}
                    leftIcon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}
                    onClick={handleDetectCurrentLocation}
                  >
                    Gunakan Lokasi GPS Saya Saat Ini
                  </Button>
                )
              }
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!isAdmin}
                    value={schoolLat}
                    onChange={(e) => setSchoolLat(parseFloat(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Longitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!isAdmin}
                    value={schoolLng}
                    onChange={(e) => setSchoolLng(parseFloat(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Batas Toleransi Radius (Meter)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    required
                    disabled={!isAdmin}
                    value={allowedRadiusMeters}
                    onChange={(e) => setAllowedRadiusMeters(parseInt(e.target.value) || 50)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Work hours & Shift Windows with Automatic Per-Day Settings */}
              <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Konfigurasi Jam Shift & Batas Presensi Masuk / Pulang (WIB)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Atur jam tugas piket dan rentang presensi GPS secara seragam atau khusus per hari otomatis
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleApplyCurrentHoursToAllActiveDays}
                        title="Salin dan terapkan jam input utama saat ini ke seluruh hari aktif"
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3 text-blue-600" />
                        <span>Setel Otomatis ke Semua Hari</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApplySchoolStandardPreset}
                        title="Terapkan preset standar sekolah (Senin-Kamis normal, Jumat pulang awal, Sabtu fleksibel)"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3 text-emerald-600" />
                        <span>Preset Standar Nasional</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyFullDayPreset}
                        title="Terapkan preset 5 hari kerja (Senin - Jumat Full Day)"
                        className="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3 text-purple-600" />
                        <span>Preset 5 Hari (FDS)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Hari Operasional Shift & Presensi Piket */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>Hari Operasional Shift & Presensi Piket</span>
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tentukan hari pelaksanaan tugas piket guru (klik tombol hari untuk aktif/libur)
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const senJum: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
                            setActiveDays(senJum);
                            const updated = { ...dailySchedules };
                            ALL_OPERATIONAL_DAYS.forEach((d) => {
                              if (updated[d]) updated[d].isActive = senJum.includes(d);
                            });
                            setDailySchedules(updated);
                          }}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          5 Hari (Sen-Jum)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const senSab: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
                            setActiveDays(senSab);
                            const updated = { ...dailySchedules };
                            ALL_OPERATIONAL_DAYS.forEach((d) => {
                              if (updated[d]) updated[d].isActive = senSab.includes(d);
                            });
                            setDailySchedules(updated);
                          }}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          6 Hari (Sen-Sab)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDays(ALL_OPERATIONAL_DAYS);
                            const updated = { ...dailySchedules };
                            ALL_OPERATIONAL_DAYS.forEach((d) => {
                              if (updated[d]) updated[d].isActive = true;
                            });
                            setDailySchedules(updated);
                          }}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          Semua Hari
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
                    {ALL_OPERATIONAL_DAYS.map((day) => {
                      const isSelected = activeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            if (isSelected) {
                              if (activeDays.length > 1) {
                                const next = activeDays.filter((d) => d !== day);
                                setActiveDays(next);
                                handleUpdateDaySchedule(day, 'isActive', false);
                              }
                            } else {
                              const next = [...activeDays, day];
                              setActiveDays(next);
                              handleUpdateDaySchedule(day, 'isActive', true);
                            }
                          }}
                          className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <span>{day}</span>
                          <span className="text-[9px] font-normal opacity-90">
                            {isSelected ? '✓ Aktif' : 'Libur'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day-by-Day Automatic Schedule Configuration Panel */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Rincian Pengaturan Shift Disetiap Harinya
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Pilih hari di bawah untuk mengatur jam khusus hari tersebut (contoh: Jumat pulang jam 11:45)
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleCopyDayScheduleToAll(selectedDayConfig)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Jam {selectedDayConfig} ke Semua Hari Aktif</span>
                      </button>
                    )}
                  </div>

                  {/* Day Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {ALL_OPERATIONAL_DAYS.map((d) => {
                      const isActive = activeDays.includes(d);
                      const isCurrentTab = selectedDayConfig === d;
                      const daySched = dailySchedules[d];

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDayConfig(d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrentTab
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{d}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive ? (isCurrentTab ? 'bg-white' : 'bg-emerald-500') : 'bg-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Selected Day Configuration Form */}
                  {(() => {
                    const currentDayDetail = dailySchedules[selectedDayConfig] || {
                      start: startHour,
                      end: endHour,
                      checkInStart,
                      checkInEnd,
                      checkOutStart,
                      checkOutEnd,
                      isActive: activeDays.includes(selectedDayConfig),
                    };
                    const isDayActive = activeDays.includes(selectedDayConfig);

                    return (
                      <div className="space-y-4 pt-1">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Status Hari {selectedDayConfig}:
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isDayActive
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {isDayActive ? 'Aktif Tugas Piket' : 'Libur Sekolah'}
                            </span>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = !isDayActive;
                                if (nextState) {
                                  setActiveDays([...activeDays, selectedDayConfig]);
                                } else {
                                  if (activeDays.length > 1) {
                                    setActiveDays(activeDays.filter((d) => d !== selectedDayConfig));
                                  }
                                }
                                handleUpdateDaySchedule(selectedDayConfig, 'isActive', nextState);
                              }}
                              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {isDayActive ? 'Jadikan Hari Libur' : 'Aktifkan Hari Ini'}
                            </button>
                          )}
                        </div>

                        {/* Shift Times for Selected Day */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Jam Mulai Tugas Shift - {selectedDayConfig} (WIB)
                            </label>
                            <input
                              type="time"
                              disabled={!isAdmin}
                              value={currentDayDetail.start}
                              onChange={(e) =>
                                handleUpdateDaySchedule(selectedDayConfig, 'start', e.target.value)
                              }
                              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Jam Selesai Tugas Shift - {selectedDayConfig} (WIB)
                            </label>
                            <input
                              type="time"
                              disabled={!isAdmin}
                              value={currentDayDetail.end}
                              onChange={(e) =>
                                handleUpdateDaySchedule(selectedDayConfig, 'end', e.target.value)
                              }
                              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Check-in range for Selected Day */}
                        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
                          <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block">
                            Rentang Presensi Masuk Hari {selectedDayConfig} (Awal Buka s/d Batas Akhir)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Jam Awal Buka Presensi Masuk (WIB)
                              </label>
                              <input
                                type="time"
                                disabled={!isAdmin}
                                value={currentDayDetail.checkInStart}
                                onChange={(e) =>
                                  handleUpdateDaySchedule(selectedDayConfig, 'checkInStart', e.target.value)
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Jam Akhir Batas Presensi Masuk (WIB)
                              </label>
                              <input
                                type="time"
                                disabled={!isAdmin}
                                value={currentDayDetail.checkInEnd}
                                onChange={(e) =>
                                  handleUpdateDaySchedule(selectedDayConfig, 'checkInEnd', e.target.value)
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Check-out range for Selected Day */}
                        <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                          <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 block">
                            Rentang Presensi Pulang Hari {selectedDayConfig} (Awal Buka s/d Batas Akhir)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Jam Awal Buka Presensi Pulang (WIB)
                              </label>
                              <input
                                type="time"
                                disabled={!isAdmin}
                                value={currentDayDetail.checkOutStart}
                                onChange={(e) =>
                                  handleUpdateDaySchedule(selectedDayConfig, 'checkOutStart', e.target.value)
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Jam Akhir Batas Presensi Pulang (WIB)
                              </label>
                              <input
                                type="time"
                                disabled={!isAdmin}
                                value={currentDayDetail.checkOutEnd}
                                onChange={(e) =>
                                  handleUpdateDaySchedule(selectedDayConfig, 'checkOutEnd', e.target.value)
                                }
                                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingSchool}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Simpan Perubahan Pengaturan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}

      {/* TAB 2: SECURITY & SYSTEM DIAGNOSTICS */}
      {activeTab === 'security' && <SecurityCenterCard settings={settings} users={users} />}

      {/* TAB 3: BELL AUTOMATION & PANIC EMERGENCY */}
      {activeTab === 'bell' && (
        <BellEmergencyAutomationCard schoolName={settings.schoolName} />
      )}

      {/* TAB 4: POINT-IN-TIME CLOUD SNAPSHOTS */}
      {activeTab === 'snapshots' && <SnapshotManagerCard />}

      {/* TAB 5: BACKUP & RESTORE JSON */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Pemisahan Data Produksi & Seed (PIKET GURU v1.0.1) */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader
                title="Status Pemisahan Data & Integritas Sistem (PIKET GURU v1.0.1)"
                subtitle="Pemisahan data operasional (production) dan data contoh (seed/dummy) aktif di level data access layer"
              />
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">DATA MODE</span>
                    <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span>PRODUCTION</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Seluruh modul administrasi hanya membaca data operasional sah.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">DATA OPERASIONAL RESMI</span>
                    <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      Tersaring Otomatis
                    </div>
                    <p className="text-[11px] text-slate-500">Dashboard, Presensi, Buku Piket, dan Ekspor 100% data riil.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">STATUS SEED / DUMMY</span>
                    <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                      Terisolasi Aman
                    </div>
                    <p className="text-[11px] text-slate-500">Data seed tersimpan aman tanpa mencemari rekapitulasi sekolah.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Cadangkan Seluruh Database (Backup JSON)"
              subtitle="Ekspor seluruh 17 koleksi resmi Firestore ke satu berkas arsip terstruktur"
            />
            <CardContent className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                Berkas arsip JSON memuat seluruh koleksi: Pengguna, Guru, Staff, Ruangan, Jadwal, Presensi GPS, Jurnal Buku Piket, Insiden, Keterlambatan, Izin, Tamu, Guru Pengganti, Pengaturan, dan Riwayat Audit.
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  isLoading={isBackingUp}
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadBackup}
                >
                  Unduh Arsip Cadangan (.JSON)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Pulihkan Database dari Cadangan (Restore)"
              subtitle="Impor berkas JSON cadangan resmi aplikasi untuk disinkronkan ke database"
            />
            <CardContent className="p-5 space-y-4">
              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                Pilih berkas cadangan berekstensi <code>.json</code> yang sebelumnya diunduh dari aplikasi ini.
              </div>

              {isAdmin ? (
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs cursor-pointer hover:opacity-90 transition-opacity shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Pilih Berkas Cadangan (.JSON)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleFileRestoreUpload}
                  />
                </label>
              ) : (
                <p className="text-xs text-rose-600 font-semibold">
                  Hanya Administrator yang memiliki wewenang memulihkan database.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: THEME PREFERENCES */}
      {activeTab === 'theme' && <ThemeSettingsCard />}

      {/* TAB 7: FORENSIC AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <AuditForensicViewer logs={auditLogs} settings={settings} />
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      <RestoreConfirmModal
        isOpen={!!restorePayload}
        onClose={() => setRestorePayload(null)}
        backupData={restorePayload}
        onConfirmRestore={handleExecuteRestore}
      />
    </div>
  );
};
