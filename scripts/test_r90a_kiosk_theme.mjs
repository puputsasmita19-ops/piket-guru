/** R90-A static/logic regressions. Run from repository root: node scripts/test_r90a_kiosk_theme.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
  try { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); } catch {
    console.error('Install dev dependencies to run this test: npm ci');
    process.exit(1);
  }
}
const load = (name) => readFileSync(new URL(`../src/features/${name}`, import.meta.url), 'utf8');
let count = 0;
function test(label, fn) { fn(); count++; console.log(`PASS ${count}: ${label}`); }
const source = load('kiosk/kioskTheme.ts');
const compiled = ts.transpileModule(source, {fileName: 'kioskTheme.ts', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }});
const module = { exports: {} };
new Script(compiled.outputText).runInNewContext({ exports: module.exports, module, Object });
const { getKioskTheme } = module.exports;
const options = ['default','sky','mint','lavender','peach','rose'];
for (const theme of options) {
  const dark = getKioskTheme({colorMode:'dark',theme});
  const light = getKioskTheme({colorMode:'light',theme});
  test(`${theme}: light changes card, background, and text`, () => {
    assert.equal(dark.mode,'dark'); assert.equal(light.mode,'light');
    for (const key of ['background','card','inset','text','muted','border','accent','soft']) assert.notEqual(dark[key],light[key]);
    assert.equal(light.background,'#f8fafc'); assert.equal(dark.background,'#020617');
  });
}
for (let i=1;i<options.length;i++) test(`${options[i]} accent differs from default`, () => {
  for (const mode of ['light','dark']) assert.notEqual(getKioskTheme({colorMode: mode,theme: options[i]}).accent,getKioskTheme({colorMode:mode,theme:'default'}).accent);
});
test('bad/outdated theme has safe fallback', () => assert.equal(getKioskTheme({colorMode:'light',theme:'invalid'}).accent,getKioskTheme({colorMode:'light',theme:'default'}).accent));
const display = load('kiosk/PublicKioskDisplay.tsx');
const mini = load('kiosk/KioskPreview.tsx');
const settings = load('settings/LobbyTvSettingsCard.tsx');
test('full-screen TV consumes live config', () => assert.match(display,/getKioskTheme\(config\)/));
test('TV uses per-instance background and text for every slide', () => {
 assert.match(display,/--kiosk-bg/);assert.match(display,/bg-\[var\(--kiosk-bg\)\] text-\[var\(--kiosk-text\)\]/);
 assert.doesNotMatch(display, /<main[^>]*bg-slate-950/);
 assert.match(display, /bg-\[var\(--kiosk-card\)\]/);
});
test('header and ticker consume palette', () => {
 assert.match(display, /<header[^>]*bg-\[var\(--kiosk-card\)\]/);
 assert.match(display, /<footer[^>]*bg-\[var\(--kiosk-card\)\]/);
});
test('all slides remain available', () => {
 for (const id of ['duty_teachers','substitutions','visitors','discipline','announcements','school_identity']) assert.ok(display.includes(`activePanel === '${id}'`));
});
test('dashboard small TV preview follows live school settings', () => {
 assert.match(mini,/subscribeToDocument<SchoolSettings>/);
 assert.match(mini,/getKioskTheme\(kioskConfig\)/);
 assert.match(mini,/style=\{miniVars\}/);
});
test('settings exposes distinct brightness and accent selectors', () => {
 assert.match(settings,/value=\{draftConfig.theme\}/); assert.match(settings,/value=\{draftConfig.colorMode\}/);
});
test('settings preview follows unsaved draft and offers save', () => {
 assert.match(settings,/getKioskTheme\(draftConfig\)/);
 assert.match(settings,/style=\{\{ backgroundColor: selectedTvPalette.background/);
 assert.match(settings,/onSaveTvSettings\(draftConfig\)/);
});
for (const name of ['kiosk/kioskTheme.ts','kiosk/PublicKioskDisplay.tsx','kiosk/KioskPreview.tsx','settings/LobbyTvSettingsCard.tsx']) {
 test(`${name}: TS/TSX syntax`, () => {
  const x = load(name);
  const output = ts.transpileModule(x,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
  assert.equal((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 });
}
console.log(`\n${count}/${count} R90-A checks PASSED (logic/static checks; full build and browser integration not covered).`);
