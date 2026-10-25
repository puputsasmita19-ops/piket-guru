#!/usr/bin/env node
'use strict';
/**
 * R86-A safe incremental integration. Does NOT replace src/main.tsx with an
 * archived version. Only appends the opt-in import after the bootstrap anchor.
 * Default is read-only; explicit --apply required for mutation.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/main.tsx');
const anchor = "createRoot(document.getElementById('root')!).render(<App />);";
const marker = 'R86-A: explicit opt-in diagnostic build AND URL flag';
const addition = `\n\n// ${marker}. Production defaults OFF.\n` +
`// No Firebase, user identity, offline queue or drafts are read by this tool.\n` +
`if ((import.meta.env.DEV || import.meta.env.VITE_R86_AUDIT === 'enabled') &&\n` +
`    new URLSearchParams(window.location.search).get('r86_audit') === '1') {\n` +
`  void import('./services/diagnostics/r86TabAudit').then(({ startR86TabAudit }) => {\n` +
`    startR86TabAudit();\n` +
`  }).catch(() => { /* Diagnostic must never block app bootstrap. */ });\n` +
`}\n`;
if (!fs.existsSync(file)) { console.error('STOP: src/main.tsx tidak ditemukan; tidak ada file diubah.'); process.exit(2); }
const original = fs.readFileSync(file, 'utf8');
if (original.includes(marker)) { console.log('R86-A sudah terpasang pada main.tsx; tidak ada perubahan.'); process.exit(0); }
if (original.split(anchor).length !== 2) {
  console.error('STOP: Bootstrap main.tsx tidak sesuai pola audit. Jangan timpa file terbaru dengan versi arsip. Tinjau manual di Cursor.');
  process.exit(2);
}
if (!fs.existsSync(path.join(root,'src/services/diagnostics/r86TabAudit.ts'))) {
  console.error('STOP: modul R86-A belum disalin; tidak ada file diubah.'); process.exit(2);
}
if (!process.argv.includes('--apply')) { console.log('DRY RUN: R86-A dapat diterapkan tanpa menimpa main.tsx. Gunakan --apply untuk menyisipkan hook.'); process.exit(0); }
const updated = original.replace(anchor,anchor+addition);
const temporary = file + '.r86a-tmp-' + process.pid;
try {
  fs.writeFileSync(temporary,updated,'utf8');
  fs.renameSync(temporary,file);
  console.log('R86-A audit hook berhasil disisipkan, perubahan satu blok pada src/main.tsx.');
} finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
