const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const tour = fs.readFileSync('src/components/guide/InteractiveGuideTour.tsx','utf8');
const geom = fs.readFileSync('src/components/guide/guidePositioning.ts','utf8');
const attendance = fs.readFileSync('src/features/attendance/AttendancePreview.tsx','utf8');
const css = fs.readFileSync('src/index.css','utf8');
let passed=0;
function verify(name,fn){fn();passed++; console.log('PASS',name)}
for (const [path,source] of [
  ['InteractiveGuideTour.tsx',tour],
  ['guidePositioning.ts',geom],
  ['AttendancePreview.tsx',attendance],
]){
  verify(`${path}: no syntax diagnostics`,()=>{
    const parsed=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
    assert.deepEqual((parsed.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
  });
}
const ctx={exports:{}};
vm.runInNewContext(ts.transpileModule(geom,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
const {getGuideAreas,clipGuideFocus,needsGuideScroll}=ctx.exports;
verify('Mobile layout makes space for both target and tutorial',()=>{
  const g=getGuideAreas(360,760,300,75,false);
  assert.equal(g.mobile,true);
  assert(g.cardTop>380 && g.focusBottom<g.cardTop && g.focusTop>75);
});
verify('Focus stays outside card even with oversized target',()=>{
  const g=getGuideAreas(360,760,300,75,false);
  const rect=clipGuideFocus({top:90,left:20,width:310,height:660},360,g.focusTop,g.focusBottom);
  assert(rect && rect.top>=g.focusTop && rect.top+rect.height<=g.focusBottom);
});
verify('Offscreen GPS target triggers scroll',()=>{
  const g=getGuideAreas(360,760,300,75,false);
  assert(needsGuideScroll({top:690,left:30,width:230,height:44},g.focusTop,g.focusBottom));
});
verify('Visible target does not trigger extra scroll',()=>{
  const g=getGuideAreas(360,760,300,75,false);
  assert(!needsGuideScroll({top:165,left:30,width:230,height:44},g.focusTop,g.focusBottom));
});
verify('Mobile navigation tour docks card above target',()=>{
  const g=getGuideAreas(360,760,305,75,true);
  assert(g.cardTop<120 && g.focusTop>g.cardTop+305 && g.focusBottom>700);
});
verify('Completely occluded target is not highlighted',()=>{
  const g=getGuideAreas(360,760,300,75,false);
  assert.equal(clipGuideFocus({top:600,left:20,width:250,height:44},360,g.focusTop,g.focusBottom),null);
});
verify('Guide selects precise GPS button before panel',()=>{
  assert(tour.indexOf("'[data-tour=\"refresh-gps-button\"]'")<tour.indexOf("'[data-tour=\"gps-status\"]'"));
});
verify('Guide selects actual selfie trigger before section',()=>{
  assert(tour.indexOf("'[data-tour=\"selfie-trigger\"]'")<tour.indexOf("'[data-tour=\"camera-section\"]'"));
});
verify('Guide uses actual check-in/out/completed controls',()=>{
  for(const name of ['checkin-button','checkout-button','attendance-complete']){
    assert(tour.includes(`[data-tour="${name}"]`));
    assert(attendance.includes(`data-tour="${name}"`));
  }
});
verify('Guide does not fall back to generic attendance page for GPS/selfie/submit',()=>{
  for(const block of ['guru-gps', 'guru-selfie', 'guru-submit']){
    const slice=tour.split(`id: '${block}'`)[1].split('  },')[0];
    assert(!slice.includes('attendance-container'), `${block} should not use page-wide fallback`);
  }
});
verify('Guide auto-scrolls on mobile with deterministic anchoring',()=>{
  assert(tour.includes('element.scrollIntoView('));
  assert(tour.includes('scrollMarginTop'));
  assert(!tour.includes('new MutationObserver('));
});
verify('Guide presents an explicit marker and missing-selfie note',()=>{
  assert(tour.includes('guide-target-flag') && tour.includes('sudah check-in'));
  assert(tour.includes("targetState === 'missing'"));
});
verify('Extra scroll area exists only when guide is active on mobile',()=>{
  assert(css.includes('.guide-tour-active .app-content'));
  assert(tour.includes("document.documentElement.classList.remove('guide-tour-active')"));
});
verify('Guide dialog has compact mobile height and easy-to-tap controls',()=>{
  assert(tour.includes('size.height * .44'));
  assert(css.includes('.guide-card-guided footer'));
});
console.log(`OK: ${passed} pemeriksaan sorotan panduan mobile R24 lulus.`);
