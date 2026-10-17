import {spawn} from 'node:child_process';
let emulator;
if(process.env.PIKET_FIRESTORE_EMULATOR_JAR){emulator=spawn('java',['-jar',process.env.PIKET_FIRESTORE_EMULATOR_JAR,'--host','127.0.0.1','--port','8795','--project_id','demo-profile-photos'],{stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Emulator startup timeout')),20000);const ready=data=>{if(String(data).includes('API endpoint:')){clearTimeout(timer);resolve()}};emulator.stdout.on('data',ready);emulator.stderr.on('data',ready);emulator.on('error',reject);emulator.on('exit',code=>{if(code)reject(Error('Emulator exited '+code))})});}
import fs from 'node:fs';import assert from 'node:assert/strict';import{initializeTestEnvironment,assertFails,assertSucceeds}from'@firebase/rules-unit-testing';import{doc,setDoc,updateDoc,getDoc}from'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-profile-photos',firestore:{host:'127.0.0.1',port:8795,rules:fs.readFileSync('firestore.rules','utf8')}});let n=0;const check=async(name,fn)=>{await fn();n++;console.log('PASS',name)};
try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const[id,role]of[['admin','ADMIN'],['teacher','GURU'],['head','KEPALA_SEKOLAH']])await setDoc(doc(c.firestore(),'users',id),{id,fullName:id,role,isActive:true,permissions:role==='ADMIN'?['*']:[],avatarUrl:null})});
 const teacher=env.authenticatedContext('teacher').firestore(),admin=env.authenticatedContext('admin').firestore(),head=env.authenticatedContext('head').firestore();
 await check('teacher cannot change own avatar directly',()=>assertFails(updateDoc(doc(teacher,'users','teacher'),{avatarUrl:'/api/drive/profile-photo/teacher/fake'})));
 await check('teacher cannot remove own avatar directly',()=>assertFails(updateDoc(doc(teacher,'users','teacher'),{avatarUrl:'data:image/jpeg;base64,FAKE'})));
 await check('head cannot change another teacher avatar',()=>assertFails(updateDoc(doc(head,'users','teacher'),{avatarUrl:'fake'})));
 await check('safe self profile edits still work',()=>assertSucceeds(updateDoc(doc(teacher,'users','teacher'),{phone:'0800000000',email:'test@example.invalid'})));
 await check('teacher cannot escalate role with photo fields',()=>assertFails(updateDoc(doc(teacher,'users','teacher'),{role:'ADMIN',avatarUrl:'fake'})));
 await check('admin can manage avatar reference',()=>assertSucceeds(updateDoc(doc(admin,'users','teacher'),{avatarUrl:'/api/drive/profile-photo/teacher/file-test'})));
 await check('active directory readers still see profile metadata',()=>assertSucceeds(getDoc(doc(teacher,'users','teacher'))));
 await check('anonymous users cannot read profile metadata',()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users','teacher'))));
 console.log(`${n} profile photo Firestore emulator checks passed.`);
}finally{await env.cleanup();emulator?.kill()}
