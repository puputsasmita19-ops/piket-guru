/** R108: real in-memory atomic transaction tests for Firestore rate-limit fast paths. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let pass=0; let fail=0;
async function test(name,fn) {
  try {await fn(); console.log(`PASS ${++pass}: ${name}`);} catch(error){fail++;console.error(`FAIL ${name}:`,error);}
}
const source=fs.readFileSync('src/server/middleware/rateLimiter.ts','utf8');
const routes=fs.readFileSync('src/server/routes/authRoutes.ts','utf8');
for(const [name,content] of [['rateLimiter.ts',source],['authRoutes.ts',routes]]) {
  await test(`syntax ${name}`,()=> {
    const f=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true);
    assert.equal(f.parseDiagnostics.length,0);
  });
}
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
const context={module,exports:module.exports,process:{env:{NODE_ENV:'test'}},console,Date,Math,Promise,Map,Set,AbortController,setInterval,clearInterval,Buffer,
  require(spec){
    if(spec==='fs' || spec==='path')return require(spec);
    if(spec==='../firebaseAdmin.js')return {adminDb:null};
    if(spec==='../utils/loginLookupMode.js')return {exactSelectedLoginUid(){return null;}};
    throw new Error(`Unexpected require ${spec}`);
  }};
vm.runInNewContext(transpiled,vm.createContext(context),{timeout:6000});
const {FirestoreStoreDriver,createInMemoryTransactionTransport,AuthRateLimiter,setActiveRateLimitDriver,toAccountIdKey,toIpKey}=module.exports;
function fixture() {
  const transport=createInMemoryTransactionTransport();
  let txCount=0;
  const counted={isHealthy:()=>transport.isHealthy(),runTransaction(fn){txCount++;return transport.runTransaction(fn);}};
  const driver=new FirestoreStoreDriver(counted);
  const id=toAccountIdKey('GURU-011'), alias=toAccountIdKey('NIP-011'),ip=toIpKey('192.0.2.1');
  return {transport,driver,id,alias,ip,get count(){return txCount;},
    async acquire(extra={}){return driver.acquireLoginAdmission({idKey:id,aliasKey:alias,ipKey:ip,maxId:5,maxIp:15,leaseTtlMs:30000,...extra});},
    records(){return transport.getRawData();}
  };
}
const lockRecord = (until=Date.now()+60000)=>({count:5,lockedUntil:until,lastAttempt:Date.now(),firstAttempt:Date.now()});
await test('one transaction checks locks and issues lease',async()=> {
  const a=fixture();const r=await a.acquire();assert.equal(r.admitted,true);assert.ok(r.leaseToken);assert.equal(a.count,1);
  assert.deepEqual([...a.records().get('leases:registry').activeTokens],[r.leaseToken]);
});
await test('IP lock denies login and does not create lease',async()=>{
  const a=fixture();a.records().set('records:'+a.ip,lockRecord());const r=await a.acquire();assert.equal(r.blockedBy,'IP_LOCKED');assert.equal(r.admitted,false);assert.ok(r.remainingSeconds>0);assert.equal(a.records().get('leases:registry'),undefined);
});
await test('canonical account lock denies login',async()=>{
  const a=fixture();a.records().set('records:'+a.id,lockRecord());const r=await a.acquire();assert.equal(r.blockedBy,'ACCOUNT_LOCKED');assert.equal(r.admitted,false);
});
await test('alias lock denies login even when UID is unlocked',async()=>{
  const a=fixture();a.records().set('records:'+a.alias,lockRecord());const r=await a.acquire();assert.equal(r.blockedBy,'ACCOUNT_LOCKED');
});
await test('expired IP/alias locks no longer block',async()=>{
  const a=fixture();a.records().set('records:'+a.ip,lockRecord(Date.now()-1000));a.records().set('records:'+a.alias,lockRecord(Date.now()-1000));assert.equal((await a.acquire()).admitted,true);
});
await test('per-account in-flight cap preserved',async()=>{
  const a=fixture();for(let i=0;i<5;i++)assert.equal((await a.acquire()).admitted,true);
  const r=await a.acquire();assert.equal(r.admitted,false);assert.equal(r.blockedBy,'TOO_MANY_CONCURRENT_REQUESTS');
});
await test('per-IP cap preserved across different accounts',async()=>{
  const a=fixture();for(let i=0;i<3;i++)assert.equal((await a.acquire({idKey:toAccountIdKey('A'+i),maxIp:3})).admitted,true);
  const r=await a.acquire({idKey:toAccountIdKey('A4'),maxIp:3});assert.equal(r.blockedBy,'TOO_MANY_CONCURRENT_REQUESTS');
});
await test('expired leases pruned on next acquisition',async()=>{
  const a=fixture();a.records().set('leases:registry',{activeTokens:['expired']});a.records().set('leases:expired',{leaseToken:'expired',idKey:a.id,ipKey:a.ip,expiresAt:Date.now()-1000});
  const r=await a.acquire();assert.equal(r.admitted,true);assert.equal(a.records().has('leases:expired'),false);
  assert.deepEqual([...a.records().get('leases:registry').activeTokens],[r.leaseToken]);
});
await test('parallel callers cannot both exceed one-seat lease',async()=>{
  const a=fixture();const result=await Promise.all([a.acquire({maxId:1}),a.acquire({maxId:1})]);assert.equal(result.filter(x=>x.admitted).length,1);
});
await test('reset clears all alias buckets and unlocked IP in one transaction',async()=>{
  const a=fixture();for(const k of [a.id,a.alias,a.ip])a.records().set('records:'+k,lockRecord(Date.now()-1000));
  await a.driver.resetLoginSuccess([a.id,a.alias,a.id],a.ip);
  assert.equal(a.count,1);for(const k of [a.id,a.alias,a.ip])assert.equal(a.records().has('records:'+k),false);
});
await test('reset preserves active IP lock while clearing aliases',async()=>{
  const a=fixture();for(const k of [a.id,a.alias,a.ip])a.records().set('records:'+k,lockRecord());
  await a.driver.resetLoginSuccess([a.id,a.alias],a.ip);
  assert.equal(a.records().has('records:'+a.id),false);assert.equal(a.records().has('records:'+a.alias),false);assert.equal(a.records().has('records:'+a.ip),true);
});
await test('reset with empty buckets performs no phantom writes',async()=>{
  const a=fixture();await a.driver.resetLoginSuccess([a.id],a.ip);assert.equal(a.records().size,0);assert.equal(a.count,1);
});
await test('unavailable store rejects admission and reset (fail-closed)',async()=>{
  const a=fixture();a.transport.setHealthy(false);
  await assert.rejects(a.acquire());await assert.rejects(a.driver.resetLoginSuccess([a.id],a.ip));
});
await test('facade prefers atomic cleanup when Firestore is available',async()=>{
  const a=fixture();setActiveRateLimitDriver(a.driver);a.records().set('records:'+a.id,lockRecord());a.records().set('records:'+a.alias,lockRecord());
  await AuthRateLimiter.recordLoginSuccessForIdentifiers(['GURU-011','NIP-011','GURU-011'],'192.0.2.1');
  assert.equal(a.count,1);assert.equal(a.records().has('records:'+a.id),false);
});
await test('security checks and lease renewal remain in login middleware',()=>{
  assert.match(source,/activeStoreDriver\.acquireLoginAdmission/);
  assert.match(source,/const \[ipLock, canonicalLock\] = await Promise\.all/);
  assert.match(source,/renewDualInFlight\(leaseToken/);
  assert.match(source,/LEASE_RENEWAL_FAILED/);
  assert.match(source,/RATE_LIMIT_STORE_UNAVAILABLE/);
});
function fakeHttp() {
  const req=new EventEmitter();req.body={identifier:'GURU-011',pin:'123456'};req.ip='192.0.2.1';
  req.headers={};req.socket=new EventEmitter();req.socket.destroyed=false;
  const res=new EventEmitter();res.headersSent=false;res.writableEnded=false;res.finished=false;
  res.code=200;res.body=null;
  res.status=function(code){this.code=code;return this;};
  res.json=function(body){this.body=body;this.headersSent=true;this.writableEnded=true;return this;};
  return {req,res};
}
await test('actual Express login gate uses atomic one-transaction path',async()=> {
  const a=fixture();setActiveRateLimitDriver(a.driver);const {req,res}=fakeHttp();let admitted=0;
  await AuthRateLimiter.loginMiddleware(req,res,()=>admitted++);
  assert.equal(admitted,1);assert.equal(res.body,null);assert.equal(a.count,1);
  assert.equal(a.records().get('leases:registry').activeTokens.length,1);
  res.writableEnded=true;res.finished=true;res.emit('finish');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(a.records().get('leases:registry').activeTokens.length,0);
});
await test('actual Express login gate rejects locked IP with 429',async()=> {
  const a=fixture();a.records().set('records:'+a.ip,lockRecord());setActiveRateLimitDriver(a.driver);
  const {req,res}=fakeHttp();let admitted=0;await AuthRateLimiter.loginMiddleware(req,res,()=>admitted++);
  assert.equal(admitted,0);assert.equal(res.code,429);assert.equal(res.body.code,'IP_LOCKED');assert.equal(a.count,1);
});
await test('actual Express login gate fails closed with 503 on database outage',async()=> {
  const a=fixture();a.transport.setHealthy(false);setActiveRateLimitDriver(a.driver);
  const {req,res}=fakeHttp();let admitted=0;await AuthRateLimiter.loginMiddleware(req,res,()=>admitted++);
  assert.equal(admitted,0);assert.equal(res.code,503);assert.equal(res.body.code,'RATE_LIMIT_STORE_UNAVAILABLE');
});
await test('actual PIN verify, active/revoked checks, rate limit reset and token all mandatory',()=>{
  assert.match(routes,/CredentialStore\.verifyCredential\(userId, pin\)/);
  assert.match(routes,/userData\.isActive !== true/);
  assert.match(routes,/userData\.requiresActivation === true/);
  assert.match(routes,/Promise\.allSettled\(\[resetPromise, signerPromise\]\)/);
  assert.match(routes,/resetResult\.status === 'rejected'/);
});
console.log(`R108 ${pass}/${pass+fail} ${fail ? 'FAIL' : 'PASS'}`);
if(fail)process.exitCode=1;
