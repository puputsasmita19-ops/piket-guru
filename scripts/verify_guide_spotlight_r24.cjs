'use strict';
// Supersedes R24's scrollIntoView/ResizeObserver expectations with R72 behavior.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const tour=fs.readFileSync('src/components/guide/InteractiveGuideTour.tsx','utf8');
const geom=fs.readFileSync('src/components/guide/guidePositioning.ts','utf8');
const css=fs.readFileSync('src/index.css','utf8');
let passed=0;
const check=(label,condition)=>{assert.ok(condition,label);passed++;console.log('PASS',label)};
for(const [file,text] of [['InteractiveGuideTour.tsx',tour],['guidePositioning.ts',geom]]) {
 const result=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 check('Valid TS/TSX '+file,(result.diagnostics||[]).length===0);
}
check('Actual GPS target before section',tour.indexOf('[data-tour="refresh-gps-button"]')<tour.indexOf('[data-tour="gps-status"]'));
check('Actual selfie target before section',tour.indexOf('[data-tour="selfie-trigger"]')<tour.indexOf('[data-tour="camera-section"]'));
check('Navigation/GPS/Selfie/Submit tour steps remain', ['admin-nav','guru-gps','guru-selfie','guru-submit'].every(name=>tour.includes(`id: '${name}'`)));
check('Guide waits for active tab before measure',tour.includes('if (activeTab !== step.targetTab) {'));
check('No scrollIntoView multi-ancestor shake', !tour.includes('element.scrollIntoView('));
check('Scroll nearest container',tour.includes('scroller.scrollTop += delta'));
check('Guide position independent from actual card height',!tour.includes('cardRef.current?.offsetHeight') && tour.includes('getGuideCardBudget('));
check('No ResizeObserver feedback loop',!tour.includes('new ResizeObserver'));
check('Mobile/tablet bottom nav gets focus region',geom.includes('isBottomNavigationStep && viewportWidth < 1024'));
check('Guide pointer marker positioned',css.includes('.guide-target-flag {') && /\.guide-target-flag\s*\{\s*position:\s*fixed/.test(css));
check('Guide constrained to viewport budget',tour.includes('maxHeight: cardBudget'));
check('Respect reduced-motion preference',css.includes('@media (prefers-reduced-motion: reduce)'));
check('Guide card motion disabled for stability',css.includes('animation: none !important'));
check('Keyboard Escape retained',tour.includes("event.key === 'Escape'"));
console.log(`R72 revised R24 checks: ${passed}/${passed} PASS`);
