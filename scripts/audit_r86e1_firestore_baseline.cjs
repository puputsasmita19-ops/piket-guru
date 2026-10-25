#!/usr/bin/env node
'use strict';
/** R86-E1 — read-only static inventory, no Firestore initialization or network access. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const TARGETS = {
  onSnapshot: 'SDK_LISTENER',
  sharedLiveSource: 'IN_TAB_SHARING',
  subscribeToCollection: 'COLLECTION_SUBSCRIBER',
  subscribeToDocument: 'DOCUMENT_SUBSCRIBER',
  subscribeNotificationFeed: 'NOTIFICATION_SUBSCRIBER',
  subscribeLatestAuditLogs: 'AUDIT_FEED_SUBSCRIBER',
  subscribeAuditHistoryHead: 'AUDIT_HISTORY_SUBSCRIBER',
  onAuthStateChanged: 'AUTH_OBSERVER',
};
const ONESHOTS = new Set(['getDocs','getDoc','getDocsFromServer','getDocFromServer','getCountFromServer']);
const CATEGORIES = {
  critical: ['contexts/AuthContext.tsx', 'services/firebase/firestoreService.ts', 'services/firebase/sharedLiveSource.ts', 'services/notifications/notificationFeedService.ts', 'components/layout/NotificationBell.tsx', 'services/notifications/emergencyService.ts', 'features/attendance/', 'features/duty-book/'],
  protected: ['features/student-permits/', 'features/student-tardiness/', 'features/incidents/', 'features/visitors/', 'features/settings/', 'services/audit/', 'hooks/useAuditLog'],
};
const args = process.argv.slice(2);
function arg(key, fallback) { const i = args.indexOf(key); return i < 0 ? fallback : args[i+1]; }
if (args.includes('--help')) {
  console.log('Usage: node scripts/audit_r86e1_firestore_baseline.cjs [--root .] [--out artifacts/r86e1] [--compare path/to/prior-baseline.json]');
  console.log('Read-only by default. --out writes only JSON/Markdown into the specified output folder. Does not connect to Firebase.');
  process.exit(0);
}
const root = path.resolve(arg('--root', process.cwd()));
const src = path.join(root, 'src');
const outArg = arg('--out', null);
const compareArg = arg('--compare', null);
if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) { console.error('STOP R86-E1: folder src/ tidak ditemukan pada root', root); process.exit(2); }
if ((args.includes('--out') && !outArg) || (args.includes('--compare') && !compareArg)) { console.error('STOP R86-E1: opsi membutuhkan path.'); process.exit(2); }
let ts = null;
try { ts = require('typescript'); } catch { /* regex fallback for clean Node installation */ }
function walk(dir, acc=[]) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (item.name === 'node_modules' || item.name === 'dist' || item.name.startsWith('.')) continue;
    const abs = path.join(dir,item.name);
    if (item.isDirectory()) walk(abs,acc);
    else if (item.isFile() && /\.tsx?$/.test(item.name) && !/\.d\.ts$/.test(item.name)) acc.push(abs);
  }
  return acc;
}
const files = walk(src).sort();
function scopeOf(rel) {
  if (CATEGORIES.critical.some(p=>rel.includes(p))) return 'KRITIS — JANGAN PAUSE OTOMATIS';
  if (CATEGORIES.protected.some(p=>rel.includes(p))) return 'TERLINDUNGI — REVIEW MANUAL';
  return 'PERLU KLASIFIKASI';
}
function getLocation(text, start) { const before = text.slice(0,start); return before.split('\n').length; }
function getHint(text, offset, method) {
  const prefix = text.slice(Math.max(0,offset-160),offset);
  const tail = text.slice(offset,Math.min(text.length,offset+600));
  if (method === 'onSnapshot') {
    if (/collection\(db,\s*spec\.source/.test(tail)) return 'DYNAMIC_NOTIFICATION_SOURCES';
    const mat = tail.match(/collection\(\s*(?:db\s*,\s*)?['"`]([A-Za-z0-9_-]+)['"`]/);
    if (mat) return mat[1];
    if (/auditQuery\(/.test(tail) || /\bauditLogs\b/.test(prefix+tail)) return 'auditLogs';
    if (/doc\(\s*db,\s*collectionName/.test(tail)) return 'DYNAMIC_DOCUMENT';
    return 'QUERY_EXPRESSION_REVIEW';
  }
  if (method==='subscribeToCollection'||method==='subscribeToDocument') {
    const mat = tail.match(/^[^(]*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?['"`]([A-Za-z0-9_-]+)['"`]/);
    if (mat) return mat[1];
    return 'DYNAMIC_COLLECTION';
  }
  return method==='onAuthStateChanged' ? 'FIREBASE_AUTH_NOT_FIRESTORE' : 'REVIEW_FUNCTION';
}
function lifecycleHint(text, offset, method, filename) {
  const segment = text.slice(Math.max(0,offset-250),Math.min(text.length,offset+1600));
  const flags = [];
  if (/\b(?:return\s+(?:\(\s*\)\s*=>|unsub|stop|unsubscribe)|registerListener\s*\(|cleanups\.forEach|\.unsubscribe\s*\()/.test(segment)) flags.push('CLEANUP_HINT');
  if (/useEffect\s*\(/.test(segment) || filename.endsWith('.tsx')) flags.push('REACT_REVIEW');
  if (/includeMetadataChanges\s*:\s*true/.test(segment) && method === 'onSnapshot') flags.push('METADATA_CALLBACKS');
  return flags;
}
const methods = new Set([...Object.keys(TARGETS),...ONESHOTS]);
const sites=[];
const warnings=[];
for (const filename of files) {
  const rel=path.relative(root,filename).replaceAll('\\','/');
  const content=fs.readFileSync(filename,'utf8');
  function record(name,offset) {
    // Dynamic source types are not runtime listener counts.
    const kind = TARGETS[name] || 'ONE_SHOT_READ';
    sites.push({file:rel,line:getLocation(content,offset),kind,method:name,sourceHint:getHint(content,offset,name),reviewLevel:scopeOf(rel),lifecycleHints:lifecycleHint(content,offset,name,rel)});
  }
  if (ts) {
    const source=ts.createSourceFile(rel,content,ts.ScriptTarget.Latest,true,rel.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    if (source.parseDiagnostics.length) warnings.push(`${rel}: ${source.parseDiagnostics.length} TypeScript parse diagnostics`);
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expr=node.expression;
        const name=ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : null;
        if (name && methods.has(name)) record(name,expr.getStart(source));
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
  } else {
    // Fallback: count invocations conservatively, skip obvious function declarations/imports.
    const re=/\b(onSnapshot|sharedLiveSource|subscribeToCollection|subscribeToDocument|subscribeNotificationFeed|subscribeLatestAuditLogs|subscribeAuditHistoryHead|onAuthStateChanged|getDocs|getDoc|getDocsFromServer|getDocFromServer|getCountFromServer)\s*(?:<[^>\n]+>)?\s*\(/g;
    for (const match of content.matchAll(re)) {
      const name=match[1]; const line=content.slice(content.lastIndexOf('\n',match.index)+1,match.index);
      if (/\b(?:function|static|public\s+static|interface|import|\.)\s*$/.test(line) && !line.trimEnd().endsWith('.')) continue;
      if (/\bfunction\s*$/.test(line)) continue;
      record(name,match.index);
    }
    if (!warnings.includes('AST tidak tersedia: hasil fallback berbasis regex dan perlu review manual.')) warnings.push('AST tidak tersedia: hasil fallback berbasis regex dan perlu review manual.');
  }
}
const counts={};for(const s of sites) counts[s.kind]=(counts[s.kind]||0)+1;
const sourceChecksum=crypto.createHash('sha256').update(files.map(f=>path.relative(root,f)+':'+crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join('\n')).digest('hex');
function git(cmd, allowEmpty=false) {try{const s=cp.execFileSync('git',cmd,{cwd:root,timeout:2500,stdio:['ignore','pipe','ignore']}).toString().trim();return s || (allowEmpty ? '' : null);}catch{return null;}}
const head=git(['rev-parse','HEAD']); const branch=git(['branch','--show-current']); const porcelain=git(['status','--porcelain'],true);
const diagnostics={
  'R86-A':'services/diagnostics/r86TabAudit.ts',
  'R86-B':'services/multitab/r86bSafeTabCoordination.ts',
  'R86-C':'services/diagnostics/r86cListenerMetrics.ts',
  'R86-D':'services/diagnostics/r86dStabilityProbe.ts',
};
const installed=Object.fromEntries(Object.entries(diagnostics).map(([name,rel])=>[name,fs.existsSync(path.join(src,rel))]));
const riskNotes=[
  'Jumlah call site statis BUKAN jumlah listener yang aktif, wire/network stream, callback, dokumen yang dibaca, atau read Firestore berbayar.',
  'sharedLiveSource berbagi listener identik hanya di dalam satu tab dan memiliki scope akun; tidak otomatis berbagi antartab.',
  'Jalur onSnapshot dinamis dalam loop notificationFeedService dapat membuat 0–4 subscription sesuai konfigurasi per mount, bukan selalu satu.',
  'Kehadiran petunjuk cleanup tidak membuktikan cleanup selalu dijalankan pada semua cabang; perlu uji komponen dan session teardown.',
  'Listener presensi, auth, emergency, sesi dan offline tidak boleh dipause untuk E1.',
  'Runtime R86-C hanya menginstrumentasi subset tertentu; angka emisi callback tidak setara dengan billed reads.',
  'Tidak ada request ke Firebase atau penghapusan cache/IndexedDB; ini inventaris kode statis.',
  'AST memindai panggilan bernama yang dikenal di berkas ts/tsx, bukan alias, registerListener buatan sendiri atau seluruh jalur JavaScript; perlu review manual.'
];
const report={schema:'piket-guru-r86-e1/1',generatedAt:new Date().toISOString(),source:{rootLabel:".",gitHead:head,gitBranch:branch,gitDirty:porcelain===null?null:porcelain.length>0,sourceFileCount:files.length,checksum:sourceChecksum,astEngine:ts?'typescript':'regex-fallback',r86DiagnosticsPresent:installed},counts,sites,riskNotes,warnings};
function summary(r) { return ['R86-E1 static baseline',`AST: ${r.source.astEngine}`,`Git HEAD: ${r.source.gitHead || 'UNVERIFIED — archive / no .git'}`,`Files scanned: ${r.source.sourceFileCount}`,`SDK onSnapshot call sites: ${r.counts.SDK_LISTENER||0}`,`Wrapper collection/document callers: ${(r.counts.COLLECTION_SUBSCRIBER||0)+(r.counts.DOCUMENT_SUBSCRIBER||0)}`,`Audit listener callers: ${(r.counts.AUDIT_FEED_SUBSCRIBER||0)+(r.counts.AUDIT_HISTORY_SUBSCRIBER||0)}`,`Notification caller locations: ${r.counts.NOTIFICATION_SUBSCRIBER||0}`,`Auth observer call sites (NOT Firestore): ${r.counts.AUTH_OBSERVER||0}`,`One-shot read call sites (NOT listeners): ${r.counts.ONE_SHOT_READ||0}`,`Source checksum: ${r.source.checksum}`,`Warnings: ${r.warnings.length}`,`Status: STATIC SITE INVENTORY ONLY; FIREBASE RUNTIME NOT MEASURED`].join('\n'); }
function md(r,prior) {
  const rows=r.sites.filter(s=>s.kind !== 'ONE_SHOT_READ').map(s=>`| \`${s.file}:${s.line}\` | ${s.kind} | ${s.sourceHint} | ${s.reviewLevel} | ${s.lifecycleHints.join(', ')||'MANUAL'} |`).join('\n');
  const diffs=prior?`## Perbandingan dengan file lama\n\nData dibawah perbandingan jumlah lokasi kode, bukan kinerja runtime.\n\n| Jenis | Sebelumnya | Saat ini | Selisih |\n|---|---:|---:|---:|\n${[...new Set([...Object.keys(prior.counts||{}),...Object.keys(r.counts)])].sort().map(key=>`| ${key} | ${(prior.counts||{})[key]||0} | ${r.counts[key]||0} | ${(r.counts[key]||0)-((prior.counts||{})[key]||0)} |`).join('\n')}\n\n`:'';
  return `# R86-E1 — Baseline Statis Listener Firestore\n\n**Sumber:** ${r.source.gitHead ? `Git commit \`${r.source.gitHead}\`` : 'Snapshot tanpa metadata Git — belum membuktikan source produksi terbaru'} (${r.source.gitBranch||'branch belum diketahui'}).\n\n**Waktu scan:** ${r.generatedAt}. **Mode:** ${r.source.astEngine}. **Source:** ${r.source.sourceFileCount} berkas. **Perubahan pada source:** nihil.\n\n## Ringkasan\n\n- Lokasi panggilan SDK \`onSnapshot\`: **${r.counts.SDK_LISTENER||0}** (statis; loop/dinamika tidak dieksekusi).\n- Lokasi pemanggil wrapper collection/document: **${(r.counts.COLLECTION_SUBSCRIBER||0)+(r.counts.DOCUMENT_SUBSCRIBER||0)}**.\n- Lokasi pemanggil feed notifikasi: **${r.counts.NOTIFICATION_SUBSCRIBER||0}**.\n- Lokasi pemanggil feed audit: **${(r.counts.AUDIT_FEED_SUBSCRIBER||0)+(r.counts.AUDIT_HISTORY_SUBSCRIBER||0)}**.\n- Pemanggil Auth observer (bukan Firestore listener): **${r.counts.AUTH_OBSERVER||0}**.\n- Lokasi baca satu-kali: **${r.counts.ONE_SHOT_READ||0}**, **bukan realtime listener**.\n\n${diffs}## Daftar lokasi kode\n\n| Lokasi | Jenis | Target indikatif | Tingkat review | Sinyal cleanup (bukan bukti) |\n|---|---|---|---|---|\n${rows}\n\n## Batas dan risiko\n\n${r.riskNotes.map(x=>`- ${x}`).join('\n')}\n\n## Next steps validasi di staging\n\n1. Catat HEAD GitHub lokal yang telah Fetch/Pull. Jalankan script ini di repository tersebut dengan opsi \`--out artifacts/r86e1\`.\n2. Dev/Preview dengan R86-A/B/C/D opt-in, rekam snapshot tiap tab untuk skenario 1, 2, 3, 5 tab. Lakukan pengujian tab foreground/background, logout, offline, update PWA.\n3. Bandingkan \`opened\`, \`active\`, \`closed\`, \`emissions\` R86-C per kategori; jangan disamakan dengan read Firebase berbayar.\n4. Catat Firestore billed document reads dari Firebase Console pada skenario setara secara terpisah dari callback SDK (jangan jalankan pengujian dengan akun/data sekolah sungguhan).\n5. Audit cleanup, keberadaan fallback data, pemulihan listener saat tab kembali, dan risiko izin sebelum menyetujui R86-E2.\n\n**Gate E2:** tidak ada listener presensi, autentikasi, notifikasi urgent, session recovery, antrean/offline yang dinonaktifkan hanya demi penghematan.\n`;
}
let prior=null;
if (compareArg) {const file=path.resolve(root,compareArg);prior=JSON.parse(fs.readFileSync(file,'utf8'));if(prior.schema!=='piket-guru-r86-e1/1') {console.error('STOP R86-E1: baseline perbandingan tidak cocok');process.exit(3);}}
if (outArg) {
  const dest=path.resolve(root,outArg);
  if (dest===root || dest===src || dest.startsWith(src+path.sep)) { console.error('STOP R86-E1: output tidak boleh di dalam src/'); process.exit(3); }
  fs.mkdirSync(dest,{recursive:true});
  const jsonPath=path.join(dest,'baseline.json'),mdPath=path.join(dest,'baseline.md');
  fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(mdPath,md(report,prior));
  console.log('Reports:',jsonPath,mdPath);
}
console.log(summary(report));
