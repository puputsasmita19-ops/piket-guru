// Actual report aggregation and Drive client/helper. All authentication/HTTP IO is synthetic.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
const f={uid:'a',requests:[],reply:null,tokenGate:null,jsonGate:null,blobGate:null,digestGate:null,digestStarted:false,urls:0,status:200};
const mockedAuth=`export const auth={get currentUser(){const uid=globalThis.f.uid;return uid?{uid,getIdToken:async()=>{if(globalThis.f.tokenGate)await globalThis.f.tokenGate;return 'TEST-'+uid}}:null}};`;
const built=await build({stdin:{contents:"export{ReportService}from'./src/services/reports/reportService';export{DriveClientService}from'./src/services/drive/driveClientService';export{processPhotoForStorage,processMultiplePhotosForStorage}from'./src/services/drive/photoUploadHelper';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'synthetic-auth',setup(b){b.onResolve({filter:/\/(?:firebase|firebaseAuth)$/},()=>({path:'auth',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mockedAuth,loader:'js'}));}}]});
const context=vm.createContext({f,module:{exports:{}},TextEncoder,Blob,console:{warn(){},error(){},log(){}},crypto:{subtle:{digest:async(...args)=>{f.digestStarted=true;if(f.digestGate)await f.digestGate;return webcrypto.subtle.digest(...args)}}},URL:{createObjectURL:()=>{f.urls++;return 'blob:test-only'}},fetch:async(url,options)=>{
 const request={url,options};f.requests.push(request);const status=f.status,reply=f.reply|| (url.includes('storage-status')?{success:true,enabled:true,configuredInEnv:true,status:'CONNECTED'}:{success:true,fileId:'file',photoUrl:'/api/drive/photo/file',mimeType:'image/jpeg',size:4});
 return{ok:status>=200&&status<300,status,json:async()=>{if(f.jsonGate)await f.jsonGate;return reply},blob:async()=>{if(f.blobGate)await f.blobGate;return new Blob(['TEST'],{type:'image/jpeg'})}};
}});vm.runInContext(built.outputFiles[0].text,context);
const {ReportService:reports,DriveClientService:drive,processPhotoForStorage:photo,processMultiplePhotosForStorage:photos}=context.module.exports;
let count=0;async function check(name,fn){await fn();count++;console.log('PASS',name)}
const month=['2026-10-01','2026-10-31'];
const teacher=(i,extra={})=>({id:'t-'+i,userId:'u-'+i,fullName:'apt. Guru '+i,nip:'NIP-'+i,...extra});
const att=(i,extra={})=>({id:'att-'+i,userId:'u-'+i,userName:'apt. Guru '+i,tanggal:'2026-10-19',status:'DALAM_LOKASI',...extra});
const schedule=(i,extra={})=>({id:'sch-'+i,petugasId:'u-'+i,petugasName:'apt. Guru '+i,tanggal:'2026-10-19',...extra});
const summary=(teachers,attendance,schedules=[])=>reports.getTeacherAttendanceSummary(schedules,attendance,teachers,...month);
await check('40 teachers sharing the apt. prefix retain their own attendance and shifts',()=>{
 const teachers=Array.from({length:40},(_,i)=>teacher(i)),attendance=Array.from({length:40},(_,i)=>att(i)),schedules=teachers.map((_,i)=>schedule(i));const result=summary(teachers,attendance,schedules);assert.equal(result.length,40);assert.ok(result.every(r=>r.hadir===1&&r.totalShift===1&&r.percentage===100));
});
await check('master ID and linked Firebase UID both resolve, even when the name changed',()=>{
 const result=summary([teacher(1)], [att(1,{userName:'Nama lama'}),att(1,{id:'second',userId:'t-1',userName:'Lama'})],[schedule(1),schedule(1,{petugasId:'t-1'})]);assert.equal(result[0].hadir,2);assert.equal(result[0].totalShift,2);
});
await check('a known ID always wins over a misleading same-prefix or other-person name',()=>{
 const result=summary([teacher(1),teacher(2)],[att(1,{userName:'apt. Guru 2'})],[schedule(1,{petugasName:'apt. Guru 2'})]);assert.equal(result[0].hadir,1);assert.equal(result[1].hadir,0);
});
await check('old unlinked masters can use exact unique full names, never partial names',()=>{
 const result=summary([teacher(1,{userId:undefined,fullName:'  Dian Alamsyah  '})],[att(1,{userId:'legacy-user',userName:'dian   ALAMSYAH'}),att(2,{userId:undefined,userName:'Dian'})]);assert.equal(result[0].hadir,1);
});
await check('an unmatched supplied UID cannot override a different explicit account link',()=>{assert.equal(summary([teacher(1)],[att(2,{userName:'apt. Guru 1'})])[0].hadir,0)});
await check('ambiguous identical full names and duplicated account links are not guessed',()=>{
 const duplicateNames=summary([teacher(1,{userId:undefined,fullName:'Sama'}),teacher(2,{userId:undefined,fullName:'Sama'})],[att(1,{userId:undefined,userName:'Sama'})]);assert.ok(duplicateNames.every(r=>r.hadir===0));
 const duplicateUids=summary([teacher(1,{userId:'same'}),teacher(2,{userId:'same'})],[att(1,{userId:'same'})]);assert.ok(duplicateUids.every(r=>r.hadir===0));
});
await check('seed/archive filters and attendance percentage arithmetic stay intact',()=>{
 const result=summary([teacher(1),teacher(2,{isDemo:true})],[att(1),att(1,{status:'DI_LUAR_LOKASI'}),att(1,{isDemo:true}),att(1,{tanggal:'2026-09-30'})],[schedule(1),schedule(1),schedule(1),schedule(1,{tanggal:'2026-11-01'})]);assert.equal(result.length,1);assert.equal(result[0].hadir,1);assert.equal(result[0].terlambatOrOutside,1);assert.equal(result[0].totalShift,3);assert.equal(result[0].tidakHadir,1);assert.equal(result[0].percentage,33);
});
await check('aggregation avoids repeatedly scanning every teacher name for 1000 records',()=>{
 let nameReads=0;const teachers=Array.from({length:40},(_,i)=>{const t=teacher(i);Object.defineProperty(t,'fullName',{get(){nameReads++;return 'apt. Guru '+i}});return t});const records=Array.from({length:1000},(_,i)=>att(i%40,{id:'record-'+i}));const result=summary(teachers,records);assert.ok(result.every(r=>r.hadir===25));assert.ok(nameReads<300,'Names should be indexed once, not scanned 40,000 times: '+nameReads);
});
await check('records missing their operational date are excluded from period totals',()=>{const result=summary([teacher(1)],[att(1,{tanggal:undefined})],[schedule(1,{tanggal:undefined})]);assert.equal(result[0].hadir,0);assert.equal(result[0].totalShift,1)});
const gate=()=>{let release;const promise=new Promise(r=>release=r);return{promise,release}};
const settle=async predicate=>{for(let i=0;i<80;i++){if(predicate())return;await Promise.resolve()}throw Error('Synthetic stage did not start')};
const reset=()=>{f.uid='a';f.requests=[];f.reply=null;f.tokenGate=f.jsonGate=f.blobGate=f.digestGate=null;f.digestStarted=false;f.urls=0;f.status=200};
await check('signed-out Drive operations never send an unauthenticated request',async()=>{reset();f.uid=null;await assert.rejects(drive.getStorageStatus(),/Sesi/);await assert.rejects(drive.uploadPhoto({base64:'data:image/jpeg;base64,TEST',module:'attendance'}),/Sesi/);assert.equal(f.requests.length,0)});
await check('account switch while obtaining a token cancels read, upload, disconnect and toggle before HTTP',async()=>{
 for(const action of [()=>drive.getStatus(),()=>drive.uploadPhoto({base64:'data:image/jpeg;base64,TEST',module:'attendance'}),()=>drive.disconnect(),()=>drive.toggleStorage(true)]){reset();const g=gate();f.tokenGate=g.promise;const pending=action();f.uid='b';g.release();await assert.rejects(pending,/akun telah berubah/);assert.equal(f.requests.length,0)}
});
await check('twenty parallel storage-policy consumers share one in-flight GET, then read fresh policy',async()=>{
 reset();const g=gate();f.jsonGate=g.promise;const pending=Array.from({length:20},()=>drive.getStorageStatus());await settle(()=>f.requests.length===1);g.release();const values=await Promise.all(pending);assert.ok(values.every(v=>v.enabled));assert.equal(f.requests.length,1);f.jsonGate=null;f.reply={success:true,enabled:false};assert.equal((await drive.getStorageStatus()).enabled,false);assert.equal(f.requests.length,2);
});
await check('a failed shared policy request is removed so a later retry can recover',async()=>{reset();f.status=503;await assert.rejects(drive.getStorageStatus());f.status=200;assert.equal((await drive.getStorageStatus()).enabled,true);assert.equal(f.requests.length,2)});
await check('old policy response cannot be returned after switching accounts',async()=>{reset();const g=gate();f.jsonGate=g.promise;const pending=drive.getStorageStatus();await settle(()=>f.requests.length===1);f.uid='b';g.release();await assert.rejects(pending,/akun telah berubah/);f.jsonGate=null;assert.equal((await drive.getStorageStatus()).enabled,true);assert.equal(f.requests.length,2)});
await check('photo bytes arriving for a previous account never become an object URL',async()=>{reset();const g=gate();f.blobGate=g.promise;const pending=drive.getAuthenticatedPhotoUrl('/api/drive/photo/test');await settle(()=>f.requests.length===1);await Promise.resolve();f.uid='b';g.release();await assert.rejects(pending,/akun telah berubah/);assert.equal(f.urls,0)});
await check('account switch during photo hashing prevents upload under the new account',async()=>{reset();const g=gate();f.digestGate=g.promise;const pending=photo('data:image/jpeg;base64,TEST','attendance','same-photo','same-record');await settle(()=>f.digestStarted);f.uid='b';g.release();await assert.rejects(pending,/akun telah berubah/);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0)});
await check('a switched session cannot confirm upload success or continue a photo group',async()=>{
 reset();const g=gate();f.tokenGate=g.promise;const pending=photos([{id:'one',url:'data:image/jpeg;base64,ONE'},{id:'two',url:'data:image/jpeg;base64,TWO'}],'incidents','record');f.uid='b';g.release();await assert.rejects(pending,/akun telah berubah/);assert.equal(f.requests.length,0);
});
await check('transient upload errors preserve the failure result instead of claiming success',async()=>{reset();f.status=503;f.reply={success:false,error:'temporary network failure'};const result=await drive.uploadPhoto({base64:'data:image/jpeg;base64,TEST',module:'attendance'});assert.equal(result.success,false);assert.match(result.error,/network/)});
await check('Drive diagnostics cannot report success on an HTTP failure',async()=>{reset();f.status=503;f.reply={success:true,message:'wrong payload'};assert.equal((await drive.testConnection()).success,false)});
console.log(`${count} report/session/Drive regression scenarios passed. Synthetic IO only; not a production load benchmark.`);
