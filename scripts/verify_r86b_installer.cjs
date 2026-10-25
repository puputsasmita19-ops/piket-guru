#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const installer=path.join(__dirname,'apply_r86b_safe.cjs');
const project=fs.mkdtempSync(path.join(os.tmpdir(),'r86b-safe-install-'));
const app=path.join(project,'src/main.tsx');
const srcRoot=path.join(project,'src/services/multitab');
const marker='R86-A: explicit opt-in diagnostic build AND URL flag';
const base=`import {createRoot} from 'react-dom/client';\nimport App from './App.tsx';\ncreateRoot(document.getElementById('root')!).render(<App />);\n// ${marker}\n`;
let count=0;
const check=(name,test)=>{test();count++;console.log('PASS',name)};
function run(flag){return spawnSync(process.execPath,[path.join(project,'scripts/apply_r86b_safe.cjs'),...(flag?[flag]:[])],{encoding:'utf8'})}
try{
 fs.mkdirSync(path.dirname(app),{recursive:true});fs.mkdirSync(srcRoot,{recursive:true});
 fs.mkdirSync(path.join(project,'scripts'),{recursive:true});
 fs.copyFileSync(installer,path.join(project,'scripts/apply_r86b_safe.cjs'));
 for(const name of ['r86bSafeTabCoordination.ts','r86bDecorative.css'])fs.copyFileSync(path.join(__dirname,'../src/services/multitab',name),path.join(srcRoot,name));
 fs.writeFileSync(app,base);
 check('Dry run makes no changes',()=>{const r=run();assert.equal(r.status,0);assert.equal(fs.readFileSync(app,'utf8'),base)});
 check('Apply adds only an opt-in hook',()=>{const r=run('--apply');assert.equal(r.status,0,r.stderr);const s=fs.readFileSync(app,'utf8');assert.match(s,/VITE_R86_TAB_OPT === 'enabled'/);assert.match(s,/get\('r86_tab_opt'\) === '1'/);assert.match(s,/startR86BSafeTabCoordination/);assert.ok(s.startsWith(base.split('createRoot')[0]))});
 check('Applying twice is idempotent',()=>{const a=fs.readFileSync(app,'utf8');const r=run('--apply');assert.equal(r.status,0);assert.equal(fs.readFileSync(app,'utf8'),a)});
 check('R86-A absence stops safely',()=>{fs.writeFileSync(app,base.replace(marker,'other diagnostic'));const before=fs.readFileSync(app,'utf8');const r=run('--apply');assert.equal(r.status,2);assert.equal(fs.readFileSync(app,'utf8'),before)});
 check('Unknown bootstrap pattern is rejected safely',()=>{fs.writeFileSync(app,base.replace("createRoot(document.getElementById('root')!).render(<App />);",'somethingElse();'));const before=fs.readFileSync(app,'utf8');const r=run('--apply');assert.equal(r.status,2);assert.equal(fs.readFileSync(app,'utf8'),before)});
} finally {fs.rmSync(project,{recursive:true,force:true})}
console.log(`R86-B safe installer: ${count}/${count} PASS`);
