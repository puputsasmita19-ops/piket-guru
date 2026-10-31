/** R111: zero-dependency simulated browser regression suite, no real GPS claim. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const helperSource = readFileSync(path.join(root, 'src/services/location/gpsFastWarmup.ts'), 'utf8');
const gpsSource = readFileSync(path.join(root, 'src/services/location/locationService.ts'), 'utf8');
const shellSource = readFileSync(path.join(root, 'src/AuthenticatedShell.tsx'), 'utf8');
const screenSource = readFileSync(path.join(root, 'src/features/attendance/AttendancePreview.tsx'), 'utf8');
function transpile(file, input) {
  const sf = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(sf.parseDiagnostics.length, 0, `${file} syntax errors`);
  return ts.transpileModule(input, {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
}
const helperJS=transpile('gpsFastWarmup.ts', helperSource);
const gpsJS=transpile('locationService.ts', gpsSource);
transpile('AuthenticatedShell.tsx', shellSource);
transpile('AttendancePreview.tsx', screenSource);
const sample=(accuracy=25)=>({timestamp:Date.now(),coords:{latitude:-6.001,longitude:106.001,accuracy,altitude:null,speed:null}});
function makeBrowser({ permission='granted', hidden=false, secure=true, permissionsSupported=true, queryFails=false }={}) {
  const calls={perm:0, quick:0,watch:0, clear:0};
  const slot={quick:null,watch:null};
  const geo={
    getCurrentPosition(ok){calls.quick++;slot.quick=ok;},
    watchPosition(ok){calls.watch++;slot.watch=ok;return 17;},
    clearWatch(){calls.clear++;},
  };
  const navigator={geolocation:geo,...(permissionsSupported? {permissions:{query:async()=>{calls.perm++;if(queryFails)throw Error('No Permissions API');return {state:permission};}}}:{})};
  const store={};
  const window={isSecureContext:secure,sessionStorage:{getItem:(k)=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:(k)=>delete store[k]}};
  const document={visibilityState:hidden?'hidden':'visible'};
  const module1={exports:{}};
  const ctx={module:module1,exports:module1.exports,navigator,window,document,console,Date,Math,JSON,Number,Infinity,Error,Promise,setTimeout,clearTimeout};
  vm.runInNewContext(gpsJS,ctx,{timeout:1500});
  const GPS=module1.exports.LocationService;
  const module2={exports:{}};
  vm.runInNewContext(helperJS,{...ctx,module:module2,exports:module2.exports,require:(p)=>{
    assert.equal(p,'./locationService');return {LocationService: GPS};
  }},{timeout:1500});
  return {GPS,helper:module2.exports,calls,slot,store};
}
async function settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
let pass=0;
async function test(label,fn){await fn();pass++;console.log(`PASS ${pass}: ${label}`);}
await test('sources parse and compile with TypeScript',()=>assert.ok(helperJS && gpsJS));
await test('warmup never requests GPS when permission is prompt',async()=>{const b=makeBrowser({permission:'prompt'});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.watch,0);});
await test('warmup never requests GPS when permission is denied',async()=>{const b=makeBrowser({permission:'denied'});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.quick,0);});
await test('warmup never requests GPS when tab hidden',async()=>{const b=makeBrowser({hidden:true});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.perm,0);});
await test('warmup never requests GPS on insecure context',async()=>{const b=makeBrowser({secure:false});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.perm,0);});
await test('warmup never prompts where Permissions API is unavailable',async()=>{const b=makeBrowser({permissionsSupported:false});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.watch,0);});
await test('permission query failure is benign and does not request GPS',async()=>{const b=makeBrowser({queryFails:true});await b.helper.prewarmAttendanceGpsIfGranted();assert.equal(b.calls.watch,0);});
await test('simultaneous warmups produce a single hardware watch',async()=>{const b=makeBrowser();const a=b.helper.prewarmAttendanceGpsIfGranted();const c=b.helper.prewarmAttendanceGpsIfGranted();await settle();assert.equal(b.calls.watch,1);assert.equal(b.calls.quick,1);b.slot.watch(sample());await Promise.all([a,c]);assert.equal(b.calls.clear,1);});
await test('valid warm fix reused by Attendance without restarting GPS',async()=>{const b=makeBrowser();const a=b.helper.prewarmAttendanceGpsIfGranted();await settle();b.slot.watch(sample(35));await a;const fix=await b.GPS.getCurrentPosition({maxStaleAgeMs:15000});assert.equal(fix.accuracy,35);assert.equal(b.calls.watch,1);});
await test('low accuracy warm fix does not grant access and waits for better GPS',async()=>{const b=makeBrowser();const a=b.helper.prewarmAttendanceGpsIfGranted();await settle();b.slot.quick(sample(90));await settle();assert.equal(b.GPS.lastValidPosition,null);b.slot.watch(sample(49));await a;assert.equal(b.GPS.lastValidPosition.accuracy,49);});
await test('school radius validation still rejects >300 meters',()=>{const b=makeBrowser();assert.equal(b.GPS.evaluateGeofence(-6.005,106,10,-6,106,300).status,'DI_LUAR_LOKASI');});
await test('warmup does not weaken the 50-meter limit',()=>{assert.match(helperSource,/MAX_ATTENDANCE_ACCURACY_METERS/);assert.match(gpsSource,/MAX_ATTENDANCE_ACCURACY_METERS = 50/);});
await test('only authenticated, authorized dashboard and attendance screens call warmup',()=>{assert.match(shellSource,/currentUser\?\.id && hasPermission\(PERMISSIONS\.ATTENDANCE_VIEW\)/);assert.match(shellSource,/activeTab === 'dashboard' \|\| activeTab === 'attendance'/);});
await test('diagnostic is opt-in only and records elapsed to validated geofence',()=>{assert.match(screenSource,/get\('gps_diag'\) === '1'/);assert.match(screenSource,/geo\.status === 'DALAM_LOKASI'/);assert.match(screenSource,/setGpsReadyElapsedMs/);});
await test('GPS guide and attendance checks are retained',()=>{assert.match(screenSource,/shouldGuideToSelfie/);assert.match(screenSource,/const activeGeofence = LocationService.evaluateGeofence\(/);assert.match(screenSource,/const verifiedGeofence = LocationService.evaluateGeofence\(/);});
console.log(`R111: ${pass}/15 PASS`);
