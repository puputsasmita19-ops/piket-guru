// Isolated regressions: production Firebase, Google and HTTP endpoints are never used.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
const f = { requests: [], signIns: 0, signOuts: 0, clears: 0, reads: 0, saves: [], online: true, failRead: null, profile: null, cached: null, deferUsers: null, loginBody: null, tokenUid: 'teacher', stillCurrent: true, fastTimers: false, failToken: null };
const mocks = {
 firebase: `export const auth={currentUser:null};`,
 sdk: `import {auth} from 'firebase'; export function onAuthStateChanged(){return ()=>{}}; export async function signOut(){globalThis.f.signOuts++;auth.currentUser=null}; export async function signInWithCustomToken(){const f=globalThis.f;f.signIns++;const user={uid:f.tokenUid};auth.currentUser=user;return{user}};`,
 store: `export class FirestoreService { static async getByIdStrict(){const f=globalThis.f;f.reads++;if(f.failRead==='stall')return new Promise(()=>{});if(f.failRead)throw Object.assign(Error(f.failRead),{code:f.failRead});return f.profile;} }`,
 offline: `export const OfflineStorage={teardownActiveListeners(){globalThis.f.clears++},clearDisplayCacheOnly:async()=>{},getPendingCount:async()=>({total:1}),isTrustedDevice:()=>true,purgeUserData:async()=>{throw Error('Unexpected purge')},getVerifiedProfile:async()=>globalThis.f.cached,saveVerifiedProfile:async p=>{globalThis.f.saves.push(p)}};`,
 queue: `export const SyncQueueService={};`,
};
const result=await build({stdin:{contents:`export {authService} from './src/services/auth/authService';export {validateFirebaseUserProfile as validate} from './src/services/auth/authProfileValidator';export {AppUpdateManager} from './src/services/offline/appUpdateManager';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'mock-io',setup(b){
 b.onResolve({filter:/\/firebase$/},()=>({path:'firebase',namespace:'mock'}));
 b.onResolve({filter:/^firebase$/},()=>({path:'firebase',namespace:'mock'}));
 b.onResolve({filter:/^firebase\/auth$/},()=>({path:'sdk',namespace:'mock'}));
 for(const[path,filter]of[['store',/firestoreService$/],['offline',/offlineStorage$/],['queue',/syncQueueService$/]])b.onResolve({filter},()=>({path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
}}]});
const callbacks={};let reloads=0, messages=[];
const registration={waiting:{postMessage:m=>messages.push(m)},addEventListener(){}};
const context=vm.createContext({f,module:{exports:{}},console:{log(){},warn(){},error(){}},window:{location:{reload:()=>reloads++},addEventListener(){}},navigator:{get onLine(){return f.online},serviceWorker:{ready:Promise.resolve(registration),controller:{},addEventListener:(name,cb)=>callbacks[name]=cb}},AbortController,Date,
 setTimeout:(cb,ms)=>setTimeout(cb,f.fastTimers?1:ms),clearTimeout,
 fetch:async(url,options)=>{f.requests.push(url);if(url==='/api/auth/users-summary'){if(f.deferUsers)await f.deferUsers;return{ok:true,json:async()=>({success:true,users:[]})}}assert.equal(url,'/api/auth/login');return{ok:true,json:async()=>f.loginBody}},
 localStorage:{removeItem(){},getItem(){return null},setItem(){}},
});
vm.runInContext(result.outputFiles[0].text,context);
const {authService:service,validate,AppUpdateManager}=context.module.exports;
const profile=()=>({id:'teacher',role:'GURU',isActive:true,requiresActivation:false,permissions:[],sessionRevokedAtSeconds:0,fullName:'Test Teacher'});
const user=()=>({uid:'teacher',getIdTokenResult:async()=>{if(f.failToken)throw Object.assign(Error(f.failToken),{code:f.failToken});return{authTime:'2026-10-16T00:00:00.000Z',claims:{role:'ADMIN'}}}});
function reset(){Object.assign(f,{requests:[],signIns:0,signOuts:0,clears:0,reads:0,saves:[],online:true,failRead:null,profile:profile(),cached:null,deferUsers:null,loginBody:{success:true,customToken:'TEST_TOKEN',user:profile()},tokenUid:'teacher',stillCurrent:true,fastTimers:false,failToken:null});}
let passed=0;async function check(name,run){reset();await run();passed++;console.log('PASS',name)}
await check('manual PIN login does not fetch the users list',async()=>{assert.equal((await service.authenticateWithPin('teacher','123456')).success,true);assert.deepEqual(f.requests,['/api/auth/login']);assert.equal(f.saves.length,1)});
await check('explicit empty permissions stay empty',async()=>{const res=await service.authenticateWithPin('teacher','123456');assert.equal(res.user.permissions.length,0)});
await check('concurrent empty users list fetches share one request, not two sequential reads',async()=>{let release;f.deferUsers=new Promise(r=>release=r);const a=service.getUsersList(),b=service.getUsersList();await Promise.resolve();await Promise.resolve();release();await Promise.all([a,b]);assert.deepEqual(f.requests,['/api/auth/users-summary'])});
await check('wrong PIN still returns lockout information without Firebase sign-in',async()=>{f.loginBody={success:false,error:'PIN salah',remainingAttempts:2,isLocked:false};const res=await service.authenticateWithPin('teacher','000000');assert.equal(res.success,false);assert.equal(res.remainingAttempts,2);assert.equal(f.signIns,0)});
await check('missing token or inactive profile cannot create a session',async()=>{for(const body of [{...f.loginBody,customToken:null},{...f.loginBody,user:{...profile(),isActive:false}}]){f.loginBody=body;assert.equal((await service.authenticateWithPin('teacher','123456')).success,false)}assert.equal(f.signIns,0)});
await check('Firebase UID mismatch rejects and signs out',async()=>{f.tokenUid='different-account';assert.equal((await service.authenticateWithPin('teacher','123456')).success,false);assert.equal(f.signOuts,1)});
await check('cancelled PIN request never signs in',async()=>{assert.equal((await service.authenticateWithPin('teacher','123456',{isCurrent:()=>false})).success,false);assert.equal(f.requests.length,0)});
await check('null Firebase session cannot restore local profile',async()=>{f.cached=profile();assert.equal((await validate(null)).success,false);assert.equal(f.signOuts,1)});
await check('document role and empty permissions override token claims',async()=>{const res=await validate(user());assert.equal(res.success,true);assert.equal(res.profile.role,'GURU');assert.equal(res.profile.permissions.length,0)});
await check('missing, disabled and activation-required profiles are rejected',async()=>{for(const p of [null,{...profile(),id:'wrong'},{...profile(),isActive:false},{...profile(),requiresActivation:true}]){f.profile=p;assert.equal((await validate(user(),{clearInvalidSession:false})).success,false)}assert.equal(f.signOuts,0)});
await check('permission errors and missing indexes cannot use an offline snapshot',async()=>{f.cached=profile();f.online=false;for(const code of ['permission-denied','failed-precondition']){f.failRead=code;assert.equal((await validate(user(),{clearInvalidSession:false})).success,false)}assert.equal(f.signOuts,0)});
await check('network failure can use only a matching verified UID snapshot',async()=>{f.failRead='unavailable';f.cached=profile();let res=await validate(user());assert.equal(res.success,true);assert.equal(res.isOfflineSession,true);f.cached={...profile(),id:'other'};assert.equal((await validate(user(),{clearInvalidSession:false})).success,false)});
await check('revoked sessions and invalid auth timestamps are rejected',async()=>{f.profile={...profile(),sessionRevokedAtSeconds:Date.parse('2026-10-16T00:00:00Z')/1000};assert.equal((await validate(user(),{clearInvalidSession:false})).code,'SESSION_REVOKED');f.profile=profile();const u=user();u.getIdTokenResult=async()=>({authTime:'invalid',claims:{}});assert.equal((await validate(u,{clearInvalidSession:false})).success,false)});
await check('missing role cannot fall back to an elevated token claim',async()=>{f.profile={...profile(),role:undefined};assert.equal((await validate(user(),{clearInvalidSession:false})).success,false)});
await check('offline mode does not hide an explicitly invalid Firebase token',async()=>{f.failRead='unavailable';f.cached=profile();f.online=false;f.failToken='auth/user-token-expired';assert.equal((await validate(user(),{clearInvalidSession:false})).success,false)});
await check('stalled profile verification resolves to failure instead of endless loading',async()=>{f.fastTimers=true;f.failRead='stall';const res=await validate(user(),{clearInvalidSession:false});assert.equal(res.success,false);assert.equal(res.code,'OFFLINE_NO_CACHE')});
await check('initial PWA activation never reloads a running login; approved update reloads once',async()=>{AppUpdateManager.init();await Promise.resolve();callbacks.controllerchange();assert.equal(reloads,0);AppUpdateManager.applyUpdate();assert.equal(messages[0].type,'SKIP_WAITING');callbacks.controllerchange();callbacks.controllerchange();assert.equal(reloads,1)});
console.log(`${passed} isolated login/profile/PWA regressions passed. No production access.`);
