const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const files = [
  'src/types/commandCenterConfig.types.ts',
  'src/features/settings/CommandCenterSettingsCard.tsx',
  'src/features/settings/BellEmergencyAutomationCard.tsx',
  'src/features/settings/SettingsView.tsx',
  'src/features/command-center/CommandCenterPreview.tsx',
  'src/features/command-center/EmergencyBroadcastModal.tsx',
  'src/services/firebase/schoolSettingsService.ts',
];
for (const file of files) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  check(!(compiled.diagnostics || []).length, `Syntax valid: ${file}`);
}
const typeSource = fs.readFileSync(files[0], 'utf8');
const output = ts.transpileModule(typeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modExports = {};
vm.runInNewContext(output, { exports: modExports });
const { normalizeCommandCenterConfig: normalize, validateCommandCenterConfig: validate } = modExports;
const old = normalize({ heading: 'Komando Sekolah Lama' });
check(old.heading === 'Komando Sekolah Lama', 'Legacy heading persists');
check(old.customEmergencies.length === 0, 'Old settings get empty custom scenarios');
check(old.commandPost.primary === 'Belum ditetapkan', 'Old settings have honest command-post fallback');
check(validate(old).length === 0, 'Old settings remain valid');
const scenario = {
  id: 'scenario_banjir_01', label: 'Banjir', description: 'Air memasuki lingkungan sekolah',
  title: 'Siaga Banjir Sekolah', message: 'Petugas diminta memeriksa jalur evakuasi yang telah ditetapkan.',
  operatorChecklist: 'Konfirmasi ketinggian air dan keselamatan jalur bersama koordinator.',
  contactId: 'BPBD', isActive: true,
};
const next = normalize({ ...old,
  commandPost: {primary:'Pos Utama Gedung A',details:'Lantai 1',alternate:'Ruang Serbaguna',assemblyPoint:'Lapangan Utama',instructions:'Ikuti rambu posko.'},
  customEmergencies:[scenario] });
check(next.commandPost.primary === 'Pos Utama Gedung A', 'Editable command-post location persisted');
check(next.commandPost.assemblyPoint === 'Lapangan Utama', 'Assembly point persisted');
check(next.customEmergencies[0].label === 'Banjir', 'Custom hazard persisted');
check(validate(next).length === 0, 'Valid custom scenario passes');
check(normalize(next).customEmergencies.length === 1, 'Roundtrip keeps custom scenario');
check(next.emergencyOptions.EARTHQUAKE.label === old.emergencyOptions.EARTHQUAKE.label, 'Existing 5 emergency types remain intact');
const duplicate = JSON.parse(JSON.stringify(next)); duplicate.customEmergencies.push({ ...scenario, id:'scenario_banjir_02'});
check(validate(duplicate).some(e=>e.includes('harus unik')), 'Duplicate labels blocked');
const badId = JSON.parse(JSON.stringify(next)); badId.customEmergencies[0].id='../../bad';
check(validate(badId).some(e=>e.includes('ID jenis')), 'Invalid custom IDs blocked');
const badMessage = JSON.parse(JSON.stringify(next)); badMessage.customEmergencies[0].message='Pendek';
check(validate(badMessage).some(e=>e.includes('Judul atau pesan')), 'Short safety messages blocked');
const inactive = JSON.parse(JSON.stringify(next)); inactive.customEmergencies[0].isActive=false;
check(!inactive.customEmergencies[0].isActive && validate(inactive).length===0,'Inactive scenarios remain stored and valid');
const many = normalize({...next, customEmergencies: Array.from({length:14}, (_,i)=>({...scenario,id:`scenario_${i}`, label:`Banjir ${i}`}))});
check(many.customEmergencies.length===12, 'Input limited to 12 custom scenarios');
const unknown = normalize({...next, customEmergencies:[{...scenario,contactId:'http://invalid'}]});
check(unknown.customEmergencies[0].contactId==='BPBD', 'Contact ID limited to known entries');
const editor = fs.readFileSync(files[1], 'utf8');
check(editor.includes('Tambah Jenis Bencana') && editor.includes('Lokasi Posko / Pusat Komando'), 'Admin editor contains both features');
check(editor.includes("saveCommandCenterConfig(draft, currentUser.id, original)"), 'Uses existing Admin-only transaction');
check(!editor.includes('EmergencyService.triggerEmergency'), 'Editor never broadcasts an emergency');
const card = fs.readFileSync(files[2], 'utf8');
check(card.includes('customEmergencies.filter(item=>item.isActive)') && card.includes('openCustomScenario'), 'Active custom scenarios visible in Bell & Emergency');
check(card.includes("setSelectedEmergencyType('GENERAL')"), 'Custom broadcast is mapped to existing GENERAL enum');
check(card.includes('selectedCustomId && !liveConfig.customEmergencies.some'), 'Disabled stale scenario blocked before broadcast');
const center = fs.readFileSync(files[4], 'utf8');
check(center.includes('commandConfig.commandPost.primary') && center.includes('commandConfig.customEmergencies.filter'), 'Command Center displays location and custom scenarios');
const modal = fs.readFileSync(files[5], 'utf8');
check(modal.includes('Panduan Siaga Tambahan') && modal.includes('config.commandPost.primary'), 'Command Center detail shows location and instructions');
const settings = fs.readFileSync(files[3], 'utf8');
check(settings.includes("openEmergencyEditor('additional')") && settings.includes("openEmergencyEditor('command')"), 'Editor shortcuts wired through SettingsView');
const service = fs.readFileSync(files[6], 'utf8');
check(service.includes("userSnap.data().role !== 'ADMIN'") && service.includes('runTransaction(db'), 'Admin-only concurrent safe persistence');
console.log(`OK: ${checks}/${checks} focused R39 validations passed.`);
