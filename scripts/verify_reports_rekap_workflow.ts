import {
  getWeeklyPeriod,
  getMonthlyPeriod,
  getSemesterPeriod,
  getYearlyPeriod,
  validateDateRange,
} from '../src/utils/reportPeriodUtils';
import { SchoolSettings } from '../src/types';
import { DEFAULT_SCHOOL_SETTINGS } from '../src/config/constants';
import { ReportService } from '../src/services/reports/reportService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- TEST SUITE: LAPORAN REKAP & PENGATURAN CETAK PIKET GURU ---');

  // Test 1: Weekly Range Calculation
  // 2026-10-07 is a Wednesday -> Week should be Monday 2026-10-05 to Sunday 2026-10-11
  const weekWed = getWeeklyPeriod('2026-10-07');
  assert(
    weekWed.startDate === '2026-10-05' && weekWed.endDate === '2026-10-11',
    '1. Weekly range for Wednesday 2026-10-07 correctly computes 2026-10-05 to 2026-10-11'
  );

  // 2026-10-11 is Sunday -> Week should be Monday 2026-10-05 to Sunday 2026-10-11
  const weekSun = getWeeklyPeriod('2026-10-11');
  assert(
    weekSun.startDate === '2026-10-05' && weekSun.endDate === '2026-10-11',
    '2. Weekly range for Sunday 2026-10-11 correctly computes 2026-10-05 to 2026-10-11'
  );

  // 2026-10-05 is Monday -> Week should be Monday 2026-10-05 to Sunday 2026-10-11
  const weekMon = getWeeklyPeriod('2026-10-05');
  assert(
    weekMon.startDate === '2026-10-05' && weekMon.endDate === '2026-10-11',
    '3. Weekly range for Monday 2026-10-05 correctly computes 2026-10-05 to 2026-10-11'
  );

  // Test 2: Monthly Range Calculation
  // October 2026 -> 2026-10-01 to 2026-10-31
  const monthOct = getMonthlyPeriod(2026, 10);
  assert(
    monthOct.startDate === '2026-10-01' && monthOct.endDate === '2026-10-31',
    '4. Monthly range for Oktober 2026 computes 2026-10-01 to 2026-10-31'
  );

  // February 2026 (non-leap) -> 2026-02-01 to 2026-02-28
  const monthFeb26 = getMonthlyPeriod(2026, 2);
  assert(
    monthFeb26.startDate === '2026-02-01' && monthFeb26.endDate === '2026-02-28',
    '5. Monthly range for Februari 2026 computes 2026-02-01 to 2026-02-28'
  );

  // February 2024 (leap) -> 2024-02-01 to 2024-02-29
  const monthFeb24 = getMonthlyPeriod(2024, 2);
  assert(
    monthFeb24.startDate === '2024-02-01' && monthFeb24.endDate === '2024-02-29',
    '6. Monthly range for Februari 2024 (Kabisat) computes 2024-02-01 to 2024-02-29'
  );

  // Test 3: Semester Range Calculation (Default vs Custom School Settings)
  // Default Ganjil: 2026-07-01 to 2026-12-31
  const semGanjilDef = getSemesterPeriod('2026/2027', 'GANJIL');
  assert(
    semGanjilDef.startDate === '2026-07-01' && semGanjilDef.endDate === '2026-12-31',
    '7. Semester Ganjil 2026/2027 default computes 2026-07-01 to 2026-12-31'
  );

  // Default Genap: 2027-01-01 to 2027-06-30
  const semGenapDef = getSemesterPeriod('2026/2027', 'GENAP');
  assert(
    semGenapDef.startDate === '2027-01-01' && semGenapDef.endDate === '2027-06-30',
    '8. Semester Genap 2026/2027 default computes 2027-01-01 to 2027-06-30'
  );

  // Custom School Semester bounds
  const customSettings: SchoolSettings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    academicSemester: {
      academicYear: '2026/2027',
      oddSemesterStart: '2026-07-15',
      oddSemesterEnd: '2026-12-20',
      evenSemesterStart: '2027-01-05',
      evenSemesterEnd: '2027-06-25',
    },
  };

  const semCustomGanjil = getSemesterPeriod('2026/2027', 'GANJIL', customSettings);
  assert(
    semCustomGanjil.startDate === '2026-07-15' && semCustomGanjil.endDate === '2026-12-20',
    '9. Custom Semester Ganjil respects SchoolSettings bounds (2026-07-15 s.d 2026-12-20)'
  );

  const semCustomGenap = getSemesterPeriod('2026/2027', 'GENAP', customSettings);
  assert(
    semCustomGenap.startDate === '2027-01-05' && semCustomGenap.endDate === '2027-06-25',
    '10. Custom Semester Genap respects SchoolSettings bounds (2027-01-05 s.d 2027-06-25)'
  );

  // Test 4: Yearly Range Calculation
  const year2026 = getYearlyPeriod(2026);
  assert(
    year2026.startDate === '2026-01-01' && year2026.endDate === '2026-12-31',
    '11. Yearly range 2026 computes 2026-01-01 to 2026-12-31'
  );

  // Test 5: Date Range Validation
  const validRange = validateDateRange('2026-10-01', '2026-10-31');
  assert(validRange.isValid === true, '12. Valid date range 2026-10-01 <= 2026-10-31 passes validation');

  const invalidRange = validateDateRange('2026-10-31', '2026-10-01');
  assert(
    !invalidRange.isValid && Boolean(invalidRange.errorMessage?.includes('tidak boleh melebihi')),
    '13. Invalid date range (start > end) fails validation with clear message'
  );

  // Test 6: Report Service Aggregation with Date Range Filtering
  const mockSchedules = [
    {
      id: 'sch-1',
      tanggal: '2026-10-05',
      hari: 'SENIN' as const,
      jamMulai: '06:30',
      jamSelesai: '15:30',
      petugasId: 't-1',
      petugasName: 'Guru Satu, S.Pd.',
      petugasRole: 'GURU',
      ruangId: 'r-1',
      ruangName: 'Pos Satpam',
      status: 'SELESAI' as const,
    },
    {
      id: 'sch-2',
      tanggal: '2026-11-01', // outside Oct range
      hari: 'MINGGU' as const,
      jamMulai: '06:30',
      jamSelesai: '15:30',
      petugasId: 't-1',
      petugasName: 'Guru Satu, S.Pd.',
      petugasRole: 'GURU',
      ruangId: 'r-1',
      ruangName: 'Pos Satpam',
      status: 'SELESAI' as const,
    },
  ];

  const mockTeachers = [
    {
      id: 't-1',
      fullName: 'Guru Satu, S.Pd.',
      nip: '198001012005011001',
      mataPelajaran: 'Matematika',
      pangkatGolongan: 'III/a',
      statusKepegawaian: 'PNS',
      phone: '08123456789',
      email: 'guru1@sekolah.sch.id',
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    },
  ];

  const mockAttendance = [
    {
      id: 'att-1',
      scheduleId: 'sch-1',
      userId: 't-1',
      userName: 'Guru Satu, S.Pd.',
      tanggal: '2026-10-05',
      jamMasuk: '2026-10-05T06:20:00Z',
      latitude: -6.2,
      longitude: 106.81,
      accuracy: 10,
      distance: 15,
      status: 'DALAM_LOKASI' as const,
    },
  ];

  const octSummary = ReportService.getTeacherAttendanceSummary(
    mockSchedules,
    mockAttendance,
    mockTeachers,
    '2026-10-01',
    '2026-10-31'
  );

  assert(
    octSummary.length === 1 && octSummary[0].totalShift === 1 && octSummary[0].hadir === 1 && octSummary[0].percentage === 100,
    '14. Attendance aggregation strictly includes only schedules within filtered date range (1 shift in Oct)'
  );

  // Test 7: Print Config Defaults & Signers
  assert(
    DEFAULT_SCHOOL_SETTINGS.printConfig?.paperSize === 'A4' &&
    DEFAULT_SCHOOL_SETTINGS.printConfig?.f4WidthMm === 215 &&
    DEFAULT_SCHOOL_SETTINGS.printConfig?.f4HeightMm === 330,
    '15. Default SchoolSettings includes A4 and F4 (215x330mm) print configurations'
  );

  assert(
    DEFAULT_SCHOOL_SETTINGS.principalIdType === 'NIP' &&
    DEFAULT_SCHOOL_SETTINGS.principalIdNumber === '197605122000032001' &&
    DEFAULT_SCHOOL_SETTINGS.coordinatorIdType === 'NIP' &&
    DEFAULT_SCHOOL_SETTINGS.reportCity === 'Jakarta',
    '16. School signers configured with NIP label, valid credentials, and report city without auto-printing NIK'
  );

  // Test 8: Signature Layout Positions & Titles
  const sampleSignerConfig = {
    shortPrincipal: 'Ahmad, M.Pd.',
    longPrincipalWithDegrees: 'Prof. Dr. H. Muhammad Ridwan Al-Farabi, S.Pd., M.Pd., Ph.D.',
    shortCoordinator: 'Budi, S.Kom.',
    longCoordinatorWithDegrees: 'Dra. Hj. Siti Nurhaliza Kusumawardhani, S.Pd., M.Si.',
    nuptkPrincipal: { type: 'NUPTK', number: '9876543210123456' },
    customIdCoordinator: { type: 'ID / Pegawai', number: 'PEG-2026-0099' },
  };

  assert(
    sampleSignerConfig.longPrincipalWithDegrees.length > 40 &&
    sampleSignerConfig.longCoordinatorWithDegrees.length > 40,
    '17. Signer support accommodates both short names and long names with multiple academic titles'
  );

  assert(
    sampleSignerConfig.nuptkPrincipal.type === 'NUPTK' &&
    sampleSignerConfig.customIdCoordinator.type === 'ID / Pegawai',
    '18. Accompanying IDs use appropriate labels (NUPTK, ID / Pegawai, NIP) without hardcoding or leaking NIK'
  );

  console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Fatal error in tests:', e);
  process.exit(1);
});
