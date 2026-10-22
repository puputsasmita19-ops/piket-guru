const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const tourFile = 'src/components/guide/InteractiveGuideTour.tsx';
const cssFile = 'src/index.css';
const tour = fs.readFileSync(tourFile, 'utf8');
const css = fs.readFileSync(cssFile, 'utf8');

const out = ts.transpileModule(tour, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
  reportDiagnostics: true,
});
assert.equal((out.diagnostics || []).length, 0, 'InteractiveGuideTour.tsx has transpile diagnostics.');

assert(tour.includes("'[data-tour=\"sync-status\"] button'") || tour.includes('selectors: [\'[data-tour="sync-status"] button\''), 'Sync-status step should target the real header button first.');
assert(tour.includes('[data-tour="attendance-actions"]') && tour.includes('[data-tour="attendance-complete"]'), 'Guru swafoto step should have visible fallback targets.');
assert(tour.includes("data-guide-active-target") && tour.includes("headerTarget ? 8 : region.focusTop"), 'Guide should support active target highlighting and header target focus areas.');
assert(tour.includes('Bagian yang dijelaskan sedang disorot') && tour.includes('Ikon koneksi / antrean di kanan atas header'), 'Guide copy should explicitly tell users what area is being explained.');
assert(css.includes('[data-guide-active-target="true"]') && css.includes('@keyframes guide-target-pulse'), 'CSS should visually pulse the live guide target.');

console.log('OK: verifikasi Panduan Target R25 lulus.');
console.log('- Target di header (ikon koneksi) kini dapat disorot.');
console.log('- Langkah swafoto memiliki target cadangan yang tetap terlihat.');
console.log('- Elemen target diberi sorotan langsung agar pengguna awam mudah mengenali bagian yang dijelaskan.');
