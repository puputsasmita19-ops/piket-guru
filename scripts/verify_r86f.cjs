#!/usr/bin/env node
'use strict';
/** Pure Node fixture tests for the R86-F release gate. No user project/source mutations. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'r86f_release_gate.cjs'),'utf8');
const paths={
 'src/main.tsx': `import App from './App.tsx';\n// R86-A: explicit opt-in diagnostic build AND URL flag\n// R86-B: visual-only coordination, staging opt-in\n// R86-C: safe listener metrics\n// R86-D: read-only session-resume and performance validation\n// R86-E3: opt-in local performance comparison\nif (import.meta.env.VITE_R86_LISTENER_AUDIT === 'enabled' && new URLSearchParams(location.search).get('r86_listener_audit') === '1'){}\nif (import.meta.env.VITE_R86E3_COMPARE === 'enabled' && new URLSearchParams(location.search).get('r86_e3_compare') === '1'){}\ncreateRoot(document.getElementById('root')!).render(<App />);`,
 'src/services/firebase/firestoreService.ts':'// R86-C: safe listener metrics',
 'src/services/notifications/notificationFeedService.ts':'// R86-C: safe listener metrics',
 'src/components/layout/NotificationBell.tsx':'// R86-C: safe listener metrics',
 'src/features/reports/ReportsPreview.tsx':'// R86-E2: report-only controlled optimization pilot\nconst reportRealtimeEnabled = true;\n// [startDate, endDate, reportRealtimeEnabled]',
 'src/services/multitab/useR86E2ReportLive.ts':'// r86_e2_pilot',
 ...Object.fromEntries([
  'src/services/diagnostics/r86TabAudit.ts',
  'src/services/multitab/r86bSafeTabCoordination.ts',
  'src/services/diagnostics/r86cListenerMetrics.ts',
  'src/services/diagnostics/r86dStabilityProbe.ts',
  'src/services/multitab/r86e2ReportPilot.ts',
  'src/services/diagnostics/r86e3PerformanceCapture.ts',
  'scripts/audit_r86e1_firestore_baseline.cjs',
  'scripts/compare_r86e3.cjs',
  'src/contexts/AuthContext.tsx',
  'src/services/auth/backgroundSession.ts',
  'src/services/offline/syncQueueService.ts',
  'src/services/firebase/sharedLiveSource.ts',
 ].map(s=>[s,'// test fixture, not production source']))
};
const caseIds=[
 'login_nama','login_id_nip','login_google_admin','session_timeout','trusted_device','shared_device',
 'account_switch_tabs','presensi_masuk','presensi_pulang','piket_draft_photo','offline_replay',
 'offline_multitab','report_resume','report_busy','notification_urgent','notification_multitab',
 'pwa_update_draft','tab_matrix','preview_production_flags','firestore_usage'
];
const automations=['npmCi','lint','build','r86a','r86b','r86c','r86d','r86e1','r86e2','r86e3'];
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r86f-fixture-'));
 for(const [name,body] of Object.entries(paths)){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);}
 const git=(args)=>cp.spawnSync('git',args,{cwd:root,encoding:'utf8'});
 assert.equal(git(['init','-q']).status,0);
 git(['config','user.email','test@example.invalid']);git(['config','user.name','R86F fixture']);
 git(['add','.']); assert.equal(git(['commit','-qm','test fixture']).status,0);
 const sha=git(['rev-parse','HEAD']).stdout.trim();
 const e3={schema:'piket-r86e3-comparison-v1',inputFiles:22,acceptedFiles:22,rejectedFiles:[],doesNotMeasureFirestoreBillableReads:true,doesNotProveDataIntegrityOrSessionValidity:true,scenarios:[1,2,3,5].map(n=>({tabCount:n,status:'READY_FOR_MANUAL_REVIEW',warnings:[],baseline:{fileCount:n},pilot:{fileCount:n}}))};
 const evidence={schema:'piket-r86f-evidence-v1',environment:'preview',gitCommit:sha,testedAt:'2026-10-26T04:00:00.000Z',reviewer:'Staging reviewer',browser:'Chrome desktop + Android Chrome',deployment:'Preview build fixture SHA',workload:'Demo dummy test data only',automation:Object.fromEntries(automations.map(k=>[k,{status:'PASS',evidence:'SYNTHETIC TEST LOG - NOT A REAL DEPLOYMENT'}])),tests:caseIds.map(id=>({id,status:'PASS',evidence:'SYNTHETIC TEST EVIDENCE - NOT A REAL DEPLOYMENT'})),releaseDecision:'APPROVED',approvedBy:'Synthetic release reviewer',approvalAt:'2026-10-26T06:00:00Z',approvalNote:'SYNTHETIC APPROVAL FOR UNIT TEST ONLY',pilotEnabledInProduction:false};
 function put(rel,json){const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(json,null,2));}
 put('artifacts/r86e3/results/summary.json',e3);put('artifacts/r86f/evidence.json',evidence);
 return {root,e3,evidence,put,sha};
}
function run(root,extra=[]){return cp.spawnSync(process.execPath,[path.join(__dirname,'r86f_release_gate.cjs'),'--root',root,...extra],{cwd:root,encoding:'utf8',timeout:10000});}
const tests=[];const t=(name,fn)=>tests.push([name,fn]);
t('Gate script syntax correct',()=>assert.equal(cp.spawnSync(process.execPath,['--check',path.join(__dirname,'r86f_release_gate.cjs')]).status,0));
t('Pure built-in Node.js imports, no Firebase SDK',()=>assert.doesNotMatch(src,/require\(['"](?:firebase|react|vite|typescript)|\bfetch\(|\bindexedDB\b|\blocalStorage\b|\bsignOut\(/));
t('Help works without a checkout',()=>{const r=run(process.cwd(),['--help']);assert.equal(r.status,0);assert.match(r.stdout,/--strict/);});
t('Incomplete E3 and missing evidence → NO-GO',()=>{const f=fixture();try{fs.rmSync(path.join(f.root,'artifacts'),{recursive:true,force:true});const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/NO-GO/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('No output file created unless --out requested',()=>{const f=fixture();try{const r=run(f.root,['--strict']);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.equal(fs.existsSync(path.join(f.root,'artifacts/r86f/results/summary.md')),false);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Fully populated synthetic fixture passes strict (test only)',()=>{const f=fixture();try{const r=run(f.root,['--strict']);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.match(r.stdout,/GO_FOR_SEPARATE_RELEASE_REVIEW/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject a required source missing marker',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.root,'src/features/reports/ReportsPreview.tsx'),'changed HEAD');const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/source:reports\/r86e2/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject E3 incomplete two-tab scenario',()=>{const f=fixture();try{f.e3.scenarios[1].pilot.fileCount=1;f.put('artifacts/r86e3/results/summary.json',f.e3);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/e3:2-tab/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject E3 warnings even if file count complete',()=>{const f=fixture();try{f.e3.scenarios[2].warnings=['DURATION_MISMATCH_OVER_20_PERCENT'];f.e3.scenarios[2].status='REVIEW_WARNINGS';f.put('artifacts/r86e3/results/summary.json',f.e3);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/e3:3-tab/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject Git SHA evidence mismatch',()=>{const f=fixture();try{f.evidence.gitCommit='a'.repeat(40);f.put('artifacts/r86f/evidence.json',f.evidence);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/evidence:commit/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject manual scenario skipped, despite all automation PASS',()=>{const f=fixture();try{f.evidence.tests[3].status='NOT_RUN';f.put('artifacts/r86f/evidence.json',f.evidence);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/manual:session_timeout/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject Production environment or enabled pilot',()=>{const f=fixture();try{f.evidence.environment='production';f.evidence.pilotEnabledInProduction=true;f.put('artifacts/r86f/evidence.json',f.evidence);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/evidence:environment/);assert.match(r.stdout,/approval:production-flag/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject dirty source regardless of matching old HEAD SHA',()=>{const f=fixture();try{fs.appendFileSync(path.join(f.root,'src/main.tsx'),'\n// edit not committed');const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/repo:clean/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject an untracked file outside artifacts',()=>{const f=fixture();try{fs.mkdirSync(path.join(f.root,'docs'),{recursive:true});fs.writeFileSync(path.join(f.root,'docs/new-unstaged.md'),'pending source');const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/repo:clean/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject missing explicit sign-off',()=>{const f=fixture();try{f.evidence.releaseDecision='PENDING';f.put('artifacts/r86f/evidence.json',f.evidence);const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/approval:decision/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Output folder isolated to artifacts; report schema and hash fields',()=>{const f=fixture();try{const r=run(f.root,['--strict','--out','artifacts/r86f/results']);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);const report=JSON.parse(fs.readFileSync(path.join(f.root,'artifacts/r86f/results/summary.json'),'utf8'));assert.equal(report.decision,'GO_FOR_SEPARATE_RELEASE_REVIEW');assert.equal(report.gitCommit,f.sha);assert.match(report.criticalFileHashes['src/services/offline/syncQueueService.ts'],/^[0-9a-f]{64}$/);assert(fs.existsSync(path.join(f.root,'artifacts/r86f/results/summary.md')));}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Refuse to write outside artifacts/',()=>{const f=fixture();try{const r=run(f.root,['--out','src/unsafe']);assert.equal(r.status,2);assert.equal(fs.existsSync(path.join(f.root,'src/unsafe')),false);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Read-only gate never modifies input source or evidence',()=>{const f=fixture();try{const p=path.join(f.root,'src/main.tsx');const before=fs.readFileSync(p,'utf8');const evidence=fs.readFileSync(path.join(f.root,'artifacts/r86f/evidence.json'),'utf8');const r=run(f.root,['--strict','--out','artifacts/r86f/results']);assert.equal(r.status,0);assert.equal(fs.readFileSync(p,'utf8'),before);assert.equal(fs.readFileSync(path.join(f.root,'artifacts/r86f/evidence.json'),'utf8'),evidence);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
t('Reject malformed JSON evidence safely',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.root,'artifacts/r86f/evidence.json'),'{oops');const r=run(f.root,['--strict']);assert.equal(r.status,2);assert.match(r.stdout,/evidence:input/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
let passed=0;for(const [name,fn] of tests){try{fn();passed++;console.log('PASS',name);}catch(e){process.exitCode=1;console.error('FAIL',name,'—',e.stack||e.message);}}
console.log(`R86-F: ${passed}/${tests.length} test PASS`);
