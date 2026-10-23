const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const files = [
  'src/features/master/MasterDataTabs.tsx',
  'src/features/settings/SettingsView.tsx',
  'src/features/users/UsersPreview.tsx',
];
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks += 1; };

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const parse = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  check(parse.parseDiagnostics.length === 0, `${file}: TSX syntax errors ${parse.parseDiagnostics.map(x => ts.flattenDiagnosticMessageText(x.messageText, '; ')).join(', ')}`);
  const output = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  check(!output.diagnostics?.length, `${file}: transpile errors`);
}
const master = fs.readFileSync(files[0], 'utf8');
const settings = fs.readFileSync(files[1], 'utf8');
const users = fs.readFileSync(files[2], 'utf8');

check(master.includes('aria-label="Kategori Master Data"'), 'Master category navigation should be named.');
check(master.includes('grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'), 'Master tabs should use a 2/3/4-column responsive grid.');
check(master.includes('min-h-[52px]') && master.includes('break-words'), 'Master tabs should be touch-friendly and wrap long names.');
check(!master.includes('overflow-x-auto pb-2 scrollbar-thin border-b'), 'Master categories should not require sideways scrolling.');
for (const id of ['teachers', 'subjects', 'lessonSchedules', 'staff', 'students', 'rooms', 'categories', 'audit']) {
  check(master.includes(`{ id: '${id}',`), `Master tab ${id} must remain present.`);
}
check(users.includes('page-actions grid grid-cols-2'), 'Account/master main switcher must fit phones.');
check(settings.includes('const SETTINGS_NAV_ITEMS:') && settings.includes('SETTINGS_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)'), 'Desktop and mobile settings navigation should use the same role-gated items.');
check(settings.includes('<select') && settings.includes('id="settings-section-select"'), 'Mobile should have a compact native category select.');
check(settings.includes('hidden sm:grid sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'), 'Desktop settings tabs should form a visible multi-row grid.');
check(!settings.includes('overflow-x-auto max-w-full scrollbar-thin'), 'Settings tabs should not require sideways scrolling.');
const options = [...settings.matchAll(/\{ id: '([a-z_]+)', label: '([^']+)', icon: \w+(?:, adminOnly: true)? \}/g)];
check(options.length === 15, `Expected 15 settings tabs in the shared configuration; got ${options.length}`);
const expectedIds = ['school','branding','operational_reports','login_appearance','dashboard_info','student_tardy','lesson_periods','lobby_tv','security','bell','notifications','snapshots','backup','theme','audit'];
for (const id of expectedIds) {
  check(options.some(m => m[1] === id), `Missing settings menu ${id}`);
  check(settings.includes(`activeTab === '${id}'`), `Settings panel for ${id} must still exist.`);
}
const adminOnly = ['branding','operational_reports','login_appearance','dashboard_info','notifications'];
for (const id of adminOnly) {
  check(settings.includes(`id: '${id}', label:`) && options.some(m => m[0].includes('adminOnly: true') && m[1] === id), `Admin-only gate should remain for ${id}`);
}
console.log(`OK: R40 navigation verification: ${checks} checks passed.`);
console.log('- Master Data 8 categories: responsive grid, no horizontal tab scrolling.');
console.log('- Settings 15 categories: mobile picker and desktop multi-row grid, with role restrictions.');
console.log('- User account/master switcher: 2-column mobile layout.');
