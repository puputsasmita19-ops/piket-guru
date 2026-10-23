/** R33 focused concurrency and account isolation checks. All network/IDB operations are mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
let count = 0;
const check = async (label, test) => { await test(); count++; console.log('PASS', label); };
const compile = (file, imports, globals = {}) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${file} syntax error`);
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, { exports: module.exports, module,
    require: name => { if (!(name in imports)) throw new Error(`Unmocked import ${name}`); return imports[name]; },
    console, Promise, Date, Map, Set, Math, Array, Object, String, Number,
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval, ...globals }, { filename: file });
  return module.exports;
};
const project = 'school-r33';
const offlineFile = 'src/services/offline/offlineStorage.ts';
const offlineImports = { '../../../firebase-applet-config.json': { projectId: project } };
const queue = (id, projectId = project, userId = 'teacher-a') => ({ operationId: id, projectId, userId,
  userName: 'Guru', operationType: 'INCIDENT_REPORT', collectionName: 'incidents', recordId: id,
  payload: {}, status: 'PENDING_NETWORK', createdAt: '2026-10-23T00:00:00.000Z', retryCount: 0, schemaVersion: 2 });
const memory = compile(offlineFile, offlineImports, { indexedDB: undefined }).OfflineStorage;
await check('Queue from a different Firebase project is not returned to the current school', async () => {
  await memory.enqueueSyncItem(queue('old', 'school-other'));
  await memory.enqueueSyncItem(queue('new'));
  assert.equal((await memory.getSyncItemsByUser('teacher-a')).map(v => v.operationId).join(','), 'new');
  await assert.rejects(memory.removeSyncItem('old', { userId: 'teacher-a' }), /bukan milik/);
});
await check('Queue from a different account stays invisible', async () => {
  await memory.enqueueSyncItem(queue('other-user', project, 'teacher-b'));
  assert.equal((await memory.getSyncItemsByUser('teacher-a')).length, 1);
});

function makeIndexedDB() {
  const tables = Object.fromEntries(['drafts','syncQueue','scopedCache','metadata'].map(name => [name, new Map()]));
  let transactions = 0, commits = 0;
  const database = { onversionchange: null, close() {}, objectStoreNames: { contains: () => true },
    transaction(names, mode) {
      transactions++;
      const tx = { error: null, oncomplete: null, onabort: null, onerror: null, objectStore(name) {
        const map = tables[name];
        return { put(value) { const id = value.id ?? value.key ?? value.operationId; map.set(id,value); },
          delete(id) { map.delete(id); },
          index(indexName) { assert.equal(indexName, 'userId'); return {
            getAllKeys(uid) { const req = { result: [], onsuccess: null, onerror: null };
              queueMicrotask(() => { req.result = [...map.entries()].filter(([, v]) => v.userId === uid).map(([k]) => k); req.onsuccess?.(); }); return req; },
            getAll(uid) { const req = { result: [], onsuccess: null, onerror: null };
              queueMicrotask(() => { req.result = [...map.values()].filter(v => v.userId === uid); req.onsuccess?.(); }); return req; },
          }; },
          get(id) { const req = { result: null, onsuccess: null, onerror: null };
            queueMicrotask(() => { req.result = map.get(id); req.onsuccess?.(); }); return req; },
        };
      } };
      // Deliberately delay commit after request success: callers must await tx.oncomplete.
      setTimeout(() => { commits++; tx.oncomplete?.(); }, 18);
      return tx;
    } };
  return { tables, database, indexedDB: { open() {
    const req = { result: database, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => req.onsuccess?.()); return req;
  } }, get transactions() { return transactions; }, get commits() { return commits; } };
}
const mockDb = makeIndexedDB();
const trusted = compile(offlineFile, offlineImports, {
  indexedDB: mockDb.indexedDB, localStorage: { getItem(key) { return key === 'piket_device_trusted_v2' ? 'true' : null; } },
}).OfflineStorage;
await check('Persistent queue returns only active-project entries', async () => {
  mockDb.tables.syncQueue.set('old', queue('old', 'school-other'));
  mockDb.tables.syncQueue.set('new', queue('new'));
  assert.equal((await trusted.getSyncItemsByUser('teacher-a')).map(i => i.operationId).join(','), 'new');
});
await check('Cache write does not resolve before IndexedDB commit', async () => {
  let settled = false;
  const saving = trusted.setScopedCache('teacher-a', 'incidents', [{ id: '1' }]).then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false);
  await saving; assert.equal(settled, true);
});
await check('Verified profile write does not resolve before IndexedDB commit', async () => {
  let settled = false;
  const saving = trusted.saveVerifiedProfile({ id: 'teacher-a', fullName: 'Guru' }).then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false);
  await saving;
});
await check('Logout purge is atomic across account stores and waits for commit', async () => {
  mockDb.tables.drafts.set('draft-a', { id: 'draft-a', userId: 'teacher-a' });
  mockDb.tables.drafts.set('draft-b', { id: 'draft-b', userId: 'teacher-b' });
  mockDb.tables.syncQueue.set('record-a', queue('record-a'));
  mockDb.tables.scopedCache.set('cache-a', { key: 'cache-a', userId: 'teacher-a' });
  let settled = false;
  const clearing = trusted.purgeUserData('teacher-a').then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(settled, false, 'purge resolved before storage committed');
  await clearing;
  assert.equal(mockDb.tables.drafts.has('draft-a'), false);
  assert.equal(mockDb.tables.drafts.has('draft-b'), true);
  assert.equal(mockDb.tables.syncQueue.has('record-a'), false);
  assert.equal(mockDb.tables.scopedCache.has('cache-a'), false);
});
await check('Clear display cache waits for commit but preserves queue and drafts', async () => {
  mockDb.tables.scopedCache.set('cache-2', { key: 'cache-2', userId: 'teacher-b' });
  const draft = { id: 'db', userId: 'teacher-b' };
  mockDb.tables.drafts.set('db', draft);
  let settled = false;
  const clearing = trusted.clearDisplayCacheOnly('teacher-b').then(() => { settled = true; });
  await Promise.resolve(); await Promise.resolve(); assert.equal(settled, false);
  await clearing;
  assert.equal(mockDb.tables.scopedCache.has('cache-2'), false);
  assert.equal(mockDb.tables.drafts.has('db'), true);
});
const navigator = { onLine: true };
let requests = 0;
const responders = [];
const sync = compile('src/services/offline/syncQueueService.ts', {
  './offlineStorage': { OfflineStorage: {} },
  './draftService': { DraftService: {} },
  '../firebase/firebaseAuth': { auth: { currentUser: { uid: 'teacher-a' } } },
  '../../config/permissions': { PERMISSIONS: {}, checkUserPermission: () => false },
}, { navigator, fetch: () => { requests++; return new Promise(resolve => responders.push(resolve)); } }).SyncQueueService;
await check('100 simultaneous connectivity checks share only one network request', async () => {
  const calls = Array.from({ length: 100 }, () => sync.isNetworkReachable());
  assert.equal(requests, 1);
  responders.shift()({ ok: true, status: 200 });
  assert.ok((await Promise.all(calls)).every(Boolean));
});
await check('A subsequent reconnect gets a new check, not a stale cached result', async () => {
  const p = sync.isNetworkReachable();
  assert.equal(requests, 2);
  responders.shift()({ ok: false, status: 503 });
  assert.equal(await p, false);
});
await check('Offline navigator skips network checks', async () => {
  navigator.onLine = false;
  assert.equal(await sync.isNetworkReachable(), false);
  assert.equal(requests, 2);
});
console.log(`${count} focused R33 checks passed (simulated IndexedDB/network; no Firebase load test).`);
