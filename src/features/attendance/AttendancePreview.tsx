import { useHistoryPeriod, useHistoryPagination } from '../../hooks/useHistoryPeriod';
import { HistoryControls, HistoryTable, HistoryPagination, useHistoryView } from '../../components/common/HistoryControls';
import { attendanceDuration } from '../../utils/historyPeriod';
import { XCircle } from '../../components/icons';
import { AlertCircle } from '../../components/icons';
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Clock,
  Image as ImageIcon,
  Check,
  Trash2,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { ContextualHelp, Tooltip } from '../../components/common/Tooltip';
import { LocationService, LocationCoordinates, GeofenceResult } from '../../services/location/locationService';
import { where, limit } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { AttendanceService } from '../../services/firebase/attendanceService';
import { useAuth } from '../../contexts/AuthContext';
import { DraftService } from '../../services/offline/draftService';
import { PERMISSIONS } from '../../config/permissions';
import { AttendanceRecord, AttendanceStatus, ScheduleItem, SchoolSettings } from '../../types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName, getTodayISODate, toEpochMs } from '../../utils/dateUtils';
import { isScheduleMatchingUser, getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import AttendanceMapPreview from './AttendanceMapPreview';
import './attendanceGps.css';
import { shouldGuideToSelfie } from './selfieGpsGuide';
import { shouldHighlightCheckIn, shouldHighlightCheckOut } from './attendanceActionHighlight';
import { AttendancePolicy, WindowCheckResult } from '../../services/attendance/attendancePolicy';
import { CapturedSelfie, prepareSelfieWatermarkFont, stampCheckInSelfie, validateSelfieForSubmission } from '../../services/attendance/selfieWatermark';
import { AdminAttendanceDialog, AdminAttendanceSelection } from './AdminAttendanceDialog';

interface AttendanceFeedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

const InlineAttendanceStatus: React.FC<{ status: AttendanceFeedback | null }> = ({ status }) => {
  if (!status) return null;

  return (
    <div
      role={status.tone === 'error' ? 'alert' : 'status'}
      aria-live={status.tone === 'error' ? 'assertive' : 'polite'}
      className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 transition-all w-full ${
        status.tone === 'success'
          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
          : status.tone === 'error'
          ? 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
          : 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border-[var(--theme-primary-border)]'
      }`}
    >
      {status.tone === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
      ) : status.tone === 'error' ? (
        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
      ) : (
        <Clock className="w-4 h-4 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 font-semibold">{status.message}</div>
    </div>
  );
};

export const AttendancePreview: React.FC = () => {
  const { currentUser, hasRole, hasPermission, isOffline } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const canManageHistory = hasRole('ADMIN');
  const [adminSelection, setAdminSelection] = useState<AdminAttendanceSelection | null>(null);
  const [adminFeedback, setAdminFeedback] = useState('');

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  
  // GPS Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [isProvisional, setIsProvisional] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [coords, setCoords] = useState<LocationCoordinates | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);
  const gpsRequestRef = React.useRef(0);
  const selfieTargetRef = React.useRef<HTMLDivElement | null>(null);
  const selfieTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const autoGuidedSelfieKeyRef = React.useRef('');
  const [highlightSelfieStep, setHighlightSelfieStep] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const warmSelfieGpsRef = React.useRef<Promise<LocationCoordinates> | null>(null);
  const warmSelfieContextRef = React.useRef('');
  const validSchoolLocation = Number.isFinite(settings.schoolLat) && Math.abs(settings.schoolLat) <= 90 &&
    Number.isFinite(settings.schoolLng) && Math.abs(settings.schoolLng) <= 180 &&
    Number.isFinite(settings.allowedRadiusMeters) && settings.allowedRadiusMeters > 0;

  // Form State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [capturedSelfie, setCapturedSelfie] = useState<CapturedSelfie | null>(null);
  const pendingSelfieRef = React.useRef<CapturedSelfie | null>(null);
  const capturedPhoto = capturedSelfie?.dataUrl || null;
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingCheckInGps, setIsRefreshingCheckInGps] = useState(false);
  const refreshCheckInGpsRef = React.useRef(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<AttendanceFeedback | null>(null);

  // Check-out specific state and persistent status indicators
  const [checkoutStatus, setCheckoutStatus] = useState<AttendanceFeedback | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const slowTxTimerRef = React.useRef<any>(null);

  // Photo viewer modal
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // Active Tab: Presensi Mandiri vs Rekap Kehadiran
  const [activeTab, setActiveTab] = useState<'presensi' | 'riwayat'>('presensi');
  const [showLocationMap, setShowLocationMap] = useState(() => typeof window === 'undefined' ? true : window.innerWidth >= 640);
  // R90: query only today's records when the recap is opened; longer periods are opt-in.
  const history = useHistoryPeriod(settings, 'today');
  const [historyView, setHistoryView] = useHistoryView();
  const [historyUser, setHistoryUser] = useState('all');
  const [historyError, setHistoryError] = useState('');

  const todayName = getCurrentDayName();
  const todayISO = history.today;

  // Evaluates check-out window for today according to authoritative school settings
  const windowCheck: WindowCheckResult = AttendancePolicy.validateCheckOutWindow(
    todayName,
    settings,
    isAdmin
  );

  // 1. Load Settings & Master Rosters (strictly once on mount, no coords dependency)
  useEffect(() => {
    const unsubSettings = FirestoreService.subscribeToDocument<SchoolSettings>(
      'settings',
      'school_config',
      (data) => {
        if (data) {
          setSettings(data);
          setSettingsReady(true);
        }
      }
    );

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', setStaff);

    return () => {
      LocationService.clearCurrentWatcher();
      if (slowTxTimerRef.current) {
        clearTimeout(slowTxTimerRef.current);
      }
      unsubSettings();
      unsubSched();
      unsubTeachers();
      unsubStaff();
    };
  }, []);

  // Check-in only reads today. History always reads the selected bounded period.
  useEffect(() => {
    setAttendanceList([]); setHistoryError('');
    if (activeTab !== 'presensi' && history.range.error) return;
    const constraints = activeTab === 'presensi' ? [where('tanggal', '==', todayISO)] : history.constraints;
    return FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', data => {
      setAttendanceList([...data].sort((a,b) => toEpochMs(b.jamMasuk) - toEpochMs(a.jamMasuk)));
    }, error => setHistoryError(error.message || 'Riwayat presensi belum dapat dimuat.'), constraints, { cacheKey: activeTab === 'presensi' ? `today:${todayISO}` : history.key });
  }, [activeTab, history.constraints, history.range.error, todayISO]);

  useEffect(() => {
    // A photo must never survive an account or school-location change.
    setCapturedSelfie(null);
    pendingSelfieRef.current = null;
    warmSelfieGpsRef.current = null;
    warmSelfieContextRef.current = '';
    setIsCameraModalOpen(false);
  }, [currentUser?.id, currentUser?.fullName, currentUser?.loginId, settings.schoolName,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters]);

  // 2. Fetch GPS on mount and refresh manually, without blocking the status once valid.
  const refreshGpsLocation = async (isManual = false) => {
    if (!settingsReady || !validSchoolLocation) return;
    const requestId = ++gpsRequestRef.current;
    const hadPreviousReading = !!coords && !!geofence;
    if (!hadPreviousReading) {
      setCoords(null);
      setGeofence(null);
    }
    setIsLocating(true);
    if (!hadPreviousReading) {
      setIsProvisional(false);
    }
    setGpsError(null);
    try {
      const position = await LocationService.getCurrentPosition({
        timeoutMs: 8500,
        desiredAccuracyMeters: 20,
        maxStaleAgeMs: 15000, // Align visible GPS status with selfie freshness; do not guide from older cached fixes.
        forceFresh: isManual,
        onProgress: (pos, isProv) => {
          if (requestId !== gpsRequestRef.current) return;
          setCoords(pos);
          setIsProvisional(isProv);
          // Calculate distance immediately on every received reading
          const geo = LocationService.evaluateGeofence(
            pos.latitude,
            pos.longitude,
            pos.accuracy,
            settings.schoolLat,
            settings.schoolLng,
            settings.allowedRadiusMeters
          );
          setGeofence(geo);
        },
      });

      if (requestId !== gpsRequestRef.current) return;
      setCoords(position);
      setIsProvisional(false);

      const geo = LocationService.evaluateGeofence(
        position.latitude,
        position.longitude,
        position.accuracy,
        settings.schoolLat,
        settings.schoolLng,
        settings.allowedRadiusMeters
      );
      setGeofence(geo);

      if (geo.status === 'AKURASI_RENDAH') {
        setGpsError(`Akurasi sinyal GPS saat ini (±${Math.round(position.accuracy)}m) belum memenuhi kebijakan presensi (maksimal ≤50m). Silakan pindah ke area terbuka dan klik tombol Perbarui.`);
      } else if (isManual) {
        setFeedbackSuccess(`Koordinat GPS berhasil disinkronkan (Akurasi: ±${Math.round(position.accuracy)}m)!`);
        setTimeout(() => setFeedbackSuccess(null), 3500);
      }
    } catch (err: any) {
      if (requestId !== gpsRequestRef.current) return;
      if (err?.name === 'AbortError') return;
      console.warn('GPS detection error:', err);
      setGpsError(err.message || 'Gagal membaca koordinat GPS.');
      // Never leave an old successful badge active after a failed refresh.
      setCoords(null);
      setIsProvisional(false);
      setGeofence({
        distanceMeters: 999,
        isWithinRadius: false,
        accuracyQuality: 'RENDAH',
        status: 'GPS_ERROR',
      });
    } finally {
      if (requestId === gpsRequestRef.current) setIsLocating(false);
    }
  };

  useEffect(() => {
    setCoords(null);
    setGeofence(null);
    setGpsError(null);
    if (settingsReady && validSchoolLocation) refreshGpsLocation();
    else setIsLocating(false);
    return () => {
      ++gpsRequestRef.current;
      LocationService.clearCurrentWatcher();
    };
  }, [settingsReady, settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters]);

  // Today's schedule for current logged in user (strictly bound by ID/UID akun, with legacy teacher fallback)
  const isMySchedule = (s: ScheduleItem) => isScheduleMatchingUser(s, currentUser, teachers, staff);

  // Stable derived schedules: GPS/UI state changes must not rebuild the daily roster.
  const todayUserSchedules = React.useMemo(() => getEffectiveSchedulesOnDate(schedules, todayISO).filter(
    (s) => isAdmin || isScheduleMatchingUser(s, currentUser, teachers, staff)
  ), [schedules, todayISO, isAdmin, currentUser, teachers, staff]);

  useEffect(() => {
    if (!todayUserSchedules.some(s => s.id === selectedScheduleId)) {
      setSelectedScheduleId(todayUserSchedules[0]?.id || '');
    }
  }, [todayUserSchedules, selectedScheduleId]);

  // Existing attendance record today for this schedule/user
  const existingAttendanceToday = attendanceList.find(
    (a) => a.tanggal === todayISO && a.userId === currentUser?.id
  );

  // R95: A GPS reading may be shown provisionally while its precision is being
  // refined. Only a fresh, policy-compliant reading may trigger the selfie guide.
  // This is navigation assistance, not permission to bypass the shutter-time
  // revalidation performed by prepareSelfieCapture().
  const canGuideToSelfie = shouldGuideToSelfie({
    activeTab, settingsReady, validSchoolLocation, userId: currentUser?.id,
    hasCheckIn: !!existingAttendanceToday, hasSelfie: !!capturedSelfie,
    isCameraOpen: isCameraModalOpen, isSubmitting,
    canCheckIn: settings.attendanceMode === 'BEBAS' || isAdmin || todayUserSchedules.length > 0,
    gpsError, position: coords, geofence, isGpsFresh: LocationService.isFreshPosition(coords, 15_000),
  });
  const showSelfieGuide = highlightSelfieStep && canGuideToSelfie;

  // R96: guide only genuinely available actions, never disabled or submitting buttons.
  // This is a visual cue; it does not bypass the authoritative check-in/check-out guards.
  const actionGuidance = {
    activeTab,
    hasUser: !!currentUser?.id,
    online: !isOffline && (typeof navigator === 'undefined' || navigator.onLine),
    settingsReady,
    validSchoolLocation,
    hasCheckIn: !!existingAttendanceToday,
    hasCheckOut: !!existingAttendanceToday?.jamPulang,
    hasPhoto: !!capturedPhoto,
    hasPosition: !!coords,
    gpsWithinRadius: geofence?.status === 'DALAM_LOKASI',
    gpsAccuracyOk: !!coords && coords.accuracy <= LocationService.MAX_ATTENDANCE_ACCURACY_METERS,
    gpsHasError: !!gpsError,
    hasSchedulePermission: settings.attendanceMode === 'BEBAS' || isAdmin || todayUserSchedules.length > 0,
    checkOutWindowAllowed: windowCheck.allowed,
    busy: isSubmitting || isRefreshingCheckInGps || isCheckingOut,
    locating: isLocating,
    cameraOpen: isCameraModalOpen,
  };
  const highlightCheckIn = shouldHighlightCheckIn(actionGuidance);
  const highlightCheckOut = shouldHighlightCheckOut(actionGuidance);

  // Keep the checkout cue current when the allowed time window opens while
  // the form stays on screen (does not poll GPS or write anything to Firestore).
  const [, setCheckoutWindowClockTick] = useState(0);
  useEffect(() => {
    if (activeTab !== 'presensi' || !existingAttendanceToday || existingAttendanceToday.jamPulang) return;
    const timer = window.setInterval(() => setCheckoutWindowClockTick(tick => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [activeTab, !!existingAttendanceToday, !!existingAttendanceToday?.jamPulang]);

  useEffect(() => {
    const refreshVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', refreshVisibility);
    return () => document.removeEventListener('visibilitychange', refreshVisibility);
  }, []);

  // An account change must never inherit a previous account's highlight or
  // auto-navigation state (GPS location itself is separately revalidated).
  useEffect(() => {
    autoGuidedSelfieKeyRef.current = '';
    setHighlightSelfieStep(false);
  }, [currentUser?.id, todayISO]);

  useEffect(() => {
    // Once per account/day: no repeated auto-scroll when GPS watcher reports
    // nearby fixes, after manually refreshing, or while using other controls.
    const key = `${currentUser?.id || ''}|${todayISO}`;
    if (!canGuideToSelfie || !pageVisible || autoGuidedSelfieKeyRef.current === key) return;
    autoGuidedSelfieKeyRef.current = key;
    setHighlightSelfieStep(true);
    // Prepare font in the background as soon as real GPS permits the next step.
    void prepareSelfieWatermarkFont().catch(() => {});
    const timer = window.setTimeout(() => {
      if (!selfieTargetRef.current || isCameraModalOpen) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      try {
        selfieTargetRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      } catch {
        selfieTargetRef.current.scrollIntoView();
      }
      try { selfieTriggerRef.current?.focus({ preventScroll: true }); }
      catch { selfieTriggerRef.current?.focus(); }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [canGuideToSelfie, currentUser?.id, todayISO, isCameraModalOpen, pageVisible]);

  // Restore attendance selfie draft for today if available
  useEffect(() => {
    if (!currentUser?.id) return;
    DraftService.getDraft<CapturedSelfie>(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO)
      .then((draft) => {
        if (draft && draft.data && !existingAttendanceToday) {
          const photoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(draft.data.capturedAt));
          if (photoDate === todayISO) {
            setCapturedSelfie(draft.data);
            setCheckInStatus({
              tone: 'info',
              message: 'Draf swafoto presensi untuk hari ini dipulihkan dari perangkat. Anda dapat melanjutkan pengiriman atau mengambil ulang.',
            });
          } else {
            DraftService.deleteDraft(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO).catch(console.warn);
          }
        }
      })
      .catch((err) => console.warn('[ATTENDANCE] Error restoring selfie draft:', err));
  }, [currentUser?.id, todayISO, !!existingAttendanceToday]);

  const handleDiscardSelfie = () => {
    setCapturedSelfie(null);
    pendingSelfieRef.current = null;
    setCheckInStatus(null);
    if (currentUser?.id) {
      DraftService.deleteDraft(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO).catch(console.warn);
    }
  };

  const selfieContextKey = `${currentUser?.id || ''}|${settings.schoolLat}|${settings.schoolLng}|${settings.allowedRadiusMeters}`;

  // Runs only on camera opening. Does not block the live preview or trigger a
  // second GPS watcher if the normal page-location search is still running.
  const warmupSelfieCapture = () => {
    void prepareSelfieWatermarkFont();
    if (!settingsReady || !validSchoolLocation || !currentUser) return;
    if (LocationService.isFreshPosition(coords, 15_000) &&
        coords!.accuracy <= LocationService.MAX_ATTENDANCE_ACCURACY_METERS) return;
    if (isLocating || warmSelfieGpsRef.current) return;
    const request = LocationService.getCurrentPosition({
      timeoutMs: 12000, desiredAccuracyMeters: 20, maxStaleAgeMs: 15000, forceFresh: true,
    });
    warmSelfieContextRef.current = selfieContextKey;
    warmSelfieGpsRef.current = request;
    // Attach a rejection handler immediately: opening/closing a camera must
    // never leave an unhandled rejection on intermittent mobile GPS failures.
    void request.catch(() => {});
  };

  const prepareSelfieCapture = async () => {
    pendingSelfieRef.current = null;
    if (!currentUser) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.');
    if (!settingsReady) throw new Error('Pengaturan sekolah belum tersedia. Muat ulang halaman sebelum mengambil foto.');
    if (!validSchoolLocation) throw new Error('Koordinat sekolah belum valid. Hubungi Administrator.');

    // GPS and font readiness are independent. Start/check both together,
    // rather than adding up network font wait + geolocation wait at shutter.
    const getCaptureGps = async (): Promise<LocationCoordinates> => {
      const getNewReading = async () => {
        const warming = warmSelfieContextRef.current === selfieContextKey ? warmSelfieGpsRef.current : null;
        if (warming) {
          // A warmup is the only ongoing selfie GPS search; join it rather than
          // restarting/cancelling the browser geolocation request.
          let warmed: LocationCoordinates;
          try {
            warmed = await warming;
          } catch (error) {
            // Clear the failed warmup so a second shutter press can retry GPS.
            warmSelfieGpsRef.current = null;
            throw error;
          }
          if (LocationService.isFreshPosition(warmed, 15_000) &&
              warmed.accuracy <= LocationService.MAX_ATTENDANCE_ACCURACY_METERS) return warmed;
        }
        return LocationService.getCurrentPosition({
          timeoutMs: 12000, desiredAccuracyMeters: 20, maxStaleAgeMs: 15000, forceFresh: true,
        });
      };
      return LocationService.ensureFreshPosition(coords, getNewReading, 15_000);
    };
    const [captureCoordsRaw, watermarkFont] = await Promise.all([
      getCaptureGps(),
      prepareSelfieWatermarkFont(),
    ]);
    const captureCoords = { ...captureCoordsRaw };
    const captureGeofence = LocationService.evaluateGeofence(
      captureCoords.latitude, captureCoords.longitude, captureCoords.accuracy,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters
    );
    if (captureGeofence.status !== 'DALAM_LOKASI') {
      throw new Error('GPS harus akurat dan berada dalam radius sekolah sebelum swafoto presensi. Perbarui lokasi lalu coba lagi.');
    }
    // Only use the prewarmed fix if it is still fresh when the user actually
    // takes the picture. Do not stamp a cached position as a new GPS reading.
    if (!LocationService.isFreshPosition(captureCoords, 15_000)) {
      throw new Error('Sinyal GPS sudah kedaluwarsa. Tekan Jepret Foto sekali lagi untuk pembaruan otomatis.');
    }
    setCoords(captureCoords);
    setGeofence(captureGeofence);
    const identity = {
      userId: currentUser.id, userName: currentUser.fullName,
      loginId: currentUser.loginId, schoolName: settings.schoolName,
    };
    return (canvas: HTMLCanvasElement, capturedAt: number) => {
      const evidence = { ...identity, coords: captureCoords, capturedAt };
      const dataUrl = stampCheckInSelfie(canvas, evidence, watermarkFont);
      pendingSelfieRef.current = { ...evidence, dataUrl };
      return dataUrl;
    };
  };

  // --- SUBMIT PRESENSI MASUK ---
  const handleCheckIn = async () => {
    if (isSubmitting || refreshCheckInGpsRef.current) return; // Prevent double click
    if (!currentUser) {
      setCheckInStatus({ tone: 'error', message: 'Sesi akun tidak ditemukan. Silakan masuk kembali.' });
      return;
    }
    if (!isAdmin && !hasPermission(PERMISSIONS.ATTENDANCE_CREATE)) {
      setCheckInStatus({
        tone: 'error',
        message: 'Hak akses presensi piket mandiri tidak aktif atau telah dicabut oleh Administrator.',
      });
      return;
    }

    const isBebas = settings.attendanceMode === 'BEBAS';

    if (!isBebas && !isAdmin && todayUserSchedules.length === 0) {
      setCheckInStatus({
        tone: 'error',
        message: `Anda tidak memiliki jadwal tugas piket untuk hari ini (${todayName}). Pada mode Terjadwal, presensi mandiri memerlukan penugasan jadwal yang ditugaskan kepada ID Anda.`,
      });
      return;
    }

    if (!capturedSelfie || capturedSelfie.userId !== currentUser.id) {
      setCheckInStatus({ tone: 'error', message: 'Ambil swafoto berwatermark terlebih dahulu sebelum mengirim presensi masuk.' });
      return;
    }
    try {
      validateSelfieForSubmission(capturedSelfie);
      const photoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(capturedSelfie.capturedAt));
      if (photoDate !== todayISO) throw new Error('Tanggal foto sudah berganti. Muat ulang halaman dan ambil swafoto baru.');
    } catch (error: any) {
      setCheckInStatus({ tone: 'error', message: error.message });
      return;
    }
    // A single photo is enough: preserve its original GPS/watermark. When it
    // takes >30s to press "Kirim", renew GPS separately instead of retaking the
    // photo. The attendance record stores submission GPS and photo-time GPS.
    let verifiedCoords = capturedSelfie.coords;
    if (!LocationService.isFreshPosition(verifiedCoords, 30_000)) {
      refreshCheckInGpsRef.current = true;
      setIsRefreshingCheckInGps(true);
      setCheckInStatus({
        tone: 'info',
        message: 'Memperbarui GPS sebelum mengirim presensi. Foto yang sudah diambil tetap digunakan.',
      });
      try {
        verifiedCoords = await LocationService.getCurrentPosition({
          timeoutMs: 12000,
          desiredAccuracyMeters: 20,
          maxStaleAgeMs: 15000,
          forceFresh: true,
        });
        setCoords(verifiedCoords);
      } catch (error: any) {
        setCheckInStatus({
          tone: 'error',
          message: `GPS belum berhasil diperbarui: ${error?.message || 'Lokasi tidak tersedia'}. Foto tetap tersimpan; aktifkan GPS dan tekan Kirim Presensi Masuk lagi.`,
        });
        return;
      } finally {
        refreshCheckInGpsRef.current = false;
        setIsRefreshingCheckInGps(false);
      }
    }
    const verifiedGeofence = LocationService.evaluateGeofence(
      verifiedCoords.latitude, verifiedCoords.longitude, verifiedCoords.accuracy,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters
    );
    setGeofence(verifiedGeofence);

    if (verifiedCoords.accuracy > LocationService.MAX_ATTENDANCE_ACCURACY_METERS ||
        verifiedGeofence.status === 'AKURASI_RENDAH') {
      setCheckInStatus({ tone: 'error', message: `Akurasi GPS ±${Math.round(verifiedCoords.accuracy)}m terlalu rendah (maksimal 50m). Foto tetap tersedia; perbarui lokasi lalu coba kirim lagi.` });
      return;
    }
    if (verifiedGeofence.status !== 'DALAM_LOKASI') {
      setCheckInStatus({ tone: 'error', message: `Lokasi saat mengirim di luar radius sekolah (${verifiedGeofence.distanceMeters}m, batas ${settings.allowedRadiusMeters}m). Foto tetap tersedia; kembali ke lingkungan sekolah lalu coba kirim lagi.` });
      return;
    }

    let currentSchedule: ScheduleItem | undefined = undefined;
    if (selectedScheduleId) {
      currentSchedule = todayUserSchedules.find((s) => s.id === selectedScheduleId);
    } else if (todayUserSchedules.length > 0) {
      currentSchedule = todayUserSchedules[0];
    }

    if (!isAdmin && currentSchedule && !isMySchedule(currentSchedule)) {
      setCheckInStatus({
        tone: 'error',
        message: 'Akses ditolak: Anda hanya dapat melakukan presensi untuk jadwal yang ditugaskan kepada ID akun Anda sendiri.',
      });
      return;
    }

    if (!isBebas && !currentSchedule) {
      setCheckInStatus({
        tone: 'error',
        message: `Penugasan jadwal piket untuk hari ini (${todayName}) wajib dipilih pada mode Terjadwal.`,
      });
      return;
    }

    if (!navigator.onLine || isOffline) {
      setCheckInStatus({
        tone: 'info',
        message: 'Koneksi internet terputus. Swafoto dan bukti presensi Anda tersimpan aman sebagai draf di perangkat ini. Sesuai kebijakan sekolah, pengesahan presensi memerlukan validasi server. Silakan hubungkan internet lalu klik Kirim Presensi Masuk kembali.',
      });
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    setCheckInStatus({ tone: 'info', message: 'Menyimpan presensi masuk ke server...' });

    try {
      await AttendanceService.checkIn({
        userId: currentUser.id,
        userName: currentUser.fullName,
        scheduleId: currentSchedule ? currentSchedule.id : null,
        attendanceModeAtCheckIn: isBebas ? 'BEBAS' : 'TERJADWAL',
        tanggal: todayISO,
        coords: verifiedCoords,
        geofence: verifiedGeofence,
        selfieCapturedAt: capturedSelfie.capturedAt,
        selfieCaptureCoords: capturedSelfie.coords,
        photoUrl: capturedPhoto,
        userRole: currentUser.role,
        settings,
      });

      if (currentUser?.id) {
        DraftService.deleteDraft(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO).catch(console.warn);
      }

      setCheckInStatus({
        tone: 'success',
        message: 'Presensi masuk Anda berhasil dicatat ke sistem!',
      });
      setFeedbackSuccess('Presensi masuk Anda berhasil dicatat ke sistem!');
      setCapturedSelfie(null);
      pendingSelfieRef.current = null;
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err: any) {
      console.error('Check-in error:', err);
      const msg = AttendancePolicy.formatErrorMessage(err, 'write-check-in');
      setCheckInStatus({ tone: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT PRESENSI PULANG ---
  const handleCheckOut = async () => {
    if (isSubmitting || isCheckingOut) return; // Prevent double click immediately
    if (!currentUser) {
      setCheckoutStatus({ tone: 'error', message: 'Sesi akun tidak ditemukan. Silakan masuk kembali.' });
      return;
    }
    if (!existingAttendanceToday) {
      setCheckoutStatus({ tone: 'error', message: 'Data presensi masuk untuk hari ini belum ditemukan di sistem.' });
      return;
    }
    if (!isAdmin && existingAttendanceToday.userId !== currentUser.id) {
      setCheckoutStatus({ tone: 'error', message: 'Akses ditolak: Anda hanya dapat melakukan presensi pulang atas nama Anda sendiri.' });
      return;
    }

    if (!navigator.onLine || isOffline) {
      setCheckoutStatus({
        tone: 'error',
        message: 'Koneksi internet terputus. Pencatatan presensi pulang memerlukan verifikasi waktu server. Silakan hubungkan internet lalu coba kembali.',
      });
      return;
    }

    setIsCheckingOut(true);
    setCheckoutStatus({ tone: 'info', message: 'Memeriksa jadwal kepulangan dan koordinat GPS...' });

    // 12-second slow transaction notification timer
    if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
    slowTxTimerRef.current = setTimeout(() => {
      setCheckoutStatus({
        tone: 'info',
        message: 'Koneksi ke server lambat. Transaksi presensi pulang masih berlangsung, mohon tidak menutup halaman atau menekan tombol kembali...',
      });
    }, 12000);

    try {
      // 1. Time window validation
      const windowCheckNow = AttendancePolicy.validateCheckOutWindow(todayName, settings, isAdmin);
      if (!windowCheckNow.allowed) {
        if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
        setIsCheckingOut(false);
        setCheckoutStatus({
          tone: 'error',
          message: windowCheckNow.reason || 'Jendela waktu presensi pulang belum dibuka.',
        });
        return;
      }

      // 2. GPS Freshness & Geofence verification
      let activeCoords = coords;
      let activeGeofence = geofence;

      if (!activeCoords || !LocationService.isFreshPosition(activeCoords, 30000)) {
        setCheckoutStatus({
          tone: 'info',
          message: 'Sinyal GPS kedaluwarsa. Mengambil pembacaan GPS baru untuk validasi kepulangan (maksimal 10 detik)...',
        });
        try {
          activeCoords = await LocationService.getCurrentPosition({
            timeoutMs: 10000,
            desiredAccuracyMeters: 20,
          });
          setCoords(activeCoords);
          activeGeofence = LocationService.evaluateGeofence(
            activeCoords.latitude,
            activeCoords.longitude,
            activeCoords.accuracy,
            settings.schoolLat,
            settings.schoolLng,
            settings.allowedRadiusMeters
          );
          setGeofence(activeGeofence);
        } catch (gpsErr: any) {
          if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
          setIsCheckingOut(false);
          setCheckoutStatus({
            tone: 'error',
            message: `Gagal memperbarui GPS saat checkout: ${gpsErr?.message || 'Sinyal GPS tidak tersedia'}. Pindah ke area terbuka lalu klik Coba Lagi.`,
          });
          return;
        }
      }

      // Validate accuracy (must be <= 50m)
      if (activeCoords.accuracy > LocationService.MAX_ATTENDANCE_ACCURACY_METERS) {
        if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
        setIsCheckingOut(false);
        setCheckoutStatus({
          tone: 'error',
          message: `Akurasi GPS (±${Math.round(activeCoords.accuracy)} meter) terlalu rendah untuk presensi (kebijakan presensi ≤ 50m). Silakan pindah ke area terbuka dan klik Coba Lagi.`,
        });
        return;
      }

      // Validate geofence radius
      if (activeGeofence && activeGeofence.status === 'DI_LUAR_LOKASI') {
        if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
        setIsCheckingOut(false);
        setCheckoutStatus({
          tone: 'error',
          message: `Lokasi Anda berada di luar radius sekolah (${activeGeofence.distanceMeters}m dari pusat sekolah, batas: ${settings.allowedRadiusMeters}m). Presensi pulang ditolak.`,
        });
        return;
      }

      setCheckoutStatus({ tone: 'info', message: 'Menyimpan waktu pulang ke server melalui transaksi Firestore...' });

      // 3. Execute atomic transaction
      const result = await AttendanceService.checkOut({
        attendanceId: existingAttendanceToday.id,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        isAdmin,
        tanggal: todayISO,
        settings,
      });

      if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);

      // Immediately update local attendance state so UI marks "Selesai"
      const confirmedPulang = result.data?.jamPulang || new Date().toISOString();
      setAttendanceList((prev) =>
        prev.map((item) =>
          item.id === existingAttendanceToday.id
            ? {
                ...item,
                jamPulang: confirmedPulang,
              }
            : item
        )
      );

      setCheckoutStatus({
        tone: result.confirmed ? 'success' : 'info',
        message: result.message,
      });
      setFeedbackSuccess(result.message);
    } catch (err: any) {
      console.error('Check-out error:', err);
      if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
      const formattedMsg = AttendancePolicy.formatErrorMessage(err, 'write-check-out');
      setCheckoutStatus({
        tone: 'error',
        message: formattedMsg,
      });
    } finally {
      if (slowTxTimerRef.current) clearTimeout(slowTxTimerRef.current);
      setIsCheckingOut(false);
    }
  };

  // History filters are only needed on the recap tab, not during GPS/photo updates.
  const filteredAttendance = React.useMemo(() => activeTab !== 'riwayat' || history.range.error ? [] : attendanceList.filter(
    item => item.tanggal >= history.range.start && item.tanggal <= history.range.end &&
      (historyUser === 'all' || item.userId === (historyUser === 'me' ? currentUser?.id : historyUser))
  ), [activeTab, attendanceList, history.range.error, history.range.start, history.range.end, historyUser, currentUser?.id]);
  const historyUsers = React.useMemo(() => activeTab !== 'riwayat' ? [] : [
    ...new Map([
      ...teachers.map(t => ({ id: t.userId || t.id, name: t.fullName })),
      ...staff.map(t => ({ id: t.userId || t.id, name: t.fullName })),
      ...attendanceList.map(a => ({ id: a.userId, name: a.userName })),
    ].filter(u => u.id !== currentUser?.id).map(u => [u.id, u])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name)), [activeTab, teachers, staff, attendanceList, currentUser?.id]);
  const historyPage = useHistoryPagination(filteredAttendance, history.key + ':' + historyUser);

  return (
    <div data-tour="attendance-container" className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Presensi GPS Piket Guru
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Catat presensi masuk atau pulang menggunakan lokasi dan foto.</p>
        </div>

        {/* Tab Switcher */}
        <div data-tour="attendance-tabs" className="attendance-tabs page-actions flex items-center justify-center gap-2 bg-slate-100 dark:bg-[var(--theme-surface-subtle)] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('presensi')}
            className={`flex-1 text-center px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'presensi'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Formulir Presensi
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`flex-1 text-center px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Rekap Kehadiran
          </button>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="font-bold">{feedbackSuccess}</span>
        </div>
      )}

      {activeTab === 'presensi' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Check-in / Check-out interactive panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader
                title={`Formulir Presensi: ${currentUser?.fullName}`}
                subtitle={`Hari ini: ${formatIndonesianDate(new Date())}`}
                action={settingsReady && validSchoolLocation ? (
                  <Badge variant={!gpsError && geofence?.status === 'DALAM_LOKASI' ? 'success' : geofence?.status === 'AKURASI_RENDAH' ? 'warning' : geofence?.status === 'DI_LUAR_LOKASI' ? 'danger' : 'neutral'} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    {!gpsError && geofence?.status === 'DALAM_LOKASI' ? 'Dalam Radius Sekolah' : isLocating && !coords ? 'Memeriksa GPS' : geofence?.status === 'AKURASI_RENDAH' ? 'Akurasi GPS Rendah' : geofence?.status === 'DI_LUAR_LOKASI' ? 'Di Luar Radius' : 'GPS Belum Terhubung'}
                  </Badge>
                ) : undefined}
              />
              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* Geolocation Status HUD */}
                <div data-tour="gps-status" className="attendance-gps-panel rounded-2xl border border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] shadow-xs overflow-hidden">
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="gps-search-heading" role="status" aria-live="polite" aria-atomic="true">
                        <div className={isLocating ? 'gps-search-indicator' : 'attendance-gps-icon'} aria-hidden="true" data-gps-search={isLocating ? 'active' : 'idle'}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="gps-search-title">{!settingsReady ? 'Menunggu pengaturan sekolah' : !validSchoolLocation ? 'Lokasi sekolah belum valid' : !gpsError && geofence?.status === 'DALAM_LOKASI' ? 'Dalam radius sekolah' : isLocating ? 'Memeriksa lokasi GPS' : coords ? 'Lokasi GPS terbaca' : 'Siapkan lokasi GPS'}</h4>
                          <p className="gps-search-caption">
                            {settingsReady && validSchoolLocation
                              ? `${settings.schoolName} · radius ${settings.allowedRadiusMeters} meter`
                              : 'Pengaturan koordinat dan radius perlu diisi oleh admin.'}
                          </p>
                        </div>
                      </div>

                      <div className="attendance-gps-actions">
                        {settingsReady && validSchoolLocation && (
                          <button
                            type="button"
                            className="attendance-map-toggle"
                            onClick={() => setShowLocationMap((value) => !value)}
                          >
                            {showLocationMap ? 'Sembunyikan Peta' : 'Lihat Peta'}
                          </button>
                        )}
                        <Button
                          data-tour="refresh-gps-button"
                          variant="outline"
                          size="sm"
                          className="text-xs shrink-0 min-h-[44px]"
                          disabled={isLocating || isCheckingOut || !settingsReady || !validSchoolLocation}
                          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => refreshGpsLocation(true)}
                        >
                          {isLocating ? 'Memperbarui…' : gpsError ? 'Coba Lagi' : 'Perbarui GPS'}
                        </Button>
                      </div>
                    </div>

                    {coords ? (
                      <div className="attendance-gps-grid">
                        <div className="attendance-gps-stat">
                          <span className="attendance-gps-label">Jarak Sekolah</span>
                          <strong className={`attendance-gps-value ${geofence?.status === 'DALAM_LOKASI' ? 'is-good' : 'is-bad'}`}>
                            {geofence?.distanceMeters ?? '-'} m
                          </strong>
                          <span className="attendance-gps-note">
                            {geofence?.status === 'DALAM_LOKASI' ? 'Dalam radius' : geofence?.status === 'AKURASI_RENDAH' ? 'Akurasi belum memadai' : 'Di luar radius'}
                          </span>
                        </div>

                        <div className="attendance-gps-stat">
                          <span className="attendance-gps-label">Akurasi GPS</span>
                          <strong className={`attendance-gps-value ${
                            coords.accuracy <= 20 ? 'is-good' : coords.accuracy <= 50 ? 'is-warn' : 'is-bad'
                          }`}>
                            ±{Math.round(coords.accuracy)} m{isProvisional ? '*' : ''}
                          </strong>
                          <span className="attendance-gps-note">
                            {coords.accuracy <= 50 ? 'Akurasi memadai' : 'Akurasi perlu ditingkatkan'}
                          </span>
                        </div>

                        <div className="attendance-gps-stat">
                          <span className="attendance-gps-label">Waktu Baca</span>
                          <strong className="attendance-gps-value text-slate-800 dark:text-slate-100">
                            {new Date(coords.timestamp).toLocaleTimeString('id-ID', {
                              timeZone: 'Asia/Jakarta',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })} WIB
                          </strong>
                          <span className="attendance-gps-note">Waktu perangkat</span>
                        </div>

                        <div className="attendance-gps-stat">
                          <span className="attendance-gps-label">Koordinat</span>
                          <strong className="attendance-gps-value attendance-gps-coords text-slate-700 dark:text-slate-200">
                            {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                          </strong>
                          <span className="attendance-gps-note">Data GPS terbaru</span>
                        </div>
                      </div>
                    ) : !isLocating ? (
                      <p className="attendance-gps-empty">Posisi Anda akan muncul setelah GPS terbaca. Peta hanya bersifat membantu dan tidak menggantikan validasi lokasi.</p>
                    ) : null}

                    {gpsError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          <span>Kendala pembacaan GPS</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">{gpsError}</p>
                      </div>
                    )}

                    {isProvisional && coords && !gpsError && (
                      <p className="attendance-gps-helper">* GPS sudah terbaca dan sedang disempurnakan. Anda tetap dapat menunggu atau menekan Perbarui GPS.</p>
                    )}
                  </div>

                  {showLocationMap && settingsReady && validSchoolLocation && (
                    <div className="attendance-gps-map-wrap border-t border-slate-200/80 dark:border-slate-800">
                      <AttendanceMapPreview
                        schoolLat={settings.schoolLat}
                        schoolLng={settings.schoolLng}
                        radiusMeters={settings.allowedRadiusMeters}
                        schoolName={settings.schoolName}
                        coords={coords}
                        provisional={isProvisional}
                      />
                    </div>
                  )}
                </div>

                {/* Today's Shift & Window Indicator */}
                {(() => {
                  const todayShiftConfig = (settings.workHours?.dailySchedules as any)?.[todayName] || {
                    start: settings.workHours?.start || '06:30',
                    end: settings.workHours?.end || '15:30',
                    checkInStart: settings.workHours?.checkInStart || '06:00',
                    checkInEnd: settings.workHours?.checkInEnd || '07:30',
                    checkOutStart: settings.workHours?.checkOutStart || '14:30',
                    checkOutEnd: settings.workHours?.checkOutEnd || '17:00',
                    isActive: true,
                  };

                  return (
                    <div className="attendance-shift-card p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 flex flex-col gap-3 text-xs">
                      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                        <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                        <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              Jadwal Shift Hari Ini ({todayName})
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 font-semibold">
                              {todayShiftConfig.start} - {todayShiftConfig.end} WIB
                            </span>
                          </div>
                        </div>
                        <Badge variant="neutral" size="sm">Jadwal Aktif</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700 px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Masuk</span>
                          <strong className="text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">{todayShiftConfig.checkInStart} - {todayShiftConfig.checkInEnd}</strong>
                        </div>
                        <div className="rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700 px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Pulang</span>
                          <strong className="text-indigo-600 dark:text-indigo-400">{todayShiftConfig.checkOutStart} - {todayShiftConfig.checkOutEnd}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Show schedule selection and selfie only while check-in is pending. */}
                {!existingAttendanceToday && <>
                {todayUserSchedules.some(s => s.coverageForScheduleId && isScheduleMatchingUser(s, currentUser, teachers, staff)) && (
                  <div role="status" className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 text-xs text-sky-900 dark:text-sky-200">
                    <strong className="block">Anda ditugaskan sebagai guru piket pengganti hari ini.</strong>
                    {todayUserSchedules.filter(s => s.coverageForScheduleId && isScheduleMatchingUser(s, currentUser, teachers, staff)).map(s => (
                      <p key={s.id} className="mt-1">Menggantikan {s.absentOfficerName} · {s.ruangName}. Presensi tetap menggunakan GPS dan swafoto Anda sendiri.</p>
                    ))}
                  </div>
                )}

                {/* Shift Selector */}
                {todayUserSchedules.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Pilih Pos / Shift Piket Anda Hari Ini:
                      </label>
                      <ContextualHelp
                        title="Jadwal Shift Piket"
                        content="Pilih status kehadiran atau lokasi piket yang sesuai dengan jadwal tugas Anda hari ini."
                      />
                    </div>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-semibold"
                    >
                      {settings.attendanceMode === 'BEBAS' && (
                        <option value="">Tanpa Penugasan Jadwal Tertentu (Mode Bebas)</option>
                      )}
                      {todayUserSchedules.map((s) => (
                        <option key={s.id} value={s.id}>{s.ruangName} ({s.jamMulai} - {s.jamSelesai} WIB)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : settings.attendanceMode === 'BEBAS' ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">Mode Presensi Bebas Aktif</span>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                        Anda tidak memiliki jadwal piket khusus hari ini ({todayName}). Presensi mandiri tetap dapat dilakukan tanpa jadwal harian.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">Tidak Ada Jadwal Piket Hari Ini</span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                        Pada Mode Terjadwal, Anda harus memiliki jadwal tugas piket untuk hari ini ({todayName}) sebelum dapat melakukan presensi mandiri. Hubungi Administrator jika jadwal belum diatur.
                      </p>
                    </div>
                  </div>
                )}

                {/* Camera Selfie Section */}
                <div
                  ref={selfieTargetRef}
                  data-tour="camera-section"
                  data-gps-auto-guide={showSelfieGuide ? 'ready' : 'idle'}
                  className={`attendance-selfie-target space-y-2 ${showSelfieGuide ? 'is-gps-ready' : ''}`}
                >
                  {showSelfieGuide && (
                    <p id="selfie-gps-ready-hint" role="status" className="attendance-selfie-ready-hint flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      GPS dalam radius sekolah. Lanjutkan dengan mengetuk Ambil Swafoto.
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Swafoto Selfie di Pos / Area Tugas:
                    </label>
                    <ContextualHelp
                      title="Foto Swafoto Presensi"
                      content="Ambil foto swafoto langsung. Sistem membubuhkan watermark lokasi GPS, nama, dan waktu secara otomatis."
                    />
                  </div>

                  {capturedPhoto ? (
                    <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-card-bg)]">
                      <img
                        src={capturedPhoto}
                        alt="Preview Foto"
                        className="w-28 h-36 rounded-xl object-contain bg-slate-950 border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
                        onClick={() => setViewPhoto(capturedPhoto)}
                      />
                      <div className="space-y-1">
                        <Badge variant="success" size="sm" icon={<Check className="w-3 h-3" />}>
                          Watermark Terpasang
                        </Badge>
                        <p className="text-[11px] text-slate-500">
                          Nama, sekolah, waktu WIB, dan GPS sudah menyatu dengan foto. Ketuk foto untuk memperbesar, lalu segera kirim presensi.
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsCameraModalOpen(true)}
                            data-tour="selfie-trigger"
                            className="text-xs text-[var(--theme-primary)] hover:underline font-semibold cursor-pointer"
                          >
                            Ganti Foto
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <button
                            type="button"
                            onClick={handleDiscardSelfie}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Buang Swafoto</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      ref={selfieTriggerRef}
                      onClick={() => {
                        setHighlightSelfieStep(false);
                        setIsCameraModalOpen(true);
                      }}
                      data-tour="selfie-trigger"
                      aria-describedby={showSelfieGuide ? 'selfie-gps-ready-hint' : undefined}
                      className="w-full flex items-center gap-3 text-left rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[var(--theme-primary)] bg-slate-50/70 dark:bg-[var(--theme-surface-subtle)]/50 p-3 sm:p-5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                    >
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Ambil Swafoto</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Kamera depan · watermark GPS otomatis</span>
                      </span>
                      <span className="text-[11px] font-bold text-[var(--theme-primary-text)]">Buka</span>
                    </button>
                  )}
                </div>

                </>}

                {/* Submit Actions */}
                <div data-tour="attendance-actions" className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  {!existingAttendanceToday ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                        <Button
                          data-tour="checkin-button"
                          variant="success"
                          size="lg"
                          className={`w-full sm:w-auto ${highlightCheckIn ? 'attendance-action-attention' : ''}`}
                          data-action-ready={highlightCheckIn ? 'checkin' : 'idle'}
                          aria-describedby={highlightCheckIn ? 'attendance-checkin-ready-hint' : undefined}
                          isLoading={isSubmitting || isRefreshingCheckInGps}
                          disabled={
                            isRefreshingCheckInGps ||
                            isLocating ||
                            !coords ||
                            !capturedPhoto ||
                            (settings.attendanceMode !== 'BEBAS' && !isAdmin && todayUserSchedules.length === 0)
                          }
                          leftIcon={<CheckCircle2 className="w-5 h-5" />}
                          onClick={handleCheckIn}
                        >
                          Kirim Presensi Masuk (Check-In)
                        </Button>
                      </div>
                      {highlightCheckIn && (
                        <p id="attendance-checkin-ready-hint" className="attendance-action-hint" role="status">
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Swafoto sudah siap. Ketuk Kirim Presensi Masuk untuk melanjutkan.
                        </p>
                      )}
                      <InlineAttendanceStatus status={checkInStatus} />
                    </div>
                  ) : !existingAttendanceToday.jamPulang ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                        <Badge variant="success" size="md">
                          Sudah Check-In ({formatTime(existingAttendanceToday.jamMasuk)})
                        </Badge>
                        <Button
                          variant="primary"
                          size="lg"
                          data-tour="checkout-button"
                          className={`w-full sm:w-auto ${highlightCheckOut ? 'attendance-action-attention' : ''}`}
                          data-action-ready={highlightCheckOut ? 'checkout' : 'idle'}
                          aria-describedby={highlightCheckOut ? 'attendance-checkout-ready-hint' : undefined}
                          isLoading={isCheckingOut}
                          disabled={isCheckingOut || isSubmitting || isLocating || !settingsReady || !validSchoolLocation}
                          leftIcon={<Clock className="w-5 h-5" />}
                          onClick={handleCheckOut}
                        >
                          {isCheckingOut ? 'Memproses Pulang...' : 'Kirim Presensi Pulang (Check-Out)'}
                        </Button>
                      </div>
                      {highlightCheckOut && (
                        <p id="attendance-checkout-ready-hint" className="attendance-action-hint" role="status">
                          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Jam pulang sudah dibuka. Ketuk Check-Out untuk verifikasi GPS dan mengirim presensi.
                        </p>
                      )}

                      {/* Persistent status message right below the button */}
                      <InlineAttendanceStatus status={checkoutStatus} />

                      {/* Detailed reason if window is closed and user is not admin */}
                      {!windowCheck.allowed && !isAdmin && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>{windowCheck.reason}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div data-tour="attendance-complete" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Presensi Masuk &amp; Pulang Hari Ini Telah Lengkap Selesai</span>
                      </div>
                      <InlineAttendanceStatus status={checkoutStatus} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right 1 Col: Status Today Summary */}
          <div data-tour="my-history-section" className="space-y-4">
            <Card>
              <CardHeader
                title="Status Kehadiran Saya Hari Ini"
                subtitle={formatIndonesianDate(new Date())}
              />
              <CardContent className="space-y-4">
                {existingAttendanceToday ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">Presensi Masuk:</span>
                        <Badge variant="success" size="sm">Tercatat</Badge>
                      </div>
                      <p className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {formatTime(existingAttendanceToday.jamMasuk)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Jarak GPS: <strong>{existingAttendanceToday.distance}m</strong> ({existingAttendanceToday.status})
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">Presensi Pulang:</span>
                        <Badge
                          variant={existingAttendanceToday.jamPulang ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {existingAttendanceToday.jamPulang ? 'Selesai' : 'Belum Selesai'}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {existingAttendanceToday.jamPulang ? formatTime(existingAttendanceToday.jamPulang) : '-'}
                      </p>
                      {existingAttendanceToday.jamPulang && (existingAttendanceToday.checkoutPolicy?.keterangan || existingAttendanceToday.keteranganCheckout) && (
                        <p className="text-[11px] text-slate-500">
                          Keterangan: <strong>{existingAttendanceToday.checkoutPolicy?.keterangan || existingAttendanceToday.keteranganCheckout}</strong>
                        </p>
                      )}
                    </div>

                    {existingAttendanceToday.photoUrl && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setViewPhoto(existingAttendanceToday.photoUrl || null)}
                          className="flex items-center gap-2 text-xs text-[var(--theme-primary)] hover:underline font-semibold cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span>Lihat Swafoto Presensi Saya</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 space-y-2">
                    <Clock className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Anda belum melakukan presensi masuk hari ini.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* REKAP KEHADIRAN TABLE */
        <Card>
          <CardHeader
            title="Rekap Riwayat Presensi Guru Piket"
            subtitle="Default hari ini (WIB) untuk hemat data. Pilih periode lebih panjang hanya jika diperlukan."

          />
          {adminFeedback && <p role="status" className="m-3 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold">{adminFeedback}</p>}
          <div className="p-3"><HistoryControls history={history} view={historyView} onViewChange={setHistoryView} user={historyUser} onUserChange={setHistoryUser} users={historyUsers}/>{historyError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{historyError}</p>}</div>
          <HistoryTable view={historyView}>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Guru / Petugas</th>
                  <th className="p-4">Jam Masuk</th>
                  <th className="p-4">Jam Pulang</th>
                  <th className="p-4">Durasi Kehadiran</th>
                  <th className="p-4">Jarak GPS</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Foto</th>
                  {canManageHistory && <th className="p-4">Tindakan Admin</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={canManageHistory ? 9 : 8} className="p-8 text-center text-slate-400">
                      Belum ada rekaman data presensi piket untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  historyPage.records.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                        {formatIndonesianDate(item.tanggal)}
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {item.userName}
                      </td>
                      <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatTime(item.jamMasuk)}
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                        {item.jamPulang ? formatTime(item.jamPulang) : '-'}
                      </td>
                      <td className="p-4 font-semibold">{attendanceDuration(item.jamMasuk, item.jamPulang)}</td>
                      <td className="p-4 font-mono">
                        {item.distance} meter
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={item.status === 'DALAM_LOKASI' ? 'success' : 'danger'}
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        {item.photoUrl ? (
                          <button
                            onClick={() => setViewPhoto(item.photoUrl || null)}
                            className="p-1.5 rounded-lg bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] hover:brightness-95 cursor-pointer"
                            title="Lihat Foto"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
                      </td>
                      {canManageHistory && <td className="p-4"><div className="flex items-center gap-2">
                        <button type="button" onClick={() => setAdminSelection({ record: item, mode: 'edit' })} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[var(--theme-primary)] text-xs font-bold">Edit</button>
                        <button type="button" onClick={() => setAdminSelection({ record: item, mode: 'delete' })} className="px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">Hapus</button>
                      </div></td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

          </CardContent></HistoryTable>
          <HistoryPagination {...historyPage} />
        </Card>
      )}

      {canManageHistory && <AdminAttendanceDialog selection={adminSelection} onClose={() => setAdminSelection(null)} onCompleted={setAdminFeedback} />}

      {/* CAMERA CAPTURE MODAL */}
      {isCameraModalOpen && <CameraCaptureModal
        isOpen={true}
        onClose={() => {
          // Discard the preflight reference when closing. The browser's own
          // location watcher ends independently and never stamps a photo.
          warmSelfieGpsRef.current = null;
          warmSelfieContextRef.current = '';
          setIsCameraModalOpen(false);
        }}
        allowFileUpload={false}
        prepareCapture={prepareSelfieCapture}
        warmupCapture={warmupSelfieCapture}
        onCapture={(dataUrl) => {
          const evidence = pendingSelfieRef.current;
          if (evidence && evidence.dataUrl === dataUrl && evidence.userId === currentUser?.id) {
            setCapturedSelfie(evidence);
            setCheckInStatus({ tone: 'info', message: 'Swafoto berwatermark siap & tersimpan sebagai draf. Segera tekan Kirim Presensi Masuk.' });
            if (currentUser?.id) {
              DraftService.saveDraft(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO, evidence).catch((err: any) => {
                console.warn('[ATTENDANCE] Error saving selfie draft:', err);
                setCheckInStatus({
                  tone: 'error',
                  message: err?.message || 'Draf foto melebihi batas aman. Silakan ambil ulang swafoto.',
                });
              });
            }
          }
          pendingSelfieRef.current = null;
        }}
      />}

      {/* PHOTO PREVIEW MODAL */}
      <Modal
        isOpen={!!viewPhoto}
        onClose={() => setViewPhoto(null)}
        title="Dokumentasi Swafoto Presensi"
        maxWidth="sm"
      >
        <div className="space-y-3 text-center">
          {viewPhoto && (
            <AuthenticatedImage
              src={viewPhoto}
              alt="Swafoto Presensi"
              className="w-full h-auto rounded-2xl object-contain border border-slate-200 dark:border-slate-800 shadow-md"
            />
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setViewPhoto(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
