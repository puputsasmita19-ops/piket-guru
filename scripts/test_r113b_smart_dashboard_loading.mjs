/** R113-B: bounded initial master reads and on-demand roster profile resolution. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = path => readFileSync(path, 'utf8');
const view = read('src/features/dashboard/DashboardView.tsx');
const helper = read('src/features/dashboard/dashboardSmartData.ts');
const lookup = read('src/features/dashboard/rosterPhotoLookup.ts');
const schedule = read('src/utils/scheduleUtils.ts');
const testResults = [];
function test(label, fn) { fn(); testResults.push(label); console.log(`PASS ${testResults.length}: ${label}`); }
function parse(name, source) {
  const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length, 0, ast.parseDiagnostics.map(d => d.messageText).join('; '));
}
for (const [name, code] of [['DashboardView.tsx', view], ['dashboardSmartData.ts', helper], ['rosterPhotoLookup.ts', lookup]])
  test(`${name} parses as valid TypeScript`, () => parse(name, code));
function loadPure(name, source) {
  const compiled = ts.transpileModule(source, { fileName: name, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require }, { filename: name, timeout: 2000 });
  return module.exports;
}
const { createRosterMasterState, updateRosterMasterState, areRosterMastersReady } = loadPure('dashboardSmartData.ts', helper);
const { rosterCandidateIds, resolveRosterPhoto, rosterUnresolvedNames } = loadPure('rosterPhotoLookup.ts', lookup);
const teacher1 = { id: 'teacher-1', userId: 'uid-1', fullName: 'Guru Satu' };
const staff1 = { id: 'staff-1', userId: 'uid-1', fullName: 'Staf Satu' };
const teacher2 = { id: 'teacher-2', userId: 'uid-2', fullName: 'Guru Dua' };
test('Master state starts unloaded and tied to current UID', () => {
  const s = createRosterMasterState('uid-1');
  assert.equal(s.key, 'uid-1'); assert.equal(s.teachersReady, false); assert.equal(s.staffReady, false);
});
test('Teacher data alone does not enable roster photo queries', () => {
  const s = updateRosterMasterState(createRosterMasterState('uid-1'), 'uid-1', 'teachers', [teacher1]);
  assert.equal(areRosterMastersReady(s, 'uid-1', true), false);
});
test('Both master sources ready while modal open allow photo resolution', () => {
  let s = createRosterMasterState('uid-1');
  s = updateRosterMasterState(s, 'uid-1', 'staff', [staff1]);
  s = updateRosterMasterState(s, 'uid-1', 'teachers', [teacher1]);
  assert.equal(areRosterMastersReady(s, 'uid-1', true), true);
});
test('Closing roster modal immediately prevents photo queries', () => {
  let s = createRosterMasterState('uid-1');
  s = updateRosterMasterState(s, 'uid-1', 'teachers', [teacher1]);
  s = updateRosterMasterState(s, 'uid-1', 'staff', []);
  assert.equal(areRosterMastersReady(s, 'uid-1', false), false);
});
test('Delayed previous-account snapshot never mutates current-account masters', () => {
  const state = createRosterMasterState('uid-2');
  assert.equal(updateRosterMasterState(state, 'uid-1', 'teachers', [teacher1]), state);
  assert.equal(state.teachers.length, 0);
});
test('Old account master data cannot be used by a new user', () => {
  let s = createRosterMasterState('uid-1');
  s = updateRosterMasterState(s, 'uid-1', 'teachers', [teacher1]);
  s = updateRosterMasterState(s, 'uid-1', 'staff', []);
  assert.equal(areRosterMastersReady(s, 'uid-2', true), false);
});
test('Empty staff list still completes master loading', () => {
  let s = createRosterMasterState('uid-1');
  s = updateRosterMasterState(s, 'uid-1', 'teachers', [teacher1]);
  s = updateRosterMasterState(s, 'uid-1', 'staff', []);
  assert.equal(areRosterMastersReady(s, 'uid-1', true), true);
});
test('Updating one master list preserves the other', () => {
  let s = createRosterMasterState('uid-1');
  s = updateRosterMasterState(s, 'uid-1', 'staff', [staff1]);
  s = updateRosterMasterState(s, 'uid-1', 'teachers', [teacher1]);
  assert.equal(s.staff.length, 1); assert.equal(s.teachers.length, 1);
});
test('Null state ignores late subscriptions', () => {
  assert.equal(updateRosterMasterState(null, 'uid-1', 'teachers', [teacher1]), null);
});
test('Photo lookup resolves legacy master ID after full master list loads', () => {
  const roster = [{ petugasId: 'teacher-2', petugasName: 'Guru Dua' }];
  const ids = rosterCandidateIds(roster, [teacher1, teacher2], []);
  assert.ok(ids.includes('uid-2'));
  const users = [{ id: 'uid-2', fullName: 'Guru Dua', avatarUrl: '/avatar2', isActive: true }];
  assert.equal(resolveRosterPhoto(roster[0], users, [teacher1, teacher2], []), '/avatar2');
});
test('Roster photos never invent missing profiles', () => {
  const row = { petugasId: 'teacher-2', petugasName: 'Guru Dua' };
  assert.equal(resolveRosterPhoto(row, [], [teacher2], []), null);
  assert.equal(rosterUnresolvedNames([row], [], [teacher2], [])[0], 'Guru Dua');
});
// Extract original production matching function to prove current-user-only masters
// keep the same legacy linkage; it has no external dependencies at runtime.
const ast = ts.createSourceFile('scheduleUtils.ts', schedule, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'isScheduleMatchingUser');
assert.ok(fn);
const matcher = loadPure('scheduleMatcher.ts', `${fn.getText(ast)}\nexport { isScheduleMatchingUser };`).isScheduleMatchingUser;
test('Direct schedules still match the active account', () => {
  assert.equal(matcher({petugasId:'uid-1'}, {id:'uid-1'}, [], []), true);
});
test('Legacy teacher schedules still match using a single linked record', () => {
  assert.equal(matcher({petugasId:'teacher-1'}, {id:'uid-1'}, [teacher1], []), true);
});
test('Legacy staff schedules still match using a single linked record', () => {
  assert.equal(matcher({petugasId:'staff-1'}, {id:'uid-1'}, [], [staff1]), true);
});
test('Unrelated teacher profiles never match the active account', () => {
  assert.equal(matcher({petugasId:'teacher-2'}, {id:'uid-1'}, [teacher1], []), false);
});
test('Dashboard initial teacher subscription is filtered by current userId', () => {
  assert.match(view, /watchCollection<TeacherRecord>\('teachers', rows => setLinkedMasters[\s\S]*?\[where\('userId', '==', linkedUserId\)\]/);
});
test('Dashboard initial staff subscription is filtered by current userId', () => {
  assert.match(view, /watchCollection<StaffRecord>\('staff', rows => setLinkedMasters[\s\S]*?\[where\('userId', '==', linkedUserId\)\]/);
});
test('Linked master caches are explicitly scoped to UID and not collection-wide', () => {
  assert.equal((view.match(/cacheKey: `linked:\$\{linkedUserId\}`/g) || []).length, 2);
});
test('Session-scoped state prevents old UID masters being shown', () => {
  assert.match(view,/linkedMasters\?\.userId === currentUser\?\.id/);
});
test('Unbounded master subscriptions are only created by an open roster modal', () => {
  assert.match(view, /if \(!isRosterModalOpen \|\| !rosterMasterKey\)/);
  assert.match(view, /watchCollection<TeacherRecord>\('teachers',\s*rows => update\('teachers'/);
  assert.match(view, /watchCollection<StaffRecord>\('staff',\s*rows => update\('staff'/);
});
test('Both on-demand listeners are disposed when modal closes', () => {
  assert.match(view, /return \(\) => \{ stopTeachers\(\); stopStaff\(\); \};/);
});
test('Avatar reads stay blocked until both roster masters are ready', () => {
  assert.match(view, /if \(!rosterMastersReady\) \{ setRosterPhotoUsers\(\[\]\); return; \}/);
});
test("Schedule collection and today's data listeners retain original scope", () => {
  assert.match(view, /watchCollection<ScheduleItem>\('schedules', \(data\)/);
  for (const name of ['attendance', 'dutyBooks', 'incidents', 'studentTardiness','studentPermits','visitors'])
    assert.match(view, new RegExp(`'${name}'[\\s\\S]*?\\[where\\('tanggal', '==', todayISO\\)\\]`));
});
test('Daily roster and personal schedules are memoized', () => {
  assert.match(view,/useMemo\(\(\) => dutyRosterForDate\(schedules, todayISO\)/);
  assert.match(view,/const personalSchedules = useMemo\(/);
});
test('Dashboard audit keeps independent labels for personal and modal master listeners', () => {
  for(const label of ['teachers:linked','staff:linked','teachers:roster','staff:roster']) assert.ok(view.includes(label));
});
test('No modifications to PIN, GPS, geofence, or role enforcement in dashboard source', () => {
  assert.doesNotMatch(view, /signInWithCustomToken|LocationService\.getCurrentPosition|rateLimitReset|allow read:/);
});
console.log(`R113-B Smart Dashboard Loading: ${testResults.length}/${testResults.length} PASS`);
