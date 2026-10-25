#!/usr/bin/env node
'use strict';
/** R86-E3: fail-closed installer; dry-run by default, modifies main.tsx ONLY. */
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'src/main.tsx');
const moduleFile=path.join(root,'src/services/diagnostics/r86e3PerformanceCapture.ts');
const apply=process.argv.includes('--apply');
function stop(msg){console.error('STOP R86-E3: '+msg+'; source tidak diubah.');process.exit(2);}
if(!fs.existsSync(file)||!fs.existsSync(moduleFile))stop('src/main.tsx atau modul R86-E3 tidak ditemukan');
const original=fs.readFileSync(file,'utf8');
const marker='R86-E3: opt-in local performance comparison';
if(original.includes(marker)){console.log('R86-E3 sudah terpasang; tidak ada perubahan.');process.exit(0);}
for(const tag of ['R86-C: safe listener metrics','R86-D: read-only session-resume and performance validation']){
 if(!original.includes(tag))stop(`dependensi ${tag} tidak ditemukan; sinkronkan source terbaru`);
}
const anchor="createRoot(document.getElementById('root')!).render(<App />);";
if(original.split(anchor).length!==2)stop('anchor React root bukan tepat satu; audit main.tsx secara manual');
const code=`// ${marker} (dev/Preview only). This reads aggregated counters, never Firebase/user data.
if ((import.meta.env.DEV || import.meta.env.VITE_R86E3_COMPARE === 'enabled') &&
    new URLSearchParams(window.location.search).get('r86_e3_compare') === '1') {
  void import('./services/diagnostics/r86e3PerformanceCapture').then(({ startR86E3PerformanceCapture }) => {
    startR86E3PerformanceCapture();
  }).catch(() => { /* Optional instrumentation must never block app login. */ });
}
`;
const updated=original.replace(anchor,anchor+'\n\n'+code);
if(!apply){console.log('DRY RUN R86-E3 PASS: src/main.tsx cocok, tidak ada file diubah.');console.log('Jalankan dengan --apply untuk menambahkan hook diagnostik opsional.');process.exit(0);}
const temp=file+`.r86e3-${process.pid}.tmp`;
try{fs.writeFileSync(temp,updated,'utf8');fs.renameSync(temp,file);console.log('R86-E3 diterapkan ke src/main.tsx; semua alur aplikasi lain tetap utuh.');}
finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
