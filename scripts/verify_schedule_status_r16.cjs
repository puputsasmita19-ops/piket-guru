const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const preview = fs.readFileSync('src/features/schedules/SchedulePreview.tsx', 'utf8');
const modal = fs.readFileSync('src/features/schedules/ScheduleFormModal.tsx', 'utf8');
const utils = fs.readFileSync('src/utils/scheduleUtils.ts', 'utf8');
for (const [name, src] of [['SchedulePreview',preview], ['ScheduleFormModal',modal], ['scheduleUtils',utils]]) {
 const result = ts.transpileModule(src, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
 assert.equal((result.diagnostics||[]).length, 0, `${name} has syntax diagnostics`);
}
assert(utils.includes("attendance.jamPulang ? 'SELESAI' : 'BERJALAN'"));
assert(utils.includes("'MENUNGGU_PENGGANTI'"));
assert(utils.includes('getDutyCancellationForDate'));
assert(preview.includes("editingSchedule.status === 'DIBATALKAN'"));
assert(preview.includes("schedule.status !== 'TERJADWAL'"));
assert(preview.includes('Gunakan Berhalangan atau Batalkan'));
assert(modal.includes("status: 'TERJADWAL'"));
assert(modal.includes("editingSchedule?.status === 'DIBATALKAN'"));
assert(preview.includes('DutyCancellationService.cancel'));
assert(preview.includes('DutyCoverageDialog'));
console.log('OK: 10 pemeriksaan struktur/status R16 lulus.');
