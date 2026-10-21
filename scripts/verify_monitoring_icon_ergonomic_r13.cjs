const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const iconPath = 'src/components/icons/RealtimeMonitorLogo.tsx';
const sidebarPath = 'src/components/layout/Sidebar.tsx';
const dashboardPath = 'src/features/attendance/AdminAttendanceDashboard.tsx';
const iconIndexPath = 'src/components/icons/index.ts';

for (const file of [iconPath, sidebarPath, dashboardPath]) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  assert.equal((out.diagnostics || []).length, 0, `${file} has transpile diagnostics.`);
}

const icon = fs.readFileSync(iconPath, 'utf8');
const sidebar = fs.readFileSync(sidebarPath, 'utf8');
const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const iconIndex = fs.readFileSync(iconIndexPath, 'utf8');

assert(icon.includes("createAppIcon('RealtimeMonitorLogo'"), 'Realtime monitoring icon should use createAppIcon like other menu icons.');
assert(!icon.includes('<img') && !icon.includes('monitoring-piket-realtime-icon.png'), 'Realtime monitoring icon should no longer use raw image rendering.');
assert(sidebar.includes('icon: RealtimeMonitorLogo'), 'Sidebar menu should still use RealtimeMonitorLogo.');
assert(dashboard.includes('RealtimeMonitorLogo className="w-6 h-6 text-[var(--theme-primary)]"'), 'Monitoring dashboard header should use ergonomic vector icon styling.');
assert(iconIndex.includes("export { RealtimeMonitorLogo } from './RealtimeMonitorLogo';"), 'Icons index should export RealtimeMonitorLogo.');

console.log('OK: verifikasi ikon monitoring realtime ergonomis R13 lulus.');
console.log('- Ikon monitoring realtime kini memakai komponen vektor aplikasi.');
console.log('- Ikon mengikuti warna dan perilaku visual menu lain.');
console.log('- Menu sidebar dan header dashboard tetap memakai ikon yang sama.');
