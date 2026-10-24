'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execSync} = require('node:child_process');
const {modify} = require('./r64_fix_student_card.cjs');
let ts;
try { ts=require('typescript'); }
catch { try { ts=require(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'typescript')); } catch { throw Error('Jalankan npm ci untuk memasang TypeScript.'); } }

const root=process.cwd();
const filepath=path.join(root,'src/features/student-tardiness/StudentTardyFormModal.tsx');
const cssPath=path.join(root,'src/features/student-tardiness/StudentTardyMobileR64.css');
const source=fs.readFileSync(filepath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');
let pass=0;
function test(name,fn){fn();pass++;console.log(`PASS ${String(pass).padStart(2,'0')}: ${name}`)}
function check(t){assert.ok(source.includes(t),`Tidak ditemukan: ${t}`)}

test('R64 marker in deployed TSX source',()=>check('data-r64="active"'));
test('Scoped stylesheet actually imported by form',()=>check("import './StudentTardyMobileR64.css'"));
test('Card JSX class is present',()=>check('r64-tardy-card'));
test('Student name wraps freely',()=>check('r64-tardy-name'));
test('Identity/status/actions occupy separate rows',()=>{
 const i=source.indexOf('className="r64-tardy-header"');
 const section=source.slice(i,i+5300);
 const names=['r64-tardy-identity','r64-tardy-status-row','r64-tardy-actions'];
 let last=0;
 for(const name of names){let pos=section.indexOf(name,last);assert.ok(pos>last,`${name} is not on a separate row`);last=pos}
});
test('Chosen students have no inner horizontal/vertical auto scroll',()=>{
 const i=source.indexOf('className="r64-tardy-selected-list');
 assert.ok(i>0);assert.ok(!source.slice(i,i+120).includes('overflow-y-auto'));
});
test('Photo action handler preserved',()=>check('setTargetStudentIdForPhoto(entry.student.id)'));
test('Photo modal open handler preserved',()=>check('setIsCameraOpen(true)'));
test('Individual adjustments preserved',()=>check('setExpandedStudentId(isExpanded ? null : entry.student.id)'));
test('Remove student handler preserved',()=>check('handleRemoveStudent(entry.student.id)'));
test('Status text and frequency still calculated',()=>{check('calc.displayText');check('entry.frekuensiBulanIni')});
test('Batch submission remains original handler',()=>check('onSubmit={handleInitiateSubmit}'));
test('CSS enables three fixed actions',()=>assert.match(css,/grid-template-columns:\s*repeat\(3,\s*minmax\(0,1fr\)\)/));
test('CSS eliminates sideways auto-scroll',()=>assert.match(css,/\.r64-tardy-selected-list\s*\{[^}]*overflow-x:\s*clip\s*!important;[^}]*overflow-y:\s*visible\s*!important;/s));
test('CSS wraps arbitrary long names',()=>assert.match(css,/\.r64-tardy-name\s*\{[^}]*overflow-wrap:\s*anywhere/s));
test('CSS actions large enough for touch',()=>assert.match(css,/\.r64-tardy-action\s*\{[^}]*min-height:\s*44px/s));
test('TypeScript/TSX parse without errors',()=>{
 const sf=ts.createSourceFile(filepath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(sf.parseDiagnostics.length,0,sf.parseDiagnostics.map(d=>String(d.messageText)).join('; '));
});
test('Transform refuses duplicate patch',()=>assert.throws(()=>modify(source),/R64 sudah ada/));
test('Transform rejects unexpected source before changing file',()=>assert.throws(()=>modify('not source'),/Struktur source/));
test('CSS is scoped to student-tardy form',()=>assert.ok(!css.includes('.app-dialog-body {') && !css.includes('body {')));
console.log(`R64: ${pass}/20 checks PASS`);
