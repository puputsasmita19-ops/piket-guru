const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
const files = [
  'src/components/camera/CameraCaptureModal.tsx',
  'src/features/visitors/VisitorFormModal.tsx',
  'src/features/visitors/VisitorPreview.tsx',
  'src/features/visitors/VisitorSelfCheckinPanel.tsx',
  'src/features/visitors/PublicVisitorCheckin.tsx',
  'src/server/routes/visitorRegistrationRoutes.ts',
  'src/server/routes/visitorPhotoValidation.ts',
  'src/utils/visitorPhoto.ts',
];
let count = 0;
const check = (value, label) => { count += 1; assert(value, label); };
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  check((result.diagnostics || []).every(d => d.category !== ts.DiagnosticCategory.Error), `Syntax invalid: ${file}`);
}
const moduleObject = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync('src/server/routes/visitorPhotoValidation.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', 'Buffer', compiled)(moduleObject, moduleObject.exports, Buffer);
const verify = moduleObject.exports.validateVisitorQrPhoto;
const minimalJpeg = Buffer.concat([Buffer.from([0xff,0xd8,0xff]), Buffer.alloc(120, 0x16), Buffer.from([0xff,0xd9])]);
const uri = `data:image/jpeg;base64,${minimalJpeg.toString('base64')}`;
check(verify(uri,true) === uri, 'Valid jpeg with consent');
check(verify(undefined, false) === undefined, 'Photo optional');
for (const [photo, consent, note] of [[uri,false,'consent'], ['https://evil.test/photo.jpg',true,'url'], ['data:image/svg+xml;base64,PHN2Zz4=',true,'svg'],['data:image/jpeg;base64,AAA=',true,'invalid image'], ['data:image/jpeg;base64,'+'A'.repeat(115001),true,'oversized']]) {
  check((() => {try {verify(photo,consent);return false;}catch{return true}})(),`Reject ${note}`);
}
const publicUi = fs.readFileSync(files[4], 'utf8');
const staff = fs.readFileSync(files[1], 'utf8');
const backend = fs.readFileSync(files[5], 'utf8');
const panel = fs.readFileSync(files[3], 'utf8');
const list = fs.readFileSync(files[2], 'utf8');
check(publicUi.includes('compressVisitorQrPhoto'), 'QR photo compression');
check(publicUi.includes('photoConsent') && publicUi.includes('Foto tamu utama'), 'QR consent and photo UI');
check(publicUi.includes('CameraCaptureModal') && publicUi.includes('initialFacingMode="user"'), 'QR camera opens in selfie mode');
check(staff.indexOf('aria-label="Foto kunjungan tamu"') < staff.indexOf('Row 3: Kategori'), 'Staff photo appears near identity');
check(staff.includes('stampDocumentationPhoto'), 'Staff photo watermark remains');
check(list.includes('loading="lazy"') && list.includes('Foto ${item.namaTamu}'), 'Visitor cards show lazy loaded thumbnails');
check(panel.includes('cocokkan dengan identitas asli'), 'Staff verification shows photo');
check(backend.includes('validateVisitorQrPhoto(input.fotoUrl, input.photoConsent)'), 'Server validates photo and consent');
check(backend.includes('fotoUrl: FieldValue.delete()'), 'Pending photos removed after review');
check(backend.includes('MAX_REQUESTS_PER_MINUTE') && backend.includes("'PENDING'"), 'QR rate limiting and approval retained');
check(backend.includes('index === 0') && backend.includes('payload.fotoUrl'), 'Photo only attached to group leader');
check(!publicUi.includes('FirestoreService'), 'Public page cannot directly write firestore');
const sourcePath = files[5];
for (const imported of ['./visitorPhotoValidation.js']) {
  check(fs.existsSync(path.resolve(path.dirname(sourcePath),imported.replace(/\.js$/,'.ts'))), `Missing local import ${imported}`);
}
console.log(`LULUS: ${count} pemeriksaan R29 (kamera, data foto, persetujuan, antrean verifikasi, izin, impor).`);

process.exit(0);
