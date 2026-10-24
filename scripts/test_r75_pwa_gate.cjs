#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const source=fs.readFileSync('src/services/offline/pwaUpdateSafety.ts','utf8');
const result=ts.transpileModule(source,{fileName:'pwaUpdateSafety.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
let passed=0;
const test=async(name,setup,expected)=>{
 const {gate,calls,auth,storageState}=make(setup);
 let err;
 try {await gate(expected.withoutConsent ? undefined : async summary=>{
   calls.confirmations++;calls.summary=summary;
   if(expected.onDialog)expected.onDialog({auth,storageState});
   return expected.approved ?? true;
 });} catch(error) {err=error;}
 if(expected.message)assert.match(err?.message||'',new RegExp(expected.message));
 else assert.equal(err,undefined,`Unexpected rejection in ${name}`);
 if(expected.confirmations!==undefined)assert.equal(calls.confirmations,expected.confirmations);
 if(expected.flush!==undefined)assert.equal(calls.flush,expected.flush);
 if(expected.reads!==undefined)assert.equal(calls.reads,expected.reads);
 if(expected.summary)assert.deepEqual(JSON.parse(JSON.stringify(calls.summary)),expected.summary);
 console.log('PASS',name);passed++;
};
function make({uid='guru',drafts=0,queue=0,device=true,sending=false,activeForm=false,flushFailure=false,storageFailure=false,afterFirstReadSwitch=false}={}){
 const auth={currentUser:uid?{uid}:null};
 const storageState={drafts,queue,device,sending,queuePrefix:'op'};
 const calls={flush:0,reads:0,confirmations:0,summary:null};
 const OfflineStorage={
  getPendingCount:async id=>{calls.reads++;if(storageFailure)throw Error('IndexedDB failed');if(afterFirstReadSwitch && calls.reads===1)auth.currentUser={uid:'new'};assert.equal(id,uid);return {draftsCount:storageState.drafts,syncQueueCount:storageState.queue,total:storageState.drafts+storageState.queue}},
  getSyncItemsByUser:async(_,options)=>{assert.equal(options.strict,true);return Array.from({length:storageState.queue},(_,index)=>({operationId:storageState.queuePrefix+index,status:storageState.sending?'SENDING':'PENDING_NETWORK'}))},
  isTrustedDevice:()=>storageState.device,
 };
 const DraftService={flushPending:async()=>{calls.flush++;if(flushFailure)throw Error('Quota failure')}};
 const ctx={exports:{},require:id=>{
  if(id==='../firebase/firebaseAuth')return {auth};
  if(id==='./draftService')return {DraftService};
  if(id==='./offlineStorage')return {OfflineStorage};
  throw Error('Unexpected import '+id);
 },document:{querySelectorAll:()=>activeForm?[{getClientRects:()=>[{}]}]:[]}};
 vm.runInNewContext(result.outputText,ctx,{timeout:2000});
 return {gate:ctx.exports.ensurePwaUpdateSafe,calls,auth,storageState};
}
(async()=>{
 await test('Login screen skips storage',{uid:null},{flush:0,confirmations:0});
 await test('No pending data skips dialog',{}, {flush:1,reads:1,confirmations:0});
 await test('Pending draf requires React approval',{drafts:1},{confirmations:1,flush:2,reads:2,summary:{draftsCount:1,syncQueueCount:0}});
 await test('Pending queue requires React approval',{queue:2},{confirmations:1,reads:2,summary:{draftsCount:0,syncQueueCount:2}});
 await test('No confirmation callback blocks',{queue:1},{withoutConsent:true,message:'Konfirmasi update',confirmations:0});
 await test('User cancels silently',{drafts:1},{approved:false,message:'Pembaruan ditunda',confirmations:1,flush:1});
 await test('Sending data blocks before dialog',{sending:true,queue:1},{message:'Sedang mengirim',confirmations:0});
 await test('Shared device blocks queue',{queue:1,device:false},{message:'1 data/draf',confirmations:0});
 await test('Shared device blocks draft',{drafts:1,device:false},{message:'1 data/draf',confirmations:0});
 await test('Active form blocks before storage',{activeForm:true},{message:'Tutup atau simpan',flush:0});
 await test('Draft flush failure blocks',{flushFailure:true},{message:'belum dapat diverifikasi',confirmations:0});
 await test('Storage failure blocks',{storageFailure:true},{message:'belum dapat diverifikasi',confirmations:0});
 await test('Account switch before dialogue blocks',{queue:1,afterFirstReadSwitch:true},{message:'Akun berubah',confirmations:0});
 await test('Account changes while dialog open blocks',{queue:1},{message:'Akun berubah',onDialog:({auth})=>{auth.currentUser={uid:'changed'}}});
 await test('Queue count changes during dialog blocks',{queue:1},{message:'Jumlah data lokal berubah',onDialog:({storageState})=>{storageState.queue=2}});
 await test('New sending item after confirm blocks',{drafts:1,queue:1},{message:'Sedang mengirim',onDialog:({storageState})=>{storageState.sending=true}});
 await test('Queue identity changes with same count blocks',{queue:1},{message:'Antrean lokal berubah',onDialog:({storageState})=>{storageState.queuePrefix='another'}});
 await test('Device trust revoked during dialog blocks',{drafts:1},{message:'Perangkat bukan lagi',onDialog:({storageState})=>{storageState.device=false}});
 console.log(`R75 safety: ${passed}/18 PASS`);
})().catch(err=>{console.error(err);process.exitCode=1});
