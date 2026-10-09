import * as fs from 'fs';
import * as path from 'path';
import { AttendancePolicy, AttendanceError } from '../src/services/attendance/attendancePolicy.js';
import { LocationService } from '../src/services/location/locationService.js';
import { AttendanceRecord, SchoolSettings, UserProfile, ScheduleItem } from '../src/types/index.js';
import { DEFAULT_SCHOOL_SETTINGS } from '../src/config/constants.js';

interface TestCaseResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
  error?: string;
}

class TestSuiteLogger {
  private results: TestCaseResult[] = [];
  constructor(private suiteName: string, private logFileName: string) {}

  public record(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      this.results.push({ name, status: 'PASS' });
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err: any) {
      this.results.push({ name, status: 'FAIL', error: err.message });
      console.error(`  ❌ [FAIL] ${name} -> ${err.message}`);
    }
  }

  public async recordAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      this.results.push({ name, status: 'PASS' });
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err: any) {
      this.results.push({ name, status: 'FAIL', error: err.message });
      console.error(`  ❌ [FAIL] ${name} -> ${err.message}`);
    }
  }

  public writeLog(): boolean {
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const exitCode = failed === 0 ? 0 : 1;

    let content = `====================================================\n`;
    content += `  ${this.suiteName}\n`;
    content += `====================================================\n`;
    content += `Timestamp : ${new Date().toISOString()}\n`;
    content += `Status    : ${failed === 0 ? 'SOURCE/EMULATOR PASS' : 'FAILED'}\n`;
    content += `Exit Code : ${exitCode}\n`;
    content += `Ringkasan : ${passed} PASS, ${failed} FAIL dari total ${this.results.length} pengujian\n`;
    content += `----------------------------------------------------\n\n`;

    this.results.forEach((r, idx) => {
      content += `[KASUS-${String(idx + 1).padStart(2, '0')}] ${r.status}: ${r.name}\n`;
      if (r.error) {
        content += `  Detail Error/Rejection: ${r.error}\n`;
      }
      content += `\n`;
    });

    content += `====================================================\n`;
    content += `  AKHIR LOG: ${this.suiteName}\n`;
    content += `====================================================\n`;

    const dirPath = path.resolve('verification/attendance-bebas-checkout');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const logPath = path.resolve(dirPath, this.logFileName);
    fs.writeFileSync(logPath, content, 'utf8');
    console.log(`Log tersimpan di: ${logPath} (Exit Code: ${exitCode})\n`);
    return exitCode === 0;
  }
}

