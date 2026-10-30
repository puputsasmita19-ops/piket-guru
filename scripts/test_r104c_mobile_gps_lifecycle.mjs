/** R104-C: foreground resume policy, mobile lifecycle, and UX integration checks. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const file = 'src/features/attendance/gpsMobileLifecycle.ts';
const src = readFileSync(join(root, file), 'utf8');
const ui = readFileSync(join(root, 'src/features/attendance/AttendancePreview.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/features/attendance/attendanceGps.css'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = {exports:{}};
vm.runInNewContext(js, {module, exports:module.exports, Date, Number, Math}, {timeout:1000});
const {shouldRefreshGpsOnForeground, GPS_FOREGROUND_REUSE_MS, GPS_FOREGROUND_DEDUPE_MS} = module.exports;
const now=1_840_000_000_000;
const loc=(age=2000, accuracy=12) => ({latitude:-6.5,longitude:107.1,accuracy,timestamp:now-age});
const state=(options={}) => ({now,lastAttemptAt:0,visible:true,activeTab:'presensi',settingsReady:true,
  validSchoolLocation:true,locating:false,busy:false,position:loc(),...options});
let passed=0,failed=0;
async function test(name, fn){try {await fn(); passed++;console.log(`PASS ${passed}: ${name}`)}catch(e){failed++;console.error(`FAIL ${name}:`,e)}}
await test('Lifecycle helper parses as TypeScript',()=>assert.equal(ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0));
await test('Attendance UI parses as TSX',()=>assert.equal(ts.createSourceFile('AttendancePreview.tsx',ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0));
await test('Valid 2s fix avoids a redundant GPS search',()=>assert.equal(shouldRefreshGpsOnForeground(state()),false));
await test('Valid 8s fix remains usable',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(GPS_FOREGROUND_REUSE_MS)})),false));
await test('9s fix triggers a new hardware reading on return',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(9000)})),true));
await test('GPS older than 15 seconds must be revalidated',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(16_000)})),true));
await test('No fix triggers GPS on foreground',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:null})),true));
await test('Low-quality GPS 85m triggers refinement',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(1000,85)})),true));
await test('Accuracy exactly 50m can be reused',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(1000,50)})),false));
await test('Invalid accuracy cannot be reused',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(1000,0)})),true));
await test('Invalid coordinates cannot be reused',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:{...loc(1000),latitude:100}})),true));
await test('Far-future timestamp cannot be reused',()=>assert.equal(shouldRefreshGpsOnForeground(state({position:loc(-8_000)})),true));
await test('No GPS search while document hidden',()=>assert.equal(shouldRefreshGpsOnForeground(state({visible:false,position:null})),false));
await test('No GPS search on Riwayat tab',()=>assert.equal(shouldRefreshGpsOnForeground(state({activeTab:'riwayat',position:null})),false));
await test('No GPS until school settings load',()=>assert.equal(shouldRefreshGpsOnForeground(state({settingsReady:false,position:null})),false));
await test('No GPS with invalid school geofence',()=>assert.equal(shouldRefreshGpsOnForeground(state({validSchoolLocation:false,position:null})),false));
await test('No GPS while the camera or submission is busy',()=>assert.equal(shouldRefreshGpsOnForeground(state({busy:true,position:null})),false));
await test('No GPS while a search is already in progress',()=>assert.equal(shouldRefreshGpsOnForeground(state({locating:true,position:null})),false));
await test('Burst of pageshow/focus events is deduplicated',()=>assert.equal(shouldRefreshGpsOnForeground(state({lastAttemptAt:now-100,position:null})),false));
await test('Another attempt allowed after 1.5s window',()=>assert.equal(shouldRefreshGpsOnForeground(state({lastAttemptAt:now-GPS_FOREGROUND_DEDUPE_MS,position:null})),true));
await test('Pause resets the throttle so a resumed browser may search immediately',()=>assert.match(ui,/lastForegroundGpsAttemptRef\.current\s*=\s*0/));
await test('visibilitychange, focus, pageshow, pagehide are all wired',()=>{
 for(const event of ['visibilitychange','focus','pageshow','pagehide']){
  assert.match(ui,new RegExp(`addEventListener\\('${event}'`));
  assert.match(ui,new RegExp(`removeEventListener\\('${event}'`));
 }
});
await test('Pause cancels stale shared GPS only outside critical attendance/camera work',()=>{
 assert.match(ui,/if \(state\.busy\) return;\s*\/\/ Do not interrupt Check-In\/Check-Out or camera/);
 assert.match(ui,/LocationService\.cancelCurrentSearch\(\)/);
 assert.match(ui,/\+\+gpsRequestRef\.current;\s*\/\/ Ignore callbacks/);
});
await test('Resume requires a new browser GPS fix; not a stale cached result',()=>{
 assert.match(ui,/void state\.refresh\(false, true\)/);
 assert.match(ui,/forceFresh: isManual \|\| requireNewFix/);
});
await test('History tab does not trigger its own GPS search',()=>assert.match(ui,/activeTab === 'presensi' && settingsReady && validSchoolLocation/));
await test('Presensi tab reuse retains valid GPS under eight seconds',()=>assert.match(ui,/LocationService\.isFreshPosition\(coords, 8_000\)/));
await test('UX message is compact, screen-reader status, and no extra animation',()=>{
 assert.match(ui,/attendance-gps-resume-note.*role="status" aria-live="polite"/);
 assert.match(css,/\.attendance-gps-resume-note/);
 assert.doesNotMatch(css.split('.attendance-gps-resume-note').pop().split('}')[0],/animation:/);
});
await test('R95 auto-guide and R104-B shared search remain integrated',()=>{
 assert.match(ui,/shouldGuideToSelfie\(/);
 assert.match(ui,/LocationService\.getCurrentPosition\(/);
 assert.match(ui,/onProgress: \(pos, isProv\)/);
});
await test('Never auto-submit or automatically open camera on GPS resume',()=>{
 const resume=ui.split('const resume = () => {')[1].split('const onVisibility')[0];
 assert.doesNotMatch(resume,/handleCheckIn|handleCheckOut|setIsCameraModalOpen\(true\)/);
});
console.log(`R104-C: ${passed}/${passed+failed} PASS`);
if(failed) process.exitCode=1;
