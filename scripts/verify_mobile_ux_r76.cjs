'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const tests = [];
const test=(name,fn)=>tests.push([name,fn]);
const contains=(name,file,text)=>test(name,()=>assert.ok(read(file).includes(text),`${file} expected ${text}`));
contains('Student photo subtitle concise','src/features/student-tardiness/StudentTardyFormModal.tsx','Foto dilengkapi watermark otomatis.');
contains('Incident photo subtitle concise','src/features/incidents/IncidentFormModal.tsx','Foto dilengkapi watermark otomatis.');
contains('Camera fallback hidden when caller provided subtitle','src/components/camera/CameraCaptureModal.tsx','watermarkProcessor && !prepareCapture && !subtitle');
contains('Dashboard welcome has overflow name','src/features/dashboard/DashboardWelcome.tsx','<OverflowName name={name}');
contains('Long name gets its own row','src/index.css','h1[data-stacked="true"] .dashboard-hello-prefix');
contains('Long name measured against available width','src/features/dashboard/DashboardWelcome.tsx','needed > heading.clientWidth');
contains('Dashboard Pause relocated to second row','src/index.css','.dashboard-welcome > .welcome-message-pause-hero { grid-column: 2; grid-row: 2;');
contains('Pause stays out of intro column','src/index.css','.dashboard-welcome > .dashboard-intro { grid-column: 1; grid-row: 2;');
contains('Animated name only when overflow','src/components/common/OverflowName.tsx','settings.enabled && overflow');
contains('Marquee can pause on hover','src/index.css','animation-play-state: paused');
contains('Reduced motion disables marquee','src/index.css','@media (prefers-reduced-motion: reduce) { .overflow-name');
contains('Marquee stops observer on unmount','src/components/common/OverflowName.tsx','observer?.disconnect()');
contains('Admin switch','src/features/settings/DashboardInfoSettingsCard.tsx','Aktifkan teks berjalan nama panjang');
contains('Admin speed setting','src/features/settings/DashboardInfoSettingsCard.tsx','Kecepatan teks berjalan nama panjang');
contains('Settings saved through existing service','src/features/settings/DashboardInfoSettingsCard.tsx','SchoolSettingsService.saveDashboardInfoSettings(draft');
contains('Settings sanitizer persists new preference','src/types/dashboardInfo.types.ts','nameMarquee: sanitizeNameMarqueeConfig(v.nameMarquee)');
contains('Public endpoint only exports safe marquee preference','src/server/routes/authRoutes.ts','publicNameMarquee: sanitizeNameMarqueeConfig(data.dashboardInfoConfig?.nameMarquee)');
contains('Login selected user gets marquee','src/features/auth/LoginPage.tsx','config={schoolSettings.publicNameMarquee}');
contains('Mobile choices are buttons','src/components/common/MobileChoiceSelect.tsx','aria-haspopup="dialog"');
contains('Mobile choices work in nested modal','src/components/common/MobileChoiceSelect.tsx','<Modal isOpen={open && !disabled}');
contains('Mobile choice minimum touch target','src/components/common/MobileChoiceSelect.tsx','min-h-12');
contains('Mobile choices preserve form handler','src/components/common/MobileChoiceSelect.tsx','onChange?.({ target: { value: selectedValue } }');
contains('Native select preserved for desktop','src/components/common/MobileChoiceSelect.tsx','hidden sm:block');
for(const [file,expected] of Object.entries({
  'src/features/incidents/IncidentFormModal.tsx':3,
  'src/features/student-tardiness/StudentTardyFormModal.tsx':4,
  'src/features/visitors/VisitorFormModal.tsx':2,
  'src/features/substitutions/SubstitutionFormModal.tsx':2,
  'src/features/student-permits/StudentPermitFormModal.tsx':2,
  'src/features/users/UserFormModal.tsx':2,
  'src/features/schedules/ScheduleFormModal.tsx':2,
  'src/features/dashboard/AnnouncementFormModal.tsx':2,
  'src/features/visitors/PublicVisitorCheckin.tsx':1,
  'src/features/users/StudentFormModal.tsx':1,
})) {
  test(`Responsive picker integrated ${file}`,()=>assert.equal((read(file).match(/<MobileChoiceSelect\b/g)||[]).length,expected));
}
const syntaxFiles = [
  'src/components/camera/CameraCaptureModal.tsx','src/components/common/OverflowName.tsx','src/components/common/MobileChoiceSelect.tsx',
  'src/features/dashboard/DashboardWelcome.tsx','src/features/dashboard/DashboardView.tsx','src/features/auth/LoginPage.tsx',
  'src/features/incidents/IncidentFormModal.tsx','src/features/student-tardiness/StudentTardyFormModal.tsx',
  'src/features/visitors/VisitorFormModal.tsx','src/features/substitutions/SubstitutionFormModal.tsx',
  'src/features/student-permits/StudentPermitFormModal.tsx','src/features/users/UserFormModal.tsx',
  'src/features/schedules/ScheduleFormModal.tsx','src/features/dashboard/AnnouncementFormModal.tsx',
  'src/features/visitors/PublicVisitorCheckin.tsx','src/features/users/StudentFormModal.tsx',
  'src/features/settings/DashboardInfoSettingsCard.tsx','src/types/dashboardInfo.types.ts','src/types/index.ts','src/server/routes/authRoutes.ts',
];
test('Changed TS/TSX has no syntax errors',()=>{
 for(const file of syntaxFiles) {
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length,0,`${file}: ${source.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join(', ')}`);
 }
});
let passed=0;
for(const [name,fn] of tests) {
 try{fn(); passed++; console.log('PASS',name);}catch(err){console.error('FAIL',name,err.message); process.exitCode=1;}
}
console.log(`R76 ${passed}/${tests.length} checks passed`);
