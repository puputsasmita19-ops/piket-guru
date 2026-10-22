const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/features/schedules/SchedulePreview.tsx');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
assert.equal(parsed.parseDiagnostics.length, 0, 'SchedulePreview JSX/TypeScript syntax must parse');

const checks = [
  ['Urgent day change and deferred heavy list', source.includes('useDeferredValue(selection)') && source.includes('selectionPending')],
  ['Day and date deferred atomically', source.includes('({ day: selectedDay, date: selectedDate })') && source.includes('displaySelection.day') && source.includes('displaySelection.date')],
  ['Only admin sees monitoring date picker', source.includes('{isAdmin && <div className="flex flex-wrap items-center gap-3 rounded-xl') && source.includes('Tanggal pemantauan')],
  ['Real-time Firestore attendance retained', source.includes("subscribeToCollection<AttendanceRecord>('attendance'") && source.includes("where('tanggal', '==', selectedDate)")],
  ['Older attendance dates excluded from current card status', source.includes('attendanceSnapshot.date === displayDate') && source.includes('record.tanggal !== displayDate')],
  ['Operational status indexes reused between cards', source.includes('const operationalIndex = useMemo(') && source.includes('new Map<string, { order: number; record: AttendanceRecord }>()')],
  ['Only active day rows filtered', source.includes('const daySchedules = useMemo(') && source.includes('item.hari === displayDay')],
  ['Compact mobile cards', source.includes('className="schedule-duty-card"') && source.includes('p-3 sm:p-5 space-y-2.5')],
  ['Notes can be expanded when needed', source.includes('Catatan tugas') && source.includes('<details className="group rounded-lg')],
  ['Status keeps original values', ['TERJADWAL','BERJALAN','SELESAI','DIGANTIKAN','MENUNGGU_PENGGANTI','DIBATALKAN'].every(status => source.includes(status))],
  ['Admin actions still protected', source.includes('isAdmin &&') && source.includes('setCoverageSource(item)') && source.includes('requestCancel(item)') && source.includes('setDeleteConfirmSchedule(item)')],
  ['User-facing WA reminder maintained', source.includes('handleTriggerWaReminder(item)')],
  ['Mobile table/grid choice remains', source.includes("setViewMode('grid')") && source.includes("setViewMode('table')")],
];
for (const [name, success] of checks) { assert(success, `FAILED: ${name}`); console.log(`PASS: ${name}`); }

// Same chronological first-match rule as the original attendance status reader.
function indexedFirstMatch(records, date, scheduleId, userId) {
  const bySchedule = new Map(), byUser = new Map();
  records.forEach((record, order) => {
    if (record.tanggal !== date) return;
    if (record.scheduleId && !bySchedule.has(record.scheduleId)) bySchedule.set(record.scheduleId, { order, record });
    if (record.userId && !byUser.has(record.userId)) byUser.set(record.userId, { order, record });
  });
  const scheduled = bySchedule.get(scheduleId), user = byUser.get(userId);
  return (!scheduled || (user && user.order < scheduled.order) ? user : scheduled)?.record || null;
}
const records = [
  { tanggal: '2026-10-22', scheduleId: 'other', userId: 'guru-1', jamPulang: null },
  { tanggal: '2026-10-22', scheduleId: 'jadwal-1', userId: 'guru-2', jamPulang: '07:30' },
  { tanggal: '2026-10-23', scheduleId: 'jadwal-1', userId: 'guru-1', jamPulang: '09:00' },
];
for (const date of ['2026-10-22','2026-10-23','2026-10-24']) {
  for (const scheduleId of ['jadwal-1','other','none']) for (const userId of ['guru-1','guru-2','none']) {
    const original = records.find(a => a.tanggal === date && (a.scheduleId === scheduleId || a.userId === userId)) || null;
    assert.deepEqual(indexedFirstMatch(records,date,scheduleId,userId), original, 'Indexed lookup should preserve original ordering');
  }
}
console.log(`OK: ${checks.length} pemeriksaan source + 27 perbandingan pencarian presensi lulus.`);
