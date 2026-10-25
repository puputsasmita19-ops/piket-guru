#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/services/diagnostics/r86TabAudit.ts'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
let tests = 0;
function check(name, action) { action(); tests++; console.log('PASS', name); }
check('TypeScript diagnostics parse', () => {
  const parsed = ts.createSourceFile('r86TabAudit.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0);
  const main = ts.createSourceFile('main.tsx', bootstrap, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(main.parseDiagnostics.length,0);
});
check('DEV or staging build opt-in; URL opt-in required', () => {
  assert.match(bootstrap,/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_R86_AUDIT === 'enabled'/);
  assert.match(bootstrap,/get\('r86_audit'\) === '1'/);
  assert.match(bootstrap,/void import\('\.\/services\/diagnostics\/r86TabAudit'\)/);
});
check('No business imports and no storage mutations', () => {
  assert.doesNotMatch(source,/\bimport\s+[^()]/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|Firestore|OfflineStorage|DraftService|SyncQueueService|auth\.currentUser|fetch\(/);
});
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
let logicalNow = 1234000;
const channelRegistry = new Map();
const messageHistory = [];
const timers = new Map();
let nonce = 0;
class FakeEventTarget {
  constructor() {this.handlers = new Map();}
  addEventListener(name, fn) {const hs = this.handlers.get(name) || new Set(); hs.add(fn); this.handlers.set(name, hs);}
  removeEventListener(name, fn) {this.handlers.get(name)?.delete(fn);}
  emit(name) {for(const fn of [...(this.handlers.get(name) || [])]) fn({type:name});}
  count() {return [...this.handlers.values()].reduce((total,set)=>total+set.size,0);}
}
class FakeChannel {
  constructor(name) {this.name=name;this.onmessage=null;this.closed=false;const set=channelRegistry.get(name)||new Set();set.add(this);channelRegistry.set(name,set);}
  postMessage(data) {
    messageHistory.push(data);
    for(const peer of channelRegistry.get(this.name)||[]) if(peer!==this&&!peer.closed)peer.onmessage?.({data});
  }
  close() {this.closed=true;channelRegistry.get(this.name)?.delete(this);}
}
function instance({withChannel=true}={}) {
  const win=new FakeEventTarget();
  const doc=new FakeEventTarget();doc.visibilityState='visible';
  let sequence=0;
  const intervalIds = new Set();
  const mod={exports:{}};
  const context={
    window:win,document:doc,navigator:{onLine:true},crypto:{randomUUID:()=>`audit-${++nonce}`},
    BroadcastChannel:withChannel?FakeChannel:undefined,
    Date:{now:()=>logicalNow},Math,Map,Set,Promise,Object,console:{info:()=>{}},
    setInterval(fn,ms){const id=++sequence;timers.set(win+':'+id,{fn,ms});intervalIds.add(win+':'+id);return id;},
    clearInterval(id){timers.delete(win+':'+id);intervalIds.delete(win+':'+id);}
  };
  vm.runInNewContext('(function(module,exports){'+code+'})',context)(mod,mod.exports);
  return {win,doc,start:mod.exports.startR86TabAudit,intervalIds};
}
const a=instance();const b=instance();
const stopA=a.start();const stopB=b.start();
check('Distinct tabs detect one another',()=>{
  assert.equal(a.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,1);
  assert.equal(b.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,1);
});
check('Audit fields contain counts, not identities or offline data',()=>{
  const snap=a.win.__PIKET_R86_AUDIT__.snapshot();
  assert.equal(snap.offlineDraftCount,'NOT_READ');
  assert.equal(snap.offlineQueueCount,'NOT_READ');
  assert.equal(snap.listenerCount,'NOT_INSTRUMENTED');
  assert.equal(JSON.stringify(snap).includes('audit-'),false);
  assert.ok(Object.isFrozen(snap));
  const allowed=['version','type','tab','visible'];
  assert.ok(messageHistory.length>0);
  for(const msg of messageHistory){assert.deepEqual(Object.keys(msg).sort(),allowed.sort());assert.ok(/^audit-/.test(msg.tab));}
});
check('Event counters and visibility state change',()=>{
  a.doc.visibilityState='hidden';a.doc.emit('visibilitychange');
  a.win.emit('blur');a.win.emit('offline');
  const snap=a.win.__PIKET_R86_AUDIT__.snapshot();
  assert.equal(snap.visibility,'hidden');
  assert.equal(snap.counts.visibilityChanges,1);
  assert.equal(snap.counts.blurEvents,1);
  assert.equal(snap.counts.offlineEvents,1);
  assert.equal(b.win.__PIKET_R86_AUDIT__.snapshot().observedVisiblePeers,0);
});
check('BFCache pagehide/pageshow pause and resume peer observation',()=>{
  a.win.emit('pagehide');
  assert.equal(b.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,0);
  assert.equal(a.intervalIds.size,0);
  a.doc.visibilityState='visible';a.win.emit('pageshow');
  assert.equal(b.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,1);
  assert.equal(a.intervalIds.size,1);
});
check('Strict-mode double start is idempotent',()=>{
  assert.equal(a.start(),stopA);assert.equal(a.intervalIds.size,1);
});
check('Stopped tab does not remain in peer count',()=>{
  stopB();assert.equal(a.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,0);
  assert.equal(b.win.__PIKET_R86_AUDIT__,undefined);
  assert.equal(b.intervalIds.size,0);
});
check('All listeners and intervals released',()=>{
  stopA();assert.equal(a.intervalIds.size,0);assert.equal(a.win.count(),0);assert.equal(a.doc.count(),0);
  assert.equal(a.win.__PIKET_R86_AUDIT__,undefined);
});
check('Fallback without BroadcastChannel is safe',()=>{
  const c=instance({withChannel:false});const stop=c.start();
  assert.equal(c.win.__PIKET_R86_AUDIT__.snapshot().channelSupported,false);
  assert.equal(c.win.__PIKET_R86_AUDIT__.snapshot().observedPeers,0);
  stop();assert.equal(c.win.count(),0);
});
console.log(`R86-A simulated multi-tab checks: ${tests}/${tests} PASS`);
