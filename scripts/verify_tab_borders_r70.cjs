const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const files = [
  'src/features/users/UsersPreview.tsx',
  'src/features/users/UserManagementView.tsx',
];
let passed = 0;
const check = (label, operation) => {
  try { operation(); passed++; console.log(`PASS: ${label}`); }
  catch (error) { console.error(`FAIL: ${label}: ${error.message}`); process.exitCode = 1; }
};

for (const file of files) {
  const input = fs.readFileSync(file, 'utf8');
  check(`${file} syntax`, () => {
    const source = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(source.parseDiagnostics.length, 0, source.parseDiagnostics.map(d => d.messageText).join('; '));
  });
  check(`${file} relative imports still exist`, () => {
    const path = require('node:path');
    for (const match of input.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
      const root = path.resolve(path.dirname(file), match[1]);
      assert.ok(['.ts','.tsx','.json','', '/index.ts','/index.tsx'].some(ext => fs.existsSync(root+ext)), `Missing ${match[1]}`);
    }
  });
}
const main = fs.readFileSync(files[0], 'utf8');
const category = fs.readFileSync(files[1], 'utf8');
check('Both main tabs have border in common class', () => assert.equal((main.match(/rounded-lg border text-xs/g)||[]).length,2));
check('Both main tabs have visible inactive border', () => assert.equal((main.match(/: 'border-slate-300 dark:border-slate-600/g)||[]).length,2));
check('Both main tabs use active theme border', () => assert.equal((main.match(/\? 'border-\[var\(--theme-primary-border\)\]/g)||[]).length,2));
check('Main tabs do not change their click handlers', () => {
  assert.match(main,/onClick=\{\(\) => setActiveMainTab\('users'\)\}/);
  assert.match(main,/onClick=\{\(\) => setActiveMainTab\('master'\)\}/);
});
check('Main tabs announce active state', () => assert.equal((main.match(/aria-pressed=\{activeMainTab ===/g)||[]).length,2));
check('Both category tabs have border in common class', () => assert.equal((category.match(/rounded-xl border text-xs font-bold transition-colors/g)||[]).length,2));
check('Both category tabs have visible inactive border', () => assert.equal((category.match(/: 'border-slate-300 dark:border-slate-600/g)||[]).length,2));
check('Category active tabs have distinct border', () => {
  assert.match(category,/\? 'border-\[var\(--theme-primary-border\)\] bg-white/);
  assert.match(category,/\? 'border-emerald-300 dark:border-emerald-600 bg-white/);
});
check('Category tabs keep existing click handlers', () => {
  assert.match(category,/onClick=\{\(\) => setActiveCategory\('GURU'\)\}/);
  assert.match(category,/onClick=\{\(\) => setActiveCategory\('SISWA'\)\}/);
});
check('Category tabs announce active state', () => assert.equal((category.match(/aria-pressed=\{activeCategory ===/g)||[]).length,2));
check('Existing counts are preserved', () => {
  assert.match(category,/\{totalUsers\}/);
  assert.match(category,/\{totalStudents\}/);
});
check('Same border width across selected and unselected', () => {
  assert.ok(!main.includes('border-2'));
  assert.match(main, /rounded-lg border text-xs/);
  assert.match(category, /rounded-xl border text-xs/);
});
console.log(`R70: ${passed}/16 checks passed`);
