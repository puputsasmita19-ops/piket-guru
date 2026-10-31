/** R112 focused tests: scoped GPS cancellation + instant valid UI navigation.
 * Simulated browser only; never claims actual handset GPS performance. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const read=(name)=>readFileSync(name,'utf8');
const service=read('src/services/location/locationService.ts');
const page=read('src/features/attendance/AttendancePreview.tsx');
const guide=read('src/features/attendance/selfieGpsGuide.ts');
const css=read('src/features/attendance/attendanceGps.css');
function tsOk(file,src){
 const parsed=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,`${file} syntax`);
 return ts.transpileModule(src,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
}
const js=tsOk('locationService.ts',service);
tsOk('AttendancePreview.tsx',page);tsOk('selfieGpsGuide.ts',guide);
const reading=(accuracy=20,tsNow=Date.now())=>({ timestamp:tsNow, coords:{latitude:-6,longitude:106,accuracy,altitude:null,speed:null} });
function setup(){
 const state={watch:0,clear:0,quick:0,success:null,progress:null};
 const geolocation={
  getCurrentPosition(cb){state.quick++;state.progress=cb;},
  watchPosition(cb){state.watch++;state.success=cb;return 42;},
  clearWatch(id){assert.equal(id,42);state.clear++;},
 };
 const memory={};
 const navigator={geolocation};
 const window={isSecureContext:true,sessionStorage:{getItem:k=>memory[k]??null,setItem:(k,v)=>{memory[k]=v;},removeItem:k=>{delete memory[k];}}};
 const mod={exports:{}};
 vm.runInNewContext(js,{module:mod,exports:mod.exports,navigator,window,console,Date,Math,Number,JSON,Infinity,Error,Promise,setTimeout,clearTimeout},{timeout:1500});
 return {GPS:mod.exports.LocationService,state};
}
let n=0;async function test(name,run){await run();console.log(`PASS ${++n}: ${name}`);}
await test('TypeScript GPS + attendance UI parse without errors',()=>assert.ok(js));
await test('Already aborted request creates no watcher',async()=>{
 const {GPS,state}=setup(),ac=new AbortController();ac.abort();
 await assert.rejects(GPS.getCurrentPosition({signal:ac.signal}),e=>e.name==='AbortError');
 assert.equal(state.watch,0);
});
await test('Aborting screen subscriber leaves prewarm subscriber alive',async()=>{
 const {GPS,state}=setup();const ac=new AbortController();
 const prewarm=GPS.getCurrentPosition({timeoutMs:600});
 const screen=GPS.getCurrentPosition({timeoutMs:600,signal:ac.signal});
 assert.equal(state.watch,1);ac.abort();
 await assert.rejects(screen,e=>e.name==='AbortError');
 assert.equal(state.clear,0);
 state.success(reading(32));
 assert.equal((await prewarm).accuracy,32);
 assert.equal(state.clear,1);
});
await test('Two independent aborts stop hardware exactly once',async()=>{
 const {GPS,state}=setup(),a=new AbortController(),b=new AbortController();
 const first=GPS.getCurrentPosition({timeoutMs:500,signal:a.signal});
 const second=GPS.getCurrentPosition({timeoutMs:500,signal:b.signal});
 a.abort();b.abort();
 await assert.rejects(first,e=>e.name==='AbortError');
 await assert.rejects(second,e=>e.name==='AbortError');
 assert.equal(state.clear,1);
});
await test('Settled subscriber ignores later abort and does not cancel new lookup',async()=>{
 const {GPS,state}=setup(),ac=new AbortController();
 const a=GPS.getCurrentPosition({timeoutMs:500,signal:ac.signal,forceFresh:true});
 state.success(reading());await a;
 const b=GPS.getCurrentPosition({timeoutMs:500,forceFresh:true});ac.abort();
 assert.equal(state.clear,1);state.success(reading());await b;
 assert.equal(state.clear,2);
});
await test('Provisional >50m never grants success and later 40m resolves immediately',async()=>{
 const {GPS,state}=setup(),updates=[];
 const promise=GPS.getCurrentPosition({timeoutMs:500,onProgress:(p,v)=>updates.push([p.accuracy,v])});
 state.progress(reading(85));
 assert.equal(GPS.lastValidPosition,null);
 state.success(reading(40));
 await promise;assert.deepEqual(updates,[[85,true],[40,false]]);
});
await test('Stale coordinates cannot be accepted as new fix',async()=>{
 const {GPS,state}=setup();const ac=new AbortController();
 const promise=GPS.getCurrentPosition({timeoutMs:500,forceFresh:true,signal:ac.signal});
 state.success(reading(10,Date.now()-40000));
 assert.equal(GPS.lastValidPosition,null);
 ac.abort();await assert.rejects(promise,e=>e.name==='AbortError');
});
await test('Official 300m geofence and 50m precision still hold',()=>{
 const {GPS}=setup();
 assert.equal(GPS.evaluateGeofence(-6.001,106,49,-6,106,300).status,'DALAM_LOKASI');
 assert.equal(GPS.evaluateGeofence(-6.001,106,75,-6,106,300).status,'AKURASI_RENDAH');
 assert.equal(GPS.evaluateGeofence(-6.004,106,20,-6,106,300).status,'DI_LUAR_LOKASI');
});
await test('Page passes its own signal to GPS engine',()=>{
 assert.match(page,/signal: requestController\.signal/);
 assert.match(page,/gpsScreenAbortRef\.current\?\.abort\(\)/);
});
await test('No screen use of global cancelCurrentSearch or clearCurrentWatcher',()=>{
 assert.doesNotMatch(page,/LocationService\.(cancelCurrentSearch|clearCurrentWatcher)\(/);
});
await test('Foreground recovery still coalesces focus, pageshow, visibilitychange',()=>{
 for (const e of ['focus','pageshow','visibilitychange']) assert.match(page,new RegExp(`addEventListener\\('${e}'`));
 assert.match(page,/shouldRefreshGpsOnForeground\(/);
});
await test('First valid fix displays within-radius independently of spinner',()=>{
 assert.match(page,/gpsConfirmedWithinRadius \? 'Dalam radius sekolah'/);
 assert.match(page,/isLocating && !gpsConfirmedWithinRadius \? 'gps-search-indicator'/);
});
await test('Selfie navigation uses animation frame rather than 160ms fixed delay',()=>{
 assert.match(page,/window\.requestAnimationFrame\(\(\) =>/);
 assert.doesNotMatch(page,/\}, 160\);/);
 assert.match(page,/target\.scrollIntoView/);
});
await test('Guidance only marks completion when button exists and page is visible',()=>{
 assert.match(page,/if \(!selfieTargetRef\.current \|\| !selfieTriggerRef\.current \|\| document\.hidden/);
 assert.match(page,/autoGuidedSelfieKeyRef\.current = key; \/\/ Mark only after guidance occurs/);
});
await test('Reduced motion and responsive next-action outline preserved',()=>{
 assert.match(page,/prefers-reduced-motion: reduce/);
 assert.match(css,/\.attendance-selfie-target\.is-gps-ready/);
 assert.match(css,/\.attendance-action-attention/);
});
await test('Does not auto-capture or auto-submit when location becomes valid',()=>{
 assert.match(page,/shouldGuideToSelfie\(/);
 assert.match(page,/prepareSelfieCapture/);
 assert.match(page,/handleCheckOut/);
 assert.doesNotMatch(page,/watchPosition\([^)]*handleCheckIn/);
});
console.log(`R112: ${n}/${n} PASS`);
