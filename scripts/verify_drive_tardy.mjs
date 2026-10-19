// Offline regression tests. Firebase/Drive IO is replaced; production is never accessed.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import express from 'express';

const fixture = {
  records: new Map(), writes: 0, failWrite: false, role: 'GURU',
  policy: { success: true, configuredInEnv: true, status: 'CONNECTED', enabled: true },
  requests: [], uploads: [], files: new Map(), statusCode: 200, uploadCode: 200,
};
const mocks = {
  sdk: `export const where=(...values)=>values;`,
  firebase: `export const auth = { currentUser: { uid: 'test-officer', getIdToken: async () => 'TEST_TOKEN' } };`,
  firestoreService: `
    const f = globalThis.fixture;
    export class FirestoreService {
      static async getById(c, id) { return f.records.get(id) || null; }
      static async getByIdStrict(c,id) { return this.getById(c,id); }
      static nextUpdatedAt(previous) { return new Date(Math.max(Date.now(), Date.parse(previous?.updatedAt)||0)+1).toISOString(); }
      static async getForDates(c, dates) { return [...f.records.values()].filter(r=>dates.includes(r.tanggal)); }
      static async getAll() { return [...f.records.values()]; }
      static sanitizeFirestorePayload(value) { return JSON.parse(JSON.stringify(value)); }
      static async setDocument(c, id, data) {
        if (f.failWrite) { f.failWrite = false; throw Error('TEST_WRITE_FAILED'); }
        f.writes++; f.records.set(id, structuredClone(data));
      }
      static async logAudit() {}
    }`,
};
const result = await build({
  stdin: {
    contents: `export { StudentTardyService } from './src/services/firebase/studentTardyService';
      export { processPhotoForStorage, isDriveStorageActive } from './src/services/drive/photoUploadHelper';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'isolated-io', setup(b) {
    b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'sdk',namespace:'mock'}));
    b.onResolve({ filter: /\/(firebase|firebaseAuth|firestoreService)$/ }, (args) => {
      const name = args.path.split('/').pop().replace('firebaseAuth', 'firebase');
      return { path: name, namespace: 'mock' };
    });
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({ contents: mocks[args.path], loader: 'js' }));
  } }],
});
const response = (code, data) => ({ ok: code >= 200 && code < 300, json: async () => data });
const context = vm.createContext({
  fixture, module: { exports: {} }, crypto: webcrypto, TextEncoder, structuredClone, AbortController, setTimeout, clearTimeout,
  // Keep synthetic errors quiet. No credentials or actual photos are logged.
  console: { log() {}, warn() {}, error() {} },
  fetch: async (url, options) => {
    fixture.requests.push(url);
    assert.equal(options.headers.Authorization, 'Bearer TEST_TOKEN');
    if (url === '/api/drive/status') return response(403, { error: 'ADMIN_ONLY' });
    if (url === '/api/drive/storage-status') {
      assert.equal(options.cache, 'no-store');
      return response(fixture.statusCode, fixture.statusCode === 200 ? fixture.policy : { error: 'TEST_POLICY_UNAVAILABLE' });
    }
    assert.equal(url, '/api/drive/upload');
    const body = JSON.parse(options.body);
    fixture.uploads.push(body);
    if (fixture.uploadCode !== 200) return response(fixture.uploadCode, { success: false, error: 'TEST_UPLOAD_FAILED' });
    let fileId = fixture.files.get(body.clientPhotoId);
    if (!fileId) { fileId = `test-photo-${fixture.files.size + 1}`; fixture.files.set(body.clientPhotoId, fileId); }
    return response(200, { success: true, fileId, photoUrl: `/api/drive/photo/${fileId}`, size: 4, mimeType: 'image/jpeg', provider: 'google_drive' });
  },
});
vm.runInContext(result.outputFiles[0].text, context);
const { StudentTardyService: service, processPhotoForStorage: processPhoto, isDriveStorageActive: active } = context.module.exports;
const user = { id: 'test-officer', role: 'GURU', fullName: 'Test Officer', isActive: true };
const photoA = 'data:image/jpeg;base64,TEST_A';
const photoB = 'data:image/jpeg;base64,TEST_B';
const record = (id, photo = photoA) => ({ id, tanggal: '2026-10-15', studentId: id, namaSiswa: 'Test Student', kelas: 'Test Class', fotoUrl: photo });
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
function reset() {
  fixture.records.clear(); fixture.files.clear(); fixture.requests = []; fixture.uploads = [];
  fixture.writes = 0; fixture.failWrite = false; fixture.statusCode = 200; fixture.uploadCode = 200;
  fixture.policy = { success: true, configuredInEnv: true, status: 'CONNECTED', enabled: true };
}

await check('staff save uses minimal policy and studentTardiness upload, saves only a reference', async () => {
  reset(); const saved = await service.saveTardyStudent(record('test-1'), user);
  assert.equal(fixture.uploads.length, 1); assert.equal(fixture.uploads[0].module, 'studentTardiness');
  assert.equal(saved.fotoUrl, '/api/drive/photo/test-photo-1');
  assert.ok(!JSON.stringify([...fixture.records.values()]).includes('data:image/'));
  assert.ok(!fixture.requests.includes('/api/drive/status'));
});
await check('enabling Drive immediately after disabled policy is not masked by cached false', async () => {
  reset(); fixture.policy.enabled = false; assert.equal(await active(), false);
  fixture.policy.enabled = true; assert.equal((await processPhoto(photoA, 'studentTardiness', 'test-toggle')).provider, 'google_drive');
});
await check('unavailable policy blocks save without Base64 fallback', async () => {
  reset(); fixture.statusCode = 503;
  await assert.rejects(service.saveTardyStudent(record('test-fail'), user), /Status penyimpanan/);
  assert.equal(fixture.writes, 0); assert.equal(fixture.uploads.length, 0);
});
await check('enabled but disconnected Drive blocks save', async () => {
  reset(); fixture.policy.status = 'NEEDS_RECONNECT';
  await assert.rejects(service.saveTardyStudent(record('test-reconnect'), user), /koneksi belum siap/);
  assert.equal(fixture.writes, 0);
});
await check('upload failure does not create a successful record', async () => {
  reset(); fixture.uploadCode = 500;
  await assert.rejects(service.saveTardyStudent(record('test-upload-fail'), user), /TEST_UPLOAD_FAILED/);
  assert.equal(fixture.writes, 0);
});
await check('explicitly disabled Drive preserves supported legacy storage', async () => {
  reset(); fixture.policy.enabled = false;
  assert.equal((await service.saveTardyStudent(record('test-disabled'), user)).fotoUrl, photoA);
  assert.equal(fixture.uploads.length, 0);
});
await check('two students retain distinct photos and retry does not rewrite records', async () => {
  reset(); const students = [record('test-student-a', photoA), record('test-student-b', photoB)];
  const first = await service.saveBatchTardyStudents(students, user, 'batch-full-test-1');
  assert.equal(first.allSuccessful, true); assert.equal(fixture.files.size, 2);
  assert.notEqual(first.results[0].record.fotoUrl, first.results[1].record.fotoUrl);
  const retry = await service.saveBatchTardyStudents(students, user, 'batch-full-test-1');
  assert.equal(retry.allSuccessful, true); assert.equal(fixture.writes, 2); assert.equal(fixture.uploads.length, 2);
});
await check('record write failure retries the same upload identity', async () => {
  reset(); fixture.failWrite = true;
  await assert.rejects(service.saveTardyStudent(record('test-retry'), user), /TEST_WRITE_FAILED/);
  await service.saveTardyStudent(record('test-retry'), user);
  assert.equal(fixture.uploads[0].clientPhotoId, fixture.uploads[1].clientPhotoId);
  assert.equal(fixture.files.size, 1); assert.equal(fixture.writes, 1);
});
await check('replacement photo gets a new identity while same-photo retry stays stable', async () => {
  reset(); await service.saveTardyStudent(record('test-edit', photoA), user);
  await service.saveTardyStudent(record('test-edit', photoB), user, true);
  assert.notEqual(fixture.uploads[0].clientPhotoId, fixture.uploads[1].clientPhotoId);
});
await check('existing Drive references do not upload again', async () => {
  reset(); const saved = await service.saveTardyStudent(record('test-ref', '/api/drive/photo/legacy-drive-file'), user);
  assert.equal(saved.fotoUrl, '/api/drive/photo/legacy-drive-file'); assert.equal(fixture.uploads.length, 0);
});
await check('legacy queued edit without batch ID can still update an existing record', async () => {
  reset(); await service.saveTardyStudent(record('test-offline-edit', photoA), user);
  const updated = await service.saveTardyStudent({ ...record('test-offline-edit', photoB), catatanPetugas: 'Updated from queue' }, user);
  assert.equal(fixture.writes, 2); assert.equal(updated.catatanPetugas, 'Updated from queue');
  assert.equal(updated.fotoUrl, '/api/drive/photo/test-photo-2');
});
await check('full batch IDs remain different even when their first eight characters match', async () => {
  assert.notEqual(service.getBatchRecordId('2026-10-15', 'student', 'batch-abc-1'), service.getBatchRecordId('2026-10-15', 'student', 'batch-abc-2'));
});
console.log(`${passed} isolated service regressions passed. No Firebase or Google Drive network calls were made.`);

// Exercise the real Express routes. Authentication is a synthetic middleware;
// the production Firebase token verifier is not exercised by this suite.
const backendFixture = {
  failRead: false,
  config: { enabled: true, status: 'CONNECTED', encryptedRefreshToken: 'TEST_PRIVATE', accountEmail: 'private@example.invalid', rootFolderId: 'TEST_FOLDER' },
};
const backendMocks = {
  auth: `export const requireAuth = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ success: false });
    req.user = { uid: 'test-officer', role };
    req.callerData = { permissions: JSON.parse(req.headers['x-test-permissions'] || '[]') };
    next();
  };
  export const requireAdmin = (req, res, next) => req.user.role === 'ADMIN' ? next() : res.status(403).json({ success: false });`,
  admin: `export const adminAuth = {};
    export const adminDb = { collection: () => ({ doc: () => ({ get: async () => {
      if (globalThis.backendFixture.failRead) throw Error('TEST_DATABASE_UNAVAILABLE');
      return { exists: true, data: () => globalThis.backendFixture.config };
    } }) }) };`,
  google: 'export const google = {};',
};
const backendBuild = await build({
  stdin: { contents: `export { driveRouter } from './src/server/routes/driveRoutes'; export { DriveStore } from './src/server/services/driveStore';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['express'],
  plugins: [{ name: 'backend-io', setup(b) {
    b.onResolve({ filter: /authRoutes\.js$/ }, () => ({ path: 'auth', namespace: 'mock' }));
    b.onResolve({ filter: /firebaseAdmin\.js$/ }, () => ({ path: 'admin', namespace: 'mock' }));
    b.onResolve({ filter: /^googleapis$/ }, () => ({ path: 'google', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({ contents: backendMocks[args.path], loader: 'js' }));
  } }],
});
const backendContext = vm.createContext({ backendFixture, module: { exports: {} }, require: createRequire(import.meta.url), Buffer,
  process: { env: { GOOGLE_CLIENT_ID: 'TEST_CLIENT', GOOGLE_CLIENT_SECRET: 'TEST_SECRET' } },
  console: { log() {}, info() {}, warn() {}, error() {} },
});
vm.runInContext(backendBuild.outputFiles[0].text, backendContext);
const { driveRouter, DriveStore } = backendContext.module.exports;
let backendUploadedModule;
DriveStore.uploadPhoto = async (options) => {
  backendUploadedModule = options.module;
  return { fileId: 'TEST_FILE', size: options.buffer.length, mimeType: 'image/jpeg', provider: 'google_drive', folderPath: 'PiketGuru_Photos/2026/10/studentTardiness' };
};
const app = express(); app.use(express.json()); app.use('/api/drive', driveRouter);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  await check('minimal policy allows authenticated staff without exposing owner or tokens', async () => {
    const res = await fetch(`${origin}/api/drive/storage-status`, { headers: { 'x-test-role': 'GURU' } });
    assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();
    assert.deepEqual(Object.keys(data).sort(), ['configuredInEnv', 'enabled', 'status', 'success']);
    assert.equal(data.enabled, true);
  });
  await check('admin settings and anonymous storage access remain restricted', async () => {
    assert.equal((await fetch(`${origin}/api/drive/status`, { headers: { 'x-test-role': 'GURU' } })).status, 403);
    assert.equal((await fetch(`${origin}/api/drive/storage-status`)).status, 401);
  });
  await check('database policy failure returns 503 rather than disabled storage', async () => {
    backendFixture.failRead = true;
    assert.equal((await fetch(`${origin}/api/drive/storage-status`, { headers: { 'x-test-role': 'GURU' } })).status, 503);
    backendFixture.failRead = false;
  });
  await check('backend accepts studentTardiness and rejects unknown roles for that upload', async () => {
    const options = { method: 'POST', headers: { 'x-test-role': 'GURU', 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'studentTardiness', base64: 'data:image/jpeg;base64,dGVzdA==' }) };
    const res = await fetch(`${origin}/api/drive/upload`, options);
    assert.equal(res.status, 200); assert.equal(backendUploadedModule, 'studentTardiness');
    assert.equal((await res.json()).photoUrl, '/api/drive/photo/TEST_FILE');
    assert.equal((await fetch(`${origin}/api/drive/upload`, { ...options, headers: { ...options.headers, 'x-test-role': 'NONE' } })).status, 403);
  });
  await check('incident and visitor uploads accept staff and reject unknown roles', async () => {
    for (const module of ['incidents', 'visitors']) {
      const options = { method: 'POST', headers: { 'x-test-role': 'GURU', 'Content-Type': 'application/json' }, body: JSON.stringify({ module, base64: 'data:image/jpeg;base64,dGVzdA==' }) };
      assert.equal((await fetch(`${origin}/api/drive/upload`, options)).status, 200);
      assert.equal(backendUploadedModule, module);
      assert.equal((await fetch(`${origin}/api/drive/upload`, { ...options, headers: { ...options.headers, 'x-test-role': 'NONE' } })).status, 403);
    }
  });
  await check('attendance upload enforces server-side attendance permission', async () => {
    const options = { method: 'POST', headers: { 'x-test-role': 'GURU', 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'attendance', base64: 'data:image/jpeg;base64,dGVzdA==' }) };
    assert.equal((await fetch(`${origin}/api/drive/upload`, options)).status, 403);
    for (const permission of ['attendance.create', 'input_duty_book', '*']) {
      assert.equal((await fetch(`${origin}/api/drive/upload`, { ...options, headers: { ...options.headers, 'x-test-permissions': JSON.stringify([permission]) } })).status, 200);
    }
    assert.equal((await fetch(`${origin}/api/drive/upload`, { ...options, headers: { ...options.headers, 'x-test-role': 'ADMIN' } })).status, 200);
    assert.equal(backendUploadedModule, 'attendance');
  });
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log(`${passed} total service/router regressions passed; all external services were mocked.`);
