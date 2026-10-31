import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = readFileSync(join(process.cwd(), 'src/features/auth/LoginPage.tsx'), 'utf8');
const parsed = ts.createSourceFile('LoginPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed += 1; }
  catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; }
}

test('LoginPage TSX has no syntax parse error', () => {
  assert.equal(parsed.parseDiagnostics.length, 0, String(parsed.parseDiagnostics[0]?.messageText));
});
test('Only one conditional login error alert exists', () => {
  assert.equal((source.match(/\{errorMessage\s*&&\s*\(/g) || []).length, 1);
});
test('One role=alert for login errors', () => {
  assert.equal((source.match(/role="alert"/g) || []).length, 1);
});
test('Error alert has one stable id for assistive technology', () => {
  assert.equal((source.match(/id="pin-error-message"/g) || []).length, 1);
  assert.match(source, /aria-describedby=\{errorMessage \? 'pin-error-message' : undefined\}/);
});
test('Alert includes the original error message and icon', () => {
  assert.match(source, /role="alert"[\s\S]*?<AlertCircle[^>]+\/>[\s\S]*?\{errorMessage\}/);
});
test('The alert is placed between PIN input and the keypad', () => {
  const pinInput = source.indexOf('id="pin-input-field"');
  const alert = source.indexOf('id="pin-error-message"');
  const keypad = source.indexOf('className="login-pin-pad');
  assert.ok(pinInput >= 0 && alert > pinInput && keypad > alert);
});
test('There is no duplicate alert under the keypad', () => {
  const keypad = source.indexOf('className="login-pin-pad');
  const submit = source.indexOf('aria-busy={isSubmitting}', keypad);
  const content = source.slice(keypad, submit);
  assert.doesNotMatch(content, /\{errorMessage\s*&&\s*\(|role="alert"|Companion Error Message/);
});
test('Network/server failures still set the same error state', () => {
  assert.match(source, /Tidak dapat terhubung ke server\. Periksa koneksi internet Anda lalu coba lagi\./);
  assert.match(source, /setErrorMessage\(displayMsg\)/);
});
test('PIN input still clears previous errors when edited', () => {
  assert.match(source, /onChange=\{\(e\) => \{[\s\S]*?setPin\(val\);[\s\S]*?setErrorMessage\(''\)/);
});
test('PIN, keypad and submit handlers remain available', () => {
  assert.match(source, /onClick=\{\(\) => handlePinInput\(num\)\}/);
  assert.match(source, /onClick=\{\(\) => handleSubmit\(\)\}/);
  assert.match(source, /disabled=\{isSubmitting \|\| isLoading\}/);
});

console.log(`R105: ${passed}/10 passed`);
if (passed !== 10) process.exitCode = 1;
