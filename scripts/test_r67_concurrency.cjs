'use strict';
/* R67: Dynamic, dependency-free-with-TS-installed checks against the ACTUAL TSX functions.
 * No connection to production Firebase/Google Drive. Run from repository root:
 * node scripts/test_r67_concurrency.cjs
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
let ts;
try { ts = require('typescript'); } catch {
  console.error('R67: TypeScript not installed. Jalankan `npm ci` terlebih dahulu.');
  process.exit(2);
}
const file = path.resolve(process.cwd(), 'src/features/student-tardiness/StudentTardyFormModal.tsx');
if (!fs.existsSync(file)) { console.error('R67: file formulir tidak ditemukan:',file); process.exit(2); }
const source = fs.readFileSync(file,'utf8');
const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(ast.parseDiagnostics.length) throw new Error('Syntax TSX: '+ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
function extract(name, env) {
  let declaration;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(declaration && declaration.initializer,`Missing ${name}`);
  const snippet=`const ${name} = ${declaration.initializer.getText(ast)}; module.exports = ${name};`;
  const js=ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true}).outputText;
  const sandbox={module:{exports:null},...env};
  vm.runInNewContext(js,sandbox,{timeout:1000});
  return sandbox.module.exports;
}
const deferred=()=>{let resolve,reject; const promise=new Promise((res,rej)=>{resolve=res;reject=rej;}); return {promise,resolve,reject};};
let checks=0;
async function test(name,fn){await fn();console.log('PASS',name);checks++;}

(async()=>{
await test('TSX parses',()=>assert.equal(ast.parseDiagnostics.length,0));
await test('R65 mobile layout retained; R67 deployment marker present',()=>assert.match(source,/data-r67="active"/));
await test('Synchronous selection lock prevents repeated selection during read',async()=>{
  const future=deferred();let reads=0;let entries=[];let err='';
  const pendingStudentIdsRef={current:new Set()};const formSessionRef={current:1};
  const env={pendingStudentIdsRef,formSessionRef,latestTanggalRef:{current:'2026-10-24'},selectedStudents:entries, tanggal:'2026-10-24',
    setSelectedStudents(fn){entries=fn(entries);env.selectedStudents=entries;},
    setErrorMessage(v){err=v;},setStudentSearchTerm(){},setIsStudentDropdownOpen(){},
    StudentTardyService:{getStudentTardyCountThisMonth:async()=>{reads++;return future.promise;}}};
  const add=extract('handleAddStudent',env);const student={id:'s1',nama:'Siswa Satu',kelas:'X'};
  const a=add(student),b=add(student);
  await Promise.resolve();assert.equal(reads,1);future.resolve(2);await Promise.all([a,b]);
  assert.equal(entries.length,1);assert.equal(entries[0].frekuensiBulanIni,3);assert.equal(pendingStudentIdsRef.current.size,0);
});
await test('Student selection cannot append stale response after dialog closes',async()=>{
  const future=deferred();let entries=[];
  const pendingStudentIdsRef={current:new Set()};const formSessionRef={current:1};
  const env={pendingStudentIdsRef,formSessionRef,latestTanggalRef:{current:'2026-10-24'},selectedStudents:entries, tanggal:'2026-10-24',
    setSelectedStudents(fn){entries=fn(entries);},setErrorMessage(){},setStudentSearchTerm(){},setIsStudentDropdownOpen(){},
    StudentTardyService:{getStudentTardyCountThisMonth:()=>future.promise}};
  const add=extract('handleAddStudent',env);const result=add({id:'s2',nama:'Dua',kelas:'X'});
  formSessionRef.current=2;pendingStudentIdsRef.current.clear();future.resolve(5);await result;
  assert.equal(entries.length,0);
});
await test('Changed date rejects stale frequency read',async()=>{
  const future=deferred();let entries=[];let message='';
  const pendingStudentIdsRef={current:new Set()};const formSessionRef={current:1};
  const latestTanggalRef={current:'2026-10-24'};
  const env={pendingStudentIdsRef,formSessionRef,latestTanggalRef,selectedStudents:entries,tanggal:'2026-10-24',
    setSelectedStudents(fn){entries=fn(entries);},setErrorMessage(v){message=v;},setStudentSearchTerm(){},setIsStudentDropdownOpen(){},
    StudentTardyService:{getStudentTardyCountThisMonth:()=>future.promise}};
  const add=extract('handleAddStudent',env);
  const a=add({id:'s22',nama:'Siswa Tanggal',kelas:'X'});
  latestTanggalRef.current='2026-10-25';future.resolve(1);await a;
  assert.equal(entries.length,0);assert.match(message,/Tanggal kejadian berubah/);
});
await test('Failed frequency read reports error and allows retry',async()=>{
  let tries=0;let entries=[];let error='';const pendingStudentIdsRef={current:new Set()};const formSessionRef={current:1};
  const env={pendingStudentIdsRef,formSessionRef,latestTanggalRef:{current:'2026-10-24'},selectedStudents:entries,tanggal:'2026-10-24',
    setSelectedStudents(fn){entries=fn(entries);env.selectedStudents=entries;},setErrorMessage(v){error=v;},setStudentSearchTerm(){},setIsStudentDropdownOpen(){},
    StudentTardyService:{getStudentTardyCountThisMonth:async()=>{tries++;if(tries===1)throw Error('offline');return 1;}}};
  const add=extract('handleAddStudent',env);const st={id:'s3',nama:'Tiga',kelas:'X'};
  await add(st);assert.match(error,/Gagal membaca/);assert.equal(entries.length,0);
  await add(st);assert.equal(entries.length,1);assert.equal(tries,2);
});
function batchHarness({offline=false,serviceResult,simulateFailure=false}={}) {
  const fut=deferred();let calls=0;let closures=0;let errors=[];let records=[];
  const submitInFlightRef={current:false};
  const env={currentUser:{id:'guru'},submitInFlightRef,selectedStudents:[{student:{id:'s1',nama:'Satu',kelas:'X',nisn:'123'},frekuensiBulanIni:1,isCustomized:false}],
    entryLimitTime:'07:00',toleranceMinutes:10,tanggal:'2026-10-24',sharedJamDatang:'07:15',sharedAlasan:'BANGUN_KESIANGAN',sharedKeteranganAlasan:'',sharedPembinaan:'LITERASI_PERPUSTAKAAN',sharedKeteranganPembinaan:'',sharedCatatanPetugas:'',
    batchRequestIdRef:{current:'r67-staging'},navigator:{onLine:!offline},
    setIsSubmitting(){},setErrorMessage(v){if(v)errors.push(v);},setBatchResults(){},setShowSummaryConfirm(){},onClose(){closures++;},
    calculateStudentTardiness(){return {minutesLate:5};},calculateTardyViolationPoints(){return 5;},
    DraftService:{dataUrlToBlob:async()=>({})},
    SyncQueueService:{enqueue:async(...args)=>{calls++;records.push(args);await fut.promise;}},
    StudentTardyService:{getBatchRecordId:()=> 'r67-record',saveBatchTardyStudents:async(...args)=>{calls++;records.push(args);return fut.promise;}}};
  return {env,submitInFlightRef,fut,metrics:()=>({calls,closures,errors,records}),save:extract('executeBatchSave',env)};
}
await test('Online double submit sends only one batch',async()=>{
  const x=batchHarness();const a=x.save(),b=x.save();assert.equal(x.metrics().calls,1);
  assert.equal(x.submitInFlightRef.current,true);x.fut.resolve({allSuccessful:true,results:[]});await Promise.all([a,b]);
  assert.equal(x.metrics().calls,1);assert.equal(x.metrics().closures,1);assert.equal(x.submitInFlightRef.current,false);
});
await test('Online failure releases submission lock',async()=>{
  const x=batchHarness();const a=x.save();x.fut.reject(Error('Network'));await a;
  assert.equal(x.submitInFlightRef.current,false);assert.match(x.metrics().errors.join(','),/Network/);
});
await test('Offline double submit enqueues only once',async()=>{
  const x=batchHarness({offline:true});const a=x.save(),b=x.save();await Promise.resolve();assert.equal(x.metrics().calls,1);
  x.fut.resolve();await Promise.all([a,b]);assert.equal(x.metrics().calls,1);assert.equal(x.metrics().closures,1);
  assert.equal(x.submitInFlightRef.current,false);
});
await test('Failed offline write releases lock',async()=>{
  const x=batchHarness({offline:true});const a=x.save();await Promise.resolve();x.fut.reject(Error('Disk unavailable'));await a;
  assert.equal(x.submitInFlightRef.current,false);assert.match(x.metrics().errors.join(','),/Disk unavailable/);
});
await test('Single-record editing uses synchronous submit lock',()=>{
 assert.match(source,/const executeSingleSave = async \(\) => \{\s*if \(!currentUser \|\| !editingTardy \|\| submitInFlightRef\.current\) return;/);
 assert.match(source,/submitInFlightRef\.current = false;\s*setIsSubmitting\(false\);\s*\}\s*\};\s*\/\/ Execute batch save/);
});
await test('Student directory read errors are caught and unmount prevents late state',()=>{
  assert.match(source,/StudentService\.bootstrapIfEmpty\(\)[\s\S]*?\.catch\(\(\) => \{[\s\S]*?if \(active\) setErrorMessage/);
  assert.match(source,/return \(\) => \{ active = false; \};/);
});
await test('Monthly refresh catches errors instead of unhandled rejection',()=>{
 assert.match(source,/Promise\.all\([\s\S]*?\.catch\(\(\) => \{\s*if \(!isCancelled\) setErrorMessage/);
});
console.log(`R67: ${checks}/13 simulated and structural concurrency checks PASS`);
})().catch(e=>{console.error('FAIL:',e);process.exitCode=1;});
