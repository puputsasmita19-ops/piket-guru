#!/usr/bin/env node
/** R60 release validation kit (R61 compatible). NEVER requests production/staging resources. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2);
const checking=args.includes('--preflight');
const running=args.includes('--run');
const install=args.includes('--install');
const asJSON=args.includes('--json');
const root=process.cwd();
const records=[];
const failures=[];
function step(name,ok,reason=''){records.push({name,result:ok?'PASS':'FAIL',reason});if(!ok)failures.push(name)}
function exists(p){return fs.existsSync(path.join(root,p))}
function execute(name,command,commandArgs,timeout=180000){
  const result=spawnSync(command,commandArgs,{cwd:root,stdio:asJSON?'pipe':'inherit',timeout,encoding:'utf8',env:{...process.env,CI:'true'}});
  const ok=result.status===0&&!result.error;
  step(name,ok,ok?'':result.error?result.error.code||'FAILED':`exit ${result.status}`);
  // Structured --json reports contain no raw logs or secrets.
  if(!asJSON)console.log(`[R60 GATE] ${name}: ${ok?'PASS':'FAIL'}`);
  return ok;
}
if((checking?1:0)+(running?1:0)!==1 || (install&&!running)){
  console.error('Usage: node scripts/r60_release_gate.cjs --preflight | --run [--install] [--json]');
  process.exit(2);
}
const pkgFile='package.json';
const lock='package-lock.json';
const expected=[
  'src/server/middleware/r60ApiRequestMetrics.ts',
  'src/services/monitoring/r60BrowserDiagnostics.ts',
  'scripts/test_r60_diagnostics.cjs',
  'scripts/test_r60_health_probe.cjs',
  'scripts/test_r60_log_summary.cjs',
  'scripts/r60_synthetic_load.cjs',
  // R61 was applied later, so its form must be present before claiming readiness.
  'src/features/student-tardiness/StudentTardyFormModal.tsx',
  'scripts/test_r61_mobile_tardy.cjs',
  'scripts/test_r68_tardy_multidevice.cjs',
  'scripts/test_r68_privacy.cjs',
];
step('package.json',exists(pkgFile),'Harus dijalankan di root repository Piket Guru');
step('package-lock.json',exists(lock),'Diperlukan untuk npm ci yang reproducible');
for(const file of expected)step(file,exists(file),'Komponen R60/R61 wajib tersedia pada repository terbaru');
if (exists('src/features/student-tardiness/StudentTardyFormModal.tsx')) {
  const tardyForm=fs.readFileSync(path.join(root,'src/features/student-tardiness/StudentTardyFormModal.tsx'),'utf8');
  step('R61+ mobile layout installed',tardyForm.includes('R61 MOBILE TARDY CARD') || /data-r6[5-9]=[\"']active[\"']/.test(tardyForm),'Pastikan R61/R65/R67 benar-benar diterapkan, bukan hanya file patcher diekstrak');
}
let scripts={};
if(exists(pkgFile))try{scripts=JSON.parse(fs.readFileSync(path.join(root,pkgFile),'utf8')).scripts||{};}catch{step('parse package.json',false,'JSON tidak valid')}
step('npm scripts lint/build',typeof scripts.lint==='string'&&typeof scripts.build==='string','npm run lint/build wajib tersedia');
let nodeMajor=Number(process.versions.node.split('.')[0]);
const nodeMinor=Number(process.versions.node.split('.')[1]);
step('Node.js >= 22.12',nodeMajor>22||(nodeMajor===22&&nodeMinor>=12),'Gunakan Node.js 22.12+ untuk Vite 8 dan dependensi modern');
if(running && failures.length===0){
  if(install)execute('npm ci',process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],240000);
  else step('node_modules',exists('node_modules'),'Jalankan npm ci terlebih dahulu atau --run --install');
  if(failures.length===0){
    // Each command executes locally; no staging/production load test.
    execute('TypeScript lint','npm'+(process.platform==='win32'?'.cmd':''),['run','lint']);
    execute('Vite build','npm'+(process.platform==='win32'?'.cmd':''),['run','build']);
    const scriptsToRun=[
      ['R61 mobile tardy regression','scripts/test_r61_mobile_tardy.cjs'],
      ['R60 diagnostics','scripts/test_r60_diagnostics.cjs'],
      ['R60 health probe tests','scripts/test_r60_health_probe.cjs'],
      ['R60 log privacy tests','scripts/test_r60_log_summary.cjs'],
      ['R68 multi-device tardiness tests','scripts/test_r68_tardy_multidevice.cjs'],
      ['R68 log and artifact privacy tests','scripts/test_r68_privacy.cjs'],
      ['R60 synthetic 50 users','scripts/r60_synthetic_load.cjs'],
    ];
    for(const [name,p] of scriptsToRun)execute(name,process.execPath,[p,...(p.includes('synthetic_load')?['--users','50','--concurrency','25']:[])],70000);
    // Optional regressions are reported as skipped, not falsely marked PASS.
    for(const [name,p] of [
      ['Monitoring R51','scripts/verify_monitoring_r51.cjs'],
      ['Pagination R54','scripts/verify_master_pagination_r54.cjs'],
      ['R57 offline/PWA','scripts/test_r57_gate.cjs'],
      ['R59 Drive','scripts/test_r59_photo_drive.cjs'],
    ])if(exists(p))execute(name,process.execPath,[p],45000);
      else records.push({name,result:'NOT_RUN',reason:'File uji tidak tersedia pada repository ini'});
  }
}
const sha=spawnSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8',timeout:4000});
const report={schema:'PIKETGURU_R60_AFTER_R61_GATE_V2',sourceCommit:sha.status===0?sha.stdout.trim():null,mode:checking?'PREFLIGHT_ONLY':'LOCAL_BUILD_AND_TEST',
  date:new Date().toISOString(),localGatePassed:running&&failures.length===0,releaseReady:false,
  checks:records,failedCount:failures.length,warning:checking?'Preflight lulus BUKAN bukti build/staging lulus.':'Jika localGatePassed=true, baru tes build/regresi lokal yang lulus. Keamanan emulator, staging, dan beban staging masih WAJIB diuji untuk status GO.'};
console.log(JSON.stringify(report,null,2));
if(failures.length>0)process.exitCode=1;
