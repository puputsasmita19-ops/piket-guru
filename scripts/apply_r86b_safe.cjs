#!/usr/bin/env node
'use strict';
/** R86-B safe installer: requires R86-A bootstrap and only inserts opt-in code. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const main=path.join(root,'src/main.tsx');
const modulePath=path.join(root,'src/services/multitab/r86bSafeTabCoordination.ts');
const cssPath=path.join(root,'src/services/multitab/r86bDecorative.css');
const marker='R86-B: visual-only coordination, staging opt-in';
const anchor="createRoot(document.getElementById('root')!).render(<App />);";
const patch=`\n\n// ${marker}; no authority over data or other tabs.\n`+
`// Requires BOTH a DEV/Preview environment and an explicit URL test flag.\n`+
`if ((import.meta.env.DEV || import.meta.env.VITE_R86_TAB_OPT === 'enabled') &&\n`+
`    new URLSearchParams(window.location.search).get('r86_tab_opt') === '1') {\n`+
`  void import('./services/multitab/r86bSafeTabCoordination').then(({ startR86BSafeTabCoordination }) => {\n`+
`    startR86BSafeTabCoordination();\n`+
`  }).catch(() => { /* visual-only feature must not block app bootstrap */ });\n`+
`}\n`;
function stop(msg){console.error('STOP: '+msg+'; tidak ada file diubah.');process.exit(2)}
if(!fs.existsSync(main))stop('src/main.tsx tidak ditemukan');
if(!fs.existsSync(modulePath)||!fs.existsSync(cssPath))stop('file modul R86-B belum tersedia');
const source=fs.readFileSync(main,'utf8');
if(source.includes(marker)){console.log('R86-B sudah terpasang; tidak mengubah file lagi.');process.exit(0)}
if(!source.includes('R86-A: explicit opt-in diagnostic build AND URL flag'))stop('R86-A belum terdeteksi di main.tsx');
if(source.split(anchor).length!==2)stop('struktur bootstrap tidak cocok; audit manual di Cursor');
if(!process.argv.includes('--apply')){console.log('DRY RUN: R86-B siap disisipkan ke main.tsx dengan aman. Gunakan --apply untuk menulis.');process.exit(0)}
const output=source.replace(anchor,anchor+patch);
const tmp=main+'.r86b-'+process.pid+'.tmp';
try{fs.writeFileSync(tmp,output,'utf8');fs.renameSync(tmp,main);console.log('R86-B ditambahkan hanya sebagai opt-in ke src/main.tsx.');}
finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
