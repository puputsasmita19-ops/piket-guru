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
 store:`const f=window.fixture;export class FirestoreService{static async getByIdStrict(c,id){f.strictReads++;if(f.deferProfile[id])return f.deferProfile[id];if(f.readError)throw Object.assign(Error(f.readError),{code:f.readError});return f.profiles[id]||null}static subscribeToDocument(c,id,cb){if(c==='settings'){queueMicrotask(()=>cb({}));return()=>{}}f.profileSubscriptions++;f.profileCallbacks.set(id,cb);queueMicrotask(()=>{if(f.profileSubscriptions<8&&f.profileCallbacks.get(id)===cb)cb(f.profiles[id]||null)});return()=>{f.profileUnsubscribes++;if(f.profileCallbacks.get(id)===cb)f.profileCallbacks.delete(id)}}}`,
 offline:`const f=window.fixture;export const OfflineStorage={isTrustedDevice:()=>f.trusted!==false,setTrustedDevice(v){f.trusted=v},teardownActiveListeners(){f.teardowns++},clearDisplayCacheOnly:async()=>{},getPendingCount:async()=>({total:f.pending,syncQueueCount:f.pending,draftsCount:0}),purgeUserData:async()=>{f.purges++},getVerifiedProfile:async id=>f.verified[id]||null,saveVerifiedProfile:async p=>{f.verified[p.id]=p}};`,
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
let passed=0;async function check(name,run){const s=setup();try{await s.wait(()=>assert.equal(s.ui.getByTestId('loading').textContent,'false'));await run(s);passed++;console.log('PASS',name)}finally{s.close()}}
await check('PIN SDK event does not start duplicate validation; profile updates do not resubscribe auth',async({f,win,ui,wait})=>{
 assert.equal((await win.testAuth.loginWithPin('teacher','123456')).success,true);await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));
 await wait(()=>assert.equal(f.profileSubscriptions,1));
 for(let i=0;i<3;i++){f.profiles.teacher={...f.profiles.teacher,fullName:'Updated '+i};f.profileCallbacks.get('teacher')(f.profiles.teacher);await wait(()=>assert.equal(win.testAuth.currentUser.fullName,'Updated '+i))}
 assert.equal(f.strictReads,0);assert.equal(f.authSubscriptions,2);assert.equal(f.profileSubscriptions,1);assert.equal(f.verified.teacher.fullName,'Updated 2');
});
await check('Google login runs one profile verification and cancellation permits a later retry',async({f,win,ui,wait})=>{
 f.popupError='auth/popup-closed-by-user';assert.equal((await win.testAuth.loginWithGoogle()).success,false);f.popupError=null;
 assert.equal((await win.testAuth.loginWithGoogle()).success,true);await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));assert.equal(f.strictReads,1);assert.equal(f.authSubscriptions,2);
});
await check('logout during Google popup cancels the old result instead of restoring access',async({f,win,ui,wait})=>{
 let release;f.popupPromise=new Promise(r=>release=r);const login=win.testAuth.loginWithGoogle();await win.testAuth.logout();release();assert.equal((await login).success,false);await wait(()=>assert.equal(ui.getByTestId('user').textContent,'signed-out'));assert.equal(win.testAuth.isAuthenticated,false);
});
await check('a late rejected validation from the previous UID cannot sign out the next account',async({f,win,ui,wait})=>{
 let resolve;f.deferProfile.teacher=new Promise(r=>resolve=r);f.emitUser(f.firebaseUser('teacher'));await wait(()=>assert.equal(f.strictReads,1));
 f.emitUser(f.firebaseUser('other'));await wait(()=>assert.equal(ui.getByTestId('user').textContent,'other'));resolve(null);await new Promise(r=>setTimeout(r,20));assert.equal(ui.getByTestId('user').textContent,'other');assert.equal(f.signOuts,0);
});
await check('pending queue blocks manual logout; forced deactivation preserves pending data',async({f,win,ui,wait})=>{
 await win.testAuth.loginWithPin('teacher','123456');await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));f.pending=2;
 await win.testAuth.logout();await ui.findByText('Perhatian: Data Unsynced');assert.equal(win.testAuth.isAuthenticated,true);
 f.profileCallbacks.get('teacher')({...f.profiles.teacher,isActive:false});await wait(()=>assert.equal(ui.getByTestId('user').textContent,'signed-out'));assert.equal(f.purges,0);assert.equal(f.pending,2);
});
await check('network revalidation preserves the verified offline state and does not sync as online',async({f,win,ui,wait})=>{
 await win.testAuth.loginWithPin('teacher','123456');await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));f.readError='unavailable';assert.equal(await win.testAuth.revalidateSessionOnline(),false);await wait(()=>assert.equal(win.testAuth.isOfflineSession,true));assert.equal(f.syncs,0);
});
await check('guide remains manually usable when sessionStorage is blocked',async({win,ui,wait})=>{
 const original=win.Storage.prototype.getItem;win.Storage.prototype.getItem=function(key){if(key.startsWith('piket_guide_shown_session_'))throw Error('Storage blocked');return original.call(this,key)};
 await win.testAuth.loginWithPin('teacher','123456');await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));win.testGuide.startGuideTour();await wait(()=>assert.equal(win.testGuide.isGuideTourActive,true));win.testGuide.stopGuideTour();await wait(()=>assert.equal(win.testGuide.isGuideTourActive,false));
});
await check('feature render error has a readable fallback and resets when the page changes',async({win,ui,wait})=>{
 win.renderBoundary('broken',true);await ui.findByRole('alert');win.renderBoundary('dashboard',false);await ui.findByText('Dashboard ready');
});
const preference = win => { const key = Object.keys(win.localStorage).find(k => k.startsWith('piket_last_login_v1:')); return key ? JSON.parse(win.localStorage.getItem(key)) : null; };
await check('successful PIN login remembers only verified UID, and logout keeps this display preference', async({f,win,ui,wait})=>{
 await win.testAuth.loginWithPin('teacher','123456'); await wait(()=>assert.equal(ui.getByTestId('user').textContent,'teacher'));
 assert.equal(preference(win).uid,'teacher'); assert.deepEqual(Object.keys(preference(win)).sort(),['uid','updatedAt','version']);
 await win.testAuth.logout(); await wait(()=>assert.equal(ui.getByTestId('user').textContent,'signed-out')); assert.equal(preference(win).uid,'teacher');
});
await check('wrong PIN and cancelled Google login cannot overwrite last successful account', async({f,win,ui,wait})=>{
 await win.testAuth.loginWithPin('teacher','123456'); await win.testAuth.logout(); f.loginOk=false;
 assert.equal((await win.testAuth.loginWithPin('other','000000')).success,false); assert.equal(preference(win).uid,'teacher');
 f.popupError='auth/popup-closed-by-user'; assert.equal((await win.testAuth.loginWithGoogle()).success,false); assert.equal(preference(win).uid,'teacher');
});
await check('verified Google login updates the preference and switching to a shared device removes it', async({f,win,ui,wait})=>{
 f.loginUid='other'; assert.equal((await win.testAuth.loginWithGoogle()).success,true); await wait(()=>assert.equal(ui.getByTestId('user').textContent,'other')); assert.equal(preference(win).uid,'other');
 win.testAuth.setTrustedDevice(false); await wait(()=>assert.equal(win.testAuth.isTrustedDevice,false)); assert.equal(preference(win),null);
 await win.testAuth.logout(); assert.equal((await win.testAuth.loginWithPin('other','123456')).success,true); assert.equal(preference(win),null);
});
console.log(`${passed} actual React provider/guide/error-boundary DOM flows passed. Firebase IO was mocked.`);
