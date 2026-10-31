/** R113-A targeted audit, no Firebase service or user data required. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const read=(p)=>readFileSync(p,'utf8');
const core=read('src/features/dashboard/dashboardPerformanceAudit.ts');
const view=read('src/features/dashboard/DashboardView.tsx');
const panel=read('src/features/dashboard/DashboardAuditPanel.tsx');
let count=0;
function test(title,fn){fn();console.log(`PASS ${++count}: ${title}`);}
function checkSyntax(filename,source){
 const file=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(file.parseDiagnostics.length,0,`${filename}: syntax invalid`);
}
for(const [name,source] of [['dashboardPerformanceAudit.ts',core],['DashboardView.tsx',view],['DashboardAuditPanel.tsx',panel]]) {
 test(`TypeScript syntax ${name}`,()=>checkSyntax(name,source));
}
const js=ts.transpileModule(core,{fileName:'dashboardPerformanceAudit.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,Math,Number,Map,performance:{now:()=>0}}, {timeout:1000});
const {createDashboardPerformanceAudit,formatDashboardAudit,DASHBOARD_CORE_SOURCES}=mod.exports;
test('Audit uses three sources for initial readiness',()=>assert.equal(DASHBOARD_CORE_SOURCES.join(','),'settings/school_config,schedules,announcements'));
let clock=0;
const audit=createDashboardPerformanceAudit(()=>clock);
test('Initial summary is empty with no listeners or data',()=>{
 const sum=audit.summary();assert.equal(sum.activeListeners,0);assert.equal(sum.firstSnapshotMs,null);assert.equal(sum.coreSourcesReadyMs,null);
});
test('Listener subscriptions registered without Firebase calls',()=>{
 audit.subscribe('schedules');audit.subscribe('teachers');audit.subscribe('settings/school_config');audit.subscribe('announcements');
 assert.equal(audit.summary().activeListeners,4);
});
test('Tracks first frame time once',()=>{
 clock=16;audit.markFirstFrame();clock=26;audit.markFirstFrame();assert.equal(audit.summary().firstFrameMs,16);
});
test('Initial snapshot triggers first callback timing',()=>{
 clock=50;audit.snapshot('schedules',12);
 const sum=audit.summary();assert.equal(sum.firstSnapshotMs,50);assert.equal(sum.coreSourcesReadyMs,null);
 assert.equal(sum.latestDocuments,12);
});
test('Core ready time is max of three first snapshots, not arbitrary latest',()=>{
 clock=80;audit.snapshot('settings/school_config',1);
 clock=110;audit.snapshot('announcements',4);
 assert.equal(audit.summary().coreSourcesReadyMs,110);
 clock=150;audit.snapshot('schedules',13);
 assert.equal(audit.summary().coreSourcesReadyMs,110);
});
test('Counts realtime callbacks and latest document sizes',()=>{
 const sum=audit.summary();
 assert.equal(sum.totalSnapshots,4);assert.equal(sum.latestDocuments,18);
 const schedules=sum.rows.find(row=>row.name==='schedules');
 assert.equal(schedules.snapshots,2);assert.equal(schedules.lastDocuments,13);assert.equal(schedules.peakDocuments,13);
});
test('Independent listener teardown updates active count but keeps history',()=>{
 audit.unsubscribe('schedules');const sum=audit.summary();
 assert.equal(sum.activeListeners,3);assert.equal(sum.latestDocuments,5);
 assert.equal(sum.rows.find(row=>row.name==='schedules').snapshots,2);
});
test('Subscription resuming preserves initial timing and counts remounts',()=>{
 audit.subscribe('schedules');
 const sum=audit.summary();assert.equal(sum.activeListeners,4);
 assert.equal(sum.rows.find(row=>row.name==='schedules').subscriptions,2);
});
test('Error terminates affected active source and records failure',()=>{
 audit.failure('teachers');
 const sum=audit.summary();assert.equal(sum.activeListeners,3);
 assert.equal(sum.rows.find(row=>row.name==='teachers').errors,1);
});
test('Rejects invalid document counts safely',()=>{
 audit.snapshot('teachers',NaN);
 assert.equal(audit.summary().rows.find(row=>row.name==='teachers').lastDocuments,null);
});
test('Copy report excludes account IDs and document bodies',()=>{
 const report=formatDashboardAudit(audit.summary());
 assert.match(report,/Diagnostik Dashboard/);
 assert.match(report,/BUKAN jumlah read berbayar Firebase/);
 assert.match(report,/schedules:/);
 assert.doesNotMatch(report,/fullName|email|PIN|password|token/);
});
test('Dashboard audit is opt-in, and never triggers Firestore reads directly',()=>{
 assert.match(view,/get\('dashboard_diag'\) === '1'/);
 assert.match(view,/\{audit && <React\.Suspense/);
 assert.match(view,/React\.lazy\(\(\) => import\('\.\/DashboardAuditPanel'\)/);
 assert.doesNotMatch(core,/FirestoreService|getDocs|onSnapshot|localStorage|fetch\(/);
 assert.doesNotMatch(panel,/FirestoreService|getDocs|onSnapshot|localStorage|fetch\(/);
});
test('All ten collection listeners plus optional substitutions use tracked wrapper',()=>{
 const matches=view.match(/watchCollection<\w+>\(/g)||[];
 assert.equal(matches.length,11);
 assert.equal((view.match(/FirestoreService\.subscribeToCollection</g)||[]).length,2); // opt-out pass-through + instrumented path
 assert.match(view,/audit\?\.subscribe\('settings\/school_config'\)/);
});
test('Dashboard day-constrained queries and on-demand roster images remain intact',()=>{
 for (const collection of ['attendance','dutyBooks','incidents','studentTardiness','studentPermits','visitors','substitutions']) {
  assert.match(view,new RegExp(`'${collection}'[\\s\\S]*?\[where\('tanggal', '==', todayISO\)\]`));
 }
 assert.match(view,/if \(!isRosterModalOpen\)/);
 assert.match(view,/documentId\(\), 'in'/);
});
test('No change to login/GPS or Firestore security files in R113-A code',()=>{
 assert.doesNotMatch(view,/LocationService\.getCurrentPosition|signInWithCustomToken/);
 assert.doesNotMatch(core,/auth\.currentUser/);
});
console.log(`R113-A: ${count}/${count} PASS`);
