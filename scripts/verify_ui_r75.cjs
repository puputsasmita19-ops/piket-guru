#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let n=0;const test=(name,check)=>{try{check();console.log('PASS',name);n++}catch(error){console.error('FAIL',name,error.message);process.exitCode=1}};
const b=read('src/components/layout/AppUpdateBanner.tsx'),g=read('src/services/offline/pwaUpdateSafety.ts'),v=read('src/features/dashboard/DashboardView.tsx'),w=read('src/features/dashboard/WelcomeSentence.tsx'),p=read('src/features/dashboard/DashboardWelcome.tsx'),css=read('src/index.css'),dc=read('src/dashboard-compact-r46.css');
for(const name of ['src/components/layout/AppUpdateBanner.tsx','src/services/offline/pwaUpdateSafety.ts','src/features/dashboard/WelcomeSentence.tsx','src/features/dashboard/DashboardWelcome.tsx','src/features/dashboard/DashboardView.tsx']){
 test(`TS/TSX syntax ${path.basename(name)}`,()=>{const ast=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0)})
}
test('No browser confirm in production gate',()=>assert.doesNotMatch(g,/window\.confirm\(/));
test('Explicit async UI confirmation',()=>assert.match(g,/await confirmPending\(/));
test('Cancel is distinct from failure',()=>assert.match(b,/instanceof PwaUpdateCancelledError/));
test('Confirm action distinct from cancel',()=>{assert.match(b,/Perbarui Sekarang/);assert.match(b,/Nanti Saja/) });
test('Only nonzero count displayed',()=>{assert.match(b,/!!pendingSummary\?\.draftsCount/);assert.match(b,/!!pendingSummary\?\.syncQueueCount/)});
test('Dialog uses accessible existing modal',()=>assert.match(b,/<Modal[\s\S]*title="Data Belum Selesai Dikirim"/));
test('Consent preceded by R57 gate',()=>assert.ok(b.indexOf('ensurePwaUpdateSafe(askBeforeUpdate)')<b.indexOf('AppUpdateManager.applyUpdate(setStage)')));
test('Postconsent revalidation',()=>assert.match(g,/latestCounts\.syncQueueCount !== counts\.syncQueueCount/));
test('Postconsent queue identity revalidation',()=>assert.match(g,/queueIds\(latestItems\) !== queueIds\(items\)/));
test('Storage errors still block',()=>assert.match(g,/Penyimpanan draf\/antrean belum dapat diverifikasi/));
test('Update avoids losing queue data',()=>assert.doesNotMatch(b+g,/localStorage\.clear\(|indexedDB\.deleteDatabase\(|caches\.delete\(/));
test('No extra greeting timer',()=>assert.equal((w.match(/useWelcomeClock\(/g)||[]).length,2));
test('Welcome control separate hero sibling',()=>{assert.match(w,/heroLayout && control/);assert.match(p,/heroLayout\s*\/>/)});
test('Welcome controls moved to header row',()=>assert.match(css,/welcome-message-pause-hero \{ grid-column: 2; grid-row: 1;/));
test('Avatar given own column',()=>assert.match(css,/dashboard-avatar \{ grid-column: 3; grid-row: 1 \/ span 2/));
test('Welcome text remains separate on second row',()=>assert.match(css,/dashboard-intro \{ grid-column: 1 \/ 3; grid-row: 2;/));
test('Mobile Pause touch target 44px',()=>assert.match(css,/welcome-message-pause \{ flex-basis: 44px; width: 44px; height: 44px/));
test('Thin four squares icon',()=>assert.match(v,/const ActivityGridOutlineIcon[\s\S]*strokeWidth="1\.55"/));
test('Activity icon shown in activity slide',()=>assert.match(v,/ActivityGridOutlineIcon className="dashboard-activity-mark-glyph"/));
test('Activity icon 24 desktop',()=>assert.match(dc,/dashboard-activity-mark-glyph \{\s*width: 24px;/));
test('Activity icon 22 mobile',()=>assert.match(dc,/@media screen and \(max-width: 639px\)[\s\S]*dashboard-activity-mark-glyph \{\s*width: 22px;/));
console.log(`R75 static: ${n}/26 checks passed`);
