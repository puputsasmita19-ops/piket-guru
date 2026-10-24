'use strict';
/** Static safeguards for a candidate Rules transform; does NOT replace emulator tests. */
const fs = require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {transform,MARKER}=require('./r58_security_transform.cjs');
const root=process.cwd();
const file=process.argv.find(arg=>arg.startsWith('--rules='))?.slice(8) || 'public/exports/firestore_rules.txt';
if(!fs.existsSync(file)){console.error(`FAIL_CLOSED: ${file} missing; run from repository root or pass --rules=<path>`);process.exit(2)}
const source=fs.readFileSync(file,'utf8');
let checks=0;
function test(name,fn){fn();console.log('PASS',++checks,name)}
const result=transform(source);
test('Only candidate changed; original object remains unchanged',()=>assert.equal(fs.readFileSync(file,'utf8'),source));
test('R58 marker present',()=>assert.ok(result.includes(MARKER)));
test('Single audit create writer rule',()=>assert.match(result,/request.resource.data.userId == request.auth.uid &&\s*request.resource.data.role == userRole\(\)/));
test('Audit events bind ID and timestamp shape',()=>assert.match(result,/request.resource.data.id == logId/));
test('Audit immutable',()=>assert.match(result,/match \/auditLogs\/\{logId\} \{[\s\S]*?allow update, delete: if false;/));
for(const collection of ['substitutions','studentTardiness','studentPermits','visitors']){
 const block=result.split(`match /${collection}/`)[1].split('\n    match /')[0];
 test(`${collection}: create bound to current staff`,()=>assert.match(block,/request.resource.data.petugasPiketId == request.auth.uid/));
 test(`${collection}: owner can edit but another teacher cannot`,()=>assert.match(block,/resource.data.petugasPiketId == request.auth.uid/));
 test(`${collection}: immutable owner and create metadata`,()=>assert.match(block,/request.resource.data.petugasPiketId == resource.data.petugasPiketId[\s\S]*?'createdAt'/));
 test(`${collection}: delete Admin only`,()=>assert.match(block,/allow delete: if isAdmin\(\);/));
}
test('Tardiness Admin correction fields still restricted',()=>assert.match(result,/match \/studentTardiness[\s\S]*?'adminCorrection', 'menitTerlambatAsli'/));
test('Dutybook approver cannot edit body',()=>assert.match(result,/hasDutyBookApprovePerm\(\) &&[\s\S]*?'catatanPiket'/));
test('Idempotence: second transform fails safely',()=>assert.throws(()=>transform(result),/already patched/));
test('Unknown substitutions rules reject safely',()=>assert.throws(()=>transform(source.replace('allow create, update: if isStaff();','allow create, update: if false;')),/STOPPED SAFELY/));
test('Unknown auditor rules reject safely',()=>assert.throws(()=>transform(source.replace('match \/auditLogs\/{logId}', 'match \/auditLogs\/{otherId}')),/STOPPED SAFELY/));
console.log(`R58 static validation: ${checks} checks passed; production NOT verified.`);
