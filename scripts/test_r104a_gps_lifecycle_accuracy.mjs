/** R104-A: GPS lifecycle/geofence audits. Runs without Firebase or a real GPS device. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const locationFile = 'src/services/location/locationService.ts';
const locationSource = read(locationFile);
const uiSource = read('src/features/attendance/AttendancePreview.tsx');
const attendanceSource = read('src/services/firebase/attendanceService.ts');
let passed = 0;
async function test(title, run) {
  try { await run(); console.log(`PASS ${++passed}: ${title}`); }
  catch (error) { console.error(`FAIL ${title}:`, error); process.exitCode = 1; }
}
const position = (lat = -6, lng = 106, accuracy = 12, timestamp = Date.now()) => ({
  coords: { latitude:lat, longitude:lng, accuracy, altitude:null, speed:null },timestamp,
});
const makeService = (geolocation = {}, seed = {}) => {
  const storage = { ...seed };
  const cleared = [];
  const navigator = { geolocation: { clearWatch(id) { cleared.push(id); },
    getCurrentPosition() {}, watchPosition() {return 77;}, ...geolocation } };
  const window = { isSecureContext:true,
    sessionStorage:{
      getItem(key) {return storage[key] ?? null;},
      setItem(key,value) {storage[key] = value;},
      removeItem(key) {delete storage[key];},
    },
  };
  const module = {exports:{}};
  const js = ts.transpileModule(locationSource, {fileName:locationFile, compilerOptions: {
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const context = vm.createContext({ module,exports:module.exports,navigator,window,console,
    Date,Math,Number,JSON,Error,Promise,Infinity,setTimeout,clearTimeout });
  vm.runInContext(js,context,{timeout:1500});
  return {Service:module.exports.LocationService,storage,cleared,navigator};
};
for (const f of [locationFile,'src/features/attendance/AttendancePreview.tsx',
  'src/services/firebase/attendanceService.ts']) {
  await test(`Syntax TS/TSX: ${f}`, () => {
    const tree = ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,
      f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(tree.parseDiagnostics.length,0,
      tree.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n')).join('\n'));
  });
}
await test('GPS valid from within 137m is inside 300m radius', () => {
  const {Service} = makeService();
  const r = Service.evaluateGeofence(-6+0.00123,106,12,-6,106,300);
  assert.equal(r.status,'DALAM_LOKASI');
  assert.equal(r.isWithinRadius,true);
  assert.ok(r.distanceMeters >= 120 && r.distanceMeters <= 150);
});
await test('Outside 300m radius fails even with accurate GPS', () => {
  const {Service} = makeService();
  assert.equal(Service.evaluateGeofence(-6+0.0032,106,7,-6,106,300).status,'DI_LUAR_LOKASI');
});
await test('Accuracy above 50m never passes geofence', () => {
  const {Service} = makeService();
  assert.equal(Service.evaluateGeofence(-6,106,90,-6,106,300).status,'AKURASI_RENDAH');
});
await test('Invalid official school radius and coordinates fail closed', () => {
  const {Service} = makeService();
  assert.equal(Service.evaluateGeofence(-6,106,12,Infinity,106,300).status,'GPS_ERROR');
  assert.equal(Service.evaluateGeofence(-6,106,12,-6,106,0).status,'GPS_ERROR');
  assert.equal(Service.evaluateGeofence(-6,106,NaN,-6,106,300).status,'GPS_ERROR');
});
await test('Freshness rejects missing, invalid, future and old GPS evidence', () => {
  const {Service} = makeService();
  const base = {latitude:-6,longitude:106,accuracy:12,timestamp:Date.now()};
  assert.equal(Service.isFreshPosition(base,15_000),true);
  for (const change of [{latitude:91},{longitude:181},{accuracy:Infinity},{timestamp:undefined},
      {timestamp:0},{timestamp:Date.now()+60_000},{timestamp:Date.now()-31_000}]) {
    assert.equal(Service.isFreshPosition({...base,...change},15_000),false,JSON.stringify(change));
  }
});
await test('First accurate browser GPS reading settles immediately', async () => {
  const {Service} = makeService({
    getCurrentPosition(success) {queueMicrotask(()=>success(position(-6,106,15)));},
    watchPosition() {return 31;},
  });
  const result = await Service.getCurrentPosition({timeoutMs:400});
  assert.equal(result.accuracy,15);
});
await test('Browser high accuracy watch can refine poor first position', async () => {
  const updates = [];
  const {Service} = makeService({
    getCurrentPosition(success) { queueMicrotask(()=>success(position(-6,106,78))); },
    watchPosition(success) { setTimeout(()=>success(position(-6,106,22)),10); return 32; },
  });
  const result = await Service.getCurrentPosition({timeoutMs:300,onProgress:(p)=>updates.push(p.accuracy)});
  assert.equal(result.accuracy,22);
  assert.deepEqual(updates,[78,22]);
});
await test('Invalid watch GPS accuracy is ignored until a valid fix arrives', async () => {
  const {Service} = makeService({
    watchPosition(success) {
      setTimeout(() => success(position(-6,106,-8)),5);
      setTimeout(() => success(position(-6,106,18)),12);
      return 33;
    },
  });
  const result = await Service.getCurrentPosition({timeoutMs:300});
  assert.equal(result.accuracy,18);
});
await test('Explicit cleanup rejects pending search instead of hanging', async () => {
  const {Service,cleared} = makeService({watchPosition() {return 34;}});
  const pending = Service.getCurrentPosition({timeoutMs:800});
  Service.clearCurrentWatcher();
  await assert.rejects(pending,error=>error.name==='AbortError');
  assert.ok(cleared.includes(34));
});
await test('Synchronous browser watch completion does not leak watch ID', async () => {
  const {Service,cleared} = makeService({
    watchPosition(success) {success(position(-6,106,9)); return 56;},
  });
  const result = await Service.getCurrentPosition({timeoutMs:300});
  assert.equal(result.accuracy,9);
  assert.ok(cleared.includes(56));
});
await test('Old untrusted cached coordinates do not skip hardware location', async () => {
  let calls = 0;
  const seed = {'piket-guru:last-valid-position':JSON.stringify({latitude:999,longitude:106,accuracy:1,timestamp:Date.now()})};
  const {Service,storage} = makeService({
    getCurrentPosition(success) {calls++;queueMicrotask(()=>success(position(-6,106,19)));},
    watchPosition() {return 39;},
  },seed);
  const result = await Service.getCurrentPosition({timeoutMs:350});
  assert.equal(result.latitude,-6);
  assert.equal(calls,1);
  assert.notEqual(storage['piket-guru:last-valid-position'],seed['piket-guru:last-valid-position']);
});
await test('GPS success badge has one-shot expiry and respects fresh condition', () => {
  assert.match(uiSource,/setGpsExpiryTick\(tick => tick \+ 1\)/);
  assert.match(uiSource,/coords\.timestamp \+ 15_000 - Date\.now\(\)/);
  assert.match(uiSource,/const gpsConfirmedWithinRadius = gpsFixFresh && !gpsError/);
  assert.match(uiSource,/GPS Kedaluwarsa/);
});
await test('Check-Out recalculates geofence from submitted coordinates', () => {
  const checkOut = uiSource.slice(uiSource.indexOf('const handleCheckOut = async'),uiSource.indexOf('// History filters'));
  assert.match(checkOut,/const activeGeofence = LocationService\.evaluateGeofence\(/);
  assert.match(checkOut,/if \(activeGeofence\.status !== 'DALAM_LOKASI'\)/);
  assert.doesNotMatch(checkOut,/let activeGeofence = geofence/);
});
await test('Check-In service rejects invalid geofence before uploading photo', () => {
  const start = attendanceSource.indexOf('const authoritativeGeofence = LocationService.evaluateGeofence');
  const end = attendanceSource.indexOf('let finalPhotoUrl = photoUrl', start);
  const block = attendanceSource.slice(start,end);
  assert.match(block,/LocationService\.isFreshPosition\(coords, 30_000\)/);
  assert.match(block,/authoritativeGeofence\.status !== 'DALAM_LOKASI'/);
  assert.match(block,/throw new Error/);
});
console.log(`R104-A: ${passed}/17 checks completed${process.exitCode ? ' (FAILURES)' : ' (PASS)'}`);
