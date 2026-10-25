#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
const script=path.join(__dirname,'audit_r86e1_firestore_baseline.cjs');
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r86e1-'));
let passed=0;
function check(label, fn) {try{fn();passed++;console.log('PASS',label);}catch(e){console.error('FAIL',label,e.message);process.exitCode=1;}}
function write(rel,txt) {const p=path.join(parent,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,txt);}
function run(args=[],env={}) {return cp.spawnSync(process.execPath,[script,'--root',parent,...args],{encoding:'utf8',env:{...process.env,...env}});}
try {
  write('src/services/firebase/firestoreService.ts',`import { onSnapshot } from 'firebase/firestore';\nfunction service() {\n  const unsub=onSnapshot(q, snap => {});\n  return () => unsub();\n}\n`);
  write('src/features/attendance/AttendancePreview.tsx',`function Component(){\n  useEffect(() => FirestoreService.subscribeToCollection('attendance', setData),[]);\n  useEffect(() => FirestoreService.subscribeToDocument('settings','school_config', setData),[]);\n}\n`);
  write('src/services/notifications/notificationFeedService.ts',`function notify(){ return onSnapshot(query(collection(db,spec.source)), {includeMetadataChanges:true}, listener); }`);
  write('src/components/layout/NotificationBell.tsx',`const subscription = subscribeNotificationFeed(uid, cfg, setState);`);
  write('src/services/offline/queue.ts',`function flush(){return WebLocksProtectedQueue()} // should never be touched`);
  const before=fs.readFileSync(path.join(parent,'src/services/firebase/firestoreService.ts'),'utf8');
  check('Default run exits successfully',()=>{const r=run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/SDK onSnapshot call sites: 2/);});
  check('Default run creates no files',()=>{assert.equal(fs.existsSync(path.join(parent,'artifacts')),false);});
  check('Writes JSON/Markdown only when --out is specified',()=>{const r=run(['--out','artifacts/r86e1']);assert.equal(r.status,0,r.stderr);assert.ok(fs.existsSync(path.join(parent,'artifacts/r86e1/baseline.json')));assert.ok(fs.existsSync(path.join(parent,'artifacts/r86e1/baseline.md')));});
  const report=JSON.parse(fs.readFileSync(path.join(parent,'artifacts/r86e1/baseline.json'),'utf8'));
  check('Counts onSnapshot call sites',()=>assert.equal(report.counts.SDK_LISTENER,2));
  check('Counts distinct wrapper callers',()=>{assert.equal(report.counts.COLLECTION_SUBSCRIBER,1);assert.equal(report.counts.DOCUMENT_SUBSCRIBER,1);});
  check('Notification consumer kept separately',()=>assert.equal(report.counts.NOTIFICATION_SUBSCRIBER,1));
  check('Methods not mistaken for Firebase billed reads',()=>{assert.ok(report.riskNotes.some(x=>x.includes('BUKAN')));});
  check('Source path is not exported in report',()=>{assert.equal(report.source.rootLabel,'.');assert.ok(!JSON.stringify(report).includes(parent));});
  check('Metadata callbacks annotated',()=>assert.ok(report.sites.some(x=>x.method==='onSnapshot' && x.lifecycleHints.includes('METADATA_CALLBACKS'))));
  check('Read-only scan leaves source unchanged',()=>assert.equal(fs.readFileSync(path.join(parent,'src/services/firebase/firestoreService.ts'),'utf8'),before));
  check('Output refused inside src/',()=>{const r=run(['--out','src/test-output']);assert.notEqual(r.status,0);assert.ok(!fs.existsSync(path.join(parent,'src/test-output')));});
  check('Missing root refuses safely',()=>{const r=cp.spawnSync(process.execPath,[script,'--root',path.join(parent,'does-not-exist')],{encoding:'utf8'});assert.notEqual(r.status,0);});
  check('Compare option reads prior baseline',()=>{const r=run(['--out','artifacts/compare','--compare','artifacts/r86e1/baseline.json']);assert.equal(r.status,0,r.stderr);assert.match(fs.readFileSync(path.join(parent,'artifacts/compare/baseline.md'),'utf8'),/Perbandingan/);});
  check('Bad compare schema rejected',()=>{write('wrong.json',JSON.stringify({schema:'wrong'}));const r=run(['--out','artifacts/other','--compare','wrong.json']);assert.notEqual(r.status,0);});
  check('Ignores JS files and excluded source dirs',()=>{write('src/test.js',`onSnapshot(fake);`);write('src/node_modules/ignored.ts',`onSnapshot(fake);`);const r=run(['--out','artifacts/last']);assert.equal(r.status,0,r.stderr);const output=JSON.parse(fs.readFileSync(path.join(parent,'artifacts/last/baseline.json'),'utf8'));assert.equal(output.counts.SDK_LISTENER,2);});
  check('Help prints usage',()=>{const r=cp.spawnSync(process.execPath,[script,'--help'],{encoding:'utf8'});assert.equal(r.status,0);assert.match(r.stdout,/Usage/);});
  check('No Firebase/network/app imports used by auditor',()=>{const content=fs.readFileSync(script,'utf8');assert.doesNotMatch(content,/require\(['"]firebase/);assert.doesNotMatch(content,/\bfetch\s*\(/);});
  check('Git commit metadata reads clean repository accurately',()=>{
    const cmd=(args)=>cp.execFileSync('git',args,{cwd:parent,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    cmd(['init','-q']);cmd(['add','.']);
    cmd(['-c','user.name=Local Test','-c','user.email=test@example.invalid','commit','-qm','local baseline fixture']);
    const r=run(['--out','artifacts/git-clean']);assert.equal(r.status,0,r.stderr);
    const b=JSON.parse(fs.readFileSync(path.join(parent,'artifacts/git-clean/baseline.json'),'utf8'));
    assert.match(b.source.gitHead,/^[a-f0-9]{40}$/);
    assert.equal(b.source.gitDirty,false);
  });
  check('Git dirty state captured without leaking file contents',()=>{
    write('src/fixture-new.ts','export const change = 2;');
    const r=run(['--out','artifacts/git-dirty']);assert.equal(r.status,0,r.stderr);
    const b=JSON.parse(fs.readFileSync(path.join(parent,'artifacts/git-dirty/baseline.json'),'utf8'));
    assert.equal(b.source.gitDirty,true);
    assert.ok(!JSON.stringify(b).includes('fixture-new.ts:export'));
  });
} finally {fs.rmSync(parent,{recursive:true,force:true});}
console.log(`R86-E1 audit verification: ${passed}/19 passed`);
