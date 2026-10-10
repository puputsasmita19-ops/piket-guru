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
  Lock,
  LockOpen,
  Phone,
  Mail,
  MessageSquare,
  ExternalLink,
  HelpCircle,
  Tv,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { RestoreConfirmModal } from './RestoreConfirmModal';
import { ThemeSettingsCard } from './ThemeSettingsCard';
import { LobbyTvSettingsCard } from './LobbyTvSettingsCard';
import { SecurityCenterCard } from './SecurityCenterCard';
import { BellEmergencyAutomationCard } from './BellEmergencyAutomationCard';
import { SnapshotManagerCard } from './SnapshotManagerCard';
import { AuditForensicViewer } from './AuditForensicViewer';
import { OperationalResetCard } from './OperationalResetCard';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { BackupService, BackupPayload } from '../../services/backup/backupService';
import { LocationService } from '../../services/location/locationService';
import { SchoolSettingsService, schoolLocationDraftFromGps } from '../../services/firebase/schoolSettingsService';
import { formatTime } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { SchoolSettings, UserProfile, DayOfWeek, DayShiftDetail, LoginContactType, ScheduleItem } from '../../types';
import { DEFAULT_LOGIN_SUPPORT_CONTACT, DEFAULT_SCHOOL_SETTINGS, DEFAULT_DAILY_SCHEDULES } from '../../config/constants';
import { AuditLogRecord } from '../../types/master.types';
import { LobbyTvConfig } from '../../types/lobbyTv.types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { AnnouncementRecord } from '../../types/announcement.types';

type SettingsTab = 'school' | 'lobby_tv' | 'security' | 'bell' | 'snapshots' | 'backup' | 'theme' | 'audit';

