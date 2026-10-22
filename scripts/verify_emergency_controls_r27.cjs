const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
let checks=0;
const check=(value,message)=>{ assert.ok(value,message); checks++; };
const paths=[
  'src/types/commandCenterConfig.types.ts',
  'src/features/settings/CommandCenterSettingsCard.tsx',
  'src/features/settings/BellEmergencyAutomationCard.tsx',
  'src/features/settings/SettingsView.tsx',
];
for(const file of paths){
  const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  check(!(result.diagnostics || []).length,`Valid syntax: ${file}`);
}
const source=fs.readFileSync(paths[0],'utf8');
const mod={}; vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod});
const {normalizeCommandCenterConfig:normalize,validateCommandCenterConfig:validate,EMERGENCY_TYPES:types}=mod;
const before=normalize({heading:'Sekolah Uji'});
check(types.length===5,'All five emergency categories supported');
check(types.every(t=>before.emergencyOptions[t]?.label && before.emergencyOptions[t]?.operatorChecklist),'Older saved configs get safe per-category defaults');
check(validate(before).length===0,'Old config stays valid');
check(before.heading==='Sekolah Uji','Existing heading persists');
const edited=normalize({emergencyOptions:{...before.emergencyOptions,FIRE:{label:'Api dan Asap',description:'Petugas lapangan melaporkan asap.',operatorChecklist:'Konfirmasi lokasi asap, hubungi koordinator, dan petugas berwenang.',contactId:'FIRE'}}});
check(edited.emergencyOptions.FIRE.label==='Api dan Asap','Edited label persists');
check(edited.emergencyOptions.EARTHQUAKE.label===before.emergencyOptions.EARTHQUAKE.label,'Independent settings do not change other categories');
check(validate(edited).length===0,'Edited config validates');
check(edited.emergencyOptions.FIRE.contactId==='FIRE','Configured contact persisted');
const missing=JSON.parse(JSON.stringify(edited)); missing.emergencyOptions.FIRE.operatorChecklist='pendek';
check(validate(missing).some(e=>e.includes('Checklist operator FIRE')),'Short operator checklist rejected');
const invalid=JSON.parse(JSON.stringify(edited)); invalid.emergencyOptions.FIRE.contactId='https://example.com';
check(validate(invalid).some(e=>e.includes('Kontak rujukan FIRE')),'Unknown contact blocked');
check(normalize(invalid).emergencyOptions.FIRE.contactId==='FIRE','Unsafe contact falls back to safe known enum');
const wrong=normalize({emergencyOptions:{FIRE:{label:'Uji',description:'Uji data',operatorChecklist:'Daftar periksa pemadam yang memadai.',contactId:'CUSTOM'}}});
check(wrong.emergencyOptions.FIRE.contactId==='FIRE','Partial configuration cannot inject arbitrary contact IDs');
const editor=fs.readFileSync(paths[1],'utf8');
check(editor.includes("setSelectedEmergency(type)") && editor.includes('focusRequest?.sequence'),'Editor selects requested category');
check(editor.includes('Checklist operator') && editor.includes('Nama tombol siaga') && editor.includes('Pesan / instruksi saat siaran'),'Editor fields exist per category');
check(editor.includes('saveCommandCenterConfig(draft, currentUser.id, original)'),'Config uses existing audited admin service');
check(!editor.includes('EmergencyService.triggerEmergency('),'Saving editor does not trigger broadcast');
const cards=fs.readFileSync(paths[2],'utf8');
check(cards.includes('EMERGENCY_TYPES.map(type =>') && cards.includes('liveConfig.emergencyOptions[type]'),'All cards read live configured data');
check(cards.includes('onConfigureEmergency(type)'),'Each card has independent edit shortcut');
check(cards.includes('onConfigureSchedule'),'Schedule has edit shortcut');
check(cards.includes('onClick={() => openTriggerModal(type)}') && cards.includes('handleBroadcastEmergency'),'Viewing emergency remains separate from broadcast action');
check(cards.includes('operatorChecklist') && cards.includes('Kontak rujukan:'),'Confirmation surfaces operator notes and contact');
const view=fs.readFileSync(paths[3],'utf8');
check(view.includes('focusRequest={emergencyEditorRequest}') && view.includes('onConfigureEmergency='),'Shortcut wired through SettingsView');
console.log(`OK ${checks}/${checks} checks: per-feature emergency settings and safe confirmation.`);
