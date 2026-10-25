#!/usr/bin/env node
'use strict';
/** Fixtures are SYNTHETIC. Successful fixture does NOT approve Production. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const {FLAGS,normalizeFlag,getLocalDeclarations,review,md}=require('./r86g_release_readiness.cjs');
const fixtures=fs.mkdtempSync(path.join(os.tmpdir(),'r86g-fixture-'));
const root=path.join(fixtures,'repo');
fs.mkdirSync(root,{recursive:true});
function git(...args) {const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000}); assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function write(rel,s) {const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);}
function del(rel){const p=path.join(root,rel);if(fs.existsSync(p))fs.unlinkSync(p);}
function evidence() {
 const sha=git('rev-parse','HEAD');
 return {schema:'piket-r86g-release-evidence-v1',environment:'production',candidateCommit:sha,previewCommit:sha,
 previewDeployment:'preview-deployment-fixture-001',previewTestReport:'Synthetic R86-F fixture summary not real staging',
 reviewer:'Test reviewer',reviewedAt:new Date().toISOString(),productionEnvironmentReviewedBy:'Test reviewer',productionEnvironmentReviewedAt:new Date().toISOString(),productionEnvironmentEvidence:'Synthetic flags review fixture for test only',
 productionFlags:Object.fromEntries(FLAGS.map(x=>[x,{state:'ABSENT',evidence:'Synthetic absence evidence for fixture '+x}])),
 rollback:{previousStableCommit:'b'.repeat(40),previousStableDeployment:'stable-deployment-fixture-009',owner:'Test operator',procedureEvidence:'Test-only rollback runbook',preserveOfflineDrafts:true,preserveServerData:true},
 postDeploySmokeTestPlan:'Synthetic post deploy smoke scenario',incidentContact:'Synthetic incident contact',pilotEnabledInProduction:false,
 approval:{decision:'APPROVED',reviewer:'Test approver',approvedAt:new Date().toISOString(),evidence:'Synthetic approval test fixture, not production'}};
}
const tests=[];function test(name,fn){tests.push({name,fn});}
try {
 git('init','-q');git('config','user.email','test@invalid.example');git('config','user.name','Synthetic R86G Test');write('README.md','This is a synthetic fixture only.\n');git('add','README.md');git('commit','-q','-m','synthetic');
 const evPath=path.join(root,'artifacts/r86g/release-evidence.json');
 function put(ev){write('artifacts/r86g/release-evidence.json',JSON.stringify(ev,null,2));}
 function r(ev,opts={}){put(ev);return review(root,evPath,{skipR86F:true,...opts});}
 test('Six explicit R86 build-time flags are tracked',()=>assert.equal(FLAGS.length,6));
 test('Only explicit enabled and truthy flag variants are dangerous',()=>assert.deepEqual(['enabled','true','1','on'].map(normalizeFlag),['ON','ON','ON','ON']));
 test('Disabled variants are accepted',()=>assert.deepEqual(['disabled','false','0','off','','no'].map(normalizeFlag),Array(6).fill('OFF')));
 test('Unresolved CI/Vercel interpolation is classified UNKNOWN',()=>assert.equal(normalizeFlag('${R86_FLAG}'),'UNKNOWN'));
 test('Missing evidence never approves',()=>{let q=review(root,path.join(root,'missing.json'),{skipR86F:true});assert.equal(q.decision,'NO-GO');});
 test('Full synthetic evidence produces readiness for separate review (not deploy)',()=>{const q=r(evidence());assert.equal(q.decision,'READY_FOR_SEPARATE_DEPLOYMENT_APPROVAL');assert.equal(q.blocked,0);});
 test('Disabled flag declared in production env does not block',()=>{write('.env.production','VITE_R86E2_REPORTS_PILOT=disabled\n');git('add','.env.production');git('commit','-q','-m','safe production config');const q=r(evidence());assert.equal(q.decision,'READY_FOR_SEPARATE_DEPLOYMENT_APPROVAL');});
 test('Enabled flag in production env blocks and raw value is not written',()=>{write('.env.production','VITE_R86E2_REPORTS_PILOT=enabled\n');const q=r(evidence());assert.ok(q.checks.some(c=>c.id==='flags:local:VITE_R86E2_REPORTS_PILOT'&&c.status==='BLOCK'));assert.equal(JSON.stringify(q).includes('=enabled'),false);});
 test('Unknown interpolated env blocks',()=>{write('.env.production','VITE_R86E2_REPORTS_PILOT=${SOME_PROD_VARIABLE}\n');const q=r(evidence());assert.equal(q.decision,'NO-GO');});
 test('Duplicate safe+unsafe declarations block',()=>{write('.env.production','VITE_R86E2_REPORTS_PILOT=disabled\nVITE_R86E2_REPORTS_PILOT=enabled\n');const q=r(evidence());assert.equal(q.decision,'NO-GO');});
 test('Local overrides flagged in .env.local',()=>{write('.env.production','VITE_R86E2_REPORTS_PILOT=disabled\n');write('.env.local','VITE_R86_AUDIT=enabled # forbidden\n');const q=r(evidence());assert.ok(q.checks.some(c=>c.id==='flags:local:VITE_R86_AUDIT'&&c.status==='BLOCK'));});
 test('Vercel JSON env configuration gets checked',()=>{del('.env.local');write('vercel.json',JSON.stringify({build:{env:{VITE_R86_TAB_OPT:'enabled'}}}));const q=r(evidence());assert.ok(q.checks.some(c=>c.id==='flags:local:VITE_R86_TAB_OPT'&&c.status==='BLOCK'));});
 test('Mismatched Preview SHA blocks',()=>{del('vercel.json');write('.env.production','VITE_R86E2_REPORTS_PILOT=disabled\n');let e=evidence();e.previewCommit='d'.repeat(40);assert.equal(r(e).decision,'NO-GO');});
 test('Unreviewed Production flags block',()=>{let e=evidence();e.productionFlags.VITE_R86_TAB_OPT.state='NOT_CHECKED';assert.equal(r(e).decision,'NO-GO');});
 test('Unverified remote Production environment blocks',()=>{let e=evidence();e.productionEnvironmentEvidence='';assert.equal(r(e).decision,'NO-GO');});
 test('Rollback details required',()=>{let e=evidence();e.rollback.previousStableDeployment='';assert.equal(r(e).decision,'NO-GO');});
 test('Separate human approval required',()=>{let e=evidence();e.approval.decision='PENDING';assert.equal(r(e).decision,'NO-GO');});
 test('Production pilot explicitly ON blocks',()=>{let e=evidence();e.pilotEnabledInProduction=true;assert.equal(r(e).decision,'NO-GO');});
 test('Dirty repository blocks even when evidence is complete',()=>{write('UNCOMMITTED_FILE.txt','uncommitted');assert.equal(r(evidence()).decision,'NO-GO');del('UNCOMMITTED_FILE.txt');});
 test('Absent R86-F gate blocks without synthetic override',()=>{assert.equal(review(root,evPath).decision,'NO-GO');});
 test('Markdown report never contains synthetic fake env raw values',()=>{let e=evidence();r(e);const report=review(root,evPath,{skipR86F:true});assert.ok(md(report).includes('R86-G'));assert.equal(md(report).includes('${SOME_PROD_VARIABLE}'),false);});
 test('Without explicit --out, CLI creates no output files',()=>{const dest=path.join(root,'artifacts/r86g/results');const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'r86g_release_readiness.cjs'),'--root',root],{encoding:'utf8'});assert.equal(cmd.status,0);assert.equal(fs.existsSync(dest),false);});
 test('--strict rejects missing true R86-F gate, exit 2',()=>{const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'r86g_release_readiness.cjs'),'--root',root,'--strict'],{encoding:'utf8'});assert.equal(cmd.status,2);});
 test('Report files written only with --out',()=>{const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'r86g_release_readiness.cjs'),'--root',root,'--out','artifacts/r86g/results'],{encoding:'utf8'});assert.equal(cmd.status,0);assert.equal(fs.existsSync(path.join(root,'artifacts/r86g/results/summary.md')),true);});
 test('Escaping --out rejects writing outside root',()=>{const cmd=cp.spawnSync(process.execPath,[path.join(__dirname,'r86g_release_readiness.cjs'),'--root',root,'--out','../leak'],{encoding:'utf8'});assert.equal(cmd.status,2);});
 test('getLocalDeclarations includes source and flag but not raw env values',()=>{const f=getLocalDeclarations(root);assert.ok(f.every(x=>!Object.hasOwn(x,'rawValue')&&!Object.hasOwn(x,'value')));});
 let good=0;for(const t of tests){try{t.fn();good++;console.log('PASS',t.name);}catch(err){console.error('FAIL',t.name,err.stack||err.message);process.exitCode=1;}}
 console.log(`R86-G fixture tests: ${good}/${tests.length} PASS`);
} finally {fs.rmSync(fixtures,{recursive:true,force:true});}
