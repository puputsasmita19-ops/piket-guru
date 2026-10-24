'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {transformForm,transformModal} = require('./r63_mobile_tardy_transform.cjs');
const base = process.cwd();
const formPath=path.join(base,'src/features/student-tardiness/StudentTardyFormModal.tsx');
const modalPath=path.join(base,'src/components/common/Modal.tsx');
const cssPath=path.join(base,'src/features/student-tardiness/StudentTardyMobileR63.css');
let pass=0;
function check(name,callback){try{callback();pass++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
const form = fs.readFileSync(formPath,'utf8');
const modal = fs.readFileSync(modalPath,'utf8');
const css = fs.readFileSync(cssPath,'utf8');
check('Penanda R63 pada form aktif',()=>assert.match(form,/R63 FULLWIDTH TARDY/));
check('Modal menggunakan styling hanya untuk formulir terlambat',()=>assert.match(form,/className="r63-tardy-dialog"/));
check('CSS R62 dan R63 sama-sama diimpor',()=>{assert.match(form,/StudentTardyMobileR62.css/);assert.match(form,/StudentTardyMobileR63.css/)});
check('Penanda versi R63 tampil untuk pengecekan cache PWA',()=>assert.match(form,/aria-label="Tampilan buku siswa terlambat R63"/));
check('Nested scroll daftar siswa dieliminasi',()=>{assert.match(form,/r63-tardy-selected-list/);assert.ok(!/r63-tardy-selected-list[^\"]*overflow-y-auto/.test(form));});
check('Modal mendukung className tanpa memaksa modal lain',()=>{assert.match(modal,/className\?: string/);assert.match(modal,/\$\{className\}/)});
check('Guard event scroll horizontal mempertahankan scroll vertikal',()=>{assert.match(form,/onScrollCapture/);assert.match(form,/target.scrollLeft = 0/);assert.doesNotMatch(form,/target.scrollTop = 0/)});
check('Tiga aksi siswa tetap tersedia',()=>{assert.match(form,/setTargetStudentIdForPhoto\(entry.student.id\)/);assert.match(form,/handleRemoveStudent\(entry.student.id\)/);assert.match(form,/setExpandedStudentId\(isExpanded \? null : entry.student.id\)/)});
check('Perhitungan dan simpan data tetap tersedia',()=>{assert.match(form,/calculateStudentTardiness/);assert.match(form,/executeBatchSave/)});
check('Batas mobile full viewport',()=>{assert.match(css,/height: 100dvh !important/);assert.match(css,/max-width: 100% !important/)});
check('Satu vertical scrollbar, tidak nested',()=>{assert.match(css,/r62-tardy-selected-list/);assert.match(css,/overflow: visible !important/)});
check('Tombol aksi 44 piksel',()=>assert.match(css,/min-height: 44px/));
check('Styling terisolasi khusus R63',()=>{assert.match(css,/\.r63-tardy-dialog/);assert.doesNotMatch(css,/^\.app-dialog\s*\{/m)});
check('Patcher menolak pemasangan ganda',()=>assert.throws(()=>transformForm(form),/sudah diterapkan/));
check('Source modal yang mendukung className dianggap sudah kompatibel',()=>assert.equal(transformModal(modal),modal));
// Optional deeper syntax validation using local project TypeScript dependency.
try {
  const ts=require('typescript');
  for(const filename of [formPath,modalPath]){
    check('TSX syntax '+path.basename(filename),()=>{
      const parsed=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(e=>e.messageText).join('\n'));
    });
  }
} catch(e) {
  if(e?.code==='MODULE_NOT_FOUND') console.log('SKIP TSX parser — instal dependencies dulu dengan npm ci');
  else throw e;
}
console.log(`R63 verification: ${pass} checks passed${process.exitCode?' (some FAIL)':''}`);
