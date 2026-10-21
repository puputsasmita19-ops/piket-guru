const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

const files = {
  sidebar: 'src/components/layout/Sidebar.tsx',
  dashboard: 'src/features/attendance/AdminAttendanceDashboard.tsx',
  icon: 'src/components/icons/RealtimeMonitorLogo.tsx',
  iconIndex: 'src/components/icons/index.ts',
  asset: 'public/monitoring-piket-realtime-icon.png',
};

for (const file of [files.sidebar, files.dashboard, files.icon]) {
  const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  assert.equal((out.diagnostics || []).length, 0, `${file} has transpile diagnostics.`);
}

const sidebar = fs.readFileSync(files.sidebar, 'utf8');
const dashboard = fs.readFileSync(files.dashboard, 'utf8');
const icon = fs.readFileSync(files.icon, 'utf8');
const iconIndex = fs.readFileSync(files.iconIndex, 'utf8');

assert(fs.existsSync(files.asset), 'Monitoring realtime icon asset should exist in public/.');
assert(sidebar.includes("icon: RealtimeMonitorLogo"), 'Sidebar should use RealtimeMonitorLogo for attendance-monitor menu.');
assert(dashboard.includes("setMonitorView('grid')") && dashboard.includes("setMonitorView('list')"), 'Dashboard should provide Grid/List toggle.');
assert(dashboard.includes('max-h-[34rem] overflow-y-auto') && dashboard.includes('max-h-[30rem] overflow-y-auto') && dashboard.includes('max-h-[32rem] overflow-y-auto'), 'Dashboard sections should be scrollable.');
assert(icon.includes('/monitoring-piket-realtime-icon.png'), 'Custom icon component should point to the uploaded monitoring icon asset.');
assert(iconIndex.includes("RealtimeMonitorLogo"), 'Icons index should export RealtimeMonitorLogo.');

console.log('OK: verifikasi monitoring realtime R12 lulus.');
console.log('- Ikon monitoring realtime diganti dengan gambar kustom.');
console.log('- Toggle tampilan Grid/List tersedia.');
console.log('- Area aktivitas, jurnal, dan riwayat sudah scrollable.');
