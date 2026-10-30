/** R97: isolated regression tests. No network, Firebase access or production writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = [
  'src/services/auth/sessionVerificationFlight.ts',
  'src/contexts/AuthContext.tsx',
  'src/features/auth/LoginPage.tsx',
  'src/services/auth/authService.ts',
  'src/server/routes/authRoutes.ts',
];
let passes = 0;
const test = async (title, fn) => { await fn(); console.log('PASS', title); passes++; };
for (const file of files) {
  const result = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  await test(`${file}: valid TS/TSX syntax`, () => assert.equal(result.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0));
}

const helper = ts.transpileModule(read(files[0]), { fileName: files[0], compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, module: { exports: {} }, Promise };
vm.runInNewContext(helper, context);
const { createSessionVerificationFlight } = context.exports;
assert.equal(typeof createSessionVerificationFlight, 'function');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

await test('shares one pending validation for identical Firebase User object', async () => {
  let resolve;
  let calls = 0;
  const user = { uid: 'guru-1' };
  const check = createSessionVerificationFlight(() => { calls++; return new Promise((r) => { resolve = r; }); });
  const a = check(user), b = check(user);
  assert.strictEqual(a, b);
  await flush();
  assert.equal(calls, 1);
  resolve({ success: true });
  const [one, two] = await Promise.all([a, b]);
  assert.equal(one.success, true);
  assert.strictEqual(one, two);
});

await test('same UID with different Auth user object is revalidated', async () => {
  let calls = 0;
  const check = createSessionVerificationFlight(async (user) => ({ uid: user.uid, count: ++calls }));
  const a = { uid: 'guru-1' }, b = { uid: 'guru-1' };
  const [one, two] = await Promise.all([check(a), check(b)]);
  assert.equal(one.count, 1);
  assert.equal(two.count, 2);
});

await test('different UIDs cannot share verification', async () => {
  let calls = 0;
  const check = createSessionVerificationFlight(async (user) => ({ uid: user.uid, call: ++calls }));
  const [a, b] = await Promise.all([check({ uid: 'guru-A' }), check({ uid: 'guru-B' })]);
  assert.equal(a.uid, 'guru-A');
  assert.equal(b.uid, 'guru-B');
  assert.equal(calls, 2);
});

await test('successful verification is never reused after settlement', async () => {
  let calls = 0;
  const check = createSessionVerificationFlight(async () => ++calls);
  const user = { uid: 'guru-1' };
  assert.equal(await check(user), 1);
  assert.equal(await check(user), 2);
});

await test('failure is propagated, not cached, and can be retried', async () => {
  let calls = 0;
  const check = createSessionVerificationFlight(async () => {
    if (++calls === 1) throw new Error('offline');
    return { success: true };
  });
  const user = { uid: 'guru-1' };
  await assert.rejects(check(user), /offline/);
  assert.deepEqual(await check(user), { success: true });
  assert.equal(calls, 2);
});

await test('late earlier verifier does not clear an overlapping newer verification', async () => {
  let resolveA, resolveB;
  let calls = 0;
  const a = { uid: 'A' }, b = { uid: 'B' };
  const check = createSessionVerificationFlight((user) => { calls++; return new Promise((resolve) => { if (user.uid === 'A') resolveA = resolve; else resolveB = resolve; }); });
  const pendingA = check(a);
  await flush();
  const pendingB = check(b);
  await flush();
  resolveA('old');
  await pendingA;
  assert.strictEqual(check(b), pendingB);
  resolveB('new');
  await pendingB;
  assert.equal(calls, 2);
});

const contextSource = read('src/contexts/AuthContext.tsx');
const page = read('src/features/auth/LoginPage.tsx');
const authService = read('src/services/auth/authService.ts');
const backend = read('src/server/routes/authRoutes.ts');
await test('refresh and restoration use shared verifier, but Google login still checks authority', () => {
  assert.match(contextSource, /createSessionVerificationFlight\(/);
  assert.match(contextSource, /const valRes = await verifyLiveSession\(user\)/);
  assert.match(contextSource, /const valRes = await verifyLiveSession\(fbUser\)/);
  assert.match(contextSource, /validateFirebaseUserProfile\(fbUser, \{ isLoginWithGoogle: true, clearInvalidSession: false \}\)/);
});
await test('login has focus throttling without replacing verified user summary', () => {
  assert.match(page, /lastDirectoryAttemptAtRef/);
  assert.match(page, /!forceRefresh && now - lastDirectoryAttemptAtRef\.current < 45_000/);
  assert.match(page, /getUsersListStatus\?\.\(\)\.verified === false/);
  assert.doesNotMatch(page, /onFocusCapture=\{\(\) => preloadAuthenticatedShell\(\)\}/);
  assert.match(page, /getUsersList\(\{ forceRefresh \}\)/);
});
await test('manual PIN login still uses server authentication and Firebase custom token', () => {
  assert.match(authService, /fetch\('\/api\/auth\/login'/);
  assert.match(authService, /signInWithCustomToken\(auth, data\.customToken\)/);
});
await test('public directory fetches only essential, active, approved fields', () => {
  assert.match(backend, /collection\('users'\)\s*\.where\('isActive', '==', true\)\s*\.select\(/);
  assert.match(backend, /data\.loginAvatarVisible === true/);
  assert.match(backend, /\/profile-photo/);
  assert.match(authService, /setTimeout\(\(\) => controller\.abort\(\), 8000\)/);
  assert.match(authService, /age >= 45000/);
});
console.log(`\n${passes}/${passes} R97 isolated checks passed.`);
