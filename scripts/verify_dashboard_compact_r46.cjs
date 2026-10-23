const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const main = read('src/main.tsx');
const css = read('src/dashboard-compact-r46.css');
assert(main.includes("import './dashboard-compact-r46.css';"), 'Import CSS R46 harus ada');
assert(main.indexOf("import './dashboard-compact-r46.css';") > main.indexOf("import './modern-soft.css';"), 'CSS harus dimuat setelah Modern Soft R42');
for (const token of ['.shortcut-grid', 'button.quick-action.shortcut-tile', '.flash-slide', '.flash-content','(max-width: 639px)', '(min-width: 1200px)', 'prefers-reduced-motion']) {
 assert(css.includes(token), `Aturan R46 belum ada: ${token}`);
}
if (fs.existsSync('src/features/dashboard/QuickActions.tsx')) {
 const source = read('src/features/dashboard/QuickActions.tsx');
 assert(source.includes('className="quick-action shortcut-tile"'), 'Markup shortcut berbeda dari target CSS; hentikan pemasangan dan laporkan.');
}
if (fs.existsSync('src/features/dashboard/DashboardFlashInfo.tsx')) {
 const source = read('src/features/dashboard/DashboardFlashInfo.tsx');
 assert(source.includes('className="dashboard-flash"') || source.includes('className={`flash-slide'), 'Markup flash berbeda dari target CSS');
}
console.log('PASS: R46 CSS imported, responsive selectors present, markup compatible if source available.');
