const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const schedule = fs.readFileSync('src/features/schedules/SchedulePreview.tsx', 'utf8');
const coverage = fs.readFileSync('src/features/attendance/DutyCoverageDialog.tsx', 'utf8');
const avatar = fs.readFileSync('src/components/common/UserAvatar.tsx', 'utf8');
const service = fs.readFileSync('src/services/firebase/dutyCancellationService.ts', 'utf8');
const scenarios = [
  ['schedule UI TSX syntax', () => assert.equal(ts.createSourceFile('SchedulePreview.tsx',schedule,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0)],
  ['coverage dialog TSX syntax', () => assert.equal(ts.createSourceFile('DutyCoverageDialog.tsx',coverage,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0)],
  ['schedule shared photo component', () => assert(schedule.includes('ScheduleTeacherAvatar') && schedule.includes('<UserAvatar'))],
  ['uniform 48px avatar', () => assert(schedule.includes('w-12 h-12 shrink-0 aspect-square'))],
  ['offscreen photo load deferral', () => assert(schedule.includes('IntersectionObserver') && schedule.includes("rootMargin: '160px'"))],
  ['auth photo cache retained', () => assert(avatar.includes('acquireProfileImage'))],
  ['placeholder when no profile image', () => assert(avatar.includes('fullName?.trim().charAt(0)'))],
  ['card actions include inline touch-friendly guide', () => assert(schedule.includes('<ScheduleActionGuide isAdmin={isAdmin} />'))],
  ['action guide describes each admin operation', () => ['Berhalangan:', 'Batalkan:', 'Pesan:', 'Edit:', 'Hapus:'].forEach(t => assert(schedule.includes(t), t))],
  ['icon buttons accessible for screen readers', () => assert(schedule.includes('aria-label={`Edit detail jadwal') && schedule.includes('aria-label={`Hapus jadwal'))],
  ['cancellation scope choice preserved', () => assert(schedule.includes("cancelScope === 'DAY'") && schedule.includes("cancelScope === 'RECURRING'"))],
  ['cancellation summary shows both impacts', () => assert(schedule.includes('Ringkasan dampak:') && schedule.includes('Jadwal mingguan tetap ada.'))],
  ['cancellation reason and minimum length enforced', () => assert(schedule.includes('cancelReason.trim().length < 10') && schedule.includes('maxLength={500}'))],
  ['cancellation admin transaction intact', () => assert(service.includes('runTransaction') && service.includes("role !== 'ADMIN'"))],
  ['emergency officer selection remains searchable', () => assert(coverage.includes('<SearchableSelect') && coverage.includes('onChange={setReplacementId}'))],
  ['no replacement still allowed', () => assert(coverage.includes("replacementId ? 'Simpan Guru Pengganti' : 'Catat Berhalangan'"))],
  ['emergency reason guard retained', () => assert(coverage.includes('reason.trim().length < 10'))],
  ['single-day impact shown before save', () => assert(coverage.includes('Ringkasan penugasan') && coverage.includes('tanggal ini'))],
  ['inline restore confirmation', () => assert(coverage.includes('confirmRestore') && coverage.includes('Ya, pulihkan jadwal asli'))],
  ['no direct browser confirm for emergency restore', () => assert(!coverage.includes('window.confirm'))],
  ['replacement service validation and audit remain', () => {
    const s=fs.readFileSync('src/services/firebase/dutyCoverageService.ts', 'utf8');
    assert(s.includes('validateDutyCoverage') && s.includes('runTransaction') && s.includes('auditLogs'));
  }],
];
for(const [label,run] of scenarios){run();console.log(`PASS ${label}`)}
console.log(`OK: ${scenarios.length}/${scenarios.length} verifikasi khusus R18 lulus.`);
