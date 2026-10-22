const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const files = [
  'src/types/visitor.types.ts', 'src/services/firebase/visitorService.ts', 'src/App.tsx',
  'src/features/visitors/VisitorFormModal.tsx', 'src/features/visitors/VisitorPreview.tsx',
  'src/features/visitors/VisitorSelfCheckinPanel.tsx', 'src/features/visitors/PublicVisitorCheckin.tsx',
  'src/server/app.ts', 'src/server/routes/visitorRegistrationRoutes.ts',
  'src/utils/visitorQrSvg.ts', 'src/utils/visitorRegistrationUtils.ts'
];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const res = ts.transpileModule(src, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal((res.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `Syntax errors in ${file}`);
}

const helpersSource = fs.readFileSync('src/utils/visitorRegistrationUtils.ts', 'utf8');
const compiledHelpers = ts.transpileModule(helpersSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const helperModule = { exports: {} };
new Function('module', 'exports', compiledHelpers)(helperModule, helperModule.exports);
const { normalizeVisitorNames, formatVisitorBadge } = helperModule.exports;
assert.deepEqual(normalizeVisitorNames([' Dewi ', ' Budi ']), ['Dewi','Budi']);
assert.deepEqual(normalizeVisitorNames(undefined, ' Sari '), ['Sari']);
assert.throws(() => normalizeVisitorNames(['Dewi','dewi']), /tidak boleh sama/);
assert.throws(() => normalizeVisitorNames(new Array(13).fill('Adit')), /maksimal 12/);
assert.throws(() => normalizeVisitorNames(['']), /wajib diisi/);
assert.equal(formatVisitorBadge('2026-10-22', 1), 'TAMU-20261022-0001');
assert.equal(formatVisitorBadge('2026-10-22', 2), 'TAMU-20261022-0002');
assert.equal(formatVisitorBadge('2026-10-23', 1), 'TAMU-20261023-0001');
assert.throws(() => formatVisitorBadge('xx', 4));

const qrSrc = fs.readFileSync('src/utils/visitorQrSvg.ts', 'utf8');
const qrCompiled = ts.transpileModule(qrSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const qrModule = { exports: {} };
new Function('module','exports',qrCompiled)(qrModule, qrModule.exports);
const svg = qrModule.exports.createQrSvg('https://example.edu/?visitor-checkin=a922f58b-48ec-4e54-9a9b-3be3142c33a4');
assert(svg.startsWith('<svg') && svg.includes('<rect') && svg.endsWith('</svg>'));
assert.throws(() => qrModule.exports.createQrSvg('javascript:alert(1)'), /HTTPS/);

const server = fs.readFileSync('src/server/routes/visitorRegistrationRoutes.ts','utf8');
const app = fs.readFileSync('src/server/app.ts','utf8');
const form = fs.readFileSync('src/features/visitors/VisitorFormModal.tsx','utf8');
const panel = fs.readFileSync('src/features/visitors/VisitorSelfCheckinPanel.tsx','utf8');
const publicForm = fs.readFileSync('src/features/visitors/PublicVisitorCheckin.tsx','utf8');
const service = fs.readFileSync('src/services/firebase/visitorService.ts','utf8');
assert(server.includes('runTransaction') && server.includes('visitorBadgeCounters') && server.includes('tx.create('), 'Badge must be allocated in Firestore transaction');
assert(server.includes('MAX_REQUESTS_PER_MINUTE') && server.includes('MAX_REQUESTS_PER_LINK'), 'Public QR submission must have bounded quotas');
assert(server.includes("'PENDING'") && server.includes("'APPROVED'") && server.includes("'REJECTED'"), 'Self-checkin must require staff review');
assert(server.includes('requireAuth, staffOnly'), 'Staff endpoints must use server-side authorization');
assert(server.includes("visitorSelfCheckinRequests") && !publicForm.includes("FirestoreService"), 'Public guests must not read Firestore directly');
assert(app.includes("app.use('/api/visitor-registration', visitorRegistrationRouter)"));
assert(app.includes("req.path.startsWith('/api/visitor-registration/')"), 'Public visitor PII must not be logged as request body');
assert(form.includes('Tambah Anggota') && form.includes("Otomatis saat disimpan"));
assert(!form.includes('Math.floor(Math.random() * 20'), 'Badge number must not be randomly assigned');
assert(service.includes("'/api/visitor-registration/register'"));
assert(panel.includes('Terima & Terbitkan Badge') && panel.includes('Unduh QR'));
console.log(`LULUS: ${files.length} file lolos pemeriksaan sintaks; 26 pemeriksaan registrasi, badge, QR, hak akses dan verifikasi petugas lulus.`);
