#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const banner=fs.readFileSync('src/components/layout/AppUpdateBanner.tsx','utf8');
const gate=fs.readFileSync('src/services/offline/pwaUpdateSafety.ts','utf8');
const sync=fs.readFileSync('src/services/offline/syncQueueService.ts','utf8');
const storage=fs.readFileSync('src/services/offline/offlineStorage.ts','utf8');
const checks=[
 ['R53 updater remains async',()=>assert.match(banner,/await AppUpdateManager\.applyUpdate\(setStage\)/)],
 ['guard before activation',()=>assert.ok(banner.indexOf('await ensurePwaUpdateSafe()')<banner.indexOf('await AppUpdateManager.applyUpdate(setStage)'))],
 ['R57 gate imported',()=>assert.match(banner,/import \{ ensurePwaUpdateSafe \} from/)],
 ['blocks open forms',()=>assert.match(gate,/hasActiveEditor\(\)/)],
 ['flushes debounced drafts',()=>assert.match(gate,/await DraftService\.flushPending\(uid\)/)],
 ['queue count strict',()=>assert.match(gate,/OfflineStorage\.getPendingCount\(uid\)/)],
 ['in-flight sync blocked',()=>assert.match(gate,/item\.status === 'SENDING'/)],
 ['current account verified',()=>assert.match(gate,/auth\.currentUser\?\.uid !== uid/)],
 ['shared device protected',()=>assert.match(gate,/!OfflineStorage\.isTrustedDevice\(\)/)],
 ['trusted device requires confirmation',()=>assert.match(gate,/window\.confirm\(/)],
 ['storage failure fails closed',()=>assert.match(gate,/Penyimpanan draf\/antrean belum dapat diverifikasi/)],
 ['no cache purge',()=>assert.ok(!/localStorage\.clear\(|indexedDB\.deleteDatabase\(|caches\.delete\(/.test(gate))],
 ['queue composite idempotent key exists',()=>assert.match(sync,/operationId = `op:\$\{user\.id\}:\$\{collectionName\}:\$\{recordId\}`/)],
 ['queue uses immutable createOnly',()=>assert.match(sync,/enqueueSyncItem\(item, \{ createOnly: true \}\)/)],
 ['queue has cross tab sync lock',()=>assert.match(sync,/piket_sync_lock_/)],
 ['queue counts include drafts',()=>assert.match(storage,/draftsCount: drafts\.length/)],
];
let count=0;
for(const [name,fn] of checks){try{fn();console.log('PASS',name);count++;}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
console.log(`R57 static checks: ${count}/${checks.length}`);
