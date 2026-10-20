/** Round 7 focused race/ownership checks. All browser/database IO is mocked; no production access. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require(process.env.PIKET_TEST_TYPESCRIPT || 'typescript');
const root = path.resolve(import.meta.dirname, '..');
let total = 0;
const check = async (name, fn) => { await fn(); total++; console.log('PASS', name); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const compile = (relative, imports, globals = {}) => {
  const contents = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(contents, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: relative, reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: key => {
    if (!(key in imports)) throw new Error(`Unmocked import: ${key} (${relative})`);
    return imports[key];
  }, console, Date, Map, Set, Promise, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(compiled.outputText, context, { filename: relative });
  return module.exports;
};
const offlinePath = 'src/services/offline/offlineStorage.ts';
const storageImports = { '../../../firebase-applet-config.json': { projectId: 'round7-school' } };
const offlineMemory = compile(offlinePath, storageImports, { indexedDB: undefined });
const Storage = offlineMemory.OfflineStorage;
const queueItem = (operationId, userId, status = 'PENDING_NETWORK') => ({
  operationId, userId, projectId: 'round7-school', status, schemaVersion: 2,
  userName: 'Test', operationType: 'TARDY_REPORT', collectionName: 'studentTardiness',
  recordId: operationId, payload: {}, createdAt: new Date().toISOString(), retryCount: 0,
});
await check('Shared device: wrong account cannot delete another account pending submission', async () => {
  await Storage.enqueueSyncItem(queueItem('secret', 'teacher-a'));
  await assert.rejects(Storage.removeSyncItem('secret', { userId: 'teacher-b' }), /bukan milik/);
  assert.equal((await Storage.getSyncItemsByUser('teacher-a')).length, 1);
});
await check('Shared device: active SENDING submission cannot be discarded', async () => {
  await Storage.enqueueSyncItem(queueItem('sending', 'teacher-a', 'SENDING'));
  await assert.rejects(Storage.removeSyncItem('sending', { userId: 'teacher-a' }), /sedang dikirim/);
  assert.equal((await Storage.getSyncItemsByUser('teacher-a')).length, 2);
});
await check('Shared device: success path removes only same-owner queue entry', async () => {
  await Storage.removeSyncItem('sending', { allowSending: true, userId: 'teacher-a' });
  assert.equal((await Storage.getSyncItemsByUser('teacher-a')).length, 1);
  await Storage.removeSyncItem('secret', { userId: 'teacher-a' });
  assert.equal((await Storage.getSyncItemsByUser('teacher-a')).length, 0);
});

await check('One hundred account-scoped pending items coexist without overwriting each other', async () => {
  const records = Array.from({ length: 100 }, (_, index) => queueItem(`op-${index}`, `user-${index}`));
  await Promise.all(records.map(record => Storage.enqueueSyncItem(record, { createOnly: true })));
  const all = await Promise.all(records.map(record => Storage.getSyncItemsByUser(record.userId)));
  assert.ok(all.every(group => group.length === 1));
  assert.equal(new Set(all.map(group => group[0].operationId)).size, 100);
  await Promise.all(records.map(record => Storage.removeSyncItem(record.operationId, { userId: record.userId })));
  assert.ok((await Promise.all(records.map(record => Storage.getSyncItemsByUser(record.userId)))).every(group => group.length === 0));
});
await check('A stale project queue cannot be removed from the current project', async () => {
  await Storage.enqueueSyncItem({ ...queueItem('old-project', 'a'), projectId: 'old-school' });
  await assert.rejects(Storage.removeSyncItem('old-project', { userId: 'a' }), /bukan milik/);
  assert.equal((await Storage.getSyncItemsByUser('a')).length, 1);
});

function fakeDb() {
  const rows = new Map();
  let opens = 0, closes = 0;
  const database = {
    onversionchange: null, close: () => { closes++; },
    objectStoreNames: { contains: () => true },
    transaction: () => {
      let aborted = false;
      const tx = {
        error: null, oncomplete: null, onabort: null, onerror: null,
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore: () => ({
          get(key) {
            const req = { result: undefined, onsuccess: null, error: null };
            queueMicrotask(() => {
              req.result = rows.get(key);
              req.onsuccess?.();
              if (!aborted) queueMicrotask(() => tx.oncomplete?.());
            });
            return req;
          },
          delete(key) { rows.delete(key); },
        }),
      };
      return tx;
    },
  };
  const indexedDB = {
    open: () => {
      opens++;
      const request = { result: database, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  return { rows, indexedDB, database, get opens() { return opens; }, get closes() { return closes; } };
}
const database = fakeDb();
const storageLocal = { getItem: key => key === 'piket_device_trusted_v2' ? 'true' : null };
const trusted = compile(offlinePath, storageImports, { indexedDB: database.indexedDB, localStorage: storageLocal }).OfflineStorage;
await check('Trusted device: IndexedDB deletion rejects different owner atomically', async () => {
  database.rows.set('op1', queueItem('op1', 'a'));
  await assert.rejects(trusted.removeSyncItem('op1', { userId: 'b' }), /bukan milik/);
  assert.equal(database.rows.get('op1').userId, 'a');
});
await check('Trusted device: IndexedDB deletion refuses a concurrent SENDING record', async () => {
  database.rows.set('op2', queueItem('op2', 'a', 'SENDING'));
  await assert.rejects(trusted.removeSyncItem('op2', { userId: 'a' }), /sedang dikirim/);
  assert.equal(database.rows.get('op2').status, 'SENDING');
});
await check('Trusted device: owner can remove queued work while preserving another row', async () => {
  await trusted.removeSyncItem('op1', { userId: 'a' });
  assert.equal(database.rows.has('op1'), false);
  assert.equal(database.rows.has('op2'), true);
});
await check('IndexedDB schema upgrade closes old connection; next operation reopens', async () => {
  assert.equal(database.opens, 1);
  database.database.onversionchange?.();
  assert.equal(database.closes, 1);
  await trusted.getDb();
  assert.equal(database.opens, 2);
});

const auth = { currentUser: { uid: 'a' } };
const leaseEntered = deferred(), allowRenew = deferred(), readGate = deferred();
let intervalTick;
const calls = [];
let reads = 0;
const mockStorage = {
  getProjectId: () => 'round7-school',
  getSyncItemsByUser: async () => {
    reads++;
    if (reads === 2) { leaseEntered.resolve(); await readGate.promise; }
    return [];
  },
  syncLease: async (uid, owner, release) => {
    calls.push(release ? 'release' : calls.includes('acquire') ? 'renew' : 'acquire');
    if (calls.at(-1) === 'renew') await allowRenew.promise;
    return true;
  },
  removeSyncItem: async (operation, options) => { calls.push(`remove:${options.userId}`); },
};
const syncImports = {
  './offlineStorage': { OfflineStorage: mockStorage },
  './draftService': { DraftService: {} },
  '../firebase/firebaseAuth': { auth },
  '../../config/permissions': { PERMISSIONS: {}, checkUserPermission: () => false },
};
const Sync = compile('src/services/offline/syncQueueService.ts', syncImports, {
  indexedDB: undefined, fetch: undefined, navigator: undefined,
  setInterval: fn => { intervalTick = fn; return 1; }, clearInterval: () => {},
}).SyncQueueService;
await check('Concurrent-tab lease: release waits for in-flight heartbeat', async () => {
  const user = { id: 'a', fullName: 'Teacher', isActive: true, role: 'ADMIN' };
  const job = Sync.triggerSync(user);
  await leaseEntered.promise;
  intervalTick();
  await Promise.resolve();
  readGate.resolve();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.ok(calls.includes('renew'));
  assert.ok(!calls.includes('release'), 'lease was released before in-flight heartbeat finished');
  allowRenew.resolve();
  await job;
  assert.deepEqual(calls.slice(0, 3), ['acquire', 'renew', 'release']);
});
await check('Queue UI: wrong auth session cannot discard another user queue', async () => {
  const before = calls.length;
  await assert.rejects(Sync.removeItem('op2', 'b'), /Sesi akun telah berubah/);
  assert.equal(calls.length, before);
});
await check('Queue UI: owner ID forwarded to atomic deletion', async () => {
  await Sync.removeItem('op2', 'a');
  assert.ok(calls.includes('remove:a'));
});
console.log(`${total} focused round-7 stability checks passed (mocked IO; no production load simulation).`);
