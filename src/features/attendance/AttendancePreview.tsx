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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { LocationService, LocationCoordinates, GeofenceResult } from '../../services/location/locationService';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import {
  AttendanceRecord,
  AttendanceStatus,
  ScheduleItem,
  SchoolSettings,
} from '../../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName } from '../../utils/dateUtils';

export const AttendancePreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  
  // GPS Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [coords, setCoords] = useState<LocationCoordinates | null>(null);
  const [geofence, setGeofence] = useState<GeofenceResult | null>(null);

  // Form State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Photo viewer modal
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // Active Tab: Presensi Mandiri vs Rekap Kehadiran
  const [activeTab, setActiveTab] = useState<'presensi' | 'riwayat'>('presensi');

  const todayName = getCurrentDayName();
  const todayISO = new Date().toISOString().split('T')[0];

  // 1. Load Settings & Subscriptions
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
    });

    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', (data) => {
      setAttendanceList(
        data.sort((a, b) => new Date(b.jamMasuk).getTime() - new Date(a.jamMasuk).getTime())
      );
    });

    return () => {
      unsubSched();
      unsubAtt();
    };
  }, []);

  // 2. Fetch live GPS position on mount
  const refreshGpsLocation = async () => {
    setIsLocating(true);
    setGpsError(null);
    try {
      const position = await LocationService.getCurrentPosition();
      setCoords(position);

      const geo = LocationService.evaluateGeofence(
        position.latitude,
        position.longitude,
        position.accuracy,
        settings.schoolLat,
        settings.schoolLng,
        settings.allowedRadiusMeters
      );
      setGeofence(geo);
    } catch (err: any) {
      console.warn('GPS detection error:', err);
      setGpsError(err.message || 'Gagal membaca koordinat GPS.');
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
    refreshGpsLocation();
  }, [settings]);

  // Today's schedule for current logged in user
  const todayUserSchedules = schedules.filter(
    (s) => s.hari === todayName && (isAdmin || s.petugasId === currentUser?.id || s.petugasName.includes(currentUser?.fullName?.split(' ')[0] || ''))
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

  // --- SUBMIT PRESENSI MASUK ---
  const handleCheckIn = async () => {
    if (!currentUser) return;
    if (!coords && !geofence) {
      setGpsError('Mohon perbarui lokasi GPS Anda terlebih dahulu sebelum melakukan presensi.');
      return;
    }

    const currentSchedule = schedules.find((s) => s.id === selectedScheduleId) || todayUserSchedules[0];

    const attStatus: AttendanceStatus = geofence?.status || 'DALAM_LOKASI';
    const id = `att-${todayISO}-${currentUser.id}`;

    const record: AttendanceRecord = {
      id,
      scheduleId: currentSchedule ? currentSchedule.id : 'general-duty',
      userId: currentUser.id,
      userName: currentUser.fullName,
      tanggal: todayISO,
      jamMasuk: new Date().toISOString(),
      latitude: coords?.latitude || settings.schoolLat,
      longitude: coords?.longitude || settings.schoolLng,
      accuracy: coords?.accuracy || 5,
      distance: geofence?.distanceMeters || 0,
      status: attStatus,
      photoUrl: capturedPhoto || undefined,
    };

    setIsSubmitting(true);
    try {
      await FirestoreService.setDocument('attendance', id, record);
      await FirestoreService.logAudit({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        action: 'ATTENDANCE',
        module: 'ATTENDANCE',
        recordId: id,
        details: `Presensi Masuk Tugas Piket (${attStatus}) - Jarak: ${record.distance}m`,
      });

      setFeedbackSuccess('Presensi masuk Anda berhasil dicatat ke sistem!');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT PRESENSI PULANG ---
  const handleCheckOut = async () => {
    if (!existingAttendanceToday || !currentUser) return;

    setIsSubmitting(true);
    try {
      const updated: AttendanceRecord = {
        ...existingAttendanceToday,
        jamPulang: new Date().toISOString(),
      };

      await FirestoreService.setDocument('attendance', existingAttendanceToday.id, updated);
      await FirestoreService.logAudit({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        action: 'ATTENDANCE',
        module: 'ATTENDANCE',
        recordId: existingAttendanceToday.id,
        details: `Presensi Pulang Tugas Piket berhasil dicatat.`,
      });

      setFeedbackSuccess('Presensi pulang Anda berhasil dicatat. Terima kasih atas dedikasi tugas piket hari ini!');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } finally {
      setIsSubmitting(false);
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
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('presensi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'presensi'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Formulir Presensi
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                      geofence?.status === 'DALAM_LOKASI'
                        ? 'success'
                        : geofence?.status === 'AKURASI_RENDAH'
                        ? 'warning'
                        : 'danger'
                    }
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    {geofence?.status === 'DALAM_LOKASI'
                      ? 'Dalam Radius Sekolah'
                      : geofence?.status === 'AKURASI_RENDAH'
                      ? 'Akurasi GPS Rendah'
                      : geofence?.status === 'GPS_ERROR'
                      ? 'GPS Error'
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
                        geofence?.isWithinRadius ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'
                      }`}>
                        <Navigation className="w-5 h-5" />
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
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={refreshGpsLocation}
                    >
                      Perbarui Koordinat GPS
                    </Button>
                  </div>

                  {gpsError ? (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{gpsError}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Jarak Terkini:</span>
                        <span className={`font-bold font-mono text-sm block truncate ${geofence?.isWithinRadius ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {geofence?.distanceMeters ?? '-'} Meter
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Akurasi GPS:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs block truncate">
                          ± {coords?.accuracy ? Math.round(coords.accuracy) : 8} Meter
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Latitude:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 text-[10px] block truncate">
                          {coords?.latitude?.toFixed(6) ?? settings.schoolLat}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block truncate">Longitude:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 text-[10px] block truncate">
                          {coords?.longitude?.toFixed(6) ?? settings.schoolLng}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shift Selector */}
                {todayUserSchedules.length > 0 ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pilih Pos / Shift Piket Anda Hari Ini:
                    </label>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      {todayUserSchedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ruangName} ({s.jamMulai} - {s.jamSelesai} WIB)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-blue-900 dark:text-blue-200 text-xs">
                    Anda tidak memiliki jadwal shift terjadwal khusus hari ini ({todayName}). Presensi akan dicatat sebagai tugas umum.
                  </div>
                )}

                {/* Camera Selfie Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Swafoto Selfie di Pos / Area Tugas:
                  </label>

                  {capturedPhoto ? (
                    <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                      <img
                        src={capturedPhoto}
                        alt="Preview Foto"
                        className="w-20 h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shadow-xs"
                      />
                      <div className="space-y-1">
                        <Badge variant="success" size="sm" icon={<Check className="w-3 h-3" />}>
                          Foto Terlampir
                        </Badge>
                        <p className="text-[11px] text-slate-500">
                          Foto siap disimpan bersama metadata koordinat GPS.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Ganti Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsCameraModalOpen(true)}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
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
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
                  {!existingAttendanceToday ? (
                    <Button
                      variant="success"
                      size="lg"
                      className="w-full sm:w-auto"
                      isLoading={isSubmitting}
                      leftIcon={<CheckCircle2 className="w-5 h-5" />}
                      onClick={handleCheckIn}
                    >
                      Kirim Presensi Masuk (Check-In)
                    </Button>
                  ) : !existingAttendanceToday.jamPulang ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                      <Badge variant="success" size="md">
                        Sudah Check-In ({formatTime(existingAttendanceToday.jamMasuk)})
                      </Badge>
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full sm:w-auto"
                        isLoading={isSubmitting}
                        leftIcon={<Clock className="w-5 h-5" />}
                        onClick={handleCheckOut}
                      >
                        Kirim Presensi Pulang (Check-Out)
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Presensi Masuk & Pulang Hari Ini Telah Lengkap Selesai</span>
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
                    </div>

                    {existingAttendanceToday.photoUrl && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setViewPhoto(existingAttendanceToday.photoUrl || null)}
                          className="flex items-center gap-2 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
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
                {attendanceList.map((item) => (
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
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 hover:bg-blue-100 cursor-pointer"
                          title="Lihat Foto"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* CAMERA CAPTURE MODAL */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(dataUrl) => {
          setCapturedPhoto(dataUrl);
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
              className="w-full rounded-2xl object-cover aspect-4/3 border border-slate-200 dark:border-slate-800 shadow-md"
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
