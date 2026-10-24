const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p), 'utf8');
const sidebar = read('src/components/layout/Sidebar.tsx');
const dashboard = read('src/features/dashboard/DashboardView.tsx');
const css = read('src/dashboard-compact-r46.css');
const tests = [
  ['logo duplikat tidak dirender di sidebar', () => assert.ok(!sidebar.includes('Navigasi Sekolah') && !sidebar.includes('<img src="/icon.svg"'))],
  ['header navigasi tetap ada', () => assert.match(sidebar, /Sidebar Controls Header[\s\S]+?Navigasi/)],
  ['menu sidebar tetap berdasarkan hak akses', () => assert.match(sidebar, /hasPermission\(item\.permission\)/)],
  ['pencarian menu tetap ada', () => assert.match(sidebar, /value=\{menuSearch\}/)],
  ['tombol tutup mobile tetap ada', () => assert.match(sidebar, /aria-label="Tutup panel navigasi"/)],
  ['tombol sematkan desktop tetap ada', () => assert.match(sidebar, /onClick=\{onTogglePin\}/)],
  ['ikon dashboard baru adalah grid', () => assert.match(dashboard, /myTodaySchedule \? Calendar : LayoutDashboard/)],
  ['ilustrasi baru tidak memakai kertas miring', () => assert.ok(!dashboard.includes('<FeatureIllustration'))],
  ['tombol rincian tugas tetap ada', () => assert.match(dashboard, /onAction: showDutyDetails \? toggleDutyDetails : revealDutyDetails/)],
  ['ikon beradaptasi dengan warna tema', () => assert.match(css, /dashboard-activity-mark[\s\S]+?--theme-primary-light/)],
  ['ukuran ikon desktop 56px', () => assert.match(css, /width: 56px;[\s\S]+?height: 56px;/)],
  ['ukuran ikon mobile 46px', () => assert.match(css, /max-width: 639px[\s\S]+?dashboard-activity-mark[\s\S]+?width: 46px;/)],
];
let passed=0;
for (const [name, fn] of tests) {
  try {fn(); passed++; console.log(`PASS ${name}`);}
  catch(e) {console.error(`FAIL ${name}: ${e.message}`);}
}
console.log(`${passed}/${tests.length} R49 checks passed`);
if (passed!==tests.length) process.exit(1);
