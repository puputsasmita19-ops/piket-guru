/** R114-C1 — recovery fencing, permission transition, and invalid timestamp tests.
 * Uses isolated memory and a deterministic fake IndexedDB transaction engine.
 * No user database, real Firebase or network is accessed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'src/services/offline/offlineStorage.ts'), 'utf8');
const serviceSource = readFileSync(path.join(root, 'src/services/offline/syncQueueService.ts'), 'utf8');
let passed = 0;
const ok = (value, message) => { assert.ok(value, message); console.log('PASS', message); passed++; };
const projectId = 'c1-test-school';
function makeStorage(trusted = false) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const mod = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, crypto: globalThis.crypto, Blob, Date,
    Map, Set, Promise, console: { warn(){}, error(){}, log(){} },
    localStorage: { getItem: () => trusted ? 'true' : null },
    require(id) { if (id.endsWith('firebase-applet-config.json')) return { projectId }; throw Error(`Unexpected require: ${id}`); },
  }, { filename: 'offlineStorage.js' });
  return mod.exports.OfflineStorage;
}
const baseDate = '2026-10-31T00:00:00.000Z';
const item = (suffix, fingerprint = 'hash-a', time = baseDate) => ({
  operationId:`op:guru-a:incidents:${suffix}`, projectId, userId:'guru-a',
  userName:'Guru A', operationType:'INCIDENT_REPORT', collectionName:'incidents', recordId:suffix,
  payload: { id:suffix }, createdAt:baseDate, updatedAt:time, retryCount:0,
  schemaVersion:2, submissionFingerprint:fingerprint, status:'PENDING_NETWORK',
});
const oldTime = '2026-10-30T00:00:00.000Z';
const now = Date.parse(baseDate) + 10*60_000;
const store = makeStorage();
const a = item('attempt');
await store.enqueueSyncItem(a, {createOnly:true});
const tokenA = await store.claimSyncItem(a);
const snapshotA = { ...a, status:'SENDING', deliveryAttemptId:tokenA, updatedAt:oldTime };
await store.updateClaimedSyncItem(snapshotA);
ok(store.isStaleSendingItem(snapshotA, now), 'Stale delivery recognized from stored update timestamp');
ok(!store.isStaleSendingItem({ ...snapshotA, updatedAt:new Date(now-2000).toISOString() }, now), 'Fresh delivery is not stale');
ok(await store.recoverStaleSyncItem(snapshotA, now), 'Interrupted attempt recovered once');
const tokenB = await store.claimSyncItem(a);
ok(tokenB && tokenB !== tokenA, 'Recovered item acquired by a new sender');
// Pretend the second sender has stalled. An old snapshot MUST NOT reset it.
const snapshotB = { ...snapshotA, deliveryAttemptId:tokenB };
await store.updateClaimedSyncItem(snapshotB);
ok(!await store.recoverStaleSyncItem(snapshotA, now), 'Old sender cannot recover another sender with same fingerprint');
ok((await store.getSyncItemsByUser('guru-a'))[0].deliveryAttemptId === tokenB, 'New sender claim stays intact after old recovery');
ok(await store.recoverStaleSyncItem(snapshotB, now), 'Matching new sender may recover its own stale attempt');
ok(!await store.acknowledgeSyncItem(snapshotA), 'Old sender cannot acknowledge a newer recovery');

const p = item('permission');
await store.enqueueSyncItem(p, {createOnly:true});
ok(await store.markPendingSyncItemNeedsAction(p, 'Izin dicabut'), 'Pending permission denial atomically requests user action');
ok((await store.getSyncItemsByUser('guru-a')).find(i=>i.operationId===p.operationId)?.lastError === 'Izin dicabut', 'Reason remains visible in queue');
ok(!await store.markPendingSyncItemNeedsAction(p, 'Different reason'), 'NEEDS_ACTION cannot be overwritten by stale permission result');
const c = item('concurrent');
await store.enqueueSyncItem(c,{createOnly:true});
const claim = await store.claimSyncItem(c);
ok(!!claim && !await store.markPendingSyncItemNeedsAction(c,'Izin dicabut'), 'Permission result cannot overwrite SENDING claim');
ok((await store.getSyncItemsByUser('guru-a')).find(i=>i.operationId===c.operationId)?.status === 'SENDING', 'Claim stays SENDING during denied stale evaluation');
const d = item('mismatch');
await store.enqueueSyncItem(d,{createOnly:true});
ok(!await store.markPendingSyncItemNeedsAction({...d,submissionFingerprint:'changed'},'bad'),'Different fingerprint rejected');
ok(!await store.markPendingSyncItemNeedsAction({...d,userId:'guru-b'},'bad'),'Different user rejected');
ok(!await store.markPendingSyncItemNeedsAction({...d,projectId:'other-project'},'bad'),'Different project rejected');

const malformed = { ...snapshotB, updatedAt:'not-a-date', createdAt:oldTime, status:'SENDING' };
ok(!store.isStaleSendingItem(malformed,now),'Invalid updatedAt never trusts old creation time as last delivery');
ok(!store.isStaleSendingItem({...malformed,createdAt:'bad'},now),'Both invalid timestamps require manual recovery');
ok(!store.isStaleSendingItem({...malformed,status:'PENDING_NETWORK'},now),'Pending items never counted as stale sends');
const corruptItem = item('corrupt-timestamp');
await store.enqueueSyncItem(corruptItem,{createOnly:true});
const corruptAttempt = await store.claimSyncItem(corruptItem);
const corruptSending = { ...corruptItem, deliveryAttemptId:corruptAttempt,
  status:'SENDING', updatedAt:'invalid-date' };
await store.updateClaimedSyncItem(corruptSending);
ok(!await store.recoverStaleSyncItem(corruptSending,now),'Corrupt persisted SENDING timestamp is never automatically replayed');
ok((await store.getSyncItemsByUser('guru-a')).some(i=>i.operationId===corruptItem.operationId && i.status==='SENDING'),
  'Corrupt timestamp item is retained for manual investigation');

// Exercise the persisted, transactional branch with a serialized fake IDB.
class FakeDatabase {
  constructor(){ this.records = new Map(); this.tail=Promise.resolve(); }
  transaction(){
    let unlock; const previous=this.tail;
    this.tail = new Promise(resolve=>unlock=resolve);
    const db=this;
    const tx={ oncomplete:null,onabort:null,onerror:null,error:null, objectStore(){
      return {
        get(key){
          const request={result:undefined,error:null,onsuccess:null};
          previous.then(()=>{
            request.result = structuredClone(db.records.get(key));
            try { request.onsuccess?.(); queueMicrotask(()=>{tx.oncomplete?.();unlock();}); }
            catch (error) { tx.error=error;tx.onabort?.();unlock(); }
          });
          return request;
        },
        put(value){ db.records.set(value.operationId, structuredClone(value)); },
        delete(key){ db.records.delete(key); },
      };
    }};
    return tx;
  }
}
const persisted = makeStorage(true);
const db = new FakeDatabase();
persisted.isIndexedDBSupported = true;
persisted.dbPromise = Promise.resolve(db);
const existing = item('persisted');
db.records.set(existing.operationId, existing);
const tPersist = await persisted.claimSyncItem(existing);
ok(!!tPersist && db.records.get(existing.operationId).status === 'SENDING', 'IndexedDB transactional claim acquired');
ok(!await persisted.markPendingSyncItemNeedsAction(existing, 'Old result'), 'IndexedDB denied status cannot clobber SENDING');
const persistedSnapshot = { ...db.records.get(existing.operationId), updatedAt:oldTime };
db.records.set(existing.operationId, persistedSnapshot);
ok(!await persisted.recoverStaleSyncItem({...persistedSnapshot, deliveryAttemptId:'wrong-token'},now), 'IndexedDB recovery fences wrong attempt token');
ok(await persisted.recoverStaleSyncItem(persistedSnapshot, now), 'IndexedDB matching stale token recovers');
ok(db.records.get(existing.operationId).status==='PENDING_NETWORK', 'IndexedDB recovery commits updated status');
ok(await persisted.markPendingSyncItemNeedsAction(existing,'Perlu admin'), 'IndexedDB pending permission transition commits');
ok(db.records.get(existing.operationId).status==='NEEDS_ACTION', 'IndexedDB state persists NEEDS_ACTION');
// Two independent tabs share the same durable object store; only one may
// move a pending row to SENDING or NEEDS_ACTION.
const tab2 = makeStorage(true);
tab2.isIndexedDBSupported = true;
tab2.dbPromise = Promise.resolve(db);
const contested = item('contested');
db.records.set(contested.operationId, contested);
const [concurrentClaim, concurrentDenied] = await Promise.all([
  persisted.claimSyncItem(contested),
  tab2.markPendingSyncItemNeedsAction(contested, 'Role changed'),
]);
ok(Boolean(concurrentClaim) !== concurrentDenied, 'Two concurrent tabs cannot both claim and deny a submission');
ok(db.records.get(contested.operationId).status === (concurrentClaim ? 'SENDING' : 'NEEDS_ACTION'),
  'Persisted status matches exactly one winning transaction');
// A new app process must be able to recover the original send after 120 seconds.
const interrupted = item('reloaded');
db.records.set(interrupted.operationId, interrupted);
const interruptedToken = await persisted.claimSyncItem(interrupted);
const interruptedSnapshot = { ...db.records.get(interrupted.operationId), updatedAt: oldTime };
db.records.set(interrupted.operationId, interruptedSnapshot);
ok(await tab2.recoverStaleSyncItem(interruptedSnapshot, now), 'Restarted browser context recovers persisted stale delivery');
ok(!await persisted.acknowledgeSyncItem({...interrupted, deliveryAttemptId: interruptedToken}),
  'Original interrupted sender cannot delete recovered queue item');

ok(serviceSource.includes('OfflineStorage.markPendingSyncItemNeedsAction(item, permissionError)'), 'Sync service uses guarded permission transition');
ok(serviceSource.includes('OfflineStorage.isStaleSendingItem(item, currentTime)'), 'Sync service uses timestamp-safe stale detection');
ok(!serviceSource.includes("item.status = 'NEEDS_ACTION';\n          item.lastError = permissionError;"), 'No unchecked snapshot mutation for permission-denied operation');
console.log(`${passed}/${passed} R114-C1 offline recovery audit PASS`);
