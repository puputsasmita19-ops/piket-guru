/** R93: single-shutter selfie / GPS freshness regression (no Firebase/device needed). */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const files = [
  'src/services/location/locationService.ts',
  'src/services/attendance/selfieWatermark.ts',
  'src/features/attendance/AttendancePreview.tsx',
  'src/components/camera/CameraCaptureModal.tsx',
  'src/services/firebase/attendanceService.ts',
  'src/types/index.ts',
];
const loadTs = (file) => {
  const source = read(file);
  const built = ts.transpileModule(source, {fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const errors = (built.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  const module = {exports:{}};
  const sandbox = {module,exports:module.exports,console,Date,Intl,Math,JSON,Error,Number,Promise};
  vm.runInNewContext(`(function(){${built.outputText}\n})()`,sandbox,{timeout:5000});
  return module.exports;
};
let passes = 0;
const test = async (name, fn) => { await fn(); console.log(`PASS ${++passes}: ${name}`); };
const { LocationService } = loadTs('src/services/location/locationService.ts');
const selfie = loadTs('src/services/attendance/selfieWatermark.ts');
const now = () => Date.now();
const position = (ageMs=0,accuracy=18) => ({latitude:-8.150433,longitude:113.712504,accuracy,timestamp:now()-ageMs});
const evidence = (ageMs=0) => {
  const time = now()-ageMs;
  return {userId:'GURU-001',userName:'Guru Uji',schoolName:'Sekolah Uji',capturedAt:time,coords:{...position(0),timestamp:time}};
};
for (const file of files) await test(`TS syntax: ${file}`, () => {
  const source = read(file);
  const built = ts.transpileModule(source, {fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  const errors = (built.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
});
await test('Fresh GPS <=15 sec reused without another request', async () => {
  let renewCalls=0;
  const recent=position(2000);
  const result=await LocationService.ensureFreshPosition(recent,async()=>{renewCalls++;return position()},15000);
  assert.equal(renewCalls,0);assert.equal(result.timestamp,recent.timestamp);
});
await test('GPS older than 15 sec triggers a fresh reading (not 30-sec cache)', async () => {
  let renewCalls=0;
  const fresh=position(500);
  const result=await LocationService.ensureFreshPosition(position(24000),async()=>{renewCalls++;return fresh},15000);
  assert.equal(renewCalls,1);assert.equal(result.timestamp,fresh.timestamp);
});
await test('Stale renewed GPS is rejected (never stamped as new)', async () => {
  await assert.rejects(LocationService.ensureFreshPosition(position(25000),async()=>position(21000),15000),/cache lama/i);
});
await test('Inaccurate renewed GPS is rejected despite new timestamp', async () => {
  await assert.rejects(LocationService.ensureFreshPosition(position(35000),async()=>position(0,88),15000),/50m/);
});
await test('Capture is validated with original 30s GPS proximity', () => {
  selfie.validateSelfieEvidence(evidence());
  assert.throws(()=>selfie.validateSelfieEvidence({...evidence(),coords:position(38000)}),/kedaluwarsa/);
});
await test('Photo may be submitted minutes after shutter with fresh GPS recheck', () => {
  const old=evidence(20*60*1000);
  assert.doesNotThrow(()=>selfie.validateSelfieForSubmission(old));
  assert.throws(()=>selfie.validateSelfieEvidence(old),/kedaluwarsa/);
});
await test('Photo from a previous day cannot pass', () => {
  assert.throws(()=>selfie.validateSelfieForSubmission(evidence(26*60*60*1000)),/satu hari/);
  assert.match(read('src/features/attendance/AttendancePreview.tsx'),/photoDate !== todayISO/);
});
await test('Photo GPS and submitted GPS are retained separately', () => {
  const screen=read('src/features/attendance/AttendancePreview.tsx');
  const service=read('src/services/firebase/attendanceService.ts');
  assert.match(screen,/selfieCapturedAt: capturedSelfie\.capturedAt/);
  assert.match(screen,/selfieCaptureCoords: capturedSelfie\.coords/);
  assert.match(screen,/coords: verifiedCoords/);
  assert.match(service,/selfieCaptureGps:/);
});
await test('Camera finalizes one shutter; no second confirmation for attendance', () => {
  const camera=read('src/components/camera/CameraCaptureModal.tsx');
  const start=camera.indexOf('if (prepareCapture) {',camera.indexOf('const handleTakeSnapshot'));
  const end=camera.indexOf('} else {', start);
  const handler=camera.slice(start,end);
  assert.match(handler,/onCapture\(dataUrl\)/);
  assert.match(handler,/onClose\(\)/);
  assert.match(camera,/if \(busyRef\.current\) return/);
});
await test('Renewal at capture explicitly bypasses the stale geolocation cache', () => {
  const source=read('src/features/attendance/AttendancePreview.tsx');
  assert.match(source,/getCurrentPosition\(\{ timeoutMs: 12000, desiredAccuracyMeters: 20, maxStaleAgeMs: 15000, forceFresh: true \}\)/);
});
await test('Photo is preserved on delayed submit while fresh GPS is checked', () => {
  const source=read('src/features/attendance/AttendancePreview.tsx');
  assert.match(source,/if \(!LocationService\.isFreshPosition\(verifiedCoords, 30_000\)\)/);
  assert.match(source,/Foto tetap tersimpan/);
  assert.match(source,/refreshCheckInGpsRef\.current = true/);
});
console.log(`\n${passes}/${passes} R93 checks passed.`);
