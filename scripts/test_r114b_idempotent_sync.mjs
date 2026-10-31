/** R114-B: isolated behavioral tests for offline claim, ack, stale retry, and server receipts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function ok(condition, name) { assert.ok(condition, name); console.log(`PASS ${name}`); passed++; }
function moduleFrom(relative, overrides = {}) {
  const source = readFileSync(path.join(root, relative), 'utf8');
  const transpiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, reportDiagnostics: true });
  assert.equal(transpiled.diagnostics?.length, 0, `Transpile ${relative}`);
  const module = { exports: {} };
  const ctx = { module, exports: module.exports, TextEncoder, Uint8Array,
    crypto: globalThis.crypto, Blob, Date, Map, Set, Promise,
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: { onLine: false }, localStorage: { getItem: () => null },
    console: { log(){}, warn(){}, error(){} },
    require(id) {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      for (const [key, value] of Object.entries(overrides)) if (id.endsWith(key)) return value;
      throw Error(`Unexpected import in ${relative}: ${id}`);
    },
  };
  vm.runInNewContext(transpiled.outputText, ctx, { filename: relative });
  return module.exports;
}
const config = { projectId: 'school-test-project' };
const { OfflineStorage } = moduleFrom('src/services/offline/offlineStorage.ts', {
  'firebase-applet-config.json': config,
});
const item = (id, hash='sha1', updatedAt = new Date().toISOString()) => ({
  operationId:id, userId:'guru-a', projectId:config.projectId, userName:'Guru A',
  operationType:'INCIDENT_REPORT', collectionName:'incidents', recordId:id,
  payload:{ id }, createdAt:'2026-10-31T00:00:00.000Z', updatedAt,
  retryCount:0, status:'PENDING_NETWORK', schemaVersion:2,
  submissionFingerprint:hash,
});
const a = item('op:guru-a:incidents:1');
await OfflineStorage.enqueueSyncItem(a, { createOnly: true });
await OfflineStorage.enqueueSyncItem({...a}, { createOnly: true });
ok((await OfflineStorage.getSyncItemsByUser('guru-a', {strict:true})).length===1,'Enqueue repeated exact payload keeps one immutable submission');
let conflicting=false;
try { await OfflineStorage.enqueueSyncItem(item(a.operationId,'sha2'), {createOnly:true}); } catch { conflicting=true; }
ok(conflicting, 'Different payload with same operation ID cannot silently replace pending submission');
const attemptA = await OfflineStorage.claimSyncItem(a);
a.deliveryAttemptId = attemptA;
ok(typeof attemptA === 'string', 'First sender atomically claims PENDING_NETWORK');
ok(!await OfflineStorage.claimSyncItem(a), 'Second sender cannot claim already SENDING');
ok(await OfflineStorage.updateClaimedSyncItem({...a,status:'SENDING',retryCount:1}), 'Claim owner can persist attachment progress');
ok(!await OfflineStorage.acknowledgeSyncItem({...a, submissionFingerprint:'wrong'}),'Wrong fingerprint cannot acknowledge a different operation');
ok(await OfflineStorage.acknowledgeSyncItem(a),'Matching sender can acknowledge committed write');
ok((await OfflineStorage.getSyncItemsByUser('guru-a',{strict:true})).length===0,'Acknowledged submission removed exactly once');
ok(!await OfflineStorage.acknowledgeSyncItem(a),'A second acknowledgement cannot succeed');
const fresh = item('op:guru-a:incidents:fresh');
await OfflineStorage.enqueueSyncItem(fresh, {createOnly:true});
fresh.deliveryAttemptId = await OfflineStorage.claimSyncItem(fresh);
ok(!await OfflineStorage.recoverStaleSyncItem(fresh),'Live SENDING must not be reset or replayed');
const stale = item('op:guru-a:incidents:stale', 'sha-stale', '2026-10-30T00:00:00.000Z');
await OfflineStorage.enqueueSyncItem(stale, {createOnly:true});
stale.deliveryAttemptId = await OfflineStorage.claimSyncItem(stale);
await OfflineStorage.updateClaimedSyncItem({...stale, status:'SENDING', updatedAt:'2026-10-30T00:00:00.000Z'});
ok(await OfflineStorage.recoverStaleSyncItem(stale),'Interrupted send older than 120 seconds is recoverable');
ok(!await OfflineStorage.recoverStaleSyncItem(stale),'Recovered item cannot recover twice');
const originalAttempt = stale.deliveryAttemptId;
const replayAttempt = await OfflineStorage.claimSyncItem(stale);
ok(!!replayAttempt && replayAttempt !== originalAttempt,'Recovered item gets a NEW delivery attempt token');
ok(!await OfflineStorage.acknowledgeSyncItem(stale),'Old sender cannot acknowledge a recovered operation');
ok(!await OfflineStorage.updateClaimedSyncItem({...stale,status:'NEEDS_ACTION'}),'Old sender cannot overwrite a later sender');
stale.deliveryAttemptId = replayAttempt;
ok(!await OfflineStorage.acknowledgeSyncItem({...stale, userId:'guru-b'}),'Acknowledgement cannot cross user UID');
ok(await OfflineStorage.acknowledgeSyncItem(stale),'Owner can acknowledge replayed operation');

const committed=new Map(); let writes=0, auditWrites=0;
const firestore={
  getByIdStrict:async (_col,id)=>committed.get(id)||null,
  nextUpdatedAt:()=>new Date().toISOString(),
  sanitizeFirestorePayload:(a)=>a,
  setDocumentWithAudit:async(_col,id,data)=>{writes++;auditWrites++;committed.set(id,data);},
};
const permission={ PERMISSIONS:{ DUTYBOOK_CREATE:'dutyBook.create', DUTYBOOK_UPDATE:'dutyBook.update' }, checkUserPermission:()=>true };
const {DutyBookService}=moduleFrom('src/services/firebase/dutyBookService.ts',{
  'sessionGuard':{ createAuthenticatedSession:()=>({assertActive(){},close(){}}) },
  'firestoreService':{ FirestoreService:firestore },
  'recordOwnership':{ assertRecordOwner:(user,record,key)=> { assert.equal(record[key],user.id); } },
  'permissions':permission,
});
const user={ id:'guru-a', role:'ADMIN', fullName:'Guru A', isActive:true };
const draft={ id:'book-2026-10-31-guru-a',petugasId:'guru-a',tanggal:'2026-10-31',
  petugasName:'Guru A',ruangName:'Ruang',kondisiKeamanan:'Aman',kondisiKebersihan:'Bersih',
  kondisiKelas:'Baik',kondisiFasilitas:'Baik',kondisiSiswa:'Baik',catatanPiket:'Selesai',
  status:'DRAFT',createdAt:'2026-10-31T00:00:00.000Z',updatedAt:'2026-10-31T00:00:00.000Z' };
const r1=await DutyBookService.saveDraft(draft,user,undefined,'op:book:hash-1');
ok(r1.offlineSubmissionKey==='op:book:hash-1'&&writes===1,'Draft commit persists exact offline receipt marker');
const r2=await DutyBookService.saveDraft(draft,user,undefined,'op:book:hash-1');
ok(writes===1&&auditWrites===1&&r2===r1,'Lost acknowledgement draft retry does not repeat write or audit');
let staleConflict=false;
try { await DutyBookService.saveDraft({...draft,catatanPiket:'Berubah'},user,undefined,'op:book:hash-2'); }
catch(error) { staleConflict=/Konflik revisi/.test(error.message); }
ok(staleConflict&&writes===1,'Old queued draft cannot overwrite newer server revision');
const r3=await DutyBookService.saveDraft({...draft,updatedAt:r1.updatedAt,catatanPiket:'Berubah'},user,undefined,'op:book:hash-2');
ok(writes===2&&r3.offlineSubmissionKey==='op:book:hash-2','Current revision with changed payload is not misidentified as old submission');
const r4=await DutyBookService.saveDraft({...r3,catatanPiket:'Final'},user,undefined);
ok(r4.offlineSubmissionKey===null&&writes===3,'Normal online edit clears prior offline receipt marker');
let superseded=false;
try { await DutyBookService.saveDraft(draft,user,undefined,'op:book:hash-1'); }
catch(error) { superseded=/Konflik revisi/.test(error.message); }
ok(superseded&&writes===3,'Retry of superseded submission never overwrites newer online edit');
const journal={...draft,id:'book-2026-10-30-guru-a',tanggal:'2026-10-30',status:'DIAJUKAN'};
const j1=await DutyBookService.submitJournal(journal,user,undefined,'op:journal:hash1');
ok(j1.status==='DIAJUKAN'&&writes===4,'Journal is committed once with its receipt');
const j2=await DutyBookService.submitJournal(journal,user,undefined,'op:journal:hash1');
ok(writes===4&&auditWrites===4&&j2===j1,'Lost acknowledgement journal retry does not resubmit journal or audit');

const queue=readFileSync(path.join(root,'src/services/offline/syncQueueService.ts'),'utf8');
const source=readFileSync(path.join(root,'src/services/offline/offlineStorage.ts'),'utf8');
ok(queue.includes('await OfflineStorage.claimSyncItem(item)')&&queue.includes('await OfflineStorage.acknowledgeSyncItem(item)'), 'Queue uses atomic claim and guarded acknowledgement');
ok(queue.includes('await OfflineStorage.recoverStaleSyncItem(item, currentTime)'), 'Stale recovery is conditional on current stored state');
ok(source.includes("db.transaction('syncQueue', 'readwrite')"),'IndexedDB queue operations use read-write transactions');
for (const filename of ['incidentService.ts','studentTardyService.ts','studentPermitService.ts','visitorService.ts','substitutionService.ts']) {
  const text=readFileSync(path.join(root,'src/services/firebase',filename),'utf8');
  ok(text.includes('existing.offlineSubmissionKey === offlineSubmissionKey')||text.includes('existingDoc.offlineSubmissionKey === offlineSubmissionKey'),`${filename}: committed offline receipt is checked`);
}
console.log(`${passed}/${passed} R114-B idempotent sync checks PASS`);
