import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root = path.resolve(import.meta.dirname, '..');
const dashboardDir = path.join(root, 'src/features/dashboard');
const read = name => fs.readFileSync(path.join(dashboardDir, name), 'utf8');
let passed = 0;
function test(label, fn) { fn(); console.log(`PASS ${++passed}: ${label}`); }
function compiles(file) {
  const input = read(file);
  const compiled = ts.transpileModule(input, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }});
  const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${file}: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`);
  return compiled.outputText;
}
const view = read('DashboardView.tsx');
const stats = read('DashboardStatistics.tsx');
const actions = read('QuickActions.tsx');
const flash = read('DashboardFlashInfo.tsx');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
for (const f of ['DashboardView.tsx','DashboardStatistics.tsx','QuickActions.tsx','DashboardFlashInfo.tsx','dashboardSwipeGesture.ts']) test(`TypeScript syntax ${f}`, () => compiles(f));
const swipeJs = compiles('dashboardSwipeGesture.ts');
const exports = {};
const module = { exports };
vm.runInNewContext(swipeJs, { exports, module });
const { getSwipeIntent, getSwipeDirection } = module.exports;
const start = { x: 100, y: 100 };
test('Small pointer jitter never locks carousel', () => assert.equal(getSwipeIntent(start, 106, 107), 'pending'));
test('Native vertical scroll is prioritized', () => assert.equal(getSwipeIntent(start, 105, 145), 'vertical'));
test('Horizontal movement enables swipe intent', () => assert.equal(getSwipeIntent(start, 145, 105), 'horizontal'));
test('Diagonal movement stays pending until axis is clear', () => assert.equal(getSwipeIntent(start, 115, 114), 'pending'));
test('Swipe needs >=40px horizontal travel', () => assert.equal(getSwipeDirection(start, 139, 101), 0));
test('Left swipe goes next', () => assert.equal(getSwipeDirection(start, 40, 102), 1));
test('Right swipe goes previous', () => assert.equal(getSwipeDirection(start, 160, 102), -1));
test('Vertical scroll does not change slide', () => assert.equal(getSwipeDirection(start, 180, 200), 0));
test('Horizontal swipe ignores moderate diagonal movement', () => assert.equal(getSwipeDirection(start, 48, 125), 1));
test('Carousel waits for horizontal intent before capture', () => {
  assert.match(flash, /getSwipeIntent\(start, e\.clientX, e\.clientY\) !== 'horizontal'/);
  assert.match(flash, /if \(e\.pointerType === 'mouse'\) e\.currentTarget\.setPointerCapture/);
  assert.match(flash, /if \(!e\.currentTarget\.hasPointerCapture/);
  assert.match(flash, /onPointerCancel=\{\(\) => \{ const start = gesture\.current/);
});
test('Touch-action retains native vertical scrolling', () => assert.match(css, /\.flash-viewport \{[^}]*touch-action: pan-y pinch-zoom/));
test('Carousel uses compositor hint only while moving', () => {
  assert.match(css, /\.flash-track \{[^}]*will-change: auto/);
  assert.match(css, /dashboard-flash\[data-transitioning="true"\] \.flash-track \{ will-change: transform/);
});
test('Dashboard day collections use stable memoized data', () => {
  for (const name of ['todayAttendance','todayIncidents','todayTardiness','todayPermits','todaySubstitutions','todayVisitors','todayDutyBook']) {
    assert.match(view, new RegExp(`const ${name} = useMemo\\(`));
  }
});
test('Statistics and presentation only rebuild for relevant changes', () => {
  assert.match(view, /const statistics = useMemo\(/);
  assert.match(view, /const visibleStatistics = useMemo\(/);
  assert.match(view, /const flashConfig = useMemo\(/);
  assert.match(stats, /export const DashboardStatistics = React\.memo/);
  assert.match(stats, /const MiniTrend = React\.memo/);
  assert.match(actions, /export const QuickActions = React\.memo/);
});
test('Number formatting retains ID locale and one-decimal display semantics', () => {
  assert.match(stats, /standardNumberFormatter = new Intl\.NumberFormat\('id-ID', \{ maximumFractionDigits: 1 \}\)/);
  assert.match(stats, /accessibleNumberFormatter = new Intl\.NumberFormat\('id-ID'\)/);
});
test('Modal content is not constructed until opened', () => {
  assert.match(view, /announcementBoard = detailPanel === 'announcements' \? \(/);
  assert.match(view, /dutyRosterBoard = \(detailPanel === 'dutyRoster' \|\| detailPanel === 'dutyRosterTomorrow'\) \? \(/);
  assert.match(view, /incidentBoard = detailPanel === 'incidents' \? \(/);
});
test('Dashboard core subscriptions and secondary staging stay intact', () => {
  for (const key of ['settings/school_config','schedules','teachers:linked','staff:linked','attendance','dutyBooks','incidents','announcements','studentTardiness','studentPermits','visitors']) assert.ok(view.includes(key), key);
  assert.match(view, /stageDashboardSecondaryListeners/);
});
test('Role-guarded navigation and roster-on-demand remain in place', () => {
  assert.match(view, /hasPermission\(item\.permission\)/);
  assert.match(view, /isRosterModalOpen/);
  assert.match(actions, /hasPermission\(permission\)\) onNavigate\(tab\)/);
});
console.log(`R113-C Mobile Rendering & UX: ${passed}/${passed} PASS`);
