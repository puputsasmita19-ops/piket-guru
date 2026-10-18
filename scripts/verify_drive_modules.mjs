// Isolated integration regressions: real module services and sync dispatch,
// mocked Firebase/Drive IO. Never reads/writes a production project.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const f = { currentUid: 'test-officer', records: new Map(), writes: [], files: new Map(), uploads: [], statusCode: 200,
  uploadCode: 200, failWrite: false, enabled: true, settings: { attendanceMode: 'BEBAS', schoolLat: 0, schoolLng: 0, allowedRadiusMeters: 100 }, conversions: 0 };
const io = {
  firebase: `export const auth={currentUser:{get uid(){return globalThis.f.currentUid},getIdToken:async()=> 'TEST_TOKEN'}};export const db={};`,
  firestoreService: `const f=globalThis.f;export class FirestoreService {
    static nextUpdatedAt(previous){return new Date(Math.max(Date.now(),Date.parse(previous?.updatedAt)||0)+1).toISOString();}
    static async getById(c,id){return f.records.get(c+'/'+id)||null;}
    static async getByIdStrict(c,id){return this.getById(c,id);}
    static async getAll(c){return [...f.records.entries()].filter(([key])=>key.startsWith(c+'/')).map(([,v])=>v);}
    static sanitizeFirestorePayload(data){return JSON.parse(JSON.stringify(data));}
    static async setDocument(c,id,data){if(f.failWrite){f.failWrite=false;throw Error('TEST_WRITE_FAILED');}const clean=this.sanitizeFirestorePayload(data);f.records.set(c+'/'+id,clean);f.writes.push({c,id,data:clean});}
    static async setDocumentWithAudit(c,id,data){return this.setDocument(c,id,data);}
    static async logAudit(){}
  }`,
  firestore: `export const where=(...values)=>values;export const doc=(_db,c,id)=>({c,id});export const getDoc=async(ref)=>{
    const value=ref.c==='settings'?globalThis.f.settings:globalThis.f.records.get(ref.c+'/'+ref.id);
    return {exists:()=>!!value,data:()=>value};};
    export const setDoc=async(ref,data)=>{const f=globalThis.f;if(f.failWrite){f.failWrite=false;throw Error('TEST_WRITE_FAILED');}f.records.set(ref.c+'/'+ref.id,data);f.writes.push({c:ref.c,id:ref.id,data});};
    export const serverTimestamp=()=> 'TEST_TIME';export const runTransaction=async(_,fn)=>{const ops=[];await fn({get:getDoc,set:(ref,data)=>ops.push([ref,data])});for(const[ref,data]of ops)await setDoc(ref,data)};`,
  offline: `export class OfflineStorage{static getProjectId(){return "demo-test";}static async updateSyncItem(){globalThis.f.conversions++;}}`,
  drafts: `export class DraftService{static async blobToDataUrl(blob){return blob.dataUrl;}}`,
  duty: 'export class DutyBookService{}', permits: 'export class StudentPermitService{}', substitutions: 'export class SubstitutionService{}',
};
const output = await build({
  stdin: { contents: `export { AttendanceService } from './src/services/firebase/attendanceService';
    export { IncidentService } from './src/services/firebase/incidentService';
    export { VisitorService } from './src/services/firebase/visitorService';
    export { SyncQueueService } from './src/services/offline/syncQueueService';
    export { DriveClientService } from './src/services/drive/driveClientService';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'isolated-io', setup(b) {
    const patterns = [[/\/(?:firebase|firebaseAuth)$/, 'firebase'], [/\/firestoreService$/, 'firestoreService'], [/^firebase\/firestore$/, 'firestore'],
      [/\/offlineStorage$/, 'offline'], [/\/draftService$/, 'drafts'], [/\/dutyBookService$/, 'duty'],
      [/\/studentPermitService$/, 'permits'], [/\/substitutionService$/, 'substitutions']];
    for (const [filter, path] of patterns) b.onResolve({ filter }, () => ({ path, namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({ contents: io[a.path], loader: 'js' }));
  } }],
});
const context = vm.createContext({ f, module: { exports: {} }, crypto: webcrypto, TextEncoder, URL, Blob,
  console: { log() {}, warn() {}, error() {} },
  fetch: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer TEST_TOKEN');
    if (url === '/api/drive/storage-status') return { ok: f.statusCode === 200, json: async () => ({ success: f.statusCode === 200, enabled: f.enabled, configuredInEnv: true, status: 'CONNECTED', error: 'TEST_STATUS_FAILED' }) };
    if (url.startsWith('/api/drive/photo/')) {
      assert.ok(!url.includes('token=')); return { ok: true, blob: async () => new Blob(['TEST_IMAGE'], { type: 'image/jpeg' }) };
    }
    assert.equal(url, '/api/drive/upload');
    const body = JSON.parse(options.body); f.uploads.push(body);
    const fail = f.uploadCode !== 200 || f.failUploadNumber === f.uploads.length;
    if (fail) return { ok: false, json: async () => ({ success: false, error: 'TEST_UPLOAD_FAILED' }) };
    let id = f.files.get(body.clientPhotoId);
    if (!id) { id = `test-photo-${f.files.size + 1}`; f.files.set(body.clientPhotoId, id); }
    return { ok: true, json: async () => ({ success: true, fileId: id, photoUrl: `/api/drive/photo/${id}`, size: 10, provider: 'google_drive', mimeType: 'image/jpeg' }) };
  },
});
vm.runInContext(output.outputFiles[0].text, context);
const { AttendanceService: attendance, IncidentService: incidents, VisitorService: visitors, SyncQueueService: sync, DriveClientService: drive } = context.module.exports;
const user = { id: 'test-officer', fullName: 'Test Officer', role: 'GURU', isActive: true };
const a = 'data:image/jpeg;base64,TEST_A'; const b = 'data:image/jpeg;base64,TEST_B';
const incident = (photos = [a, b]) => ({ id: 'inc-test', tanggal: '2026-10-16', waktu: '07:00', kategori: 'SISWA', kategoriName: 'Siswa', tingkatKeparahan: 'SEDANG', lokasi: 'Test', pihakTerlibat: 'Test', uraian: 'Test report', tindakanAwal: 'Test action', status: 'BARU', photos: photos.map((url, i) => ({ id: `p-${i}`, url, uploadedAt: '2026-10-16T00:00:00Z', caption: `Caption ${i}` })) });
const visitor = (photo = a) => ({ id: 'vis-test', tanggal: '2026-10-16', jamMasuk: '07:00', namaTamu: 'Test Visitor', kategori: 'UMUM', instansiAsal: 'Test', nomorBadge: 'TEST', tujuanBertemu: 'Test Host', keperluan: 'Test', fotoUrl: photo, status: 'SEDANG_BERKUNJUNG' });
const checkIn = () => ({ userId: user.id, userName: user.fullName, tanggal: '2026-10-16', coords: { latitude: 0, longitude: 0, accuracy: 5, timestamp: Date.now() }, geofence: {}, photoUrl: a });
let passed = 0;
async function test(name, fn) { reset(); await fn(); passed++; console.log('PASS', name); }
function reset() { f.currentUid = 'test-officer'; f.records.clear(); f.files.clear(); f.writes = []; f.uploads = []; f.statusCode = 200; f.uploadCode = 200; f.failWrite = false; f.failUploadNumber = undefined; f.enabled = true; f.conversions = 0; }

await test('GPS check-in uploads with attendance record identity and stores reference', async () => {
  const saved = await attendance.checkIn(checkIn());
  assert.equal(f.uploads[0].module, 'attendance'); assert.equal(f.uploads[0].recordId, 'att-2026-10-16-test-officer');
  assert.equal(saved.photoUrl, '/api/drive/photo/test-photo-1'); assert.equal(saved.latitude, 0); assert.equal(saved.accuracy, 5);
});
await test('GPS upload failure keeps attendance uncommitted', async () => {
  f.uploadCode = 500; await assert.rejects(attendance.checkIn(checkIn()), /TEST_UPLOAD_FAILED/); assert.equal(f.writes.length, 0);
});
await test('GPS record write failure retries the same photo identity', async () => {
  f.failWrite = true; await assert.rejects(attendance.checkIn(checkIn()), /TEST_WRITE_FAILED/);
  await attendance.checkIn(checkIn()); assert.equal(f.files.size, 1); assert.equal(f.writes.length, 1);
  assert.equal(f.uploads[0].clientPhotoId, f.uploads[1].clientPhotoId);
});
await test('existing GPS attendance remains protected from duplicate check-in', async () => {
  await attendance.checkIn(checkIn()); await assert.rejects(attendance.checkIn(checkIn()), /sudah pernah tercatat/); assert.equal(f.uploads.length, 1);
});
await test('GPS still requires schedule under TERJADWAL mode', async () => {
  const prior = f.settings.attendanceMode; f.settings.attendanceMode = 'TERJADWAL';
  try { await assert.rejects(attendance.checkIn(checkIn()), /jadwal/); assert.equal(f.uploads.length, 0); }
  finally { f.settings.attendanceMode = prior; }
});
await test('incidents upload all photos in service while preserving captions', async () => {
  const saved = await incidents.saveIncident(incident(), user);
  assert.equal(f.files.size, 2); assert.ok(f.uploads.every((u) => u.module === 'incidents' && u.recordId === saved.id));
  assert.equal(saved.photos[1].caption, 'Caption 1'); assert.ok(saved.photos.every((p) => p.url.startsWith('/api/drive/photo/')));
});
await test('partial incident upload failure retries earlier photos without new file identities', async () => {
  const data = incident(); f.failUploadNumber = 2;
  await assert.rejects(incidents.saveIncident(data, user), /TEST_UPLOAD_FAILED/); assert.equal(f.writes.length, 0);
  await incidents.saveIncident(data, user); assert.equal(f.files.size, 2); assert.equal(f.writes.length, 1);
  assert.equal(f.uploads[0].clientPhotoId, f.uploads[2].clientPhotoId);
});
await test('incident edit retains old Drive references and uploads only new photo', async () => {
  const saved = await incidents.saveIncident(incident(['/api/drive/photo/old', b]), user);
  assert.equal(f.uploads.length, 1); assert.equal(saved.photos[0].url, '/api/drive/photo/old');
});
await test('visitors register and edit use Drive; replacement photo is distinct', async () => {
  const saved = await visitors.registerVisitor(visitor(), user);
  assert.equal(f.uploads[0].module, 'visitors'); assert.equal(f.uploads[0].recordId, 'vis-test');
  const edited = await visitors.updateVisitor({ ...saved, fotoUrl: b }, user);
  assert.notEqual(saved.fotoUrl, edited.fotoUrl); assert.equal(edited.createdAt, saved.createdAt);
});
await test('visitor repeated create returns existing record without another upload', async () => {
  await visitors.registerVisitor(visitor(), user); await visitors.registerVisitor(visitor(), user);
  assert.equal(f.writes.length, 1); assert.equal(f.uploads.length, 1);
});
await test('visitor write failure retains upload identity for retry', async () => {
  const data = visitor(); f.failWrite = true;
  await assert.rejects(visitors.registerVisitor(data, user), /TEST_WRITE_FAILED/); await visitors.registerVisitor(data, user);
  assert.equal(f.files.size, 1); assert.equal(f.uploads[0].clientPhotoId, f.uploads[1].clientPhotoId);
});
await test('visitor upload failure does not save metadata as success', async () => {
  f.uploadCode = 500; await assert.rejects(visitors.registerVisitor(visitor(), user), /TEST_UPLOAD_FAILED/); assert.equal(f.writes.length, 0);
});
await test('status failure blocks all three modules instead of Base64 fallback', async () => {
  f.statusCode = 503;
  for (const save of [() => attendance.checkIn(checkIn()), () => incidents.saveIncident(incident(), user), () => visitors.registerVisitor(visitor(), user)]) await assert.rejects(save(), /TEST_STATUS_FAILED/);
  assert.equal(f.writes.length, 0);
});
await test('explicitly disabled storage still supports legacy documents', async () => {
  f.enabled = false;
  assert.equal((await attendance.checkIn(checkIn())).photoUrl, a);
  assert.equal((await incidents.saveIncident(incident(), user)).photos[0].url, a);
  assert.equal((await visitors.registerVisitor(visitor(), user)).fotoUrl, a); assert.equal(f.uploads.length, 0);
});
await test('incident queue preserves existing references and attachment metadata', async () => {
  const payload = incident(['/api/drive/photo/old', 'attachment:photo_1']);
  const item = { userId:user.id,projectId:'demo-test', operationType: 'INCIDENT_REPORT', payload, attachments: { photo_1: { dataUrl: b } }, createdAt: 'TEST_TIME' };
  await sync.prepareAttachments(item);
  assert.equal(payload.photos[0].url, '/api/drive/photo/old'); assert.equal(payload.photos[1].url, b); assert.equal(payload.photos[1].caption, 'Caption 1');
  assert.equal(sync.validateUserAuthority(item, user), null);
  await sync.executeOperation(item, user); assert.equal(f.uploads.length, 1); assert.equal(f.uploads[0].module, 'incidents');
});
await test('visitor queue dispatch uploads the attachment via the same service', async () => {
  const item = { userId:user.id,projectId:'demo-test', operationType: 'VISITOR_REPORT', payload: { record: visitor(), isUpdate: false }, attachments: { visitor_photo: { dataUrl: b } } };
  await sync.prepareAttachments(item); assert.equal(sync.validateUserAuthority(item, user), null);
  await sync.executeOperation(item, user); assert.equal(f.uploads[0].base64, b); assert.equal(f.uploads[0].module, 'visitors');
  assert.notEqual(sync.validateUserAuthority(item, { ...user, isActive: false }), null);
});
await test('photo reads use Authorization header and a releasable blob URL', async () => {
  const blobUrl = await drive.getAuthenticatedPhotoUrl('/api/drive/photo/test-file');
  assert.ok(blobUrl.startsWith('blob:')); URL.revokeObjectURL(blobUrl);
});
await test('account switch during lazy dispatch prevents a queued write', async () => {
  f.currentUid = 'other-account';
  await assert.rejects(() => sync.executeOperation({operationType:'VISITOR_REPORT',payload:{record:visitor(),isUpdate:false}},user), /Sesi sinkronisasi berubah/);
  assert.equal(f.uploads.length,0);assert.equal(f.writes.length,0);
});
console.log(`${passed} module/queue/media regressions passed. Real Google Drive/Firebase IO was not used.`);
