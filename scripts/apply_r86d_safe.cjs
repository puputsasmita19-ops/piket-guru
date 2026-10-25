#!/usr/bin/env node
'use strict';
/** Fail-closed R86-D installer. Dry-run by default; only edits src/main.tsx. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/main.tsx');
const diagnostic = path.join(root, 'src/services/diagnostics/r86dStabilityProbe.ts');
const applied = process.argv.includes('--apply');
const marker = 'R86-D: read-only session-resume and performance validation';
const fail = msg => { console.error('STOP R86-D: '+msg+'; source tidak diubah.'); process.exit(2); };
if (!fs.existsSync(filename) || !fs.existsSync(diagnostic)) fail('main.tsx atau modul probe tidak tersedia');
let src = fs.readFileSync(filename,'utf8');
if (src.includes(marker)) { console.log('R86-D sudah terpasang; tidak ada perubahan.'); process.exit(0); }
for (const m of ['R86-A: explicit opt-in', 'R86-B: visual-only coordination', 'R86-C: safe listener metrics']) {
  if (!src.includes(m)) fail('R86-A/B/C belum lengkap: '+m);
}
const anchor = "createRoot(document.getElementById('root')!).render(<App />);";
if (src.split(anchor).length !== 2) fail('anchor React root tidak ditemukan/duplikat; perlu audit source terbaru');
const injection = `// ${marker} (staging only). Auth/session/offline queue NOT modified.
if ((import.meta.env.DEV || import.meta.env.VITE_R86_STABILITY_AUDIT === 'enabled') &&
    new URLSearchParams(window.location.search).get('r86_stability_audit') === '1') {
  void import('./services/diagnostics/r86dStabilityProbe').then(({ startR86DStabilityProbe }) => {
    startR86DStabilityProbe();
  }).catch(() => { /* Observation must never block login or app bootstrap. */ });
}
`;
src = src.replace(anchor,anchor+'\n\n'+injection);
if (!applied) {
  console.log('DRY RUN R86-D: anchor cocok; akan menambahkan probe opt-in ke src/main.tsx saja.');
  console.log('Jalankan node scripts/apply_r86d_safe.cjs --apply untuk menerapkan.');
  process.exit(0);
}
const tmp=filename+`.r86d-${process.pid}.tmp`;
try {
  fs.writeFileSync(tmp,src,'utf8');
  fs.renameSync(tmp,filename);
  console.log('R86-D applied to src/main.tsx (opt-in only).');
} finally { if(fs.existsSync(tmp)) fs.unlinkSync(tmp); }
