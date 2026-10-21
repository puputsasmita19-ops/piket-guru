const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(process.cwd(), 'src/features/schedules/SchedulePreview.tsx');
const source = fs.readFileSync(file, 'utf8');
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length, 0, 'SchedulePreview.tsx contains a JSX/TypeScript syntax error');
assert(source.includes('HelpCircle,') && source.includes('<HelpCircle '), 'The help icon should be imported and rendered');
assert(source.includes('aria-label="Apa fungsi tombol jadwal piket?"'), 'The icon needs an accessible label');
assert(source.includes('<span className="sr-only">Apa fungsi tombol?</span>'), 'Screen reader label must be preserved');
assert(source.includes('h-10 w-10') && source.includes('focus-visible:ring-2'), 'Help trigger must be touch-friendly and keyboard accessible');
assert(source.includes('<details name="schedule-action-help"'), 'Help must open without triggering a page rerender');
assert(source.includes('Panduan tombol jadwal'), 'Help explanation must still be available');
assert.equal((source.match(/<ScheduleActionGuide isAdmin=\{isAdmin\}/g) || []).length, 1, 'Only one help icon should appear per schedule card');
assert(!source.includes('Batalkan = nonaktifkan jadwal pada tanggal ini / jadwal berulang.'), 'Long repeated helper text should be removed from the card');
console.log('R20: 9 pemeriksaan tampilan ikon bantuan lulus.');
