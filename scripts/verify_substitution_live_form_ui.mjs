// Actual React form and listener lifecycle; synthetic database callbacks only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const deps=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=deps('playwright-core'),chromium=deps('@sparticuz/chromium').default;
const icons=[...fs.readFileSync('src/components/icons/index.ts','utf8').matchAll(/export \{ (\w+) \}/g)].map(m=>m[1]);
const mocks={
 auth:`export const useAuth=()=>({currentUser:{id:'test',role:'ADMIN'}});`,
 icons:`import React from'react';${icons.map(n=>`export const ${n}=()=> <svg aria-hidden="true"/>;`).join('')}`,
 sdk:`export const where=(field,op,value)=>({field,op,value});`,
 service:`export const SubstitutionService={checkSubstituteConflict:()=>({hasConflict:false})};`,
 store:`export class FirestoreService{static getAll(){throw Error('Unbounded query forbidden')}static subscribeToCollection(collection,cb,onError,constraints=[]){const f=window.fixture;const listener={collection,cb,onError,constraints,stopped:false};f.listeners.push(listener);if(collection==='students')queueMicrotask(()=>cb([]));return()=>{listener.stopped=true}}}`,
};
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{SubstitutionFormModal}from'./src/features/substitutions/SubstitutionFormModal';function App(){const[open,setOpen]=useState(true);window.fixture.setOpen=setOpen;return <SubstitutionFormModal isOpen={open} onClose={()=>setOpen(false)} teachers={[]}/>};createRoot(document.getElementById('root')).render(<App/>);`;
const result=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'synthetic-io',setup(b){for(const[filter,path]of [[/AuthContext$/,'auth'],[/\/icons$/,'icons'],[/^firebase\/firestore$/,'sdk'],[/substitutionService$/,'service'],[/firestoreService$/,'store']])b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const server=http.createServer((req,res)=>{if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');return res.end(result.outputFiles[0].text)}res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>window.fixture={listeners:[]}</script><script src="/probe.js"></script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.fixture.listeners.some(l=>l.collection==='substitutions'));
 check('opening the mobile form queries only the selected date',await page.evaluate(()=>{const a=window.fixture.listeners.filter(l=>l.collection==='substitutions');return a.length===1&&a[0].constraints.length===1&&a[0].constraints[0].field==='tanggal'&&a[0].constraints[0].op==='=='}));
 await page.locator('input[type=date]').fill('2026-10-20');await page.waitForFunction(()=>window.fixture.listeners.filter(l=>l.collection==='substitutions').length===2);
 check('changing date stops the old listener and binds the new date',await page.evaluate(()=>{const a=window.fixture.listeners.filter(l=>l.collection==='substitutions');return a[0].stopped&&!a[1].stopped&&a[1].constraints[0].value==='2026-10-20'}));
 await page.evaluate(()=>{const a=window.fixture.listeners.filter(l=>l.collection==='substitutions');a[0].onError(Error('late old-date failure'));a[0].cb([{id:'stale',tanggal:'2026-10-19'}])});
 check('late errors from the previous date do not alter the current form',await page.getByRole('status').count()===0);
 await page.evaluate(()=>window.fixture.listeners.filter(l=>l.collection==='substitutions').at(-1).onError(Error('unavailable')));await page.getByRole('status').waitFor();
 check('current query failure gives a readable recovery message',await page.getByRole('status').innerText().then(v=>v.includes('sinkronisasi')));
 await page.evaluate(()=>window.fixture.listeners.filter(l=>l.collection==='substitutions').at(-1).cb([]));await page.getByRole('status').waitFor({state:'detached'});check('live recovery clears the warning without a reload',true);
 await page.evaluate(()=>window.fixture.setOpen(false));await page.waitForFunction(()=>window.fixture.listeners.every(l=>l.stopped));check('closing the form cleans up both master and day listeners',true);
 check('form lifecycle has no unhandled runtime errors',errors.length===0);console.log(`${count} substitution form browser scenarios passed. No production IO.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
