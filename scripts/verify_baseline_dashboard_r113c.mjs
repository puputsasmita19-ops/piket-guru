/** Immutable R113-C Dashboard baseline, layered on existing R112 login/GPS baseline. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(path.join(root,'scripts/baseline_dashboard_r113c.json'),'utf8'));
const failures=[];
let passed=0;
for(const [rel,checksum] of Object.entries(manifest.protectedSha256)) {
 const full=path.join(root,rel);
 if(!existsSync(full)){failures.push('Berkas hilang: '+rel);continue;}
 const actual=createHash('sha256').update(readFileSync(full)).digest('hex');
 if(actual!==checksum)failures.push('Berubah: '+rel);else passed++;
}
console.log(`Baseline Dashboard R113-C: ${passed}/${Object.keys(manifest.protectedSha256).length} checksum cocok`);
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
if(process.argv.includes('--check'))process.exit(0);
let ok=0;
for(const script of manifest.tests) {
 const test=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
 if(test.status===0){ok++;console.log('PASS',script)}else{console.error('FAIL',script,(test.stderr||test.stdout||'').slice(-1000))}
}
console.log(`Dashboard R113-C regression: ${ok}/${manifest.tests.length}`);
if(ok!==manifest.tests.length)process.exit(1);
