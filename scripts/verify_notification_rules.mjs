// Requires a local Firestore emulator. With PIKET_FIRESTORE_EMULATOR_JAR, starts
// an isolated emulator for this suite. Never connects to the production project.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
const host = '127.0.0.1', port = 8188;
let processHandle, env;
try {
  if (process.env.PIKET_FIRESTORE_EMULATOR_JAR) {
    processHandle = spawn('java', ['-jar', process.env.PIKET_FIRESTORE_EMULATOR_JAR, '--host', host, '--port', String(port), '--project_id', 'demo-piket-notifications'], { stdio: ['ignore','ignore','pipe'] });
    let errors=''; processHandle.stderr.on('data', data => {errors+=data});
    let ready=false;
    for(let i=0;i<200;i++) { if(processHandle.exitCode!==null) throw Error('Emulator failed: '+errors);try { const r=await fetch(`http://${host}:${port}/`);if(r.status){ready=true;break} } catch {} await new Promise(r=>setTimeout(r,100)); }
    if(!ready) throw Error('Emulator not ready');
  } else if (process.env.FIRESTORE_EMULATOR_HOST !== `${host}:${port}`) throw Error(`Set FIRESTORE_EMULATOR_HOST=${host}:${port} or PIKET_FIRESTORE_EMULATOR_JAR`);
  env=await initializeTestEnvironment({projectId:'demo-piket-notifications',firestore:{host,port,rules:fs.readFileSync('firestore.rules','utf8')}});
  const data=(uid,extra={})=>({id:uid,fullName:uid,role:'GURU',isActive:true,permissions:['dashboard.view','attendance.view'],...extra});
  const event=(id,extra={})=>({id,scope:'SCHOOL',actorId:'alice',actorName:'alice',module:'ATTENDANCE',action:'CREATE',createdAt:new Date().toISOString(),...extra});
  const privateEvent=event('private-alice',{scope:'USER',module:'AUTH',action:'LOGIN'});
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const uid of ['alice','bob','admin','disabled']) await db.collection('users').doc(uid).set(data(uid,{role:uid==='admin'?'ADMIN':'GURU',isActive:uid!=='disabled'}));await db.collection('notificationEvents').doc('private-alice').set(privateEvent);await db.collection('notificationEvents').doc('school').set(event('school'));await db.collection('settings').doc('school_config').set({schoolName:'Test'});});
  const alice=env.authenticatedContext('alice',{auth_time:2000}).firestore();
  const bob=env.authenticatedContext('bob',{auth_time:2000}).firestore();
  const admin=env.authenticatedContext('admin',{auth_time:2000}).firestore();
  const disabled=env.authenticatedContext('disabled',{auth_time:2000}).firestore();
  const guest=env.unauthenticatedContext().firestore();
  let passed=0;const check=async(name,run)=>{await run();passed++;console.log('PASS',name)};
  await check('users read their private session only; other users and admin cannot read it',async()=>{await assertSucceeds(alice.collection('notificationEvents').doc('private-alice').get());await assertFails(bob.collection('notificationEvents').doc('private-alice').get());await assertFails(admin.collection('notificationEvents').doc('private-alice').get());});
  await check('school feed is readable by active users; disabled/guest sessions denied',async()=>{await assertSucceeds(bob.collection('notificationEvents').doc('school').get());await assertFails(disabled.collection('notificationEvents').doc('school').get());await assertFails(guest.collection('notificationEvents').doc('school').get());});
  await check('bounded scope queries satisfy Rules while unscoped cross-user scan fails',async()=>{await assertSucceeds(alice.collection('notificationEvents').where('scope','==','USER').where('actorId','==','alice').orderBy('createdAt','desc').limit(30).get());await assertSucceeds(bob.collection('notificationEvents').where('scope','==','SCHOOL').orderBy('createdAt','desc').limit(30).get());await assertFails(bob.collection('notificationEvents').limit(30).get());});
  await check('staff may create their own sanitized operational event',async()=>{await assertSucceeds(alice.collection('notificationEvents').doc('new').set(event('new')));});
  await check('client cannot forge AUTH, another actor, actor name, or sensitive payload fields',async()=>{await assertFails(alice.collection('notificationEvents').doc('forge-auth').set(event('forge-auth',{scope:'USER',module:'AUTH',action:'LOGIN'})));await assertFails(alice.collection('notificationEvents').doc('forge-actor').set(event('forge-actor',{actorId:'bob'})));await assertFails(alice.collection('notificationEvents').doc('forge-name').set(event('forge-name',{actorName:'admin'})));await assertFails(alice.collection('notificationEvents').doc('photo').set(event('photo',{photoUrl:'PRIVATE'})));});
  await check('identical retry succeeds; editing or deleting existing event is denied',async()=>{await assertSucceeds(alice.collection('notificationEvents').doc('school').set(event('school',{createdAt:(await alice.collection('notificationEvents').doc('school').get()).data().createdAt})));await assertFails(alice.collection('notificationEvents').doc('school').update({action:'DELETE'}));await assertFails(alice.collection('notificationEvents').doc('school').delete());});
  await check('notification settings can only be changed by active administrator',async()=>{await assertFails(alice.collection('settings').doc('school_config').update({notificationConfig:{enabled:false}}));await assertSucceeds(admin.collection('settings').doc('school_config').update({notificationConfig:{enabled:false}}));});
  assert.equal(passed,7);console.log(`${passed} actual Firestore emulator security scenarios passed.`);
} finally { if(env) await env.cleanup();if(processHandle) processHandle.kill('SIGTERM'); }
