// Execute the actual PIN handler. All credentials, rate-limit IO, and tokens are synthetic.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const f = { routes: {}, users: [], valid: true, locked: false, failReset: false, failMint: false, verifications: 0, resets: [], mints: [] };
const mocks = {
  express: `export const Router=()=>({get(){},post:(p,...h)=>globalThis.f.routes[p]=h.at(-1)});`,
  admin: `const f=globalThis.f;const snap=row=>row?{id:row.uid,exists:true,data:()=>row.data}:{exists:false};export const adminDb={collection:c=>({where:(field,op,value)=>({get:async()=>({docs:f.users.filter(r=>r.data[field]===value).map(snap)})}),doc:uid=>({get:async()=>snap(f.users.find(r=>r.uid===uid)),set:async()=>{}})})};export const adminAuth={createCustomToken:async uid=>{f.mints.push(uid);if(f.failMint)throw Error('Synthetic signer failure');return'TEST_ONLY_TOKEN'}};export const testSignerCapability=()=>{};`,
  field: `export const FieldValue={};`,
  credential: `export const CredentialStore={verifyCredential:async()=>{globalThis.f.verifications++;return globalThis.f.valid}};`,
  hash: `export const hashPinAdaptive=async()=>'';`,
  rate: `const f=globalThis.f;export const AuthRateLimiter={createPinActionLimiter:()=>()=>{},isLocked:async()=>({locked:f.locked,remainingSeconds:60}),recordFailure:async()=>({remainingAttempts:3,locked:false}),recordLoginSuccessForIdentifiers:async ids=>{f.resets.push(ids);if(f.failReset)throw Error('Synthetic store failure')}};export const getClientIp=()=> 'test-ip';`,
};
const bundle = await build({ entryPoints: ['src/server/routes/authRoutes.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'mock-io', setup(b) {
  for (const [filter, path] of [[/^express$/, 'express'], [/firebaseAdmin\.js$/, 'admin'], [/^firebase-admin\/firestore$/, 'field'], [/credentialStore\.js$/, 'credential'], [/adaptiveHash\.js$/, 'hash'], [/rateLimiter\.js$/, 'rate']]) b.onResolve({ filter }, () => ({ path, namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' }));
} }] });
vm.runInContext(bundle.outputFiles[0].text, vm.createContext({ f, module: { exports: {} }, console: { ...console, warn() {}, error() {} } }));
const user = () => ({ uid: 'teacher', data: { loginId: 'GURU-001', nip: '999', fullName: 'Guru Uji', role: 'GURU', isActive: true, permissions: ['dashboard.view'] } });
const reset = () => Object.assign(f, { users: [user()], valid: true, locked: false, failReset: false, failMint: false, verifications: 0, resets: [], mints: [] });
const login = async (body = { identifier: 'teacher', pin: '123456' }, aborted = false) => {
  const result = { status: 200, body: null }, res = { status(n) { result.status = n; return this; }, json(value) { result.body = value; } };
  await f.routes['/login']({ body, headers: {}, res, aborted }, res); return result;
};
let count = 0; const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
reset(); let r = await login(); check('verified canonical UID returns a token and uses one alias-reset batch', r.body.success === true && r.body.user.id === 'teacher' && f.resets.length === 1 && f.mints.length === 1);
reset(); f.valid = false; r = await login(); check('wrong PIN retains failure feedback and never resets limits or mints a token', r.status === 401 && r.body.remainingAttempts === 3 && f.resets.length === 0 && f.mints.length === 0);
reset(); f.users[0].data.isActive = false; r = await login(); check('disabled account fails before credential verification', r.status === 403 && r.body.code === 'ACCOUNT_DISABLED' && f.verifications === 0 && f.mints.length === 0);
reset(); f.users[0].data.requiresActivation = true; r = await login(); check('activation-required account cannot proceed', r.status === 403 && f.verifications === 0);
reset(); f.locked = true; r = await login(); check('locked account cannot proceed to PIN verification', r.status === 429 && f.verifications === 0);
reset(); f.failReset = true; r = await login(); check('a limiter store failure still rejects login before token minting', r.status === 500 && f.mints.length === 0);
reset(); f.failMint = true; r = await login(); check('signer failure cannot return a successful session', r.status === 503 && r.body.code === 'SIGNER_UNAVAILABLE');
reset(); f.users.push({ uid: 'other', data: { ...user().data, loginId: 'TEACHER' } }); r = await login(); check('ambiguous canonical UID and alias matches remain rejected', r.status === 409 && f.verifications === 0);
reset(); r = await login(undefined, true); check('cancelled request cannot mint a token', r.status === 503 && f.verifications === 0 && f.mints.length === 0);
console.log(`${count} PIN route regressions passed. No production IO.`);
