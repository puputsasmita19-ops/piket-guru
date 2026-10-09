import { DayOfWeek, SchoolSettings } from '../../types';
import { getShiftHoursForDay } from '../../utils/scheduleUtils';
import { getCurrentTimeHHMM } from '../../utils/dateUtils';

export interface WindowCheckResult {
  allowed: boolean;
  reason?: string;
  mode: 'TERJADWAL' | 'BEBAS';
  start: string;
  end: string;
  currentTime: string;
  keterlambatanMenit?: number;
  keterangan?: string;
}

export type AttendanceOperationStage =
  | 'read-profile'
  | 'read-settings'
  | 'read-record'
  | 'read-schedule'
  | 'write-check-in'
  | 'write-check-out';

export class AttendanceError extends Error {
  public code?: string;
  public stage: AttendanceOperationStage;
  public originalError: any;

  constructor(message: string, stage: AttendanceOperationStage, originalError?: any) {
    super(message);
    this.name = 'AttendanceError';
    this.stage = stage;
    this.code = originalError?.code;
    this.originalError = originalError;
  }
}

export class AttendancePolicy {
  /**
   * Calculates the late checkout difference and human-readable explanation based on checkOutEnd.
   * e.g. checkOutEnd 15:30 and jamPulang 16:00 WIB -> 30 mins late -> "Melewati batas checkout 30 menit"
   */
  public static calculateCheckoutLateNote(
    checkOutEnd: string,
    timeHHMM: string
  ): { keterlambatanMenit: number; keterangan: string } {
    const [endH, endM] = (checkOutEnd || '17:00').split(':').map(Number);
    const [nowH, nowM] = (timeHHMM || '00:00').split(':').map(Number);
    const endMinutes = (isNaN(endH) ? 17 : endH) * 60 + (isNaN(endM) ? 0 : endM);
    const nowMinutes = (isNaN(nowH) ? 0 : nowH) * 60 + (isNaN(nowM) ? 0 : nowM);

    if (nowMinutes > endMinutes) {
      const diff = nowMinutes - endMinutes;
      return {
        keterlambatanMenit: diff,
        keterangan: `Melewati batas checkout ${diff} menit`,
      };
    }

    return {
      keterlambatanMenit: 0,
      keterangan: 'Tepat Waktu',
    };
  }

  /**
   * Validates whether the current time in Asia/Jakarta falls within the allowed check-out window.
   * - In BEBAS mode: check-out is allowed anytime on that day.
   * - In TERJADWAL mode: before checkOutStart is rejected. After checkOutStart (even past checkOutEnd)
   *   is accepted on the same day, calculating late checkout duration.
   */
  public static validateCheckOutWindow(
    day: DayOfWeek,
    settings: SchoolSettings,
    isAdmin = false,
    dateInput?: Date
  ): WindowCheckResult {
    const mode = settings?.attendanceMode === 'BEBAS' ? 'BEBAS' : 'TERJADWAL';
    const shift = getShiftHoursForDay(day, settings);
    const currentTime = getCurrentTimeHHMM(dateInput);

    // MODE BEBAS
    if (mode === 'BEBAS') {
      return {
        allowed: true,
        mode: 'BEBAS',
        start: shift.checkOutStart,
        end: shift.checkOutEnd,
        currentTime,
        keterlambatanMenit: 0,
        keterangan: 'Presensi Pulang (Mode Bebas)',
      };
    }

    // MODE TERJADWAL
    if (isAdmin) {
      const lateNote = this.calculateCheckoutLateNote(shift.checkOutEnd, currentTime);
      return {
        allowed: true,
        mode: 'TERJADWAL',
        start: shift.checkOutStart,
        end: shift.checkOutEnd,
        currentTime,
        keterlambatanMenit: lateNote.keterlambatanMenit,
        keterangan: lateNote.keterangan,
      };
    }

    // Active operating day check for TERJADWAL mode
    if (!shift.isActive) {
      return {
        allowed: false,
        reason: `Hari ${day} bukan hari tugas piket aktif sesuai konfigurasi sekolah.`,
        mode: 'TERJADWAL',
        start: shift.checkOutStart,
        end: shift.checkOutEnd,
        currentTime,
      };
    }

    // Before check-out start is rejected
    if (currentTime < shift.checkOutStart) {
      return {
        allowed: false,
        reason: `Presensi pulang belum dibuka. Jendela presensi pulang hari ini: ${shift.checkOutStart} - ${shift.checkOutEnd} WIB (waktu saat ini ${currentTime} WIB).`,
        mode: 'TERJADWAL',
        start: shift.checkOutStart,
        end: shift.checkOutEnd,
        currentTime,
      };
    }

    // After checkOutStart: accepted on the same day (even if past checkOutEnd)
    const lateNote = this.calculateCheckoutLateNote(shift.checkOutEnd, currentTime);
    return {
      allowed: true,
      mode: 'TERJADWAL',
      start: shift.checkOutStart,
      end: shift.checkOutEnd,
      currentTime,
      keterlambatanMenit: lateNote.keterlambatanMenit,
      keterangan: lateNote.keterangan,
    };
  }

