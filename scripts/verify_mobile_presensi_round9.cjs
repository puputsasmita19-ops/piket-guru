const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

const root = process.cwd();
const previewPath = path.join(root, 'src/features/attendance/AttendancePreview.tsx');
const locationPath = path.join(root, 'src/services/location/locationService.ts');
const cssPath = path.join(root, 'src/features/attendance/attendanceGps.css');

const preview = fs.readFileSync(previewPath, 'utf8');
const location = fs.readFileSync(locationPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

for (const [label, source, isTsx] of [
  ['AttendancePreview.tsx', preview, true],
  ['locationService.ts', location, false],
]) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics || [];
  assert.equal(diagnostics.length, 0, `${label} has transpile diagnostics: ${diagnostics.map(d => d.messageText).join('; ')}`);
}

assert(!preview.includes('maksimal 2,5 detik'), 'UI text for "maksimal 2,5 detik" should be removed from presensi mobile view.');
assert(preview.includes('Sembunyikan Peta') && preview.includes('Lihat Peta'), 'Attendance view must include a map toggle for a cleaner mobile layout.');
assert(preview.includes('attendance-gps-grid') && preview.includes('attendance-gps-stat'), 'Attendance view should use the new minimal GPS stats layout.');
assert(location.includes('sessionStorage') && location.includes('CACHE_KEY'), 'Location service should cache the last valid GPS reading in sessionStorage.');
assert(location.includes('getCurrentPosition(') && location.includes('watchPosition('), 'Location service should use quick read + watch refinement flow.');
assert(css.includes('.attendance-gps-grid') && css.includes('.attendance-map-toggle'), 'GPS mobile styles should exist in attendanceGps.css.');

console.log('OK: verifikasi perbaikan presensi mobile R9 lulus.');
console.log('- Teks waktu tunggu GPS yang mengganggu sudah dihapus.');
console.log('- Layout GPS mobile minimalis tersedia.');
console.log('- Toggle peta untuk tampilan mobile tersedia.');
console.log('- Cache GPS sementara dan pembacaan cepat aktif.');
