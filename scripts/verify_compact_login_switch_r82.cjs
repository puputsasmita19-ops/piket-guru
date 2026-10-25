'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const login = fs.readFileSync(path.join(__dirname, '../src/features/auth/LoginPage.tsx'), 'utf8');
const checks = [];
const must = (label, rx) => checks.push([label, () => assert.match(login, rx)]);
const never = (label, rx) => checks.push([label, () => assert.doesNotMatch(login, rx)]);

must('Method switch and its label share a wrap-safe row', /flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1\.5/);
must('Method label retains accessible input reference', /<label htmlFor="login-account-search"[^>]+>[\s\S]*?Metode masuk[\s\S]*?<\/label>/);
must('Method buttons are compact and do not fill full width', /role="group" aria-label="Pilih metode masuk" className="ml-auto grid grid-cols-2 w-auto max-w-full shrink-0/);
never('Old full-width switch is removed', /role="group" aria-label="Pilih metode masuk" className="grid grid-cols-2 w-full/);
must('Thin compact segmented group', /rounded-xl border border-slate-200[^\n]+p-0\.5 gap-0\.5/);
checks.push(['Both buttons use width 79px on mobile and 88px on desktop', () => assert.equal((login.match(/w-\[79px\] sm:w-\[88px\]/g)||[]).length, 2)]);
checks.push(['44px mobile and 40px desktop targets remain', () => assert.equal((login.match(/min-h-11 sm:min-h-10 w-\[79px\]/g)||[]).length, 2)]);
must('Name button has search icon and visible label', /<Search className="w-3\.5 h-3\.5 shrink-0" aria-hidden="true" \/> Nama/);
must('ID button has key icon and visible label', /<KeyRound className="w-3\.5 h-3\.5 shrink-0" aria-hidden="true" \/> ID\/NIP/);
must('Name button retains accessible label', /aria-label="Cari Nama"/);
must('Name pressed state stays bound to actual login mode', /aria-pressed=\{!isManualInput\}/);
must('Manual pressed state stays bound to actual login mode', /aria-pressed=\{isManualInput\}/);
must('Switch buttons retain visible focus indicator', /focus-visible:outline-2 focus-visible:outline-offset-2/);
must('Only active mode renders respective input', /\{isManualInput \? \(/);
must('No invisible manual ID passed into name mode', /if \(isManualInput && !selectedUidRef\.current\) \{ setSelectedIdentifier\(''\); setPin\(''\); \}/);
must('R79 user recovery retained', /Coba Lagi<\/button>/);
must('PIN flow retained', /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
must('Name input remains accessible combobox', /role="combobox"/);
must('Manual ID input remains', /placeholder="Masukkan ID login atau NIP"/);
must('Trusted device setting remains', /setTrustedDevice/);
must('Google login retained', /loginWithGoogle\(\)/);
checks.push(['Source TSX parses', () => {
  const t = ts.createSourceFile('LoginPage.tsx', login, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(t.parseDiagnostics.length, 0, t.parseDiagnostics.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join(';'));
}]);
checks.push(['TypeScript transpile has no diagnostics', () => {
  const out = ts.transpileModule(login, {fileName:'LoginPage.tsx',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
  assert.deepEqual((out.diagnostics || []).filter(e=>e.category===ts.DiagnosticCategory.Error), []);
}]);
let pass = 0;
for (const [label, fn] of checks) {
  try { fn(); pass++; console.log('PASS', label); }
  catch(e) { console.error('FAIL', label, e.message); process.exitCode=1; }
}
console.log(`R82: ${pass}/${checks.length} checks passed`);
