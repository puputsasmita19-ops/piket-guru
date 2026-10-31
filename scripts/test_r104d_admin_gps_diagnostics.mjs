/** R104-D: deterministic GPS evidence + Admin diagnostics checks; no Firebase credentials needed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = f => fs.readFileSync(f,'utf8');
let passed=0; let failed=0;
async function test(name, task) {
  try { await task(); console.log(`PASS ${++passed}: ${name}`); }
  catch(e) { failed++; console.error(`FAIL ${name}:`,e); }
}
const files = [
  'src/types/index.ts',
  'src/services/firebase/attendanceService.ts',
  'src/features/attendance/AttendancePreview.tsx',
  'src/features/attendance/AdminAttendanceDashboard.tsx',
  'src/features/attendance/GpsDiagnosticsDetails.tsx',
  'src/features/attendance/gpsDiagnostics.ts',
];
for (const f of files) await test(`Syntax valid ${f}`,()=> {
  const parsed = ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(d=>d.messageText).join('\n'));
});

const makeDiagnostics = () => {
  const path='src/features/attendance/gpsDiagnostics.ts';
  const transpiled=ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={}; const module={exports};
  const context=vm.createContext({exports,module,Date,Number,Math,console,require(spec) {
    if(spec==='../../utils/dateUtils') return {toEpochMs(v) { if(typeof v==='string') return Date.parse(v); if(v?.toMillis) return v.toMillis(); if(typeof v?.seconds==='number') return v.seconds*1000; return new Date(v).getTime(); }};
    throw new Error(`Unexpected import ${spec}`);
  }});
  vm.runInContext(transpiled,context,{timeout:1200});
  return module.exports;
};
const {getGpsDiagnostic,getGpsDiagnosticLabel}=makeDiagnostics();
const base = () => ({id:'a',userId:'u1',tanggal:'2026-10-31',latitude:-6,longitude:106,accuracy:25,distance:137,status:'DALAM_LOKASI',jamMasuk:'2026-10-31T01:00:00.000Z',jamPulang:null});
await test('Historical check-in: distance and accuracy available, hardware reading time unavailable', () => {
  const d=getGpsDiagnostic(base(),'in');assert.equal(d.distance,137);assert.equal(d.accuracy,25);assert.equal(d.capturedAtMs,null);assert.equal(d.radiusMeters,null);assert.equal(getGpsDiagnosticLabel(d),'Memenuhi batas');
});
await test('Historical check-out: never invent missing GPS evidence', () => {
  const d=getGpsDiagnostic({...base(),jamPulang:'2026-10-31T07:00:00.000Z'},'out');assert.equal(d.source,'unavailable');assert.equal(d.capturedAtMs,null);assert.equal(getGpsDiagnosticLabel(d),'Tidak tersedia');
});
await test('Modern check-in records GPS time and school radius separately', () => {
  const d=getGpsDiagnostic({...base(),checkInGpsCapturedAt:'2026-10-31T00:59:55.000Z',checkInRadiusMeters:300},'in');
  assert.equal(d.capturedAtMs,Date.parse('2026-10-31T00:59:55.000Z'));assert.equal(d.radiusMeters,300);
});
await test('Modern check-out uses own GPS timestamp and distance, not check-in fields', () => {
  const d=getGpsDiagnostic({...base(),checkoutGps:{latitude:-6.0002,longitude:106,accuracy:18,distance:22,radiusMeters:300,status:'DALAM_LOKASI',capturedAt:'2026-10-31T07:00:00.000Z',validatedAt:{seconds:Date.parse('2026-10-31T07:00:01.000Z')/1000}}},'out');
  assert.equal(d.distance,22);assert.equal(d.accuracy,18);assert.equal(d.radiusMeters,300);assert.equal(d.capturedAtMs,Date.parse('2026-10-31T07:00:00.000Z'));assert.equal(getGpsDiagnosticLabel(d),'Memenuhi batas');
});
await test('High inaccuracy and outside radius are attention statuses, not confirmed valid', () => {
  assert.equal(getGpsDiagnosticLabel(getGpsDiagnostic({...base(),accuracy:90},'in')),'Perlu diperiksa');
  assert.equal(getGpsDiagnosticLabel(getGpsDiagnostic({...base(),checkInRadiusMeters:100},'in')),'Perlu diperiksa');
});
await test('Unknown GPS fields display as unavailable rather than fake zeroes', () => {
  const d=getGpsDiagnostic({...base(),distance:undefined,accuracy:undefined},'in');assert.equal(d.distance,null);assert.equal(d.accuracy,null);assert.equal(getGpsDiagnosticLabel(d),'Tidak tersedia');
});
await test('Malformed GPS coordinates cannot be presented as operational coordinates', () => {
  const d=getGpsDiagnostic({...base(),latitude:999,longitude:Infinity},'in');assert.equal(d.latitude,null);assert.equal(d.longitude,null);
});

const source = read('src/services/firebase/attendanceService.ts');
const makeCheckoutService = (overrides={}) => {
  const writes=[]; let readCount=0;
  const config={schoolLat:-6,schoolLng:106,allowedRadiusMeters:300,attendanceMode:'BEBAS',...overrides.school};
  const existing={userId:'u1',jamMasuk:'2026-10-31T01:00:00.000Z',jamPulang:null,...overrides.record};
  const update=(ref,payload)=>{writes.push(payload)};
  const serverTimestamp=()=>({__serverTime:true});
  const modules={
    'firebase/firestore':{
      doc(_db,name,id){return {name,id}},getDoc:async()=>({exists:()=>true,data:()=>({isActive:true,sessionRevokedAtSeconds:0})}),
      getDocFromServer:async()=>({exists:()=>true,id:'att-2026-10-31-u1',data:()=>({...existing,jamPulang:'2026-10-31T07:00:00.000Z',checkoutGps:writes[0]?.checkoutGps})}),
      runTransaction:async(_db,fn)=>fn({get:async ref => {readCount++;return ref.name==='settings' ? {exists:()=>true,data:()=>config} : {exists:()=>true,data:()=>existing}}, update}),
      serverTimestamp,
    },
    './firebase':{auth:{currentUser:{uid:'u1',getIdTokenResult:async()=>({claims:{auth_time:12345}})}},db:{}},
    './firestoreService':{FirestoreService:{logAudit:()=>Promise.resolve()}},
    '../../utils/dateUtils':{formatTime:()=> '14:00 WIB',getTodayISODate:()=> '2026-10-31',getCurrentDayName:()=> 'SABTU',getCurrentTimeHHMM:()=> '14:00'},
    '../../utils/scheduleUtils':{getShiftHoursForDay:()=>({checkOutStart:'13:00',checkOutEnd:'16:00'})},
    '../../config/constants':{DEFAULT_SCHOOL_SETTINGS:config},
    '../attendance/attendancePolicy':{AttendancePolicy:{calculateCheckoutLateNote:()=>({keterlambatanMenit:0,keterangan:'Tepat Waktu'})},AttendanceError:class AttendanceError extends Error{}},
    '../attendance/selfieWatermark':{checkSelfieDataUrlSize:()=>({isValid:true})},
    '../drive/photoUploadHelper':{processPhotoForStorage:async value=>({photoUrl:value})},
    './sessionGuard':{createAuthenticatedSession:()=>({assertActive:()=>{},close:()=>{}})},
    '../location/locationService':{LocationService:{MAX_ATTENDANCE_ACCURACY_METERS:50,
      isFreshPosition:p=> Boolean(p && Number.isFinite(p.latitude) && Math.abs(p.latitude)<=90 && Number.isFinite(p.longitude) && Math.abs(p.longitude)<=180 && Number.isFinite(p.accuracy) && p.accuracy>0 && Number.isFinite(p.timestamp) && p.timestamp<=Date.now()+5000 && p.timestamp>=Date.now()-30000),
      evaluateGeofence:(lat,lng,acc,schoolLat,schoolLng,radius)=>{
        const distanceMeters=Math.round(Math.hypot((lat-schoolLat)*111000,(lng-schoolLng)*111000));
        return {distanceMeters,status:acc>50?'AKURASI_RENDAH':distanceMeters>radius?'DI_LUAR_LOKASI':'DALAM_LOKASI'};
      }}}
  };
  const js=ts.transpileModule(source,{fileName:'src/services/firebase/attendanceService.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{module,exports:module.exports,require:spec=>{if(!(spec in modules))throw new Error('Unexpected import '+spec);return modules[spec]},Date,Promise,console,setTimeout,clearTimeout,Math,Number},{timeout:1500});
  return {service:module.exports.AttendanceService,writes,readCount:()=>readCount};
};
const coords=(patch={})=>({latitude:-6.001,longitude:106,accuracy:20,timestamp:Date.now()-500,...patch});
const checkoutArgs=location=>({attendanceId:'att-2026-10-31-u1',userId:'u1',userName:'Guru',tanggal:'2026-10-31',coords:location});
await test('Check-Out writes GPS evidence with correct authoritative 300m radius in atomic transaction', async()=>{
  const {service,writes}=makeCheckoutService();const result=await service.checkOut(checkoutArgs(coords()));assert.equal(result.success,true);assert.equal(writes.length,1);
  const g=writes[0].checkoutGps;
  assert.equal(g.radiusMeters,300);assert.equal(g.status,'DALAM_LOKASI');assert.equal(g.accuracy,20);
  assert.equal(g.distance,111);assert.ok(g.capturedAt.endsWith('Z'));assert.equal(g.validatedAt.__serverTime,true);
});
await test('Check-Out rejects stale GPS before attempting Firestore transaction', async()=>{
  const {service,writes}=makeCheckoutService();await assert.rejects(service.checkOut(checkoutArgs(coords({timestamp:Date.now()-60_000}))),/GPS Check-Out/);assert.equal(writes.length,0);
});
await test('Check-Out rejects accuracy above 50m before writes', async()=>{
  const {service,writes}=makeCheckoutService();await assert.rejects(service.checkOut(checkoutArgs(coords({accuracy:70}))),/GPS Check-Out/);assert.equal(writes.length,0);
});
await test('Check-Out revalidates radius from settings fetched inside transaction', async()=>{
  const {service,writes}=makeCheckoutService({school:{allowedRadiusMeters:80}});
  await assert.rejects(service.checkOut(checkoutArgs(coords())),/radius\/akurasi/);assert.equal(writes.length,0);
});
await test('Check-Out rejects duplicate checkout with zero writes', async()=>{
  const {service,writes}=makeCheckoutService({record:{jamPulang:'2026-10-31T07:00:00.000Z'}});
  await assert.rejects(service.checkOut(checkoutArgs(coords())),/sebelumnya/);assert.equal(writes.length,0);
});
await test('Check-Out cannot mutate check-in GPS fields or jamMasuk', async()=>{
  const {service,writes}=makeCheckoutService();await service.checkOut(checkoutArgs(coords()));
  assert.deepEqual(Object.keys(writes[0]).sort(),['checkoutGps','checkoutPolicy','jamPulang','updatedAt'].sort());
});
const rules=read('firestore.rules');
await test('Rules restrict regular user checkout writes to time, policy and GPS evidence',()=>{
  assert.match(rules,/affectedKeys\(\)\.hasOnly\(\['jamPulang', 'updatedAt', 'checkoutPolicy', 'checkoutGps'\]\)/);
  assert.match(rules,/validCheckoutGpsEvidence\(request\.resource\.data\.checkoutGps\)/);
  assert.match(rules,/!\('checkoutGps' in request\.resource\.data\) && !\('checkoutGps' in resource\.data\)/);
});
await test('Rules require GPS accuracy at most 50m and distance <= server configured radius',()=>{
  assert.match(rules,/gps\.accuracy <= 50/);assert.match(rules,/gps\.distance <= gps\.radiusMeters/);
  assert.match(rules,/gps\.radiusMeters == get\(/);
});
await test('Rules require serverTimestamp GPS confirmation',()=>{
  assert.match(rules,/gps\.validatedAt is timestamp && gps\.validatedAt == request\.time/);
});
await test('Admin-only GPS coordinates not exposed by non-admin history view',()=>{
  assert.match(read('src/features/attendance/AttendancePreview.tsx'),/canManageHistory && <td[^>]*>[\s\S]*?<GpsDiagnosticsDetails/);
  assert.match(read('src/features/attendance/AdminAttendanceDashboard.tsx'),/if \(!admin\) return/);
});
await test('Admin dashboard uses already subscribed daily data, no extra GPS reader',()=>{
  const screen=read('src/features/attendance/AdminAttendanceDashboard.tsx');assert.match(screen,/\[\.\.\.todayRecords\]\.sort/);assert.match(screen,/gpsStats/);
});
await test('Admin UI includes absent checkout GPS explicitly without interpolation',()=>{
  const code=read('src/features/attendance/GpsDiagnosticsDetails.tsx');assert.match(code,/Tidak tersedia/);assert.match(code,/Data lama/);
});
console.log(`R104-D: ${passed}/${passed+failed} PASS`);
if (failed) process.exitCode=1;
