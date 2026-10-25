#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const vm=require('node:vm');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const main=read('src/main.tsx');
const firestore=read('src/services/firebase/firestoreService.ts');
const feed=read('src/services/notifications/notificationFeedService.ts');
const bell=read('src/components/layout/NotificationBell.tsx');
const service=read('src/services/diagnostics/r86cListenerMetrics.ts');
const paths=['src/main.tsx','src/services/firebase/firestoreService.ts','src/services/notifications/notificationFeedService.ts','src/components/layout/NotificationBell.tsx','src/services/diagnostics/r86cListenerMetrics.ts'];
test('R86-A and B flags preserved',()=>{assert.match(main,/R86-A: explicit opt-in/);assert.match(main,/R86-B: visual-only coordination/);});
test('R86-C flag requires DEV or Preview and explicit URL flag',()=>{assert.match(main,/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_R86_LISTENER_AUDIT === 'enabled'/);assert.match(main,/get\('r86_listener_audit'\) === '1'/);});
test('R86-C metrics starts BEFORE React mount',()=>assert(main.indexOf('startR86CObservation();')<main.indexOf("createRoot(document.getElementById('root')!)")));
test('Collection subscription is tracked without changing query',()=>assert.match(firestore,/trackR86CListener\('collection', onSnapshot\(q, snapshot/));
test('Document subscription is tracked without changing SDK',()=>assert.match(firestore,/trackR86CListener\('document', onSnapshot\(doc\(db, collectionName, id\), snapshot/));
test('Both collection and document SDK stops retained',()=>assert((firestore.match(/active = false; unsubscribe\(\);/g)||[]).length>=2));
test('sharedLiveSource still retains its source pooling',()=>assert.match(firestore,/sharedLiveSource/));
test('Notification source specs remain and both histories retained',()=>{assert.match(feed,/announcementUpdates/);assert.match(feed,/includeMetadataChanges: true/);assert.match(feed,/trackR86CListener\(sourceKind, onSnapshot/);});
test('Notification subscribed cleanup still invokes every unsubscribe',()=>assert.match(feed,/cleanups\.forEach\(unsub => unsub\(\)\)/));
test('Bell realtime feed remains subscribed independent of visibility',()=>assert.match(bell,/return subscribeNotificationFeed\(uid, settings,/));
test('Bell outbox and online events remain',()=>{assert.match(bell,/flushNotificationOutbox\(\)/);assert.match(bell,/addEventListener\('online', connected\)/);});
test('Hidden optimization only controls local minute UI clock',()=>{assert.match(bell,/isR86COptimizationEnabled\(\) && document\.visibilityState !== 'visible'/);assert.match(bell,/window\.clearInterval\(timer\)/);assert.match(bell,/document\.addEventListener\('visibilitychange', reconcileClock\)/);});
test('No account identity or payload properties in diagnostic module',()=>assert.doesNotMatch(service,/currentUser|auth\.|localStorage|indexedDB|sessionStorage|\.uid|\.pin|\.nip|\.photo|\.documentId/i));
test('TS/TSX parses in all 5 changed/new source files',()=>{
 for (const file of paths){const code=read(file);const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,file+': '+ast.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; '));}
});
test('Transpile all 5 sources without syntax diagnostics',()=>{
 for (const file of paths){const r=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});assert.equal(r.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length||0,0,file);}
});
let apiMod;const fakeWindow={};
test('Metrics module loads without Firebase or side effects',()=>{
 const output=ts.transpileModule(service,{fileName:'r86cListenerMetrics.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};const ctx={exports,window:fakeWindow,document:{visibilityState:'visible'},Date,Map,Object,console};
 vm.runInNewContext(output,ctx,{filename:'r86cListenerMetrics.js'});apiMod=exports;
 assert.equal(fakeWindow.__PIKET_R86C__,undefined);assert.equal(apiMod.isR86COptimizationEnabled(),false);
});
test('Opt-in snapshot contains only category aggregate counts',()=>{
 const api=apiMod.startR86CObservation();const snap=api.snapshot();assert.equal(snap.version,'R86-C');assert.equal(snap.measuresFirestoreBilling,false);assert.deepEqual(Object.keys(snap.counters).sort(),['announcement','collection','document','notification']);assert.equal('uid' in snap,false);assert.strictEqual(fakeWindow.__PIKET_R86C__,api);
});
test('Tracks one SDK listener and event; SDK stop called once',()=>{
 let stops=0;const done=apiMod.trackR86CListener('collection',()=>stops++);
 apiMod.noteR86CEvent('collection');apiMod.noteR86CEvent('collection',true);
 let snap=fakeWindow.__PIKET_R86C__.snapshot().counters.collection;
 assert.equal(snap.active,1);assert.equal(snap.opened,1);assert.equal(snap.emissions,1);assert.equal(snap.errors,1);
 done();done();snap=fakeWindow.__PIKET_R86C__.snapshot().counters.collection;
 assert.equal(stops,1);assert.equal(snap.active,0);assert.equal(snap.closed,1);
});
test('Notifying one event does not add a Firebase read',()=>{
 apiMod.noteR86CEvent('notification');const snap=fakeWindow.__PIKET_R86C__.snapshot();assert.equal(snap.counters.notification.emissions,1);assert.equal(snap.measuresFirestoreBilling,false);
});
test('Stopping diagnostic never unsubscribes actual SDK listeners',()=>{
 let stopped=0;const done=apiMod.trackR86CListener('document',()=>stopped++);
 fakeWindow.__PIKET_R86C__.stop();assert.equal(stopped,0);assert.equal(fakeWindow.__PIKET_R86C__,undefined);assert.equal(apiMod.isR86COptimizationEnabled(),false);done();assert.equal(stopped,1);
});
test('With audit disabled wrapped SDK stop still called exactly once',()=>{
 let stopped=0;const done=apiMod.trackR86CListener('notification',()=>stopped++);done();done();assert.equal(stopped,1);
});
let pass=0;
for(const [name,fn] of tests){try{fn();pass++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
console.log(`R86-C: ${pass}/${tests.length} passed`);
