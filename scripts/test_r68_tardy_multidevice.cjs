'use strict';
/** Runs on synthetic records only. Never contacts Firebase, Vercel or Drive. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); }
catch { console.error('Install dependencies using npm ci before running this test.'); process.exit(2); }

const code = fs.readFileSync('src/services/firebase/studentTardyService.ts', 'utf8');
const parser = ts.createSourceFile('studentTardyService.ts',code,ts.ScriptTarget.Latest,true);
assert.equal(parser.parseDiagnostics.length,0,'Service TypeScript source must parse');
const js = ts.transpileModule(code,{fileName:'studentTardyService.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const records = new Map();
let writes = 0;
let photoUploads = 0;
const copy = x => x == null ? x : JSON.parse(JSON.stringify(x));
const firestore = {
  async getForDates(_,dates) { return [...records.values()].filter(r=>dates.includes(r.tanggal)).map(copy); },
  async getByIdStrict(_,id) { return copy(records.get(id)||null); },
  nextUpdatedAt(old) { return new Date(Math.max(Date.now(), Date.parse(old?.updatedAt)||0)+1).toISOString(); },
  sanitizeFirestorePayload(x) { return copy(x); },
  async setDocument(collection,id,record,{expectedState}={}) {
    assert.equal(collection,'studentTardiness');
    assert.notEqual(expectedState,undefined,'Must use optimistic Firestore transaction');
    // Atomic compare-and-set simulates Firestore runTransaction semantics.
    const current=records.get(id) || null;
    if ((current?.updatedAt||null) !== (expectedState?.updatedAt||null)) throw Error('Konflik pembaruan: Data telah berubah dari perangkat atau sesi lain');
    records.set(id,copy(record)); writes++;
  },
  async logAudit() {},
};
const requireStub=(specifier) => {
  if(specifier.endsWith('/firestoreService'))return {FirestoreService:firestore};
  if(specifier==='./sessionGuard')return {createAuthenticatedSession:()=>({assertActive(){},close(){}})};
  if(specifier.endsWith('/recordOwnership'))return {assertRecordOwner:(user,record)=>{if(record.petugasPiketId!==user.id)throw Error('Pemilik berbeda');}};
  if(specifier.endsWith('/photoUploadHelper'))return {processPhotoForStorage:async()=>{photoUploads++;throw Error('Test should not upload');}};
  if(specifier==='firebase/firestore')return {where:(...args)=>args};
  if(specifier.endsWith('/dateUtils'))return {getTodayISODate:()=> '2026-10-24'};
  throw Error('Unexpected dependency '+specifier);
};
const env={module:{exports:{}},exports:{},require:requireStub,crypto:require('node:crypto').webcrypto,console};
env.exports=env.module.exports;
vm.runInNewContext(js,env,{timeout:2000});
const service=env.module.exports.StudentTardyService;
const user={id:'teacher-1',fullName:'Teacher 1',role:'GURU'};
const another={id:'teacher-2',fullName:'Teacher 2',role:'GURU'};
const make=(id='std-01',date='2026-10-24')=>({studentId:id,namaSiswa:`Student ${id}`,kelas:'X IPA',tanggal:date,jamDatang:'07:15',menitTerlambat:15,poinPelanggaran:5});
let total=0;
async function check(name,fn){records.clear();writes=0;photoUploads=0;await fn();total++;console.log('PASS',name);}
(async()=>{
await check('canonical ID does not depend on batch ID',()=>{
  assert.equal(service.getBatchRecordId('2026-10-24','s1','batch-a'),service.getBatchRecordId('2026-10-24','s1','batch-b'));
});
await check('different students and days have different IDs',()=>{
  assert.notEqual(service.getBatchRecordId('2026-10-24','s1','b'),service.getBatchRecordId('2026-10-25','s1','b'));
  assert.notEqual(service.getBatchRecordId('2026-10-24','s1','b'),service.getBatchRecordId('2026-10-24','s2','b'));
});
await check('single batch creates one canonical record',async()=>{
  const result=await service.saveBatchTardyStudents([make()],user,'batch-a');
  assert.equal(result.allSuccessful,true);assert.equal(records.size,1);assert.equal(writes,1);
  assert.equal(result.results[0].record.id,service.getBatchRecordId('2026-10-24','std-01','batch-a'));
});
await check('retry of same batch returns existing without second write',async()=>{
  await service.saveBatchTardyStudents([make()],user,'batch-a');
  const result=await service.saveBatchTardyStudents([make()],user,'batch-a');
  assert.equal(result.allSuccessful,true);assert.equal(records.size,1);assert.equal(writes,1);
});
await check('different batch for same date/student rejected',async()=>{
  await service.saveBatchTardyStudents([make()],user,'batch-a');
  const result=await service.saveBatchTardyStudents([make()],user,'batch-b');
  assert.equal(result.allSuccessful,false);assert.match(result.results[0].error,/sudah memiliki catatan/);
  assert.equal(writes,1);assert.equal(records.size,1);
});
await check('two users racing different batches cannot create two records',async()=>{
  // Force both calls to finish their initial date query while neither record exists.
  let queries=0,release;
  let runBarrier = new Promise(resolve=>release=resolve);
  const original=firestore.getForDates;
  firestore.getForDates=async function(_,dates){const snapshot=[...records.values()].filter(r=>dates.includes(r.tanggal)).map(copy);queries++;if(queries===2)release();await runBarrier;return snapshot;};
  try {
    const [a,b]=await Promise.all([service.saveBatchTardyStudents([make()],user,'device-a'),service.saveBatchTardyStudents([make()],another,'device-b')]);
    assert.equal(records.size,1);assert.equal(writes,1);
    assert.equal(Number(a.allSuccessful)+Number(b.allSuccessful),1);
  }finally{firestore.getForDates=original;}
});
await check('two students can be submitted together',async()=>{
  const result=await service.saveBatchTardyStudents([make('s1'),make('s2')],user,'batch-a');
  assert.equal(result.allSuccessful,true);assert.equal(records.size,2);assert.equal(writes,2);
});
await check('duplicate student twice in one batch is idempotent',async()=>{
  const result=await service.saveBatchTardyStudents([make(),make()],user,'batch-a');
  assert.equal(result.allSuccessful,true);assert.equal(records.size,1);assert.equal(writes,1);
});
await check('legacy existing record blocks new batches',async()=>{
  const older={...make(),id:'trd-2026-10-24-std-01-batch-old',batchRequestId:'batch-old',petugasPiketId:user.id,updatedAt:'2026-10-23T12:00:00Z'};
  records.set(older.id,older);
  const result=await service.saveBatchTardyStudents([make()],user,'batch-new');
  assert.equal(result.allSuccessful,false);assert.equal(records.size,1);assert.equal(writes,0);
});
await check('old queued submission resolves to canonical document',async()=>{
  const payload={...make(),id:'trd-2026-10-24-std-01-old-request',batchRequestId:'old-request'};
  const rec=await service.saveTardyStudent(payload,user);
  assert.equal(rec.id,service.getBatchRecordId(payload.tanggal,payload.studentId,payload.batchRequestId));
  assert.equal(records.size,1);
});
await check('old queued retry discovers same legacy submission',async()=>{
  const payload={...make(),id:'trd-2026-10-24-std-01-old-request',batchRequestId:'old-request'};
  records.set(payload.id,{...payload,petugasPiketId:user.id,updatedAt:'2026-10-23T12:00:00Z'});
  const rec=await service.saveTardyStudent(payload,user);
  assert.equal(rec.id,payload.id);assert.equal(records.size,1);assert.equal(writes,0);
});
await check('old queued submission cannot duplicate different legacy batch',async()=>{
  const payload={...make(),id:'trd-2026-10-24-std-01-request-new',batchRequestId:'request-new'};
  records.set('old',{...make(),id:'old',batchRequestId:'request-other',petugasPiketId:user.id,updatedAt:'2026-10-23T12:00:00Z'});
  await assert.rejects(service.saveTardyStudent(payload,user),/sudah memiliki catatan/);
  assert.equal(records.size,1);assert.equal(writes,0);
});
await check('non-batch edit keeps its original document ID',async()=>{
  const orig=await service.saveTardyStudent({...make(),id:'manual-id'},user);
  const updated=await service.saveTardyStudent({...orig,catatanPetugas:'Edited'},user,true);
  assert.equal(updated.id,'manual-id');assert.equal(writes,2);
});
console.log(`R68: ${total}/${total} isolated multidevice checks passed; no network calls.`);
})().catch(err=>{console.error('FAIL:',err.stack||err);process.exitCode=1});
