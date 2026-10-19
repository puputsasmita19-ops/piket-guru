// Actual operational services and Firestore transactions with account changes
// between reads, photo processing and writes. Firebase, Drive and cache IO
// are isolated fixtures; this suite never contacts production.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const f={uid:'admin',active:new Set(),readGate:null,records:new Map(),versions:new Map(),writes:[],queries:[],audits:[],sources:[],cacheWrites:0,beforeCommit:null,deny:false,onPhoto:null};
const sdk=`const f=globalThis.f;
export const doc=(_,c,id)=>({c,id}),collection=(_,c)=>({c});
export const query=(ref,...constraints)=>({...ref,constraints}),queryEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const where=(field,op,value)=>({field,op,value}),orderBy=(...v)=>({order:v}),limit=n=>({limit:n}),startAfter=v=>({after:v});
const key=r=>r.c+'/'+r.id;
const snap=r=>{const value=structuredClone(f.records.get(key(r)));return{id:r.id,exists:()=>value!==undefined,data:()=>value}};
export async function getDoc(r){return snap(r)};export const getDocFromServer=getDoc;
export async function getDocs(q){f.queries.push(q);const values=[...f.records.entries()].filter(([k])=>k.startsWith(q.c+'/')).filter(([,v])=>(q.constraints||[]).every(c=>c.field?c.op==='in'?c.value.includes(v[c.field]):c.op==='>='?v[c.field]>=c.value:c.op==='<'?v[c.field]<c.value:v[c.field]===c.value:true));return{docs:values.map(([k])=>snap({c:q.c,id:k.slice(q.c.length+1)}))}};
export const getCountFromServer=async()=>({data:()=>({count:0})});
export const onSnapshot=(ref,next,error)=>{const s={ref,next,error,stops:0};f.sources.push(s);return()=>{s.stops++}};
export const serverTimestamp=()=>({type:'serverTimestamp'}),deleteField=()=>({type:'deleteField'});
function commit(ops){if(f.deny)throw Object.assign(Error('permission-denied'),{code:'permission-denied'});for(const o of ops){const k=key(o.ref);f.records.set(k,structuredClone(o.options?.merge?{...f.records.get(k),...o.data}:o.data));f.versions.set(k,(f.versions.get(k)||0)+1);f.writes.push(o)}};
export const setDoc=async(ref,data,options)=>commit([{ref,data,options}]),updateDoc=async(ref,data)=>commit([{ref,data,options:{merge:true}}]),deleteDoc=async ref=>{f.records.delete(key(ref));f.versions.set(key(ref),(f.versions.get(key(ref))||0)+1)};
export const writeBatch=()=>{const ops=[];return{set:(ref,data,options)=>ops.push({ref,data,options}),commit:async()=>commit(ops)}};
export async function runTransaction(_,fn){for(let attempt=0;attempt<6;attempt++){const reads=new Map(),ops=[];const result=await fn({get:async ref=>{reads.set(key(ref),f.versions.get(key(ref))||0);if(f.readGate)await f.readGate;return snap(ref)},set:(ref,data,options)=>ops.push({ref,data,options}),update:(ref,data)=>ops.push({ref,data,options:{merge:true}})});if(f.beforeCommit){const hook=f.beforeCommit;f.beforeCommit=null;await hook()}if([...reads].some(([k,v])=>(f.versions.get(k)||0)!==v))continue;commit(ops);return result}throw Error('aborted')};`;
const mocks={sdk,firebase:`export const db={};export const auth={get currentUser(){return globalThis.f.uid?{uid:globalThis.f.uid}:null}};`,offline:`export const OfflineStorage={getScopedCache:async()=>null,setScopedCache:async()=>{globalThis.f.cacheWrites++},registerListener:fn=>{globalThis.f.active.add(fn);return()=>{globalThis.f.active.delete(fn);fn()}}};`,audit:`export const AuditService={log:async entry=>{globalThis.f.audits.push(entry)}};`,photo:`export async function processPhotoForStorage(url){if(globalThis.f.onPhoto){const fn=globalThis.f.onPhoto;globalThis.f.onPhoto=null;await fn()}return{photoUrl:url.startsWith('data:')?'/api/drive/photo/test':url}};export async function processMultiplePhotosForStorage(photos){return photos};`,notifications:`export async function publishNotificationEvent(){}`};
const names=['FirestoreService','DutyBookService','IncidentService','StudentPermitService','StudentTardyService','VisitorService','SubstitutionService','AttendanceService'];
const entries=names.map(n=>`export{${n}}from'./src/services/firebase/${n[0].toLowerCase()+n.slice(1)}';`).join('\n');
const built=await build({stdin:{contents:entries,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'isolated-io',setup(b){for(const[path,filter]of[['sdk',/^firebase\/firestore$/],['firebase',/\/(?:firebase|firebaseAuth)$/],['offline',/offlineStorage$/],['audit',/auditService$/],['photo',/photoUploadHelper$/],['notifications',/notificationPublisher$/]])b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const c=vm.createContext({f,module:{exports:{}},structuredClone,crypto:webcrypto,TextEncoder,Date,console:{log(){},warn(){},error(){}},setTimeout,clearTimeout});vm.runInContext(built.outputFiles[0].text,c);const s=c.module.exports.FirestoreService;
const revision='2026-10-18T00:00:00.000Z',base={id:'one',updatedAt:revision,dataSource:'PRODUCTION',isDemo:false};
const audit={userId:'admin',userName:'Admin',role:'ADMIN',action:'UPDATE',module:'INCIDENTS',details:'Synthetic test'};
const put=(col,v)=>{const key=col+'/'+v.id;f.records.set(key,structuredClone(v));f.versions.set(key,(f.versions.get(key)||0)+1)};
const cancel=()=>{for(const stop of [...f.active])stop();f.active.clear()};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const changed=error=>error?.code==='SESSION_CHANGED';let count=0;
const check=async(name,fn)=>{f.uid='admin';f.records.clear();f.versions.clear();f.writes=[];f.readGate=null;f.beforeCommit=null;f.active.clear();await fn();assert.equal(f.active.size,0,'scope cleanup');count++;console.log('PASS',name)};
const user={id:'admin',fullName:'Admin',role:'ADMIN'};
const svc=c.module.exports;
const cases=[
 ['visitors','registerVisitor',svc.VisitorService,()=>[{id:'one',tanggal:'2026-10-19',namaTamu:'Uji',kategori:'LAINNYA'},user]],
 ['visitors','updateVisitor',svc.VisitorService,()=>[{id:'one',namaTamu:'Baru'},user]],
 ['visitors','checkoutVisitor',svc.VisitorService,()=>['one',user]],
 ['studentPermits','createPermit',svc.StudentPermitService,()=>[{id:'one',tanggal:'2026-10-19',namaSiswa:'Uji'},user]],
 ['studentPermits','updatePermit',svc.StudentPermitService,()=>[{id:'one',alasan:'Baru'},user]],
 ['studentPermits','markReturned',svc.StudentPermitService,()=>['one',user,'12:00']],
 ['studentTardiness','saveTardyStudent',svc.StudentTardyService,()=>[{id:'one',namaSiswa:'Uji'},user,true]],
 ['studentTardiness','admitToClass',svc.StudentTardyService,()=>['one',user]],
 ['studentTardiness','correctTardyRecord',svc.StudentTardyService,()=>[{tardyId:'one',adminUser:user,manualMinutesLate:5,reason:'Uji'}]],
 ['substitutions','createSubstitution',svc.SubstitutionService,()=>[{id:'one',tanggal:'2026-10-19'},user]],
 ['substitutions','updateSubstitution',svc.SubstitutionService,()=>[{id:'one',catatan:'Baru'},user]],
 ['substitutions','updateStatus',svc.SubstitutionService,()=>['one','SELESAI',undefined,undefined,user]],
 ['incidents','saveIncident',svc.IncidentService,()=>[{id:'one',tanggal:'2026-10-19',photos:[]},user]],
 ['incidents','updateIncidentStatus',svc.IncidentService,()=>['one','SELESAI',user]],
 ['dutyBooks','saveDraft',svc.DutyBookService,()=>[{id:'one',tanggal:'2026-10-19'},user]],
];
const original=s.getByIdStrict.bind(s);
for(const sameUid of [false,true])for(const [col,name,service,args]of cases)await check(`${col}.${name} blocks ${sameUid?'same-UID relogin':'account switch'} after a completed read`,async()=>{
 const create=name.startsWith('create')||name==='registerVisitor';if(!create)put(col,{...base,jamKeluar:'08:00',status:'DRAFT',menitTerlambat:10,jamDatang:'07:10',poinPelanggaran:5});
 s.getByIdStrict=async(...a)=>{const result=await original(...a);cancel();if(!sameUid)f.uid='other-admin';return result};
 try{await assert.rejects(service[name](...args()),changed);assert.equal(f.writes.length,0)}finally{s.getByIdStrict=original}
});
for(const [col,name,service,args]of cases.filter(([,n])=>['registerVisitor','saveTardyStudent'].includes(n)))await check(`${col}: cancellation after photo processing blocks the record write`,async()=>{
 const a=args();a[0][col==='visitors'?'fotoUrl':'fotoUrl']='data:image/jpeg;base64,dGVzdA==';f.onPhoto=()=>cancel();await assert.rejects(service[name](...a),changed);assert.equal(f.writes.length,0)
});
await check('40 valid independent visitor registrations keep their matching actor',async()=>{await Promise.all(Array.from({length:40},(_,i)=>svc.VisitorService.registerVisitor({id:'v'+i,tanggal:'2026-10-19',namaTamu:'Tamu '+i,kategori:'LAINNYA'},user)));assert.equal(f.writes.length,40);assert.ok(f.writes.every(w=>w.data.createdBy==='Admin'));});
for(const [col,name,service,args]of cases)await check(`${col}.${name} rejects a stale actor before any read or write`,async()=>{f.uid='other-admin';const reads=f.queries.length;await assert.rejects(service[name](...args()),changed);assert.equal(f.writes.length,0);assert.equal(f.queries.length,reads)});
const batchCases=[
 ['permits',svc.StudentPermitService,'createBatchPermits',()=>[{groupId:'g',tanggal:'2026-10-19',jamKeluarUmum:'08:00',jenisIzinUmum:'KELUAR_SEBENTAR',students:[1,2,3].map(i=>({studentId:'s'+i,namaSiswa:'Siswa '+i,kelas:'X'}))},user],null,r=>r.items],
 ['tardy',svc.StudentTardyService,'saveBatchTardyStudents',()=>[[1,2,3].map(i=>({studentId:'s'+i,namaSiswa:'Siswa '+i,kelas:'X',tanggal:'2026-10-19'})),user,'batch-test'],'saveTardyStudent',r=>r.results],
 ['substitution',svc.SubstitutionService,'saveBatchSubstitutions',()=>[{items:[1,2,3].map(i=>({id:'inv'+i,guruBerhalanganId:'g'+i,guruBerhalanganName:'Guru '+i,kelas:'X'+i,tanggal:'2026-10-19',selectedPeriodNumbers:[i]})),user,batchRequestId:'batch-test'}],'createSubstitution',r=>r.results],
];
for(const [name,service,method,args,child,items]of batchCases)await check(`${name} batch preserves acknowledged successes and blocks remaining records after logout`,async()=>{
 const originalChild=child&&service[child],originalAudit=s.logAudit;let seen=0;
 if(child)service[child]=async(...a)=>{const r=await originalChild.apply(service,a);if(++seen===1)cancel();return r};
 else s.logAudit=async(...a)=>{await originalAudit.apply(s,a);if(++seen===1)cancel()};
 try{const result=items(await service[method](...args()));assert.equal(result.filter(i=>i.success).length,1);assert.equal(result.filter(i=>!i.success).length,2);assert.equal(f.writes.length,1)}finally{if(child)service[child]=originalChild;s.logAudit=originalAudit}
});
await check('bulk student return stops writing after the first acknowledged update if logout occurs',async()=>{for(let i=1;i<=3;i++)put('studentPermits',{...base,id:'p'+i,jamKeluar:'08:00'});const original=svc.StudentPermitService.markReturned;let seen=0;svc.StudentPermitService.markReturned=async(...a)=>{const r=await original.apply(svc.StudentPermitService,a);if(++seen===1)cancel();return r};try{const result=await svc.StudentPermitService.markMultipleReturned(['p1','p2','p3'],'12:00',user);assert.equal(result.successCount,1);assert.equal(result.errors.length,2);assert.equal(f.writes.length,1)}finally{svc.StudentPermitService.markReturned=original}});
console.log(`${count} round-6 operation-session scenarios passed. Synthetic IO only.`);
