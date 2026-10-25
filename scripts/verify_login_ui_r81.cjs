'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const login = read('src/features/auth/LoginPage.tsx');
const appCss = read('src/index.css');
const r80 = read('src/types/dashboardInfo.types.ts');
const list = [];
function test(name, fn) {list.push({name, fn});}
function must(name, re) {test(name, () => assert.match(login, re));}
function never(name, re) {test(name, () => assert.doesNotMatch(login, re));}

must('Compact method switch uses two equal columns', /role="group" aria-label="Pilih metode masuk" className="(?:ml-auto )?grid grid-cols-2/);
must('Both switches keep visible concise labels', /<Search[^>]*\/> Nama[\s\S]*?<KeyRound[^>]*\/> ID\/NIP/);
must('Search accessible name is retained', /aria-label="Cari Nama"/);
must('Method switch is focusable and has pressed state', /aria-pressed=\{!isManualInput\}/);
must('Manual switch pressed state', /aria-pressed=\{isManualInput\}/);
must('Touch target mobile 44px', /min-h-11 sm:min-h-10/);
must('Method switch has visible label', /Metode masuk\s*<\/label>/);
must('Conditional manual field only', /\{isManualInput \? \(/);
must('Manual mode placeholder', /placeholder="Masukkan ID login atau NIP"/);
must('Name search placeholder', /placeholder="Cari nama guru atau ID\.\.\."/);
must('Search input local state is controlled', /value=\{searchQuery\}/);
must('Clear button is accessible', /aria-label="Hapus pencarian nama"/);
must('Clear button resets list and refocuses', /setSearchQuery\(''\); setHighlightedIndex\(0\); setIsComboboxOpen\(true\); searchInputRef\.current\?\.focus\(\)/);
must('Results are limited to three on first open', /filteredUsers\.slice\(0, 3\)/);
must('Typing restores all matching results', /searchQuery\.trim\(\) \? filteredUsers : filteredUsers\.slice/);
must('Keyboard uses actual visible results', /visibleUsers\[highlightedIndex\]/);
never('Old mismatch: keyboard selection on entire hidden list', /handleSelectUser\(filteredUsers\[highlightedIndex\]\)/);
must('Results have bounded scrolling', /max-h-44 sm:max-h-48 overflow-y-auto/);
must('Selected card uses low-data thumbnail', /<LoginAvatar user=\{selectedUser\} compact/);
must('Selected account name keeps overflow handling', /<OverflowName name=\{selectedUser\.fullName\} config=\{schoolSettings\.publicNameMarquee\}/);
must('Status role badge remains', /ROLE_LABELS\[selectedUser\.role\]/);
must('R79 recovery retry preserved', /Coba Lagi<\/button>/);
must('Unverified user summary still rejected', /getUsersListStatus\?\.\(\)\.verified === false/);
must('Default manual login remains available during outage', /Gunakan ID\/NIP atau coba lagi/);
must('Manual hidden ID cleared on switching to name', /if \(isManualInput && !selectedUidRef\.current\) \{ setSelectedIdentifier\(''\); setPin\(''\); \}/);
must('PIN login function unchanged', /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
must('Google Admin login unchanged', /loginWithGoogle\(\)/);
must('Trusted device unchanged', /setTrustedDevice/);
must('PIN keypad remains', /PIN Keamanan \(6 Digit\)/);
must('Card mobile remains responsive', /login-card relative w-full max-w-md/);
must('No raw Firestore access added', /fetch\('\/api\/auth\/public-config'/);
never('No accidental new unauthenticated Firestore query', /onSnapshot\(|getDocs\(/);
test('Login TSX parses',()=>{const result=ts.createSourceFile('LoginPage.tsx',login,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);assert.equal(result.parseDiagnostics.length,0,result.parseDiagnostics.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; '));});
test('Login transpiles without diagnostics',()=>{const r=ts.transpileModule(login,{fileName:'LoginPage.tsx',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual((r.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error),[]);});
test('R80 Node ESM fix preserved in repository',()=>assert.match(r80,/\.\/dashboardWelcome\.types\.js/));
test('Login mobile CSS retains keypad tap targets',()=>assert.match(appCss,/\.login-pin-pad > button \{ height: 44px; \}/));
test('Login respects reduced-motion preference',()=>assert.match(appCss,/@media \(prefers-reduced-motion: reduce\)/));
let passed = 0;
for (const x of list) {
  try {x.fn(); console.log(`PASS ${String(++passed).padStart(2,'0')} — ${x.name}`);} catch (err) {console.error(`FAIL — ${x.name}:`,err.message);process.exitCode=1;}
}
console.log(`R81: ${passed}/${list.length} checks passed`);
