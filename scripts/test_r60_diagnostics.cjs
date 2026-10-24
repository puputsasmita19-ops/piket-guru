#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync,spawnSync}=require('node:child_process');
const ts=(()=>{try{return require('typescript')}catch{return require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}})();
const root=path.resolve(__dirname,'..');
const templates=path.join(__dirname,'r60_templates');
const read=f=>fs.readFileSync(f,'utf8');
let count=0;
function test(name,fn){fn();count++;console.log(`PASS ${String(count).padStart(2,'0')}: ${name}`)}
function transpile(file){const source=read(file);const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'TypeScript parse error');return result.outputText}
const server=path.join(templates,'r60ApiRequestMetrics.ts');
const client=path.join(templates,'r60BrowserDiagnostics.ts');
test('backend TypeScript parses',()=>transpile(server));
test('browser TypeScript parses',()=>transpile(client));
const log=[];let now=0n;
const backendContext={exports:{},module:{exports:{}},console:{warn:(...args)=>log.push(args)},process:{hrtime:{bigint:()=>now}}};
vm.runInNewContext(transpile(server),backendContext,{timeout:2000});
const backend=backendContext.exports;
function request(url,status,ms,body){const events=[];const req={path:url,originalUrl:url+'?secret=VERY-PRIVATE',body,headers:{authorization:'Bearer VERY-PRIVATE'}};
 const res={statusCode:status,once:(type,fn)=>{events.push(fn)}};let proceeded=false;
 const before=log.length;now=0n;backend.r60ApiRequestMetrics(req,res,()=>{proceeded=true});now=BigInt(ms)*1000000n;
 for(const fn of events)fn();return {proceeded,entry:log.length>before?log.at(-1).join(' '):null}}