const ALL_OPERATIONAL_DAYS: DayOfWeek[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

type SettingsFeedback = { tone: 'success' | 'error' | 'info'; message: string };
const InlineSettingsStatus = ({ status }: { status: SettingsFeedback | null }) => status ? (
  <div role={status.tone === 'error' ? 'alert' : 'status'} aria-live={status.tone === 'error' ? 'assertive' : 'polite'}
    className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${status.tone === 'success'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
      : status.tone === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
      : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'}`}>
    {status.tone === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
    <span>{status.message}</span>
  </div>
) : null;


export const SettingsView: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [tardiness, setTardiness] = useState<StudentTardyRecord[]>([]);
  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  // School Form State
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [npsn, setNpsn] = useState(DEFAULT_SCHOOL_SETTINGS.npsn);
  const [address, setAddress] = useState(DEFAULT_SCHOOL_SETTINGS.address);
  const [phone, setPhone] = useState(DEFAULT_SCHOOL_SETTINGS.phone || '021-78901234');
  const [email, setEmail] = useState(DEFAULT_SCHOOL_SETTINGS.email || 'info@sman1prestasibangsa.sch.id');
  const [website, setWebsite] = useState(DEFAULT_SCHOOL_SETTINGS.website || 'www.sman1prestasibangsa.sch.id');
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
  const [attendanceMode, setAttendanceMode] = useState<'TERJADWAL' | 'BEBAS'>(
    DEFAULT_SCHOOL_SETTINGS.attendanceMode || 'TERJADWAL'
  );

  // Signers & Academic Semester configuration
  const [reportCity, setReportCity] = useState(DEFAULT_SCHOOL_SETTINGS.reportCity || 'Jakarta');
  const [principalName, setPrincipalName] = useState(DEFAULT_SCHOOL_SETTINGS.principalName || 'Dr. Hj. Siti Rohmah, M.Pd.');
  const [principalIdType, setPrincipalIdType] = useState<'NIP' | 'NUPTK' | 'ID_GURU' | 'LAINNYA'>(
    DEFAULT_SCHOOL_SETTINGS.principalIdType || 'NIP'
  );
  const [principalIdNumber, setPrincipalIdNumber] = useState(DEFAULT_SCHOOL_SETTINGS.principalIdNumber || '197605122000032001');
  const [principalSignatureUrl, setPrincipalSignatureUrl] = useState(DEFAULT_SCHOOL_SETTINGS.principalSignatureUrl || '');
  const [coordinatorName, setCoordinatorName] = useState(DEFAULT_SCHOOL_SETTINGS.coordinatorName || 'Drs. H. Ahmad Fauzi, M.Pd.');
  const [coordinatorIdType, setCoordinatorIdType] = useState<'NIP' | 'NUPTK' | 'ID_GURU' | 'LAINNYA'>(
    DEFAULT_SCHOOL_SETTINGS.coordinatorIdType || 'NIP'
  );
  const [coordinatorIdNumber, setCoordinatorIdNumber] = useState(DEFAULT_SCHOOL_SETTINGS.coordinatorIdNumber || '198503152010011002');
  const [coordinatorSignatureUrl, setCoordinatorSignatureUrl] = useState(DEFAULT_SCHOOL_SETTINGS.coordinatorSignatureUrl || '');

  const [academicYear, setAcademicYear] = useState(DEFAULT_SCHOOL_SETTINGS.academicSemester?.academicYear || '2026/2027');
  const [oddSemesterStart, setOddSemesterStart] = useState(DEFAULT_SCHOOL_SETTINGS.academicSemester?.oddSemesterStart || '2026-07-01');
  const [oddSemesterEnd, setOddSemesterEnd] = useState(DEFAULT_SCHOOL_SETTINGS.academicSemester?.oddSemesterEnd || '2026-12-31');
  const [evenSemesterStart, setEvenSemesterStart] = useState(DEFAULT_SCHOOL_SETTINGS.academicSemester?.evenSemesterStart || '2027-01-01');
  const [evenSemesterEnd, setEvenSemesterEnd] = useState(DEFAULT_SCHOOL_SETTINGS.academicSemester?.evenSemesterEnd || '2027-06-30');

  const principalSigInputRef = useRef<HTMLInputElement>(null);
  const coordinatorSigInputRef = useRef<HTMLInputElement>(null);

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
  const [settingsReady, setSettingsReady] = useState(false);
  const [hasStoredLocation, setHasStoredLocation] = useState(false);
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isUnlockingLocation, setIsUnlockingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [schoolSaveStatus, setSchoolSaveStatus] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const mountedRef = useRef(false);
  const locationRequestRef = useRef(0);
  const locationBusy = isSavingLocation || isUnlockingLocation || isDetectingLocation;
  const locationDisabled = !isAdmin || !settingsReady || isLocationLocked || locationBusy || isSavingSchool;
  const locationDirty = !hasStoredLocation || schoolLat !== settings.schoolLat || schoolLng !== settings.schoolLng || allowedRadiusMeters !== settings.allowedRadiusMeters;


  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Kontak Bantuan Login State
  const [supportEnabled, setSupportEnabled] = useState<boolean>(DEFAULT_LOGIN_SUPPORT_CONTACT.enabled);
  const [supportAdminName, setSupportAdminName] = useState<string>(DEFAULT_LOGIN_SUPPORT_CONTACT.adminName);
  const [supportButtonLabel, setSupportButtonLabel] = useState<string>(DEFAULT_LOGIN_SUPPORT_CONTACT.buttonLabel);
  const [supportContactType, setSupportContactType] = useState<LoginContactType>(DEFAULT_LOGIN_SUPPORT_CONTACT.contactType);
  const [supportTarget, setSupportTarget] = useState<string>(DEFAULT_LOGIN_SUPPORT_CONTACT.target);
  const [supportInitialMessage, setSupportInitialMessage] = useState<string>(DEFAULT_LOGIN_SUPPORT_CONTACT.initialMessage || '');

  const validateContactTarget = (type: LoginContactType, value: string): string | null => {
    const val = value.trim();
    if (!val) {
      return type === 'email' ? 'Alamat email tujuan tidak boleh kosong.' : 'Nomor kontak tujuan tidak boleh kosong.';
    }
    if (type === 'whatsapp') {
      const cleanDigits = val.replace(/[^0-9]/g, '');
      if (cleanDigits.length < 9 || cleanDigits.length > 16) {
        return 'Nomor WhatsApp harus terdiri dari 9 - 16 digit angka (contoh: 081234567890 atau 6281234567890).';
      }
    } else if (type === 'phone') {
      const cleanDigits = val.replace(/[^0-9]/g, '');
      if (cleanDigits.length < 7 || cleanDigits.length > 16) {
        return 'Nomor telepon harus terdiri dari 7 - 16 digit angka (contoh: 021-78901234 atau 081234567890).';
      }
    } else if (type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return 'Format email tidak valid (contoh: admin@smkdrsoebandi.sch.id).';
      }
    }
    return null;
  };

  const handleTestContact = () => {
    const errorMsg = validateContactTarget(supportContactType, supportTarget);
    if (errorMsg) {
      alert(`Validasi kontak bantuan belum sesuai:\n${errorMsg}`);
      return;
    }
    const val = supportTarget.trim();
    if (supportContactType === 'whatsapp') {
      let clean = val.replace(/[^0-9]/g, '');
      if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
      }
      // Membuka tujuan tanpa mengirim pesan otomatis
      window.open(`https://wa.me/${clean}`, '_blank', 'noopener,noreferrer');
    } else if (supportContactType === 'phone') {
      const cleanPhone = val.replace(/[^0-9+]/g, '');
      window.open(`tel:${cleanPhone}`, '_self');
    } else if (supportContactType === 'email') {
      window.open(`mailto:${val}`, '_self');
    }
  };

  // Load Settings, Users, and Logs
  useEffect(() => {
    mountedRef.current = true;
    SchoolSettingsService.load().then((data) => {
      if (!mountedRef.current) return;
      setSettingsReady(true);
      setHasStoredLocation(!!data);
      setIsLocationLocked(data?.schoolLocationLocked === true);
      if (data) {
        setSettings(data);
        setSchoolName(data.schoolName);
        setNpsn(data.npsn);
        setAddress(data.address);
        if (data.appName) setAppName(data.appName);
        if (data.appSubtitle) setAppSubtitle(data.appSubtitle);
        if (data.appCreator) setAppCreator(data.appCreator);
        if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        if (data.website) setWebsite(data.website);
        if (data.reportCity) setReportCity(data.reportCity);
        if (data.principalName) setPrincipalName(data.principalName);
        if (data.principalIdType) setPrincipalIdType(data.principalIdType);
        if (data.principalIdNumber) setPrincipalIdNumber(data.principalIdNumber);
        if (data.principalSignatureUrl !== undefined) setPrincipalSignatureUrl(data.principalSignatureUrl);
        if (data.coordinatorName) setCoordinatorName(data.coordinatorName);
        if (data.coordinatorIdType) setCoordinatorIdType(data.coordinatorIdType);
        if (data.coordinatorIdNumber) setCoordinatorIdNumber(data.coordinatorIdNumber);
        if (data.coordinatorSignatureUrl !== undefined) setCoordinatorSignatureUrl(data.coordinatorSignatureUrl);
        if (data.academicSemester) {
          if (data.academicSemester.academicYear) setAcademicYear(data.academicSemester.academicYear);
          if (data.academicSemester.oddSemesterStart) setOddSemesterStart(data.academicSemester.oddSemesterStart);
          if (data.academicSemester.oddSemesterEnd) setOddSemesterEnd(data.academicSemester.oddSemesterEnd);
          if (data.academicSemester.evenSemesterStart) setEvenSemesterStart(data.academicSemester.evenSemesterStart);
          if (data.academicSemester.evenSemesterEnd) setEvenSemesterEnd(data.academicSemester.evenSemesterEnd);
        }
        if (data.loginSupportContact) {
          setSupportEnabled(data.loginSupportContact.enabled !== false);
          if (data.loginSupportContact.adminName) setSupportAdminName(data.loginSupportContact.adminName);
          if (data.loginSupportContact.buttonLabel) setSupportButtonLabel(data.loginSupportContact.buttonLabel);
          if (data.loginSupportContact.contactType) setSupportContactType(data.loginSupportContact.contactType);
          if (data.loginSupportContact.target !== undefined) setSupportTarget(data.loginSupportContact.target);
          if (data.loginSupportContact.initialMessage !== undefined) setSupportInitialMessage(data.loginSupportContact.initialMessage);
        }
        setSchoolLat(data.schoolLat);
        setSchoolLng(data.schoolLng);
        setAllowedRadiusMeters(data.allowedRadiusMeters);
        if (data.attendanceMode) setAttendanceMode(data.attendanceMode);
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
      } else {
        // A default coordinate is never presented as a confirmed school location.
        setSchoolLat(NaN);
        setSchoolLng(NaN);
      }
    }).catch(() => {
      if (mountedRef.current) setLocationStatus({ tone: 'error', message: 'Pengaturan lokasi belum dapat dibaca dari server. Periksa koneksi atau izin akun, lalu klik Muat Ulang Status. Penyimpanan dinonaktifkan sampai status server dapat dibaca.' });
    });

    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {
      setUsers(data);
    });

    const unsubLogs = FirestoreService.subscribeToCollection<AuditLogRecord>('auditLogs', (data) => {
      setAuditLogs(
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubSub = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', setSubstitutions);
    const unsubTrd = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setTardiness);
    const unsubPmt = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setPermits);
    const unsubVis = FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors);
    const unsubAnnounce = FirestoreService.subscribeToCollection<AnnouncementRecord>('announcements', setAnnouncements);

    return () => {
      mountedRef.current = false;
      locationRequestRef.current++;
      LocationService.clearCurrentWatcher();
      unsubUsers();
      unsubLogs();
      unsubSched();
      unsubSub();
      unsubTrd();
      unsubPmt();
      unsubVis();
      unsubAnnounce();
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

  const handlePrincipalSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file tanda tangan maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) setPrincipalSignatureUrl(res);
    };
    reader.readAsDataURL(file);
  };

  const handleCoordinatorSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file tanda tangan maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) setCoordinatorSignatureUrl(res);
    };
    reader.readAsDataURL(file);
  };

  const draftSchoolSettings = (): SchoolSettings => ({
    schoolName,
    npsn,
    address,
    phone: phone.trim(),
    email: email.trim(),
    website: website.trim(),
    appName: appName.trim() || 'PIKET GURU',
    appSubtitle: appSubtitle.trim() || 'Jadwal & Buku Piket Digital Sekolah',
    appCreator: appCreator.trim(),
    logoUrl: logoUrl.trim(),
    schoolLat,
    schoolLng,
    allowedRadiusMeters,
    attendanceMode,
    reportCity: reportCity.trim() || 'Jakarta',
    principalName: principalName.trim(),
    principalIdType,
    principalIdNumber: principalIdNumber.trim(),
    principalSignatureUrl: principalSignatureUrl.trim(),
    coordinatorName: coordinatorName.trim(),
    coordinatorIdType,
    coordinatorIdNumber: coordinatorIdNumber.trim(),
    coordinatorSignatureUrl: coordinatorSignatureUrl.trim(),
    academicSemester: {
      academicYear: academicYear.trim(),
      oddSemesterStart,
      oddSemesterEnd,
      evenSemesterStart,
      evenSemesterEnd,
    },
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
    loginSupportContact: {
      enabled: supportEnabled,
      adminName: supportAdminName.trim() || 'Admin Piket Sekolah',
      buttonLabel: supportButtonLabel.trim() || 'Hubungi Admin',
      contactType: supportContactType,
      target: supportTarget.trim(),
      initialMessage: supportInitialMessage.trim(),
    },
  });

  const applyStoredLocation = (stored: SchoolSettings) => {
    setSettings(stored);
    setHasStoredLocation(true);
    setIsLocationLocked(stored.schoolLocationLocked === true);
    setSchoolLat(stored.schoolLat);
    setSchoolLng(stored.schoolLng);
    setAllowedRadiusMeters(stored.allowedRadiusMeters);
    setSettingsReady(true);
    // Local cache is a convenience only; receipt and teacher coordinates come from Firestore.
    try { localStorage.setItem('piket_guru_school_config', JSON.stringify(stored)); } catch { /* Optional cache. */ }
  };

  const errorMessage = (err: any) => err?.code === 'permission-denied'
    ? 'Izin penyimpanan ditolak Firebase. Pastikan akun ADMIN aktif dan Rules lokasi versi terbaru tersedia di lingkungan pengujian.'
    : err?.message || 'Gagal menyimpan. Periksa koneksi lalu coba kembali.';

  const auditSettings = (details: string) => {
    if (!currentUser) return;
    void FirestoreService.logAudit({ userId: currentUser.id, userName: currentUser.fullName, role: currentUser.role,
      action: 'UPDATE', module: 'SETTINGS', details }).catch(() => console.warn('Pengaturan sudah tersimpan; log audit belum dapat disimpan.'));
  };

  const markLocationDraft = () => {
    setLocationAccuracy(null);
    setLocationStatus({ tone: 'info', message: 'Perubahan koordinat/radius belum disimpan. Guru tetap memakai lokasi pada server. Klik Simpan & Kunci Lokasi untuk menerapkan perubahan.' });
  };

  const handleSaveLocation = async () => {
    if (!currentUser || !isAdmin || locationDisabled) return;
    setIsSavingLocation(true);
    setLocationStatus({ tone: 'info', message: 'Menyimpan dan mengunci lokasi sekolah ke server...' });
    try {
      const result = await SchoolSettingsService.saveAndLockLocation(draftSchoolSettings(), currentUser.id);
      if (!mountedRef.current) return;
      applyStoredLocation(result.settings);
      setLocationStatus({ tone: result.confirmed ? 'success' : 'info', message: result.confirmed
        ? `Lokasi tersimpan di server dan ${result.settings.schoolLocationLocked ? 'dikunci' : 'saat ini terbuka'}. Koordinat ${result.settings.schoolLat.toFixed(6)}, ${result.settings.schoolLng.toFixed(6)}; radius ${result.settings.allowedRadiusMeters} meter. Lokasi inilah yang menjadi acuan presensi guru.`
        : 'Penyimpanan dan kunci berhasil dikirim ke server, tetapi pembacaan ulang belum tersedia. Klik Muat Ulang Status untuk memastikan tampilan terbaru; jangan mengirim ulang penyimpanan.' });
      auditSettings('Menyimpan dan mengunci titik GPS sekolah untuk acuan presensi.');
    } catch (err) {
      if (mountedRef.current) setLocationStatus({ tone: 'error', message: errorMessage(err) });
    } finally { if (mountedRef.current) setIsSavingLocation(false); }
  };

  const handleUnlockLocation = async () => {
    if (!currentUser || !isAdmin || !isLocationLocked || locationBusy || isSavingSchool) return;
    setIsUnlockingLocation(true);
    try {
      const result = await SchoolSettingsService.unlockLocation(currentUser.id);
      if (!mountedRef.current) return;
      applyStoredLocation(result.settings);
      setLocationStatus({ tone: result.confirmed ? 'success' : 'info', message: result.confirmed
        ? 'Kunci lokasi dibuka. Koordinat tersimpan tetap sama. Guru tetap memakai lokasi tersebut sampai Anda menyimpan dan mengunci koordinat yang baru.'
        : 'Permintaan buka kunci tersimpan, tetapi pembacaan ulang belum tersedia. Klik Muat Ulang Status sebelum mengedit.' });
      if (!result.confirmed) setSettingsReady(false);
      auditSettings('Membuka kunci lokasi sekolah tanpa mengubah koordinat atau radius tersimpan.');
    } catch (err) {
      if (mountedRef.current) setLocationStatus({ tone: 'error', message: errorMessage(err) });
    } finally { if (mountedRef.current) setIsUnlockingLocation(false); }
  };

  const handleReloadLocation = async () => {
    if (locationBusy || isSavingSchool) return;
    setSettingsReady(false);
    setLocationStatus({ tone: 'info', message: 'Membaca status lokasi dari server...' });
    try {
      const stored = await SchoolSettingsService.load();
      if (!mountedRef.current) return;
      if (stored) {
        applyStoredLocation(stored);
        setLocationStatus({ tone: 'success', message: `Status server diperbarui: lokasi ${stored.schoolLocationLocked ? 'terkunci' : 'terbuka'}. Koordinat dan radius yang tampil sesuai data tersimpan.` });
      } else {
        setSettingsReady(true); setHasStoredLocation(false); setIsLocationLocked(false);
        setSchoolLat(NaN); setSchoolLng(NaN);
        setLocationStatus({ tone: 'info', message: 'Belum ada lokasi sekolah tersimpan. Tentukan titik sekolah, lalu Simpan & Kunci Lokasi.' });
      }
    } catch (err) {
      if (mountedRef.current) setLocationStatus({ tone: 'error', message: errorMessage(err) });
    }
  };

  // Profile/work-hours save never changes the authoritative location or its lock.
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin || !settingsReady || isSavingSchool || locationBusy) return;
    setIsSavingSchool(true);
    setSaveSuccessBanner(null);
    setSchoolSaveStatus({ tone: 'info', message: 'Menyimpan profil dan jam sekolah ke server...' });
    try {
      const result = await SchoolSettingsService.saveProfile(draftSchoolSettings(), currentUser.id);
      if (!mountedRef.current) return;
      setSettings(result.settings);
      if (result.settings.schoolLocationLocked === true) applyStoredLocation(result.settings);
      const message = result.confirmed ? 'Profil, branding, dan jam sekolah berhasil disimpan. Koordinat dan kunci lokasi tetap mengikuti data server.'
        : 'Perubahan profil tersimpan; pembacaan ulang server belum tersedia. Jangan mengirim ulang. Muat ulang status saat koneksi pulih.';
      setSchoolSaveStatus({ tone: result.confirmed ? 'success' : 'info', message });
      setSaveSuccessBanner(result.confirmed ? message : null);
      auditSettings(`Memperbarui profil, branding, dan jam sekolah (${activeDays.join(', ')}); lokasi GPS dipertahankan.`);
    } catch (err) {
      if (mountedRef.current) setSchoolSaveStatus({ tone: 'error', message: errorMessage(err) });
    } finally { if (mountedRef.current) setIsSavingSchool(false); }
  };

  // Detection changes only the unlocked draft; saving requires a separate explicit action.
  const handleDetectCurrentLocation = async () => {
    if (locationDisabled) return;
    const requestId = ++locationRequestRef.current;
    setIsDetectingLocation(true);
    setLocationStatus({ tone: 'info', message: 'Mendeteksi titik sekolah dari perangkat, maksimal 10 detik. Hasil belum otomatis disimpan.' });
    try {
      const pos = await LocationService.getCurrentPosition();
      if (!mountedRef.current || requestId !== locationRequestRef.current) return;
      setLocationAccuracy(pos.accuracy);
      const draft = schoolLocationDraftFromGps(pos);
      setSchoolLat(draft.schoolLat);
      setSchoolLng(draft.schoolLng);
      setLocationStatus({ tone: 'info', message: `Lokasi terdeteksi: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)} (±${Math.round(pos.accuracy)} meter). Belum disimpan. Periksa titiknya lalu klik Simpan & Kunci Lokasi.` });
    } catch (err: any) {
      if (mountedRef.current && requestId === locationRequestRef.current && err?.name !== 'AbortError') {
        setLocationStatus({ tone: 'error', message: errorMessage(err) });
      }
    } finally {
      if (mountedRef.current && requestId === locationRequestRef.current) setIsDetectingLocation(false);
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

  // --- SAVE LOBBY TV CONFIGURATION (AUTHORITATIVE SERVER PERSISTENCE) ---
  const handleSaveTvSettings = async (updatedTvConfig: LobbyTvConfig) => {
    if (!currentUser?.id) {
      throw new Error('Sesi tidak valid. Silakan login kembali.');
    }
    const result = await SchoolSettingsService.saveTvSettings(updatedTvConfig, currentUser.id);
    setSettings(result.settings);
    setSaveSuccessBanner(
      'Pengaturan TV Lobi berhasil disimpan ke server sekolah dan disinkronkan ke seluruh monitor TV aktif.'
    );
    setTimeout(() => setSaveSuccessBanner(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[var(--theme-primary)]" />
            Pengaturan Sistem, Keamanan & Otomasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tata kelola profil instansi, Geofence presensi, audit forensik, snapshot darurat, dan bel sekolah otomatis
          </p>
        </div>

        {/* Tab Switcher (CR-006: Clean layout aligned with adjacent menus, no truncation) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[var(--theme-surface-subtle)] p-1.5 rounded-2xl overflow-x-auto max-w-full scrollbar-thin">
          <button
            onClick={() => setActiveTab('school')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'school'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
            Profil & GPS
          </button>
          <button
            onClick={() => setActiveTab('lobby_tv')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'lobby_tv'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            Pengaturan TV Lobi
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'security'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
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
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
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
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
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
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
            Pemeliharaan &amp; Backup
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'theme'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
            Tema
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No. Telepon / Fax Sekolah
                  </label>
                  <input
                    disabled={!isAdmin}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="021-..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Alamat Email Resmi
                  </label>
                  <input
                    type="email"
                    disabled={!isAdmin}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@sekolah.sch.id"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Website Resmi
                  </label>
                  <input
                    disabled={!isAdmin}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.sekolah.sch.id"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Pengaturan Kalender Semester Akademik */}
          <Card>
            <CardHeader
              title="Pengaturan Batas Tanggal Semester & Tahun Pelajaran"
              subtitle="Acuan resmi rentang filter laporan rekap semesteran agar sesuai dengan kalender akademik sekolah"
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tahun Pelajaran Aktif
                </label>
                <input
                  disabled={!isAdmin}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="Contoh: 2026/2027"
                  className="w-full sm:w-64 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Semester Ganjil */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Batas Semester Ganjil (Gasal)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-500 block">Tanggal Mulai:</label>
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={oddSemesterStart}
                        onChange={(e) => setOddSemesterStart(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Tanggal Selesai:</label>
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={oddSemesterEnd}
                        onChange={(e) => setOddSemesterEnd(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Semester Genap */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Batas Semester Genap
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-500 block">Tanggal Mulai:</label>
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={evenSemesterStart}
                        onChange={(e) => setEvenSemesterStart(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block">Tanggal Selesai:</label>
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={evenSemesterEnd}
                        onChange={(e) => setEvenSemesterEnd(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Pengaturan Penandatangan & Pengesahan Laporan Resmi */}
          <Card>
            <CardHeader
              title="Pengaturan Penandatangan & Pengesahan Dokumen Laporan"
              subtitle="Konfigurasi pejabat pengesah (Kepala Sekolah & Koordinator Piket) dan ruang tanda tangan/stempel pada berkas cetak"
            />
            <CardContent className="p-5 sm:p-6 space-y-6">
              <div className="space-y-1 sm:w-80">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tempat Penerbitan / Kota Terbit Laporan
                </label>
                <input
                  disabled={!isAdmin}
                  value={reportCity}
                  onChange={(e) => setReportCity(e.target.value)}
                  placeholder="Contoh: Jakarta, Bandung, Surabaya"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* 1. Kepala Sekolah */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                    1. Pejabat Pengesah: Kepala Sekolah
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Nama Lengkap beserta Gelar:
                    </label>
                    <input
                      disabled={!isAdmin}
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      placeholder="Dr. Hj. Siti Rohmah, M.Pd."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Jenis Identitas Pegawai:
                      </label>
                      <select
                        disabled={!isAdmin}
                        value={principalIdType}
                        onChange={(e) => setPrincipalIdType(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                      >
                        <option value="NIP">NIP</option>
                        <option value="NUPTK">NUPTK</option>
                        <option value="ID_GURU">ID Guru</option>
                        <option value="LAINNYA">Lainnya / Tanpa Label</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Nomor Identitas:
                      </label>
                      <input
                        disabled={!isAdmin}
                        value={principalIdNumber}
                        onChange={(e) => setPrincipalIdNumber(e.target.value)}
                        placeholder="197605122000032001"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Principal Signature Upload */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Gambar Tanda Tangan / Stempel Digital (Opsional):
                    </label>
                    <input
                      type="file"
                      ref={principalSigInputRef}
                      onChange={handlePrincipalSigUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-14 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center p-1">
                        {principalSignatureUrl ? (
                          <img src={principalSignatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Manual</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isAdmin}
                          onClick={() => principalSigInputRef.current?.click()}
                          className="text-[11px] cursor-pointer"
                        >
                          Unggah TTD
                        </Button>
                        {principalSignatureUrl && isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPrincipalSignatureUrl('')}
                            className="text-[11px] text-rose-600 hover:text-rose-700 cursor-pointer"
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Koordinator Tim Piket */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                    2. Pejabat Pengesah: Koordinator Tim Piket
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Nama Lengkap beserta Gelar:
                    </label>
                    <input
                      disabled={!isAdmin}
                      value={coordinatorName}
                      onChange={(e) => setCoordinatorName(e.target.value)}
                      placeholder="Drs. H. Ahmad Fauzi, M.Pd."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Jenis Identitas Pegawai:
                      </label>
                      <select
                        disabled={!isAdmin}
                        value={coordinatorIdType}
                        onChange={(e) => setCoordinatorIdType(e.target.value as any)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                      >
                        <option value="NIP">NIP</option>
                        <option value="NUPTK">NUPTK</option>
                        <option value="ID_GURU">ID Guru</option>
                        <option value="LAINNYA">Lainnya / Tanpa Label</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Nomor Identitas:
                      </label>
                      <input
                        disabled={!isAdmin}
                        value={coordinatorIdNumber}
                        onChange={(e) => setCoordinatorIdNumber(e.target.value)}
                        placeholder="198503152010011002"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Coordinator Signature Upload */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Gambar Tanda Tangan / Stempel Digital (Opsional):
                    </label>
                    <input
                      type="file"
                      ref={coordinatorSigInputRef}
                      onChange={handleCoordinatorSigUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-14 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center p-1">
                        {coordinatorSignatureUrl ? (
                          <img src={coordinatorSignatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Manual</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isAdmin}
                          onClick={() => coordinatorSigInputRef.current?.click()}
                          className="text-[11px] cursor-pointer"
                        >
                          Unggah TTD
                        </Button>
                        {coordinatorSignatureUrl && isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCoordinatorSignatureUrl('')}
                            className="text-[11px] text-rose-600 hover:text-rose-700 cursor-pointer"
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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

          {/* Card Kontak Bantuan Login (Hubungi Admin) */}
          <Card>
            <CardHeader
              title="Kontak Bantuan Login (Hubungi Admin)"
              subtitle="Kelola tombol bantuan 'Hubungi Admin' yang tampil di halaman login untuk guru dan petugas piket"
            />
            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Toggle Aktif / Nonaktif */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <span>Tampilkan Tombol Bantuan di Halaman Login</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Jika dinonaktifkan, tombol Hubungi Admin akan disembunyikan sepenuhnya dari halaman login
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={supportEnabled}
                    onChange={(e) => setSupportEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {supportEnabled && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Nama Admin / Unit Bantuan */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Nama Admin / Unit Bantuan</span>
                        <span className="text-[10px] text-slate-400 font-normal">Identitas kontak</span>
                      </label>
                      <input
                        disabled={!isAdmin}
                        value={supportAdminName}
                        onChange={(e) => setSupportAdminName(e.target.value)}
                        placeholder="Contoh: Admin Piket Sekolah / Tim IT"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Label Tombol */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Label Tombol</span>
                        <span className="text-[10px] text-slate-400 font-normal">Default: Hubungi Admin</span>
                      </label>
                      <input
                        disabled={!isAdmin}
                        value={supportButtonLabel}
                        onChange={(e) => setSupportButtonLabel(e.target.value)}
                        placeholder="Contoh: Hubungi Admin / Bantuan Login"
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Jenis Kontak */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Jenis Saluran Kontak
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { type: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
                        { type: 'phone' as const, label: 'Telepon', icon: Phone, color: 'text-blue-500' },
                        { type: 'email' as const, label: 'Email', icon: Mail, color: 'text-indigo-500' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = supportContactType === item.type;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => {
                              setSupportContactType(item.type);
                            }}
                            className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${item.color}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nomor Tujuan / Alamat Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>
                        {supportContactType === 'whatsapp'
                          ? 'Nomor WhatsApp Tujuan'
                          : supportContactType === 'phone'
                          ? 'Nomor Telepon Tujuan'
                          : 'Alamat Email Tujuan'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Disimpan sebagai string teks</span>
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={supportTarget}
                      onChange={(e) => setSupportTarget(e.target.value)}
                      placeholder={
                        supportContactType === 'whatsapp'
                          ? 'Contoh: 081234567890 atau 6281234567890'
                          : supportContactType === 'phone'
                          ? 'Contoh: 021-78901234 atau 081234567890'
                          : 'Contoh: admin@smkdrsoebandi.sch.id'
                      }
                      className={`w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white ${
                        validateContactTarget(supportContactType, supportTarget)
                          ? 'border-amber-400 dark:border-amber-500 focus:ring-2 focus:ring-amber-400'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {validateContactTarget(supportContactType, supportTarget) && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{validateContactTarget(supportContactType, supportTarget)}</span>
                      </p>
                    )}
                  </div>

                  {/* Pesan Awal Bantuan (WhatsApp & Email) */}
                  {(supportContactType === 'whatsapp' || supportContactType === 'email') && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Pesan Awal Bantuan (Template Pesan)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Dapat diedit oleh pengguna</span>
                      </label>
                      <textarea
                        rows={2}
                        disabled={!isAdmin}
                        value={supportInitialMessage}
                        onChange={(e) => setSupportInitialMessage(e.target.value)}
                        placeholder="Halo Admin, saya membutuhkan bantuan terkait akses login akun Piket Guru."
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white resize-y"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Template pesan awal saat membuka WhatsApp atau Email. Catatan: Jangan sertakan kredensial atau PIN di sini.
                      </p>
                    </div>
                  )}

                  {/* Pratinjau Tombol & Coba Kontak */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Pratinjau Tombol di Halaman Login:</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Unit Bantuan: <strong>{supportAdminName || 'Admin Piket'}</strong> • Saluran: <strong>{supportContactType.toUpperCase()}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-default"
                      >
                        {supportContactType === 'whatsapp' ? (
                          <MessageSquare className="w-4 h-4 text-emerald-500" />
                        ) : supportContactType === 'phone' ? (
                          <Phone className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Mail className="w-4 h-4 text-indigo-500" />
                        )}
                        <span>{supportButtonLabel || 'Hubungi Admin'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTestContact}
                        disabled={!supportTarget.trim() || !!validateContactTarget(supportContactType, supportTarget)}
                        className="min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Buka tujuan kontak tanpa mengirim pesan otomatis"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Coba Kontak</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                    disabled={locationDisabled}
                  >
                    {isDetectingLocation ? 'Mencari Lokasi...' : 'Deteksi Lokasi Sekolah'}
                  </Button>
                )
              }
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs">
                <div className="font-bold flex items-center gap-2">
                  {isLocationLocked ? <Lock className="w-4 h-4 text-emerald-600" /> : <LockOpen className="w-4 h-4 text-amber-600" />}
                  {!settingsReady ? 'Status server belum tersedia' : isLocationLocked ? 'Lokasi Sekolah Terkunci' : 'Lokasi Terbuka untuk Diedit Admin'}
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Kunci ini disimpan di server dan tetap berlaku setelah halaman dibuka kembali. GPS guru mengukur posisi guru, tanpa mengubah titik sekolah.
                </p>
                {hasStoredLocation && Number.isFinite(settings.schoolLat) && Number.isFinite(settings.schoolLng) ? (
                  <p className="font-mono text-[11px] break-words">
                    Acuan tersimpan: {settings.schoolLat.toFixed(6)}, {settings.schoolLng.toFixed(6)} · radius {settings.allowedRadiusMeters} meter
                    {settings.schoolLocationSavedAt ? ` · disimpan ${formatTime(settings.schoolLocationSavedAt, true)}` : ''}
                  </p>
                ) : <p className="text-amber-700 dark:text-amber-300">Belum ada koordinat sekolah yang terkonfirmasi. Nilai formulir belum menjadi bukti penyimpanan.</p>}
                {!isLocationLocked && locationDirty && <p className="text-amber-700 dark:text-amber-300">Koordinat/radius pada formulir belum disimpan.</p>}
                {locationAccuracy !== null && <p>Akurasi hasil deteksi terakhir: ±{Math.round(locationAccuracy)} meter.</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={locationDisabled}
                    min={-90}
                    max={90}
                    value={Number.isFinite(schoolLat) ? schoolLat : ''}
                    onChange={(e) => { setSchoolLat(e.target.value === '' ? NaN : Number(e.target.value)); markLocationDraft(); }}
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
                    disabled={locationDisabled}
                    min={-180}
                    max={180}
                    value={Number.isFinite(schoolLng) ? schoolLng : ''}
                    onChange={(e) => { setSchoolLng(e.target.value === '' ? NaN : Number(e.target.value)); markLocationDraft(); }}
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
                    disabled={locationDisabled}
                    value={Number.isFinite(allowedRadiusMeters) ? allowedRadiusMeters : ''}
                    onChange={(e) => { setAllowedRadiusMeters(e.target.value === '' ? NaN : Number(e.target.value)); markLocationDraft(); }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && (isLocationLocked ? (
                  <Button type="button" variant="outline" size="sm" isLoading={isUnlockingLocation}
                    disabled={!settingsReady || locationBusy || isSavingSchool} leftIcon={<LockOpen className="w-4 h-4" />} onClick={handleUnlockLocation}>
                    Buka Kunci Lokasi
                  </Button>
                ) : (
                  <Button type="button" variant="primary" size="sm" isLoading={isSavingLocation}
                    disabled={locationDisabled} leftIcon={<Lock className="w-4 h-4" />} onClick={handleSaveLocation}>
                    Simpan &amp; Kunci Lokasi
                  </Button>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={locationBusy || isSavingSchool}
                  onClick={handleReloadLocation}>Muat Ulang Status</Button>
              </div>
              <InlineSettingsStatus status={locationStatus} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Deteksi hanya mengisi formulir. Simpan &amp; Kunci Lokasi menetapkan titik acuan presensi guru. Buka kunci tidak mengubah titik tersebut.
                Muat Ulang Status mengganti isian lokasi dengan data server. Simpan profil/jam sekolah di bawah tidak menyimpan perubahan koordinat.
              </p>

              {/* Kebijakan Mode Presensi: TERJADWAL vs BEBAS */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Kebijakan Mode Presensi Guru Piket</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Pilih apakah guru wajib memiliki jadwal harian khusus atau diizinkan presensi fleksibel (Mode Bebas)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => isAdmin && setAttendanceMode('TERJADWAL')}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      attendanceMode === 'TERJADWAL'
                        ? 'bg-blue-50/70 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${attendanceMode === 'TERJADWAL' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        Mode Terjadwal (Standar)
                      </span>
                      {attendanceMode === 'TERJADWAL' && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Wajib penugasan jadwal piket hari ini. Mengikuti rentang jam buka &amp; batas akhir presensi masuk dan pulang.
                    </p>
                  </div>

                  <div
                    onClick={() => isAdmin && setAttendanceMode('BEBAS')}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      attendanceMode === 'BEBAS'
                        ? 'bg-emerald-50/70 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${attendanceMode === 'BEBAS' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                        Mode Bebas (Tanpa Jadwal)
                      </span>
                      {attendanceMode === 'BEBAS' && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Boleh presensi mandiri tanpa jadwal harian. Bebas jam datang &amp; pulang. Tetap wajib akun aktif, GPS akurat dalam radius, dan swafoto.
                    </p>
                  </div>
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
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <InlineSettingsStatus status={schoolSaveStatus} />
                  <InlineSettingsStatus status={locationStatus} />
                  <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingSchool}
                    disabled={!settingsReady || locationBusy}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Simpan Profil &amp; Jam Sekolah
                  </Button>
                  </div>
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

          {/* FITUR PEMELIHARAAN: RESET DATA OPERASIONAL */}
          {currentUser && (
            <div className="md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <OperationalResetCard
                currentUser={currentUser}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB: LOBBY TV CONFIGURATION */}
      {activeTab === 'lobby_tv' && (
        <LobbyTvSettingsCard
          settings={settings}
          isAdmin={isAdmin}
          onSaveTvSettings={handleSaveTvSettings}
          schedules={schedules}
          substitutions={substitutions}
          tardiness={tardiness}
          permits={permits}
          visitors={visitors}
          announcements={announcements}
        />
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
