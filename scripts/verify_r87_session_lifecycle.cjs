'use strict';
/** Deterministic unit checks of the existing background monitor with newly supported delays.
 * Does not load Firebase or open network sessions. Intended to run in repository root.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root=path.resolve(__dirname,'..');
const policyTs=fs.readFileSync(path.join(root,'src/types/sessionPolicy.types.ts'),'utf8');
const monitorTs=fs.readFileSync(path.join(root,'src/services/auth/backgroundSession.ts'),'utf8');
const transpile=(code,fileName)=>ts.transpileModule(code,{fileName,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(device='mobile'){
 const clock={now:100_000,hidden:false,timers:new Map(),id:0,expired:0};
 class Target{constructor(){this.listeners=new Map()}addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn)}removeEventListener(k,fn){this.listeners.get(k)?.delete(fn)}dispatchEvent(e){for(const fn of [...(this.listeners.get(e.type)||[])])fn(e)}}
 class Input extends Target{constructor(){super();this.type='file'}}
 const window=new Target(),document=new Target();Object.defineProperty(document,'hidden',{get:()=>clock.hidden});
 const store=new Map();const navigator={userAgent:device==='mobile'?'Mozilla/5.0 (Linux; Android 14) Mobile':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:device==='mobile'?'Linux armv8l':'Win32',maxTouchPoints:device==='mobile'?5:0};
 const common={window,document,navigator,HTMLInputElement:Input,Event:class{constructor(type){this.type=type}},Date:class extends Date{static now(){return clock.now}},sessionStorage:{getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v)},setTimeout:(fn,ms)=>{const id=++clock.id;clock.timers.set(id,{fn,at:clock.now+ms});return id},clearTimeout:id=>clock.timers.delete(id)};
 const p={};vm.runInNewContext(transpile(policyTs,'sessionPolicy.types.ts'),{...common,exports:p,module:{exports:p}});
 const m={};vm.runInNewContext(transpile(monitorTs,'backgroundSession.ts'),{...common,exports:m,module:{exports:m},require:id=>{if(!id.includes('sessionPolicy.types'))throw Error('Unexpected import: '+id);return p}});
 const hide=()=>{clock.hidden=true;document.dispatchEvent({type:'visibilitychange'})};
 const show=()=>{clock.hidden=false;document.dispatchEvent({type:'visibilitychange'})};
 const advance=(ms,fire=true)=>{clock.now+=ms;if(!fire)return;for(let i=0;i<20;i++){const due=[...clock.timers].filter(([,t])=>t.at<=clock.now);if(!due.length)break;for(const[id,t]of due){clock.timers.delete(id);t.fn()}}};
 const start=(seconds,enabled=true)=>{m.completeBackgroundLogin('teacher');const monitor=m.monitorBackgroundSession('teacher',()=>{clock.expired++});monitor.update({mobile:{backgroundLogoutEnabled:enabled,backgroundDelaySeconds:seconds},desktop:{backgroundLogoutEnabled:enabled,backgroundDelaySeconds:seconds}});return monitor};
 return{clock,m,p,hide,show,advance,start};
}
let passed=0;
const check=(label,fn)=>{try{fn();passed++;console.log('PASS',label)}catch(e){process.exitCode=1;console.error('FAIL',label,e.stack)}};
for(const delay of [600,900,1800,3600,7200]){
 check(`mobile background delay ${delay}s works at exact deadline`,()=>{
  const t=fixture('mobile'),monitor=t.start(delay);t.hide();t.advance(delay*1000-1);assert.equal(t.clock.expired,0);t.advance(1);assert.equal(t.clock.expired,1);monitor.stop();
 });
 check(`desktop delayed restore after ${delay}s requires login`,()=>{
  const t=fixture('desktop'),monitor=t.start(delay);t.hide();t.advance(delay*1000+1,false);t.show();assert.equal(t.clock.expired,1);monitor.stop();
 });
}
check('returning before 30m cancels the re-login timer',()=>{const t=fixture(),m=t.start(1800);t.hide();t.advance(1_200_000);t.show();t.advance(2_000_000);assert.equal(t.clock.expired,0);m.stop()});
check('turned OFF keeps existing behavior',()=>{const t=fixture(),m=t.start(1800,false);t.hide();t.advance(9_999_999);t.show();assert.equal(t.clock.expired,0);m.stop()});
check('policy update to longer duration preserves elapsed background time',()=>{const t=fixture(),m=t.start(600);t.hide();t.advance(590_000);m.update({mobile:{backgroundLogoutEnabled:true,backgroundDelaySeconds:1800},desktop:{backgroundLogoutEnabled:true,backgroundDelaySeconds:1800}});t.advance(1_210_000);assert.equal(t.clock.expired,1);m.stop()});
console.log(`R87 Session Lifecycle: ${passed}/13 passed`);
if(passed!==13)process.exitCode=1;
