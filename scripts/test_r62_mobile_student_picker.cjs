#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const {transform}=require('./r62_mobile_student_picker_transform.cjs');
let ts;
try { ts=require('typescript'); } catch { console.error('TypeScript tidak tersedia. Jalankan npm ci terlebih dahulu.');process.exit(2); }
const root=process.cwd();
const file='src/features/student-tardiness/StudentTardyFormModal.tsx';
const cssFile='src/features/student-tardiness/StudentTardyMobileR62.css';
const s=fs.readFileSync(path.join(root,file),'utf8');
const css=fs.readFileSync(path.join(root,cssFile),'utf8');
let passed=0, failed=0;
function test(name, action){try{action();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.message);failed++;}}
function has(name,pattern){test(name,()=>assert.match(s,pattern));}
test('R62 TSX parses',()=>{
 const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0,tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
});
test('R62 TSX transpiles',()=>{
 const r=ts.transpileModule(s,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal((r.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
has('Source R61 still present',/R61 MOBILE TARDY CARD/);
has('R62 installed',/R62 MOBILE STUDENT PICKER/);
has('CSS imported into form',/import '\.\/StudentTardyMobileR62\.css'/);
has('Form horizontal bounds',/r62-tardy-fields min-w-0 w-full max-w-full/);
has('Picker bounded and observed',/ref=\{r62PickerRef\} className="r62-tardy-picker/);
has('Horizontal scroll reset on student change',/useLayoutEffect\(\(\) => \{[\s\S]*?fields\.scrollLeft = 0/);
has('Do not reset vertical scroll',/picker\.scrollLeft = 0;[\s\S]*?body\.scrollLeft = 0/);
has('Search input viewport width',/box-border w-full min-w-0 max-w-full min-h-\[44px\]/);
has('Search options use touch/keyboard button',/type="button"\s+key=\{std\.id\}\s+disabled=\{isAlreadySelected\}/);
has('Search onClick existing handler',/onClick=\{\(\) => \{ if \(!isAlreadySelected\) void handleAddStudent\(std\); \}\}/);
has('No nested form submit for result',/r62-tardy-result-row/);
has('Search name wraps',/min-w-0 break-words">\{std\.nama\}/);
has('Search metadata wraps',/r62-tardy-option-meta/);
has('Selected cards width limited',/r62-tardy-card min-w-0 w-full max-w-full/);
has('Three separate actions',/r62-tardy-actions grid min-w-0 grid-cols-3/);
has('Camera remains',/setTargetStudentIdForPhoto\(entry\.student\.id\)/);
has('Customize remains',/setExpandedStudentId\(isExpanded \? null : entry\.student\.id\)/);
has('Delete remains',/handleRemoveStudent\(entry\.student\.id\)/);
has('Individual time preserved',/jamDatang: e\.target\.value/);
has('Individual reason preserved',/alasan: e\.target\.value as TardyReason/);
has('Individual coaching preserved',/pembinaan: e\.target\.value as DisciplineAction/);
has('Batch submit preserved',/saveBatchTardyStudents\(/);
has('Sync offline queue preserved',/SyncQueueService\.enqueue\(/);
test('CSS scoped only to R62',()=>{assert.match(css,/\.r62-tardy-fields/);assert.match(css,/overflow-x: hidden/);assert.match(css,/position: static/);assert.match(css,/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);});
test('CSS balance sanity',()=>assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length));
test('Double apply rejected',()=>assert.throws(()=>transform(s),/R62 sudah terpasang/));
test('Legacy source rejected',()=>assert.throws(()=>transform(s.replace('R61 MOBILE TARDY CARD','OLD HEADER').replace('R62 MOBILE STUDENT PICKER','OLD PATCH').replace("import './StudentTardyMobileR62.css';",'')),/Source belum menunjukkan R61|R62 sudah terpasang/));
test('Partial source mismatch rejected',()=>{
 const old=s.replace('R62 MOBILE STUDENT PICKER','R61 SOURCE').replace("import './StudentTardyMobileR62.css';",'');
 assert.throws(()=>transform(old),/struktur berubah|React hook import|picker reference/);
});
console.log(`R62: ${passed}/${passed+failed} checks passed`);
if(failed)process.exitCode=1;
