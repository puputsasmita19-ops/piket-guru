#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const os = require('node:os');
const root = process.cwd();
const reports = fs.readFileSync(path.join(root,'src/features/reports/ReportsPreview.tsx'),'utf8');
const hook = fs.readFileSync(path.join(root,'src/services/multitab/useR86E2ReportLive.ts'),'utf8');
const peer = fs.readFileSync(path.join(root,'src/services/multitab/r86e2ReportPilot.ts'),'utf8');
const installer = path.join(root, 'scripts/apply_r86e2_safe.cjs');
let pass=0;
const check=(name,fn)=>{try{fn();pass++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}};
const must=(label,text,regexp)=>check(label,()=>assert.match(text,regexp));
check('R86-E2 marker is installed only once',()=>assert.equal(reports.split('R86-E2: report-only controlled optimization pilot').length-1,1));
check('Seven original operational report listeners retained',()=>{
 const start=reports.indexOf('// Operational Data Subscriptions bounded strictly by computed date range');
 const end=reports.indexOf('}, [startDate, endDate, reportRealtimeEnabled]);',start);
 assert.ok(start>=0 && end>start);assert.equal((reports.slice(start,end).match(/FirestoreService\.subscribeToCollection/g)||[]).length,7);
});
must('Operational effect re-subscribes on visibility pilot change',reports,/\[startDate, endDate, reportRealtimeEnabled\]/);
must('Suspension retains loading state until new snapshots arrive',reports,/if \(!reportRealtimeEnabled\) \{ setIsLoadingData\(true\); return; \}/);
must('Guard protects Word/PDF export',reports,/isExportingDocument \|\| isReportActionsOpen/);
must('Guard protects printing modals',reports,/isPrintModalOpen \|\| isPhotoRecapPrintOpen/);
must('Guard protects pending review and photo server writes',reports,/bulkReviewBusy \|\| bulkReviewItems\.length > 0 \|\| visitorPhotoMoveBusy/);
must('Guard protects photo review modal',reports,/watermarkReviewBusy \|\| previewPhotoItem !== null/);
must('Master subscriptions unchanged',reports,/const unsubSched = FirestoreService\.subscribeToCollection<ScheduleItem>\(/);
must('Firestore subscription cleanup retained',reports,/unsubAtt\(\);\s*unsubBooks\(\);\s*unsubInc\(\);\s*unsubTardy\(\);\s*unsubPermits\(\);\s*unsubSubs\(\);\s*unsubVisitors\(\);/);
must('Default off unless build flag explicitly enabled',hook,/VITE_R86E2_REPORTS_PILOT === 'enabled'/);
must('Second opt-in required in URL',hook,/get\('r86_e2_pilot'\) === '1'/);
must('Two-minute hidden grace',hook,/HIDDEN_GRACE_MS = 120_000/);
must('Availability of visible peer required',hook,/probe\?\.hasVisiblePeer\(\) \?\? false/);
must('Timer cancelled in effect cleanup',hook,/closed = true; cancel\(\); probe\?\.stop\(\)/);
must('Visibility recovery returns to live subscription',hook,/if \(!eligible\) \{ cancel\(\); setListening\(true\); return; \}/);
must('Peer channel only contains visibility information',peer,/tab: string;\s*visible: boolean;/);
must('No BroadcastChannel fails open',peer,/typeof BroadcastChannel === 'undefined'/);
must('Protocol handles BFCache pagehide/pageshow',peer,/addEventListener\('pagehide'/);
check('Pure suspension rule truth table (all 8 cases)',()=>{
 const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
 const compiled=ts.transpileModule(peer,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports',compiled)(exports);
 for(const h of [false,true])for(const p of [false,true])for(const w of [false,true])assert.equal(exports.canR86E2SuspendReport(h,p,w),h&&p&&!w);
});
check('Source TSX and both TS files parse',()=>{
 const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
 for(const [filename,s,kind] of [['ReportsPreview.tsx',reports,ts.ScriptKind.TSX],['useR86E2ReportLive.ts',hook,ts.ScriptKind.TS],['r86e2ReportPilot.ts',peer,ts.ScriptKind.TS]]){
   const parsed=ts.createSourceFile(filename,s,ts.ScriptTarget.Latest,true,kind);
   assert.equal(parsed.parseDiagnostics.length,0,filename+': '+parsed.parseDiagnostics.map(x=>x.messageText).join(','));
 }
});
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'r86e2-check-'));
try {
 const relative='src/features/reports/ReportsPreview.tsx';const dest=path.join(fixture,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});
 // Installer should safely reject unexpected files.
 fs.writeFileSync(dest,'export const ReportsPreview = () => null;');
 check('Installer rejects unrelated repository source',()=>{const r=cp.spawnSync(process.execPath,[installer,'--apply'],{cwd:fixture,encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(fs.readFileSync(dest,'utf8'),'export const ReportsPreview = () => null;');});
 const source=reports.replace("import { useR86E2ReportLive } from '../../services/multitab/useR86E2ReportLive';\n",'').replace(/\n  \/\/ R86-E2: report-only controlled optimization pilot \(read-only listeners\)[\s\S]*?\n  \);/, '').replace("    // When resuming the tab, keep report export controls in loading state until fresh snapshots arrive.\n    if (!reportRealtimeEnabled) { setIsLoadingData(true); return; }\n",'').replace('}, [startDate, endDate, reportRealtimeEnabled]);','}, [startDate, endDate]);').replace('\n\n\n  const openPhotoDetail', '\n\n  const openPhotoDetail');
 assert.ok(!source.includes('R86-E2: report-only'));
 fs.writeFileSync(dest,source);
 const old=fs.readFileSync(dest,'utf8');
 check('Dry-run does not mutate source',()=>{const r=cp.spawnSync(process.execPath,[installer],{cwd:fixture,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(dest,'utf8'),old);});
 check('Install and repeat are idempotent',()=>{for(let i=0;i<2;i++){const r=cp.spawnSync(process.execPath,[installer,'--apply'],{cwd:fixture,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}{ const got=fs.readFileSync(dest,'utf8'); if(got!==reports){let n=0;while(n<Math.min(got.length,reports.length)&&got[n]===reports[n])n++;throw new Error(`Installer output differs near offset ${n}: actual ${JSON.stringify(got.slice(n-45,n+110))} expected ${JSON.stringify(reports.slice(n-45,n+110))}`);} }});
}finally{fs.rmSync(fixture,{force:true,recursive:true});}
console.log(`R86-E2 controlled checks: ${pass}/24`);
if(pass!==24)process.exitCode=1;
