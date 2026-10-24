'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const original=fs.readFileSync(process.argv.find(x=>x.startsWith('--rules='))?.slice(8) || 'public/exports/firestore_rules.txt','utf8');
const installer=path.resolve(__dirname,'prepare_r58_security.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r58-'));
function run(args=[]){return spawnSync(process.execPath,[installer,...args],{cwd:folder,encoding:'utf8'});}
try{
 fs.mkdirSync(path.join(folder,'public/exports'),{recursive:true});
 const rules=path.join(folder,'public/exports/firestore_rules.txt');
 fs.writeFileSync(rules,original);
 let r=run(['--dry-run']);
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DRY RUN PASSED/);
 assert.equal(fs.readFileSync(rules,'utf8'),original);
 assert.equal(fs.existsSync(path.join(folder,'security-review/r58')),false);
 console.log('PASS: dry-run has no writes');
 r=run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/CANDIDATE GENERATED/);
 const candidate=path.join(folder,'security-review/r58/firestore_rules_R58_CANDIDATE.txt');
 assert(fs.existsSync(candidate));assert.equal(fs.readFileSync(rules,'utf8'),original);
 console.log('PASS: candidate generated; original unchanged');
 r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/candidate already exists/i);
 console.log('PASS: existing candidate not overwritten');
 fs.rmSync(candidate);
 fs.writeFileSync(rules,original.replace('allow create, update: if isStaff();','allow create, update: if false;'));
 r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/STOPPED SAFELY/);
 assert.equal(fs.existsSync(candidate),false);
 console.log('PASS: source mismatch fails closed without candidate');
 fs.writeFileSync(rules,original);
 r=run(['--rules=../../etc/passwd']);assert.notEqual(r.status,0);assert.match(r.stderr,/STOPPED SAFELY/);
 console.log('PASS: rejects path escape');
 console.log('R58 installer tests: 5/5 passed');
}finally{fs.rmSync(folder,{recursive:true,force:true})}
