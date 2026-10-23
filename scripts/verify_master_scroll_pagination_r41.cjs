const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
let ts;
try { ts = require('typescript'); } catch {
  const { execFileSync } = require('node:child_process');
  const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  ts = require(path.join(root, 'typescript'));
}

const sources = [
  'src/features/master/MasterDataTabs.tsx',
  'src/features/users/UserManagementView.tsx',
  'src/utils/paginationUtils.ts',
];
for (const f of sources) {
  const output = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
    fileName: f,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  assert.equal((output.diagnostics || []).length, 0, `Sintaks bermasalah di ${f}`);
}
const master = fs.readFileSync(sources[0], 'utf8');
const users = fs.readFileSync(sources[1], 'utf8');
const utils = fs.readFileSync(sources[2], 'utf8');
assert.equal((master.match(/ref=\{recordsScrollRef\}/g) || []).length, 3, 'Daftar Guru, Tendik, Siswa harus memiliki scroll');
assert(master.includes('max-h-[min(62vh,620px)]') && master.includes('overflow-y-auto'), 'Daftar harus memiliki scroll vertikal terbatas');
assert(master.includes('recordsScrollRef.current.scrollTop = 0'), 'Scroll harus kembali ke awal saat filter/tab berubah');
assert(users.includes('h-[clamp(320px,60vh,560px)]'), 'Tinggi tabel harus tetap saat berpindah halaman');
assert(users.includes('buildStablePagination(validCurrentPage, totalPages)'), 'Tombol halaman harus memakai window stabil');
assert(users.includes('goToPage(') && users.includes('tableScrollRef.current.scrollTop = 0'), 'Navigasi halaman harus mereset scroll tabel');
assert(users.includes('aria-current={validCurrentPage === pageNum'), 'Halaman aktif harus terbaca oleh pembaca layar');
assert(users.includes('changePageSize(sz)') && users.includes('setCurrentPage(1)'), 'Ukuran halaman mereset halaman aktif');

const transpiled = ts.transpileModule(utils, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', transpiled)(mod, mod.exports);
const f = mod.exports.buildStablePagination;
assert.equal(typeof f, 'function');
const scenarios = [[1,1], [1,3], [1,20], [2,20], [10,20], [20,20], [25,100], [500,100], [0,3], [3,0]];
for (const [page, count] of scenarios) {
  const slots = f(page, count);
  assert.equal(slots.length, 5, `Jumlah tombol bergeser pada halaman ${page} / ${count}`);
  const active = Math.max(1, Math.min(Math.max(count, 1), page));
  assert(slots.includes(active), 'Halaman aktif harus ada di window');
  const nums = slots.filter(x => x !== null);
  assert.deepEqual(nums, [...nums].sort((a,b)=>a-b));
  for (const n of nums) assert(n >= 1 && n <= Math.max(count,1));
}
console.log('OK R41: sintaks 3 file, scroll 3 daftar, pagination 10 skenario, dan aksesibilitas lolos.');
