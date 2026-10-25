#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const installer=fs.readFileSync(path.join(__dirname,'apply_r86d_safe.cjs'),'utf8');
const original='import App from \'./App.tsx\';\n// R86-A: explicit opt-in diagnostic build AND URL flag\n// R86-B: visual-only coordination\n// R86-C: safe listener metrics\ncreateRoot(document.getElementById(\'root\')!).render(<App />);\n';
let passed=0;
const tests=[];
function add(n,fn){tests.push([n,fn]);}
function create(main=original,withDiag=true){const root=fs.mkdtempSync(path.join(os.tmpdir(),'r86d-install-'));fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'src/services/diagnostics'),{recursive:true});fs.writeFileSync(path.join(root,'scripts/apply_r86d_safe.cjs'),installer);fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.writeFileSync(path.join(root,'src/main.tsx'),main);if(withDiag)fs.writeFileSync(path.join(root,'src/services/diagnostics/r86dStabilityProbe.ts'),'// probe');return root;}
function run(root,flag){return cp.spawnSync(process.execPath,['scripts/apply_r86d_safe.cjs',...(flag?[flag]:[])],{cwd:root,encoding:'utf8'});}
function withRepo(main,withDiag,fn){const root=create(main,withDiag);try{fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
add('Dry-run is zero-write',()=>withRepo(original,true,root=>{const before=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');const r=run(root);assert.equal(r.status,0);assert.equal(fs.readFileSync(path.join(root,'src/main.tsx'),'utf8'),before);}));
add('Apply changes one file only',()=>withRepo(original,true,root=>{const r=run(root,'--apply');assert.equal(r.status,0,r.stderr);const src=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');assert.match(src,/r86_stability_audit/);assert.match(src,/createRoot/);}));
add('Apply is idempotent',()=>withRepo(original,true,root=>{assert.equal(run(root,'--apply').status,0);const after=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');assert.equal(run(root,'--apply').status,0);assert.equal(fs.readFileSync(path.join(root,'src/main.tsx'),'utf8'),after);}));
add('Reject baseline without R86-C',()=>withRepo(original.replace('// R86-C: safe listener metrics\n',''),true,root=>{const before=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');assert.equal(run(root,'--apply').status,2);assert.equal(fs.readFileSync(path.join(root,'src/main.tsx'),'utf8'),before);}));
add('Reject changed React mount signature',()=>withRepo(original.replace("createRoot(document.getElementById('root')!).render(<App />);","createRoot(document.getElementById('root')!).render(<OtherApp />);"),true,root=>{assert.equal(run(root,'--apply').status,2);}));
add('Reject duplicated root mount anchor',()=>withRepo(original+"\ncreateRoot(document.getElementById('root')!).render(<App />);\n",true,root=>{assert.equal(run(root,'--apply').status,2);}));
add('Reject absent probe module',()=>withRepo(original,false,root=>{assert.equal(run(root,'--apply').status,2);}));
for(const [name,fn] of tests){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
console.log(`R86-D installer: ${passed}/${tests.length} PASS`);
