/** R99 — tactile settings & device capability unit tests. Does not verify physical hardware. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const source = read('src/features/auth/pinHaptics.ts');
const login = read('src/features/auth/LoginPage.tsx');
const css = read('src/index.css');
const javascript = ts.transpileModule(source, {
  fileName: 'pinHaptics.ts',
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((javascript.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const context = { exports: {}, module: { exports: {} }, localStorage };
vm.runInNewContext(javascript.outputText, context, { filename: 'pinHaptics.js' });
const h = context.exports;
let count = 0;
const check = (description, fn) => { fn(); count++; console.log(`PASS ${description}`); };
const values = [];
const supported = { vibrate: (duration) => { values.push(duration); return true; } };

for (const path of ['src/features/auth/LoginPage.tsx', 'src/features/auth/pinHaptics.ts']) {
  check(`${path} valid TypeScript syntax`, () => {
    const result = ts.transpileModule(read(path), {
      fileName: path, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  });
}
check('unsupported browser reports capability unavailable', () => assert.equal(h.supportsPinHaptics({}), false));
check('supported browser reports API capability (not motor guarantee)', () => assert.equal(h.supportsPinHaptics(supported), true));
check('unsupported device defaults off without calling vibrate', () => assert.equal(h.readPinHapticsEnabled({}), false));
check('R98 opt-out preference is preserved', () => {
  h.savePinHapticsEnabled(false);
  assert.equal(h.readPinHapticsEnabled(supported), false);
  assert.equal(storage.get(h.PIN_HAPTIC_STORAGE_KEY), 'off');
});
check('R98 opt-in preference remains on', () => {
  h.savePinHapticsEnabled(true);
  assert.equal(h.readPinHapticsEnabled(supported), true);
  assert.equal(storage.get(h.PIN_HAPTIC_STORAGE_KEY), 'on');
});
check('normal strength is default', () => { storage.delete(h.PIN_HAPTIC_STRENGTH_KEY); assert.equal(h.readPinHapticStrength(), 'normal'); });
check('strength selection is persisted per device', () => {
  h.savePinHapticStrength('strong');
  assert.equal(h.readPinHapticStrength(), 'strong');
  assert.equal(storage.get(h.PIN_HAPTIC_STRENGTH_KEY), 'strong');
});
check('invalid strength falls back to normal', () => {
  storage.set(h.PIN_HAPTIC_STRENGTH_KEY, 'unsafe');
  assert.equal(h.readPinHapticStrength(), 'normal');
});
check('strength increases physically requested duration', () => {
  values.length = 0;
  for (const strength of ['light', 'normal', 'strong']) {
    assert.equal(h.vibratePinKey(true, 'digit', supported, strength), true);
  }
  assert.ok(values[0] < values[1] && values[1] < values[2]);
  assert.ok(values.every(v => v >= 16 && v <= 65));
});
check('explicit test vibration is longer than digit feedback', () => {
  values.length = 0;
  h.vibratePinKey(true, 'digit', supported, 'normal');
  h.vibratePinKey(true, 'test', supported, 'normal');
  assert.ok(values[1] > values[0]);
});
check('disabled haptic never invokes vibrate', () => {
  values.length = 0;
  assert.equal(h.vibratePinKey(false, 'digit', supported), false);
  assert.equal(values.length, 0);
});
check('browser rejecting request never implies tactile success', () => assert.equal(h.vibratePinKey(true, 'test', { vibrate: () => false }), false));
check('browser throws => graceful no-op', () => assert.equal(h.vibratePinKey(true, 'test', { vibrate: () => { throw Error('blocked'); } }), false));
check('keypad requests vibration synchronously on touch pointer-down', () => {
  assert.match(login, /onPointerDown=\{\(event\) => \{ if \(pin\.length < 6\) onPinPointerDown\(event, 'digit'\); \}\}/);
  assert.match(login, /vibratePinKey\(hapticsEnabled, kind, undefined, hapticStrength\)/);
});
check('click avoids duplicate pulse following pointer-down', () => {
  assert.match(login, /const touchedRecently = Date\.now\(\) - pointerFeedbackAtRef\.current < 1500/);
  assert.match(login, /if \(!touchedRecently\) vibratePinKey/);
});
check('PIN still uses real login service and no local auth bypass', () => {
  assert.match(login, /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
});
check('haptic UI has local strength selection and explicit test button', () => {
  assert.match(login, /id="pin-haptic-strength"/);
  assert.match(login, /Coba Getaran/);
  assert.match(login, /role="switch"/);
  assert.match(login, /Browser ini tidak menyediakan getaran web/);
});
check('unsupported users keep visible keypad feedback', () => assert.match(css, /login-pin-pad > button:not\(:disabled\):active/));
check('no authentication or PIN data is written to haptic storage', () => {
  assert.equal(Object.keys(Object.fromEntries(storage)).every((name) => name.startsWith('piket_guru_pin_haptic')), true);
});
console.log(`\nR99: ${count}/${count} targeted tests PASS`);
