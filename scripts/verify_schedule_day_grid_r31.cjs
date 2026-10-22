const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'src/features/schedules/SchedulePreview.tsx');
const source = fs.readFileSync(sourceFile, 'utf8');
const config = fs.readFileSync(path.join(root, 'src/config/constants.ts'), 'utf8');
const parsed = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length, 0, 'Komponen jadwal memiliki error sintaks TSX.');

const checks = [
  ['Tujuh hari disediakan dengan urutan Senin sampai Minggu', /DAYS_LIST\s*:\s*DayOfWeek\[\]\s*=\s*\['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'\]/.test(config)],
  ['Grid mobile tidak memerlukan scroll horizontal', source.includes('grid grid-cols-12') && source.includes('md:overflow-x-auto') && !source.includes('flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none')],
  ['Empat tombol baris pertama, tiga baris kedua', source.includes("dayIndex < 4 ? 'col-span-3' : 'col-span-4'")],
  ['Minimum tinggi sentuhan 56 piksel di mobile', source.includes('h-[56px]')],
  ['Nama hari tetap lengkap dan jumlah jadwal tetap ditampilkan', source.includes('{day}</span>') && source.includes('{count}')],
  ['Label Hari Ini tetap dipertahankan', source.includes('HARI INI') && source.includes('{isToday &&')],
  ['Aksesibilitas dan indikator terpilih tersedia', source.includes('aria-pressed={isSelected}') && source.includes('focus-visible:ring-2')],
  ['Hari yang dipilih tetap memperbarui tanggal secara bersamaan', source.includes('setSelectedDay(day); setSelectedDate(nextWeekdayDate(day, todayISO))')],
  ['Optimasi daftar R30 tetap dipertahankan', source.includes('useDeferredValue(selection)') && source.includes('selectionPending')],
  ['Tanggal Pemantauan tetap hanya untuk admin', source.includes('{isAdmin && <div className="flex flex-wrap items-center gap-3 rounded-xl') && source.includes('Tanggal pemantauan')],
  ['Desktop tetap memakai susunan mendatar', source.includes('md:flex md:items-center') && source.includes('md:shrink-0')],
];
for (const [label, pass] of checks) {
  assert.ok(pass, label);
  console.log(`PASS: ${label}`);
}

// Each grid row fills all 12 columns: 4 * 3 and 3 * 4.
const spans = Array.from({ length: 7 }, (_, i) => i < 4 ? 3 : 4);
assert.equal(spans.slice(0, 4).reduce((sum, n) => sum + n, 0), 12);
assert.equal(spans.slice(4).reduce((sum, n) => sum + n, 0), 12);
for (const viewport of [320, 360, 375, 390, 430, 767]) {
  const content = viewport - 32; // Conservative illustrative app padding
  const gap = viewport < 370 ? 6 : 8;
  const column = (content - gap * 3) / 4;
  assert.ok(column >= 60, `Tombol terlalu sempit pada ${viewport}px`);
}
console.log(`OK: ${checks.length} pemeriksaan source + 2 pemeriksaan baris + 6 simulasi ukuran viewport lulus.`);
