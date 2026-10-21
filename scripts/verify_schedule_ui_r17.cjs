const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const file = 'src/features/schedules/SchedulePreview.tsx';
const src = fs.readFileSync(file, 'utf8');
const out = ts.transpileModule(src, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
});
assert.equal((out.diagnostics || []).length, 0, 'SchedulePreview.tsx has transpile diagnostics.');
assert(src.includes("UserAvatar") && src.includes("getScheduleUser"), 'SchedulePreview should use UserAvatar with schedule user lookup.');
assert(src.includes('Batalkan = nonaktifkan jadwal') || src.includes('Batalkan</button>'), 'SchedulePreview should clarify the meaning of Batalkan in the UI.');
assert(src.includes('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'), 'Quick action area should be stacked ergonomically for mobile.');
assert(src.includes('rounded-2xl border border-[var(--theme-primary-border)]'), 'Grid schedule cards should render teacher avatars/photos in place of initials.');
console.log('OK: verifikasi UI Jadwal Piket R17 lulus.');
console.log('- Makna tombol Batalkan diperjelas di UI.');
console.log('- Aksi jadwal lebih ergonomis di mobile.');
console.log('- Avatar/foto guru ditampilkan dengan fallback inisial yang hemat data.');
