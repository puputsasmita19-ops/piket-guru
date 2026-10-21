const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let checks = 0;
const test = (title, fn) => { fn(); checks++; console.log('PASS', title); };
const DATE = '2026-10-21';
const weekday = d => ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'][new Date(d).getUTCDay()];
const dateUtils = { getTodayISODate: () => DATE, getCurrentDayName: input => weekday(input || `${DATE}T12:00:00+07:00`) };
function load(file, dependencies) {
  const code = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length, 0, file + ' parse error');
  const cjs = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(cjs, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw new Error('Unexpected module: ' + name);
  }, console, Date, Map, Set, Intl, Promise, encodeURIComponent, crypto: { randomUUID: () => 'unit-test' } }, { filename: file });
  return exports;
}
const utils = load('src/utils/scheduleUtils.ts', {
  '../config/constants': { DEFAULT_DAILY_SCHEDULES: {} },
  './dateUtils': dateUtils,
});
const alice = { id: 'alice', fullName: 'Guru A', role: 'GURU', isActive: true };
const bob = { id: 'bob', fullName: 'Guru B', role: 'GURU', isActive: true };
const carl = { id: 'carl', fullName: 'Guru C', role: 'GURU', isActive: true };
const original = { id: 'weekly-A', tanggal: '', recurrence: 'WEEKLY', hari: 'RABU', jamMulai: '06:30', jamSelesai: '08:00', petugasId: alice.id, petugasName: alice.fullName, petugasRole: 'GURU', ruangId: 'gate', ruangName: 'Gerbang', status: 'TERJADWAL', updatedAt: 'v1' };
const coverId = utils.dutyCoverageId(DATE, original.id);
const cover = { ...original, id: coverId, tanggal: DATE, recurrence: 'ONCE', coverageForScheduleId: original.id, petugasId: bob.id, petugasName: bob.fullName, absentOfficerId: alice.id, absentOfficerName: alice.fullName, absenceReason: 'Izin keluarga mendadak', status: 'TERJADWAL' };
const pending = { ...cover, status: 'DIBATALKAN', petugasId: alice.id, petugasName: alice.fullName };
const nextWednesday = '2026-10-28';
const store = new Map();
const db = {};
const auth = { currentUser: { uid: 'admin1' } };
function ref(_db, collection, id) { return { collection, id, key: collection + '/' + id }; }
function snap(r) { const d = store.get(r.key); return { id: r.id, exists: () => !!d, data: () => d }; }
const firestoreMock = {
  doc: ref,
  runTransaction: async (_db, fn) => {
    const operations = [];
    const tx = {
      get: async r => snap(r),
      set: (r, data) => operations.push(['set', r.key, data]),
      delete: r => operations.push(['delete', r.key]),
    };
    await fn(tx);
    for (const [op, key, value] of operations) {
      if (op === 'set') store.set(key, value);
      else store.delete(key);
    }
  },
};
const service = load('src/services/firebase/dutyCoverageService.ts', {
  'firebase/firestore': firestoreMock,
  './firebase': { db, auth },
  '../../utils/scheduleUtils': utils,
  '../../utils/dateUtils': dateUtils,
});
const makeInput = (replacementUserId = '', reason = 'Izin keluarga mendadak', allSchedules = [original]) => ({ source: original, dateISO: DATE, reason, replacementUserId, actorName: 'Administrator', allSchedules, users: [alice, bob, carl] });

