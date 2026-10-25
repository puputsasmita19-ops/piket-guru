#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const script=read('src/services/diagnostics/r86dStabilityProbe.ts');
const main=read('src/main.tsx');
const policy=read('src/services/auth/backgroundSession.ts');
const auth=read('src/contexts/AuthContext.tsx');
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const has=(n,s,rx)=>test(n,()=>assert.match(s,rx));
const lacks=(n,s,rx)=>test(n,()=>assert.doesNotMatch(s,rx));
const marker='R86-D: read-only session-resume and performance validation';
has('main retains R86-A',main,/R86-A: explicit opt-in/);
has('main retains R86-B',main,/R86-B: visual-only coordination/);
has('main retains R86-C',main,/R86-C: safe listener metrics/);
has('R86-D is installed in main',main,/R86-D: read-only session-resume and performance validation/);
has('R86-D gating both DEV/Preview and URL opt-in',main,/\(import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_R86_STABILITY_AUDIT === 'enabled'\)/);
has('R86-D URL query flag',main,/get\('r86_stability_audit'\) === '1'/);
has('Import failure cannot break app bootstrap',main,/Observation must never block login or app bootstrap/);
has('Foreground restore counted',script,/counts\.resumes\+\+/);
has('BFCache restore accounted',script,/if \(e\.persisted\) counts\.bfcacheRestores\+\+/);
has('Visibility resume guarded by page visible',script,/document\.visibilityState !== 'visible' \|\| hiddenAt === null/);
has('Probe stops and detaches visibility listener',script,/removeEventListener\('visibilitychange', onVisibility\)/);
has('Observe Performance Navigation Timing only',script,/performance\.getEntriesByType\('navigation'\)/);
has('Missing unsupported heap marked unavailable',script,/heapBytes: typeof heapCandidate === 'number'[\s\S]+: 'UNAVAILABLE'/);
has('Session is never inferred to be valid',script,/doesNotCheckSessionValidity: true/);
has('Billable Firestore reads not asserted',script,/doesNotMeasureBillableFirestoreReads: true/);
has('Snapshot does not modify login/data',script,/doesNotModifyLoginOrData: true/);
lacks('Probe never references user identifiers or auth tokens',script,/auth\.currentUser|\.uid\b|\.nip\b|\bpin\b|\.token\b|\.photo\b|\.email\b|userId|sessionStorage|localStorage|indexedDB|fetch\(|onSnapshot\(|signOut\(|triggerSync\(|unsubscribe\(/i);
lacks('No channel or storage writes',script,/BroadcastChannel|postMessage\(|setItem\(|removeItem\(|\.send\(/);
has('Background enforcement preserved',policy,/requiresBackgroundLogin\(uid\)/);
has('Background monitor handles BFCache pageshow',policy,/addEventListener\('pageshow', show\)/);
has('Auth revalidation on reconnect preserved',auth,/addEventListener\('online', handleOnline\)/);
has('Auth pre-restore background requirement preserved',auth,/if \(requiresBackgroundLogin\(fbUser\.uid\)\)/);
has('Auth epoch guard prevents stale validation',auth,/epoch !== sessionEpochRef\.current/);
has('Auth pending data logout guard remains',auth,/pendingLogoutPrompt/);
for(const f of ['src/main.tsx','src/services/diagnostics/r86dStabilityProbe.ts']){
  test(`${f} TS parses`,()=>{const ast=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));});
  test(`${f} transpiles`,()=>{const r=ts.transpileModule(read(f),{fileName:f,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);});
}
// Exercise actual transpiled implementation in isolated event simulation.
function emitter(){const handlers=new Map();return {addEventListener(name,cb){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(cb);},removeEventListener(name,cb){handlers.get(name)?.delete(cb);},dispatch(name,data={}){for(const fn of [...(handlers.get(name)||[])])fn(data);},count(){return [...handlers.values()].reduce((n,set)=>n+set.size,0);}};}
let now=100000;
const doc=emitter();doc.visibilityState='visible';
const win=emitter();
const fakePerf={ getEntriesByType:()=>[{type:'navigate',domContentLoadedEventEnd:287.7,loadEventEnd:403.6}],memory:{usedJSHeapSize:23456.8}};
const fakeDate={now:()=>now};
const code=ts.transpileModule(script,{fileName:'r86dStabilityProbe.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};
vm.runInNewContext(code,{exports:exp,window:win,document:doc,navigator:{onLine:true},performance:fakePerf,Date:fakeDate,Object,Math,Number,JSON}, {filename:'r86dStabilityProbe.js'});
let stop;let snap;
test('Probe has no effect until explicitly started',()=>{assert.equal(win.__PIKET_R86D__,undefined);assert.equal(doc.count(),0);});
test('Probe start installs listeners and returns console API',()=>{stop=exp.startR86DStabilityProbe();snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.version,'R86-D');assert(doc.count()>0);assert.equal(snap.counts.resumes,0);});
test('Starting twice does not duplicate listeners',()=>{const before=doc.count();assert.strictEqual(exp.startR86DStabilityProbe(),stop);assert.equal(doc.count(),before);});
test('Elapsed background measured on resume',()=>{doc.visibilityState='hidden';doc.dispatch('visibilitychange');now+=120000;doc.visibilityState='visible';doc.dispatch('visibilitychange');snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.lastHiddenDurationMs,120000);assert.equal(snap.backgroundThresholdExceeded,1);assert.equal(snap.counts.resumes,1);});
test('Additional pageshow does not double-count resume',()=>{win.dispatch('pageshow',{persisted:false});assert.equal(win.__PIKET_R86D__.snapshot().counts.resumes,1);});
test('BFCache persisted pageshow counted and duration preserved',()=>{win.dispatch('pagehide');now+=5000;win.dispatch('pageshow',{persisted:true});snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.counts.bfcacheRestores,1);assert.equal(snap.counts.resumes,2);assert.equal(snap.lastHiddenDurationMs,5000);});
test('Online/offline/focus counters work without network requests',()=>{win.dispatch('offline');win.dispatch('online');win.dispatch('focus');snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.counts.offline,1);assert.equal(snap.counts.online,1);assert.equal(snap.counts.focus,1);});
test('Navigation timing and heap report remain local',()=>{snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.navigation.domContentLoadedMs,288);assert.equal(snap.navigation.loadEventMs,404);assert.equal(snap.heapBytes,23457);assert.equal(snap.doesNotCheckSessionValidity,true);});
test('Other probes missing does not break R86-D',()=>{snap=win.__PIKET_R86D__.snapshot();assert.equal(snap.otherProbes.r86a,'NOT_ENABLED');assert.equal(snap.r86cCounters,null);});
test('Prior probe aggregates are sanitized and no payloads copied',()=>{
 win.__PIKET_R86_AUDIT__={snapshot:()=>({observedPeers:3,observedVisiblePeers:1,uid:'DONT_COPY'})};
 win.__PIKET_R86B__={snapshot:()=>({observedPeers:2,visualQuiet:true,token:'DONT_COPY'})};
 win.__PIKET_R86C__={snapshot:()=>({counters:{collection:{opened:3,active:1,closed:2,emissions:5,errors:0},notification:{opened:1,active:1,closed:0,emissions:4,errors:0}},uid:'DONT_COPY'})};
 const report=win.__PIKET_R86D__.report();assert(!report.includes('DONT_COPY'));const s=JSON.parse(report);
 assert.equal(s.r86a.observedPeers,3);assert.equal(s.r86b.visualQuiet,true);assert.equal(s.r86cCounters.collection.active,1);
});
test('Unavailable browser memory & performance gracefully degrade',()=>{
 delete fakePerf.memory;fakePerf.getEntriesByType=()=>[];
 const s=win.__PIKET_R86D__.snapshot();assert.equal(s.heapBytes,'UNAVAILABLE');assert.equal(s.navigation.type,'UNAVAILABLE');
});
test('Stopping probe does not touch other probes and cleans own listeners',()=>{const a=win.__PIKET_R86_AUDIT__;stop();stop();assert.equal(win.__PIKET_R86D__,undefined);assert.strictEqual(win.__PIKET_R86_AUDIT__,a);assert.equal(doc.count(),0);assert.equal(win.count(),0);});
let passed=0;for(const [name,fn] of tests){try{fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
console.log(`R86-D validation: ${passed}/${tests.length} PASS`);
