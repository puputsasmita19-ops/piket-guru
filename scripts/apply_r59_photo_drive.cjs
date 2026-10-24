#!/usr/bin/env node
/** Piket Guru R59 — safe incremental installer, run in the repo root.
 * Does not touch rules, profiles, PWA queue, authentication or data.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { transformImage, transformDriveRoutes, transformDriveStore } = require('./r59_transform.cjs');
const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const files = [
  { relative: 'src/components/common/AuthenticatedImage.tsx', transform: transformImage },
  { relative: 'src/server/routes/driveRoutes.ts', transform: transformDriveRoutes },
  { relative: 'src/server/services/driveStore.ts', transform: transformDriveStore },
];
const helper = 'src/server/services/photoUploadValidation.ts';
const helperSrc = path.join(__dirname, 'r59_templates', 'photoUploadValidation.ts');
const sha = x => crypto.createHash('sha256').update(x).digest('hex').slice(0, 12);
function stop(message) { console.error(`R59 STOPPED SAFELY: ${message}`); process.exitCode = 1; }
try {
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(helperSrc)) throw new Error('jalankan dari root repository setelah mengekstrak ZIP.');
  if (fs.existsSync(path.join(root, helper))) throw new Error('modul validasi foto sudah ada. Jangan timpa file lain.');
  // Build all output strings BEFORE editing any existing file.
  const staged = files.map(({ relative, transform }) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) throw new Error(`${relative} tidak ditemukan.`);
    const original = fs.readFileSync(full, 'utf8');
    const updated = transform(original);
    if (!updated.includes('R59_PHOTO_OPTIMIZED')) throw new Error(`penanda perubahan hilang: ${relative}`);
    return { full, relative, original, updated };
  });
  const helperContent = fs.readFileSync(helperSrc);
  if (!helperContent.includes('decodeDrivePhotoUpload')) throw new Error('template validator rusak.');
  staged.push({ full: path.join(root, helper), relative: helper, original: null, updated: helperContent });
  if (dryRun) {
    for (const f of staged) console.log(`R59 DRY RUN OK: ${f.relative} ${f.original === null ? 'NEW' : sha(f.original) + ' -> ' + sha(f.updated)}`);
    console.log('R59 DRY RUN PASSED; tidak ada file yang diubah.');
    process.exit(0);
  }
  const written = [];
  try {
    for (const f of staged) {
      const tmp = `${f.full}.r59-${process.pid}.tmp`;
      fs.mkdirSync(path.dirname(f.full), { recursive: true });
      try { fs.writeFileSync(tmp, f.updated, { flag: 'wx' }); fs.renameSync(tmp, f.full); }
      finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
      written.push(f);
    }
  } catch (err) {
    for (const f of written.reverse()) {
      if (f.original === null) fs.rmSync(f.full, { force: true });
      else fs.writeFileSync(f.full, f.original);
    }
    throw err;
  }
  console.log('R59 APPLIED: 4 source files changed/added. Jalankan verifikasi dan build sebelum Commit/Push.');
  for (const f of staged) console.log('  ', f.relative);
} catch (err) { stop(err.message); }
