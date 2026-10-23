const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');

const read = p => fs.readFileSync(p, 'utf8');
const sources = [
  'src/features/visitors/VisitorPreview.tsx',
  'src/features/reports/ReportsPreview.tsx',
  'src/services/firebase/photoWatermarkReviewService.ts',
  'src/utils/photoWatermarkStatus.ts',
  'src/types/watermark.types.ts',
  'src/types/incident.types.ts',
  'src/types/visitor.types.ts',
];
for (const file of sources) {
  const parsed = ts.createSourceFile(file, read(file), ts.ScriptTarget.ESNext, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length, 0,
    `${file}: ${parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(', ')}`);
}

const visitor = read(sources[0]);
const report = read(sources[1]);
const service = read(sources[2]);
assert(visitor.includes('min-w-[1440px] table-fixed') && visitor.includes('overflow-x-auto overscroll-x-contain'));
assert(visitor.includes('<colgroup>') && visitor.includes('flex flex-col gap-2') && visitor.includes('flex flex-wrap items-center justify-end'));
assert(report.includes('Verifikasi visual oleh Admin') && report.includes('Simpan Status Watermark'));
assert(report.includes('watermarkReviewConfirm') && report.includes('watermarkReviewBusy'));
assert(!report.includes('Foto Arsip (Non-watermark)'), 'Do not assume missing metadata means non-watermark.');
assert(report.includes('photo.watermarkReview') && report.includes('inc.fotoWatermarkReview') && report.includes('vis.fotoWatermarkReview'));
assert(service.includes("user.role !== 'ADMIN'") && service.includes('auth.currentUser.uid !== user.id'));
assert(service.includes('setDocumentWithAudit') && service.includes('expectedState: existing'));
assert(service.includes('actualUrl !== photoUrl') && service.includes('Foto kejadian sudah berubah'));

const output = ts.transpileModule(read(sources[3]), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText;
const transpileExports = {};
const transpileModule = {exports:transpileExports};
vm.runInNewContext(output, {exports:transpileExports, module:transpileModule});
const {resolvePhotoWatermarkStatus, getPhotoWatermarkLabel, photoReviewKey} = transpileModule.exports;
const url='https://drive.example/photo.jpg';
assert.equal(resolvePhotoWatermarkStatus(url).status, 'UNKNOWN');
assert.equal(getPhotoWatermarkLabel(resolvePhotoWatermarkStatus(url).status), 'Status watermark belum diverifikasi');
assert.equal(resolvePhotoWatermarkStatus(url, null, 'WATERMARK').status, 'WATERMARK');
assert.equal(resolvePhotoWatermarkStatus(url, null, 'ORIGINAL').status, 'ORIGINAL');
const review={status:'WATERMARK',photoKey:photoReviewKey(url), reviewedAt:'2026-10-23T07:00:00Z',reviewedById:'admin',reviewedByName:'Administrator'};
assert.equal(resolvePhotoWatermarkStatus(url, review, 'ORIGINAL').status, 'WATERMARK', 'Confirmed human review takes precedence over old metadata.');
assert.equal(resolvePhotoWatermarkStatus('https://drive.example/other.jpg', review).status, 'UNKNOWN', 'Stale review must never attach to a changed photo.');
assert.ok(photoReviewKey(url).length < 32, 'Archive metadata must not duplicate image data.');
assert.equal(getPhotoWatermarkLabel('WATERMARK'), 'Berwatermark');
assert.equal(getPhotoWatermarkLabel('ORIGINAL'), 'Tanpa watermark');
console.log('OK — R37: syntax, visitor table, Admin review, and 7 status-resolution scenarios passed.');
