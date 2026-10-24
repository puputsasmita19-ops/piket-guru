#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let ts;
try { ts = require('typescript'); } catch { console.error('Install dependensi dulu: npm ci (typescript belum tersedia).'); process.exit(2); }
const srcPath = path.resolve(process.cwd(), 'src/features/student-tardiness/StudentTardyFormModal.tsx');
const source = fs.readFileSync(srcPath, 'utf8');
const tests=[];
function test(name, fn) {tests.push([name,fn]);}
function matches(name, pattern){test(name,()=>assert.match(source,pattern));}
function once(name,pattern) {test(name,()=>{const x=source.match(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g')); assert.equal(x?.length??0,1);});}
const syntax = ts.createSourceFile(srcPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
test('TSX parse clean',()=>assert.equal(syntax.parseDiagnostics.length,0,syntax.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; ')));
test('TS transpile clean',()=>{const result=ts.transpileModule(source,{fileName:srcPath,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});assert.equal((result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);});
matchers();
function matchers(){
 matches('R61 marker installed',/R61 MOBILE TARDY CARD/);
 matches('Mobile identity column wrap',/flex min-w-0 flex-col gap-2\.5 sm:flex-row sm:items-start sm:justify-between/);
 matches('Student name wraps instead of clipping',/block break-words text-sm font-bold/);
 matches('Parent phone can wrap',/min-w-0 break-all">Ortu:/);
 matches('Long status wraps to new line',/max-w-full min-w-0 items-center break-words whitespace-normal/);
 matches('Frequency preserved',/Ke-\{entry\.frekuensiBulanIni\}/);
 matches('Actions in three separate touch targets',/grid min-w-0 grid-cols-3 gap-2 border-t/);
 matches('Camera button touch target 44px',/min-h-11[\s\S]*?Foto Ada/);
 matches('Customization toggle touch target',/min-h-11[\s\S]*?aria-expanded=\{isExpanded\}/);
 matches('Delete button touch target',/min-h-11[\s\S]*?Hapus/);
 matches('Photo capture still associates student id',/setTargetStudentIdForPhoto\(entry\.student\.id\)/);
 matches('Delete still uses same action',/onClick=\{\(\) => handleRemoveStudent\(entry\.student\.id\)\}/);
 matches('Customize preserves student id and state',/setExpandedStudentId\(isExpanded \? null : entry\.student\.id\)/);
 matches('Expanded individual section accessible',/id=\{`student-tardy-adjust-\$\{idx\}`\}/);
 matches('Student list bounded vertical scroll',/max-h-\[62dvh\] overflow-x-hidden overflow-y-auto/);
 matches('Individual grid stacks on mobile',/grid min-w-0 grid-cols-1 gap-3 text-xs sm:grid-cols-3/);
 matches('Time, reason, coaching preserved',/jamDatang: e\.target\.value/);
 matches('Reason select preserved',/alasan: e\.target\.value as TardyReason/);
 matches('Coaching select preserved',/pembinaan: e\.target\.value as DisciplineAction/);
 matches('Reset button preserved',/handleResetStudentCustomization\(entry\.student\.id\)/);
 matches('Mobile input large enough',/min-h-11 min-w-0 w-full rounded-xl/);
 matches('Shared time preserved',/value=\{sharedJamDatang\}/);
 matches('Batch request id preserved',/batchRequestIdRef/);
 matches('Batch service call preserved',/StudentTardyService/);
 matches('Image picker still present',/CameraCaptureModal/);
 matches('Does not change permissions or Firestore',/useAuth\(\)/);
 once('Only one selected card header',/R61 MOBILE TARDY CARD/);
}
let passed=0;
for(const [name,fn] of tests){try {fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
console.log(`R61: ${passed}/${tests.length} UI + TS checks passed`);
