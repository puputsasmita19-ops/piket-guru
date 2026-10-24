const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

const ui = fs.readFileSync('src/features/users/UserManagementView.tsx', 'utf8');
const util = fs.readFileSync('src/utils/paginationUtils.ts', 'utf8');
const checks = [];
function check(name, action) { checks.push([name, action]); }
function matches(name, regex) {check(name, () => assert.match(ui, regex));}

matches('Same pagination component for Guru and Siswa', /\{isGuru \? 'pengguna' : 'siswa'\}/);
matches('Table height fixed while switching pages', /h-\[360px\] sm:h-\[460px\] lg:h-\[500px\]/);
matches('Scroll container ref attached', /ref=\{tableScrollRef\}/);
matches('Scroll resets when page changes', /const goToPage = \(page: number\) => \{[\s\S]*?tableScrollRef\.current\.scrollTop = 0/);
matches('PageSize reset uses shared function', /onClick=\{\(\) => changePageSize\(sz\)\}/);
matches('Stable numbered slots used', /\{pageSlots\.map\(\(pageNum, slot\)/);
matches('Never disappears: empty slots reserve width', /placeholder-\$\{slot\}[\s\S]*?w-8 sm:w-10/);
matches('Accessible page controls', /aria-current=\{validCurrentPage === pageNum \? 'page' : undefined\}/);
matches('A11y list status', /aria-live="polite"/);
matches('Mobile and desktop stable widths', /w-8 sm:w-10 h-9 sm:h-10/);
matches('Prev disabled on first page', /disabled=\{validCurrentPage <= 1\}/);
matches('Next disabled on last page', /disabled=\{validCurrentPage >= totalPages\}/);
matches('Role access unchanged', /const isAdmin = hasRole\('ADMIN'\)/);
matches('Teacher listing uses same filtered data', /const paginatedUsers = pageSize === 0 \? filteredUsers : filteredUsers\.slice/);
matches('Siswa listing uses same filtered data', /const paginatedStudents = pageSize === 0 \? filteredStudents : filteredStudents\.slice/);

const js = util.replace('export function buildStablePagination(currentPage: number, totalPages: number, slotCount = 5): Array<number | null> {', 'function buildStablePagination(currentPage, totalPages, slotCount = 5) {').replace(/Array<null>/g, 'Array');
const build = new Function(js + '\nreturn buildStablePagination;')();
check('3 pages / current 1 -> fixed 5 slots', () => assert.deepEqual(build(1,3),[1,2,3,null,null]));
check('3 pages / current 2 -> same width', () => assert.deepEqual(build(2,3),[1,2,3,null,null]));
check('3 pages / current 3 -> same width', () => assert.deepEqual(build(3,3),[1,2,3,null,null]));
check('1 page always has 5 slots', () => assert.deepEqual(build(1,1),[1,null,null,null,null]));
check('More than 5 pages maintains 5 slots', () => assert.deepEqual(build(6,20),[4,5,6,7,8]));
check('First page window stable', () => assert.deepEqual(build(1,20),[1,2,3,4,5]));
check('Last page window stable', () => assert.deepEqual(build(20,20),[16,17,18,19,20]));
check('Out-of-range page clamped', () => assert.deepEqual(build(999,3),[1,2,3,null,null]));
check('Empty dataset handled', () => assert.deepEqual(build(1,0),[1,null,null,null,null]));
check('Always exactly five slots', () => {for(let pages=1;pages<=100;pages++) for(let curr=1;curr<=pages;curr++)assert.equal(build(curr,pages).length,5);});

let passed = 0;
for(const [name,fn] of checks) {
 try { fn(); console.log('PASS',name); passed++; }
 catch(error) { console.error('FAIL',name,error.message); process.exitCode=1; }
}
console.log(`R54 checks: ${passed}/${checks.length} passed`);
