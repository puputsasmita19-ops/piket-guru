/* Targeted R35 test: report archive action + admin-only legacy visitor photo migration.
 * This test does not connect to a production Firebase or Google Drive account.
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); }
catch { throw new Error('Paket TypeScript belum terpasang. Jalankan npm ci sebelum pengujian.'); }

const source = fs.readFileSync('src/services/firebase/visitorService.ts', 'utf8');
const report = fs.readFileSync('src/features/reports/ReportsPreview.tsx', 'utf8');
const transpile = (text, jsx = false, module = ts.ModuleKind.CommonJS) => ts.transpileModule(text, {
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module, jsx: ts.JsxEmit.ReactJSX },
});
for (const [name, code, jsx] of [['visitorService.ts',source,false],['ReportsPreview.tsx',report,true]]) {
  const result = transpile(code, jsx);
  assert.deepEqual((result.diagnostics || []).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')), [], `${name}: parse failed`);
}

assert(report.includes('sourceModule === \'VISITOR\'') && report.includes('visitorPhotoInFirestore'), 'Only visitor image may show the legacy migration action');
assert(report.includes("currentUser?.role === 'ADMIN' && visitorPhotoInFirestore"), 'Admin + Base64 required for the archive button');
assert(report.includes('Kirim Foto Lama ke Google Drive'), 'Archive modal must visibly offer migration');
assert(report.includes('VisitorService.migrateLegacyPhotoToDrive(visitorId, currentUser)'), 'Archive modal must call the actual migration service');
assert(report.includes('visitorPhotoMoveBusy'), 'Action must have a busy guard');
assert(report.includes('Lokasi foto:'), 'Archive modal must explain current storage');

let tests=6;
async function runScenario({role='ADMIN', photo='data:image/jpeg;base64,AAA', alias='', enabled=true, uploadOk=true, conflict=false, auditFails=false}) {
  const original = {id:'visitor-1', namaTamu:'Uji R35', fotoUrl:photo, updatedAt:'2026-10-23T01:00:00.000Z'};
  if(alias) original.photoUrl=alias;
  const writes=[]; const audits=[]; let uploads=0;
  const mockFirestore = {
    getByIdStrict: async () => structuredClone(original),
    setDocument: async (...args) => {
      if(conflict) throw new Error('Konflik pembaruan');
      writes.push(args);
    },
    nextUpdatedAt: () => '2026-10-23T01:00:01.000Z',
    logAudit: async (...args) => { audits.push(args); if(auditFails)throw Error('Audit failed'); },
  };
  const mocks={
    './sessionGuard': {createAuthenticatedSession:()=>({assertActive(){},close(){}})},
    './firestoreService': {FirestoreService:mockFirestore},
    '../../utils/recordOwnership': {assertRecordOwner(){}},
    '../../utils/dateUtils': {formatTime(){}},
    '../drive/photoUploadHelper': {
      isDriveStorageActive: async () => enabled,
      processPhotoForStorage: async (data,module) => {
        assert.equal(module,'visitors');
        assert(data.startsWith('data:image/'));
        uploads++;
        if (!uploadOk) throw Error('Unggah gagal');
        return {provider:'google_drive', photoUrl:'/api/drive/photo/xyz'};
      },
    },
    './firebase': {auth:{}},
  };
  const context={exports:{},module:{exports:{}},require:(name)=>{if(name in mocks)return mocks[name];throw Error(`Unexpected import ${name}`)},console:{warn(){}}};
  vm.runInNewContext(transpile(source).outputText,context,{filename:'visitorService.js'});
  const Service=context.exports.VisitorService || context.module.exports.VisitorService;
  const promise=Service.migrateLegacyPhotoToDrive('visitor-1',{id:'uid-1',role,fullName:'Admin'});
  return {promise,writes,audits,getUploads:()=>uploads, original};
}

(async()=>{
  let s=await runScenario({role:'GURU'});
  await assert.rejects(s.promise, /Administrator/);assert.equal(s.writes.length,0);tests++;
  s=await runScenario({photo:'/api/drive/photo/existing'});
  await assert.rejects(s.promise,/sudah berada di Google Drive/);assert.equal(s.getUploads(),0);tests++;
  s=await runScenario({enabled:false});
  await assert.rejects(s.promise,/Aktifkan penyimpanan Google Drive/);assert.equal(s.writes.length,0);tests++;
  s=await runScenario({uploadOk:false});
  await assert.rejects(s.promise,/Unggah gagal/);assert.equal(s.writes.length,0);tests++;
  s=await runScenario({conflict:true});
  await assert.rejects(s.promise,/Konflik pembaruan/);assert.equal(s.writes.length,0);tests++;
  s=await runScenario({photo:'',alias:'data:image/jpeg;base64,AAA'});
  let result=await s.promise;
  assert.equal(result.fotoUrl, '/api/drive/photo/xyz');
  assert.equal('photoUrl' in result,false);
  assert.equal(s.writes.length,1);
  assert.equal(s.writes[0][3].controlledReplace,true);
  assert(s.writes[0][3].expectedState);
  assert.equal(s.audits.length,1);tests++;
  s=await runScenario({auditFails:true});
  result=await s.promise;assert.equal(result.fotoStorageProvider,'google_drive');tests++;
  console.log(`OK: ${tests} targeted visitor photo migration and archive checks passed.`);
})().catch(error => { console.error(error); process.exitCode=1; });
