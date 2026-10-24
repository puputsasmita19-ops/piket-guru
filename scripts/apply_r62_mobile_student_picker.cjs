#!/usr/bin/env node
'use strict';
/** Idempotent R62 installer: only modifies the current StudentTardyFormModal.tsx. */
const fs = require('node:fs');
const path = require('node:path');
const { transform } = require('./r62_mobile_student_picker_transform.cjs');
const relative = 'src/features/student-tardiness/StudentTardyFormModal.tsx';
const cssRelative = 'src/features/student-tardiness/StudentTardyMobileR62.css';
const root = process.cwd();
const dry = process.argv.includes('--dry-run');
try {
  if (!fs.existsSync(path.join(root,'package.json'))) throw new Error('Jalankan dari root repository Piket Guru.');
  if (!fs.existsSync(path.join(root,cssRelative))) throw new Error(`CSS R62 belum ada: ${cssRelative} (ekstrak ZIP ke root repository).`);
  const file=path.join(root,relative);
  if (!fs.existsSync(file)) throw new Error(`Target tidak ditemukan: ${relative}`);
  const original=fs.readFileSync(file,'utf8');
  const patched=transform(original); // all patterns validated BEFORE writing
  if (dry) { console.log('R62 DRY RUN PASSED — cocok; tidak ada source yang diubah.'); process.exit(0); }
  const tmp=`${file}.r62-${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp,patched,{flag:'wx'});
    fs.renameSync(tmp,file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  console.log(`R62 APPLIED — ${relative}; CSS: ${cssRelative}`);
  console.log('Jalankan test_r62_mobile_student_picker.cjs, lint, build sebelum Push.');
} catch (error) {
  console.error(`R62 STOPPED SAFELY: ${error.message}`);
  process.exitCode=1;
}
