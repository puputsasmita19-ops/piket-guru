/** R100 — Fast & safe keypad tests. These cannot prove physical vibration on a phone. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let count = 0;
const test = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
const source = read('src/features/auth/pinHaptics.ts');
const login = read('src/features/auth/LoginPage.tsx');
const auth = read('src/services/auth/authService.ts');
const css = read('src/index.css');
function load(file, globals = {}) {
  const out = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  assert.equal((out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const context = { exports: {}, module: { exports: {} }, ...globals };
  vm.runInNewContext(out.outputText, context, { filename: file });
  return context.exports;
}
const h = load('src/features/auth/pinHaptics.ts');
for (const file of ['src/features/auth/LoginPage.tsx', 'src/features/auth/pinHaptics.ts', 'src/services/auth/authService.ts']) {
  test(`Syntax TS/TSX ${file}`, () => {
    const transpiled = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
    assert.equal((transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  });
}
test('touch pointerdown gets immediate pulse, matching click is deduplicated', () => {
  let at = 1, pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return true; }, () => at);
  assert.equal(d.pointerDown('digit', 'touch', 'digit-1'), true);
  at += 200;
  assert.equal(d.click('digit', 'digit-1'), true);
  assert.equal(pulses, 1);
});
test('rapid taps of different keys never suppress each other', () => {
  let now = 10, pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return true; }, () => now);
  d.pointerDown('digit', 'touch', 'digit-1');
  now += 1;
  d.pointerDown('digit', 'touch', 'digit-2');
  now += 1;
  d.click('digit', 'digit-1');
  d.click('digit', 'digit-2');
  assert.equal(pulses, 2);
});
test('if pointer vibrate is rejected, click can retry once', () => {
  let pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return pulses > 1; });
  assert.equal(d.pointerDown('digit', 'touch', 'digit-4'), false);
  assert.equal(d.click('digit', 'digit-4'), true);
  assert.equal(pulses, 2);
});
test('keyboard and assistive click still get one pulse', () => {
  let pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return true; });
  d.pointerDown('digit', 'mouse', 'digit-5');
  d.click('digit', 'digit-5');
  assert.equal(pulses, 1);
});
test('cancelled touch does not consume a later activation', () => {
  let pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return true; });
  d.pointerDown('delete', 'pen', 'delete');
  d.cancel('delete');
  d.click('delete', 'delete');
  assert.equal(pulses, 2);
});
test('expired pointer receipt cannot hide later click', () => {
  let time = 10, pulses = 0;
  const d = h.createPinHapticDispatcher(() => { pulses++; return true; }, () => time);
  d.pointerDown('clear', 'touch');
  time += 850;
  d.click('clear');
  assert.equal(pulses, 2);
});
test('unsupported API is harmless', () => {
  assert.equal(h.supportsPinHaptics({}), false);
  assert.equal(h.vibratePinKey(true, 'digit', {}), false);
});
test('preferences remain device local and never contain credentials', () => {
  const storage = new Map();
  const funcs = load('src/features/auth/pinHaptics.ts', { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) } });
  funcs.savePinHapticsEnabled(true); funcs.savePinHapticStrength('strong');
  assert.equal(storage.size, 2);
  for (const [key,value] of storage) {
    assert.ok(key.startsWith('piket_guru_pin_haptic'));
    assert.ok(['on','strong'].includes(value));
  }
});
test('compact icon reveals haptic panel only on demand', () => {
  assert.match(login, /hapticPanelOpen && <div id="login-haptic-settings"/);
  assert.match(login, /<Settings2 className="w-4 h-4"/);
  assert.match(login, /aria-expanded=\{hapticPanelOpen\}/);
  assert.match(login, /Coba Getaran/);
});
test('at least 44px tap target and reduced motion CSS remain', () => {
  assert.match(login, /min-h-\[44px\] min-w-\[44px\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
test('PIN login still requires server credential and Firebase token', () => {
  assert.match(login, /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
  assert.match(auth, /signInWithCustomToken\(auth, data\.customToken\)/);
});
test('directory cancellation targets optional directory only', () => {
  assert.match(auth, /pausePublicDirectoryForLogin\(\)/);
  assert.match(auth, /this\.usersRequestAbort\?\.abort\(\)/);
  assert.match(login, /authService\.pausePublicDirectoryForLogin\(\)/);
  assert.match(auth, /fetch\('\/api\/auth\/login'/);
});
test('public school appearance is still fetched during login screen', () => {
  assert.match(login, /fetch\('\/api\/auth\/public-config'/);
  assert.doesNotMatch(login, /publicConfigAbortRef/);
});
console.log(`\nR100 ${count}/${count} PASS (local logic and static checks)`);
