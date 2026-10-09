/**
 * Test Suite: Akses Dashboard Piket Guru
 * Validates permission synchronization, role presets, account ID binding,
 * ownership isolation, locking enforcement, and admin permission updates.
 */

import {
  PERMISSIONS,
  GURU_PIKET_CORE_PERMISSIONS,
  ROLE_PERMISSIONS,
  APP_PERMISSION_ITEMS,
  PERMISSION_FAMILY_MAP,
  isPermissionItemChecked,
  togglePermissionItem,
  checkUserPermission,
} from '../src/config/permissions';
import { DutyBookService } from '../src/services/firebase/dutyBookService';
import { UserProfile, ScheduleItem } from '../src/types';
import { DutyBookRecord } from '../src/types/dutyBook.types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING AKSED DASHBOARD PIKET GURU ACCEPTANCE TESTS ---\n');

  // Test 1: Single Source of Truth & Guru Never Has Wildcard '*'
  console.log('[Test Group 1: Permission Source & GURU Preset]');
  const guruPreset = ROLE_PERMISSIONS.GURU;
  assert(!guruPreset.includes('*'), 'GURU role preset must NOT contain wildcard *');
  assert(guruPreset.includes(PERMISSIONS.DASHBOARD_VIEW), 'GURU role has dashboard.view');
  assert(guruPreset.includes(PERMISSIONS.SCHEDULE_VIEW), 'GURU role has schedule.view');
  assert(guruPreset.includes(PERMISSIONS.ATTENDANCE_VIEW), 'GURU role has attendance.view');
  assert(guruPreset.includes(PERMISSIONS.ATTENDANCE_CREATE), 'GURU role has attendance.create');
  assert(guruPreset.includes(PERMISSIONS.DUTYBOOK_VIEW), 'GURU role has dutybook.view');
  assert(guruPreset.includes(PERMISSIONS.DUTYBOOK_CREATE), 'GURU role has dutybook.create');

  // Verify critical APP_PERMISSION_ITEMS labels and IDs
  const permIds = APP_PERMISSION_ITEMS.map((item) => item.id);
  assert(permIds.includes(PERMISSIONS.DASHBOARD_VIEW), 'APP_PERMISSION_ITEMS has Lihat Dashboard Piket');
  assert(permIds.includes(PERMISSIONS.SCHEDULE_VIEW), 'APP_PERMISSION_ITEMS has Lihat Jadwal Piket');
  assert(permIds.includes(PERMISSIONS.ATTENDANCE_CREATE), 'APP_PERMISSION_ITEMS has Presensi Piket Mandiri');
  assert(permIds.includes(PERMISSIONS.DUTYBOOK_CREATE), 'APP_PERMISSION_ITEMS has Isi/Edit Buku Piket Sendiri');

  // Test 2: Synthetic GURU Account Creation
  console.log('\n[Test Group 2: Synthetic Guru Account Permissions]');
  const syntheticGuru: UserProfile = {
    id: 'usr-guru-synt-001',
    loginId: 'GURU-001',
    fullName: 'Budi Santoso, S.Pd.',
    role: 'GURU',
    email: 'budi@sekolah.sch.id',
    phone: '081234567890',
    isActive: true,
    permissions: [...GURU_PIKET_CORE_PERMISSIONS],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.DASHBOARD_VIEW), 'Guru can view dashboard');
  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.SCHEDULE_VIEW), 'Guru can view schedule');
  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.ATTENDANCE_VIEW), 'Guru can view attendance');
  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.ATTENDANCE_CREATE), 'Guru can create attendance');
  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.DUTYBOOK_VIEW), 'Guru can view duty book');
  assert(checkUserPermission(syntheticGuru.permissions, PERMISSIONS.DUTYBOOK_CREATE), 'Guru can create duty book');

  // Also verify alias compatibility
  assert(checkUserPermission(syntheticGuru.permissions, 'schedules.view' as any), 'schedules.view alias matches schedule.view');
  assert(checkUserPermission(syntheticGuru.permissions, 'journal.view' as any), 'journal.view alias matches dutybook.view');
  assert(checkUserPermission(syntheticGuru.permissions, 'journal.create' as any), 'journal.create alias matches dutybook.create');

  // Test 3: Account ID/UID Binding vs Name Matching
  console.log('\n[Test Group 3: Schedule Assignment by Account ID/UID]');
  const scheduleGuruA: ScheduleItem = {
    id: 'sch-001',
    tanggal: '2026-10-04',
    hari: 'SENIN',
    ruangId: 'r-01',
    ruangName: 'Gerbang Depan',
    petugasId: 'usr-guru-synt-001',
    petugasName: 'Budi Santoso, S.Pd.',
    petugasRole: 'GURU',
    jamMulai: '06:30',
    jamSelesai: '15:30',
    status: 'TERJADWAL',
  };

  const scheduleGuruB: ScheduleItem = {
    id: 'sch-002',
    tanggal: '2026-10-04',
    hari: 'SENIN',
    ruangId: 'r-02',
    ruangName: 'Lobby Utama',
    petugasId: 'usr-guru-synt-002', // Different ID with same name
    petugasName: 'Budi Santoso, S.Pd.',
    petugasRole: 'GURU',
    jamMulai: '06:30',
    jamSelesai: '15:30',
    status: 'TERJADWAL',
  };

  const allSchedules = [scheduleGuruA, scheduleGuruB];
  const assignedToGuruA = allSchedules.filter((s) => s.petugasId === syntheticGuru.id);
  assert(assignedToGuruA.length === 1 && assignedToGuruA[0].id === 'sch-001', 'Schedule bound strictly to account ID, not name matching');

  // Test 4: Cross-User Editing & Creation Prevention
  console.log('\n[Test Group 4: Cross-Account Prevention & Workflow Enforcement]');
  const bookOfGuruB: DutyBookRecord = {
    id: 'book-guru-b-01',
    scheduleId: 'sch-002',
    tanggal: '2026-10-04',
    hari: 'SENIN',
    jamMulai: '06:30',
    jamSelesai: '15:30',
    petugasId: 'usr-guru-synt-002',
    petugasName: 'Siti Aminah, M.Pd.',
    petugasRole: 'GURU',
    ruangName: 'Lobby Utama',
    kondisiKeamanan: 'Aman',
    kondisiKebersihan: 'Bersih',
    kondisiKelas: 'Tertib',
    kondisiFasilitas: 'Normal',
    kondisiSiswa: 'Disiplin',
    catatanPiket: 'Lancar',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    createdBy: 'Siti Aminah, M.Pd.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Siti Aminah, M.Pd.',
  };

  // Guru A attempts to save duty book belonging to Guru B
  let crossSaveError: string | null = null;
  try {
    await DutyBookService.saveDutyBook(bookOfGuruB, syntheticGuru);
  } catch (err: any) {
    crossSaveError = err.message;
  }
  assert(
    crossSaveError !== null && crossSaveError.includes('Akses ditolak'),
    'Guru A cannot edit duty book owned by Guru B',
    crossSaveError || ''
  );

  // Guru A attempts to advance status to DIVERIFIKASI (must be rejected)
  let statusTamperError: string | null = null;
  const myBook: DutyBookRecord = {
    ...bookOfGuruB,
    id: 'book-my-01',
    petugasId: syntheticGuru.id,
    petugasName: syntheticGuru.fullName,
  };
  try {
    await DutyBookService.updateWorkflowStatus(myBook, 'DIVERIFIKASI', syntheticGuru);
  } catch (err: any) {
    statusTamperError = err.message;
  }
  assert(
    statusTamperError !== null && statusTamperError.includes('Akses ditolak'),
    'Guru cannot advance status to DIVERIFIKASI',
    statusTamperError || ''
  );

  // Test 5: Locked Duty Book & Unlock Restriction
  console.log('\n[Test Group 5: Locked Book & Unlock Authority]');
  const lockedBook: DutyBookRecord = {
    ...myBook,
    status: 'DIKUNCI',
  };

  let editLockedError: string | null = null;
  try {
    await DutyBookService.saveDutyBook(lockedBook, syntheticGuru);
  } catch (err: any) {
    editLockedError = err.message;
  }
  assert(
    editLockedError !== null && editLockedError.includes('dikunci'),
    'Guru cannot edit locked duty book',
    editLockedError || ''
  );

  let unlockAttemptError: string | null = null;
  try {
    await DutyBookService.unlockDutyBook(lockedBook, syntheticGuru, 'Testing unauthorized unlock');
  } catch (err: any) {
    unlockAttemptError = err.message;
  }
  assert(
    unlockAttemptError !== null && unlockAttemptError.includes('Akses ditolak'),
    'Guru cannot unlock locked duty book',
    unlockAttemptError || ''
  );

  // Test 6: Admin Revocation & Application of Permissions
  console.log('\n[Test Group 6: Admin Revocation and Application]');
  // 6a: Admin revokes attendance permission
  const revokedPerms = togglePermissionItem(PERMISSIONS.ATTENDANCE_CREATE, syntheticGuru.permissions, 'GURU');
  assert(!revokedPerms.includes('attendance.create'), 'attendance.create removed after toggle');
  assert(!revokedPerms.includes('attendance.view'), 'attendance.view coupled and removed after toggle');
  assert(!checkUserPermission(revokedPerms, PERMISSIONS.ATTENDANCE_VIEW), 'checkUserPermission returns false for attendance.view');
  assert(!checkUserPermission(revokedPerms, PERMISSIONS.ATTENDANCE_CREATE), 'checkUserPermission returns false for attendance.create');

  // 6b: Admin re-grants attendance permission
  const regrantedPerms = togglePermissionItem(PERMISSIONS.ATTENDANCE_CREATE, revokedPerms, 'GURU');
  assert(regrantedPerms.includes('attendance.create'), 'attendance.create added on re-grant');
  assert(regrantedPerms.includes('attendance.view'), 'attendance.view added on re-grant');
  assert(checkUserPermission(regrantedPerms, PERMISSIONS.ATTENDANCE_VIEW), 'checkUserPermission returns true after re-grant');

  // 6c: Admin revokes duty book permission
  const revokedDutyBookPerms = togglePermissionItem(PERMISSIONS.DUTYBOOK_CREATE, syntheticGuru.permissions, 'GURU');
  assert(!revokedDutyBookPerms.includes('dutybook.create'), 'dutybook.create removed after toggle');
  assert(!revokedDutyBookPerms.includes('dutybook.view'), 'dutybook.view removed after toggle');
  assert(!checkUserPermission(revokedDutyBookPerms, PERMISSIONS.DUTYBOOK_VIEW), 'checkUserPermission returns false for dutybook.view');

  // 6d: "Terapkan Hak Akses Piket Guru" for legacy account missing core permissions
  const legacyGuruPerms = ['incident.view']; // Old incomplete account
  const appliedPerms = Array.from(new Set([...legacyGuruPerms, ...GURU_PIKET_CORE_PERMISSIONS])).filter((p) => p !== '*');
  assert(appliedPerms.includes(PERMISSIONS.DASHBOARD_VIEW), 'Applied permissions includes dashboard.view');
  assert(appliedPerms.includes(PERMISSIONS.SCHEDULE_VIEW), 'Applied permissions includes schedule.view');
  assert(appliedPerms.includes(PERMISSIONS.ATTENDANCE_CREATE), 'Applied permissions includes attendance.create');
  assert(appliedPerms.includes(PERMISSIONS.DUTYBOOK_CREATE), 'Applied permissions includes dutybook.create');
  assert(!appliedPerms.includes('*'), 'Applied permissions does NOT contain wildcard *');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
