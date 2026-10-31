/** R113-B2 — scheduler cancellation, callback deferral, audit fidelity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = p => readFileSync(p, 'utf8');
let tests = 0;
const check = (name, fn) => { fn(); console.log(`PASS ${++tests}: ${name}`); };
const scripts = [
 'src/features/dashboard/DashboardView.tsx',
 'src/features/dashboard/dashboardPerformanceAudit.ts',
 'src/features/dashboard/dashboardLoadingStabilizer.ts',
 'src/features/dashboard/DashboardAuditPanel.tsx',
 'src/features/dashboard/DashboardStatistics.tsx',
];
for (const filename of scripts) check(`${filename} TypeScript parses`, () => {
 const f = ts.createSourceFile(filename, read(filename), ts.ScriptTarget.Latest, true, filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
 assert.equal(f.parseDiagnostics.length, 0, f.parseDiagnostics.map(x => String(x.messageText)).join('; '));
});
function load(name) {
 const module = {exports: {}};
 const code = ts.transpileModule(read(name), {fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code, {module,exports:module.exports,Map,Set,Math,Number,performance:{now:()=>0}}, {filename:name,timeout:2500});
 return module.exports;
}
const {stageDashboardSecondaryListeners,DASHBOARD_SECONDARY_IDLE_TIMEOUT_MS} = load('src/features/dashboard/dashboardLoadingStabilizer.ts');
const {createDashboardPerformanceAudit,formatDashboardAudit,DASHBOARD_PERSONAL_SOURCES,DASHBOARD_INITIAL_SOURCES} = load('src/features/dashboard/dashboardPerformanceAudit.ts');
const createFakeScheduler = (idleSupported=true) => {
 const q = {raf:null, idle:null, timer:null, cancelRaf:0,cancelIdle:0,cancelTimer:0,timeout:null};
 let next = 0;
 const scheduler = {
  requestAnimationFrame(cb) { q.raf=cb; return ++next; },
  cancelAnimationFrame() { q.cancelRaf++;q.raf=null; },
  setTimeout(cb) { q.timer=cb;return ++next; },
  clearTimeout() { q.cancelTimer++;q.timer=null; },
 };
 if(idleSupported) {
  scheduler.requestIdleCallback=(cb,opts)=>{q.idle=cb;q.timeout=opts?.timeout;return ++next;};
  scheduler.cancelIdleCallback=()=>{q.cancelIdle++;q.idle=null;};
 }
 return {q,scheduler};
};
check('Scheduler waits for first animation frame instead of subscribing synchronously',()=>{
 const {q,scheduler}=createFakeScheduler();let starts=0;
 const stop=stageDashboardSecondaryListeners(()=>{starts++;return [()=>{}];},scheduler);
 assert.equal(starts,0);q.raf(0);assert.equal(starts,0);q.idle({didTimeout:false,timeRemaining:()=>20});assert.equal(starts,1);stop();
});
check('Idle timeout caps wait at 300ms',()=>{
 const {q,scheduler}=createFakeScheduler(); const stop=stageDashboardSecondaryListeners(()=>[],scheduler);
 q.raf(0);assert.equal(q.timeout,DASHBOARD_SECONDARY_IDLE_TIMEOUT_MS);assert.equal(q.timeout,300);stop();
});
check('Closing view before first paint cancels registration',()=>{
 const {q,scheduler}=createFakeScheduler();let count=0;
 const stop=stageDashboardSecondaryListeners(()=>{count++;return [];},scheduler);
 const frame=q.raf;stop();assert.equal(q.cancelRaf,1);frame?.(0);assert.equal(count,0);
});
check('Closing view during idle wait cancels registration',()=>{
 const {q,scheduler}=createFakeScheduler();let count=0;
 const stop=stageDashboardSecondaryListeners(()=>{count++;return [];},scheduler);
 q.raf(0); const idle=q.idle;stop();assert.equal(q.cancelIdle,1);idle?.({didTimeout:true,timeRemaining:()=>0});assert.equal(count,0);
});
check('Active observers are all released exactly once',()=>{
 const {q,scheduler}=createFakeScheduler();let released=0;
 const stop=stageDashboardSecondaryListeners(()=>[()=>released++,()=>released++,()=>released++],scheduler);
 q.raf(0);q.idle({didTimeout:false,timeRemaining:()=>5});stop();stop();assert.equal(released,3);
});
check('No requestIdleCallback still subscribes after a frame on fallback',()=>{
 const {q,scheduler}=createFakeScheduler(false);let started=0;
 const stop=stageDashboardSecondaryListeners(()=>{started++;return [];},scheduler);
 q.raf(0);assert.equal(started,0);q.timer();assert.equal(started,1);stop();
});
check('Fallback timer is cancelled on navigation/account switch',()=>{
 const {q,scheduler}=createFakeScheduler(false);let started=0;
 const stop=stageDashboardSecondaryListeners(()=>{started++;return [];},scheduler);
 q.raf(0);const timer=q.timer;stop();assert.equal(q.cancelTimer,1);timer();assert.equal(started,0);
});
const view=read('src/features/dashboard/DashboardView.tsx');
check('Priority subscriptions cover configuration, schedule, identity, attendance, bulletin, book and incidents',()=>{
 const stage=view.indexOf('const stopSecondary = stageDashboardSecondaryListeners');
 for (const name of ['schedules','teachers','staff','attendance','announcements','dutyBooks','incidents'])
  assert.ok(view.indexOf(`'${name}'`,view.indexOf('const unsubSched')) < stage, `${name} must be priority`);
});
check('Only secondary student and visitor observers are deferred',()=>{
 const stage=view.indexOf('const stopSecondary = stageDashboardSecondaryListeners');
 for (const name of ['studentTardiness','studentPermits','visitors'])
  assert.ok(view.indexOf(`'${name}'`,stage) > stage);
 assert.match(view,/return \[unsubTardy, unsubPermits, unsubVisitors\]/);
});
check('Secondary subscriptions retain exact date filters and scoped caches',()=>{
 for(const key of ['studentTardiness','studentPermits','visitors'])
  { const idx = view.indexOf("'"+key+"'", view.indexOf('const stopSecondary =')); const section = view.slice(idx, idx+400); assert.ok(section.includes("where('tanggal', '==', todayISO)")); assert.ok(section.includes('cacheKey:')); }
});
check('No extra backend reads or permission bypass in staging helper',()=>{
 const src=read('src/features/dashboard/dashboardLoadingStabilizer.ts');
 assert.doesNotMatch(src,/FirestoreService|getDocs|onSnapshot|fetch\(|login|GPS/);
});
check('Dashboard unmount stops secondary and primary observers',()=>{
 assert.match(view,/unsubAtt\(\);[\s\S]*?unsubAnn\(\);[\s\S]*?unsubBooks\(\);[\s\S]*?unsubInc\(\);[\s\S]*?stopSecondary\(\);/);
});
check('Render updates to optional dashboard statistics have lower priority',()=>{
 for(const setter of ['setStudentTardiness','setStudentPermits','setVisitors'])
 assert.ok(view.includes(`${setter}(data); markSecondaryStatus(`));
});
check('Audit retains historical metric and adds personal-core timing',()=>{
 assert.equal(DASHBOARD_PERSONAL_SOURCES.join(','),'settings/school_config,schedules,teachers:linked');
 assert.equal(DASHBOARD_INITIAL_SOURCES.length,11);
 let time=0;const a=createDashboardPerformanceAudit(()=>time);
 const mark=(name,t)=>{a.subscribe(name);time=t;a.snapshot(name,1);};
 mark('settings/school_config',100);mark('schedules',150);mark('teachers:linked',160);
 assert.equal(a.summary().personalSourcesReadyMs,160);
 assert.equal(a.summary().coreSourcesReadyMs,null);
 mark('announcements',300);
 assert.equal(a.summary().coreSourcesReadyMs,300);
 time=340;a.markSecondaryStart();a.markSecondaryStart();
 assert.equal(a.summary().secondarySubscriptionsStartedMs,340);
 for(const name of DASHBOARD_INITIAL_SOURCES) if(!a.summary().rows.some(row=>row.name===name))mark(name,410);
 assert.equal(a.summary().allInitialSourcesReadyMs,410);
 assert.ok(formatDashboardAudit(a.summary()).includes('server dari callback'));
});
check('Optional statistic cards display loading instead of an unverified zero',()=>{
 const stats=read('src/features/dashboard/DashboardStatistics.tsx');
 for(const key of ['tardy','permits','visitors']) assert.ok(view.includes(`sourceStatus('${key}') === undefined`));
 assert.match(stats,/const pending = loading \|\| item.loading/);
 assert.match(stats,/Belum tersambung/);
});
check('Performance panel stays opt-in, without additional queries or account identifiers',()=>{
 const panel=read('src/features/dashboard/DashboardAuditPanel.tsx');
 assert.match(view,/get\('dashboard_diag'\) === '1'/);
 assert.doesNotMatch(panel,/FirestoreService|getDocs|onSnapshot|document\.cookie/);
 assert.match(panel,/3 sumber personal siap/);
 assert.match(panel,/Semua sumber siap/);
});
console.log(`R113-B2 Dashboard Loading Stabilization: ${tests}/${tests} PASS`);
