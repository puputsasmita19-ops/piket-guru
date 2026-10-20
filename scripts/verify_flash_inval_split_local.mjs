/**
 * Offline smoke / regression checks for the 2026-10-20 Flash Info Inval update.
 * Uses TypeScript's global or project installation: no Firestore credentials,
 * network access or browser emulator required.
 * The browser-only scenarios remain in verify_substitution_flash_ui.mjs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=(name)=>{try{return require(name)}catch{return require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),name))}};
const ts=load('typescript');
const postcss=load('postcss');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
const check=(msg,test)=>{assert.ok(test,msg); console.log(`PASS ${++passed}. ${msg}`)};
const transpile=(p)=>{
 const result=ts.transpileModule(read(p),{fileName:p,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];
 check(`${p} parses as TypeScript`,errors.length===0);
 return result.outputText;
};
const substitutionTypes=transpile('src/types/substitution.types.ts');
const summarySrc=transpile('src/features/dashboard/substitutionFlashSummary.ts');
transpile('src/features/dashboard/DashboardFlashInfo.tsx');
transpile('src/features/dashboard/DashboardView.tsx');
const compile=(js,req)=>{
 const module={exports:{}};
 const fn=vm.runInThisContext(`(function(exports, require, module) { ${js}\n})`);
 fn(module.exports,req,module);
 return module.exports;
};
const reasonTypes=compile(substitutionTypes,()=>{throw Error('Unexpected runtime import')});
const summary=compile(summarySrc,name=>{
 assert.equal(name,'../../types/substitution.types');
 return reasonTypes;
});
const baseline={id:'piket-1',tanggal:'2026-10-20',guruBerhalanganId:'a',guruBerhalanganName:'Guru A',
 mataPelajaran:'Matematika',kelas:'X-A',jamPelajaran:'JP 1–2',alasan:'SAKIT',keteranganAlasan:'Surat dokter',
 materiDanTugasSiswa:'Kerjakan halaman 12 secara berkelompok.',status:'MENUNGGU_GURU_INVAL',createdAt:'2026-10-20T07:30:00Z'};
const newer={...baseline,id:'piket-2',guruBerhalanganId:'b',guruBerhalanganName:'Guru B',status:'TERTUGASKAN',guruPenggantiId:'g',guruPenggantiName:'Guru C',materiDanTugasSiswa:'Diskusi topik baru',updatedAt:'2026-10-20T09:30:00Z'};
const records=[newer,{...baseline}, {...baseline,id:'old',tanggal:'2026-10-19'}];
const original=JSON.stringify(records);
const result=summary.buildSubstitutionFlashSummary(records,'2026-10-20');
check('today records only and awaiting substitute shown first',result.taskCount===2&&result.pendingCount===1&&result.items[0].id==='piket-1');
check('distinct absent teacher count preserved',result.teacherCount===2);
check('absence details are independent from replacement details',result.items[0].absentTeacher==='Guru A'&&result.items[0].subjectAndClass==='Matematika · X-A'&&result.items[0].lessonPeriod==='JP 1–2'&&result.items[0].reason==='Sakit (Surat dokter)');
check('replacement and classroom followup are independent fields',result.items[1].replacementTeacher==='Guru C'&&result.items[1].assignmentStatus==='Tertugaskan'&&result.items[1].task==='Diskusi topik baru');
check('missing replacement is clearly identified',result.items[0].replacementTeacher==='Sedang dikoordinasikan'&&result.items[0].assignmentStatus==='Menunggu pengganti');
check('summary does not mutate subscribed records',JSON.stringify(records)===original);
const changed=summary.buildSubstitutionFlashSummary([{...baseline, guruPenggantiName:'Guru D',status:'SEDANG_BERLANGSUNG',materiDanTugasSiswa:'Tugas baru dari guru mata pelajaran'}],'2026-10-20');
check('new subscribed content yields updated UI fields',changed.items[0].replacementTeacher==='Guru D'&&changed.items[0].task==='Tugas baru dari guru mata pelajaran'&&changed.items[0].assignmentStatus==='Sedang berlangsung');
const missing=summary.buildSubstitutionFlashSummary([{...baseline,alasan:'LAINNYA',keteranganAlasan:'',materiDanTugasSiswa:'',guruBerhalanganName:''}],'2026-10-20');
check('empty fields use legible fallback copy',missing.items[0].reason==='Lain-lain'&&missing.items[0].task.startsWith('Belum ada tindak lanjut')&&missing.items[0].absentTeacher==='Guru belum tercatat');
const flash=read('src/features/dashboard/DashboardFlashInfo.tsx');
check('explicit accessible absence and replacement groups',flash.includes('aria-label="Guru berhalangan"')&&flash.includes('aria-label="Guru pengganti / inval"'));
check('detail labels map to correct fields without truncation',/Keterangan berhalangan hadir<\/p>\s*<p[^>]*>\{row.reason\}/.test(flash)&&/Tindak lanjut \/ tugas kelas<\/p>\s*<p[^>]*>\{row.task\}/.test(flash));
check('substitution slide preserves its own carousel controls and navigation',flash.includes('onClick={slide.onAction}')&&flash.includes('onClick={() => change(-1)}')&&flash.includes('onClick={() => change(1)}'));
const css=read('src/index.css');const cssTree=postcss.parse(css,{from:'src/index.css'});
check('style sheet parses',!!cssTree.nodes.length);
check('wide layout uses two columns',css.includes('.flash-inval-panels {')&&css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
check('mobile layout collapses to a single column',/@media \(max-width: 639px\)\s*\{\s*\.flash-inval-panels\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(css));
check('full lengthy details can be scrolled without clipping',css.includes('overflow-y: auto')&&!flash.includes('announcementPreview(row.task')&&!flash.includes('announcementPreview(row.reason'));
const dashboard=read('src/features/dashboard/DashboardView.tsx');
check('existing permission gating and live Firestore listener preserved',dashboard.includes('canViewSubstitutions = hasPermission(PERMISSIONS.SUBSTITUTIONS_VIEW)')&&dashboard.includes('FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>')&&dashboard.includes('...(canViewSubstitutions ? [{'));
console.log(`\n${passed} local syntax/layout/data regression checks PASSED.`);
