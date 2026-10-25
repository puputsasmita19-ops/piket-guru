#!/usr/bin/env node
'use strict';
/**
 * Piket Guru R86-F — offline, read-only final release gate.
 * No Firebase calls, user data, browser storage, authentication, or mutation of src.
 * Writes reports only with explicit --out, and cannot approve without human evidence.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const argv = process.argv.slice(2);
const usage = `R86-F — final regression gate (read-only)\n\n`+
`  node scripts/r86f_release_gate.cjs [--root .] [--e3 artifacts/r86e3/results/summary.json] \\\n\n`+
`      [--evidence artifacts/r86f/evidence.json] [--out artifacts/r86f/results] [--strict]\n\n`+
`--out writes only summary.json and summary.md to an explicit output folder.\n`+
`--strict returns exit 2 unless every required gate passes. No release is automatic.\n`;
if (argv.includes('--help') || argv.includes('-h')) { console.log(usage); process.exit(0); }
function flag(name, fallback) {
  const at = argv.indexOf(name);
  if (at === -1) return fallback;
  if (at === argv.length - 1 || argv[at+1].startsWith('--')) throw Error('Argumen kosong: '+name);
  return argv[at+1];
}
const root=path.resolve(flag('--root', process.cwd()));
function resolved(userPath) { return path.isAbsolute(userPath) ? path.resolve(userPath) : path.resolve(root,userPath); }
function readFile(rel) {const p=path.join(root,rel);return fs.existsSync(p)&&fs.statSync(p).isFile()?fs.readFileSync(p,'utf8'):null;}
function readJSON(p) { if (!fs.existsSync(p)) return null; const stat=fs.statSync(p); if (!stat.isFile()||stat.size>1024*1024) throw Error('Berkas JSON bukan file / >1MB: '+p); return JSON.parse(fs.readFileSync(p,'utf8')); }
function h(rel) {const p=path.join(root,rel);return fs.existsSync(p)&&fs.statSync(p).isFile()?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;}
function getCommit() { const r=cp.spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',timeout:3000,windowsHide:true});return r.status===0&&/^[0-9a-f]{40}$/.test(r.stdout.trim())?r.stdout.trim():null; }
function getRelevantGitChanges() {
 const r=cp.spawnSync('git',['-C',root,'status','--porcelain=v1','--untracked-files=normal'],{encoding:'utf8',timeout:3500,windowsHide:true});
 if(r.status!==0) return null;
 return r.stdout.split(/\r?\n/).filter(Boolean).map(line=>line.slice(3).trim())
  .filter(item=>!item.startsWith('artifacts/') && item!=='artifacts' && item!=='artifacts/' && !item.startsWith('"artifacts/'));
}

const CASES=[
 ['login_nama','Masuk dengan nama dan PIN'],
 ['login_id_nip','Masuk dengan ID/NIP dan PIN'],
 ['login_google_admin','Masuk Admin melalui Google'],
 ['session_timeout','Kedaluwarsa sesi sesuai kebijakan Admin'],
 ['trusted_device','Pemulihan sesi perangkat tepercaya'],
 ['shared_device','Perangkat bersama; tidak melewati validasi sesi'],
 ['account_switch_tabs','Beralih akun/log out di tab berbeda, tidak ada bocor sesi'],
 ['presensi_masuk','Presensi masuk tepat satu kali'],
 ['presensi_pulang','Presensi pulang tepat satu kali'],
 ['piket_draft_photo','Draf buku piket dan foto dipertahankan'],
 ['offline_replay','Antrean offline dikirim sekali saat koneksi pulih'],
 ['offline_multitab','Antrean offline aman saat beberapa tab dibuka'],
 ['report_resume','Data laporan mutakhir setelah tab kembali aktif'],
 ['report_busy','Ekspor/cetak/review foto tidak dipause'],
 ['notification_urgent','Notifikasi penting tetap masuk'],
 ['notification_multitab','Perilaku notifikasi antartab tanpa duplikasi tak diharapkan'],
 ['pwa_update_draft','Update PWA menjaga draf/antrean pending'],
 ['tab_matrix','Uji 1, 2, 3, 5 tab di browser nyata'],
 ['preview_production_flags','Flag audit/pilot hanya Preview; Production tetap OFF'],
 ['firestore_usage','Firebase Usage dibaca secara terpisah; bukan estimasi callback'],
];
const EXPECT=[
 ['main/r86a','src/main.tsx',/R86-A: explicit opt-in diagnostic build AND URL flag/],
 ['main/r86b','src/main.tsx',/R86-B: visual-only coordination, staging opt-in/],
 ['main/r86c','src/main.tsx',/R86-C: safe listener metrics/],
 ['main/r86d','src/main.tsx',/R86-D: read-only session-resume and performance validation/],
 ['main/r86e3','src/main.tsx',/R86-E3: opt-in local performance comparison/],
 ['firestore/r86c','src/services/firebase/firestoreService.ts',/R86-C: safe listener metrics/],
 ['notifications/r86c','src/services/notifications/notificationFeedService.ts',/R86-C: safe listener metrics/],
 ['notification-ui/r86c','src/components/layout/NotificationBell.tsx',/R86-C: safe listener metrics/],
 ['reports/r86e2','src/features/reports/ReportsPreview.tsx',/R86-E2: report-only controlled optimization pilot/],
 ['r86a/module','src/services/diagnostics/r86TabAudit.ts',null],
 ['r86b/module','src/services/multitab/r86bSafeTabCoordination.ts',null],
 ['r86c/module','src/services/diagnostics/r86cListenerMetrics.ts',null],
 ['r86d/module','src/services/diagnostics/r86dStabilityProbe.ts',null],
 ['r86e2/hook','src/services/multitab/useR86E2ReportLive.ts',null],
 ['r86e2/coord','src/services/multitab/r86e2ReportPilot.ts',null],
 ['r86e3/module','src/services/diagnostics/r86e3PerformanceCapture.ts',null],
 ['r86e1/audit','scripts/audit_r86e1_firestore_baseline.cjs',null],
 ['r86e3/compare','scripts/compare_r86e3.cjs',null],
 ['auth/context','src/contexts/AuthContext.tsx',null],
 ['auth/background','src/services/auth/backgroundSession.ts',null],
 ['offline/queue','src/services/offline/syncQueueService.ts',null],
 ['firestore/shared','src/services/firebase/sharedLiveSource.ts',null],
];
const checks=[];
function check(id, status, message) { checks.push({id,status,message}); }
function validString(v) { return typeof v==='string'&&v.trim().length>0&&v.trim().length<=1500; }
function sha(v){return typeof v==='string'&&/^[0-9a-f]{40}$/.test(v);}
function untrustedLabel(v){return String(v).replace(/[|\r\n\t]/g,' ').replace(/[<>]/g,'').slice(0,180);}
function sourceGate(){
 for(const [id,file,regex] of EXPECT){const s=readFile(file);check('source:'+id,!s?'BLOCK':regex&&!regex.test(s)?'BLOCK':'PASS',!s?'File tidak ditemukan':regex&&!regex.test(s)?'Marker/anchor belum ditemukan':'Tersedia');}
 const main=readFile('src/main.tsx');
 if(main){
  check('main:bootstrap',main.split("createRoot(document.getElementById('root')!).render(<App />);").length===2?'PASS':'BLOCK','Satu React root bootstrap terdeteksi');
  check('main:audit-opt-in',/VITE_R86_LISTENER_AUDIT\s*===\s*'enabled'/.test(main)&&/get\('r86_listener_audit'\)\s*===\s*'1'/.test(main)?'PASS':'BLOCK','Audit R86-C memerlukan flag build dan URL');
  check('main:e3-opt-in',/VITE_R86E3_COMPARE\s*===\s*'enabled'/.test(main)&&/get\('r86_e3_compare'\)\s*===\s*'1'/.test(main)?'PASS':'BLOCK','R86-E3 memerlukan flag build dan URL');
 }
 const report=readFile('src/features/reports/ReportsPreview.tsx');
 if(report)check('reports:restore',/reportRealtimeEnabled/.test(report)&&/\[startDate, endDate, reportRealtimeEnabled\]/.test(report)?'PASS':'BLOCK','Listener laporan harus re-subscribe setelah resume');
 const hook=readFile('src/services/multitab/useR86E2ReportLive.ts');
 if(hook){
  check('e2:flag-opt-in',/r86_e2_pilot/.test(hook)||/r86_e2_pilot/.test(readFile('src/services/multitab/r86e2ReportPilot.ts')||'')?'PASS':'BLOCK','Pilot R86-E2 harus opt-in');
 }
 const archive=[
 'src/contexts/AuthContext.tsx', 'src/services/auth/backgroundSession.ts',
 'src/services/offline/syncQueueService.ts', 'src/services/firebase/sharedLiveSource.ts'
 ];
 return Object.fromEntries(archive.map(p=>[p,h(p)]));
}
function e3Gate(file){
 let data;try{data=readJSON(file);}catch(err){check('e3:input','BLOCK','JSON invalid: '+err.message);return;}
 if(!data){check('e3:input','BLOCK','Hasil E3 tidak ditemukan; jalankan compare_r86e3.cjs');return;}
 if(data.schema!=='piket-r86e3-comparison-v1') {check('e3:schema','BLOCK','Schema hasil E3 tidak sesuai');return;}
 check('e3:rejected',(Array.isArray(data.rejectedFiles)&&data.rejectedFiles.length===0&&data.acceptedFiles===22&&data.inputFiles===22)?'PASS':'BLOCK',`File valid ${data.acceptedFiles??'?'}/22; ditolak ${(data.rejectedFiles||[]).length}`);
 check('e3:limits',data.doesNotMeasureFirestoreBillableReads===true&&data.doesNotProveDataIntegrityOrSessionValidity===true?'PASS':'BLOCK','Harus mencantumkan batas metrik E3');
 const scenarios=Array.isArray(data.scenarios)?data.scenarios:[];
 for(const n of [1,2,3,5]){
  const subset=scenarios.filter(s=>s?.tabCount===n);
  const s=subset[0];const ok=subset.length===1&&s?.baseline?.fileCount===n&&s?.pilot?.fileCount===n&&s.status==='READY_FOR_MANUAL_REVIEW'&&Array.isArray(s.warnings)&&s.warnings.length===0;
  check('e3:'+n+'-tab',ok?'PASS':'BLOCK',!s?'Skenario belum ada':`status=${s.status}; baseline=${s?.baseline?.fileCount??'?'} pilot=${s?.pilot?.fileCount??'?'}; warnings=${(s?.warnings||[]).join(',')||'none'}`);
 }
 check('e3:all-scenarios',scenarios.length===4?'PASS':'BLOCK','Harus tepat empat skenario 1/2/3/5 tab');
}
function evidenceGate(file,commit){
 let d;try{d=readJSON(file);}catch(err){check('evidence:input','BLOCK','JSON invalid: '+err.message);return;}
 if(!d){check('evidence:input','BLOCK','Template bukti staging belum diisi');return;}
 if(d.schema!=='piket-r86f-evidence-v1'){check('evidence:schema','BLOCK','Schema bukti tidak sesuai');return;}
 check('evidence:environment',d.environment==='preview'?'PASS':'BLOCK','Wajib Preview, bukan Production');
 check('evidence:commit',sha(d.gitCommit)&&commit!==null&&d.gitCommit===commit?'PASS':'BLOCK','SHA bukti harus sama persis dengan HEAD Git lokal');
 check('evidence:metadata',validString(d.testedAt)&&!Number.isNaN(Date.parse(d.testedAt))&&validString(d.reviewer)&&validString(d.browser)&&validString(d.deployment)&&validString(d.workload)?'PASS':'BLOCK','Timestamp, reviewer, browser, deployment, dan workload harus diisi');
 const result=d.automation||{};
 for(const key of ['npmCi','lint','build','r86a','r86b','r86c','r86d','r86e1','r86e2','r86e3']){
  const v=result[key];
  check('automation:'+key,v?.status==='PASS'&&validString(v.evidence)?'PASS':'BLOCK',v?.status==='PASS'?'Ada konfirmasi manual + referensi log':'Harus mencatat PASS beserta log/hasil nyata');
 }
 const tests=Array.isArray(d.tests)?d.tests:[];
 for(const [id,label] of CASES){const found=tests.filter(t=>t?.id===id);const item=found[0];check('manual:'+id,found.length===1&&item.status==='PASS'&&validString(item.evidence)?'PASS':'BLOCK',!item?`Belum ada: ${label}`:item.status==='PASS'?'Dicatat lulus oleh penguji; perlu review bukti':`Belum PASS: ${label}`);}
 check('manual:no-unknown',tests.length===CASES.length&&tests.every(t=>CASES.some(x=>x[0]===t.id))?'PASS':'BLOCK','Jumlah skenario wajib harus lengkap dan unik');
 check('approval:decision',d.releaseDecision==='APPROVED'&&validString(d.approvalNote)&&validString(d.approvedBy)&&validString(d.approvalAt)&&!Number.isNaN(Date.parse(d.approvalAt))?'PASS':'BLOCK','Keputusan tertulis oleh reviewer diperlukan untuk GO');
 check('approval:production-flag',d.pilotEnabledInProduction===false?'PASS':'BLOCK','Pilot R86-E2 tetap OFF pada Production sampai ada persetujuan terpisah');
}
function render(gate){
 const lines=['# R86-F — Final Release Gate','','**'+gate.decision+'** (hasil gate lokal; bukan sertifikasi Firebase produksi).','','- Commit Git: `'+(gate.gitCommit||'TIDAK TERSEDIA')+'`','- Pemeriksaan PASS: '+gate.passed+'/'+gate.checks.length,'- Pemeriksaan BLOCK: '+gate.blocked,'- Tanggal laporan (UTC): '+gate.createdAt,'','## Pemeriksaan','', '| ID | Status | Keterangan |','|---|---|---|'];
 for(const c of gate.checks)lines.push('| '+untrustedLabel(c.id)+' | '+c.status+' | '+untrustedLabel(c.message)+' |');
 lines.push('','## Fingerprint file penting (SHA-256)','',...Object.entries(gate.criticalFileHashes).map(([file,hash])=>'- `'+file+'`: `'+(hash||'TIDAK ADA')+'`'),'', '## Batasan','', '- Status PASS adalah evaluasi artefak dan pernyataan penguji; tidak membuktikan transaksi produksi tanpa review bukti asli.','- Nilai callback/listener bukan Firebase billed reads.','- Rollback harus menjaga IndexedDB, draft, foto, dan antrean offline; jangan hapus data pengguna.','- R86-E2 tetap pilot opt-in di Preview; jalankan keputusan aktivasi Production secara terpisah.','');return lines.join('\n');
}
try{
 if(!fs.existsSync(root)||!fs.statSync(root).isDirectory())throw Error('Folder root tidak ditemukan');
 const criticalFileHashes=sourceGate();
 const commit=getCommit();
 check('repo:git-head',commit?'PASS':'BLOCK',commit?'Git SHA HEAD terbaca':'HEAD tidak dapat dibaca; audit pada GitHub lokal terbaru belum terverifikasi');
 const changes=getRelevantGitChanges();
 check('repo:clean',changes!==null&&changes.length===0?'PASS':'BLOCK',changes===null?'Git status tidak dapat dibaca':`${changes.length} perubahan/untracked di luar artifacts; commit semua source audit terlebih dahulu, jangan Push sebelum lulus`);
 const e3=resolved(flag('--e3','artifacts/r86e3/results/summary.json'));
 const evidence=resolved(flag('--evidence','artifacts/r86f/evidence.json'));
 e3Gate(e3); evidenceGate(evidence,commit);
 const blocked=checks.filter(c=>c.status==='BLOCK').length;
 const report={schema:'piket-r86f-release-gate-v1',createdAt:new Date().toISOString(),gitCommit:commit,decision:blocked?'NO-GO':'GO_FOR_SEPARATE_RELEASE_REVIEW',passed:checks.length-blocked,blocked,checks,criticalFileHashes,doesNotProveFirebaseBillableReadsOrSecurity:true};
 console.log(`R86-F: ${report.decision} | ${report.passed}/${checks.length} PASS | ${blocked} BLOCK | HEAD: ${commit||'UNVERIFIED'}`);
 const blockedChecks=checks.filter(c=>c.status==='BLOCK');
 for(const c of blockedChecks.slice(0,18))console.log(`BLOCK ${c.id}: ${c.message}`);
 if(blockedChecks.length>18)console.log(`... ${blockedChecks.length-18} BLOCK lainnya (gunakan --out untuk laporan lengkap)`);
 const out=flag('--out',null);
 if(out){
  const outPath=resolved(out);const relative=path.relative(root,outPath);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!relative.startsWith('artifacts'+path.sep)||relative.includes('..'+path.sep)||outPath===path.dirname(evidence)||outPath===path.dirname(e3))throw Error('--out harus di subfolder artifacts/ dan terpisah dari folder input');
  fs.mkdirSync(outPath,{recursive:true});
  fs.writeFileSync(path.join(outPath,'summary.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(outPath,'summary.md'),render(report));
  console.log('Laporan:',path.join(outPath,'summary.md'));
 }
 if(argv.includes('--strict')&&blocked)process.exitCode=2;
} catch(err){console.error('R86-F STOP:',err.message);process.exitCode=2;}
