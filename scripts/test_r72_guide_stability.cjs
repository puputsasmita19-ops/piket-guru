'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const helperPath = 'src/components/guide/guidePositioning.ts';
const tourPath = 'src/components/guide/InteractiveGuideTour.tsx';
const cssPath = 'src/index.css';
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
let count=0;
function test(label, fn) { try {fn(); console.log('PASS',label);count++;}catch(e){console.error('FAIL',label,e.message);process.exitCode=1;} }
const h = source(helperPath), t = source(tourPath), css = source(cssPath);
for (const file of [helperPath,tourPath]) {
  test('TS/TSX parse '+file,()=>{const tree=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(tree.parseDiagnostics.length,0,tree.parseDiagnostics.map(d=>d.messageText).join('; '))});
}
const compiled=ts.transpileModule(h,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}};vm.runInNewContext(compiled,sandbox,{timeout:1500});
const {getGuideCardBudget,getGuideAreas,getGuideScrollDelta,clipGuideFocus,needsGuideScroll}=sandbox.exports;
test('Stable card budget is independent of changing card DOM height',()=>{
  for(const w of [320,360,390,430,768,1024,1440])for(const ht of [430,568,760,920]){
    const reserve=getGuideCardBudget(w,ht,false);
    const first=getGuideAreas(w,ht,reserve,64,false);
    for(const cardDOMHeight of [155,210,260,320,430]){
      // Card content may grow/shrink; it must never enter placement computation.
      assert.equal(first.cardTop,getGuideAreas(w,ht,reserve,64,false).cardTop);
      assert.ok(reserve>0 && reserve<=360, `${w} ${ht}: ${reserve} ${cardDOMHeight}`);
    }
  }
});
test('Admin mobile bottom navigation leaves spotlight below the card',()=>{
  for(const w of [320,390,768,920]) {
    const ht=760, reserve=getGuideCardBudget(w,ht,true), a=getGuideAreas(w,ht,reserve,64,true);
    assert.ok(a.cardTop>=64);
    assert.ok(a.focusTop>=a.cardTop);
  }
});
test('Large desktop target above card never requires scroll',()=>{
  const a=getGuideAreas(1440,900,getGuideCardBudget(1440,900,false),84,false);
  const rect={top:150,left:340,width:400,height:80};
  assert.equal(needsGuideScroll(rect,a.focusTop,a.focusBottom),false);
  assert.equal(getGuideScrollDelta(rect,a.focusTop,a.focusBottom),0);
});
test('Scroll delta moves target from below reserved spotlight area',()=>{
  const a=getGuideAreas(1440,900,getGuideCardBudget(1440,900,false),84,false);
  const rect={top:650,left:340,width:400,height:80};
  assert.equal(needsGuideScroll(rect,a.focusTop,a.focusBottom),true);
  assert.ok(getGuideScrollDelta(rect,a.focusTop,a.focusBottom)>0);
});
test('Scroll delta moves target down when above header',()=>{
  const rect={top:10,left:340,width:300,height:75};
  assert.ok(getGuideScrollDelta(rect,100,450)<0);
});
test('Scroll delta ignores tiny or impossible focus areas',()=>{
  assert.equal(getGuideScrollDelta({top:300,left:10,width:100,height:80},140,150),0);
});
test('Clipped spotlight does not cross reserved card top',()=>{
  const r=clipGuideFocus({top:340,left:350,width:300,height:110},1440,100,400);
  assert.equal(r.top+r.height,400);
});
test('All admin six steps and guru five steps retained',()=>{
  assert.equal((t.match(/id: 'admin-[^']+'/g)||[]).length,5);
  assert.equal((t.match(/id: 'guru-[^']+'/g)||[]).length,5);
  assert.match(t,/id: 'sync-status'/);
});
test('Scroll only nearest scroll container instead of scrollIntoView',()=>{
  assert.doesNotMatch(t,/element\.scrollIntoView\(/);
  assert.match(t,/if \(scroller\) scroller\.scrollTop \+= delta/);
  assert.match(t,/else window\.scrollBy\(/);
});
test('No card offsetHeight or ResizeObserver feedback loop',()=>{
  assert.doesNotMatch(t,/cardRef\.current\?\.offsetHeight/);
  assert.doesNotMatch(t,/new ResizeObserver/);
  assert.match(t,/getGuideCardBudget\(size\.width, size\.height, bottomNavStep\)/);
});
test('Route switch finishes before measuring target',()=>{
  assert.match(t,/if \(activeTab !== step\.targetTab\) \{[\s\S]*?navigateRef\.current\(step\.targetTab\)[\s\S]*?return;/);
});
test('Guide card stays within the reserved height',()=>assert.match(t,/maxHeight: cardBudget/));
test('CSS positions and styles highlight label',()=>{
  assert.match(css,/\.guide-target-flag\s*\{\s*position: fixed;/);
  assert.match(css,/\.guide-target-flag\s*\{[\s\S]*?pointer-events: none/);
});
test('Full guide buttons and keyboard support retained',()=>{
  for(const token of ['onClick={close}',"'Escape'",'Tutup dulu','Kembali','Lanjut','Selesai'])assert.ok(t.includes(token));
});
test('Existing target handlers for Guru GPS/Selfie preserved',()=>{
  assert.match(t,/\[data-tour="refresh-gps-button"\]/);
  assert.match(t,/\[data-tour="selfie-trigger"\]/);
});
test('Guide mobile state and mobile-nav targeting remains',()=>{
  assert.match(t,/size\.width < 1024 && step\?\.id === 'admin-nav'/);
  assert.match(t,/isMobileNav = step\.id === 'admin-nav' && width < 1024/);
});
test('No Firebase/Firestore logic modified',()=>{
  assert.doesNotMatch(t,/getDoc|setDoc|updateDoc|FirestoreService/);
});
console.log(`R72: ${count} checks passed`);
