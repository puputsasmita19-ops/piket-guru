#!/usr/bin/env node
/** No network except loopback; unit tests all release-gate safety checks. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync,spawn}=require('node:child_process');
const http=require('node:http');
const scripts=__dirname;
const gate=path.join(scripts,'r60_release_gate.cjs');
const smoke=path.join(scripts,'r60_staging_smoke.cjs');
const emulator=path.join(scripts,'r60_emulator_preflight.cjs');
let passed=0;
function test(name,fn){return Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS',name)})}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r60gate-'));
const args=['--preflight','--json'];
const run=(file,argv,cwd=root,env={})=>spawnSync(process.execPath,[file,...argv],{cwd,env:{...process.env,...env},encoding:'utf8',timeout:7000});
const fullPaths=[
  'src/server/middleware/r60ApiRequestMetrics.ts',
  'src/services/monitoring/r60BrowserDiagnostics.ts',
  'scripts/test_r60_diagnostics.cjs',
  'scripts/test_r60_health_probe.cjs',
  'scripts/test_r60_log_summary.cjs',
  'scripts/r60_synthetic_load.cjs',
  'src/features/student-tardiness/StudentTardyFormModal.tsx',
  'scripts/test_r61_mobile_tardy.cjs',
];
const write=(name,txt='')=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,txt)};
const mockHost=async(server,env,extraArgs=[])=>{
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 const port=server.address().port;
 const variables={R60_STAGING_URL:`http://127.0.0.1:${port}/`,R60_STAGING_HOST:'127.0.0.1',R60_STAGING_PROJECT_ID:'demo-stage-piket',R60_PRODUCTION_PROJECT_ID:'prod-school-123',R60_STAGING_CONFIRMED:'YES',...env};
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[smoke,...extraArgs],{cwd:root,env:{...process.env,...variables}});
  let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  child.once('error',reject);child.once('close',code=>resolve({status:code,stdout,stderr}));
 });
 await new Promise(resolve=>server.close(resolve));
 return result;
};
(async()=>{
 try{
 await test('gate refuses a directory without package.json',()=>assert.equal(run(gate,args).status,1));
 write('package.json',JSON.stringify({scripts:{lint:'tsc --noEmit',build:'vite build'}}));
 await test('gate requires reproducible package-lock.json',()=>assert.equal(run(gate,args).status,1));
 write('package-lock.json','{}');
 await test('gate refuses incomplete R60 feature installation',()=>assert.equal(run(gate,args).status,1));
 fullPaths.forEach(x=>write(x));
 await test('preflight rejects R61 test fixture missing marker',()=>assert.equal(run(gate,args).status,1));
 write('src/features/student-tardiness/StudentTardyFormModal.tsx','{/* R61 MOBILE TARDY CARD */}');
 await test('preflight accepts all required R60 files',()=>{const r=run(gate,args);assert.equal(r.status,0,r.stdout);assert.equal(JSON.parse(r.stdout).releaseReady,false);});
 await test('preflight is NOT a build pass',()=>{const r=JSON.parse(run(gate,args).stdout);assert.equal(r.mode,'PREFLIGHT_ONLY');assert.equal(r.releaseReady,false);assert.equal(r.localGatePassed,false);});
 await test('full gate requires node_modules or npm ci',()=>assert.equal(run(gate,['--run','--json']).status,1));
 await test('R61 presence required even if R60 files exist',()=>{fs.rmSync(path.join(root,'scripts/test_r61_mobile_tardy.cjs'));assert.equal(run(gate,args).status,1);write('scripts/test_r61_mobile_tardy.cjs');});
 await test('emulator refuses absent settings',()=>assert.equal(run(emulator,[]).status,1));
 await test('emulator refuses production project despite local host',()=>assert.equal(run(emulator,[],root,{GCLOUD_PROJECT:'prod-school',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'}).status,1));
 await test('emulator accepts demo project and loopback-only endpoints',()=>assert.equal(run(emulator,[],root,{GCLOUD_PROJECT:'demo-piket',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'}).status,0));
 await test('staging rejects identical prod and stage project IDs',async()=>{const r=await mockHost(http.createServer(),{R60_PRODUCTION_PROJECT_ID:'demo-stage-piket'},['--dry-run']);assert.equal(r.status,1)});
 await test('staging refuses unexpected hostname',async()=>{const r=await mockHost(http.createServer(),{R60_STAGING_HOST:'production.example.com'},['--dry-run']);assert.equal(r.status,1)});
 await test('staging dry run makes no HTTP calls',async()=>{let hits=0;const r=await mockHost(http.createServer((_,res)=>{hits++;res.end('ok')}),{},['--dry-run']);assert.equal(r.status,0,r.stderr);assert.equal(hits,0)});
 await test('staging GETs only health and root, no writes or redirects',async()=>{
  const requests=[];
  const srv=http.createServer((req,res)=>{requests.push([req.method,req.url,req.headers.cookie,req.headers.authorization]);if(req.url==='/api/health'){res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'OK'}))}else{res.setHeader('content-type','text/html');res.end('<html></html>')}});
  const r=await mockHost(srv,{});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(requests,[['GET','/api/health',undefined,undefined],['GET','/',undefined,undefined]]);
 });
 await test('staging refuses unhealthy health endpoint',async()=>{
  const r=await mockHost(http.createServer((req,res)=>{res.statusCode=503;res.end('unhealthy')}),{});
  assert.equal(r.status,1);
 });
 await test('staging refuses redirects to production',async()=>{
  const r=await mockHost(http.createServer((req,res)=>{res.writeHead(302,{Location:'https://prod.example.com'});res.end()}),{});
  assert.equal(r.status,1);
 });
 console.log(`${passed}/${passed} R60 release gate unit tests passed`);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error('FAIL',e.message);fs.rmSync(root,{recursive:true,force:true});process.exitCode=1});
