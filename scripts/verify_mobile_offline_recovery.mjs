// Real browser IndexedDB, lifecycle and queue engine. Only business/Firebase IO is mocked.
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const dep=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=dep('playwright-core'), chromium=dep('@sparticuz/chromium').default;
const mocks={
 auth:`export const auth={get currentUser(){return{uid:window.fixture.user.id}}};`,
 context:`export const useAuth=()=>({currentUser:window.fixture.user,isOfflineSession:false,revalidateSessionOnline:async()=>true});`,
 tardy:`export const StudentTardyService={saveTardyStudent:async record=>{if(window.fixture.fail)throw Object.assign(Error('network unavailable'),{code:'unavailable'});const res=await fetch('/write',{method:'POST',body:JSON.stringify(record)});if(!res.ok)throw Error('network unavailable')}};`,
};
const entry=`import React from'react';import{createRoot}from'react-dom/client';import{OfflineStorage}from'./src/services/offline/offlineStorage';import{DraftService}from'./src/services/offline/draftService';import{SyncQueueService}from'./src/services/offline/syncQueueService';import{useAutomaticSync}from'./src/hooks/useAutomaticSync';window.test={OfflineStorage,DraftService,SyncQueueService};function App(){useAutomaticSync();return <p>Queue probe</p>};if(new URLSearchParams(location.search).has('auto'))createRoot(document.getElementById('root')).render(<App/>);`;
const output=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'mock-io',setup(b){
 for(const[path,filter]of[['auth',/\/(?:firebase|firebaseAuth)$/],['context',/AuthContext$/],['tardy',/studentTardyService$/]])b.onResolve({filter},()=>({path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
 // Unused operation executors cannot initialize real Firebase during this probe.
 b.onResolve({filter:/\/(?:attendanceService|dutyBookService|incidentService|studentPermitService|visitorService|substitutionService|firestoreService)$/},()=>({path:'unused',namespace:'unused'}));
 b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export const AttendanceService={};export const DutyBookService={};export const IncidentService={};export const StudentPermitService={};export const VisitorService={};export const SubstitutionService={};export const FirestoreService={};',loader:'js'}));
}}]});
const writes=[];const server=http.createServer(async(req,res)=>{
 if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');return res.end(output.outputFiles[0].text)}
 if(req.url==='/write'){let body='';for await(const c of req)body+=c;writes.push(JSON.parse(body));return setTimeout(()=>res.end('ok'),200)}
 if(req.url.startsWith('/manifest.json'))return res.end('{}');
 res.end(`<!doctype html><div id="root"></div><script>window.fixture={user:{id:new URLSearchParams(location.search).get('uid')||'a',fullName:'Uji',role:'GURU_PIKET',isActive:true},fail:false}</script><script src="/probe.js"></script>`);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const context=await browser.newContext(),page=await context.newPage();const poll=async fn=>{for(let i=0;i<300;i++){if(await page.evaluate(fn))return;await page.waitForTimeout(100)}throw Error('Timed out waiting for queue state')};page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')console.log('BROWSER',msg.text())});
 await page.goto(url);await page.waitForFunction(()=>window.test);await page.evaluate(()=>window.test.OfflineStorage.setTrustedDevice(true));
 await context.setOffline(true);
 await page.evaluate(async()=>{
  const t=window.test;t.DraftService.saveDraftDebounced('a','INCIDENT','draft',{note:'Terakhir diketik'}, {photo:new Blob(['photo'],{type:'image/jpeg'})},60000);
  Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
  await t.SyncQueueService.enqueue(window.fixture.user,'TARDY_REPORT','studentTardiness','record-a',{id:'record-a'});
 });
 await poll(async()=>!!(await window.test.DraftService.getDraft('a','INCIDENT','draft')));
 check('backgrounding flushes a debounced draft with its photo',await page.evaluate(async()=>{const d=await window.test.DraftService.getDraft('a','INCIDENT','draft');return d.data.note==='Terakhir diketik'&&d.attachments.photo.size===5}));
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>window.test);
 check('committed queue and draft survive a browser reload',await page.evaluate(async()=>{const t=window.test;return(await t.OfflineStorage.getSyncItemsByUser('a')).length===1&&!!await t.DraftService.getDraft('a','INCIDENT','draft')}));
 await page.goto(url+'/?uid=b&auto');await page.waitForTimeout(1000);
 check('a different account cannot read or send the first account queue',await page.evaluate(async()=>(await window.test.OfflineStorage.getSyncItemsByUser('b')).length===0)&&writes.length===0);
 await page.goto(url+'/?uid=a&auto');await poll(async()=>(await window.test.OfflineStorage.getSyncItemsByUser('a')).length===0);
 check('opening the owner session automatically synchronizes exactly once '+JSON.stringify(writes),writes.length===1&&writes[0].id==='record-a');
 await page.goto(url+'/?uid=a');await page.waitForFunction(()=>window.test);
 const abort=await page.evaluate(async()=>{
  const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value){const request=original.call(this,value);if(this.name==='syncQueue')request.addEventListener('success',()=>this.transaction.abort());return request};
  let failed=false;try{await window.test.SyncQueueService.enqueue(window.fixture.user,'TARDY_REPORT','studentTardiness','aborted',{id:'aborted'})}catch{failed=true}finally{IDBObjectStore.prototype.put=original}return failed;
 });check('an aborted IndexedDB transaction never reports queued success',abort);
 await page.evaluate(async()=>{const t=window.test;await t.SyncQueueService.enqueue(window.fixture.user,'TARDY_REPORT','studentTardiness','stale',{id:'stale'});const [item]=await t.OfflineStorage.getSyncItemsByUser('a');item.status='SENDING';item.updatedAt=new Date(Date.now()-180000).toISOString();await t.OfflineStorage.updateSyncItem(item)});
 await page.goto(url+'/?uid=a&auto');await poll(async()=>(await window.test.OfflineStorage.getSyncItemsByUser('a')).length===0);
 check('stale SENDING work recovers after interrupted delivery',writes.filter(w=>w.id==='stale').length===1);
 await page.goto(url+'/?uid=a');await page.waitForFunction(()=>window.test);
 await page.evaluate(async()=>{window.fixture.fail=true;const t=window.test;await t.SyncQueueService.enqueue(window.fixture.user,'TARDY_REPORT','studentTardiness','retry',{id:'retry'});for(let i=0;i<6;i++){const item=(await t.OfflineStorage.getSyncItemsByUser('a'))[0];item.nextRetryAt=0;await t.OfflineStorage.updateSyncItem(item);await t.SyncQueueService.triggerSync(window.fixture.user)}});
 check('network interruptions stay pending instead of requiring manual retries after five failures',await page.evaluate(async()=>(await window.test.OfflineStorage.getSyncItemsByUser('a'))[0].status==='PENDING_NETWORK'));
 // Restore without reloading, exactly as mobile connectivity recovery does.
 await page.goto(url+'/?uid=a&auto');await page.waitForTimeout(700);
 await context.setOffline(true);await context.setOffline(false);await poll(async()=>(await window.test.OfflineStorage.getSyncItemsByUser('a')).length===0);
 check('online event resumes delivery without refreshing the page',writes.filter(w=>w.id==='retry').length===1);
 const a=await page.evaluate(()=>window.test.OfflineStorage.syncLease('a','one')),b=await page.evaluate(()=>window.test.OfflineStorage.syncLease('a','two'));check('atomic lease rejects a second owner while the first lease is active',a&&!b);
 await page.evaluate(()=>window.test.OfflineStorage.syncLease('a','one',true));
 check('drafts are preserved after queue processing',await page.evaluate(async()=>!!await window.test.DraftService.getDraft('a','INCIDENT','draft')));
 console.log(`${count} mobile persistence/recovery checks passed, no production services.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
