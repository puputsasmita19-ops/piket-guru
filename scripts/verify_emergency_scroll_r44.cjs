const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const file = 'src/features/settings/CommandCenterSettingsCard.tsx';
const source = fs.readFileSync(file, 'utf8');
const document = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tests = [];
const test = (title, fn) => { fn(); tests.push(title); console.log(`OK ${tests.length}. ${title}`); };

test('File TSX terbaca tanpa error sintaks', () => {
  assert.equal(document.parseDiagnostics.length, 0);
  const result = ts.transpileModule(source, { fileName: file, compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
  }, reportDiagnostics: true });
  assert.equal(result.diagnostics?.length || 0, 0);
});
const barStart = source.indexOf('data-emergency-save-bar');
const bar = source.slice(barStart, source.indexOf('</div>\n      </>}', barStart));
test('Hanya ada satu panel Simpan Perubahan', () => {
  assert.equal(source.split('data-emergency-save-bar').length - 1, 1);
  assert.equal(source.split("'Simpan Perubahan'}</Button>").length - 1, 1);
});
test('Panel simpan berada di akhir formulir setelah semua kategori', () => {
  assert(barStart > source.indexOf("{tab === 'command'"));
  assert(barStart > source.indexOf("{tab === 'schedule'"));
  assert(barStart > source.indexOf("{tab === 'additional'"));
  assert(barStart > source.indexOf("{tab === 'contacts'"));
  assert(barStart > source.indexOf('role={message.error'));
});
test('Panel simpan tidak menempel viewport atau menutupi formulir', () => {
  assert(!/\bsticky\b|\bfixed\b|\babsolute\b|backdrop-blur|\bz-[0-9]/.test(bar.match(/className="([^"]+)"/)?.[1] || ''));
  assert(bar.includes('relative w-full min-w-0 border-t'));
});
test('Panel tombol beradaptasi mobile dan desktop', () => {
  assert(bar.includes('flex-col sm:flex-row'));
  assert(bar.includes('w-full sm:w-auto'));
  assert(bar.includes('flex-1 sm:flex-none'));
});
test('Status simpan menjelaskan perubahan dan memakai aria-live', () => {
  assert(bar.includes('dirty ?'));
  assert(bar.includes('role="status" aria-live="polite"'));
  assert(bar.includes('Menyimpan pengaturan ke Firebase'));
});
test('Batal, proteksi perubahan, validasi dan akses Admin masih dijaga', () => {
  for (const snippet of ['onClick={cancel}', 'onClick={save}', 'disabled={saving || !dirty}',
    "if (!admin || !currentUser || saving) return", 'window.confirm(', 'validateCommandCenterConfig(draft)']) {
    assert(source.includes(snippet), `Hilang: ${snippet}`);
  }
});
test('Penyimpanan Firebase dan konflik perubahan tetap dipakai', () => {
  assert(source.includes('SchoolSettingsService.saveCommandCenterConfig(draft, currentUser.id, original)'));
  assert(source.includes('onUpdated(result.settings)'));
});
test('Navigasi dari Pusat Komando tidak dianimasikan melawan sticky header', () => {
  assert(source.includes("scrollIntoView({ behavior: 'auto', block: 'start' })"));
  assert(!source.includes("scrollIntoView({ behavior: 'smooth'"));
});
test('Tidak ada tindakan sirene/siaran di editor pengaturan', () => {
  assert(!source.includes('EmergencyService.triggerEmergency('));
  assert(!source.includes('triggerEmergency('));
});
console.log(`LULUS ${tests.length}/${tests.length} pemeriksaan R44`);
