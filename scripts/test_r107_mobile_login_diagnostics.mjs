import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
let passed = 0;
const src = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const test = (label, fn) => { fn(); passed++; console.log(`PASS ${passed}: ${label}`); };
const files = [
  'src/features/auth/loginPerformance.ts',
  'src/features/auth/loginDiagnostics.ts',
  'src/features/auth/LoginDiagnosticsPanel.tsx',
  'src/features/auth/LoginPage.tsx',
  'src/services/auth/authService.ts',
  'src/AuthenticatedShell.tsx',
  'src/App.tsx',
];
for (const file of files) {
  test(`TypeScript parses: ${file}`, () => {
    const sf = ts.createSourceFile(file, src(file), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(sf.parseDiagnostics.length, 0, sf.parseDiagnostics.map(d => d.messageText).join('; '));
  });
}
const source = src('src/features/auth/loginDiagnostics.ts');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function makeRuntime(url) {
  let now = 1000;
  const store = new Map();
  const events = [];
  const sandbox = {
    exports: {},
    require: (name) => { if (name === './loginPerformance') return { loginClockNow: () => now }; throw new Error(name); },
    performance: { now: () => now, measure() {}, getEntriesByName: () => [] },
    Date: { now: () => 1_000_000 },
    console: { info() {} },
    URLSearchParams,
    Event: class { constructor(type) { this.type = type; } },
    window: {
      location: { search: url },
      sessionStorage: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) || null },
      dispatchEvent: e => events.push(e.type),
    },
  };
  vm.runInNewContext(js, sandbox);
  return { api: sandbox.exports, tick: d => { now += d; }, store, events };
}
const runtime = makeRuntime('?login_diag=1');
test('Diagnostics require explicit opt-in', () => assert.equal(makeRuntime('?foo=1').api.loginDiagnosticsEnabled(), false));
test('Explicit query activates diagnostics', () => assert.equal(runtime.api.loginDiagnosticsEnabled(), true));
test('Login starts with numeric-only state', () => {
  runtime.api.beginLoginDiagnostics(1000);
  const report = runtime.api.readLoginDiagnostics();
  assert.equal(report.startedAt, 1000);
  assert.equal(report.totalMs, undefined);
});
test('Server Timing only keeps whitelisted numeric stages', () => {
  runtime.api.captureLoginServerTiming('gate;dur=240,lookup;dur=150,pin;dur=310,signer;dur=640,total;dur=1820,uid;dur=991,PIN;dur=123');
  const values = runtime.api.readLoginDiagnostics().serverMs;
  assert.equal(values.gate, 240);
  assert.equal(values.signer, 640);
  assert.equal(values.total, 1820);
  assert.equal(values.uid, undefined);
  assert.equal(values.PIN, undefined);
});
test('Malformed and excessive timing inputs are ignored', () => {
  runtime.api.captureLoginServerTiming('gate;dur=ABC,signer;dur=9999999999,lookup;dur=100');
  const server = runtime.api.readLoginDiagnostics().serverMs;
  assert.equal(server.lookup, 100);
  assert.equal(server.gate, undefined);
  assert.equal(server.signer, undefined);
});
test('Client phases preserve numeric duration across network + Firebase', () => {
  runtime.tick(2500);
  runtime.api.captureClientLoginPhase('pinApi', 2500);
  runtime.tick(1900);
  runtime.api.captureClientLoginPhase('firebase', 1900);
  runtime.api.captureClientLoginPhase('total', 4400);
  const result = runtime.api.readLoginDiagnostics();
  assert.equal(result.pinApiMs, 2500);
  assert.equal(result.firebaseMs, 1900);
  assert.equal(result.totalMs, 4400);
});
test('Shell-visibility timer runs only once and after auth timing', () => {
  runtime.tick(400);
  runtime.api.markAuthenticatedShellVisible();
  assert.equal(runtime.api.readLoginDiagnostics().shellVisibleMs, 4800);
  runtime.tick(1000);
  runtime.api.markAuthenticatedShellVisible();
  assert.equal(runtime.api.readLoginDiagnostics().shellVisibleMs, 4800);
});
test('Events and stored JSON contain no credential keys', () => {
  assert.ok(runtime.events.length >= 3);
  const data = [...runtime.store.values()].join(' ');
  assert.doesNotMatch(data, /\b(uid|identifier|token|secret|password|pinValue)\b/i);
});
test('No tracing when diagnostics not explicitly enabled', () => {
  const off = makeRuntime('?foo=bar');
  off.api.beginLoginDiagnostics(10);
  off.api.captureLoginServerTiming('total;dur=123');
  assert.equal(off.api.readLoginDiagnostics(), null);
  assert.equal(off.store.size, 0);
});
test('The opt-in panel is lazy-loaded and is not in ordinary login UI', () => {
  assert.match(src('src/App.tsx'), /loginDiagnosticsEnabled\(\) && <Suspense fallback=\{null\}><LoginDiagnosticsPanel/);
});
test('Selected login and PIN security path remain unchanged', () => {
  assert.match(src('src/services/auth/authService.ts'), /await signInWithCustomToken\(auth, data.customToken\)/);
  assert.match(src('src/features/auth/LoginPage.tsx'), /await loginWithPin\(selectedUid \|\| selectedIdentifier, pin/);
  assert.match(src('src/services/auth/authService.ts'), /captureLoginServerTiming\(serverTiming\)/);
});
test('Panel copy excludes personal details and shows per-stage measurements', () => {
  const p = src('src/features/auth/LoginDiagnosticsPanel.tsx');
  assert.match(p, /'Server: cek PIN'/);
  assert.match(p, /'Firebase sign-in'/);
  assert.match(p, /'Salin ringkasan waktu'/);
  assert.doesNotMatch(p, /currentUser\.|loginId|email|fullName/);
});
console.log(`R107 ${passed}/${passed} PASS`);
