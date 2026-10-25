#!/usr/bin/env node
'use strict';
/** R86-A static inspection only. Does not access Firebase or mutate files. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const checks = [
  ['AUTH_SESSION', 'src/contexts/AuthContext.tsx', /onAuthStateChanged|monitorBackgroundSession|revalidateSessionOnline/],
  ['BACKGROUND_POLICY', 'src/services/auth/backgroundSession.ts', /monitorBackgroundSession|visibilitychange|pagehide/],
  ['SYNC_WEB_LOCKS', 'src/services/offline/syncQueueService.ts', /navigator\.locks|\.locks\.request/],
  ['SYNC_IDB_LEASE', 'src/services/offline/offlineStorage.ts', /syncLease/],
  ['DRAFT_FLUSH', 'src/services/offline/draftService.ts', /flushPending/],
  ['TRUSTED_DEVICE', 'src/services/offline/offlineStorage.ts', /isTrustedDevice/],
  ['AUTO_SYNC_VISIBILITY', 'src/hooks/useAutomaticSync.ts', /document\.hidden|visibilitychange/],
  ['DASHBOARD_FIRESTORE', 'src/features/dashboard/DashboardView.tsx', /subscribeToCollection|subscribeToDocument/],
  ['NOTIFICATION_SOURCES', 'src/services/notifications/notificationFeedService.ts', /onSnapshot/],
  ['NOTIFICATION_BELL', 'src/components/layout/NotificationBell.tsx', /subscribeNotificationFeed/],
  ['SHARED_LIVE_SOURCES', 'src/services/firebase/sharedLiveSource.ts', /const channels = new Set/],
  ['PWA_UPDATE_MANAGER', 'src/services/offline/appUpdateManager.ts', /visibilitychange|controllerchange/],
  ['PWA_UPDATE_GUARD', 'src/services/offline/pwaUpdateSafety.ts', /ensurePwaUpdateSafe/],
  ['R86A_OPT_IN', 'src/main.tsx', /VITE_R86_AUDIT === 'enabled'/],
  ['R86A_OBSERVATION', 'src/services/diagnostics/r86TabAudit.ts', /startR86TabAudit/],
];
const inspect = [];let present=0;
for(const [id,relative,pattern] of checks){
  const full=path.join(root,relative);
  const source=fs.existsSync(full)?fs.readFileSync(full,'utf8'):null;
  const state=source === null ? 'MISSING' : pattern.test(source) ? 'FOUND' : 'REVIEW';
  if(state==='FOUND')present++;
  inspect.push({id,path:relative,state});
}
const files=(base)=>fs.existsSync(base)?fs.readdirSync(base,{withFileTypes:true}).flatMap(e=> e.isDirectory()?files(path.join(base,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(base,e.name)]:[]):[];
const tsfiles=files(path.join(root,'src'));
const sourceCounts={
  filesScanned:tsfiles.length,
  onSnapshotCallSites:0,
  subscribeToCollectionCallSites:0,
  subscribeToDocumentCallSites:0,
  visibilityChangeReferences:0,
  broadcastChannelReferences:0,
};
for(const file of tsfiles){
  const content=fs.readFileSync(file,'utf8');
  for(const [key,regex] of [
    ['onSnapshotCallSites',/\bonSnapshot\s*\(/g],
    ['subscribeToCollectionCallSites',/\bsubscribeToCollection\s*(?:<[^;]*?>)?\s*\(/g],
    ['subscribeToDocumentCallSites',/\bsubscribeToDocument\s*(?:<[^;]*?>)?\s*\(/g],
    ['visibilityChangeReferences',/visibilitychange/g],
    ['broadcastChannelReferences',/BroadcastChannel/g],
  ]) sourceCounts[key]+=(content.match(regex)||[]).length;
}
const important=['src/main.tsx','src/contexts/AuthContext.tsx','src/hooks/useAutomaticSync.ts','src/services/offline/syncQueueService.ts'];
const fingerprints={};
for(const rel of important){const f=path.join(root,rel);if(fs.existsSync(f))fingerprints[rel]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,12);}
const report={
  audit:'R86-A',scope:'STATIC_SOURCE_ONLY',gitHeadAvailable:fs.existsSync(path.join(root,'.git')),
  matches:`${present}/${checks.length}`,inspection:inspect,sourceCounts,
  warning:'Counts are call sites/references, NOT active Firestore listeners or runtime work. Missing file does not prove absent in GitHub HEAD.',
  fingerprints,
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else {
  console.log('R86-A STATIC AUDIT — NO NETWORK OR FILE MODIFICATIONS');
  for(const row of inspect)console.log(`${row.state.padEnd(7)} ${row.id.padEnd(28)} ${row.path}`);
  console.log('Matched indicators:',report.matches);
  console.log('STATIC CALL SITES (not active listeners):',JSON.stringify(sourceCounts));
  console.log('Git metadata:',report.gitHeadAvailable?'present':'not present; compare against GitHub HEAD manually');
  console.log(report.warning);
}
