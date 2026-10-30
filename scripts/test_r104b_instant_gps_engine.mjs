/** R104-B: shared, fast, fail-closed GPS engine. Runs with Node + global TS only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const source = readFileSync(join(root, 'src/services/location/locationService.ts'), 'utf8');
const ui = readFileSync(join(root, 'src/features/attendance/AttendancePreview.tsx'), 'utf8');
const js = ts.transpileModule(source, {fileName:'locationService.ts',compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const pos = (accuracy = 12, timestamp = Date.now(), lat = -6, lng = 106) => ({
  timestamp,coords:{accuracy,latitude:lat,longitude:lng,altitude:null,speed:null},
});
const delay = (ms) => new Promise(resolve => setTimeout(resolve,ms));
function makeService(geo = {}) {
  const watch = {calls:0,quickCalls:0,clear:[],quickSuccess:null,watchSuccess:null,watchError:null};
  const storage = {};
  const geolocation = {
    clearWatch(id) {watch.clear.push(id);},
    getCurrentPosition(success) {watch.quickCalls++;watch.quickSuccess=success;},
    watchPosition(success, error) {watch.calls++;watch.watchSuccess=success;watch.watchError=error;return 42;},
    ...geo,
  };
  const navigator = {geolocation};
  const window = {isSecureContext:true,sessionStorage:{
    getItem(key){return storage[key]??null;},setItem(key,val){storage[key]=val;},
    removeItem(key){delete storage[key];},
  }};
  const module={exports:{}};
  vm.runInNewContext(js,{module,exports:module.exports,navigator,window,console,
    Date,Math,Number,JSON,Infinity,Error,Promise,setTimeout,clearTimeout},{timeout:1500});
  return {GPS:module.exports.LocationService,watch,storage,geolocation};
}
let passed=0, failed=0;
async function test(name,fn){
  try {await fn();passed++;console.log(`PASS ${passed}: ${name}`);}
  catch(err){failed++;console.error(`FAIL: ${name}`,err);}
}
await test('GPS TypeScript syntax accepted',()=>{
  const parsed=ts.createSourceFile('locationService.ts',source,ts.ScriptTarget.Latest,true);
  assert.equal(parsed.parseDiagnostics.length,0);
});
await test('One quick 45m reading resolves immediately without waiting for 20m',async()=>{
  const {GPS,watch}=makeService();
  const promise=GPS.getCurrentPosition({timeoutMs:600,desiredAccuracyMeters:20,forceFresh:true});
  watch.quickSuccess(pos(45));
  assert.equal((await promise).accuracy,45);
  assert.deepEqual(watch.clear,[42]);
});
await test('Three overlapping requests share exactly one watcher and one quick lookup',async()=>{
  const {GPS,watch}=makeService();
  const a=GPS.getCurrentPosition({timeoutMs:400});
  const b=GPS.getCurrentPosition({timeoutMs:500});
  const c=GPS.getCurrentPosition({timeoutMs:700,forceFresh:true});
  assert.equal(watch.calls,1);assert.equal(watch.quickCalls,1);
  watch.watchSuccess(pos(15));
  const result=await Promise.all([a,b,c]);
  assert.deepEqual(result.map(x=>x.accuracy),[15,15,15]);
  assert.deepEqual(watch.clear,[42]);
});
await test('Bad GPS fix is provisional for all callers, then 30m settles both',async()=>{
  const {GPS,watch}=makeService();const aUpdates=[],bUpdates=[];
  const a=GPS.getCurrentPosition({timeoutMs:500,onProgress:(p,prov)=>aUpdates.push([p.accuracy,prov])});
  const b=GPS.getCurrentPosition({timeoutMs:500,onProgress:(p,prov)=>bUpdates.push([p.accuracy,prov])});
  watch.quickSuccess(pos(92));watch.watchSuccess(pos(30));
  await Promise.all([a,b]);
  assert.deepEqual(aUpdates,[[92,true],[30,false]]);
  assert.deepEqual(bUpdates,aUpdates);
});
await test('Two different timeout budgets do not cancel one another',async()=>{
  const {GPS,watch}=makeService();
  const short=GPS.getCurrentPosition({timeoutMs:25,forceFresh:true});
  const long=GPS.getCurrentPosition({timeoutMs:250,forceFresh:true});
  await assert.rejects(short,/Lokasi belum terbaca/);
  assert.equal(watch.clear.length,0);
  watch.watchSuccess(pos(10));
  assert.equal((await long).accuracy,10);
  assert.equal(watch.clear.length,1);
});
await test('All timed-out callers release hardware watcher',async()=>{
  const {GPS,watch}=makeService();
  const p=GPS.getCurrentPosition({timeoutMs:20,forceFresh:true});
  await assert.rejects(p,/Lokasi belum terbaca/);
  assert.deepEqual(watch.clear,[42]);
});
await test('Cancellation rejects all listeners without leaving Promise hanging',async()=>{
  const {GPS,watch}=makeService();
  const a=GPS.getCurrentPosition({timeoutMs:350});
  const b=GPS.getCurrentPosition({timeoutMs:350,forceFresh:true});
  GPS.cancelCurrentSearch();
  await assert.rejects(a,e=>e.name==='AbortError');
  await assert.rejects(b,e=>e.name==='AbortError');
  assert.deepEqual(watch.clear,[42]);
});
await test('New search after cancellation does not accept stale callbacks',async()=>{
  const {GPS,watch}=makeService();
  const p=GPS.getCurrentPosition({timeoutMs:500,forceFresh:true});
  const late=watch.watchSuccess;
  GPS.cancelCurrentSearch();
  await assert.rejects(p,e=>e.name==='AbortError');
  const newP=GPS.getCurrentPosition({timeoutMs:500,forceFresh:true});
  late(pos(6));
  const newCallback=watch.watchSuccess;
  newCallback(pos(18));
  assert.equal((await newP).accuracy,18);
  assert.equal(watch.calls,2);
});
await test('ForceFresh caller cannot use 10-second-old provider fix',async()=>{
  const {GPS,watch}=makeService();
  const p=GPS.getCurrentPosition({timeoutMs:200,forceFresh:true});
  watch.quickSuccess(pos(8,Date.now()-10000));
  await delay(5);
  watch.watchSuccess(pos(12));
  assert.equal((await p).accuracy,12);
});
await test('Different cache-age policies only serve eligible callers',async()=>{
  const {GPS,watch}=makeService();
  const a=GPS.getCurrentPosition({timeoutMs:300,maxStaleAgeMs:30000,forceFresh:true});
  const b=GPS.getCurrentPosition({timeoutMs:300,maxStaleAgeMs:5000,forceFresh:true});
  watch.watchSuccess(pos(15,Date.now()-8000));
  // ForceFresh does not accept old timestamps even if within maxStaleAgeMs.
  watch.watchSuccess(pos(22));
  assert.deepEqual((await Promise.all([a,b])).map(x=>x.accuracy),[22,22]);
});
await test('Permission-denied stops the GPS hardware search promptly',async()=>{
  const {GPS,watch}=makeService();
  const pending=GPS.getCurrentPosition({timeoutMs:400,forceFresh:true});
  watch.watchError({code:1});
  await assert.rejects(pending,/Izin lokasi GPS ditolak/);
  assert.deepEqual(watch.clear,[42]);
});
await test('Transient watch error still allows a subsequent accurate fix',async()=>{
  const {GPS,watch}=makeService();
  const pending=GPS.getCurrentPosition({timeoutMs:300});
  watch.watchError({code:2});
  watch.watchSuccess(pos(18));
  assert.equal((await pending).accuracy,18);
});
await test('One throwing progress subscriber does not break another',async()=>{
  const {GPS,watch}=makeService();
  const a=GPS.getCurrentPosition({timeoutMs:400,onProgress:()=>{throw Error('UI unmounted');}});
  const b=GPS.getCurrentPosition({timeoutMs:400});
  watch.watchSuccess(pos(22));
  assert.equal((await a).accuracy,22);
  assert.equal((await b).accuracy,22);
});
await test('Invalid, stale and future GPS fixes cannot complete lookup',async()=>{
  const {GPS,watch}=makeService();
  const p=GPS.getCurrentPosition({timeoutMs:250,forceFresh:true});
  watch.watchSuccess(pos(NaN));
  watch.watchSuccess(pos(2,Date.now()-31000));
  watch.watchSuccess(pos(1,Date.now()+60000));
  watch.watchSuccess(pos(18));
  assert.equal((await p).accuracy,18);
});
await test('Outside 300m remains outside despite excellent accuracy',()=>{
  const {GPS}=makeService();
  assert.equal(GPS.evaluateGeofence(-6.0035,106,5,-6,106,300).status,'DI_LUAR_LOKASI');
  assert.equal(GPS.evaluateGeofence(-6.0012,106,40,-6,106,300).status,'DALAM_LOKASI');
  assert.equal(GPS.evaluateGeofence(-6.0012,106,80,-6,106,300).status,'AKURASI_RENDAH');
});
await test('Fresh cached fix is reused without restarting browser hardware',async()=>{
  const {GPS,watch}=makeService();
  const initial=GPS.getCurrentPosition({timeoutMs:300});
  watch.watchSuccess(pos(14));
  await initial;
  const again=await GPS.getCurrentPosition({maxStaleAgeMs:15000});
  assert.equal(again.accuracy,14);
  assert.equal(watch.calls,1);
});
await test('After timeout a new search can start and produce a valid fix',async()=>{
  const {GPS,watch}=makeService();
  const p=GPS.getCurrentPosition({timeoutMs:20,forceFresh:true});
  await assert.rejects(p,/Lokasi belum terbaca/);
  const retry=GPS.getCurrentPosition({timeoutMs:250,forceFresh:true});
  assert.equal(watch.calls,2);
  watch.watchSuccess(pos(13));
  assert.equal((await retry).accuracy,13);
});
await test('Settings hydration connects UI to the in-flight GPS progress stream',()=>{
  const block=ui.slice(ui.indexOf('const refreshGpsLocation'),ui.indexOf('// Today\'s schedule'));
  assert.match(block,/const position = await acquirePosition\(\)/);
  assert.match(block,/onProgress: \(pos, isProv\) =>/);
  assert.doesNotMatch(block,/await earlyFix/);
});
await test('Presensi UI still validates GPS before checkout and selfie navigation',()=>{
  assert.match(ui,/const gpsConfirmedWithinRadius = gpsFixFresh && !gpsError/);
  assert.match(ui,/const activeGeofence = LocationService.evaluateGeofence\(/);
  assert.match(ui,/if \(activeGeofence.status !== 'DALAM_LOKASI'\)/);
  assert.match(ui,/const verifiedGeofence = LocationService.evaluateGeofence\(/);
});
console.log(`R104-B: ${passed}/${passed+failed} ${failed?'FAILED':'PASS'}`);
if(failed)process.exitCode=1;
