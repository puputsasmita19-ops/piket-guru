const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const changed = [
  'src/types/visitorConfig.types.ts',
  'src/types/visitor.types.ts',
  'src/types/watermark.types.ts',
  'src/features/settings/OperationalReportSettingsCard.tsx',
  'src/features/visitors/VisitorFormModal.tsx',
  'src/features/visitors/VisitorPreview.tsx',
  'src/features/reports/ReportsPreview.tsx',
  'src/services/firebase/visitorService.ts',
  'src/server/routes/visitorRegistrationRoutes.ts',
];
let passed = 0;
function ok(v, msg) { assert(v, msg); passed++; }
for (const file of changed) {
  const content = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(content, { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  ok((out.diagnostics || []).every(d => d.category !== ts.DiagnosticCategory.Error), `TypeScript syntax: ${file}`);
}
const configSource = fs.readFileSync(changed[0], 'utf8');
const js = ts.transpileModule(configSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, module: { exports: {} } }; context.exports = context.module.exports;
vm.runInNewContext(js, context);
const normalize = context.module.exports.normalizeVisitorConfig;
ok(normalize({}).defaultPhotoMode === 'WATERMARK', 'Old settings default to watermarked photo');
ok(normalize({ defaultPhotoMode: 'ORIGINAL' }).defaultPhotoMode === 'ORIGINAL', 'Admin original-photo choice supported');
ok(normalize({ defaultPhotoMode: 'UNKNOWN' }).defaultPhotoMode === 'WATERMARK', 'Invalid default cannot bypass whitelist');
ok(normalize({ allowPhotoModeChoice: false }).allowPhotoModeChoice === false, 'Admin can lock photo mode');
ok(normalize({ allowCustomDestination: false }).allowCustomDestination === false, 'Prior visitor settings retained');

const backend = fs.readFileSync('src/server/routes/visitorRegistrationRoutes.ts', 'utf8');
const service = fs.readFileSync('src/services/firebase/visitorService.ts', 'utf8');
const form = fs.readFileSync('src/features/visitors/VisitorFormModal.tsx', 'utf8');
const ui = fs.readFileSync('src/features/visitors/VisitorPreview.tsx', 'utf8');
const reports = fs.readFileSync('src/features/reports/ReportsPreview.tsx', 'utf8');
ok(backend.includes("module: 'visitors'") && backend.includes('DriveStore.uploadPhoto('), 'QR approval uploads to visitors folder');
ok(backend.indexOf('prepareApprovedQrPhoto(input, visitId, actorUid)') < backend.indexOf('createVisitGroup({ ...prepared'), 'QR upload completed before visitor record + badges');
ok(backend.includes('photoReviewLock: lease') && backend.includes('photoReviewLock !== reviewLease'), 'Concurrent staff QR approvals protected by lease');
ok(backend.includes('fotoUrl: FieldValue.delete()') && backend.includes('photoReviewLock: FieldValue.delete()'), 'Private pending photograph and lease removed upon approval');
ok(backend.includes('config.status !== \'CONNECTED\'') && backend.includes('Pendaftaran tetap menunggu'), 'Enabled-but-disconnected Drive blocks approval without silent fallback');
ok(backend.includes("if (!config.enabled) return { ...input, fotoMode: 'ORIGINAL' }"), 'Disabled Drive intentionally preserves Base64');
ok(service.includes('migrateLegacyPhotoToDrive') && service.includes('expectedState: existing'), 'Admin legacy migration uses conflict-safe save');
ok(service.includes('isDriveStorageActive()') && service.includes("photo.provider !== 'google_drive'"), 'Migration requires confirmed Drive upload');
ok(service.includes("fotoStorageProvider = photo.provider === 'google_drive'"), 'Staff upload storage provenance recorded');
ok(form.includes('setSavedPhotoMode') && form.includes("enabled: true"), 'Photo capture explicitly records chosen mode and forces watermark when requested');
ok(form.includes('allowPhotoModeChoice') && form.includes('photoCaptureMode'), 'Staff mode chooser follows Admin policy');
ok(ui.includes('Kirim Foto Lama ke Google Drive') && ui.includes('Firestore (foto Base64'), 'Staff can view storage location; admin can migrate');
ok(reports.includes('watermarkUnknown') && reports.includes('getPhotoWatermarkLabel') && fs.readFileSync('src/utils/photoWatermarkStatus.ts', 'utf8').includes('Status watermark belum diverifikasi'), 'Unknown legacy photos are labeled without a false watermark assumption');
const store = fs.readFileSync('src/server/services/driveStore.ts','utf8');
ok(store.includes('getOrCreateFolderHierarchy') && store.includes("options.module"), 'Drive uploads follow module folder tree');
const helper = fs.readFileSync('src/services/drive/photoUploadHelper.ts','utf8');
ok(helper.includes('if (!driveActive)') && helper.includes('throw new Error(`Gagal menyimpan foto ke Google Drive'), 'Active-drive staff upload never silently falls back to Firestore');
// Execute the server's real QR photo preparation function with a controlled Drive stub.
const srcAst = ts.createSourceFile('visitorRegistrationRoutes.ts', backend, ts.ScriptTarget.ES2022, true);
const prepareFn = srcAst.statements.find(stmt => ts.isFunctionDeclaration(stmt) && stmt.name?.text === 'prepareApprovedQrPhoto');
ok(!!prepareFn, 'QR photo approval service exists');
const compiledFn = ts.transpileModule(prepareFn.getText(srcAst), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const { createHash } = require('node:crypto');
const mock = { enabled: false, status: 'DISCONNECTED', uploads: 0, shouldFail: false };
const drive = {
  async getConfig() { return { enabled: mock.enabled, status: mock.status }; },
  async uploadPhoto(options) { mock.uploads++; if (mock.shouldFail) throw new Error('Drive offline'); ok(options.module === 'visitors', 'Uploaded to visitors folder'); return { fileId: 'file-A' }; },
};
const ctx = { Buffer, createHash, DriveStore: drive };
vm.runInNewContext(compiledFn + '\nthis.prepare = prepareApprovedQrPhoto;', ctx);
(async () => {
  const img = Buffer.concat([Buffer.from([0xff,0xd8,0xff]), Buffer.alloc(150), Buffer.from([0xff,0xd9])]);
  const input = { fotoUrl: `data:image/jpeg;base64,${img.toString('base64')}` };
  const noPhoto = await ctx.prepare({}, 'vis-qr-test', 'uid1');
  ok(!noPhoto.fotoUrl, 'No-photo QR remains no-photo');
  const old = await ctx.prepare(input, 'vis-qr-test', 'uid1');
  ok(old.fotoUrl === input.fotoUrl && mock.uploads === 0, 'Explicitly disabled Drive keeps Base64');
  mock.enabled = true; mock.status = 'NEEDS_RECONNECT';
  await assert.rejects(ctx.prepare(input, 'vis-qr-test', 'uid1'));
  ok(mock.uploads === 0, 'Disconnected active Drive blocks approval before upload');
  mock.status = 'CONNECTED'; mock.shouldFail = true;
  await assert.rejects(ctx.prepare(input, 'vis-qr-test', 'uid1'));
  ok(mock.uploads === 1, 'Upload failure propagates without silent Base64 fallback');
  mock.shouldFail = false;
  const uploaded = await ctx.prepare(input, 'vis-qr-test', 'uid1');
  ok(uploaded.fotoUrl === '/api/drive/photo/file-A' && uploaded.fotoMode === 'ORIGINAL', 'Successful upload writes private Drive URL and mode');
  console.log(`LULUS: ${passed} pemeriksaan R34 termasuk uji dinamis Drive QR gagal/berhasil.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
