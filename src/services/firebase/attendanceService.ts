import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { FirestoreService } from './firestoreService';
import { AttendanceRecord, AttendanceStatus, UserRole, SchoolSettings } from '../../types';
import { LocationCoordinates, GeofenceResult } from '../location/locationService';
import { formatTime, getTodayISODate, getCurrentDayName, getCurrentTimeHHMM } from '../../utils/dateUtils';
import { getShiftHoursForDay } from '../../utils/scheduleUtils';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { AttendancePolicy, AttendanceError } from '../attendance/attendancePolicy';

export interface CheckInParams {
  userId: string;
  userName: string;
  scheduleId?: string | null;
  attendanceModeAtCheckIn?: 'TERJADWAL' | 'BEBAS';
  tanggal: string; // ISO date 'YYYY-MM-DD'
  coords: LocationCoordinates;
  geofence: GeofenceResult;
  photoUrl?: string;
  userRole?: UserRole | string;
  settings?: SchoolSettings;
}

export interface CheckOutParams {
  attendanceId?: string;
  userId: string;
  userName: string;
  userRole?: UserRole | string;
  isAdmin?: boolean;
  tanggal?: string;
  settings?: SchoolSettings;
}

export interface CheckOutResult {
  success: boolean;
  confirmed: boolean;
  message: string;
  data: AttendanceRecord;
}

export class AttendanceService {
  /**
   * Submit Attendance Check-In.
   * Ensures high-fidelity coordinates, valid schedule assignment (in TERJADWAL mode),
   * supports scheduleId: null in BEBAS mode, and strictly enforces single daily record.
   */
  public static async checkIn(params: CheckInParams): Promise<AttendanceRecord> {
    const {
      userId,
      userName,
      scheduleId,
      tanggal,
      coords,
      geofence,
      photoUrl,
      userRole = 'GURU',
      settings: callerSettings,
    } = params;

    if (!userId) {
      throw new Error('Identitas pengguna tidak valid.');
    }
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      throw new Error('Koordinat GPS tidak valid. Pastikan GPS aktif dan telah disinkronisasi.');
    }