test('backend ignores successful normal request',()=>{const r=request('/api/auth/login/secret',200,80,{pin:'VERY-PRIVATE'});assert.equal(r.proceeded,true);assert.equal(r.entry,null)});
test('backend excludes non-API traffic',()=>{const r=request('/dashboard',500,3000,{pin:'VERY-PRIVATE'});assert.equal(r.entry,null)});
test('backend logs 5xx bucket without private path/body',()=>{const r=request('/api/auth/users/12345',503,50,{pin:'VERY-PRIVATE'});assert.match(r.entry,/"group":"auth"/);assert.match(r.entry,/"statusClass":"5xx"/);assert.doesNotMatch(r.entry,/VERY-PRIVATE|12345|\?secret|pin/)});
test('backend logs slow status with coarse duration',()=>{const r=request('/api/drive/profile-photo/ID-SENSITIVE',200,5400,{gps:'GPS-PRIVATE'});assert.match(r.entry,/"group":"drive"/);assert.match(r.entry,/"duration":"3-10s"/);assert.doesNotMatch(r.entry,/ID-SENSITIVE|GPS-PRIVATE/)});
test('backend logs 429 rate limiting',()=>{const r=request('/api/other',429,10,{});assert.match(r.entry,/"rateLimited":true/)});
test('backend bounds log output during 5xx burst',()=>{
  const before=log.length;
  for(let i=0;i<100;i++)request('/api/other',500,10,{name:'PRIVATE'});
  assert.ok(log.length-before<=60);
});
test('backend makes no unsolicited telemetry network request',()=>assert.doesNotMatch(read(server),/fetch\s*\(|\.sendBeacon\s*\(/));
test('browser makes no telemetry network request',()=>assert.doesNotMatch(read(client),/fetch\s*\(|\.sendBeacon\s*\(/));
const listeners=new Map(),events=[];
class FakeErrorEvent {constructor(message){this.message=message;this.filename='URL-SENSITIVE'}}
const window={addEventListener:(key,cb)=>{if(!listeners.has(key))listeners.set(key,[]);listeners.get(key).push(cb)}};
const frontendContext={exports:{},module:{exports:{}},window,ErrorEvent:FakeErrorEvent,PerformanceObserver:undefined,
 console:{info:(...args)=>events.push(args.join(' '))}};
vm.runInNewContext(transpile(client),frontendContext,{timeout:2000});
const frontend=frontendContext.exports;
function fire(event,payload){for(const fn of listeners.get(event)||[])fn(payload)}
test('browser installer idempotent',()=>{frontend.installR60BrowserDiagnostics();frontend.installR60BrowserDiagnostics();assert.equal(listeners.get('error').length,1)});
test('browser ignores exception details',()=>{fire('error',new FakeErrorEvent('PIN-SECRET-GPS-PRIVATE'));assert.equal(frontend.r60ClientSnapshot().counters.JS_ERROR,1)});
test('browser catches only category for rejected promise',()=>{fire('unhandledrejection',{reason:'PRIVATE-NAME'});assert.equal(frontend.r60ClientSnapshot().counters.UNHANDLED_REJECTION,1)});
test('browser only prints anonymized counts at pagehide',()=>{fire('pagehide',{});const serialized=JSON.stringify(events);assert.match(serialized,/R60_CLIENT_V1/);assert.doesNotMatch(serialized,/PRIVATE|SECRET|GPS|URL-SENSITIVE/)});
test('browser does not store or transmit user IDs',()=>assert.doesNotMatch(read(client),/localStorage|sessionStorage|navigator\.sendBeacon|document\.cookie/));

const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'r60-installer-fixture-'));
function write(relative,content){const full=path.join(fixture,relative);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,content)}
const appExample=`import { profilePhotoRouter } from './routes/profilePhotoRoutes.js';\nexport function createApp(){\n  // Request logger for API calls (sanitized: never log pin/passwords)\n  app.use((req, res, next) => {\n    const sanitizedBody = { ...req.body };\n    console.log(sanitizedBody);next();\n  });\n\n  // Mount API routes\n}\n`;
const mainExample=`import App from './App.tsx';\n// Intercept Firebase Auth SDK internal assertion errors\ncreateRoot(document.getElementById('root')!).render(<App />);\n`;
try{
 write('package.json','{"name":"piket-guru"}');write('src/server/app.ts',appExample);write('src/main.tsx',mainExample);
 const installer=path.join(root,'scripts/apply_r60_diagnostics.cjs');
 const launch=args=>spawnSync('node',[installer,...args],{cwd:fixture,encoding:'utf8'});
 test('installer dry-run succeeds without mutations',()=>{const r=launch(['--dry-run']);assert.equal(r.status,0,r.stderr);assert.equal(read(path.join(fixture,'src/server/app.ts')),appExample);assert.equal(fs.existsSync(path.join(fixture,'src/server/middleware/r60ApiRequestMetrics.ts')),false)});
 test('installer applies four files',()=>{const r=launch([]);assert.equal(r.status,0,r.stderr);assert.match(read(path.join(fixture,'src/server/app.ts')),/app\.use\(r60ApiRequestMetrics\)/);assert.doesNotMatch(read(path.join(fixture,'src/server/app.ts')),/sanitizedBody/);assert.match(read(path.join(fixture,'src/main.tsx')),/installR60BrowserDiagnostics\(\)/);assert.ok(fs.existsSync(path.join(fixture,'src/server/middleware/r60ApiRequestMetrics.ts')));assert.ok(fs.existsSync(path.join(fixture,'src/services/monitoring/r60BrowserDiagnostics.ts')))});
 test('installed code parses as TypeScript',()=>{transpile(path.join(fixture,'src/server/app.ts'));transpile(path.join(fixture,'src/main.tsx'))});
 test('installer rejects second application',()=>{const r=launch([]);assert.notEqual(r.status,0);assert.match(r.stderr,/STOPPED SAFELY/)});
 test('incompatible source rejected without changes',()=>{const other=fs.mkdtempSync(path.join(os.tmpdir(),'r60-bad-'));try{
 const badApp='no compatible logger';const badMain=mainExample;
 fs.mkdirSync(path.join(other,'src/server'),{recursive:true});fs.mkdirSync(path.join(other,'src'),{recursive:true});fs.writeFileSync(path.join(other,'package.json'),'{}');fs.writeFileSync(path.join(other,'src/server/app.ts'),badApp);fs.writeFileSync(path.join(other,'src/main.tsx'),badMain);
 const r=spawnSync('node',[installer],{cwd:other,encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(read(path.join(other,'src/server/app.ts')),badApp);assert.equal(fs.existsSync(path.join(other,'src/server/middleware/r60ApiRequestMetrics.ts')),false);
 }finally{fs.rmSync(other,{recursive:true,force:true})}});
}finally{fs.rmSync(fixture,{recursive:true,force:true})}
console.log(`R60: ${count}/${count} diagnostic checks passed`);
