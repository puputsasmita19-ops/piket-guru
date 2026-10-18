import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
const f={uid:'a',sources:[],stops:0,cache:new Map(),pending:[],delay:false,cleanups:new Set()};
const mocks={
 firebase:`export const auth={get currentUser(){return{uid:globalThis.f.uid}}};export const db={};`,
 sdk:`export const collection=(db,path)=>({path}),doc=(db,col,id)=>({path:col+'/'+id});export const query=(ref,...constraints)=>({...ref,constraints});export const queryEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);export function onSnapshot(ref,next,error){const source={ref,next,error};globalThis.f.sources.push(source);return()=>{source.closed=true;globalThis.f.stops++}};export const getDocs=async()=>{throw Error('offline')};export const getDoc=async()=>{};export const getDocFromServer=getDoc;export const where=(...values)=>values;export const orderBy=where;export const limit=where;export const startAfter=where;export const getCountFromServer=getDoc;export const setDoc=getDoc;export const updateDoc=getDoc;export const deleteDoc=getDoc;export const serverTimestamp=()=>0;export const deleteField=()=>0;export const writeBatch=()=>({});export const runTransaction=async()=>{};`,
 offline:`export const OfflineStorage={getScopedCache:async(uid,key)=>globalThis.f.delay?new Promise(r=>globalThis.f.pending.push(r)):globalThis.f.cache.get(uid+':'+key),setScopedCache:async(uid,key,data)=>{globalThis.f.cache.set(uid+':'+key,{data})},registerListener:fn=>{globalThis.f.cleanups.add(fn);return()=>{globalThis.f.cleanups.delete(fn);fn()}},purgeLegacyUnscopedCaches(){}};`,
 audit:`export const AuditService={log:async()=>{}};`,
};
const result=await build({entryPoints:['src/services/firebase/firestoreService.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'mock',setup(b){for(const[path,filter]of[['firebase',/\/firebase$/],['sdk',/^firebase\/firestore$/],['offline',/offlineStorage$/],['audit',/auditService$/]])b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const context=vm.createContext({f,module:{exports:{}},console,Date,setTimeout,clearTimeout});vm.runInContext(result.outputFiles[0].text,context);const {FirestoreService:s}=context.module.exports;
const tick=()=>new Promise(r=>setTimeout(r,0));let count=0;
const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
let a,b;const offA=s.subscribeToDocument('settings','school_config',x=>a=x),offB=s.subscribeToDocument('settings','school_config',x=>b=x);
check('identical settings listeners share one SDK source',f.sources.length===1);f.sources[0].next({exists:()=>true,id:'school_config',data:()=>({schoolName:'Terbaru'})});check('shared source delivers a live change to all readers',a.schoolName==='Terbaru'&&b.schoolName==='Terbaru');
offA();check('one reader leaving does not disconnect another reader',f.stops===0);offB();check('last reader closes the SDK subscription',f.stops===1);
f.delay=true;const values=[];const stop=s.subscribeToCollection('attendance',items=>values.push(items),undefined,[['tanggal','==','2026-10-18']],{cacheKey:'today:2026-10-18'});
f.sources.at(-1).next({docs:[{id:'new',data:()=>({isDemo:false,dataSource:'PRODUCTION',tanggal:'2026-10-18'})}]});f.pending.shift()({data:[{id:'old',tanggal:'2020-01-01'}]});await tick();
check('late cache never overwrites a newer live snapshot',values.length===1&&values[0][0].id==='new');
check('bounded data persists under the exact view key',f.cache.has('a:attendance:query:today:2026-10-18')&&!f.cache.has('a:attendance'));
stop();f.delay=false;
let errors=0;const unrelated=[];const off=s.subscribeToCollection('attendance',items=>unrelated.push(items),()=>errors++,[['tanggal','==','2026-09-01']]);await tick();check('a different bounded query never receives a collection cache',unrelated.length===0);f.sources.at(-1).error(Object.assign(Error('permission-denied'),{code:'permission-denied'}));await tick();check('permission failures are reported instead of replaced with stale records',errors===1&&unrelated.length===0);off();
const late=[];f.delay=true;const end=s.subscribeToCollection('teachers',items=>late.push(items));end();f.uid='b';f.pending.shift()({data:[{id:'private-a'}]});await tick();check('unsubscribe/account switch blocks late private cache callbacks',late.length===0);
console.log(`${count} realtime subscription/cache checks passed, no external IO.`);
