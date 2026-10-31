/** R109: authenticated admission reuse + post-PIN shell prefetch security tests. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let passed = 0;
let failed = 0;
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const test = async (title, fn) => {
  try { await fn(); passed++; console.log(`PASS ${passed}: ${title}`); }
  catch (error) { failed++; console.error(`FAIL: ${title}:`, error); }
};
const limiter = read('src/server/middleware/rateLimiter.ts');
const routes = read('src/server/routes/authRoutes.ts');
const client = read('src/services/auth/authService.ts');
const shell = read('src/appBootstrap.ts');
for (const [path, src] of Object.entries({
  'src/server/middleware/rateLimiter.ts': limiter,
  'src/server/routes/authRoutes.ts': routes,
  'src/services/auth/authService.ts': client,
  'src/appBootstrap.ts': shell,
})) await test(`TypeScript syntax ${path}`, () => {
  const tree = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true);
  assert.equal(tree.parseDiagnostics.length, 0, tree.parseDiagnostics.map(d => d.messageText).join(','));
});

const compiled = ts.transpileModule(limiter, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, vm.createContext({
  module: { exports }, exports, console, Promise, Date, Math, WeakMap, Map, Set,
  AbortController, setInterval, clearInterval, Buffer,
  process: { env: { NODE_ENV: 'test' } },
  require(spec) {
    if (spec === 'fs' || spec === 'path') return require(spec);
    if (spec === '../firebaseAdmin.js') return { adminDb: null };
    if (spec === '../utils/loginLookupMode.js') return {
      exactSelectedLoginUid(body) {
        return body?.identifier && body?.identifier === body?.accountUid &&
          /^[A-Za-z0-9_.-]{3,100}$/.test(body?.identifier) ? body.identifier : null;
      },
    };
    throw Error(`Unexpected require: ${spec}`);
  },
}), { timeout: 6000 });
const { FirestoreStoreDriver, createInMemoryTransactionTransport, AuthRateLimiter, setActiveRateLimitDriver,
  toAccountIdKey, toIpKey, admissionCoversVerifiedAccount } = exports;
function fixture(identifier='GURU-011') {
  const db = createInMemoryTransactionTransport();
  const store = new FirestoreStoreDriver(db);
  setActiveRateLimitDriver(store);
  const req = new EventEmitter();
  req.body = { identifier, accountUid: identifier, pin: '000000' };
  req.ip = '192.0.2.100'; req.headers = {};
  req.socket = new EventEmitter(); req.socket.destroyed = false;
  const res = new EventEmitter(); res.headersSent = false; res.writableEnded = false;
  res.status = function(code) { this.code = code; return this; };
  res.json = function(value) { this.body = value; this.headersSent = true; this.writableEnded = true; return this; };
  return { db, store, req, res };
}
const admit = async ({req,res}) => {
  let nextCalled = 0;
  await AuthRateLimiter.loginMiddleware(req, res, () => nextCalled++);
  return nextCalled;
};
const release = async ({res}) => {
  res.writableEnded = true; res.emit('finish');
  await new Promise(resolve => setImmediate(resolve));
};
await test('No proof exists for unverified requests', () => {
  const {req} = fixture();
  assert.equal(admissionCoversVerifiedAccount(req, 'GURU-011', 'GURU-011'), false);
});
await test('Client payload cannot manufacture a middleware admission proof', () => {
  const {req} = fixture();
  Object.assign(req, { loginAdmissionValidated: true, loginAdmissionAccountId: 'GURU-011' });
  Object.assign(req.body, { loginAdmissionValidated: true, resolvedUserId: 'GURU-011' });
  assert.equal(admissionCoversVerifiedAccount(req, 'GURU-011', 'GURU-011'), false);
});
await test('Exact selected UID has one admitted lease and may reuse same-user lock check', async () => {
  const fixtureA = fixture();
  assert.equal(await admit(fixtureA), 1);
  assert.equal(admissionCoversVerifiedAccount(fixtureA.req, 'GURU-011', 'GURU-011'), true);
  assert.equal(fixtureA.db.getRawData().get('leases:registry').activeTokens.length, 1);
  await release(fixtureA);
});
await test('Proof never applies to a different resolved UID', async () => {
  const a = fixture(); await admit(a);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-099', 'GURU-011'), false);
  await release(a);
});
await test('Proof never applies to an altered login identifier/alias', async () => {
  const a = fixture(); await admit(a);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'NIP-011'), false);
  await release(a);
});
await test('Proof cannot be reused after the lease ends', async () => {
  const a = fixture(); await admit(a); await release(a);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'GURU-011'), false);
});
await test('Lease abort invalidates proof immediately', async () => {
  const a = fixture(); await admit(a);
  a.req.leaseAbortController.abort(new Error('LEASE_LOST'));
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'GURU-011'), false);
  await release(a);
});
await test('IP-locked requests never receive admission proof', async () => {
  const a = fixture(); const now = Date.now();
  a.db.getRawData().set('records:' + toIpKey(a.req.ip), { count: 15, firstAttempt:now,lastAttempt:now,lockedUntil:now+60000 });
  assert.equal(await admit(a),0);
  assert.equal(a.res.code,429);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'GURU-011'), false);
});
await test('Account-locked requests never receive admission proof', async () => {
  const a = fixture(); const now = Date.now();
  a.db.getRawData().set('records:' + toAccountIdKey('GURU-011'), { count: 5, firstAttempt:now,lastAttempt:now,lockedUntil:now+60000 });
  assert.equal(await admit(a),0);
  assert.equal(a.res.code,429);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'GURU-011'), false);
});
await test('Unavailable rate limiter remains fail-closed and has no proof', async () => {
  const a = fixture(); a.db.setHealthy(false);
  assert.equal(await admit(a), 0);
  assert.equal(a.res.code,503);
  assert.equal(admissionCoversVerifiedAccount(a.req, 'GURU-011', 'GURU-011'), false);
});
await test('Manual UID mismatch always retains authoritative lock lookup', () => {
  assert.match(routes,/const admissionMatchesAccount = admissionCoversVerifiedAccount\(req, userId, rawIdentifier\)/);
  assert.match(routes,/const accountLock = admissionMatchesAccount\s*\? \{ locked: false as const \}\s*: await AuthRateLimiter\.isLocked\(userId\)/);
});
await test('Route still requires active account, activation, PIN, and reset before token', () => {
  assert.match(routes,/userData\.isActive !== true/);
  assert.match(routes,/userData\.requiresActivation === true/);
  assert.match(routes,/await CredentialStore\.verifyCredential\(userId, pin\)/);
  assert.match(routes,/Promise\.allSettled\(\[resetPromise, signerPromise\]\)/);
  assert.match(routes,/resetResult\.status === 'rejected'/);
  assert.match(routes,/signerResult\.status === 'rejected'/);
});
await test('Module prefetch happens only after response success and token + active-user checks', () => {
  const accepted = client.indexOf('if (!data.customToken');
  const active = client.indexOf('if (!data.user || data.user.isActive');
  const preload = client.indexOf('preloadAuthenticatedShell();');
  const signin = client.indexOf('await signInWithCustomToken(auth, data.customToken)');
  assert.ok(accepted > 0 && active > accepted && preload > active && signin > preload);
});
await test('Mobile data saver and 2G/3G connections do not prefetch shell', () => {
  assert.match(client, /!connection\?\.saveData/);
  assert.match(client, /connection\?\.effectiveType !== 'slow-2g'/);
  assert.match(client, /connection\?\.effectiveType !== '2g'/);
  assert.match(client, /connection\?\.effectiveType !== '3g'/);
});
await test('Shell prefetch has no mount, no role grant, and ignores download errors', () => {
  assert.match(shell,/void loadAuthenticatedShell\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(shell,/return shellRequest/);
  assert.doesNotMatch(shell, /setCurrentUser|signInWithCustomToken|createCustomToken/);
});
await test('Firebase sign-in still mandatory and UID must match verified server user', () => {
  assert.match(client, /await signInWithCustomToken\(auth, data.customToken\)/);
  assert.match(client, /userCredential\.user\.uid !== data.user.id/);
});
console.log(`R109 ${passed}/${passed+failed} ${failed ? 'FAIL' : 'PASS'}`);
if (failed) process.exitCode = 1;
