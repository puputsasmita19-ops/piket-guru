#!/usr/bin/env node
const fs=require('node:fs');
const assert=require('node:assert/strict');
const files=['src/features/master/MasterDataTabs.tsx','src/features/settings/SettingsView.tsx'];
for (const file of files) assert.ok(fs.existsSync(file),`Missing ${file}. Run in repository root.`);
const master=fs.readFileSync(files[0],'utf8');
const settings=fs.readFileSync(files[1],'utf8');
const checks=[
 ['Master R56 marker present',master.includes('R56: listener optimizations')],
 ['Master listeners depend on selected tab',master.includes('}, [activeTab]);')],
 ['Teachers loaded only when opened',master.includes("activeTab === 'teachers') listen<TeacherRecord>('teachers'" )],
 ['Students loaded only when opened',master.includes("activeTab === 'students') listen<StudentRecord>('students'")],
 ['Schedules tab loads teachers and students',master.includes("activeTab === 'lessonSchedules'") && master.includes("listen<TeacherRecord>('teachers', setTeachers)") && master.includes("listen<StudentRecord>('students', setStudents)")],
 ['Master listeners properly detached',master.includes('for (const stop of subscriptions) stop()')],
 ['Low-overhead badge counts used',master.includes('FirestoreService.getCollectionCount(collectionName)')],
 ['Badges never mistake unknown for zero',master.includes("tab.count ?? '…'")],
 ['Old eager master listeners removed',!master.includes('unsubTeachers();') && !master.includes('unsubStudents();')],
 ['Settings R56 marker present',settings.includes('R56: listener optimizations')],
 ['Security users listener only on security tab',settings.includes("activeTab === 'security' && isAdmin")],
 ['TV listeners only on lobby tab',settings.includes("if (activeTab !== 'lobby_tv') return;")],
 ['Settings realtime listeners detached on tab change',settings.includes('for (const unsubscribe of stop) unsubscribe()')],
 ['Original school config load preserved',settings.includes('SchoolSettingsService.load().then((data) =>')],
 ['Original Settings unmount cleanup preserved',settings.includes('mountedRef.current = false;') && settings.includes('LocationService.clearCurrentWatcher();')],
 ['No extra Firebase permission changes',!master.includes('allow read:') && !settings.includes('allow write:')],
];
let passed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${name}`);if(ok)passed++}
let ts;try{ts=require('typescript')}catch{}
if(ts){for(const file of files){const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const ok=ast.parseDiagnostics.length===0;console.log(`${ok?'PASS':'FAIL'}: TypeScript syntax ${file}`);if(ok)passed++;}}
const total=checks.length+(ts?2:0);
console.log(`R56: ${passed}/${total} checks passed`);
if(passed!==total)process.exitCode=1;
