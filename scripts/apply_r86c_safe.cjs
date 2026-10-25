#!/usr/bin/env node
'use strict';
/** R86-C fail-closed installer; dry-run unless --apply. Never edits auth or offline queue. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const isApply = process.argv.includes('--apply');
function fail(msg) { console.error('STOP R86-C: '+msg+'; tidak ada file diubah.'); process.exit(2); }
const names = {
  main: 'src/main.tsx',
  firestore: 'src/services/firebase/firestoreService.ts',
  feed: 'src/services/notifications/notificationFeedService.ts',
  bell: 'src/components/layout/NotificationBell.tsx',
  metrics: 'src/services/diagnostics/r86cListenerMetrics.ts',
};
const files = Object.fromEntries(Object.entries(names).map(([k,v])=>[k,path.join(root,v)]));
for (const [key,p] of Object.entries(files)) if(!fs.existsSync(p)) fail('file tidak ditemukan: '+names[key]);
const src = Object.fromEntries(Object.entries(files).map(([k,v])=>[k,fs.readFileSync(v,'utf8')]));
const marker='R86-C: safe listener metrics';
if (Object.values(src).slice(0,4).some(s=>s.includes(marker))) {
  if (['main','firestore','feed','bell'].every(k=>src[k].includes(marker))) {
    console.log('R86-C sudah terpasang pada 4 source; tidak menulis ulang.');process.exit(0);
  }
  fail('ada pemasangan R86-C sebagian; perlu audit manual untuk menghindari patch ganda');
}
if (!src.main.includes('R86-A: explicit opt-in diagnostic build AND URL flag') ||
    !src.main.includes('R86-B: visual-only coordination, staging opt-in')) fail('R86-A dan R86-B harus sudah diterapkan pada main.tsx');
if (!src.firestore.includes("import { sharedLiveSource } from './sharedLiveSource';")) fail('sharedLiveSource tidak ditemukan; sumber Firestore berbeda');
if (!src.feed.includes('subscribeNotificationFeed') || !src.bell.includes('flushNotificationOutbox')) fail('source notifikasi tidak cocok');
const replacements = [];
function replaceOne(key, oldText, newText) {
  const s=src[key];
  const pieces=s.split(oldText);
  if (pieces.length!==2) fail(`anchor tidak unik atau tidak ditemukan di ${names[key]}: ${oldText.slice(0,70)}`);
  src[key]=pieces.join(newText);
}
function addImport(key, anchor, inserted) { replaceOne(key,anchor,anchor+'\n'+inserted); }
// initialize before createRoot. No dynamic-import race with the first mounted subscriber.
addImport('main', "import App from './App.tsx';", "// "+marker+" (staging opt-in, no data captured)\nimport { startR86CObservation } from './services/diagnostics/r86cListenerMetrics';");
replaceOne('main', "createRoot(document.getElementById('root')!).render(<App />);",
`// ${marker}; enable only on DEV or explicitly flagged Preview plus URL flag.
if ((import.meta.env.DEV || import.meta.env.VITE_R86_LISTENER_AUDIT === 'enabled') &&
    new URLSearchParams(window.location.search).get('r86_listener_audit') === '1') {
  startR86CObservation();
}
createRoot(document.getElementById('root')!).render(<App />);`);
addImport('firestore', "import { sharedLiveSource } from './sharedLiveSource';", "// "+marker+" (transparent SDK unsubscribe wrapper)\nimport { trackR86CListener, noteR86CEvent } from '../diagnostics/r86cListenerMetrics';");
replaceOne('firestore', 'const unsubscribe = onSnapshot(q, snapshot => {', "const unsubscribe = trackR86CListener('collection', onSnapshot(q, snapshot => {\n        noteR86CEvent('collection');");
replaceOne('firestore', '}, error => { if (active) { received = true; fail(error); } });', "}, error => { noteR86CEvent('collection', true); if (active) { received = true; fail(error); } }));");
replaceOne('firestore', 'const unsubscribe = onSnapshot(doc(db, collectionName, id), snapshot => {', "const unsubscribe = trackR86CListener('document', onSnapshot(doc(db, collectionName, id), snapshot => {\n        noteR86CEvent('document');");
replaceOne('firestore', '}, error => { if (active) fail(error); });', "}, error => { noteR86CEvent('document', true); if (active) fail(error); }));");
addImport('feed', "import { OfflineStorage } from '../offline/offlineStorage';", "// "+marker+" (no notification delivery changes)\nimport { trackR86CListener, noteR86CEvent } from '../diagnostics/r86cListenerMetrics';");
replaceOne('feed', 'cleanups.push(onSnapshot(query(collection(db, spec.source), ...spec.filters), { includeMetadataChanges: true }, snap => {',
`const sourceKind = spec.source === 'notificationEvents' ? 'notification' : 'announcement';
    cleanups.push(trackR86CListener(sourceKind, onSnapshot(query(collection(db, spec.source), ...spec.filters), { includeMetadataChanges: true }, snap => {
      noteR86CEvent(sourceKind);`);
replaceOne('feed', '    }, error => {\n      if (stopped) return;', '    }, error => {\n      noteR86CEvent(sourceKind, true);\n      if (stopped) return;');
replaceOne('feed', '    }));\n  }\n  return OfflineStorage.registerListener', '    })));\n  }\n  return OfflineStorage.registerListener');
addImport('bell', "import React, { useEffect, useRef, useState } from 'react';", "// "+marker+" (pause UI-only expiry clock in hidden duplicate tab)\nimport { isR86COptimizationEnabled } from '../../services/diagnostics/r86cListenerMetrics';");
replaceOne('bell',
`    // Expire the displayed history while the app stays open; no polling or network reads.
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); window.removeEventListener('storage', syncRead); };`,
`    // ${marker}; only the UI expiry clock pauses while hidden.
    // Firestore live feed, emergency alerts and outbox remain fully operational.
    let timer: number | undefined;
    const tick = () => setClock(Date.now());
    const reconcileClock = () => {
      if (isR86COptimizationEnabled() && document.visibilityState !== 'visible') {
        if (timer !== undefined) { window.clearInterval(timer); timer = undefined; }
        return;
      }
      if (timer === undefined) timer = window.setInterval(tick, 60000);
      if (isR86COptimizationEnabled() && document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', reconcileClock);
    reconcileClock();
    return () => { if (timer !== undefined) window.clearInterval(timer); document.removeEventListener('visibilitychange', reconcileClock); window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); window.removeEventListener('storage', syncRead); };`);
// Validate every proposed file before writing ANY source file.
for(const k of ['main','firestore','feed','bell']) if(!src[k].includes(marker)) fail('missing marker: '+k);
if (!isApply) {
  console.log('DRY RUN: 4 file dapat dipatch dengan aman:');
  for (const k of ['main','firestore','feed','bell']) console.log('  '+names[k]);
  console.log('Gunakan --apply untuk menulis ke repository lokal.');process.exit(0);
}
const tmp=[];
try {
  for (const key of ['main','firestore','feed','bell']) {
    const t=files[key]+`.r86c-${process.pid}.tmp`;
    fs.writeFileSync(t,src[key],'utf8');tmp.push([key,t]);
  }
  // Backup originals to enable rollback if a later rename fails.
  const originals = Object.fromEntries(['main','firestore','feed','bell'].map(k=>[k,fs.readFileSync(files[k])]));
  try {
    for (const [key,t] of tmp) fs.renameSync(t,files[key]);
  } catch (e) {
    for(const key of Object.keys(originals)) fs.writeFileSync(files[key],originals[key]);
    throw e;
  }
  console.log('R86-C applied: 4 source file berubah, hanya instrumentasi opt-in dan UI clock.');
} finally { for(const [,t] of tmp) if(fs.existsSync(t)) fs.unlinkSync(t); }
