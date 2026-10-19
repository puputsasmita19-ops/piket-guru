// Optional DOM regressions. Install jsdom + @testing-library/dom in an isolated
// tools folder and set PIKET_UI_TEST_NODE_MODULES to its node_modules directory.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const dep=(name)=>require(process.env.PIKET_UI_TEST_NODE_MODULES ? process.env.PIKET_UI_TEST_NODE_MODULES+'/'+name : name);
const {JSDOM}=dep('jsdom');
const {within,waitFor}=dep('@testing-library/dom');
const mocks={
 firebase:`export const auth={currentUser:null};`,
 sdk:`import{auth}from'firebase';const f=window.fixture;f.emitUser=(u)=>{auth.currentUser=u;for(const cb of [...f.authCallbacks])void cb(u)};export function onAuthStateChanged(a,cb){f.authSubscriptions++;f.authCallbacks.add(cb);queueMicrotask(()=>{if(f.authCallbacks.has(cb))void cb(auth.currentUser)});return()=>{f.authCallbacks.delete(cb);f.authUnsubscribes++}};export async function signOut(){f.signOuts++;f.emitUser(null)};export async function signInWithCustomToken(){const u=f.firebaseUser(f.loginUid);f.emitUser(u);return{user:u}};export class GoogleAuthProvider{setCustomParameters(){}};export async function signInWithPopup(){if(f.popupPromise)await f.popupPromise;if(f.popupError)throw Object.assign(Error(f.popupError),{code:f.popupError});const u=f.firebaseUser(f.loginUid);f.emitUser(u);return{user:u}};`,
 store:`const f=window.fixture;export class FirestoreService{static async getByIdStrict(c,id){f.strictReads++;if(f.deferProfile[id])return f.deferProfile[id];if(f.readError)throw Object.assign(Error(f.readError),{code:f.readError});return f.profiles[id]||null}static subscribeToDocument(c,id,cb){f.profileSubscriptions++;f.profileCallbacks.set(id,cb);queueMicrotask(()=>{if(f.profileSubscriptions<8&&f.profileCallbacks.get(id)===cb)cb(f.profiles[id]||null)});return()=>{f.profileUnsubscribes++;if(f.profileCallbacks.get(id)===cb)f.profileCallbacks.delete(id)}}}`,
 offline:`const f=window.fixture;export const OfflineStorage={isTrustedDevice:()=>f.trusted!==false,setTrustedDevice(v){f.trusted=v},teardownActiveListeners(){f.teardowns++},clearDisplayCacheOnly:async()=>{},getPendingCount:async()=>{if(f.inspectionGate)await f.inspectionGate;if(f.failInspection)throw Error('TEST_STORAGE_UNAVAILABLE');return{total:f.pending,syncQueueCount:f.pending,draftsCount:0}},purgeUserData:async()=>{f.purges++},getVerifiedProfile:async id=>f.verified[id]||null,saveVerifiedProfile:async p=>{f.verified[p.id]=p}};`,
 queue:`export const SyncQueueService={cancelSync(){},refreshStatus:async()=>{},triggerSync:async()=>{window.fixture.syncs++}};`,
 bootstrap:`export const preloadAuthenticatedShell=()=>{};`,
 audit:`export const AuditService={log:async()=>{},recordLogin:async()=>{},recordLogout:async()=>{},recordLoginFailure:async()=>{}};`,
};
const result=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{AuthProvider,useAuth}from'./src/contexts/AuthContext';import{GuideProvider,useGuide}from'./src/contexts/GuideContext';import{ViewErrorBoundary}from'./src/components/common/ViewErrorBoundary';const root=createRoot(document.getElementById('root'));function Probe(){const a=useAuth();window.testAuth=a;window.testGuide=useGuide();return <div><span data-testid="user">{a.currentUser?.id||'signed-out'}</span><span data-testid="loading">{String(a.isLoading)}</span></div>}root.render(<AuthProvider><GuideProvider><Probe/></GuideProvider></AuthProvider>);window.unmount=()=>root.unmount();function Broken(){throw Error('Test view error')}window.renderBoundary=(key,broken)=>root.render(<ViewErrorBoundary resetKey={key}>{broken?<Broken/>:<p>Dashboard ready</p>}</ViewErrorBoundary>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'mock-io',setup(b){
 for(const[path,filter]of[['firebase',/\/(?:firebase|firebaseAuth)$/],['firebase',/^firebase$/],['sdk',/^firebase\/auth$/],['store',/firestoreService$/],['offline',/offlineStorage$/],['queue',/syncQueueService$/],['audit',/auditService$/],['bootstrap',/appBootstrap$/]])b.onResolve({filter},()=>({path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));
}}]});
const profile=id=>({id,fullName:'Test '+id,role:'GURU',permissions:['dashboard.view'],isActive:true,sessionRevokedAtSeconds:0});
function setup(){
 const f={authCallbacks:new Set(),authSubscriptions:0,authUnsubscribes:0,strictReads:0,profileSubscriptions:0,profileUnsubscribes:0,profileCallbacks:new Map(),profiles:{teacher:profile('teacher'),other:profile('other')},deferProfile:{},verified:{},signOuts:0,teardowns:0,purges:0,pending:0,syncs:0,loginUid:'teacher',requests:[],popupPromise:null,popupError:null,readError:null,
 firebaseUser:id=>({uid:id,email:id+'@example.invalid',getIdTokenResult:async()=>({authTime:'2026-10-16T00:00:00Z',claims:{}})})};
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://test.invalid',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fixture=f;w.fetch=async(url)=>{f.requests.push(url);assert.equal(url,'/api/auth/login');return{ok:f.loginOk!==false,json:async()=>f.loginOk===false?({success:false,error:'PIN salah.'}):({success:true,customToken:'TEST_TOKEN',user:f.profiles[f.loginUid]})}}}});
 const win=dom.window;win.console.error=()=>{};win.console.warn=()=>{};win.eval(result.outputFiles[0].text);
 const ui=within(win.document.body);const wait=cb=>waitFor(cb,{container:win.document.body});
 return {f,win,ui,wait,close:()=>{win.unmount();win.close()}};
}
let passed=0;
async function check(name,run){const s=setup();try{await s.wait(()=>assert.equal(s.ui.getByTestId('loading').textContent,'false'));await s.win.testAuth.loginWithPin('teacher','123456');await s.wait(()=>assert.equal(s.ui.getByTestId('user').textContent,'teacher'));await run(s);passed++;console.log('PASS',name)}finally{s.close()}}
await check('unknown pending counts keep the user signed in with an actionable message',async({f,win,ui,wait})=>{
 f.failInspection=true;await win.testAuth.logout();await wait(()=>assert.ok(ui.getByRole('alert').textContent.includes('belum dapat diperiksa')));assert.equal(ui.getByTestId('user').textContent,'teacher');assert.equal(f.signOuts,0);assert.equal(f.purges,0);
});
await check('logout can be retried once local storage recovers',async({f,win,ui,wait})=>{
 f.failInspection=true;await win.testAuth.logout();f.failInspection=false;await win.testAuth.logout();await wait(()=>assert.equal(ui.getByTestId('user').textContent,'signed-out'));assert.equal(f.signOuts,1);assert.equal(f.purges,0);
});
await check('a failed sync/count refresh retains the pending-data dialog and does not throw',async({f,win,ui,wait})=>{
 f.pending=1;await win.testAuth.logout();await ui.findByText('Coba Sinkronkan Sekarang');f.failInspection=true;ui.getByText('Coba Sinkronkan Sekarang').click();await wait(()=>assert.ok(ui.getByRole('alert').textContent.includes('belum dapat dipastikan')));assert.equal(ui.getByTestId('user').textContent,'teacher');assert.equal(f.signOuts,0);assert.equal(f.purges,0);
});
await check('a delayed logout inspection cannot sign out the next account',async({f,win,ui,wait})=>{
 let release;f.inspectionGate=new Promise(r=>release=r);const pending=win.testAuth.logout();f.emitUser(f.firebaseUser('other'));await wait(()=>assert.equal(ui.getByTestId('user').textContent,'other'));release();await pending;assert.equal(ui.getByTestId('user').textContent,'other');assert.equal(f.signOuts,0);
});
console.log(`${passed} focused React logout/storage isolation scenarios passed. No production IO.`);
