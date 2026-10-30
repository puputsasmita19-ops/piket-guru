/** R96: pure action-eligibility and source regressions; no live GPS/Firebase required. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
let count = 0;
function check(label, fn) { fn(); console.log(`PASS ${++count}: ${label}`); }
function transpile(file) {
  const compiled = ts.transpileModule(read(file), {
    fileName:file,
    reportDiagnostics:true,
    compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022 },
  });
  const errors = (compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
  return compiled.outputText;
}
const file = 'src/features/attendance/attendanceActionHighlight.ts';
const exports = {};
const module = {exports};
vm.runInNewContext(`(function(module,exports) { ${transpile(file)} \n})(module,exports)`, {module,exports,console});
const {shouldHighlightCheckIn,shouldHighlightCheckOut} = module.exports;
const source = read('src/features/attendance/AttendancePreview.tsx');
const css = read('src/features/attendance/attendanceGps.css');

const base = {
  activeTab:'presensi',hasUser:true,online:true,settingsReady:true,validSchoolLocation:true,
  hasCheckIn:false,hasCheckOut:false,hasPhoto:true,hasPosition:true,
  gpsWithinRadius:true,gpsAccuracyOk:true,gpsHasError:false,hasSchedulePermission:true,
  checkOutWindowAllowed:false,busy:false,locating:false,cameraOpen:false,
};

check('TypeScript/TSX syntax clean',()=>{transpile('src/features/attendance/AttendancePreview.tsx');transpile(file);});
check('Check-In outlines when photo and GPS are ready',()=>assert.equal(shouldHighlightCheckIn(base),true));
check('Check-In absent before selfie is captured',()=>assert.equal(shouldHighlightCheckIn({...base,hasPhoto:false}),false));
check('Check-In absent when GPS is outside radius or low accuracy',()=>{
  assert.equal(shouldHighlightCheckIn({...base,gpsWithinRadius:false}),false);
  assert.equal(shouldHighlightCheckIn({...base,gpsAccuracyOk:false}),false);
  assert.equal(shouldHighlightCheckIn({...base,gpsHasError:true}),false);
});
check('Check-In absent when GPS missing or search ongoing',()=>{
  assert.equal(shouldHighlightCheckIn({...base,hasPosition:false}),false);
  assert.equal(shouldHighlightCheckIn({...base,locating:true}),false);
});
check('Check-In absent for invalid schedule and past check-in',()=>{
  assert.equal(shouldHighlightCheckIn({...base,hasSchedulePermission:false}),false);
  assert.equal(shouldHighlightCheckIn({...base,hasCheckIn:true}),false);
});
check('Check-Out outlines when an existing check-in and departure window are available',()=>{
  assert.equal(shouldHighlightCheckOut({...base,hasCheckIn:true,checkOutWindowAllowed:true}),true);
});
check('Check-Out absent before allowed hours',()=>assert.equal(shouldHighlightCheckOut({...base,hasCheckIn:true,checkOutWindowAllowed:false}),false));
check('Check-Out absent after checkout recorded',()=>assert.equal(shouldHighlightCheckOut({...base,hasCheckIn:true,hasCheckOut:true,checkOutWindowAllowed:true}),false));
check('Check-Out does not require stale GPS because checkout refreshes it',()=>{
  assert.equal(shouldHighlightCheckOut({...base,hasCheckIn:true,checkOutWindowAllowed:true,hasPosition:false}),true);
});
check('Both buttons absent when busy or camera open',()=>{
  for(const [fn,args] of [[shouldHighlightCheckIn,base],[shouldHighlightCheckOut,{...base,hasCheckIn:true,checkOutWindowAllowed:true}]]){
    for(const changes of [{busy:true},{cameraOpen:true},{locating:true}]) assert.equal(fn({...args,...changes}),false);
  }
});
check('Neither button outlined without account, settings, or network',()=>{
  for(const [fn,args] of [[shouldHighlightCheckIn,base],[shouldHighlightCheckOut,{...base,hasCheckIn:true,checkOutWindowAllowed:true}]]){
    for(const changes of [{hasUser:false},{online:false},{settingsReady:false},{validSchoolLocation:false},{activeTab:'riwayat'}]) assert.equal(fn({...args,...changes}),false);
  }
});
check('Only actions show ready markers, not data-changing auto-clicks',()=>{
  assert.match(source,/data-action-ready=\{highlightCheckIn \? 'checkin' : 'idle'\}/);
  assert.match(source,/data-action-ready=\{highlightCheckOut \? 'checkout' : 'idle'\}/);
  assert.match(source,/className=\{`w-full sm:w-auto \$\{highlightCheckIn/);
  assert.match(source,/className=\{`w-full sm:w-auto \$\{highlightCheckOut/);
  assert.doesNotMatch(source.slice(source.indexOf('const actionGuidance'),source.indexOf('// Restore attendance selfie draft')),/handleCheckIn\(\)|handleCheckOut\(\)/);
});
check('Checkout time eligibility reevaluated while panel stays open',()=>assert.match(source,/setInterval\(\(\) => setCheckoutWindowClockTick\(tick => tick \+ 1\), 30_000\)/));
check('Both buttons have accessible step instructions',()=>{
  assert.match(source,/attendance-checkin-ready-hint/);
  assert.match(source,/attendance-checkout-ready-hint/);
  assert.match(source,/aria-describedby=\{highlightCheckIn/);
  assert.match(source,/aria-describedby=\{highlightCheckOut/);
});
check('Outline does not shift layout and reduced-motion disables pulse',()=>{
  assert.match(css,/\.attendance-action-attention:not\(:disabled\)/);
  assert.match(css,/outline-offset:\s*3px/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/animation:\s*none/);
});
console.log(`\n${count}/${count} R96 checks passed.`);
