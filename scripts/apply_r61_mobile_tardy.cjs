#!/usr/bin/env node
'use strict';
/** Safe installer: modifies only student tardiness form; refuses unknown R60 source. */
const fs = require('node:fs');
const path = require('node:path');
const { transformTardyForm } = require('./r61_mobile_tardy_transform.cjs');
const target = 'src/features/student-tardiness/StudentTardyFormModal.tsx';
const root = process.cwd();
const dry = process.argv.includes('--dry-run');
try {
  if (!fs.existsSync(path.join(root,'package.json'))) throw Error('Jalankan dari root repository Piket Guru.');
  const file = path.join(root,target);
  if (!fs.existsSync(file)) throw Error(`File target tidak ditemukan: ${target}`);
  const src = fs.readFileSync(file,'utf8');
  const out = transformTardyForm(src);
  if (!out.includes('R61 MOBILE TARDY CARD')) throw Error('Penanda patch R61 tidak ditemukan.');
  if (dry) { console.log('R61 DRY RUN PASSED — file cocok; tidak ada file yang diubah.'); process.exit(0); }
  const tmp = `${file}.r61-${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp,out,{flag:'wx'});
    fs.renameSync(tmp,file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  console.log(`R61 APPLIED — ${target} diperbarui. Jalankan verifikasi dan build sebelum Push.`);
} catch(error) {
  console.error(`R61 STOPPED SAFELY: ${error.message}`);
  process.exitCode=1;
}
