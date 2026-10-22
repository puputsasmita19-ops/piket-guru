const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');

const paths = [
  'src/types/commandCenterConfig.types.ts',
  'src/types/index.ts',
  'src/services/firebase/schoolSettingsService.ts',
  'src/features/settings/CommandCenterSettingsCard.tsx',
  'src/features/settings/SettingsView.tsx',
  'src/features/settings/BellEmergencyAutomationCard.tsx',
  'src/features/command-center/CommandCenterPreview.tsx',
  'src/features/command-center/EmergencyBroadcastModal.tsx',
];
let checks = 0;
const test = (condition, msg) => { assert(condition, msg); checks++; };
for (const file of paths) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  test((output.diagnostics || []).length === 0, `Syntax: ${file}`);
}
const compiled = ts.transpileModule(fs.readFileSync(paths[0], 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true,
});
const libraryExports = {};
vm.runInNewContext(compiled.outputText, { exports: libraryExports });
const { normalizeCommandCenterConfig, validateCommandCenterConfig, DEFAULT_COMMAND_CENTER_CONFIG } = libraryExports;
let config = normalizeCommandCenterConfig(null);
test(config.emergencyContacts.length === 4, 'Four default contact slots must remain available.');
test(config.emergencyTemplates.EVACUATION?.message.length > 15, 'Evacuation template must have a safe fallback.');
test(config.bellLabels.MASUK === 'Bel Masuk Pagi', 'Legacy command-center bell labels should remain stable.');
test(validateCommandCenterConfig(config).length === 0, 'Default configuration should validate.');
const malformed = normalizeCommandCenterConfig({ emergencyContacts: [{ id: 'POLICE', number: 'javascript:alert(1)', label: 'Fake' }] });
test(validateCommandCenterConfig(malformed).some(v => v.includes('POLICE')), 'Phone injection must be rejected.');
const blank = normalizeCommandCenterConfig({ heading: '', protocolSteps: ['short'] });
test(validateCommandCenterConfig(blank).length >= 2, 'Blank header and short SOP must be rejected.');
config = normalizeCommandCenterConfig({ bellLabels: { MASUK: 'Awal Kelas' } });
test(config.bellLabels.MASUK === 'Awal Kelas' && config.bellLabels.PULANG === 'Bel Pulang Sekolah', 'Partial settings must preserve defaults.');
const schoolService = fs.readFileSync(paths[2], 'utf8');
test(schoolService.includes('saveCommandCenterConfig') && schoolService.includes("transaction.update(ref, { commandCenterConfig"), 'Setting should be saved atomically as a nested field.');
test(schoolService.includes("'commandCenterConfig'].includes(key)"), 'General profile save must not overwrite command-center settings.');
test(schoolService.includes("userSnap.data()?.role !== 'ADMIN'"), 'Service must verify active administrator role.');
test(schoolService.includes('expectedConfig') && schoolService.includes('Pengaturan berubah di perangkat lain'), 'Concurrent admin edits must be detected.');
const settings = fs.readFileSync(paths[4], 'utf8');
test(settings.includes('CommandCenterSettingsCard') && settings.includes("subView === 'bell'"), 'Settings tab must expose editor and direct navigation.');
const command = fs.readFileSync(paths[6], 'utf8');
test(command.includes('subscribeToDocument<SchoolSettings>') && command.includes('unsubSettings();'), 'Command Center must react to settings updates and unsubscribe.');
test(command.includes("navigateTo('settings', 'bell')"), 'Admin should have direct Edit Bel & Komando action.');
const modal = fs.readFileSync(paths[7], 'utf8');
test(modal.includes('config.emergencyContacts[0]') && modal.includes('config.protocolSteps.map'), 'Emergency modal must display configured contacts and SOP.');
const bell = fs.readFileSync(paths[5], 'utf8');
test((bell.includes('normalizeCommandCenterConfig(config).emergencyTemplates[type]') || bell.includes('liveConfig.emergencyTemplates[type]')), 'Emergency confirmation should use configured text.');
const editor = fs.readFileSync(paths[3], 'utf8');
test(editor.includes('saveCommandCenterConfig(draft, currentUser.id, original)') && editor.includes('if (!admin || !currentUser || saving) return;'), 'Editor must only persist through admin protected service.');
test(editor.includes('Uji Suara Lokal') && !editor.includes('triggerEmergency('), 'Local sound test must never send a broadcast.');
console.log(`OK: ${checks} focused command-center configuration checks passed.`);
