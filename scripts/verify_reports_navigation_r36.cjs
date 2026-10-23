const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const file = 'src/features/reports/ReportsPreview.tsx';
const source = fs.readFileSync(file, 'utf8');
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length, 0, 'ReportsPreview.tsx contains TSX parsing errors.');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
assert.equal((compiled.diagnostics || []).length, 0, 'ReportsPreview.tsx transpile diagnostics detected.');

const checks = [
  ['Dua mode eksplisit', source.includes('Mode tampilan laporan') && source.includes('Laporan Data</span>') && source.includes('Rekap Foto</span>')],
  ['Kembali ke kategori laporan terakhir', source.includes('lastDataTab') && source.includes('onClick={() => selectDataTab(lastDataTab)}')],
  ['7 kategori data disajikan secara grid', source.includes('grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4') && source.includes('7 kategori')],
  ['Tombol kategori dapat dipilih dan dapat diakses keyboard', source.includes('aria-pressed={selected}') && source.includes("selectDataTab(tab.id as Exclude<ReportTab, 'photoRecap'>)")],
  ['Tab foto tidak lagi diduplikasi di kategori', !source.includes("{ id: 'photoRecap', label: 'Rekap Foto', icon:")],
  ['Dropdown navigasi mobile ganda dihapus', !source.includes('quick-report-tab-select')],
  ['Mode foto dan filter arsip terpisah', source.includes("activeTab === 'photoRecap'") && source.includes('Filter Modul Dokumentasi')],
  ['Filter modul foto grid responsif', source.includes('grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5')],
  ['Pratinjau foto wajib ada pilihan foto', source.includes('disabled={selectedPhotosList.length === 0}')],
  ['Fitur PDF laporan tetap ada', source.includes('setIsReportActionsOpen(true)') && source.includes('handleExportActiveDocument')],
  ['Filter periode tetap mendukung semua variasi', ['weekly','monthly','semester','yearly','custom'].every(v => source.includes(`<option value="${v}">`))],
  ['Isi tab Presensi dan Insiden tetap ada', source.includes("activeTab === 'attendance'") && source.includes("activeTab === 'incidents'")],
  ['Fitur foto Google Drive R35 tetap ada', source.includes('moveVisitorPhotoFromReport') && source.includes('migrateLegacyPhotoToDrive')],
  ['Foto memiliki navigasi dan filter lama', source.includes('handleSelectAllFiltered') && source.includes('photoModuleFilter')],
  ['Indikator modul yang ditampilkan tersedia', source.includes('Menampilkan:') && source.includes('Di HP, tabel lebar dapat digeser ke samping.')],
];

for (const [name, valid] of checks) assert.ok(valid, `GAGAL: ${name}`);
console.log(`LULUS: ${checks.length} pemeriksaan statis laporan R36 + sintaks TSX.`);
for (const [name] of checks) console.log(`  ✓ ${name}`);
console.log('CATATAN: Ini bukan pengganti npm run lint/build atau pengujian HP/Vercel.');
