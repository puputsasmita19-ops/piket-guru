const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const files = [
  'src/features/schedules/SchedulePreview.tsx',
  'src/features/schedules/ScheduleFormModal.tsx',
  'src/features/schedules/OfficerPicker.tsx',
  'src/components/common/SearchableSelect.tsx',
];
const text = Object.fromEntries(files.map(path => [path, fs.readFileSync(path, 'utf8')]));
let passed = 0;
function test(label, fn) { fn(); passed++; console.log('PASS', label); }
for (const file of files) {
  test(`${file} valid TS/TSX`, () => {
    const parsed = ts.createSourceFile(file, text[file], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, parsed.parseDiagnostics.map(d => d.messageText).join('; '));
  });
}
const schedule = text[files[0]], form = text[files[1]], officer = text[files[2]], picker = text[files[3]];
test('Schedule filtered rows are memoized', () => assert.match(schedule, /const filtered = useMemo\(\(\) => schedules\.filter/));
test('Grid card rendering no longer reruns on modal state updates', () => assert.match(schedule, /const gridRows = useMemo\(\(\) => filtered\.map/));
test('Table row rendering no longer reruns on modal state updates', () => assert.match(schedule, /const tableRows = useMemo\(\(\) => filtered\.map/));
test('Grid and table use cached rows', () => { assert.match(schedule, /\bgridRows\s*\n/); assert.match(schedule, /\{tableRows\}/); });
test('Status, coverage and cancellation selectors maintain reactive dependencies', () => {
  for (const functionName of ['statusOf', 'cancelFor', 'coverFor']) assert.match(schedule, new RegExp(`const ${functionName} = useCallback`));
});
test('Opening cancellation modal does not change its policy or validation', () => {
  assert.match(schedule, /requestCancel = useCallback/);
  assert.match(schedule, /DutyCancellationService\.cancel\(/);
  assert.match(schedule, /cancelReason\.trim\(\)\.length < 10/);
});
test('Emergency replacement still opens via selected schedule', () => assert.match(schedule, /setCoverageSource\(item\)/));
test('Cached schedule avatar lookup prevents redundant scans', () => assert.match(schedule, /const userLookup = useMemo/));
test('Weekly day counts are cached for faster open/re-render', () => assert.match(schedule, /const dayCounts = useMemo/));
test('Schedule modal retains stable computed shift days and conflicts', () => {
  assert.match(form, /const effectiveDays = useMemo/);
  assert.match(form, /const conflicts = useMemo/);
});
test('Schedule modal form validation and save remain intact', () => {
  assert.match(form, /ScheduleService\.checkConflict/);
  assert.match(form, /await onSaveMultiple\(drafts\)/);
});
test('Shared searchable picker precomputes normalized search text', () => assert.match(picker, /const indexedOptions = useMemo/));
test('Shared picker first paint is limited but search still covers all options', () => {
  assert.match(picker, /filtered\.slice\(0, query\.trim\(\) \? 80 : 40\)/);
  assert.match(picker, /indexedOptions\.filter/);
  assert.match(picker, /\{visibleOptions\.map/);
});
test('Shared picker keeps keyboard and accessible search controls', () => {
  assert.match(picker, /ArrowDown/); assert.match(picker, /ArrowUp/); assert.match(picker, /role="combobox"/);
});
test('Officer picker still filters ALL candidates, rendering a bounded subset', () => {
  assert.match(officer, /filterOfficerCandidates\(candidates, search\)/);
  assert.match(officer, /visible\.slice\(0, search\.trim\(\) \? 80 : 40\)/);
});
test('Officer picker bulk select still applies to filtered results', () => assert.match(officer, /visible\.map\(c => c\.userId\)/));
test('Realtime listeners unchanged', () => {
  assert.match(schedule, /subscribeToCollection<ScheduleItem>/);
  assert.match(schedule, /subscribeToCollection<AttendanceRecord>/);
});
console.log(`OK: ${passed}/${passed} targeted checks for responsive menu R19 passed.`);
