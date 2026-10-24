#!/usr/bin/env node
/** Safe R57 installer: append an opt-in PWA safety check to the real R53+ banner.
 * Run in YOUR repository root; never substitutes an older Login/Sync source.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const bannerRel = 'src/components/layout/AppUpdateBanner.tsx';
const helperRel = 'src/services/offline/pwaUpdateSafety.ts';
const marker = 'R57-PWA-SAFETY-GATE';
const safe = relative => {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw Error('Path tidak aman');
  return absolute;
};
const requireExactly = (source, needle, label) => {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw Error(`R57 STOPPED SAFELY: ${label} ditemukan ${count} kali; source berbeda dari alur R53. Tidak ada file yang diubah.`);
};
function main() {
  const bannerFile = safe(bannerRel);
  const helperFile = safe(helperRel);
  const helperTemplate = path.resolve(__dirname, 'r57_templates/pwaUpdateSafety.ts.template');
  const syncFile = safe('src/services/offline/syncQueueService.ts');
  const draftFile = safe('src/services/offline/draftService.ts');
  const storageFile = safe('src/services/offline/offlineStorage.ts');
  const authFile = safe('src/services/firebase/firebaseAuth.ts');
  const needed = [bannerFile,helperTemplate,syncFile,draftFile,storageFile,authFile];
  for(const file of needed) if(!fs.existsSync(file)) throw Error(`R57 STOPPED SAFELY: berkas tidak ditemukan: ${path.relative(root,file)}.`);

  const banner = fs.readFileSync(bannerFile,'utf8');
  if (banner.includes(marker) || (fs.existsSync(helperFile) && fs.readFileSync(helperFile,'utf8').includes('R57 — Gate'))) {
    throw Error('R57 STOPPED SAFELY: pembaruan sudah tampak terpasang. Tidak melakukan perubahan kedua.');
  }
  // Verify the existing PWA updater accepts an async progress callback. A slow
  // outdated build must not be patched optimistically.
  const apply = '      await AppUpdateManager.applyUpdate(setStage);';
  const existingImport = "import { AppUpdateManager, type UpdateStage } from '../../services/offline/appUpdateManager';";
  requireExactly(banner, apply, 'pemanggilan update R53');
  requireExactly(banner, existingImport, 'impor manager R53');
  if(!banner.includes('updatingRef.current')) throw Error('R57 STOPPED SAFELY: deduplikasi tombol R53 tidak ditemukan.');
  const draft = fs.readFileSync(draftFile,'utf8');
  const storage = fs.readFileSync(storageFile,'utf8');
  const sync = fs.readFileSync(syncFile,'utf8');
  for(const [body, needle, label] of [
    [draft,'flushPending(', 'flush draf'],
    [storage,'getPendingCount(', 'pemeriksaan antrean + draf'],
    [storage,'getSyncItemsByUser(', 'isolasi antrean pengguna'],
    [storage,'isTrustedDevice()', 'mode perangkat'],
    [sync,'submissionFingerprint', 'idempotensi antrean'],
    [sync,'syncLease(', 'kunci sinkronisasi'],
  ]) if (!body.includes(needle)) throw Error(`R57 STOPPED SAFELY: ${label} tidak ditemukan.`);

  const importSafety = `import { ensurePwaUpdateSafe } from '../../services/offline/pwaUpdateSafety'; // ${marker}`;
  const replacement = `      // ${marker}: preserve drafts/queue before a user-requested PWA reload.\n      await ensurePwaUpdateSafe();\n` + apply;
  const updatedBanner = banner.replace(existingImport, existingImport+'\n'+importSafety).replace(apply, replacement);
  const helper = fs.readFileSync(helperTemplate, 'utf8');
  if (!helper.includes('export async function ensurePwaUpdateSafe()')) throw Error('Invalid R57 helper.');

  if (dryRun) {
    console.log('R57 DRY RUN PASSED — source kompatibel. Dua file akan diubah/ditambahkan:');
    console.log(`  MODIFY ${bannerRel}\n  CREATE ${helperRel}`);
    return;
  }
  if(fs.existsSync(helperFile)) throw Error('R57 STOPPED SAFELY: helper sudah ada (tidak akan ditimpa).');
  const staged = [];
  try {
    for(const [target, content] of [[bannerFile,updatedBanner],[helperFile,helper]]) {
      const temporary = `${target}.r57-${process.pid}.tmp`;
      fs.writeFileSync(temporary,content,'utf8');
      staged.push({target,temporary,original:fs.existsSync(target) ? fs.readFileSync(target,'utf8') : null});
    }
    for (const entry of staged) fs.renameSync(entry.temporary,entry.target);
    console.log('R57 APPLIED — PWA reload guard terpasang. Jalankan verify lalu npm run lint dan npm run build.');
  } catch(error) {
    // Restore any renamed file. Safe install must not leave half-applied work.
    for (const entry of staged) {
      if (fs.existsSync(entry.temporary)) fs.rmSync(entry.temporary,{force:true});
      if (entry.original === null) fs.rmSync(entry.target,{force:true});
      else fs.writeFileSync(entry.target,entry.original,'utf8');
    }
    throw error;
  }
}
try{main();}catch(error){console.error(error.message);process.exitCode=1;}
