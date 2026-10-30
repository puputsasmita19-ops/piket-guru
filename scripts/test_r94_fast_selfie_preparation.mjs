/** R94: fast selfie GPS/font preparation regression, no camera/Firebase needed. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const files = [
  'src/features/attendance/AttendancePreview.tsx',
  'src/components/camera/CameraCaptureModal.tsx',
  'src/services/attendance/selfieWatermark.ts',
  'src/services/location/locationService.ts',
];
let pass = 0;
const test = async (name, fn) => { await fn(); console.log(`PASS ${++pass}: ${name}`); };
for (const file of files) await test(`Transpile ${file}`, () => {
  const built = ts.transpileModule(read(file), {fileName:file,reportDiagnostics:true,compilerOptions:{
    module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,
  }});
  const errors = (built.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
});
const screen = read(files[0]);
const camera = read(files[1]);
const watermark = read(files[2]);
await test('Camera opens GPS/font preflight in parallel with video stream', () => {
  const start = camera.indexOf('if (isOpen) {');
  assert.ok(start >= 0);
  const snippet = camera.slice(start, camera.indexOf('return () => {', start));
  assert.match(snippet, /warmupCapture\?\.\(\)/);
  assert.match(snippet, /void startCamera\(initialMode\)/);
  assert.ok(snippet.indexOf('warmupCapture?.()') < snippet.indexOf('void startCamera(initialMode)'));
});
await test('No photo is captured on camera-open warmup', () => {
  const start = screen.indexOf('const warmupSelfieCapture');
  const warmup = screen.slice(start, screen.indexOf('const prepareSelfieCapture', start));
  assert.doesNotMatch(warmup, /stampCheckInSelfie|onCapture\(/);
  assert.match(warmup, /isLocating \|\| warmSelfieGpsRef\.current/);
});
await test('Selfie uses GPS and font in Promise.all; no serial font-to-GPS delay', () => {
  const preparation = screen.slice(screen.indexOf('const prepareSelfieCapture'), screen.indexOf('// --- SUBMIT PRESENSI MASUK ---'));
  assert.match(preparation, /Promise\.all\(\[\s*getCaptureGps\(\),\s*prepareSelfieWatermarkFont\(\)/);
});
await test('Warmup request is joined instead of cancelled/restarted', () => {
  assert.match(screen, /const warmed = await warming|warmed = await warming/);
  assert.match(screen, /warmSelfieContextRef\.current === selfieContextKey/);
  assert.match(screen, /warmSelfieGpsRef\.current = null;/);
});
await test('Freshness 15s, strict accuracy/geofence validation retained', () => {
  assert.match(screen, /LocationService\.ensureFreshPosition\(coords, getNewReading, 15_000\)/);
  assert.match(screen, /captureGeofence\.status !== 'DALAM_LOKASI'/);
  assert.match(screen, /stampCheckInSelfie\(canvas, evidence, watermarkFont\)/);
  assert.match(watermark, /SELFIE_GPS_MAX_AGE_MS = 30_000/);
});
await test('Photo remains one-tap and no automatic attendance submission', () => {
  assert.match(camera, /if \(prepareCapture\) \{[\s\S]*?onCapture\(dataUrl\);[\s\S]*?onClose\(\)/);
  assert.doesNotMatch(camera, /handleCheckIn\(/);
});
function loadFontService(fonts) {
  const built = ts.transpileModule(watermark,{fileName:'selfieWatermark.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const module = {exports:{}};
  vm.runInNewContext(`(function(){${built.outputText}\n})()`, {
    module,exports:module.exports,document:{fonts},Date,Intl,Promise,setTimeout,clearTimeout,console,
  }, {timeout:3000});
  return module.exports;
}
await test('Concurrent font requests share one preparation promise', async () => {
  let calls=0;
  const service=loadFontService({load:async()=>{calls++;return [{family:'Open Sans'}]}});
  const first=service.prepareSelfieWatermarkFont();
  const second=service.prepareSelfieWatermarkFont();
  assert.strictEqual(first,second);
  assert.equal(await first,'Open Sans');
  assert.equal(await service.prepareSelfieWatermarkFont(),'Open Sans');
  assert.equal(calls,2);
});
await test('Offline fallback is cached and does not repeatedly wait on font loading', async () => {
  let calls=0;
  const service=loadFontService({load:()=>{calls++;return Promise.reject(new Error('offline'))}});
  assert.equal(await service.prepareSelfieWatermarkFont(),'Arial');
  assert.equal(await service.prepareSelfieWatermarkFont(),'Arial');
  assert.equal(calls,2);
});
console.log(`\n${pass}/${pass} R94 checks passed.`);
