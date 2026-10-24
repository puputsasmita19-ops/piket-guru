/**
 * R58: Run ONLY against Firebase emulator, NEVER live Firestore.
 * node scripts/prepare_r58_security.cjs
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/test_r58_rules_emulator.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,getDoc} from 'firebase/firestore';

const hostString=process.env.FIRESTORE_EMULATOR_HOST;
if(!hostString || !/^(localhost|127\.0\.0\.1):(\d{2,5})$/.test(hostString)) {
 console.error('FAIL_CLOSED: FIRESTORE_EMULATOR_HOST must be localhost:port; never use production.');process.exit(2);
}
const [host,portString]=hostString.split(':');
const file='security-review/r58/firestore_rules_R58_CANDIDATE.txt';
if(!fs.existsSync(file)){console.error('FAIL_CLOSED: generate candidate with prepare_r58_security.cjs before testing.');process.exit(2)}
const rules=fs.readFileSync(file,'utf8');
if(!rules.includes('R58 OWNERSHIP/INTEGRITY HARDENING'))throw Error('Candidate marker not present');
const env=await initializeTestEnvironment({
 projectId:'demo-piket-guru-r58',
 firestore:{host,port:Number(portString),rules},
});
const now='2026-10-24T09:00:00.000Z';
let successes=0;
const test=async(name,operation,allowed)=>{
  if(allowed) await assertSucceeds(operation()); else await assertFails(operation());
  console.log(`PASS ${++successes}. ${name}: ${allowed?'allowed':'denied'}`);
};
const seed=async()=>env.withSecurityRulesDisabled(async ctx=>{
 const db=ctx.firestore();
 for(const [id,role,active,perms] of [
  ['admin-r58','ADMIN',true,['*']],
  ['guru-a','GURU',true,['dutyBook.create']],
  ['guru-b','GURU',true,['dutyBook.create']],
  ['kepsek-r58','KEPALA_SEKOLAH',true,['dutyBook.verify']],
  ['guru-inactive','GURU',false,[]],
 ])await setDoc(doc(db,'users',id),{id,role,fullName:id,isActive:active,permissions:perms,sessionRevokedAtSeconds:0});
 await setDoc(doc(db,'settings','school_config'),{attendanceMode:'TERJADWAL'});
 for(const collection of ['substitutions','studentTardiness','studentPermits','visitors']){
  await setDoc(doc(db,collection,`owned-${collection}`),{id:`owned-${collection}`,petugasPiketId:'guru-a',status:'BARU',createdAt:now,createdBy:'guru-a',updatedAt:now,notes:'original'});
 }
 await setDoc(doc(db,'dutyBooks','book-r58'),{id:'book-r58',petugasId:'guru-a',petugasName:'Guru A',tanggal:'2026-10-24',status:'DIAJUKAN',createdAt:now,createdBy:'guru-a',catatanPiket:'Asli',kondisiKeamanan:'Baik'});
});
try {
 await env.clearFirestore();await seed();
 const admin=env.authenticatedContext('admin-r58',{auth_time:2000}).firestore();
 const a=env.authenticatedContext('guru-a',{auth_time:2000}).firestore();
 const b=env.authenticatedContext('guru-b',{auth_time:2000}).firestore();
 const kepsek=env.authenticatedContext('kepsek-r58',{auth_time:2000}).firestore();
 const inactive=env.authenticatedContext('guru-inactive',{auth_time:2000}).firestore();
 const outsider=env.unauthenticatedContext().firestore();
 for(const collection of ['substitutions','studentTardiness','studentPermits','visitors']) {
   const existing=`owned-${collection}`;
   const fresh= (id,owner) => ({id,petugasPiketId:owner,status:'BARU',createdAt:now,createdBy:'guru-a',notes:'new'});
   await test(`${collection}: own create`,()=>setDoc(doc(a,collection,`self-${collection}`),fresh(`self-${collection}`,'guru-a')),true);
   await test(`${collection}: forged owner create`,()=>setDoc(doc(b,collection,`forge-${collection}`),fresh(`forge-${collection}`,'guru-a')),false);
   await test(`${collection}: different guru cannot edit`,()=>updateDoc(doc(b,collection,existing),{notes:'hacked'}),false);
   await test(`${collection}: creator can edit`,()=>updateDoc(doc(a,collection,existing),{notes:'edit own'}),true);
   await test(`${collection}: cannot change ownership`,()=>updateDoc(doc(a,collection,existing),{petugasPiketId:'guru-b'}),false);
   await test(`${collection}: cannot spoof original creator`,()=>updateDoc(doc(a,collection,existing),{createdBy:'guru-b'}),false);
   await test(`${collection}: admin can correct`,()=>updateDoc(doc(admin,collection,existing),{notes:'corrected by admin'}),true);
   await test(`${collection}: peer cannot delete`,()=>deleteDoc(doc(a,collection,existing)),false);
 }
 await test('Audit: own actor & role',()=>setDoc(doc(a,'auditLogs','audit-r58-a'),{id:'audit-r58-a',userId:'guru-a',role:'GURU',timestamp:now,action:'CREATE',module:'PERMITS',details:'Sample'}),true);
 await test('Audit: forged actor rejected',()=>setDoc(doc(b,'auditLogs','audit-r58-b'),{id:'audit-r58-b',userId:'guru-a',role:'GURU',timestamp:now,action:'UPDATE',module:'USERS',details:'Forged'}),false);
 await test('Audit: forged ADMIN role rejected',()=>setDoc(doc(b,'auditLogs','audit-r58-c'),{id:'audit-r58-c',userId:'guru-b',role:'ADMIN',timestamp:now,action:'UPDATE',module:'USERS',details:'Forged'}),false);
 await test('Audit: wrong document ID rejected',()=>setDoc(doc(b,'auditLogs','audit-r58-d'),{id:'different-id',userId:'guru-b',role:'GURU',timestamp:now,action:'UPDATE',module:'USERS',details:'Forged'}),false);
 await test('Audit: immutable after creation',()=>updateDoc(doc(a,'auditLogs','audit-r58-a'),{details:'hacked'}),false);
 await test('Dutybook: Kepala can approve status',()=>updateDoc(doc(kepsek,'dutyBooks','book-r58'),{status:'DIKUNCI',approvedBy:'kepsek-r58'}),true);
 await test('Dutybook: Kepala cannot rewrite journal',()=>updateDoc(doc(kepsek,'dutyBooks','book-r58'),{catatanPiket:'rewritten'}),false);
 await test('Rules: inactive user denied',()=>getDoc(doc(inactive,'visitors','owned-visitors')),false);
 await test('Rules: unauthenticated denied',()=>getDoc(doc(outsider,'visitors','owned-visitors')),false);
 console.log(`R58 EMULATOR PASSED: ${successes} scenarios. Now review normal app acceptance flows before deployment.`);
} finally {await env.cleanup()}
