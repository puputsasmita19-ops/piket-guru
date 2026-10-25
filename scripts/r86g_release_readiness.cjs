#!/usr/bin/env node
'use strict';
/**
 * Piket Guru R86-G — local production readiness REVIEW ONLY.
 * No network/Firebase, no mutation of app source, no deployment.
 * Reports only with explicit --out within artifacts/.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const FLAGS = Object.freeze([
  'VITE_R86_AUDIT',
  'VITE_R86_TAB_OPT',
  'VITE_R86_LISTENER_AUDIT',
  'VITE_R86_STABILITY_AUDIT',
  'VITE_R86E2_REPORTS_PILOT',
  'VITE_R86E3_COMPARE',
]);
const ENV_FILES = Object.freeze(['.env', '.env.local', '.env.production', '.env.production.local']);
const SCHEMA = 'piket-r86g-readiness-v1';
const EVIDENCE_SCHEMA = 'piket-r86g-release-evidence-v1';
function existsFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function limitedJSON(p) {
  if (!existsFile(p)) return null;
  if (fs.statSync(p).size > 256*1024) throw new Error('JSON terlalu besar (>256KB)');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function gitCmd(root, args) {
  const r=cp.spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:5000,windowsHide:true});
  return r.status===0 ? r.stdout.trim() : null;
}
function normalizeFlag(raw) {
  if (typeof raw !== 'string') return 'UNKNOWN';
  const s=raw.trim().replace(/\s+#.*$/,'').trim().replace(/^(['"])(.*)\1$/, '$2').trim().toLowerCase();
  if (s==='enabled' || s==='true' || s==='1' || s==='on') return 'ON';
  if (s==='' || ['false','0','off','disabled','no'].includes(s)) return 'OFF';
  return 'UNKNOWN';
}
function getLocalDeclarations(root) {
  const found=[];
  for (const filename of ENV_FILES) {
    const p=path.join(root,filename);
    if (!existsFile(p)) continue;
    const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
    for (let i=0;i<lines.length;i++) {
      const match=lines[i].match(/^\s*(?:export\s+)?(VITE_R86[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && FLAGS.includes(match[1])) found.push({source:filename,line:i+1,flag:match[1],state:normalizeFlag(match[2])});
    }
  }
  const v=path.join(root,'vercel.json');
  if (existsFile(v)) {
    const obj=limitedJSON(v);
    const visit=(n,parent='')=>{
      if(!n || typeof n!=='object') return;
      for(const [k,val] of Object.entries(n)) {
        if (FLAGS.includes(k)) found.push({source:'vercel.json:'+parent,flag:k,state:normalizeFlag(String(val))});
        else if(val && typeof val==='object') visit(val,parent ? parent+'.'+k:k);
      }
    };
    visit(obj);
  }
  return found;
}
function safeString(v,min=3,max=500) { return typeof v==='string' && v.trim().length>=min && v.trim().length<=max; }
function sha(v) { return typeof v==='string' && /^[a-f0-9]{40}$/.test(v); }
function dateValid(v) { return typeof v==='string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v); }
function hasEvidence(v) { return safeString(v,6,500); }
function cleanLabel(v) { return String(v).replace(/[\r\n|<>]/g,' ').slice(0,180); }
function relativeWithin(root, candidate) {
  const resolved = path.resolve(root,candidate);
  const rel=path.relative(root,resolved);
  return rel && !rel.startsWith('..'+path.sep) && rel!=='..' && !path.isAbsolute(rel) ? resolved : null;
}
function runStrictF(root) {
  const f=path.join(root,'scripts','r86f_release_gate.cjs');
  if (!existsFile(f)) return {pass:false, detail:'Skrip gate R86-F tidak ditemukan'};
  const r=cp.spawnSync(process.execPath,[f,'--root',root,'--strict'],{encoding:'utf8',timeout:20000,windowsHide:true,maxBuffer:256*1024});
  return {pass:r.status===0 && /^R86-F: GO_FOR_SEPARATE_RELEASE_REVIEW\b/m.test(r.stdout||''), detail:r.status===0?'Gate R86-F strict mengizinkan review rilis':'Gate R86-F strict belum lulus / bukti E3 belum lengkap'};
}
function review(root, evidencePath, opts={}) {
  const checks=[];
  const add=(id,pass,message)=>checks.push({id,status:pass?'PASS':'BLOCK',message});
  const commit=gitCmd(root,['rev-parse','HEAD']);
  const validCommit=sha(commit);
  add('repo:commit',validCommit,'SHA commit checkout lokal '+(validCommit?'terbaca':'belum tersedia'));
  const status=gitCmd(root,['status','--porcelain=v1','--untracked-files=normal']);
  const changes = status===null?null:status.split(/\r?\n/).filter(Boolean).map(x=>x.slice(3).replace(/^"|"$/g,'')).filter(s=>s!=='artifacts' && !s.startsWith('artifacts/'));
  add('repo:clean',changes!==null && changes.length===0,changes===null?'Git status tidak tersedia':`${changes.length} perubahan/untracked di luar artifacts/`);
  let localFlags=[];
  try {localFlags=getLocalDeclarations(root);add('flags:local-parse',true,'Konfigurasi lokal terkait R86 dibaca tanpa mencetak nilai mentah');}
  catch(err) {add('flags:local-parse',false,'Konfigurasi lokal tidak dapat dibaca: '+err.message);}
  for(const flag of FLAGS){
    const declarations=localFlags.filter(f=>f.flag===flag);
    add('flags:local:'+flag,declarations.every(v=>v.state==='OFF'),declarations.length ? `${declarations.length} deklarasi lokal; ${declarations.filter(x=>x.state!=='OFF').length} berisiko/tidak diketahui` : 'Tidak ditemukan deklarasi lokal');
  }
  add('flags:environment-visibility',true,'File lokal tidak membuktikan variabel build Vercel Production; bukti dashboard wajib');
  const f = opts.skipR86F ? {pass:true,detail:'SIMULATED: gate R86-F (fixture tests only)'} : runStrictF(root);
  add('r86f:strict',f.pass,f.detail);
  let e=null;
  try { e=limitedJSON(evidencePath); }
  catch(err) {add('evidence:json',false,'Bukti rilis gagal dibaca: '+err.message);}
  if(!e){add('evidence:present',false,'Bukti rilis R86-G belum tersedia atau JSON tidak valid');}
  else {
    add('evidence:schema',e.schema===EVIDENCE_SCHEMA,'Schema bukti harus '+EVIDENCE_SCHEMA);
    add('evidence:production',e.environment==='production','Target harus Production; pengujian tetap dari Preview');
    add('evidence:commit',validCommit && e.candidateCommit===commit && e.previewCommit===commit,'Commit checkout, kandidat rilis, dan Vercel Preview harus sama');
    add('evidence:preview-deployment',hasEvidence(e.previewDeployment)&&hasEvidence(e.previewTestReport),'Referensi Preview dan laporan staging harus ada');
    add('evidence:reviewer',safeString(e.reviewer)&&dateValid(e.reviewedAt),'Nama penanggung jawab review dan waktu review harus ada');
    add('evidence:production-flags-review',safeString(e.productionEnvironmentReviewedBy)&&dateValid(e.productionEnvironmentReviewedAt)&&hasEvidence(e.productionEnvironmentEvidence),'Wajib bukti review variabel Production di dashboard Vercel');
    for(const flag of FLAGS){
      const entry=e.productionFlags?.[flag];
      add('flags:production:'+flag,entry && (entry.state==='ABSENT'||entry.state==='DISABLED') && hasEvidence(entry.evidence),entry?'Status Production harus ABSENT/DISABLED dengan rujukan bukti':'Status Production belum dicatat');
    }
    const rb=e.rollback||{};
    add('rollback:stable-release',sha(rb.previousStableCommit)&&rb.previousStableCommit!==commit&&hasEvidence(rb.previousStableDeployment),'Commit dan deployment stabil sebelumnya wajib diketahui');
    add('rollback:owner-and-plan',safeString(rb.owner)&&hasEvidence(rb.procedureEvidence)&&rb.preserveOfflineDrafts===true&&rb.preserveServerData===true,'Pemilik rollback, prosedur, dan perlindungan data wajib dikonfirmasi');
    const a=e.approval||{};
    add('approval:human',a.decision==='APPROVED'&&safeString(a.reviewer)&&dateValid(a.approvedAt)&&hasEvidence(a.evidence),'Persetujuan manusia tertulis diperlukan; tidak ada auto-deploy');
    add('approval:no-force-pilot',e.pilotEnabledInProduction===false,'Pilot E2 harus OFF pada Production');
    add('approval:smoke-plan',hasEvidence(e.postDeploySmokeTestPlan)&&hasEvidence(e.incidentContact),'Wajib rencana smoke test dan kontak penanganan insiden');
  }
  const blocked=checks.filter(c=>c.status==='BLOCK');
  const result={schema:SCHEMA,createdAt:new Date().toISOString(),gitCommit:validCommit?commit:null,decision:blocked.length?'NO-GO':'READY_FOR_SEPARATE_DEPLOYMENT_APPROVAL',passed:checks.length-blocked.length,blocked:blocked.length,checks,localFlags,limits:['Pemeriksaan ini tidak memverifikasi environment Vercel secara langsung.','Status rilis didasarkan pada laporan dan bukti review manusia.','Tidak ada operasi deploy, rollback, atau perubahan Firebase.','Pemeriksaan listener/callback bukan bukti penghematan billed reads.']};
  return result;
}
function md(report) {
  const s=['# Piket Guru R86-G — Production Readiness','','**'+report.decision+'**','','- Git HEAD: `'+(report.gitCommit||'UNVERIFIED')+'`','- Checks: '+report.passed+'/'+report.checks.length+' PASS; '+report.blocked+' BLOCK','- Generated (UTC): '+report.createdAt,'','## Pemeriksaan','', '| ID | Status | Ringkasan |','|---|---|---|'];
  report.checks.forEach(c=>s.push('| '+cleanLabel(c.id)+' | '+c.status+' | '+cleanLabel(c.message)+' |'));
  s.push('','## Batasan',...report.limits.map(x=>'- '+x),'','Jika NO-GO: jangan aktifkan flag pilot pada Production. Jangan membersihkan cache, IndexedDB, atau antrean offline sebagai langkah rollback.','');return s.join('\n');
}
function cli(argv) {
  const get=(name,fallback)=>{const i=argv.indexOf(name);if(i<0)return fallback;if(i===argv.length-1||argv[i+1].startsWith('--'))throw Error('Argumen kosong: '+name);return argv[i+1];};
  if(argv.includes('--help')||argv.includes('-h')){console.log('R86-G: node scripts/r86g_release_readiness.cjs [--root .] [--evidence artifacts/r86g/release-evidence.json] [--out artifacts/r86g/results] [--strict]');return 0;}
  const root=path.resolve(get('--root','.'));
  if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw Error('Root tidak ditemukan');
  const ev=relativeWithin(root,get('--evidence','artifacts/r86g/release-evidence.json'));
  if(!ev)throw Error('Bukti harus berada di bawah root repository');
  const report=review(root,ev);
  console.log(`R86-G: ${report.decision} | ${report.passed}/${report.checks.length} PASS | ${report.blocked} BLOCK`);
  for(const c of report.checks.filter(c=>c.status==='BLOCK').slice(0,15))console.log('BLOCK '+c.id+': '+c.message);
  if(report.blocked>15)console.log(`... ${report.blocked-15} BLOCK lainnya`);
  const out=get('--out',null);
  if(out){
    const destination=relativeWithin(root,out);
    if(!destination||!path.relative(root,destination).startsWith('artifacts'+path.sep))throw Error('--out hanya boleh berada di bawah artifacts/');
    if(destination===path.dirname(ev))throw Error('--out harus berbeda dari folder evidence');
    fs.mkdirSync(destination,{recursive:true});
    fs.writeFileSync(path.join(destination,'summary.json'),JSON.stringify(report,null,2)+'\n');
    fs.writeFileSync(path.join(destination,'summary.md'),md(report)+'\n');
    console.log('Laporan:',path.join(destination,'summary.md'));
  }
  return argv.includes('--strict')&&report.blocked?2:0;
}
if (require.main===module) { try {process.exitCode=cli(process.argv.slice(2));} catch(e){console.error('R86-G STOP:',e.message);process.exitCode=2;} }
module.exports={FLAGS,normalizeFlag,getLocalDeclarations,review,md,cli};
