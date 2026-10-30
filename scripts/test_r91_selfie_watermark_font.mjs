/** R91 — Selfie watermark font consistency tests (no camera/Firebase required). */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const serviceCode = read('src/services/attendance/selfieWatermark.ts');
const callerCode = read('src/features/attendance/AttendancePreview.tsx');
const css = read('src/index.css');

let pass = 0;
const test = async (label, fn) => { await fn(); console.log(`PASS ${++pass}: ${label}`); };
const loadService = (document) => {
  const built = ts.transpileModule(serviceCode, { fileName: 'selfieWatermark.ts', reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const errors = (built.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  const module = { exports: {} };
  const sandbox = { document, module, exports: module.exports, console, Intl, Date, setTimeout, clearTimeout };
  vm.runInNewContext(`(function(){${built.outputText}\n})()`, sandbox, { timeout: 5000 });
  return module.exports;
};
function fakeCanvasFactory() {
  const canvases = [];
  const makeCanvas = () => {
    const drawn = [];
    const context = {
      font: '10px sans-serif', fillStyle: '', textBaseline: 'alphabetic',
      measureText(text) { const size = +(this.font.match(/(\d+)px/) || [0, 10])[1]; return { width: text.length * size * 0.52 }; },
      fillText(text, x, y) { drawn.push({ text, x, y, font: this.font, fill: this.fillStyle }); },
      fillRect() {}, drawImage() {},
    };
    const canvas = { getContext: () => context,
      toDataURL: () => 'data:image/jpeg;base64,' + 'a'.repeat(180000),
      get width() { return this._width || 300; },
      set width(value) { this._width = value; context.font = '10px sans-serif'; },
      get height() { return this._height || 150; },
      set height(value) { this._height = value; context.font = '10px sans-serif'; },
      drawn, context,
    };
    canvases.push(canvas);
    return canvas;
  };
  return { canvases, makeCanvas };
}
const evidence = () => {
  const now = Date.now();
  return { userId: 'GURU-001', userName: 'Ibu Guru Pendidikan Jasmani', loginId: 'ID-001', schoolName: 'SMK DR. SOEBANDI', capturedAt: now,
    coords: { latitude: -8.150433, longitude: 113.712504, accuracy: 18.6, timestamp: now } };
};

await test('UI uses Open Sans', () => assert.match(css, /font-family: 'Open Sans', system-ui/));
await test('service has explicit Open Sans/Arial family, never device font', () => {
  assert.match(serviceCode, /SelfieWatermarkFontFamily = 'Open Sans' \| 'Arial'/);
  assert.doesNotMatch(serviceCode, /-apple-system|BlinkMacSystemFont|Times New Roman/);
});
await test('async prepare loads body and bold Open Sans', () => {
  assert.match(serviceCode, /fonts\.load\('500 18px "Open Sans"'/);
  assert.match(serviceCode, /fonts\.load\('700 18px "Open Sans"'/);
});
await test('font is prepared BEFORE fresh GPS capture', () => {
  const first = callerCode.indexOf('const watermarkFont = await prepareSelfieWatermarkFont();');
  const next = callerCode.indexOf('LocationService.ensureFreshPosition', first);
  assert.ok(first > 0 && next > first);
  assert.match(callerCode, /stampCheckInSelfie\(canvas, evidence, watermarkFont\)/);
});
await test('font resolver returns Open Sans when both weights load', async () => {
  const document = { fonts: { load: async () => [{family:'Open Sans'}] } };
  const service = loadService(document);
  assert.equal(await service.prepareSelfieWatermarkFont(), 'Open Sans');
});
await test('font resolver returns Arial if no font is installed / CSS unavailable', async () => {
  const service = loadService({ fonts: { load: async () => [] } });
  assert.equal(await service.prepareSelfieWatermarkFont(), 'Arial');
});
await test('font resolver catches load failures without breaking capture', async () => {
  const service = loadService({ fonts: { load: () => Promise.reject(new Error('offline')) } });
  assert.equal(await service.prepareSelfieWatermarkFont(), 'Arial');
});
await test('font timeout provides bounded mobile/offline fallback', async () => {
  const service = loadService({ fonts: { load: () => new Promise(() => {}) } });
  const start = Date.now();
  assert.equal(await service.prepareSelfieWatermarkFont(), 'Arial');
  assert.ok(Date.now() - start < 2500);
});
await test('font resolver tolerates browsers without FontFaceSet API', async () => {
  const service = loadService({});
  assert.equal(await service.prepareSelfieWatermarkFont(), 'Arial');
});
await test('Open Sans is used after canvas resize for every visible watermark line', () => {
  const fake = fakeCanvasFactory();
  const service = loadService({ createElement: () => fake.makeCanvas() });
  const output = service.stampCheckInSelfie({width: 640, height: 800}, evidence(), 'Open Sans');
  assert.ok(output.startsWith('data:image/jpeg;base64,'));
  const canvas = fake.canvases[0];
  assert.ok(canvas.drawn.length > 6);
  assert.ok(canvas.drawn.every(line => line.font.includes('"Open Sans"')));
  assert.ok(canvas.drawn[0].font.includes('700 '));
  assert.ok(canvas.drawn.slice(1).every(line => line.font.includes('500 ')));
  assert.ok(canvas.drawn.some(line => line.text.includes('GPS:')));
  assert.ok(canvas.drawn.some(line => line.text.includes('ID login:')));
  assert.ok(canvas.drawn.every(line => line.x >= 12 && line.y >= 0));
});
await test('Arial fallback stays sans-serif even after canvas reset', () => {
  const fake = fakeCanvasFactory();
  const service = loadService({ createElement: () => fake.makeCanvas() });
  service.stampCheckInSelfie({ width: 480, height: 640 }, evidence(), 'Arial');
  assert.ok(fake.canvases[0].drawn.every(line => line.font.includes('"Arial", Arial, sans-serif')));
});
await test('text scale is larger, body text wraps and stays within photo width', () => {
  const fake = fakeCanvasFactory();
  const service = loadService({ createElement: () => fake.makeCanvas() });
  service.stampCheckInSelfie({width: 480, height: 640}, { ...evidence(), userName: 'Guru dengan Nama Panjang Penguji Tampilan Watermark Foto Presensi' }, 'Open Sans');
  const canvas = fake.canvases[0];
  const body = canvas.drawn.slice(1);
  assert.ok(body.every(line => parseInt(line.font.match(/(\d+)px/)[1],10) >= 16));
  assert.ok(body.every(line => canvas.context.measureText(line.text).width <= canvas.width));
  assert.ok(canvas.height > 640);
});
await test('GPS freshness and size policy unchanged', () => {
  const service = loadService({});
  assert.equal(service.SELFIE_GPS_MAX_AGE_MS, 30_000);
  assert.equal(service.SAFE_MAX_DATA_URL_LENGTH, 550_000);
  assert.throws(() => service.validateSelfieEvidence({ ...evidence(), capturedAt: Date.now() - 60000 }), /kedaluwarsa/);
});
console.log(`\n${pass}/${pass} R91 font watermark checks passed.`);
