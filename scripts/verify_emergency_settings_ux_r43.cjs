const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const cardPath='src/features/settings/CommandCenterSettingsCard.tsx';
const pagePath='src/features/settings/SettingsView.tsx';
const card=fs.readFileSync(cardPath,'utf8');
const page=fs.readFileSync(pagePath,'utf8');
let checks=0;
const test=(name, fn)=>{fn();checks++; console.log('OK', name);};
for(const file of [cardPath,pagePath]) {
 test(`TSX syntax: ${file}`,()=>{
  const r=ts.transpileModule(fs.readFileSync(file,'utf8'),{
   fileName:file, compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020},reportDiagnostics:true
  });
  assert.equal(r.diagnostics?.length||0,0,(r.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
 });
}
const AST=ts.createSourceFile(cardPath,card,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
test('6 distinct configuration categories',()=>{
 const keys=['command','bell','schedule','emergency','additional','contacts'];
 for(const key of keys) assert(card.includes(`key:'${key}'`),key);
 assert(card.includes('data-emergency-setting-overview'));
});
test('overview and editor separated',()=>{
 assert(card.includes('{!editing ? <>'));
 assert(card.includes('beginEdit(key)'));
 assert(card.includes('Kembali ke kategori'));
});
test('safe editing with unsaved guard',()=>{
 assert(card.includes('window.confirm('));
 assert(card.includes('beforeunload'));
 assert(card.includes('disabled={saving || !dirty}'));
});
test('responsive navigation no sideways scroll',()=>{
 assert(card.includes('sm:hidden'));
 assert(card.includes('hidden sm:grid'));
 assert(card.includes('grid grid-cols-2 sm:grid-cols-3 gap-2'));
 assert(!card.includes('role="tablist" aria-label="Kategori konfigurasi Pusat Komando">\n        {(['));
});
test('sticky save controls available',()=>{
 assert(card.includes('data-emergency-save-bar'));
 assert(card.includes('sticky top-16 sm:top-20'));
});
test('firebase save conflict baseline preserved',()=>{
 assert(card.includes('SchoolSettingsService.saveCommandCenterConfig(draft, currentUser.id, original)'));
 assert(card.includes('onUpdated(result.settings)'));
});
test('direct shortcuts from Pusat Komando remain',()=>{
 assert(card.includes('focusRequest?.sequence'));
 assert(card.includes('setTab(focusRequest.tab)'));
 assert(page.includes("openEmergencyEditor('emergency'"));
 assert(page.includes("openEmergencyEditor('schedule'"));
});
test('operational broadcast visually separated',()=>{
 assert(page.includes('Pratinjau & Operasional Bel/Darurat'));
 assert(page.includes('dapat mengirim peringatan sungguhan'));
});
test('no new invocation to trigger emergency in editor',()=>{
 assert(!card.includes('EmergencyService.triggerEmergency('));
});
test('config input fields remain present',()=>{
 for(const key of ['commandPost.primary','scheduledBells','bellLabels','emergencyOptions','customEmergencies','emergencyContacts','protocolSteps']) assert(card.includes(key),key);
});
test('no TypeScript parser diagnostics',()=>{
 assert.equal(AST.parseDiagnostics.length,0);
});
console.log(`SUCCESS: ${checks}/${checks} checks R43 passed.`);
