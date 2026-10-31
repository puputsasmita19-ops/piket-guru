/**
 * Read-only stability guard for the immutable R112 login + GPS baseline.
 * Usage:
 *   node scripts/verify_baseline_login_gps_r112.mjs --check    # hashes + config, no dependencies
 *   node scripts/verify_baseline_login_gps_r112.mjs             # hashes + 6 focused tests
 *   node scripts/verify_baseline_login_gps_r112.mjs --full      # hashes + 13 regression scripts
 * This cannot measure real Firebase latency or smartphone GNSS speed.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'scripts/baseline_login_gps_r112.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const args=process.argv.slice(2);
if(args.some(arg=>!['--check','--full','--help'].includes(arg))) {
 console.error('Usage: node scripts/verify_baseline_login_gps_r112.mjs [--check | --full]');
 process.exit(2);
}
if(args.includes('--help')) {
 console.log('Default: checksum + 6 tes. --check: checksum + region saja. --full: checksum + 13 tes.');
 process.exit(0);
}
let count=0;const errors=[];
for(const [relative,expected] of Object.entries(manifest.protectedSha256)) {
 const full=path.join(root,relative);
 if(!existsSync(full)){errors.push(`FILE HILANG: ${relative}`);continue;}
 const got=createHash('sha256').update(readFileSync(full)).digest('hex');
 if(got!==expected)errors.push(`BERUBAH: ${relative}`);
 else count++;
}
try {
 const vercel=JSON.parse(readFileSync(path.join(root,'vercel.json'),'utf8'));
 assert.deepEqual(vercel.regions,['sin1']);
 for(const [key,fn] of Object.entries(vercel.functions||{})) {
  assert.ok(!fn.regions || fn.regions.every(region=>region==='sin1'),`Override berbeda pada ${key}`);
 }
 console.log('PASS: Vercel Functions dikonfigurasi sin1 (Firestore location Jakarta dikonfirmasi manual).');
} catch(error){errors.push(`REGION: ${error.message}`);}
console.log(`Checksum baseline R112: ${count}/${Object.keys(manifest.protectedSha256).length} cocok.`);
if(errors.length){
 console.error('\nBASELINE TIDAK COCOK — hentikan deployment sampai perubahan ditinjau:');
 errors.forEach(x=>console.error(' - '+x));
 console.error('Ini tidak membuktikan fitur rusak; file terlindungi berubah terhadap snapshot R112.');
 console.error('Jangan menimpa manifest historis. Jika perubahan disengaja, dokumentasikan dan buat baseline versi baru.');
 process.exit(1);
}
if(args.includes('--check')) {
 console.log('PASS: audit statis baseline selesai; tanpa menjalankan tes perilaku.');
 process.exit(0);
}
const suite=args.includes('--full')?manifest.fullTests:manifest.quickTests;
let ok=0;
for(const script of suite) {
 console.log(`\n▶ ${script}`);
 const child=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,timeout:90000,env:{...process.env,CI:'true'}});
 const output=(child.stdout||'').trim().split('\n');
 if(child.status===0 && !child.error) {
  console.log(output.slice(-2).join('\n'));ok++;
 } else {
  if(child.stdout)console.error(child.stdout.slice(-5000));
  if(child.stderr)console.error(child.stderr.slice(-5000));
  if(child.error)console.error(child.error.message);
  console.error(`FAIL ${script}; exit ${child.status}`);
 }
}
console.log(`\nBaseline R112 regression: ${ok}/${suite.length} skrip PASS.`);
if(ok!==suite.length)process.exit(1);
console.log('PASS: tidak terdeteksi perubahan pada file terlindungi & tes simulasi lokal lulus.');
console.log('Catatan: kecepatan GPS fisik, latensi server produksi, dan Firebase Rules Emulator belum diuji oleh skrip ini.');
