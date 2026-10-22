const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

const root = process.cwd();
const files = [
  'src/contexts/GuideContext.tsx',
  'src/components/guide/InteractiveGuideTour.tsx',
  'src/components/guide/GuideWelcomePrompt.tsx',
  'src/components/layout/GuideHelpButton.tsx',
  'src/components/layout/Layout.tsx',
];
for (const f of files) {
  const source = fs.readFileSync(path.join(root, f), 'utf8');
  const output = ts.transpileModule(source, { fileName: f, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
  assert.equal((output.diagnostics || []).length, 0, `Transpile ${f} failed`);
}
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const context = read(files[0]), tour = read(files[1]), welcome = read(files[2]);
const menu = read(files[3]), layout = read(files[4]), css = read('src/index.css');
const checks = [
  ['Guide mode type restricted to full/quick', context.includes("type GuideTourMode = 'full' | 'quick'")],
  ['Manual default full tour preserved', context.includes("mode: GuideTourMode = 'full'")],
  ['Welcome scoped to authenticated account', context.includes('!isAuthenticated || !currentUser?.id')],
  ['Welcome only on dashboard', context.includes("activeTab !== 'dashboard'")],
  ['Welcome separate from automatic tour', context.includes('showOnLogin || isGuideTourActive')],
  ['Welcome marked per-user in local storage', context.includes('piket_guide_welcome_v1_${currentUser.id}')],
  ['Welcome has opt-in quick start', welcome.includes("startGuideTour('quick')")],
  ['Welcome has skip action', welcome.includes('onClick={dismissWelcomeGuide}')],
  ['Welcome does not call other app functions', !/logout|loginWithPin|loginWithGoogle|CameraCaptureModal/.test(welcome)],
  ['Menu offers quick 3-step tour', menu.includes("startGuideTour('quick')")],
  ['Menu preserves full tour', menu.includes("startGuideTour('full')")],
  ['Admin quick three explicit steps', tour.includes("['admin-nav', 'admin-schedules', 'admin-reports']")],
  ['Guru quick three explicit steps', tour.includes("['guru-gps', 'guru-selfie', 'guru-submit']")],
  ['Role/permission filtering preserved', tour.includes('permissionSignature.split')],
  ['Permissions respected for quick fallback', tour.includes('selected.length < 3')],
  ['Full route includes sync-status', tour.includes("id: 'sync-status'")],
  ['Role-specific invite text', welcome.includes("hasRole('ADMIN', 'KEPALA_SEKOLAH')")],
  ['Welcome integrated into shell', layout.includes('<GuideWelcomePrompt />')],
  ['Welcome positioned above mobile nav', css.includes('.guide-welcome-prompt') && css.includes('env(safe-area-inset-bottom)')],
  ['Guide targeting preserved', tour.includes('data-guide-active-target')],
];
for (const [name, passed] of checks) { assert(passed, `${name}: FAIL`); console.log(`PASS ${name}`); }
console.log(`\n${checks.length}/${checks.length} verifikasi R26 lulus (struktur & sintaks, bukan uji perangkat).`);