    // 1. Stage read-settings: determine authoritative attendance mode
    let authoritativeSettings = callerSettings;
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'school_config'));
      if (settingsSnap.exists()) {
        authoritativeSettings = settingsSnap.data() as SchoolSettings;
      }
    } catch (sErr: any) {
      if (sErr?.code === 'permission-denied') {
        throw new AttendanceError('Izin membaca konfigurasi sekolah ditolak Firebase.', 'read-settings', sErr);
      }
    }

    const effectiveMode: 'TERJADWAL' | 'BEBAS' =
      authoritativeSettings?.attendanceMode === 'BEBAS' ? 'BEBAS' : 'TERJADWAL';

    // In TERJADWAL mode: schedule is strictly mandatory
    if (effectiveMode === 'TERJADWAL' && (!scheduleId || scheduleId.trim().length === 0)) {
      throw new Error('Pada mode Terjadwal, jadwal penugasan piket hari ini wajib dipilih.');
    }

    const attendanceId = `att-${tanggal}-${userId}`;
    const docRef = doc(db, 'attendance', attendanceId);

    // 2. Stage read-record: Check if record already exists for today
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as AttendanceRecord;
        throw new Error(
          `Presensi masuk hari ini (${tanggal}) sudah pernah tercatat pada pukul ${formatTime(
            existingData.jamMasuk
          )}.`
        );
      }
    } catch (rErr: any) {
      if (rErr instanceof Error && rErr.message.includes('sudah pernah tercatat')) {
        throw rErr;
      }
      if (rErr?.code === 'permission-denied') {
        throw new AttendanceError('Izin membaca catatan presensi ditolak Firebase.', 'read-record', rErr);
      }
    }

    const nowIso = new Date().toISOString();
    const status: AttendanceStatus = geofence?.status || 'DALAM_LOKASI';

    // In BEBAS mode without a schedule, scheduleId is stored as null (never a fake general-duty doc)
    const storedScheduleId = scheduleId ? scheduleId.trim() : null;

    const record: AttendanceRecord = {
      id: attendanceId,
      scheduleId: storedScheduleId,
      userId,
      userName,
      tanggal,
      jamMasuk: nowIso,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: Math.round(coords.accuracy * 10) / 10,
      distance: Math.round(geofence.distanceMeters),
      status,
      photoUrl: photoUrl || undefined,
      attendanceModeAtCheckIn: effectiveMode,
      dataSource: 'PRODUCTION',
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 3. Stage write-check-in: Persist check-in record
    try {
      await setDoc(docRef, record);
    } catch (wErr: any) {
      if (wErr?.code === 'permission-denied' || String(wErr?.message).includes('permission-denied')) {
        throw new AttendanceError(
          'Izin presensi masuk ditolak Firebase (write-check-in). Pastikan akun aktif dan memiliki hak presensi.',
          'write-check-in',
          wErr
        );
      }
      throw wErr;
    }

    // Non-blocking audit log
    FirestoreService.logAudit({
      userId,
      userName,
      role: userRole,
      action: 'ATTENDANCE',
      module: 'ATTENDANCE',
      recordId: attendanceId,
      details: `Presensi Masuk Tugas Piket (${status}) [Mode ${effectiveMode}] - Jarak: ${record.distance}m, Akurasi: ±${record.accuracy}m`,
      metadata: {
        tanggal,
        latitude: record.latitude,
        longitude: record.longitude,
        accuracy: record.accuracy,
        distance: record.distance,
        mode: effectiveMode,
        scheduleId: storedScheduleId,
      },
    }).catch((err) => {
      console.warn('Audit log recording non-fatal error:', err);
    });

    return record;
  }

  /**
   * Submit Attendance Check-Out using atomic Firestore Transaction with serverTimestamp.
   * Strictly verifies ownership, ensures existing check-in, verifies active account & unrevoked session,
   * prevents duplicate check-outs, and stages errors with exact stage diagnostics.
   */
  public static async checkOut(params: CheckOutParams): Promise<CheckOutResult> {
    const { attendanceId, userId, userName, userRole = 'GURU', isAdmin = false, tanggal } = params;

    if (!userId) {
      throw new Error('Identitas pengguna tidak valid.');
    }

    // Authenticated user session verification
    if (auth.currentUser && auth.currentUser.uid !== userId && !isAdmin) {
      throw new Error('Akses ditolak: Identitas pengguna tidak sesuai dengan sesi login aktif.');
    }

    const targetDate = tanggal || getTodayISODate();
    const targetDocId = attendanceId || `att-${targetDate}-${userId}`;
    const docRef = doc(db, 'attendance', targetDocId);

    // 1. Stage read-profile: Verify user profile isActive and sessionRevokedAt in Firestore
    try {
      let userSnap;
      try {
        userSnap = await getDoc(doc(db, 'users', userId));
      } catch (pErr: any) {
        if (pErr?.code === 'permission-denied') {
          throw new AttendanceError('Izin membaca profil akun ditolak Firebase.', 'read-profile', pErr);
        }
        throw pErr;
      }

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.isActive === false) {
          throw new Error('Akun Anda dinonaktifkan oleh Administrator. Presensi pulang ditolak.');
        }
        if (userData.requiresActivation === true) {
          throw new Error('Akun Anda belum diaktivasi oleh Administrator. Presensi pulang ditolak.');
        }
        if (auth.currentUser) {
          const tokenRes = await auth.currentUser.getIdTokenResult();
          const authTimeSec = tokenRes?.claims?.auth_time;
          if (
            typeof authTimeSec === 'number' &&
            typeof userData.sessionRevokedAtSeconds === 'number' &&
            authTimeSec <= userData.sessionRevokedAtSeconds
          ) {
            throw new Error('Sesi Anda telah dicabut oleh Administrator atau PIN telah diubah. Silakan masuk kembali.');
          }
        }
      }
    } catch (checkErr: any) {
      if (checkErr instanceof AttendanceError) throw checkErr;
      if (
        checkErr.message?.includes('Akun Anda') ||
        checkErr.message?.includes('Sesi Anda')
      ) {
        throw checkErr;
      }
      console.warn('[AttendanceService] Profile pre-check warning:', checkErr);
    }

    // Execute atomic transaction
    let capturedStage: 'read-settings' | 'read-record' | 'write-check-out' = 'read-settings';
    let transactionKeterangan = 'Tepat Waktu';

    try {
      await runTransaction(db, async (transaction) => {
        // Stage read-settings: Read authoritative school settings within transaction
        capturedStage = 'read-settings';
        const schoolConfigRef = doc(db, 'settings', 'school_config');
        let settingsSnap;
        try {
          settingsSnap = await transaction.get(schoolConfigRef);
        } catch (sErr: any) {
          throw new AttendanceError(sErr.message, 'read-settings', sErr);
        }

        const authoritativeSettings: SchoolSettings = settingsSnap.exists()
          ? (settingsSnap.data() as SchoolSettings)
          : (params.settings || DEFAULT_SCHOOL_SETTINGS);

        // Stage read-record: Read existing attendance record
        capturedStage = 'read-record';
        let snap;
        try {
          snap = await transaction.get(docRef);
        } catch (rErr: any) {
          throw new AttendanceError(rErr.message, 'read-record', rErr);
        }

        if (!snap.exists()) {
          throw new Error(
            'Data presensi masuk untuk hari ini tidak ditemukan di sistem. Pastikan Anda telah melakukan presensi masuk terlebih dahulu.'
          );
        }

        const current = snap.data() as AttendanceRecord;

        // Verify ownership (unless admin)
        if (!isAdmin && current.userId !== userId) {
          throw new Error(
            'Akses ditolak: Anda hanya dapat melakukan presensi pulang untuk catatan kehadiran Anda sendiri.'
          );
        }

        // Check if check-in exists and is non-empty
        const validJamMasuk = Boolean(
          current.jamMasuk &&
          (typeof current.jamMasuk === 'string' ? current.jamMasuk.trim().length > 0 : true)
        );

        if (!validJamMasuk) {
          throw new Error(
            'Data presensi masuk untuk hari ini belum valid atau tidak lengkap. Presensi pulang ditolak.'
          );
        }

        // Check if already checked out
        const hasCheckedOut = Boolean(
          current.jamPulang &&
          (typeof current.jamPulang === 'string' ? current.jamPulang.trim().length > 0 : true)
        );

        if (hasCheckedOut) {
          throw new Error(
            `Presensi pulang sudah tercatat sebelumnya pada pukul ${formatTime(
              current.jamPulang
            )}. Checkout kedua ditolak.`
          );
        }

        // Snapshot mode, shift end, late checkout calculation strictly based on settings read in transaction
        const todayDay = getCurrentDayName();
        const shift = getShiftHoursForDay(todayDay, authoritativeSettings);
        const mode: 'TERJADWAL' | 'BEBAS' =
          authoritativeSettings.attendanceMode === 'BEBAS' ? 'BEBAS' : 'TERJADWAL';
        const currentTime = getCurrentTimeHHMM();

        let keterlambatanMenit = 0;
        let keterangan = 'Tepat Waktu';

        if (mode === 'BEBAS') {
          keterangan = 'Presensi Pulang (Mode Bebas)';
        } else {
          const lateNote = AttendancePolicy.calculateCheckoutLateNote(shift.checkOutEnd, currentTime);
          keterlambatanMenit = lateNote.keterlambatanMenit;
          keterangan = lateNote.keterangan;
        }

        transactionKeterangan = keterangan;

        const policySnapshot = {
          mode,
          day: todayDay,
          checkOutStart: shift.checkOutStart,
          checkOutEnd: shift.checkOutEnd,
          keterlambatanMenit,
          keterangan,
        };

        // Stage write-check-out: Update jamPulang, updatedAt, and checkoutPolicy atomically
        // Diff strictly matches firestore.rules hasOnly(['jamPulang', 'updatedAt', 'checkoutPolicy'])
        capturedStage = 'write-check-out';
        transaction.update(docRef, {
          jamPulang: serverTimestamp(),
          updatedAt: serverTimestamp(),
          checkoutPolicy: policySnapshot,
        });
      });
    } catch (txErr: any) {
      if (txErr instanceof AttendanceError) {
        throw txErr;
      }
      if (txErr?.code === 'permission-denied' || String(txErr?.message).includes('permission-denied')) {
        throw new AttendanceError(txErr.message, capturedStage, txErr);
      }
      throw txErr;
    }

    // Re-read document to obtain server-confirmed timestamp (capped at max 4 seconds)
    let freshRecord: AttendanceRecord | null = null;
    let readConfirmed = false;
    try {
      const readPromise = getDoc(docRef);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('READBACK_TIMEOUT')), 4000)
      );
      const freshSnap = (await Promise.race([readPromise, timeoutPromise])) as any;
      if (freshSnap?.exists()) {
        freshRecord = { id: freshSnap.id, ...freshSnap.data() } as AttendanceRecord;
        readConfirmed = true;
      }
    } catch (readErr) {
      console.warn('[AttendanceService] Confirmation readback delayed or timed out (non-fatal):', readErr);
    }

    const confirmedTimeDisplay = freshRecord?.jamPulang
      ? formatTime(freshRecord.jamPulang)
      : null;

    const message = confirmedTimeDisplay
      ? `Presensi pulang berhasil dicatat pada pukul ${confirmedTimeDisplay} (${transactionKeterangan}). Terima kasih atas dedikasi tugas piket hari ini!`
      : `Presensi pulang sudah tersimpan di server (${transactionKeterangan}), waktu server sedang dimuat; jangan kirim ulang.`;

    // Non-blocking audit log
    FirestoreService.logAudit({
      userId,
      userName,
      role: userRole,
      action: 'ATTENDANCE',
      module: 'ATTENDANCE',
      recordId: targetDocId,
      details: `Presensi Pulang Tugas Piket dicatat (${confirmedTimeDisplay || 'tersimpan'}).`,
      metadata: {
        attendanceId: targetDocId,
        jamMasuk: freshRecord?.jamMasuk,
        jamPulang: freshRecord?.jamPulang || 'SERVER_TIMESTAMP',
      },
    }).catch((auditErr) => {
      console.warn('Audit log for checkout non-fatal error:', auditErr);
    });

    return {
      success: true,
      confirmed: readConfirmed,
      message,
      data: freshRecord || ({
        id: targetDocId,
        userId,
        userName,
        tanggal: targetDate,
        jamPulang: 'SERVER_CONFIRMED',
      } as any),
    };
  }

  /**
   * Fetch attendance record for a specific user and date.
   */
  public static async getByDateAndUser(
    tanggal: string,
    userId: string
  ): Promise<AttendanceRecord | null> {
    const attendanceId = `att-${tanggal}-${userId}`;
    return FirestoreService.getById<AttendanceRecord>('attendance', attendanceId);
  }
}
