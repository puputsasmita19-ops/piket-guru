/** R95: GPS-to-selfie next-step checks (no Firebase, camera permission or actual location required). */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
let passed = 0;
const test = (name, run) => { run(); console.log(`PASS ${++passed}: ${name}`); };
const compile = (file, mode = ts.ModuleKind.CommonJS) => {
  const built = ts.transpileModule(read(file), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: mode, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const errors = (built.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
  return built.outputText;
};
const load = file => {
  const module = { exports: {} };
  vm.runInNewContext(`(function(){${compile(file)}\n})()`, { module, exports: module.exports, Date, Math, JSON, Number, console, Promise }, { timeout: 5000 });
  return module.exports;
};
const source = read('src/features/attendance/AttendancePreview.tsx');
const styles = read('src/features/attendance/attendanceGps.css');
const helper = load('src/features/attendance/selfieGpsGuide.ts');
const { LocationService } = load('src/services/location/locationService.ts');
const now = Date.now();
const coord = (distanceFromNow=2000, accuracy=16) => ({latitude:-8.150433,longitude:113.712504, accuracy, timestamp:now-distanceFromNow});
const inside = LocationService.evaluateGeofence(-8.150433,113.712504,16,-8.150433,113.712504,100);
const outside = LocationService.evaluateGeofence(-8.155433,113.712504,16,-8.150433,113.712504,100);
const lowAccuracy = LocationService.evaluateGeofence(-8.150433,113.712504,75,-8.150433,113.712504,100);
const args = {
  activeTab:'presensi', settingsReady:true, validSchoolLocation:true,
  userId:'GURU-123', hasCheckIn:false, hasSelfie:false, isCameraOpen:false, isSubmitting:false,
  canCheckIn:true, gpsError:null, position:coord(), geofence:inside, isGpsFresh:true,
};
for (const file of ['src/features/attendance/AttendancePreview.tsx','src/features/attendance/selfieGpsGuide.ts','src/services/location/locationService.ts']) {
  test(`TS/TSX syntax ${file}`, () => { compile(file, ts.ModuleKind.ESNext); });
}
test('Valid fresh GPS within geofence permits guide', () => { assert.equal(helper.shouldGuideToSelfie(args), true); });
test('Missing or failed GPS does not guide', () => {
  assert.equal(helper.shouldGuideToSelfie({...args, position:null}), false);
  assert.equal(helper.shouldGuideToSelfie({...args, gpsError:'Lokasi ditolak'}), false);
});
test('Stale reading is ineligible at 15 seconds (not 30-second cache)', () => {
  assert.equal(LocationService.isFreshPosition(coord(25000), 15000),false);
  assert.equal(helper.shouldGuideToSelfie({...args, isGpsFresh:LocationService.isFreshPosition(coord(25000),15000)}),false);
});
test('Geofence outside the school radius cannot guide', () => {
  assert.equal(outside.status, 'DI_LUAR_LOKASI');
  assert.equal(helper.shouldGuideToSelfie({...args, geofence:outside}),false);
});
test('Accuracy above 50m cannot guide, even when distance is in radius', () => {
  assert.equal(lowAccuracy.status,'AKURASI_RENDAH');
  assert.equal(helper.shouldGuideToSelfie({...args, geofence:lowAccuracy, position:coord(0,75)}),false);
});
test('No guide during history, existing check-in, or existing photo', () => {
  for (const change of [{activeTab:'riwayat'},{hasCheckIn:true},{hasSelfie:true}])
    assert.equal(helper.shouldGuideToSelfie({...args,...change}),false);
});
test('No guide when camera open, submitting, or schedule is not eligible', () => {
  for (const change of [{isCameraOpen:true},{isSubmitting:true},{canCheckIn:false}])
    assert.equal(helper.shouldGuideToSelfie({...args,...change}),false);
});
test('No guide without authenticated user or valid school settings', () => {
  for (const change of [{userId:''},{settingsReady:false},{validSchoolLocation:false}])
    assert.equal(helper.shouldGuideToSelfie({...args,...change}),false);
});
test('Progress GPS still evaluates radius immediately', () => {
  const gpsUpdate = source.slice(source.indexOf('const refreshGpsLocation'), source.indexOf('// Today\'s schedule'));
  assert.match(gpsUpdate,/onProgress:/);
  assert.match(gpsUpdate,/LocationService\.evaluateGeofence\(/);
  assert.match(gpsUpdate,/maxStaleAgeMs: 15000/);
});
test('Auto-guide is one-time per account/day and not repeated on each GPS update', () => {
  assert.match(source,/autoGuidedSelfieKeyRef\.current === key/);
  assert.match(source,/const key = `\$\{currentUser\?\.id \|\| ''\}\|\$\{todayISO\}`/);
});
test('Auto-guide is scroll-and-focus, never automatic camera capture or check-in', () => {
  const effect = source.slice(source.indexOf('const canGuideToSelfie'), source.indexOf('// Restore attendance selfie draft'));
  assert.match(effect,/scrollIntoView/);
  assert.match(effect,/focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(effect,/setIsCameraModalOpen\(true\)|handleCheckIn\(|stampCheckInSelfie/);
});
test('Visibility changes can trigger guide after returning to the tab', () => {
  assert.match(source,/visibilitychange/);
  assert.match(source,/!pageVisible/);
});
test('Onboarding highlight presents status and accessible description', () => {
  assert.match(source,/GPS dalam radius sekolah\. Lanjutkan dengan mengetuk Ambil Swafoto/);
  assert.match(source,/aria-describedby=\{showSelfieGuide/);
  assert.match(styles, /\.attendance-selfie-ready-hint/);
  assert.match(styles, /\.attendance-selfie-target\.is-gps-ready/);
});
test('Reduced-motion users receive outline without pulse animation', () => {
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.attendance-selfie-target\.is-gps-ready/);
  assert.match(source,/prefers-reduced-motion: reduce/);
});
test('Opening camera removes highlight; photo still requires one manual shutter', () => {
  assert.match(source,/setHighlightSelfieStep\(false\);\s*setIsCameraModalOpen\(true\)/);
  assert.match(source,/prepareCapture=\{prepareSelfieCapture\}/);
});
console.log(`\n${passed}/${passed} R95 checks passed.`);