(async () => {
  test('Override IDs deterministic per date/source', () => { assert.equal(coverId, utils.dutyCoverageId(DATE, original.id)); });
  test('Original weekly roster active before override', () => assert.equal(utils.getEffectiveSchedulesOnDate([original], DATE)[0].petugasId, alice.id));
  test('One-day replacement hides original and assigns substitute', () => {
    assert.equal(utils.getEffectiveSchedulesOnDate([original, cover], DATE).length, 1);
    assert.equal(utils.getEffectiveSchedulesOnDate([original, cover], DATE)[0].petugasId, bob.id);
  });
  test('Pending replacement removes original from active roster', () => assert.equal(utils.getEffectiveSchedulesOnDate([original, pending], DATE).length, 0));
  test('Weekly roster returns to original following week', () => assert.equal(utils.getEffectiveSchedulesOnDate([original, cover], nextWednesday)[0].petugasId, alice.id));
  test('Pending duty cover remains visible in admin absence list', () => assert.equal(utils.getDutyCoverageForDate([original, pending], DATE).length, 1));
  test('Inactive original schedule invalidates outdated override', () => assert.equal(utils.getEffectiveSchedulesOnDate([{ ...original, status: 'DIBATALKAN' }, cover], DATE).length, 0));
  test('A person cannot substitute themselves', () => assert.throws(() => service.validateDutyCoverage(makeInput(alice.id), [alice, bob, carl])));
  test('A replacement must be active', () => assert.throws(() => service.validateDutyCoverage(makeInput('suspended'), [alice, bob])));
  test('A reason must be meaningful', () => assert.throws(() => service.validateDutyCoverage(makeInput('', 'sakit'), [alice, bob])));
  test('Future/past dates not allowed through today workflow', () => assert.throws(() => service.validateDutyCoverage({ ...makeInput(), dateISO: nextWednesday }, [alice, bob])));
  test('Conflicting same-day replacement is rejected', () => {
    const clash = { ...original, id: 'clash', petugasId: bob.id, petugasName: bob.fullName };
    assert.throws(() => service.validateDutyCoverage(makeInput(bob.id, 'Izin keluarga mendadak', [original, clash]), [alice, bob]));
  });
  store.set('users/admin1', { id: 'admin1', fullName: 'Administrator', isActive: true, role: 'ADMIN' });
  store.set('users/bob', bob);
  store.set('users/carl', carl);
  store.set('schedules/' + original.id, original);
  // Authorization is enforced against the user document, not a local UI role flag.
  store.set('users/admin1', { id: 'admin1', fullName: 'Administrator', isActive: true, role: 'GURU' });
  await assert.rejects(() => service.DutyCoverageService.save(makeInput('')), /Hanya administrator/);
  checks++; console.log('PASS Non-admin may not create duty override');
  store.set('users/admin1', { id: 'admin1', fullName: 'Administrator', isActive: true, role: 'ADMIN' });
  await service.DutyCoverageService.save(makeInput(''));
  test('Admin pending save writes one-day override and atomic audit', () => {
    assert.equal(store.get('schedules/' + coverId).status, 'DIBATALKAN');
    assert.equal(store.get('auditLogs/audit-duty-cover-unit-test').action, 'CREATE');
  });
  await assert.rejects(() => service.DutyCoverageService.save(makeInput(bob.id)), /admin lain/);
  checks++; console.log('PASS Stale admin cannot overwrite emergency assignment');
  await service.DutyCoverageService.save(makeInput(bob.id, 'Izin keluarga mendadak', [original, store.get('schedules/' + coverId)]));
  test('Admin may appoint substitute after pending assignment', () => {
    assert.equal(store.get('schedules/' + coverId).petugasId, bob.id);
    assert.equal(store.get('auditLogs/audit-duty-cover-unit-test').action, 'UPDATE');
  });
  store.set(`attendance/att-${DATE}-bob`, { userId: bob.id });
  await assert.rejects(() => service.DutyCoverageService.restore(store.get('schedules/' + coverId), 'Administrator'), /Presensi sudah tercatat/);
  checks++; console.log('PASS Restore rejected after substitute attendance');
  await assert.rejects(() => service.DutyCoverageService.save(makeInput(carl.id, 'Izin keluarga mendadak', [original, store.get('schedules/' + coverId)])), /Pengganti lama sudah presensi/);
  checks++; console.log('PASS Attended substitute cannot be replaced by another teacher');
  store.delete(`attendance/att-${DATE}-bob`);
  await service.DutyCoverageService.restore(store.get('schedules/' + coverId), 'Administrator');
  test('Restore removes override and retains weekly original', () => {
    assert.equal(store.has('schedules/' + coverId), false);
    assert.equal(store.get('schedules/' + original.id).petugasId, alice.id);
  });
  for (const file of ['src/features/attendance/AdminAttendanceDashboard.tsx', 'src/features/attendance/AttendancePreview.tsx', 'src/features/attendance/DutyCoverageDialog.tsx', 'src/features/schedules/SchedulePreview.tsx', 'src/services/firebase/attendanceService.ts', 'src/features/dashboard/DashboardView.tsx', 'src/features/kiosk/PublicKioskDisplay.tsx', 'src/features/kiosk/KioskPreview.tsx', 'src/features/command-center/CommandCenterPreview.tsx', 'src/features/command-center/CampusMapViewer.tsx', 'src/utils/dutyRoster.ts']) {
    const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(parsed.parseDiagnostics.length, 0, file + ' parse error');
  }
  test('Modified React and attendance files parse without errors', () => {});
  console.log(`OK: ${checks} pemeriksaan R14 lulus.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
