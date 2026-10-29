import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = p => readFileSync(path.join(root, p), 'utf8');
const cache = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${file} should parse`);
  const localRequire = spec => spec.startsWith('.') ? loadTs(path.resolve(path.dirname(file), spec + '.ts')) : require(spec);
  vm.runInNewContext(`(function(require, module, exports){${output.outputText}\n})`, { console })(localRequire, module, module.exports);
  return module.exports;
}
let passed = 0;
function test(name, fn) { fn(); console.log(`PASS ${++passed}: ${name}`); }
const types = loadTs(path.join(root, 'src/types/lobbyTv.types.ts'));
const kiosk = loadTs(path.join(root, 'src/features/kiosk/kioskPresentation.ts'));
const history = loadTs(path.join(root, 'src/utils/historyPeriod.ts'));
const cfg = types.DEFAULT_LOBBY_TV_CONFIG;

test('TV default provides six panels', () => assert.equal(kiosk.getKioskPanels(cfg).length, 6));
test('TV follows admin panel order', () => assert.equal(kiosk.getKioskPanels({...cfg,enabledPanels:['school_identity','visitors']}).join(','),'school_identity,visitors'));
test('TV supports one active panel', () => assert.equal(kiosk.getKioskPanels({...cfg,enabledPanels:['discipline']})[0], 'discipline'));
test('TV interval follows saved seconds', () => assert.equal(kiosk.kioskSlideIntervalMs({...cfg,slideIntervalSec:15}),15000));
test('TV interval clamps short invalid number', () => assert.equal(kiosk.kioskSlideIntervalMs({...cfg,slideIntervalSec:1}),cfg.slideIntervalSec*1000));
test('TV ticker reflects configured messages', () => assert.equal(kiosk.kioskTickerText({...cfg,tickerMessages:['A','B']}), 'A  •  B'));
test('TV ticker can be empty on purpose', () => assert.equal(kiosk.kioskTickerText({...cfg,tickerMessages:[]}),''));
test('TV sanitization prevents invalid panel IDs', () => assert.equal(types.sanitizeLobbyTvConfig({...cfg,enabledPanels:['visitors','fake']}).enabledPanels.join(','),'visitors'));
test('TV config comparison catches different slide order', () => assert.equal(types.areLobbyTvConfigsEqual({...cfg,enabledPanels:['visitors','discipline']},{...cfg,enabledPanels:['discipline','visitors']}),false));
test('Daily range queries one date only', () => { const r = history.getHistoryRange({mode:'today',anchor:'',semester:'current',from:'',to:''}, '2026-10-29'); assert.equal(r.start,r.end); assert.equal(r.start,'2026-10-29'); });
test('Monthly period still supported when explicitly selected', () => {const r = history.getHistoryRange({mode:'month',anchor:'',semester:'current',from:'',to:''}, '2026-10-29'); assert.equal(r.start,'2026-10-01'); assert.equal(r.end,'2026-10-31');});
test('Attendance recap explicitly initializes day mode', () => assert.match(source('src/features/attendance/AttendancePreview.tsx'), /useHistoryPeriod\(settings, 'today'\)/));
test('Other historical pages keep old default', () => assert.match(source('src/hooks/useHistoryPeriod.ts'), /initialMode: HistoryPeriodMode = 'month'/));
test('TV has actual conditional rendering for all six panels', () => {const f=source('src/features/kiosk/PublicKioskDisplay.tsx');for(const id of ['duty_teachers','substitutions','visitors','discipline','announcements','school_identity']) assert.ok(f.includes(`activePanel === '${id}'`),id);});
test('TV rotation is no longer hardcoded to 8000 ms', () => {const f=source('src/features/kiosk/PublicKioskDisplay.tsx');assert.ok(f.includes('kioskSlideIntervalMs(config)'));assert.ok(!f.includes('}, 8000)'));});
test('TV settings save updates narrow Firestore property', () => {const f=source('src/services/firebase/schoolSettingsService.ts');assert.match(f, /transaction\.update\(ref, \{ lobbyTv: sanitizedTv, updatedAt: serverTimestamp\(\) \}\)/);});
test('TV settings protects concurrent admin changes', () => {const f=source('src/services/firebase/schoolSettingsService.ts');assert.ok(f.includes('areLobbyTvConfigsEqual(current.lobbyTv, expectedConfig)'));});
for (const file of ['src/features/kiosk/PublicKioskDisplay.tsx','src/features/kiosk/kioskPresentation.ts','src/hooks/useHistoryPeriod.ts','src/features/attendance/AttendancePreview.tsx','src/services/firebase/schoolSettingsService.ts','src/features/settings/SettingsView.tsx','src/types/lobbyTv.types.ts']) {
  const f = source(file);
  const diagnostics = (ts.transpileModule(f, {fileName:file, reportDiagnostics:true, compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022}}).diagnostics || []).filter(d=>d.category===ts.DiagnosticCategory.Error);
  test(`${file} syntax`, () => assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' | ')).join(' | ')));
}
console.log(`\n${passed}/${passed} checks PASSED. Runtime Firestore integration and full build must still be tested in a configured project.`);
