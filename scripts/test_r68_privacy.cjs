'use strict';
/** Self-contained source safety checks; no Firebase/API connection. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
let ts;
try{ts=require('typescript')}catch{console.error('Install dependencies (npm ci) before running.');process.exit(2)}
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS',name)};
const read=f=>fs.readFileSync(f,'utf8');
for(const f of ['src/server/app.ts','src/server/middleware/r60ApiRequestMetrics.ts','src/main.tsx','src/services/monitoring/r60BrowserDiagnostics.ts','vite.config.ts']){
 check(`TypeScript parser ${f}`,()=>{
  const src=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(src.parseDiagnostics.length,0);
 });
}
const app=read('src/server/app.ts');
check('API request bodies are not logged',()=>assert.doesNotMatch(app,/console\.log\(\s*`\[API\]|sanitizedBody/));
check('HTTP diagnostic middleware installed',()=>assert.match(app,/app\.use\(r60ApiRequestMetrics\)/));
check('unauthenticated Express artifact route is disabled',()=>{
 assert.doesNotMatch(app,/express\.static\([^)]+artifacts/);
 assert.match(app,/app\.use\('\/artifacts',\s*\(_req,\s*res\)\s*=>\s*res\.status\(404\)\.end\(\)\)/);
});
check('mobile browser diagnostics installed',()=>assert.match(read('src/main.tsx'),/installR60BrowserDiagnostics\(\)/));
check('Vite build excludes private artifact copies',()=>{
 const vite=read('vite.config.ts');
 assert.match(vite,/excludePrivateArtifacts\(\)/);
 assert.match(vite,/rm\(path\.resolve\(__dirname,\s*'dist\/artifacts'\),\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/);
});
check('Git ignores accidental backups and audit bundles',()=>{
 const ignore=read('.gitignore');
 for(const required of ['/backups/','/backup-pre-purge.json','/artifacts/','/public/artifacts/'])assert.ok(ignore.includes(required));
});
check('Browser counters do not send network telemetry',()=>{
 const monitor=read('src/services/monitoring/r60BrowserDiagnostics.ts');
 assert.doesNotMatch(monitor,/\b(fetch\(|sendBeacon\(|XMLHttpRequest\()/);
});
// Exercise the exact HTTP middleware with a synthetic request containing secrets.
const middlewareCode=ts.transpileModule(read('src/server/middleware/r60ApiRequestMetrics.ts'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const logs=[];const moduleExports={};let ticks=0;
const sandbox={exports:moduleExports,module:{exports:moduleExports},Date,JSON,console:{warn:(...args)=>logs.push(args)},process:{hrtime:{bigint:()=>{ticks++;return ticks%2===1?0n:3200000000n;}}}};
vm.runInNewContext(middlewareCode,sandbox,{timeout:1000});
check('Slow/auth API logging never contains name PIN query or URI',()=>{
 const req={path:'/api/auth/pin',originalUrl:'/api/auth/pin?token=PRIVATE_TOKEN',body:{pin:'123456',name:'REDACT_ME'},headers:{authorization:'Bearer PRIVATE'}};
 let finish;
 const res={statusCode:500,once:(name,fn)=>{assert.equal(name,'finish');finish=fn;}};
 let advanced=false;
 sandbox.module.exports.r60ApiRequestMetrics(req,res,()=>advanced=true);
 assert.ok(advanced);finish();
 assert.equal(logs.length,1);
 const body=JSON.stringify(logs[0]);
 for(const secret of ['123456','REDACT_ME','PRIVATE_TOKEN','/api/auth/pin','Bearer PRIVATE'])assert.ok(!body.includes(secret));
 assert.ok(body.includes('auth'));assert.ok(body.includes('5xx'));
});
check('Normal fast API requests do not produce logs',()=>{
 ticks=0; sandbox.process.hrtime.bigint=()=>{ticks++;return ticks%2===1?0n:100000000n;};
 const req={path:'/api/auth/login',body:{password:'SECRET'}};
 let finish;const res={statusCode:200,once:(_,fn)=>finish=fn};
 sandbox.module.exports.r60ApiRequestMetrics(req,res,()=>{});finish();
 assert.equal(logs.length,1);
});
console.log(`R68 privacy: ${count}/${count} checks passed.`);
