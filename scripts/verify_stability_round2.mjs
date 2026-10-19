// Real queue guards, audit outbox and DriveStore. All Firebase/Google IO is synthetic.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
let count = 0;
const check = async (name, fn) => { await fn(); count++; console.log('PASS', name); };
const compile = async (contents, mocks, patterns) => (await build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'isolated-io',setup(b){for(const[filter,path]of patterns)b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]})).outputFiles[0].text;
const f={uid:'alice',trusted:true,storage:new Map(),writes:[],wait:null,fail:false,online:true};
const common={
 auth:`export const auth={get currentUser(){return globalThis.f.uid?{uid:globalThis.f.uid,displayName:'Test',getIdToken:async()=> 'TEST_ONLY'}:null}};export const db={};`,
 offline:`export const OfflineStorage={getProjectId:()=> 'demo-test',isTrustedDevice:()=>globalThis.f.trusted};`,
 sdk:`export const doc=(_,collection,id)=>({collection,id});export const setDoc=async(ref,data)=>{const f=globalThis.f;if(f.wait)await f.wait;if(f.fail)throw Error('unavailable');if(f.deniedId===ref.id)throw Object.assign(Error('forbidden'),{code:'permission-denied'});f.writes.push({ref,data})};`,
 notify:`export const publishNotificationEvent=async()=>{};`,
 unused:`export const AttendanceService={};export const DutyBookService={};export const IncidentService={};export const VisitorService={};export const StudentPermitService={};export const SubstitutionService={};export const StudentTardyService={};export const FirestoreService={};export const DraftService={};`,
};
const code=await compile("export{AuditService,sanitizeAuditMetadata}from'./src/services/audit/auditService';export{pendingAudits}from'./src/services/audit/auditOutbox';export{SyncQueueService}from'./src/services/offline/syncQueueService';",common,[[/\/(?:firebase|firebaseAuth)$/,'auth'],[/offlineStorage$/,'offline'],[/draftService$/,'unused'],[/^firebase\/firestore$/,'sdk'],[/notificationPublisher$/,'notify'],[/\/(?:attendanceService|dutyBookService|incidentService|visitorService|studentPermitService|substitutionService|studentTardyService|firestoreService)$/,'unused']]);
const storage={get length(){return f.storage.size},key:i=>[...f.storage.keys()][i]??null,getItem:k=>f.storage.get(k)??null,setItem:(k,v)=>f.storage.set(k,v),removeItem:k=>f.storage.delete(k)};
const context=vm.createContext({f,module:{exports:{}},crypto:webcrypto,TextEncoder,Blob,console:{warn(){},log(){},error(){}},navigator:{get onLine(){return f.online}},window:{addEventListener(){}},setTimeout:()=>0,localStorage:storage});vm.runInContext(code,context);
const {AuditService:a,sanitizeAuditMetadata:sanitize,pendingAudits:pending,SyncQueueService:queue}=context.module.exports;
const user={id:'alice',role:'GURU',isActive:true,permissions:['attendance.create','dutybook.create','incident.create','student_tardy.view','student_permits.view','substitutions.view','visitors.view']};
const operations=['ATTENDANCE_CHECKIN','DUTYBOOK_SUBMIT','INCIDENT_REPORT','TARDY_REPORT','PERMIT_REPORT','VISITOR_REPORT','SUBSTITUTION_REPORT'];
const item=(operationType,owner=user)=>({operationType,projectId:'demo-test',userId:owner.id,payload:{userId:owner.id}});
await check('40 distinct real-role accounts can validate all seven permitted queue operations',()=>{for(let i=0;i<40;i++){const u={...user,id:'officer-'+i};for(const op of operations)assert.equal(queue.validateUserAuthority(item(op,u),u),null)}});
await check('revoked permissions, inactive account, wrong owner/project and unknown operations fail closed',()=>{
 for(const op of operations){assert.ok(queue.validateUserAuthority(item(op),{...user,permissions:[]}));assert.ok(queue.validateUserAuthority(item(op),{...user,isActive:false}));}
 assert.ok(queue.validateUserAuthority({...item('TARDY_REPORT'),projectId:'another-project'},user));assert.ok(queue.validateUserAuthority({...item('TARDY_REPORT'),userId:'bob'},user));
 assert.ok(queue.validateUserAuthority(item('GENERIC_SET'),{...user,role:'ADMIN'}));assert.ok(queue.validateUserAuthority(item('UNKNOWN'),user));
 assert.ok(queue.validateUserAuthority({...item('ATTENDANCE_CHECKIN'),payload:{userId:'bob'}},user));
});
await check('actual staff/satpam roles work with grants; view-only journal access cannot write',()=>{
 for(const role of ['TENAGA_KEPENDIDIKAN','SATPAM'])assert.equal(queue.validateUserAuthority(item('TARDY_REPORT'),{...user,role}),null);
 assert.ok(queue.validateUserAuthority(item('DUTYBOOK_SUBMIT'),{...user,permissions:['dutybook.view']}));
 assert.equal(queue.validateUserAuthority(item('DUTYBOOK_SUBMIT'),{...user,permissions:['input_duty_book']}),null);
});
const log=details=>a.log({action:'CREATE',module:'VISITORS',details});
await check('event appended during an awaiting flush is preserved and delivered on the next flush',async()=>{
 f.online=false;await log('first');let release;f.wait=new Promise(r=>release=r);f.online=true;const flushing=a.flushOfflineQueue();await Promise.resolve();await Promise.resolve();f.online=false;await log('new while awaiting');f.online=true;release();await flushing;f.wait=null;
 assert.equal(pending('alice').length,1);assert.equal(pending('alice')[0].details,'new while awaiting');await a.flushOfflineQueue();assert.equal(pending('alice').length,0);assert.equal(f.writes.length,2);
});
await check('another module instance/tab cannot overwrite an event appended by the first',async()=>{
 f.online=false;await log('tab-one');const other=vm.createContext({f,module:{exports:{}},crypto:webcrypto,console:{warn(){}},navigator:{get onLine(){return f.online}},window:{addEventListener(){}},setTimeout:()=>0,localStorage:storage,TextEncoder,Blob});vm.runInContext(code,other);await other.module.exports.AuditService.log({action:'CREATE',module:'VISITORS',details:'tab-two'});
 assert.equal(pending('alice').length,2);f.online=true;await a.flushOfflineQueue();assert.equal(pending('alice').length,0);
});
await check('account changes never flush another account logs and retain the original pending event',async()=>{
 f.online=false;await log('alice private');f.uid='bob';f.online=true;const before=f.writes.length;await a.flushOfflineQueue();assert.equal(f.writes.length,before);assert.equal(pending('alice').length,1);
 f.uid='alice';await a.flushOfflineQueue();assert.equal(pending('alice').length,0);
});
await check('account change during lazy SDK import cannot issue the old account write',async()=>{
 const before=f.writes.length;const attempt=log('lazy switch');f.uid='bob';await attempt;assert.equal(f.writes.length,before);assert.equal(pending('alice').length,1);f.uid='alice';await a.flushOfflineQueue();
});
await check('failed write retains a stable event ID for retry',async()=>{
 f.online=false;await log('retry');const id=pending('alice')[0].id;f.online=true;f.fail=true;await a.flushOfflineQueue();assert.equal(pending('alice')[0].id,id);f.fail=false;await a.flushOfflineQueue();assert.equal(f.writes.at(-1).ref.id,id);
});
await check('one permission-rejected audit does not block another healthy event',async()=>{
 f.online=false;await log('denied');await log('healthy');f.deniedId=pending('alice')[0].id;f.online=true;await a.flushOfflineQueue();assert.equal(pending('alice').length,1);assert.equal(f.writes.at(-1).data.details,'healthy');f.deniedId=null;await a.flushOfflineQueue();
});
await check('login endpoint failure after account switch never invents a login for the new account',async()=>{
 let reject;f.requestStarted=false;context.fetch=async()=>{f.requestStarted=true;return new Promise((_,r)=>reject=r)};const attempt=a.recordLogin('PIN');for(let i=0;i<10&&!f.requestStarted;i++)await Promise.resolve();assert.equal(f.requestStarted,true);f.uid='bob';reject(Error('unavailable'));await attempt;assert.equal(pending('bob').length,0);f.uid='alice';
});
await check('more than 500 pending events are retained rather than silently shifted out',async()=>{
 f.online=false;await Promise.all(Array.from({length:510},(_,i)=>log('event-'+i)));assert.equal(pending('alice').length,510);f.storage.clear();
});
await check('shared devices keep new audit events in memory without writing localStorage',async()=>{
 f.trusted=false;f.online=false;const before=f.storage.size;await log('shared');assert.equal(f.storage.size,before);assert.equal(pending('alice').length,1);f.online=true;await a.flushOfflineQueue();assert.equal(pending('alice').length,0);f.trusted=true;
});
await check('undefined, deep secrets and cyclic metadata cannot poison Firestore records',()=>{
 const circular={pin:'123456'};circular.self=circular;const v=sanitize({optional:undefined,secret:'s',nested:[undefined,{password:'p'}],circular});const json=JSON.stringify(v);assert.ok(!json.includes('123456'));assert.ok(!json.includes('"p"'));assert.equal(v.secret,'[REDACTED]');assert.ok(!Object.hasOwn(v,'optional'));assert.equal(v.nested[0],null);assert.ok(json.includes('[TRUNCATED]'));
});
await check('malformed local entries cannot hide a valid pending audit',async()=>{
 f.online=false;await log('valid');const key=[...f.storage.keys()][0];f.storage.set(key+'broken','{');f.storage.set('piket_guru_audit_offline_queue',JSON.stringify([{id:'bad',userId:'alice',action:'CREATE'}]));assert.equal(pending('alice').length,1);f.online=true;await a.flushOfflineQueue();assert.equal(f.writes.at(-1).data.details,'valid');f.storage.clear();
});
await check('legacy queue acknowledgements preserve another owner and new arrivals',async()=>{
 const base={id:'legacy-a',userId:'alice',timestamp:new Date().toISOString(),action:'CREATE',module:'VISITORS',details:'legacy'};
 f.storage.set('piket_guru_audit_offline_queue',JSON.stringify([base,{...base,id:'legacy-b',userId:'bob'}]));await a.flushOfflineQueue();assert.deepEqual(JSON.parse(f.storage.get('piket_guru_audit_offline_queue')).map(v=>v.id),['legacy-b']);f.storage.clear();
});
// Distinct serverless module instances share only the simulated persistent store.
const io={records:new Map(),chain:Promise.resolve(),creates:0,listFailure:false,files:[]};
const serverMocks={admin:`const io=globalThis.io;const ref=(c,id)=>({key:c+'/'+id,get:async()=>({exists:io.records.has(c+'/'+id),data:()=>io.records.get(c+'/'+id)}),set:async data=>{io.records.set(c+'/'+id,data)}});export const adminDb={collection:c=>({doc:id=>ref(c,id)}),runTransaction:cb=>{const job=io.chain.then(async()=>{const deleted=[];const result=await cb({get:r=>r.get(),delete:r=>deleted.push(r.key)});for(const key of deleted)io.records.delete(key);return result});io.chain=job.catch(()=>{});return job}};`,google:`export const google={};`,tokens:`export const encryptToken=x=>x;export const decryptToken=x=>x;`};
const serverCode=await compile("export{DriveStore}from'./src/server/services/driveStore';",serverMocks,[[/firebaseAdmin\.js$/,'admin'],[/^googleapis$/,'google'],[/tokenEncryption\.js$/,'tokens']]);
const serverInstance=()=>{const c=vm.createContext({io,module:{exports:{}},require:createRequire(import.meta.url),Buffer,process:{env:{}},console:{log(){},warn(){},error(){}}});vm.runInContext(serverCode,c);return c.module.exports.DriveStore};
const first=serverInstance(),second=serverInstance();
await check('OAuth state survives a separate replica, stores only a hash and cannot be replayed',async()=>{
 const state=await first.createAuthState('admin');assert.match(state,/^[\w-]{43}$/);assert.ok(![...io.records.keys()].some(key=>key.includes(state)));const valid=await second.validateAuthState(state);assert.equal(valid.valid,true);assert.equal(valid.adminUid,'admin');assert.equal((await first.validateAuthState(state)).valid,false);
});
await check('simultaneous callbacks atomically consume state exactly once',async()=>{const state=await first.createAuthState('admin');const results=await Promise.all([first.validateAuthState(state),second.validateAuthState(state)]);assert.equal(results.filter(v=>v.valid).length,1)});
await check('expired or malformed OAuth state is rejected without exchanging Google tokens',async()=>{
 const state=await first.createAuthState('admin');const key=[...io.records.keys()].find(k=>k.startsWith('drive_oauth_states/'));io.records.get(key).expiresAt=Date.now()-1;assert.equal((await second.validateAuthState(state)).valid,false);assert.equal((await first.validateAuthState('forged')).valid,false);
});
await check('revoked admin cannot finish a previously opened OAuth flow',async()=>{const state=await first.createAuthState('revoked');io.records.set('users/revoked',{role:'GURU',isActive:true});const result=await second.handleOAuthCallback('unused-code',state);assert.equal(result.success,false);assert.match(result.error,/administrator/)});
await check('40 simultaneous synthetic OAuth requests retain separate unpredictable states',async()=>{const states=await Promise.all(Array.from({length:40},(_,i)=>first.createAuthState('admin-'+i)));assert.equal(new Set(states).size,40);const results=await Promise.all(states.map(s=>second.validateAuthState(s)));assert.equal(results.filter(r=>r.valid).length,40)});
const fakeDrive={files:{list:async()=>{if(io.listFailure)throw Error('DRIVE_SEARCH_UNAVAILABLE');return{data:{files:io.files}}},create:async()=>{io.creates++;return{data:{id:'new-file',size:4,mimeType:'image/jpeg'}}}}};
first.getAuthenticatedDriveClient=async()=>({drive:fakeDrive,config:{enabled:true,rootFolderId:'root'}});first.getOrCreateFolderHierarchy=async()=>({folderId:'folder',folderPath:'test'});
const photo={module:'attendance',clientPhotoId:'stable-photo',recordId:'attendance-test',buffer:Buffer.from('test'),mimeType:'image/jpeg'};
await check('Drive lookup outage cannot create duplicate operational photos',async()=>{io.listFailure=true;await assert.rejects(first.uploadPhoto(photo),/DRIVE_SEARCH_UNAVAILABLE/);assert.equal(io.creates,0)});
await check('retry after lookup recovery reuses the existing file',async()=>{io.listFailure=false;io.files=[{id:'old-file',size:4,mimeType:'image/jpeg'}];const result=await first.uploadPhoto(photo);assert.equal(result.fileId,'old-file');assert.equal(io.creates,0)});
console.log(`${count} stability round 2 regression scenarios passed. Synthetic IO only; not a production load benchmark.`);
