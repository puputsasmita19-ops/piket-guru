#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const cp=require('node:child_process');const assert=require('node:assert/strict');
const installer=fs.readFileSync(path.join(__dirname,'apply_r86c_safe.cjs'),'utf8');
const metrics=fs.readFileSync(path.join(__dirname,'../src/services/diagnostics/r86cListenerMetrics.ts'),'utf8');
const original={
'src/main.tsx':`import App from './App.tsx';
// R86-A: explicit opt-in diagnostic build AND URL flag
// R86-B: visual-only coordination, staging opt-in
createRoot(document.getElementById('root')!).render(<App />);
`,
'src/services/firebase/firestoreService.ts':`import { sharedLiveSource } from './sharedLiveSource';
const unsubscribe = onSnapshot(q, snapshot => {
}, error => { if (active) { received = true; fail(error); } });
const unsubscribe = onSnapshot(doc(db, collectionName, id), snapshot => {
}, error => { if (active) fail(error); });
`,
'src/services/notifications/notificationFeedService.ts':`import { OfflineStorage } from '../offline/offlineStorage';
subscribeNotificationFeed();
cleanups.push(onSnapshot(query(collection(db, spec.source), ...spec.filters), { includeMetadataChanges: true }, snap => {
    }, error => {
      if (stopped) return;
    }));
  }
  return OfflineStorage.registerListener(() => {});
`,
'src/components/layout/NotificationBell.tsx':`import React, { useEffect, useRef, useState } from 'react';
flushNotificationOutbox();
    // Expire the displayed history while the app stays open; no polling or network reads.
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); window.removeEventListener('storage', syncRead); };
`,
'src/services/diagnostics/r86cListenerMetrics.ts':metrics,
'scripts/apply_r86c_safe.cjs':installer,
};
let passed=0;const assertTest=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}};
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r86c-installer-'));
function makeFixture(label,change=(_name,body)=>body){
 const root=path.join(temp,label);for(const [name,body] of Object.entries(original)){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,change(name,body));}return root;
}
function run(root,args=[]){return cp.spawnSync(process.execPath,[path.join(root,'scripts/apply_r86c_safe.cjs'),...args],{encoding:'utf8'});}
function sourceSnapshot(root){return Object.fromEntries(Object.keys(original).map(n=>[n,fs.readFileSync(path.join(root,n),'utf8')]));}
try{
 const clean=makeFixture('clean');const initial=sourceSnapshot(clean);
 assertTest('dry-run verifies anchors without edits',()=>{const r=run(clean);assert.equal(r.status,0,r.stderr);assert.deepEqual(sourceSnapshot(clean),initial);});
 assertTest('apply edits exactly 4 sources and leaves diagnostics intact',()=>{
   const r=run(clean,['--apply']);assert.equal(r.status,0,r.stderr);
   const after=sourceSnapshot(clean);assert.notEqual(after['src/main.tsx'],initial['src/main.tsx']);
   for(const name of Object.keys(original).filter(n=>!n.endsWith('r86cListenerMetrics.ts')&&!n.endsWith('apply_r86c_safe.cjs')))assert.match(after[name],/R86-C: safe listener metrics/);
   assert.equal(after['src/services/diagnostics/r86cListenerMetrics.ts'],initial['src/services/diagnostics/r86cListenerMetrics.ts']);
 });
 assertTest('second apply is a no-op (idempotent)',()=>{const before=sourceSnapshot(clean);assert.equal(run(clean,['--apply']).status,0);assert.deepEqual(sourceSnapshot(clean),before);});
 const missing=makeFixture('missing-r86b',(n,s)=>n==='src/main.tsx'?s.replace('// R86-B: visual-only coordination, staging opt-in','// no R86-B'):s);
 assertTest('missing R86-B stops before any edits',()=>{const before=sourceSnapshot(missing);const r=run(missing,['--apply']);assert.notEqual(r.status,0);assert.deepEqual(sourceSnapshot(missing),before);});
 const mismatch=makeFixture('mismatch',(n,s)=>n==='src/components/layout/NotificationBell.tsx'?s.replace('Expire the displayed history','Old label'):s);
 assertTest('drifted NotificationBell fails closed before all edits',()=>{const before=sourceSnapshot(mismatch);const r=run(mismatch,['--apply']);assert.notEqual(r.status,0);assert.deepEqual(sourceSnapshot(mismatch),before);});
 const partial=makeFixture('partial',(n,s)=>n==='src/main.tsx'?s.replace('import App','// R86-C: safe listener metrics\nimport App'):s);
 assertTest('partial prior install stops before any edits',()=>{const before=sourceSnapshot(partial);const r=run(partial,['--apply']);assert.notEqual(r.status,0);assert.deepEqual(sourceSnapshot(partial),before);});
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(`R86-C installer: ${passed}/6 passed`);
