const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const report = fs.readFileSync('src/features/reports/ReportsPreview.tsx', 'utf8');
const helper = fs.readFileSync('src/utils/photoRecapOrdering.ts', 'utf8');
const service = fs.readFileSync('src/services/firebase/photoWatermarkReviewService.ts', 'utf8');

for (const [file, content, kind] of [
  ['ReportsPreview.tsx', report, ts.ScriptKind.TSX],
  ['photoRecapOrdering.ts', helper, ts.ScriptKind.TS],
  ['photoWatermarkReviewService.ts', service, ts.ScriptKind.TS],
]) {
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
  assert.equal(ast.parseDiagnostics.length, 0, `${file}: ${ast.parseDiagnostics.map(d => d.messageText).join(', ')}`);
}

const code = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }}).outputText;
const helperExports = {};
vm.runInNewContext(code, { exports: helperExports });
const { photoChronologyKey, orderPhotoRecap, eligibleForVisualReview } = helperExports;
const photo = (id, docDate, docTime, sourceModule='VISITOR', watermarkStatus='UNKNOWN') => ({
  id, sourceModule, sourceId:id, photoUrl:`/api/drive/photo/${id}`, tanggalKejadian:'2026-10-01',
  tanggalDokumentasi:docDate, waktuDokumentasi:docTime, watermarkStatus,
});
const sample = [
  photo('old', '2026-10-02', '07:12 WIB'),
  photo('new', '2026-10-23', '09:30 WIB'),
  photo('middle', '2026-10-22', '21:00 WIB'),
];
assert.equal(photoChronologyKey(sample[1]), '2026-10-23T09:30:00');
assert.deepEqual(Array.from(orderPhotoRecap(sample, 'NEWEST'), x=>x.id), ['new', 'middle', 'old']);
assert.deepEqual(Array.from(orderPhotoRecap(sample, 'OLDEST'), x=>x.id), ['old', 'middle', 'new']);
assert.deepEqual(Array.from(sample,x=>x.id), ['old', 'new', 'middle'], 'Sort must not mutate source photo collection.');
assert.deepEqual(Array.from(orderPhotoRecap([photo('b','2026-10-22','09:00'),photo('a','2026-10-22','09:00')], 'NEWEST'),x=>x.id), ['a','b'], 'Ties must be deterministic.');
assert(eligibleForVisualReview(photo('one','2026-10-22','09:00')));
assert(eligibleForVisualReview(photo('two','2026-10-22','09:00','INCIDENT')));
assert(!eligibleForVisualReview(photo('three','2026-10-22','09:00','ATTENDANCE')));
assert(!eligibleForVisualReview(photo('four','2026-10-22','09:00','STUDENT_TARDY')));
assert(!eligibleForVisualReview(photo('five','2026-10-22','09:00','INCIDENT','WATERMARK')));
assert(!eligibleForVisualReview({...photo('six','2026-10-22','09:00'), photoUrl:''}));

const validations = [
  ['chronology selector', report.includes('Terbaru → Terlama') && report.includes('Terlama → Terbaru')],
  ['status filter', report.includes('photoWatermarkFilter') && report.includes('Belum diverifikasi')],
  ['ordinal respects pagination', report.includes('ordinal={(photoRecapPage - 1) * PHOTO_PAGE_SIZE + photoIndex + 1}')],
  ['page bounded', report.includes('const PHOTO_PAGE_SIZE = 12') && report.includes('paginatedPhotos.filter(eligibleForVisualReview)')],
  ['selected only', report.includes('reviewablePagePhotos.filter(photo => selectedPhotoIds.has(photo.id))')],
  ['actual status per photo', report.includes("[id]: 'WATERMARK'") && report.includes("[id]: 'ORIGINAL'")],
  ['require all reviewed', report.includes('bulkReviewItems.some(p => !bulkReviewChoices[p.id])')],
  ['explicit user acknowledgement', report.includes('bulkReviewConfirmed')],
  ['progress reporting', report.includes('setBulkReviewProgress(idx + 1)')],
  ['partial failure handling', report.includes('errors.push') && report.includes('successes.push')],
  ['serial safe writes', report.includes('for (const [idx, item] of bulkReviewItems.entries())')],
  ['server check and audit preserved', service.includes('getByIdStrict') && service.includes('setDocumentWithAudit') && service.includes('expectedState: existing')],
  ['admin restriction UI', report.includes("currentUser?.role === 'ADMIN'")],
  ['fresh review guard', service.includes('onlyIfUnknown') && service.includes('sudah diverifikasi pengguna lain') && report.includes('item.sourcePhotoIndex, true')],
  ['individual review remains available', report.includes('Simpan Status Watermark')],
  ['prior visitor migration retained', report.includes('Kirim Foto Lama ke Google Drive')],
];
for (const [label, passed] of validations) assert(passed, `Missing: ${label}`);
console.log(`OK R38: ${12 + validations.length} assertions: sort, eligibility, page scope, per-photo decisions, permissions, and regression.`);
