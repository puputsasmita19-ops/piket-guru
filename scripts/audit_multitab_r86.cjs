#!/usr/bin/env node
/** R86 Phase A: READ-ONLY source audit; safe to run in a working repository.
 * No network, Firebase, IndexedDB, filesystem mutations, or session changes.
 * Results are code-presence checks, not a runtime/production certification.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rules = [
  ['Sinkronisasi foreground', 'src/hooks/useAutomaticSync.ts', /document\.hidden|visibilitychange/, 'PASS jika sinkronisasi menghormati tab tersembunyi'],
  ['Pengaman kiriman lintas tab — Web Locks', 'src/services/offline/syncQueueService.ts', /locks\.request|\.locks\.request/, 'Jangan hapus lock saat R86'],
  ['Pengaman kiriman lintas tab — IndexedDB lease', 'src/services/offline/offlineStorage.ts', /syncLease\(/, 'Pertahankan lease dan pemeriksaan owner'],
  ['Idempotensi kiriman', 'src/services/offline/syncQueueService.ts', /operationId = `op:/, 'ID operasi harus tetap stabil'],
  ['Penyimpanan perangkat tepercaya', 'src/services/offline/offlineStorage.ts', /isTrustedDevice\(\)/, 'Audit risiko kehilangan data memory-only'],
  ['Pembatalan pengiriman saat unmount', 'src/hooks/useAutomaticSync.ts', /SyncQueueService\.cancelSync\(\)/, 'Uji agar tidak membatalkan pekerjaan tab lain'],
  ['Aturan sesi background', 'src/services/auth/backgroundSession.ts', /monitorBackgroundSession/, 'Jangan bypass kebijakan sesi Admin'],
  ['Validasi identitas sesi', 'src/contexts/AuthContext.tsx', /onAuthStateChanged/, 'Jangan menyelaraskan kredensial lewat pesan tab'],
  ['Realtime profil', 'src/contexts/AuthContext.tsx', /subscribeToDocument.*users/s, 'Listener keamanan jangan dipause sembarangan'],
  ['Realtime dashboard', 'src/features/dashboard/DashboardView.tsx', /subscribeToCollection/, 'Audit biaya bila banyak tab dashboard aktif'],
  ['Realtime notifikasi', 'src/services/notifications/notificationFeedService.ts', /onSnapshot\(/, 'Prioritaskan deduplikasi efek/toast, bukan mematikan sumber'],
  ['Realtime audit', 'src/services/audit/auditLogFeedService.ts', /onSnapshot\(/, 'Uji kebijakan tab pasif untuk Admin'],
  ['Sharing listener dalam satu tab', 'src/services/firebase/sharedLiveSource.ts', /const channels = new Set/, 'Bukan koordinasi antartab'],
  ['Pengelola pembaruan PWA', 'src/services/offline/appUpdateManager.ts', /controllerchange/, 'Pertahankan pemeriksaan update aman'],
  ['Guard pembaruan PWA terbaru', 'src/services/offline/pwaUpdateSafety.ts', /ensurePwaUpdateSafe/, 'HARUS dibandingkan dengan HEAD aktual; bisa belum ada di arsip lama'],
  ['Koordinasi BroadcastChannel', 'src/services/tab/tabCoordinator.ts', /BroadcastChannel/, 'Direkomendasikan dalam implementasi berikut, belum dalam tahap audit'],
];
let found = 0, matched = 0, warnings = [];
console.log('R86 • AUDIT SOURCE READ-ONLY');
console.log('Repository:', root);
for (const [name, rel, pattern, note] of rules) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {console.log(`NOT FOUND | ${name} | ${rel} | ${note}`);warnings.push({name,rel,reason:'source absent in checkout'});continue;}
  found++;
  const ok = pattern.test(fs.readFileSync(file, 'utf8'));
  if(ok) matched++;
  else warnings.push({name,rel,reason:'pattern not found; manually inspect source'});
  console.log(`${ok?'PRESENT  ':'REVIEW   '} | ${name} | ${rel} | ${note}`);
}
const inspect = [
  'src/services/offline/syncQueueService.ts',
  'src/services/offline/offlineStorage.ts',
  'src/services/auth/backgroundSession.ts',
  'src/contexts/AuthContext.tsx',
  'src/features/dashboard/DashboardView.tsx',
  'src/services/notifications/notificationFeedService.ts',
];
for (const rel of inspect) if(!fs.existsSync(path.join(root,rel))) console.error('MISSING CORE FILE:', rel);
console.log(`Summary: ${matched}/${rules.length} presence checks matched, ${found}/${rules.length} files found.`);
console.log('These checks DO NOT confirm concurrency, data safety, build, or production correctness.');
if(warnings.length) console.log('Requires manual review:',warnings.map(x=>x.name).join('; '));
