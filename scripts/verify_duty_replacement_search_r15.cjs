const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

let passed = 0;
function check(description, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${description}`);
}
const read = filename => fs.readFileSync(filename, 'utf8');
const dialog = read('src/features/attendance/DutyCoverageDialog.tsx');
const picker = read('src/components/common/SearchableSelect.tsx');
const service = read('src/services/firebase/dutyCoverageService.ts');

check('Dialog emergency-replacement parses as TSX', () => {
  const parsed = ts.createSourceFile('DutyCoverageDialog.tsx', dialog, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
});
check('Existing searchable picker parses as TSX', () => {
  const parsed = ts.createSourceFile('SearchableSelect.tsx', picker, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
});
check('Dialog uses shared SearchableSelect', () => assert.match(dialog, /import \{ SearchableSelect \} from '\.\.\/\.\.\/components\/common\/SearchableSelect'/));
check('Native select with full-screen mobile UI is removed', () => assert.doesNotMatch(dialog, /<select\b/));
check('Search picker keeps controlled selected value and update', () => {
  assert.match(dialog, /value=\{replacementId\}/);
  assert.match(dialog, /onChange=\{setReplacementId\}/);
});
check('Pending substitute option is selectable', () => assert.match(dialog, /value: '', label: 'Belum ada — Menunggu Pengganti'/));
check('Only active, activated, eligible roles are suggested and original officer is excluded', () => {
  assert.match(dialog, /u\.isActive === true && u\.requiresActivation !== true/);
  assert.match(dialog, /\['GURU', 'TENAGA_KEPENDIDIKAN', 'ADMIN', 'KEPALA_SEKOLAH'\]/);
  assert.match(dialog, /u\.id !== source\?\.petugasId/);
});
check('Candidate entries expose display name and role separately', () => {
  assert.match(dialog, /label: user\.fullName/);
  assert.match(dialog, /description: user\.role\.replaceAll/);
});
check('Search covers login ID, NIP and NUPTK', () => assert.match(dialog, /\[user\.loginId, user\.nip, user\.nuptk\]/));
check('Picker has a search box and filtered options', () => {
  assert.match(picker, /type="search"/);
  assert.match(picker, /options\.filter\(/);
});
check('Picker displays a readable empty search state', () => assert.match(picker, /Tidak ditemukan\. Coba kata kunci lain/));
check('Picker list limits height and supports scroll on mobile', () => assert.match(picker, /overflow-y-auto overscroll-contain/));
check('Picker closes after selecting an enabled option', () => assert.match(picker, /onChange\(option\.value\); close\(\)/));
check('Picker supports keyboard arrows and Enter', () => {
  assert.match(picker, /ArrowDown/);
  assert.match(picker, /ArrowUp/);
  assert.match(picker, /event\.key === 'Enter'/);
});
check('Picker disables selection while the dialog is saving', () => assert.match(dialog, /disabled=\{busy\}/));
check('Service keeps server-side conflict validation', () => {
  assert.match(service, /validateDutyCoverage\(input, input\.users\)/);
  assert.match(service, /Guru pengganti sudah mempunyai jadwal bentrok/);
});
console.log(`OK: ${passed} pemeriksaan terarah fitur pencarian pengganti R15 lulus.`);
