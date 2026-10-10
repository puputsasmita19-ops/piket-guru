import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Navigation,
  Clock,
  User,
  Calendar,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  Radio,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { LocationService, LocationCoordinates, GeofenceResult } from '../../services/location/locationService';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { AttendanceService } from '../../services/firebase/attendanceService';
import { useAuth } from '../../contexts/AuthContext';
import { DraftService } from '../../services/offline/draftService';
import { PERMISSIONS } from '../../config/permissions';
import { AttendanceRecord, AttendanceStatus, ScheduleItem, SchoolSettings } from '../../types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName, getTodayISODate, toEpochMs } from '../../utils/dateUtils';
import { isScheduleMatchingUser } from '../../utils/scheduleUtils';
import { AttendancePolicy, WindowCheckResult } from '../../services/attendance/attendancePolicy';
import { CapturedSelfie, stampCheckInSelfie, validateSelfieEvidence } from '../../services/attendance/selfieWatermark';

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
        <RefreshCw className="w-4 h-4 shrink-0 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] mt-0.5 animate-spin" />
      )}
      <div className="flex-1 font-semibold">{status.message}</div>
    </div>
  );
};

export const AttendancePreview: React.FC = () => {
  const { currentUser, hasRole, hasPermission, isOffline } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

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

  // Form State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [capturedSelfie, setCapturedSelfie] = useState<CapturedSelfie | null>(null);
  const pendingSelfieRef = React.useRef<CapturedSelfie | null>(null);
  const capturedPhoto = capturedSelfie?.dataUrl || null;
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const todayName = getCurrentDayName();
  const todayISO = getTodayISODate();

  // Evaluates check-out window for today according to authoritative school settings
  const windowCheck: WindowCheckResult = AttendancePolicy.validateCheckOutWindow(
    todayName,
    settings,
    isAdmin
  );

  // 1. Load Settings & Subscriptions
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) {
        setSettings(data);
        setSettingsReady(true);
      }
    }).catch(() => {
      setCheckInStatus({ tone: 'error', message: 'Pengaturan sekolah belum berhasil dimuat. Muat ulang halaman sebelum mengambil swafoto.' });
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', setStaff);

    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', (data) => {
      setAttendanceList(
        data.sort((a, b) => toEpochMs(b.jamMasuk) - toEpochMs(a.jamMasuk))
      );
    });

    return () => {
      LocationService.clearCurrentWatcher();
      if (slowTxTimerRef.current) {
        clearTimeout(slowTxTimerRef.current);
      }
      unsubSched();
      unsubTeachers();
      unsubStaff();
      unsubAtt();
    };
  }, []);

  useEffect(() => {
    // A photo must never survive an account or school-location change.
    setCapturedSelfie(null);
    pendingSelfieRef.current = null;
    setIsCameraModalOpen(false);
  }, [currentUser?.id, currentUser?.fullName, currentUser?.loginId, settings.schoolName,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters]);

  // 2. Fetch live GPS position on mount & manual refresh
  const refreshGpsLocation = async (isManual = false) => {
    setIsLocating(true);
    setIsProvisional(false);
    setGpsError(null);
    try {
      const position = await LocationService.getCurrentPosition({
        timeoutMs: 10000, // Capped at max 10 seconds
        desiredAccuracyMeters: 20,
        onProgress: (pos, isProv) => {
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
        setGpsError(`Akurasi sinyal GPS saat ini (±${Math.round(position.accuracy)}m) belum memenuhi kebijakan presensi (maksimal ≤50m). Silakan pindah ke area terbuka dan klik tombol Coba Lagi.`);
      } else if (isManual) {
        setFeedbackSuccess(`Koordinat GPS berhasil disinkronkan (Akurasi: ±${Math.round(position.accuracy)}m)!`);
        setTimeout(() => setFeedbackSuccess(null), 3500);
      }
    } catch (err: any) {
      console.warn('GPS detection error:', err);
      setGpsError(err.message || 'Gagal membaca koordinat GPS.');
      setCoords(null);
      setGeofence({
        distanceMeters: 999,
        isWithinRadius: false,
        accuracyQuality: 'RENDAH',
        status: 'GPS_ERROR',
      });
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (settings.schoolLat && settings.schoolLng) {
      refreshGpsLocation();
    }
    return () => {
      LocationService.clearCurrentWatcher();
    };
  }, [settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters]);

  // Today's schedule for current logged in user (strictly bound by ID/UID akun, with legacy teacher fallback)
  const isMySchedule = (s: ScheduleItem) => isScheduleMatchingUser(s, currentUser, teachers, staff);

  const todayUserSchedules = schedules.filter(
    (s) => s.hari === todayName && (isAdmin || isMySchedule(s))
  );

  useEffect(() => {
    if (todayUserSchedules.length > 0 && !selectedScheduleId) {
      setSelectedScheduleId(todayUserSchedules[0].id);
    }
  }, [todayUserSchedules, selectedScheduleId]);

  // Existing attendance record today for this schedule/user
  const existingAttendanceToday = attendanceList.find(
    (a) => a.tanggal === todayISO && a.userId === currentUser?.id
  );

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

  const prepareSelfieCapture = async () => {
    pendingSelfieRef.current = null;
    if (!currentUser) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.');
    if (!settingsReady) throw new Error('Pengaturan sekolah belum tersedia. Muat ulang halaman sebelum mengambil foto.');
    const captureCoords = { ...await LocationService.ensureFreshPosition(coords, () =>
      LocationService.getCurrentPosition({ timeoutMs: 10000, desiredAccuracyMeters: 20 }), 15000) };
    const captureGeofence = LocationService.evaluateGeofence(
      captureCoords.latitude, captureCoords.longitude, captureCoords.accuracy,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters
    );
    if (captureGeofence.status !== 'DALAM_LOKASI') {
      throw new Error('GPS harus akurat dan berada dalam radius sekolah sebelum swafoto presensi. Perbarui lokasi lalu coba lagi.');
    }
    setCoords(captureCoords);
    setGeofence(captureGeofence);
    const identity = {
      userId: currentUser.id, userName: currentUser.fullName,
      loginId: currentUser.loginId, schoolName: settings.schoolName,
    };
    return (canvas: HTMLCanvasElement, capturedAt: number) => {
      const evidence = { ...identity, coords: captureCoords, capturedAt };
      const dataUrl = stampCheckInSelfie(canvas, evidence);
      pendingSelfieRef.current = { ...evidence, dataUrl };
      return dataUrl;
    };
  };

  // --- SUBMIT PRESENSI MASUK ---
  const handleCheckIn = async () => {
    if (isSubmitting) return; // Prevent double click
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
      validateSelfieEvidence(capturedSelfie);
      const photoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(capturedSelfie.capturedAt));
      if (photoDate !== todayISO) throw new Error('Tanggal foto sudah berganti. Muat ulang halaman dan ambil swafoto baru.');
    } catch (error: any) {
      setCheckInStatus({ tone: 'error', message: error.message });
      return;
    }
    // Store exactly the coordinates printed on this photo, not a later GPS reading.
    const coords = capturedSelfie.coords;
    const geofence = LocationService.evaluateGeofence(
      coords.latitude, coords.longitude, coords.accuracy,
      settings.schoolLat, settings.schoolLng, settings.allowedRadiusMeters
    );
    if (!coords || !geofence || geofence.status === 'GPS_ERROR') {
      setCheckInStatus({
        tone: 'error',
        message: 'Koordinat GPS belum berhasil diperoleh. Pastikan GPS aktif dan klik tombol "Perbarui Koordinat GPS".',
      });
      return;
    }

    if (coords.accuracy > LocationService.MAX_ATTENDANCE_ACCURACY_METERS) {
      setCheckInStatus({
        tone: 'error',
        message: `Akurasi GPS (±${Math.round(coords.accuracy)}m) terlalu rendah untuk presensi (kebijakan presensi ≤50m). Silakan pindah ke area terbuka dan perbarui GPS.`,
      });
      return;
    }

    if (!LocationService.isFreshPosition(coords, 30000)) {
      setCheckInStatus({
        tone: 'error',
        message: 'GPS pada swafoto sudah kedaluwarsa (>30 detik). Ambil ulang swafoto agar foto dan koordinat presensi tetap sesuai.',
      });
      return;
    }

    if (geofence.status === 'DI_LUAR_LOKASI') {
      setCheckInStatus({
        tone: 'error',
        message: `Lokasi Anda berada di luar radius sekolah (${geofence.distanceMeters}m dari pusat sekolah, batas: ${settings.allowedRadiusMeters}m). Presensi masuk ditolak.`,
      });
      return;
    }

    if (!capturedPhoto || capturedPhoto.trim().length === 0) {
      setCheckInStatus({
        tone: 'error',
        message: 'Mohon ambil swafoto selfie di pos piket terlebih dahulu sebelum mengirim presensi masuk.',
      });
      return;
    }

    let currentSchedule: ScheduleItem | undefined = undefined;
    if (selectedScheduleId) {
      currentSchedule = schedules.find((s) => s.id === selectedScheduleId);
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
        coords,
        geofence,
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

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Presensi GPS Piket Guru
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Validasi kehadiran berbasis koordinat Geolocation, jarak radius sekolah, dan swafoto selfie
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[var(--theme-surface-subtle)] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('presensi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'presensi'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Formulir Presensi
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Rekap Kehadiran ({attendanceList.length})
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
                action={
                  <Badge
                    variant={
                      isLocating
                        ? 'neutral'
                        : geofence?.status === 'DALAM_LOKASI'
                        ? 'success'
                        : geofence?.status === 'AKURASI_RENDAH'
                        ? 'warning'
                        : 'danger'
                    }
                    icon={
                      isLocating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {isLocating
                      ? isProvisional
                        ? `Menyelaraskan GPS (±${Math.round(coords?.accuracy || 0)}m)`
                        : 'Mencari Sinyal GPS...'
                      : geofence?.status === 'DALAM_LOKASI'
                      ? 'Dalam Radius Sekolah'
                      : geofence?.status === 'AKURASI_RENDAH'
                      ? 'Akurasi GPS Rendah'
                      : geofence?.status === 'GPS_ERROR'
                      ? 'GPS Belum Terhubung'
                      : 'Di Luar Radius'}
                  </Badge>
                }
              />
              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* Geolocation Status HUD */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl text-white shadow-sm flex items-center justify-center ${
                        isLocating
                          ? 'bg-[var(--theme-primary)] shadow-[var(--theme-ring)] animate-pulse'
                          : geofence?.isWithinRadius
                          ? 'bg-emerald-600 shadow-emerald-500/20'
                          : 'bg-rose-600 shadow-rose-500/20'
                      }`}>
                        {isLocating ? (
                          <Radio className="w-5 h-5 animate-spin" />
                        ) : (
                          <Navigation className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Pusat Geofence: {settings.schoolName}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Batas Toleransi: <strong>{settings.allowedRadiusMeters} meter</strong> dari koordinat sekolah
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs self-start sm:self-center"
                      isLoading={isLocating}
                      leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />}
                      onClick={() => refreshGpsLocation(true)}
                    >
                      {isLocating ? 'Menyelaraskan...' : 'Perbarui Koordinat GPS'}
                    </Button>
                  </div>

                  {gpsError ? (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-bold block">Kendala Sinyal / Izin Lokasi:</span>
                          <p className="text-[11px] leading-relaxed">{gpsError}</p>
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        className="text-xs shrink-0 self-end sm:self-center"
                        isLoading={isLocating}
                        leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />}
                        onClick={() => refreshGpsLocation(true)}
                      >
                        Coba Lagi (Perbarui GPS)
                      </Button>
                    </div>
                  ) : coords ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Jarak dari Sekolah:</span>
                        <span className={`font-bold font-mono text-sm block truncate ${geofence?.isWithinRadius ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {geofence?.distanceMeters ?? '-'} Meter
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Akurasi GPS:</span>
                        <span className={`font-bold font-mono text-xs block truncate ${
                          coords.accuracy <= 20
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : coords.accuracy <= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600'
                        }`}>
                          ± {Math.round(coords.accuracy)} Meter {isProvisional ? '(Sementara)' : ''}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Waktu Pembacaan:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] block truncate">
                          {new Date(coords.timestamp).toLocaleTimeString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })} WIB
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Koordinat Terbaca:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 text-[10px] block truncate" title={`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`}>
                          {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-center text-xs text-slate-400">
                      {isLocating ? 'Sedang mencari satelit GPS...' : 'GPS belum disinkronkan. Klik tombol Perbarui di atas.'}
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
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Jadwal Shift Hari Ini ({todayName}):
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 ml-1 font-semibold">
                            {todayShiftConfig.start} - {todayShiftConfig.end} WIB
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                        <span>
                          Masuk: <strong className="text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)]">{todayShiftConfig.checkInStart} - {todayShiftConfig.checkInEnd}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Pulang: <strong className="text-indigo-600 dark:text-indigo-400">{todayShiftConfig.checkOutStart} - {todayShiftConfig.checkOutEnd}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Shift Selector */}
                {todayUserSchedules.length > 0 ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pilih Pos / Shift Piket Anda Hari Ini:
                    </label>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-semibold"
                    >
                      {settings.attendanceMode === 'BEBAS' && (
                        <option value="">Tanpa Penugasan Jadwal Tertentu (Mode Bebas)</option>
                      )}
                      {todayUserSchedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ruangName} ({s.jamMulai} - {s.jamSelesai} WIB)
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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Swafoto Selfie di Pos / Area Tugas:
                  </label>

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
                    <div
                      onClick={() => setIsCameraModalOpen(true)}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[var(--theme-primary)] rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-[var(--theme-surface-subtle)]/50 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Klik untuk Ambil Swafoto Selfie
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Gunakan kamera depan ponsel atau laptop di pos piket
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  {!existingAttendanceToday ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                        <Button
                          variant="success"
                          size="lg"
                          className="w-full sm:w-auto"
                          isLoading={isSubmitting}
                          disabled={
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
                          className="w-full sm:w-auto"
                          isLoading={isCheckingOut}
                          disabled={isCheckingOut || isSubmitting}
                          leftIcon={<Clock className="w-5 h-5" />}
                          onClick={handleCheckOut}
                        >
                          {isCheckingOut ? 'Memproses Pulang...' : 'Kirim Presensi Pulang (Check-Out)'}
                        </Button>
                      </div>

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
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
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
          <div className="space-y-4">
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
            subtitle="Pencatatan waktu, jarak geofence GPS, dan verifikasi swafoto"
          />
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Guru / Petugas</th>
                  <th className="p-4">Jam Masuk</th>
                  <th className="p-4">Jam Pulang</th>
                  <th className="p-4">Jarak GPS</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Belum ada rekaman data presensi piket.
                    </td>
                  </tr>
                ) : (
                  attendanceList.map((item) => (
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* CAMERA CAPTURE MODAL */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        allowFileUpload={false}
        prepareCapture={prepareSelfieCapture}
        onCapture={(dataUrl) => {
          const evidence = pendingSelfieRef.current;
          if (evidence && evidence.dataUrl === dataUrl && evidence.userId === currentUser?.id) {
            setCapturedSelfie(evidence);
            setCheckInStatus({ tone: 'info', message: 'Swafoto berwatermark siap & tersimpan sebagai draf. Segera tekan Kirim Presensi Masuk.' });
            if (currentUser?.id) {
              DraftService.saveDraft(currentUser.id, 'ATTENDANCE_CHECKIN', todayISO, evidence).catch(console.warn);
            }
          }
          pendingSelfieRef.current = null;
        }}
      />

      {/* PHOTO PREVIEW MODAL */}
      <Modal
        isOpen={!!viewPhoto}
        onClose={() => setViewPhoto(null)}
        title="Dokumentasi Swafoto Presensi"
        maxWidth="sm"
      >
        <div className="space-y-3 text-center">
          {viewPhoto && (
            <img
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