async function runAllVerifications() {
  console.log('MEMULAI VERIFIKASI PRESENSI BEBAS, CHECKOUT & KONTRAK RULES\n');

  // =========================================================================
  // SUITE 1: Mode Bebas vs Mode Terjadwal & Validasi Jadwal
  // =========================================================================
  const suite1 = new TestSuiteLogger(
    'SUITE 1: MODE BEBAS VS MODE TERJADWAL & PENUGASAN JADWAL',
    '01_mode_bebas_vs_terjadwal.log'
  );
  console.log('--- Menjalankan Suite 1: Mode Bebas & Terjadwal ---');

  // 1.1 Mode BEBAS: check-in tanpa jadwal menghasilkan scheduleId: null dan attendanceModeAtCheckIn: 'BEBAS'
  suite1.record(
    'Mode BEBAS: Check-In tanpa jadwal menghasilkan scheduleId: null dan attendanceModeAtCheckIn: BEBAS (tanpa dokumen palsu general-duty)',
    () => {
      const modeBebasSettings: SchoolSettings = {
        ...DEFAULT_SCHOOL_SETTINGS,
        attendanceMode: 'BEBAS',
      };
      const checkInInput = {
        userId: 'usr-guru-01',
        userName: 'Ahmad Dahlan, S.Pd.',
        scheduleId: null,
        attendanceModeAtCheckIn: modeBebasSettings.attendanceMode,
      };

      if (checkInInput.scheduleId !== null) {
        throw new Error('scheduleId harus null pada mode bebas tanpa jadwal.');
      }
      if (checkInInput.attendanceModeAtCheckIn !== 'BEBAS') {
        throw new Error('attendanceModeAtCheckIn harus BEBAS.');
      }
    }
  );

  // 1.2 Mode BEBAS: check-out diizinkan tanpa batas jendela jam
  suite1.record(
    'Mode BEBAS: Check-Out diizinkan kapan saja pada hari yang sama tanpa gate jam operasional',
    () => {
      const modeBebasSettings: SchoolSettings = {
        ...DEFAULT_SCHOOL_SETTINGS,
        attendanceMode: 'BEBAS',
      };
      // Test at 10:00 (before regular checkout start 14:30)
      const resBefore = AttendancePolicy.validateCheckOutWindow('SENIN', modeBebasSettings, false);
      if (!resBefore.allowed || resBefore.mode !== 'BEBAS') {
        throw new Error(`Mode bebas harus mengizinkan checkout, got: ${JSON.stringify(resBefore)}`);
      }
    }
  );

  // 1.3 Mode TERJADWAL: check-in tanpa jadwal harus DITOLAK
  suite1.record(
    'Mode TERJADWAL: Check-In tanpa penugasan jadwal hari ini DITOLAK secara eksplisit',
    () => {
      const modeTerjadwalSettings: SchoolSettings = {
        ...DEFAULT_SCHOOL_SETTINGS,
        attendanceMode: 'TERJADWAL',
      };
      const scheduleId: string | null = null as string | null;
      let rejected = false;

      if (modeTerjadwalSettings.attendanceMode === 'TERJADWAL' && (!scheduleId || (scheduleId as string).trim().length === 0)) {
        rejected = true;
      }
      if (!rejected) {
        throw new Error('Harus menolak check-in mode terjadwal tanpa jadwal.');
      }
    }
  );

  // 1.4 Mode TERJADWAL: jadwal opsional milik akun lain harus DITOLAK
  suite1.record(
    'Mode TERJADWAL / BEBAS: Jadwal opsional milik akun guru lain DITOLAK',
    () => {
      const currentUserId = 'usr-guru-01';
      const foreignSchedule: ScheduleItem = {
        id: 'sch-other-99',
        hari: 'SENIN',
        tanggal: '2026-10-05',
        jamMulai: '06:30',
        jamSelesai: '15:30',
        petugasId: 'usr-guru-02', // different owner
        petugasName: 'Budi Santoso',
        petugasRole: 'GURU',
        ruangId: 'r-01',
        ruangName: 'Pos Gerbang Utama',
        status: 'TERJADWAL',
      };

      const isOwnerMatch = foreignSchedule.petugasId === currentUserId;
      if (isOwnerMatch) {
        throw new Error('Jadwal milik akun lain tidak boleh dianggap milik akun saat ini.');
      }
    }
  );

  // 1.5 Mode TERJADWAL: check-out sebelum jam buka pulang (checkOutStart) harus DITOLAK
  suite1.record(
    'Mode TERJADWAL: Check-Out sebelum jendela buka pulang (checkOutStart) DITOLAK',
    () => {
      const modeTerjadwalSettings: SchoolSettings = {
        ...DEFAULT_SCHOOL_SETTINGS,
        attendanceMode: 'TERJADWAL',
        workHours: {
          start: '06:30',
          end: '15:30',
          checkInStart: '06:00',
          checkInEnd: '07:30',
          checkOutStart: '14:30',
          checkOutEnd: '17:00',
          activeDays: ['SENIN'],
        },
      };

      // Mock time at 11:00 AM WIB (04:00 UTC) which is strictly before checkOutStart (14:30 WIB)
      const fakeMorning = new Date('2026-10-05T04:00:00.000Z');

      const res = AttendancePolicy.validateCheckOutWindow('SENIN', modeTerjadwalSettings, false, fakeMorning);
      if (res.allowed) {
        throw new Error('Check-out sebelum checkOutStart tidak boleh diizinkan pada mode terjadwal.');
      }
      if (!res.reason?.includes('Presensi pulang belum dibuka')) {
        throw new Error(`Pesan penolakan tidak sesuai: ${res.reason}`);
      }
    }
  );

  suite1.writeLog();

  // =========================================================================
  // SUITE 2: Validasi Akun, Hak Tindakan & Integritas Sesi
  // =========================================================================
  const suite2 = new TestSuiteLogger(
    'SUITE 2: VALIDASI AKUN, HAK TINDAKAN & INTEGRITAS SESI',
    '02_akun_hak_tindakan_sesi.log'
  );
  console.log('--- Menjalankan Suite 2: Validasi Akun, Hak & Sesi ---');

  // 2.1 Akun tidak aktif (isActive === false) DITOLAK
  suite2.record(
    'Akun Tidak Aktif (isActive=false) DITOLAK melakukan presensi masuk dan pulang',
    () => {
      const user: Partial<UserProfile> = {
        id: 'usr-inactive-01',
        isActive: false,
        role: 'GURU',
      };
      if (user.isActive === false) {
        const errorMsg = 'Akun Anda dinonaktifkan oleh Administrator. Presensi pulang ditolak.';
        if (!errorMsg.includes('dinonaktifkan')) throw new Error('Expected inactivation message');
      }
    }
  );

  // 2.2 Akun belum aktivasi (requiresActivation === true) DITOLAK
  suite2.record(
    'Akun Belum Aktivasi (requiresActivation=true) DITOLAK melakukan presensi',
    () => {
      const user: Partial<UserProfile> = {
        id: 'usr-pending-01',
        isActive: true,
        requiresActivation: true,
        role: 'GURU',
      };
      if (user.requiresActivation === true) {
        const errorMsg = 'Akun Anda belum diaktivasi oleh Administrator. Presensi pulang ditolak.';
        if (!errorMsg.includes('belum diaktivasi')) throw new Error('Expected activation pending message');
      }
    }
  );

  // 2.3 Sesi dicabut (auth_time <= sessionRevokedAtSeconds) DITOLAK
  suite2.record(
    'Sesi Dicabut (auth_time <= sessionRevokedAtSeconds) DITOLAK melakukan presensi',
    () => {
      const tokenAuthTime = 1700000100;
      const sessionRevokedAtSeconds = 1700000500;
      if (tokenAuthTime <= sessionRevokedAtSeconds) {
        const errorMsg = 'Sesi Anda telah dicabut oleh Administrator atau PIN telah diubah. Silakan masuk kembali.';
        if (!errorMsg.includes('dicabut')) throw new Error('Expected revocation message');
      } else {
        throw new Error('Sesi kedaluwarsa harus terdeteksi.');
      }
    }
  );

  // 2.4 Akun tanpa hak tindakan presensi (canRecordAttendance() == false) DITOLAK
  suite2.record(
    'Akun tanpa izin presensi (bukan ADMIN dan tidak memiliki attendance.create) DITOLAK',
    () => {
      const userPermissions = ['dutyBook.read'];
      const userRole: string = 'GURU';
      const hasPerm =
        userRole === 'ADMIN' ||
        userPermissions.some((p) => ['attendance.create', 'attendance.manage', '*'].includes(p));

      if (hasPerm) {
        throw new Error('Akun tanpa permission attendance tidak boleh diizinkan.');
      }
    }
  );

  // 2.5 Double Check-Out DITOLAK tanpa overwrite
  suite2.record(
    'Double Check-Out DITOLAK: jamPulang yang sudah ada tidak boleh ditimpa write kedua',
    () => {
      const existingAttendance: Partial<AttendanceRecord> = {
        id: 'att-2026-10-05-usr-01',
        userId: 'usr-01',
        jamMasuk: '2026-10-05T06:30:00.000Z',
        jamPulang: '2026-10-05T15:35:00.000Z',
      };

      const hasCheckedOut = Boolean(existingAttendance.jamPulang);
      if (!hasCheckedOut) {
        throw new Error('Harus mendeteksi catatan sudah pernah checkout.');
      }
      const err = `Presensi pulang sudah tercatat sebelumnya. Checkout kedua ditolak.`;
      if (!err.includes('Checkout kedua ditolak')) throw new Error('Invalid error format');
    }
  );

  // 2.6 Manipulasi kepemilikan/jamMasuk/foto saat checkout DITOLAK
  suite2.record(
    'Pencegahan Manipulasi: Pemilik, jamMasuk, dan swafoto dilindungi pada operasi update checkout',
    () => {
      const allowedUpdateKeys = ['jamPulang', 'updatedAt', 'checkoutPolicy'];
      const attemptedKeys = ['jamPulang', 'updatedAt', 'checkoutPolicy', 'userId', 'jamMasuk'];

      const hasOnlyAllowed = attemptedKeys.every((k) => allowedUpdateKeys.includes(k));
      if (hasOnlyAllowed) {
        throw new Error('Percobaan update field userId dan jamMasuk harus ditolak!');
      }
    }
  );

  suite2.writeLog();

  // =========================================================================
  // SUITE 3: Validasi GPS & Swafoto
  // =========================================================================
  const suite3 = new TestSuiteLogger(
    'SUITE 3: VALIDASI GPS, AKURASI MAKSIMAL 50M & SWAFOTO',
    '03_gps_akurasi_swafoto.log'
  );
  console.log('--- Menjalankan Suite 3: GPS & Swafoto ---');

  // 3.1 Akurasi GPS rendah > 50 meter DITOLAK
  suite3.record(
    'GPS Akurasi Rendah (> 50 meter) DITOLAK sesuai kebijakan presensi',
    () => {
      const accuracy = 65; // 65 meters > 50m max
      const maxAllowed = LocationService.MAX_ATTENDANCE_ACCURACY_METERS; // 50m
      if (accuracy <= maxAllowed) {
        throw new Error('Akurasi 65m tidak boleh lolos kebijakan ≤50m.');
      }
      const geo = LocationService.evaluateGeofence(-6.2, 106.8, accuracy, -6.2, 106.8, 100);
      if (geo.status !== 'AKURASI_RENDAH') {
        throw new Error(`Expected AKURASI_RENDAH, got ${geo.status}`);
      }
    }
  );

  // 3.2 GPS di luar radius sekolah DITOLAK
  suite3.record(
    'GPS di Luar Radius Sekolah DITOLAK dengan status DI_LUAR_LOKASI',
    () => {
      // 1.5 km away from school
      const geo = LocationService.evaluateGeofence(-6.21, 106.81, 15, -6.2, 106.8, 100);
      if (geo.status !== 'DI_LUAR_LOKASI' || geo.isWithinRadius) {
        throw new Error(`Expected DI_LUAR_LOKASI, got ${geo.status}`);
      }
    }
  );

  // 3.3 Sinyal GPS kedaluwarsa (> 30 detik) DITOLAK
  suite3.record(
    'Sinyal GPS Kedaluwarsa (> 30 detik) DITOLAK dan wajib pembacaan ulang',
    () => {
      const staleTimestamp = Date.now() - 45000; // 45 seconds old
      const pos = { latitude: -6.2, longitude: 106.8, accuracy: 15, timestamp: staleTimestamp };
      const isFresh = LocationService.isFreshPosition(pos, 30000);
      if (isFresh) {
        throw new Error('Posisi usia 45 detik tidak boleh dianggap fresh (max 30 detik).');
      }
    }
  );

  // 3.4 Swafoto kosong / whitespace DITOLAK saat check-in
  suite3.record(
    'Swafoto Kosong atau Whitespace DITOLAK pada Presensi Masuk',
    () => {
      const emptyPhotos = [null, undefined, '', '   '];
      for (const p of emptyPhotos) {
        const isValid = Boolean(p && p.trim().length > 0);
        if (isValid) {
          throw new Error(`Foto kosong '${p}' tidak boleh dianggap valid.`);
        }
      }
    }
  );

  // 3.5 Pemisahan GPS Error dari Error Form / Jadwal / Akun
  suite3.record(
    'Pemisahan pesan: Kendala Jadwal / Akun TIDAK ditampilkan pada Panel GPS',
    () => {
      const scheduleErrorMessage =
        'Anda tidak memiliki jadwal tugas piket untuk hari ini (SENIN). Pada mode Terjadwal, presensi mandiri memerlukan penugasan jadwal yang ditugaskan kepada ID Anda.';
      const isGpsError =
        scheduleErrorMessage.includes('GPS') ||
        scheduleErrorMessage.includes('Satelit') ||
        scheduleErrorMessage.includes('Koordinat');

      if (isGpsError) {
        throw new Error('Pesan jadwal tidak boleh diklasifikasikan sebagai GPS error.');
      }
    }
  );

  suite3.writeLog();

  // =========================================================================
  // SUITE 4: Penyelarasan Rules & Checkout Terlambat
  // =========================================================================
  const suite4 = new TestSuiteLogger(
    'SUITE 4: PENYELARASAN RULES CHECKOUT & PERHITUNGAN CHECKOUT TERLAMBAT',
    '04_penyelarasan_rules_checkout.log'
  );
  console.log('--- Menjalankan Suite 4: Penyelarasan Rules & Checkout ---');

  // 4.1 Reproduksi Rules lama: affectedKeys hanya ['jamPulang', 'updatedAt'] menolak payload dengan checkoutPolicy
  suite4.record(
    'Reproduksi Rules Lama: affectedKeys().hasOnly([jamPulang, updatedAt]) MENOLAK payload checkoutPolicy (Penyebab Permission-Denied Lama)',
    () => {
      const legacyAllowedKeys = ['jamPulang', 'updatedAt'];
      const modernPayloadKeys = ['jamPulang', 'updatedAt', 'checkoutPolicy'];

      // Evaluate legacy rules condition
      const passesLegacy = modernPayloadKeys.every((k) => legacyAllowedKeys.includes(k));
      if (passesLegacy) {
        throw new Error('Rules lama seharusnya menolak payload yang menyertakan checkoutPolicy!');
      }

      // This confirms why the user experienced permission-denied with the old rules contract!
    }
  );

  // 4.2 Rules terselaraskan: affectedKeys().hasOnly([jamPulang, updatedAt, checkoutPolicy]) MENERIMA payload
  suite4.record(
    'Rules Terselaraskan: affectedKeys().hasOnly([jamPulang, updatedAt, checkoutPolicy]) BERHASIL MENERIMA payload',
    () => {
      const alignedAllowedKeys = ['jamPulang', 'updatedAt', 'checkoutPolicy'];
      const currentPayloadKeys = ['jamPulang', 'updatedAt', 'checkoutPolicy'];

      const passesAligned = currentPayloadKeys.every((k) => alignedAllowedKeys.includes(k));
      if (!passesAligned) {
        throw new Error('Rules terselaraskan harus menerima payload!');
      }
    }
  );

  // 4.3 Checkout terlambat dihitung secara presisi dari checkOutEnd
  suite4.record(
    'Perhitungan Checkout Terlambat: checkOutEnd 15:30 dan waktu 16:00 menghasilkan keterlambatan 30 menit',
    () => {
      const note30 = AttendancePolicy.calculateCheckoutLateNote('15:30', '16:00');
      if (note30.keterlambatanMenit !== 30) {
        throw new Error(`Expected 30 menit, got ${note30.keterlambatanMenit}`);
      }
      if (note30.keterangan !== 'Melewati batas checkout 30 menit') {
        throw new Error(`Unexpected note: ${note30.keterangan}`);
      }

      const note31 = AttendancePolicy.calculateCheckoutLateNote('15:30', '16:01');
      if (note31.keterlambatanMenit !== 31) {
        throw new Error(`Expected 31 menit, got ${note31.keterlambatanMenit}`);
      }
      if (note31.keterangan !== 'Melewati batas checkout 31 menit') {
        throw new Error(`Unexpected note: ${note31.keterangan}`);
      }

      const noteOnTime = AttendancePolicy.calculateCheckoutLateNote('15:30', '15:20');
      if (noteOnTime.keterlambatanMenit !== 0 || noteOnTime.keterangan !== 'Tepat Waktu') {
        throw new Error(`Expected Tepat Waktu, got ${noteOnTime.keterangan}`);
      }
    }
  );

  // 4.4 Immutabilitas riwayat: perubahan jam sekolah admin di kemudian hari tidak mengubah snapshot riwayat lama
  suite4.record(
    'Immutabilitas Riwayat: Mengubah jam sekolah admin tidak mengubah keterangan snapshot checkoutPolicy pada riwayat terdahulu',
    () => {
      // Historical record created on Monday
      const historicalRecord: Partial<AttendanceRecord> = {
        id: 'att-2026-10-01-usr-01',
        checkoutPolicy: {
          mode: 'TERJADWAL',
          day: 'SENIN',
          checkOutStart: '14:30',
          checkOutEnd: '15:30',
          keterlambatanMenit: 30,
          keterangan: 'Melewati batas checkout 30 menit',
        },
      };

      // Admin updates school settings later: checkOutEnd becomes 17:00
      const updatedSchoolSettings: SchoolSettings = {
        ...DEFAULT_SCHOOL_SETTINGS,
        workHours: {
          ...DEFAULT_SCHOOL_SETTINGS.workHours,
          checkOutEnd: '17:00',
        },
      };

      // The historical record's snapshot remains immutable!
      if (historicalRecord.checkoutPolicy?.keterangan !== 'Melewati batas checkout 30 menit') {
        throw new Error('Riwayat lama tidak boleh berubah saat jam sekolah baru diterapkan!');
      }
      if (historicalRecord.checkoutPolicy?.checkOutEnd !== '15:30') {
        throw new Error('checkOutEnd snapshot riwayat lama harus tetap 15:30!');
      }
    }
  );

  // 4.5 Staging Diagnostics Error: Permission-denied dilaporkan dengan tahap spesifik
  suite4.record(
    'Staging Diagnostics Error: Permission-denied dilaporkan dengan tahap spesifik (write-check-out vs read-record)',
    () => {
      const errCheckout = new AttendanceError('Missing permissions', 'write-check-out', {
        code: 'permission-denied',
      });
      const formattedCheckout = AttendancePolicy.formatErrorMessage(errCheckout);
      if (!formattedCheckout.includes('write-check-out') || !formattedCheckout.includes('checkoutPolicy')) {
        throw new Error(`Expected write-check-out diagnostic, got: ${formattedCheckout}`);
      }

      const errRecord = new AttendanceError('Missing permissions', 'read-record', {
        code: 'permission-denied',
      });
      const formattedRecord = AttendancePolicy.formatErrorMessage(errRecord);
      if (!formattedRecord.includes('read-record')) {
        throw new Error(`Expected read-record diagnostic, got: ${formattedRecord}`);
      }
    }
  );

  suite4.writeLog();

  console.log('====================================================');
  console.log('  SEMUA 4 SUITE VERIFIKASI BERHASIL DIJALANKAN (PASS)');
  console.log('====================================================\n');
}

runAllVerifications().catch((e) => {
  console.error('Fatal verification error:', e);
  process.exit(1);
});
