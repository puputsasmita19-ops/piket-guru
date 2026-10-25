#!/usr/bin/env node
'use strict';
/** R86-B unit tests: simulated same-origin browser tabs (not Firebase). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root,'src/services/multitab/r86bSafeTabCoordination.ts'),'utf8');
const styles = fs.readFileSync(path.join(root,'src/services/multitab/r86bDecorative.css'),'utf8');
let checks=0;
function check(name,action){action();checks++;console.log('PASS',name)}
check('TypeScript syntax valid',()=>{
 const tree=ts.createSourceFile('r86bSafeTabCoordination.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.equal(tree.parseDiagnostics.length,0);
});
check('No Firebase, identity, storage, auth, or network APIs',()=>{
 const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
 assert.doesNotMatch(executable, /(?:localStorage|sessionStorage|indexedDB|OfflineStorage|DraftService|SyncQueueService|\bfetch\s*\(|XMLHttpRequest|\bFirestore\b|auth\.currentUser|user\.uid|navigator\.sendBeacon)/i);
 assert.doesNotMatch(source,/\.postMessage\(\s*\{[^}]*token|\.postMessage\(\s*\{[^}]*email/i);
});
check('Only three decorative animation selectors affected',()=>{
 for(const cls of ['.login-gradient-motion','.login-credit-track','.overflow-name[data-scrolling="true"]'])assert.ok(styles.includes(cls));
 for(const forbidden of ['.animate-spin','.flash-control','.offline','.presence','.presensi','.loading','.notification','.dashboard-flash'])assert.ok(!styles.includes(forbidden));
 assert.match(styles,/animation-play-state: paused !important/);
});
const compiled=ts.transpileModule(source.replace("import './r86bDecorative.css';",''),{
 fileName:'r86bSafeTabCoordination.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
let now=100000;
let id=0;
const channels=new Map();
const sent=[];
class FakeTarget {
 constructor(){this.events=new Map()}
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn)}
 removeEventListener(name,fn){this.events.get(name)?.delete(fn)}
 emit(name){for(const fn of [...(this.events.get(name)||[])])fn({type:name})}
 listenerCount(){return [...this.events.values()].reduce((a,b)=>a+b.size,0)}
}
class FakeElement {
 constructor(){this.attrs=new Map()}
 setAttribute(key,val){this.attrs.set(key,val)}
 removeAttribute(key){this.attrs.delete(key)}
 getAttribute(key){return this.attrs.get(key)||null}
}
class FakeChannel {
 constructor(name){this.name=name;this.closed=false;this.onmessage=null;const peers=channels.get(name)||new Set();peers.add(this);channels.set(name,peers)}
 postMessage(data){
  assert.deepEqual(Object.keys(data).sort(),['schema','signal','tab','visible'].sort(), 'R86-B wire payload must never contain identity');
  sent.push(data);
  for(const peer of channels.get(this.name)||[])if(peer!==this && !peer.closed)peer.onmessage?.({data});
 }
 close(){this.closed=true;channels.get(this.name)?.delete(this)}
}
function make({channel=true,initialVisibility='visible'}={}){
 const win=new FakeTarget();const doc=new FakeTarget();doc.documentElement=new FakeElement();doc.visibilityState=initialVisibility;
 const timers=new Map();let nextTimer=0;
 const context={exports:{},window:win,document:doc,BroadcastChannel:channel?FakeChannel:undefined,
  crypto:{randomUUID:()=>`tab-${++id}`},Date:{now:()=>now},Math,console:{info(){}},Map,Set,Object,
  setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimeout:ref=>timers.delete(ref)
 };
 vm.runInNewContext(compiled,context,{timeout:3000});
 const start=context.exports.startR86BSafeTabCoordination;
 const snapshot=()=>win.__PIKET_R86B__.snapshot();
 const quiet=()=>doc.documentElement.getAttribute('data-r86b-visual-quiet');
 const changeVisibility=value=>{doc.visibilityState=value;doc.emit('visibilitychange')};
 const pulse=()=>{const entry=[...timers.entries()][0];assert.ok(entry);timers.delete(entry[0]);entry[1].fn()};
 return {win,doc,start,snapshot,quiet,changeVisibility,timers,pulse};
}
const a=make();const stopA=a.start();
check('First visible tab has no quiet state',()=>{assert.equal(a.quiet(),null);assert.equal(a.snapshot().observedPeers,0)});
const b=make();const stopB=b.start();
check('Peers detected with ephemeral messages',()=>{
 assert.equal(a.snapshot().observedPeers,1);assert.equal(b.snapshot().observedPeers,1);
 assert.equal(a.snapshot().observedVisiblePeers,1);
});
check('Two visible tabs stay fully functional',()=>{assert.equal(a.quiet(),null);assert.equal(b.quiet(),null)});
a.changeVisibility('hidden');
check('Hidden tab with another visible peer becomes visual-only quiet',()=>{
 assert.equal(a.quiet(),'true');assert.equal(b.quiet(),null);
 assert.equal(a.snapshot().visualQuiet,true);
});
check('Pulse is slower for hidden tabs',()=>{
 assert.equal([...a.timers.values()][0].ms,40000);
 assert.equal([...b.timers.values()][0].ms,15000);
});
a.changeVisibility('visible');
check('Returning to tab immediately restores decorative visuals',()=>assert.equal(a.quiet(),null));
a.changeVisibility('hidden');b.changeVisibility('hidden');
check('No visible peer: no quiet state on either tab',()=>{assert.equal(a.quiet(),null);assert.equal(b.quiet(),null)});
b.changeVisibility('visible');
check('Tab can become quiet again after peer returns foreground',()=>assert.equal(a.quiet(),'true'));
b.win.emit('pagehide');
check('BFCache hide clears peer and quiet attribute',()=>{
 assert.equal(a.quiet(),null);assert.equal(b.timers.size,0);assert.equal(a.snapshot().observedPeers,0);
});
b.win.emit('pageshow');
check('BFCache restore reconnects peers',()=>{assert.equal(a.snapshot().observedPeers,1);assert.equal(a.quiet(),'true')});
check('Strict Mode repeated start does not add more timers',()=>{assert.equal(b.start(),stopB);assert.equal(b.timers.size,1)});
check('Stale foreground presence cannot leave hidden tab permanently quiet',()=>{
 now+=100000;
 a.snapshot();
 assert.equal(a.quiet(),null);
});
check('Heartbeat keeps peer awareness bounded',()=>{b.pulse();assert.equal(b.timers.size,1);assert.equal(a.snapshot().observedPeers,1)});
stopB();
check('Stopping peer clears quiet and releases subscriptions',()=>{
 assert.equal(a.quiet(),null);assert.equal(b.timers.size,0);assert.equal(b.win.listenerCount(),0);
 assert.equal(b.doc.listenerCount(),0);assert.equal(b.win.__PIKET_R86B__,undefined);
});
stopA();
check('Every timer, listener and visual attribute removed at stop',()=>{
 assert.equal(a.quiet(),null);assert.equal(a.timers.size,0);assert.equal(a.win.listenerCount(),0);assert.equal(a.doc.listenerCount(),0);
});
const c=make({channel:false,initialVisibility:'hidden'});const stopC=c.start();
check('Channel unavailable fails open (no forced passive mode)',()=>{
 assert.equal(c.snapshot().channelSupported,false);assert.equal(c.quiet(),null);stopC();
});
check('No backend or storage payload sent',()=>assert.ok(sent.every(data=>Object.keys(data).length===4)));
console.log(`R86-B safety simulator: ${checks}/${checks} PASS`);
