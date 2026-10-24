'use strict';
// R72: a stable, clearly visible target is preferable to pulsing/animated outlines.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const t=fs.readFileSync('src/components/guide/InteractiveGuideTour.tsx','utf8');
const css=fs.readFileSync('src/index.css','utf8');
const out=ts.transpileModule(t,{fileName:'InteractiveGuideTour.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
assert.equal((out.diagnostics||[]).length,0);
assert(t.includes('[data-tour="sync-status"] button'),'Prefer actual header control');
assert(t.includes('[data-tour="attendance-actions"]')&&t.includes('[data-tour="attendance-complete"]'),'Retain selfie fallback');
assert(t.includes('data-guide-active-target')&&t.includes('headerTarget ? 8 : region.focusTop'),'Retain live target and header handling');
assert(t.includes('Bagian yang dijelaskan sedang disorot'),'Retain understandable target explanation');
assert(css.includes('.guide-spotlight') && css.includes('.guide-target-flag {'),'Spotlight and marker both styled');
assert(css.includes('animation: none !important'),'Guide card cannot wobble from entrance animation');
console.log('R72 revised R25 guide target checks: 7/7 PASS');
