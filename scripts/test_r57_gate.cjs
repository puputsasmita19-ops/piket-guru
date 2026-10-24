#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const cp = require('node:child_process');
let ts;
try {ts = require('typescript');} catch {ts = require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const source = fs.readFileSync(path.resolve(__dirname,'r57_templates/pwaUpdateSafety.ts.template'),'utf8');
const result = ts.transpileModule(source,{fileName:'pwaUpdateSafety.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'R57 TypeScript syntax must pass');
const make = ({uid='teacher',drafts=0,queued=0, sending=false, trusted=true, confirm=true, modal=false, flushError=false, countError=false, switchUser=false}={})=>{
 const auth={currentUser: uid ? {uid} : null};
 const calls={flush:0,count:0,queue:0,prompts:0};
 const OfflineStorage = {
  getPendingCount: async id=>{calls.count++; assert.equal(id,uid);if(countError)throw Error('IndexedDB inaccessible');return {syncQueueCount:queued,draftsCount:drafts,total:queued+drafts};},
  getSyncItemsByUser: async(id,options)=>{calls.queue++; assert.equal(id,uid);assert.equal(options.strict,true);return sending?[{status:'SENDING'}]:[];},
  isTrustedDevice:()=>trusted,
 };
 const DraftService = {flushPending:async id=>{calls.flush++;assert.equal(id,uid);if(flushError)throw Error('quota exceeded');if(switchUser)auth.currentUser={uid:'other'};}};
 const context={exports:{},require:id=>{
  if(id==='../firebase/firebaseAuth')return {auth};
  if(id==='./draftService')return {DraftService};
  if(id==='./offlineStorage')return {OfflineStorage};
  throw Error('Unexpected import:'+id);
 },document:{querySelectorAll:()=>modal?[{getClientRects:()=>[{}]}]:[]},window:{confirm:()=>{calls.prompts++;return confirm}},console};
 vm.runInNewContext(result.outputText,context,{timeout:1200});
 return {gate:context.exports.ensurePwaUpdateSafe,calls};
};
async function run(){
 let passed=0;
 const caseTest=async(name,settings,expectation)=>{
  const {gate,calls}=make(settings);
  if(expectation.error) await assert.rejects(gate(),e=>typeof e.message==='string' && e.message.includes(expectation.error));
  else await gate();
  if(expectation.prompts!==undefined)assert.equal(calls.prompts,expectation.prompts);
  if(expectation.flush!==undefined)assert.equal(calls.flush,expectation.flush);
  console.log('PASS',name);passed++;
 };
 await caseTest('login without user does not touch private queue',{uid:null},{flush:0});
 await caseTest('open modal blocks update before storage I/O',{modal:true},{error:'Tutup atau simpan',flush:0});
 await caseTest('account with no unsaved data can update',{}, {flush:1,prompts:0});
 await caseTest('actively sending entry blocks reload',{sending:true},{error:'Sedang mengirim',prompts:0});
 await caseTest('pending queue on shared device blocks reload',{trusted:false,queued:2},{error:'2 data/draf',prompts:0});
 await caseTest('drafts on shared device block reload',{trusted:false,drafts:1},{error:'1 data/draf',prompts:0});
 await caseTest('trusted device can defer pending update',{trusted:true,queued:1,confirm:false},{error:'Pembaruan ditunda',prompts:1});
 await caseTest('trusted device confirms persisted queue explicitly',{trusted:true,queued:1,drafts:2,confirm:true},{prompts:1});
 await caseTest('failed draft flush blocks reload',{flushError:true},{error:'belum dapat diverifikasi',prompts:0});
 await caseTest('unreadable offline storage blocks reload',{countError:true},{error:'belum dapat diverifikasi',prompts:0});
 await caseTest('session switches during flush blocks reload',{switchUser:true},{error:'Akun berubah',prompts:0});
 console.log(`R57 gate unit tests: ${passed}/11 passed`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
