/** R98 targeted tests: offline, no Firebase/network and no real vibration. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let passed = 0;
function test(title, run) {
  run();
  passed++;
  console.log(`PASS ${title}`);
}
function load(file, globals = {}) {
  const js = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  assert.equal((js.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const context = { exports: {}, module: { exports: {} }, ...globals };
  vm.runInNewContext(js.outputText, context, { filename: file });
  return context.exports;
}
const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
const events = [];
const vib = { vibrate: (ms) => { events.push(ms); return true; } };
const pin = load('src/features/auth/pinInput.ts');
const haptic = load('src/features/auth/pinHaptics.ts', { localStorage: storage });
const login = read('src/features/auth/LoginPage.tsx');
const css = read('src/index.css');

for (const file of ['src/features/auth/LoginPage.tsx', 'src/features/auth/pinInput.ts', 'src/features/auth/pinHaptics.ts']) {
  test(`${file} parses TS/TSX`, () => {
    const result = ts.transpileModule(read(file), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
    assert.equal((result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  });
}
test('fast queued taps cannot produce more than six digits', () => {
  let value = '';
  for (let i = 0; i < 21; i++) value = pin.appendPinDigit(value, String(i % 10));
  assert.equal(value.length, 6);
});
test('keypad rejects non-digit input', () => {
  assert.equal(pin.appendPinDigit('123', 'A'), '123');
  assert.equal(pin.appendPinDigit('123', '12'), '123');
});
test('typed and pasted PIN normalizes numeric characters only', () => {
  assert.equal(pin.normalizePinInput('1-2 3456789'), '123456');
});
test('backspace removes last digit without underflow', () => {
  assert.equal(pin.removeLastPinDigit('1234'), '123');
  assert.equal(pin.removeLastPinDigit(''), '');
});
test('haptic feature detection is graceful', () => {
  assert.equal(haptic.supportsPinHaptics(vib), true);
  assert.equal(haptic.supportsPinHaptics({}), false);
});
test('haptic defaults enabled when supported', () => {
  memory.clear();
  assert.equal(haptic.readPinHapticsEnabled(vib), true);
});
test('opt-out preference persists, without storing credentials', () => {
  haptic.savePinHapticsEnabled(false);
  assert.equal(haptic.readPinHapticsEnabled(vib), false);
  assert.equal(memory.get(haptic.PIN_HAPTIC_STORAGE_KEY), 'off');
});
test('haptic can be enabled again', () => {
  haptic.savePinHapticsEnabled(true);
  assert.equal(haptic.readPinHapticsEnabled(vib), true);
});
test('unsupported device cannot vibrate even if preference on', () => {
  assert.equal(haptic.readPinHapticsEnabled({}), false);
  assert.equal(haptic.vibratePinKey(true, 'digit', {}), false);
});
test('haptic pulse short and non-blocking on supported device', () => {
  events.length = 0;
  assert.equal(haptic.vibratePinKey(true, 'digit', vib), true);
  assert.equal(haptic.vibratePinKey(true, 'delete', vib), true);
  assert.equal(haptic.vibratePinKey(true, 'clear', vib), true);
  assert.equal(events.length, 3);
  assert.ok(events.every((n) => n >= 16 && n <= 120));
});
test('disabled haptic never vibrates', () => {
  events.length = 0;
  assert.equal(haptic.vibratePinKey(false, 'digit', vib), false);
  assert.equal(events.length, 0);
});
test('login gate still calls server authentication (not local PIN validation)', () => {
  assert.match(login, /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
  assert.match(login, /isSubmitting \|\| isLoading/);
});
test('keypad is visual-feedback-first with optional haptic toggle', () => {
  assert.match(login, /role="switch"/);
  assert.match(login, /Getaran tombol PIN/);
  assert.match(login, /onPinPointerDown\(event, 'digit', 'digit-' \+ num\)/);
  assert.match(login, /onPinClickFeedback\('digit', 'digit-' \+ num\)/);
  assert.match(css, /\.login-pin-pad > button \{/);
  assert.match(css, /touch-action: manipulation/);
});
test('animated login media does not rerender for every digit', () => {
  assert.match(login, /React\.memo\(LoginBackdrop\)/);
  assert.match(login, /loginBackdropConfig = useMemo/);
  assert.match(login, /<StableLoginBackdrop config=\{loginBackdropConfig\}/);
});
test('reduced motion disables scale animation while preserving pressed state', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.login-pin-pad > button:not\(:disabled\):active \{ transform: none; \}/);
});
console.log(`\nR98: ${passed}/${passed} checks passed.`);
