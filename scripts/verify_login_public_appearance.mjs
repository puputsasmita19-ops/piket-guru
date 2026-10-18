// Execute the actual public-config route with in-memory Admin SDK and route registration.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const f = { routes: {}, data: {}, fail: false, exists: true };
const mocks = {
  express: `export const Router=()=>({get:(p,...h)=>globalThis.f.routes['GET '+p]=h.at(-1),post(){}});`,
  admin: `export const adminAuth={};export const testSignerCapability=()=>{};export const adminDb={collection:()=>({doc:()=>({get:async()=>{if(globalThis.f.fail)throw Error('Synthetic unavailable');return{exists:globalThis.f.exists,data:()=>globalThis.f.data}}})})};`,
  field: `export const FieldValue={};`,
  credential: `export const CredentialStore={};`,
  hash: `export const hashPinAdaptive=async()=>'';`,
  rate: `export const AuthRateLimiter={createPinActionLimiter:()=>()=>{}};export const getClientIp=()=>'';`,
};
const bundle = await build({ entryPoints: ['src/server/routes/authRoutes.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'mock-services', setup(b) {
  for (const [filter, path] of [[/^express$/, 'express'], [/firebaseAdmin\.js$/, 'admin'], [/^firebase-admin\/firestore$/, 'field'], [/credentialStore\.js$/, 'credential'], [/adaptiveHash\.js$/, 'hash'], [/rateLimiter\.js$/, 'rate']]) b.onResolve({ filter }, () => ({ path, namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' }));
} }] });
const ctx = vm.createContext({ f, module: { exports: {} }, console: { ...console, warn() {} } });
vm.runInContext(bundle.outputFiles[0].text, ctx);
const get = async () => { let result; await f.routes['GET /public-config']({}, { json: d => { result = JSON.parse(JSON.stringify(d)); } }); return result; };
let count = 0; const check = (label, ok) => { assert.ok(ok, label); count++; console.log('PASS', label); };
f.data = { schoolName: 'Sekolah Uji', appCreator: 'Pengembang Uji', schoolLat: -8, schoolLng: 113, allowedRadiusMeters: 999, driveRefreshToken: 'SECRET', dashboardInfoConfig: { welcome: { templates: [{ text: 'INTERNAL' }] } }, loginAppearance: { motionEnabled: false, background: 'gradient', speed: 'fast', intensity: 'clear', runningCredit: false, creditDuration: 60, videoUrl: 'https://not-allowed.invalid', secret: 'SECRET' } };
let r = await get();
check('public config delivers saved appearance and developer attribution', r.config.loginAppearance.motionEnabled === false && r.config.loginAppearance.background === 'gradient' && r.config.appCreator === 'Pengembang Uji' && r.config.loginAppearance.creditDuration === 60);
check('public DTO excludes GPS, tokens, dashboard templates and unknown media fields', !JSON.stringify(r).includes('SECRET') && !JSON.stringify(r).includes('INTERNAL') && r.config.schoolLat === undefined && r.config.allowedRadiusMeters === undefined && Object.keys(r.config.loginAppearance).length === 7 && r.config.loginAppearance.videoUrl === undefined);
f.data = { loginAppearance: { background: 'unknown', speed: 'invalid', creditDuration: 1 }, appCreator: 'a'.repeat(300) }; r = await get();
check('public settings and attribution are bounded and normalized', r.config.loginAppearance.background === 'gradient' && r.config.loginAppearance.speed === 'slow' && r.config.loginAppearance.creditDuration === 30 && r.config.appCreator.length === 120);
for (const mediaPolicy of ['economy', 'adaptive', 'always']) {
  f.data = { loginAppearance: { background: 'ocean', mediaPolicy } }; r = await get();
  check(`public DTO preserves explicit policy ${mediaPolicy}`, r.config.loginAppearance.mediaPolicy === mediaPolicy);
}
f.data = { loginAppearance: { background: 'ocean', mediaPolicy: 'unknown' } }; r = await get();
check('old or invalid policy always defaults to economy', r.config.loginAppearance.mediaPolicy === 'economy');
f.exists = false; r = await get(); check('new projects receive safe defaults', r.config.loginAppearance.background === 'gradient' && r.config.loginAppearance.runningCredit === true && r.config.loginAppearance.mediaPolicy === 'economy');
f.fail = true; r = await get(); check('database failure preserves a usable login config', r.success === true && r.source === 'DEFAULT_FALLBACK' && r.config.loginAppearance.motionEnabled === true);
console.log(`${count} public login appearance checks passed. No external IO.`);