  /**
   * Validates whether the current time falls within the check-in window.
   * - In BEBAS mode: check-in is allowed anytime on that day.
   * - In TERJADWAL mode: strictly between checkInStart and checkInEnd.
   */
  public static validateCheckInWindow(
    day: DayOfWeek,
    settings: SchoolSettings,
    isAdmin = false,
    dateInput?: Date
  ): WindowCheckResult {
    const mode = settings?.attendanceMode === 'BEBAS' ? 'BEBAS' : 'TERJADWAL';
    const shift = getShiftHoursForDay(day, settings);
    const currentTime = getCurrentTimeHHMM(dateInput);

    if (mode === 'BEBAS') {
      return {
        allowed: true,
        mode: 'BEBAS',
        start: shift.checkInStart,
        end: shift.checkInEnd,
        currentTime,
        keterangan: 'Presensi Masuk (Mode Bebas)',
      };
    }

    if (isAdmin) {
      return {
        allowed: true,
        mode: 'TERJADWAL',
        start: shift.checkInStart,
        end: shift.checkInEnd,
        currentTime,
      };
    }

    if (!shift.isActive) {
      return {
        allowed: false,
        reason: `Hari ${day} bukan hari dinas aktif sesuai jadwal sekolah.`,
        mode: 'TERJADWAL',
        start: shift.checkInStart,
        end: shift.checkInEnd,
        currentTime,
      };
    }

    if (currentTime < shift.checkInStart) {
      return {
        allowed: false,
        reason: `Presensi masuk belum dibuka. Jendela presensi masuk: ${shift.checkInStart} - ${shift.checkInEnd} WIB (waktu saat ini ${currentTime} WIB).`,
        mode: 'TERJADWAL',
        start: shift.checkInStart,
        end: shift.checkInEnd,
        currentTime,
      };
    }

    if (currentTime > shift.checkInEnd) {
      return {
        allowed: false,
        reason: `Jendela presensi masuk telah ditutup pada pukul ${shift.checkInEnd} WIB (waktu saat ini ${currentTime} WIB).`,
        mode: 'TERJADWAL',
        start: shift.checkInStart,
        end: shift.checkInEnd,
        currentTime,
      };
    }

    return {
      allowed: true,
      mode: 'TERJADWAL',
      start: shift.checkInStart,
      end: shift.checkInEnd,
      currentTime,
    };
  }

  /**
   * Converts any raw exception or error into a clear, scannable Indonesian status message with stage-level precision.
   */
  public static formatErrorMessage(err: any, fallbackStage?: AttendanceOperationStage): string {
    const code = err?.code;
    const msg: string = err?.message || String(err || '');
    const stage: AttendanceOperationStage | undefined = err?.stage || fallbackStage;

    if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      if (stage === 'read-profile') {
        return 'Izin membaca profil ditolak Firebase (permission-denied pada tahap read-profile). Pastikan akun Anda aktif dan terdaftar.';
      }
      if (stage === 'read-settings') {
        return 'Izin membaca konfigurasi ditolak Firebase (permission-denied pada tahap read-settings). Pastikan sesi akun valid dan terautentikasi.';
      }
      if (stage === 'read-record') {
        return 'Izin membaca data presensi ditolak Firebase (permission-denied pada tahap read-record). Pastikan akun Anda memiliki izin akses riwayat presensi.';
      }
      if (stage === 'read-schedule') {
        return 'Izin membaca jadwal piket ditolak Firebase (permission-denied pada tahap read-schedule).';
      }
      if (stage === 'write-check-in') {
        return 'Izin presensi masuk ditolak Firebase (permission-denied pada tahap write-check-in). Pastikan akun aktif, memiliki izin presensi (attendance.create), dan swafoto serta koordinat valid.';
      }
      if (stage === 'write-check-out') {
        return 'Izin presensi pulang ditolak Firebase (permission-denied pada tahap write-check-out). Mohon hubungi Administrator untuk mencocokkan Security Rules aktif untuk field jamPulang, updatedAt, dan checkoutPolicy.';
      }
      return 'Izin ditolak Firebase (permission-denied). Periksa wewenang akun, status sesi aktif, atau aturan keamanan Firestore.';
    }

    if (code === 'unavailable' || msg.includes('unavailable') || msg.includes('network')) {
      return 'Koneksi ke server Firebase terganggu atau offline. Periksa koneksi internet Anda dan coba kembali.';
    }
    if (msg.includes('Akses ditolak') || msg.includes('Hak akses')) {
      return msg;
    }
    if (msg.includes('sudah tercatat sebelumnya') || msg.includes('Checkout kedua ditolak')) {
      return msg;
    }
    if (msg.includes('tidak ditemukan')) {
      return msg;
    }
    if (msg.includes('Sesi Anda telah dicabut') || msg.includes('Akun Anda dinonaktifkan') || msg.includes('belum diaktivasi')) {
      return msg;
    }
    return msg || 'Gagal memproses presensi. Periksa koneksi dan coba beberapa saat lagi.';
  }
}
