import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
import vm from 'node:vm';

const root = process.cwd();
const read = name => readFileSync(join(root, name), 'utf8');
const login = read('src/features/auth/LoginPage.tsx');
const css = read('src/index.css');
const service = read('src/services/auth/authService.ts');
const context = read('src/contexts/AuthContext.tsx');
const timingSource = read('src/features/auth/loginPerformance.ts');
let passed = 0;
function test(name, fn) {
  try { fn(); console.log('✓', name); passed += 1; }
  catch (error) { console.error('✗', name, error?.message); process.exitCode = 1; }
}

// TypeScript TSX parse checks are independent of missing project node_modules.
for (const file of ['src/features/auth/LoginPage.tsx','src/features/auth/loginPerformance.ts','src/services/auth/authService.ts']) {
  test(`${file} parses`, () => {
    const source = read(file);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(parsed.parseDiagnostics.length, 0, String(parsed.parseDiagnostics[0]?.messageText));
  });
}
test('search and ID/NIP share one rounded clipped frame', () => {
  assert.match(login, /login-account-combobox[^"\n]*overflow-hidden[^"\n]*rounded-xl/);
  assert.match(login, /login-account-switch/);
  assert.match(login, /rounded-l-xl/);
  assert.match(css, /\.dark \.login-page \.login-account-combobox/);
});
test('search combobox and manual ID/NIP mode remain available', () => {
  assert.match(login, /id="login-account-search"/);
  assert.match(login, /Cari nama/);
  assert.match(login, /ID\/NIP/);
  assert.match(login, /setIsManualInput/);
});
test('all 3 timing segments use browser performance timeline', () => {
  assert.match(service, /recordLoginDuration\('pin-api'/);
  assert.match(service, /recordLoginDuration\('firebase-signin'/);
  assert.match(login, /recordLoginDuration\('pin-end-to-end'/);
  assert.doesNotMatch(timingSource, /localStorage|sessionStorage|fetch\(/);
});
test('login is server-authorized and cannot be short circuited by timing measurements', () => {
  assert.match(service, /await fetch\('\/api\/auth\/login'/);
  assert.match(service, /await signInWithCustomToken\(auth, data.customToken\)/);
  assert.match(service, /userCredential.user.uid !== data.user.id/);
  assert.match(context, /authService.authenticateWithPin/);
});
test('one-time hygiene prewarms away from PIN submit while login awaits init', () => {
  assert.match(login, /window\.setTimeout\(\(\) => \{ void authService.init\(\); \}, 0\)/);
  assert.match(service, /await this\.init\(\)/);
});
test('slow network still shows progress; no fake <3 second success', () => {
  assert.match(login, /isLoginSlow/);
  assert.doesNotMatch(login, /setTimeout\([^)]*setCurrentUser/);
});
test('runtime timings are non-negative and carry only phase names', () => {
  const js = ts.transpileModule(timingSource, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const values=[];
  const ctx={exports:{},performance:{now:()=>117, measure:(name, options)=>values.push([name, options])}, Date};
  vm.runInNewContext(js, ctx);
  assert.equal(ctx.exports.recordLoginDuration('pin-api', 99), 18);
  assert.equal(values[0][0], 'piket-login-pin-api');
  assert.equal(ctx.exports.recordLoginDuration('pin-end-to-end', 300), 0);
});
console.log(`R101: ${passed}/10 tests passed`);
if (passed !== 10) process.exitCode=1;
