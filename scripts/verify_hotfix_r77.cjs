'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const file = 'src/types/dashboardInfo.types.ts';
const text = fs.readFileSync(path.join(root, file), 'utf8');
const result = ts.transpileModule(text, {
  fileName: file,
  reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const issues = (result.diagnostics || []).filter(issue => issue.category === ts.DiagnosticCategory.Error);
assert.equal(issues.length, 0, 'TypeScript syntax must remain valid');
const moduleObject = { exports: {} };
vm.runInNewContext(result.outputText, {
  module: moduleObject, exports: moduleObject.exports,
  require: (name) => {
    if (name.endsWith('/dashboardWelcome.types.js')) {
      return { sanitizeDashboardWelcomeConfig: () => ({ enabled: true, mode: 'fixed' }) };
    }
    throw Error(`Unexpected import: ${name}`);
  },
});
const { sanitizeNameMarqueeConfig, sanitizeDashboardInfoConfig } = moduleObject.exports;
let checks = 0;
const check = (title, input, enabled, durationSeconds) => {
  const actual = sanitizeNameMarqueeConfig(input);
  assert.equal(actual.enabled, enabled, title);
  assert.equal(actual.durationSeconds, durationSeconds, title);
  checks++;
  console.log('PASS', title);
};
check('missing school setting uses defaults', undefined, true, 16);
check('null school setting uses defaults', null, true, 16);
check('empty school setting uses defaults', {}, true, 16);
check('boolean-only setting uses numeric duration', { enabled: false }, false, 16);
check('allowed 8-second duration', { enabled: true, durationSeconds: 8 }, true, 8);
check('allowed 12-second duration', { durationSeconds: 12 }, true, 12);
check('allowed 16-second duration', { durationSeconds: 16 }, true, 16);
check('allowed 20-second duration', { durationSeconds: 20 }, true, 20);
check('allowed 28-second duration', { durationSeconds: 28 }, true, 28);
check('invalid duration falls back', { durationSeconds: 900 }, true, 16);
check('NaN duration falls back', { durationSeconds: NaN }, true, 16);
check('incorrect runtime type falls back', { durationSeconds: '16' }, true, 16);
const checkDashboard = (title, input, expected) => {
  const value = sanitizeDashboardInfoConfig(input);
  assert.equal(value.nameMarquee.durationSeconds, expected, title);
  assert.equal(typeof value.nameMarquee.enabled, 'boolean', title);
  checks++;
  console.log('PASS', title);
};
checkDashboard('Dashboard without existing dashboardInfoConfig', undefined, 16);
checkDashboard('Dashboard without nameMarquee inside config', { enabled: true }, 16);
checkDashboard('Dashboard with explicit null nameMarquee', { nameMarquee: null }, 16);
checkDashboard('Dashboard with saved marquee config', { nameMarquee: { enabled: false, durationSeconds: 28 } }, 28);
checkDashboard('Server login summary with legacy settings', { welcome: {} }, 16);
for (const file of ['src/features/dashboard/DashboardView.tsx', 'src/server/routes/authRoutes.ts']) {
  // On the checkout, verify both callers still depend on the common sanitizer.
  const source = fs.existsSync(path.join(root,file)) ? fs.readFileSync(path.join(root,file),'utf8') : null;
  if (source) {
    assert.ok(source.includes(file.includes('DashboardView') ? 'sanitizeDashboardInfoConfig' : 'sanitizeNameMarqueeConfig'));
    checks++;
    console.log('PASS',file,'caller intact');
  }
}
console.log(`R77 emergency hotfix verified: ${checks}/${checks} checks passed`);
