const fs = require('fs');

const checks = [
  ['public/icon.svg', 'Ikon modern minimalis aplikasi Piket Guru.'],
  ['src/features/command-center/CommandCenterPreview.tsx', 'Edit Bel & Komando'],
  ['src/features/command-center/CommandCenterPreview.tsx', "setSubView('bell')"],
  ['src/modern-soft.css', '.app-content .quick-action.shortcut-tile {'],
  ['src/components/layout/Header.tsx', '/icon.svg'],
];

let ok = true;
for (const [file, token] of checks) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(token)) {
    console.error(`FAIL: ${file} does not contain ${token}`);
    ok = false;
  } else {
    console.log(`OK: ${file}`);
  }
}

if (!ok) process.exit(1);
console.log('R45 verification passed.');
