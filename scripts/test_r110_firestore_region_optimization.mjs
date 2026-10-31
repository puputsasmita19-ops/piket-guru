import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { configureRegion, proposeRegion } from './r110_set_vercel_region.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let passed=0;
async function test(name,fn){await fn();passed++;console.log(`PASS ${passed}: ${name}`);}
const source=fs.readFileSync('src/server/middleware/rateLimiter.ts','utf8');
const authRoutes=fs.readFileSync('src/server/routes/authRoutes.ts','utf8');
const diagnostics=fs.readFileSync('src/features/auth/loginDiagnostics.ts','utf8');
for (const [name,code] of [['rateLimiter.ts',source],['authRoutes.ts',authRoutes],['loginDiagnostics.ts',diagnostics],['authService.ts',fs.readFileSync('src/services/auth/authService.ts','utf8')],['LoginDiagnosticsPanel.tsx',fs.readFileSync('src/features/auth/LoginDiagnosticsPanel.tsx','utf8')]]){
  await test(`TypeScript parses ${name}`,()=>assert.equal(ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true).parseDiagnostics.length,0));
}
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(code,vm.createContext({module,exports:module.exports,process:{env:{NODE_ENV:'test'}},console,Date,Math,Promise,Map,Set,AbortController,setInterval,clearInterval,Buffer,
  require(spec){if(spec==='fs'||spec==='path')return require(spec);if(spec==='../firebaseAdmin.js')return {adminDb:null};if(spec==='../utils/loginLookupMode.js')return {exactSelectedLoginUid(){return null;}};throw Error(spec);}}));
