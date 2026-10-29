/** R90-B: carousel page logic and low-cost rendering structural tests. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(path.join(root, p), 'utf8');
const cache = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}};cache.set(file,module);
  const out=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const localRequire = s => s.startsWith('.') ? loadTs(path.resolve(path.dirname(file),s+'.ts')) : require(s);
  vm.runInNewContext(`(function(require,module,exports){${out.outputText}\n})`,{console})(localRequire,module,module.exports);
  return module.exports;
}
let passed=0;
function test(name,fn){fn();console.log(`PASS ${++passed}: ${name}`);}
const cfg=loadTs(path.join(root,'src/types/lobbyTv.types.ts')).DEFAULT_LOBBY_TV_CONFIG;
const rules=loadTs(path.join(root,'src/features/kiosk/kioskPresentation.ts'));
for(const size of ['compact','standard','large']){
  const duty=rules.kioskPanelPageSize('duty_teachers',size);
  const subs=rules.kioskPanelPageSize('substitutions',size);
  test(`${size} page size for duty/visitors`,()=>assert.equal(rules.kioskPanelPageSize('visitors',size),duty));
  test(`${size} page size for substitution/announcement`,()=>assert.equal(rules.kioskPanelPageSize('announcements',size),subs));
  test(`${size} frame pages for 13 teachers`,()=>assert.equal(rules.getKioskFrames(['duty_teachers'],{duty_teachers:13},size).length,Math.ceil(13/duty)));
  test(`${size} page slices cover 13 teachers exactly once`,()=>{
    const frames=rules.getKioskFrames(['duty_teachers'],{duty_teachers:13},size);
    const seen=frames.flatMap(f=>Array.from({length:Math.min(duty,13-f.page*duty)},(_,i)=>f.page*duty+i));
    assert.deepEqual(seen,Array.from({length:13},(_,i)=>i));
  });
}
test('no items still shows one informative panel',()=>{const frames=rules.getKioskFrames(['visitors'],{visitors:0},'large');assert.equal(frames.length,1);assert.equal(frames[0].pages,1);});
test('non-list panel still one frame',()=>assert.equal(rules.getKioskFrames(['discipline','school_identity'],{discipline:200,school_identity:200},'large').length,2));
test('admin panel order maintained with page expansion',()=>{const frames=rules.getKioskFrames(['visitors','discipline','duty_teachers'],{visitors:9,duty_teachers:3},'large');assert.equal(frames.map(x=>x.panel).join(','),'visitors,visitors,visitors,discipline,duty_teachers');});
test('frame metadata gives predictable page numbering',()=>{const a=rules.getKioskFrames(['announcements'],{announcements:5},'large');assert.equal(a.map(x=>x.page).join(','),'0,1,2');assert.equal(a.every(x=>x.pages===3),true);});
test('slide rotation remains controlled by admin config',()=>assert.equal(rules.kioskSlideIntervalMs({...cfg,slideIntervalSec:12}),12000));
const view=src('src/features/kiosk/PublicKioskDisplay.tsx');
const css=src('src/index.css');
const settings=src('src/features/settings/LobbyTvSettingsCard.tsx');
test('clock moved out of carousel component',()=>{assert.match(view,/const KioskClock = React.memo/);assert.doesNotMatch(view,/setCurrentTime/);assert.match(view,/<KioskClock timezone=/);});
test('carousel uses separate exit and entry phases',()=>{assert.match(view,/setSlidePhase\('exit'\)/);assert.match(view,/setSlidePhase\('enter'\)/);assert.match(view,/data-phase=\{slidePhase\}/);});
test('animation respects OS reduced motion',()=>assert.match(view,/prefers-reduced-motion: reduce/));
test('timer cancellation and frame cleanup',()=>{assert.match(view,/clearTimeout\(timer\)/);assert.match(view,/cancelAnimationFrame\(firstFrame\)/);});
test('no old entrance-only animation classes in TV',()=>assert.doesNotMatch(view,/tv-transition-(fade|slide)/));
test('all six panels persist',()=>{for(const id of ['duty_teachers','substitutions','visitors','discipline','announcements','school_identity'])assert.ok(view.includes(`activePanel === '${id}'`));});
test('all four list types are paged',()=>{for(const id of ['duty_teachers','substitutions','visitors','announcements'])assert.ok(view.includes(`pageStart('${id}'), pageEnd('${id}')`));});
test('school day refresh is only once per minute',()=>assert.match(view,/setInterval\(refreshDay, 60_000\)/));
test('CSS stage uses GPU-safe properties',()=>{assert.match(css,/\.tv-kiosk-stage\[data-motion="slide"\]\[data-phase="exit"\]/);assert.match(css,/translate3d/);assert.doesNotMatch(css,/\.tv-kiosk-stage[^\n]*filter: blur/);});
test('density selector drives typography',()=>{assert.match(view,/--tv-density-offset/);assert.match(css,/var\(--tv-density-offset/);assert.match(settings,/value=\{draftConfig.densityScale\}/);});
test('title, names, body, and metrics have reading scale',()=>{for(const name of ['tv-type-title','tv-type-name','tv-type-body','tv-type-metric','tv-type-meta','tv-type-hero'])assert.ok(css.includes(name));});
test('ticker speed and font choices remain independent',()=>{assert.match(view,/data-ticker-size=\{config.tickerFontSize\}/);assert.match(css,/data-ticker-size="lg"/);assert.match(view,/config.tickerSpeed === 'slow'/);});
test('scoped kiosk styles do not override other pages',()=>{assert.match(css,/\.tv-kiosk-viewport/);assert.match(css,/\.tv-kiosk-stage/);});
test('no new remote fetches, database writes, or rules',()=>{assert.doesNotMatch(view,/fetch\(|transaction\.|addDoc\(|setDoc\(/);});
for(const name of ['src/features/kiosk/PublicKioskDisplay.tsx','src/features/kiosk/kioskPresentation.ts','src/features/settings/LobbyTvSettingsCard.tsx']){
 test(`${name} TS/TSX parser clean`,()=>{
  const output=ts.transpileModule(src(name),{fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  const errs=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errs.length,0,errs.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
 });
}
console.log(`\n${passed}/${passed} R90-B tests passed (unit/static; real browser performance still requires preview pilot).`);