const {FirestoreStoreDriver,createFirestoreAdminTransport,toAccountIdKey,toIpKey,StoreUnavailableError}=module.exports;
function mockFirestore({getAll=true,malformed=false,broken=false}={}) {
  const docs=new Map();const calls={get:0,getAll:0,tx:0,commits:0};
  const collection={doc(id){return {id};}};
  const db={collection(){return collection;}, async runTransaction(fn){
    calls.tx++;let wrote=false;const operations=[];
    const snapshot=(ref)=>{const data=docs.get(ref.id);return {exists:!!data,data(){return structuredClone(data);}};};
    const tx={
      async get(ref){if(wrote)throw Error('read after write');calls.get++;if(broken)throw Error('unavailable');return snapshot(ref);},
      set(ref,data){wrote=true;operations.push(()=>docs.set(ref.id,structuredClone(data)));},
      delete(ref){wrote=true;operations.push(()=>docs.delete(ref.id));},
    };
    if(getAll)tx.getAll=async(...refs)=>{if(wrote)throw Error('read after write');calls.getAll++;if(broken)throw Error('unavailable');return (malformed?refs.slice(1):refs).map(snapshot);};
    const value=await fn(tx);for(const op of operations)op();calls.commits++;return value;
  }};
  return {db,docs,calls};
}
const admission=(driver,override={})=>driver.acquireLoginAdmission({idKey:toAccountIdKey('GURU-011'),ipKey:toIpKey('192.0.2.3'),aliasKey:toAccountIdKey('NIP-011'),maxId:1,maxIp:15,leaseTtlMs:30000,...override});
await test('real Firestore adapter provides getMany',()=>{
  const m=mockFirestore();assert.equal(typeof createFirestoreAdminTransport(m.db).runTransaction,'function');
});
await test('first admission uses ONE getAll RPC for 3 locks + registry',async()=>{
  const m=mockFirestore();const d=new FirestoreStoreDriver(m.db);const result=await admission(d);
  assert.equal(result.admitted,true);assert.equal(m.calls.getAll,1);assert.equal(m.calls.get,0);assert.equal(m.calls.tx,1);
});
await test('lease registry documents are batch read on subsequent admissions',async()=>{
  const m=mockFirestore();const d=new FirestoreStoreDriver(m.db);await admission(d);const denied=await admission(d);
  assert.equal(denied.admitted,false);assert.equal(denied.blockedBy,'TOO_MANY_CONCURRENT_REQUESTS');assert.equal(m.calls.getAll,3);
});
await test('IP locks remain authoritative with batched read',async()=>{
  const m=mockFirestore();m.docs.set(encodeURIComponent('records:'+toIpKey('192.0.2.3')),{lockedUntil:Date.now()+60000});const d=new FirestoreStoreDriver(m.db);
  const r=await admission(d);assert.equal(r.blockedBy,'IP_LOCKED');assert.equal(r.admitted,false);assert.equal(m.calls.getAll,1);
});
await test('alias lock remains authoritative',async()=>{
  const m=mockFirestore();m.docs.set(encodeURIComponent('records:'+toAccountIdKey('NIP-011')),{lockedUntil:Date.now()+60000});
  assert.equal((await admission(new FirestoreStoreDriver(m.db))).blockedBy,'ACCOUNT_LOCKED');
});
await test('successful reset uses ONE getAll RPC and one atomic transaction',async()=>{
  const m=mockFirestore();const d=new FirestoreStoreDriver(m.db);const id=toAccountIdKey('GURU-011'),ip=toIpKey('192.0.2.3');
  for(const key of [id,ip])m.docs.set(encodeURIComponent('records:'+key),{count:1});
  await d.resetLoginSuccess([id],ip);assert.equal(m.calls.getAll,1);assert.equal(m.calls.tx,1);assert.equal(m.docs.size,0);
});
await test('reset never clears actively locked IP',async()=>{
  const m=mockFirestore();const d=new FirestoreStoreDriver(m.db);const id=toAccountIdKey('GURU-011'),ip=toIpKey('192.0.2.3');
  m.docs.set(encodeURIComponent('records:'+ip),{count:5,lockedUntil:Date.now()+60000});m.docs.set(encodeURIComponent('records:'+id),{count:1});
  await d.resetLoginSuccess([id],ip);assert.equal(m.docs.has(encodeURIComponent('records:'+ip)),true);assert.equal(m.docs.has(encodeURIComponent('records:'+id)),false);
});
await test('adapter falls back to per-document get for unsupported SDK',async()=>{
  const m=mockFirestore({getAll:false});const d=new FirestoreStoreDriver(m.db);assert.equal((await admission(d)).admitted,true);assert.ok(m.calls.get>=4);
});
await test('incomplete batch read fails closed without writes',async()=>{
  const m=mockFirestore({malformed:true});const d=new FirestoreStoreDriver(m.db);await assert.rejects(()=>admission(d),/Incomplete/);assert.equal(m.docs.size,0);
});
await test('Firestore unavailable rejects admission without writing lease',async()=>{
  const m=mockFirestore({broken:true});const d=new FirestoreStoreDriver(m.db);await assert.rejects(()=>admission(d));assert.equal(m.docs.size,0);
});
await test('Firestore location mapping only uses documented, explicit location',()=>{
  assert.equal(proposeRegion('asia-southeast2'),'sin1');assert.equal(proposeRegion('asia-southeast1'),'sin1');
  assert.throws(()=>proposeRegion(''),/not in/);assert.throws(()=>proposeRegion('us-central1'),/not in/);
});
await test('region generator preserves existing Vercel configuration',()=>{
  const config={framework:'vite',functions:{'api/**/*.ts':{includeFiles:'src/**'}},rewrites:[{source:'/api/(.*)',destination:'/api'}]};
  const generated=configureRegion(JSON.stringify(config),'asia-southeast2');const parsed=JSON.parse(generated.output);
  assert.deepEqual(parsed.regions,['sin1']);assert.deepEqual(parsed.rewrites,config.rewrites);assert.deepEqual(parsed.functions,config.functions);
});
await test('region generator refuses to overwrite region overrides',()=>{
  assert.throws(()=>configureRegion('{"regions":["iad1"]}','asia-southeast2'),/already sets/);
  assert.throws(()=>configureRegion('{"functions":{"api/index.ts":{"regions":["iad1"]}}}','asia-southeast2'),/Function-specific/);
});
await test('diagnostics do not expose PIN, token or school location',()=>{
  assert.match(authRoutes,/X-PG-Function-Region/);assert.match(diagnostics,/functionRegion\?: string/);
  assert.match(source,/getAll\(\.\.\.refs\)/);assert.doesNotMatch(source,/RATE_LIMIT_SKIP_SECURITY/);
});
console.log(`R110 ${passed}/${passed} PASS`);
