/** Run with: node --experimental-strip-types scripts/test_r89b_smart_checkout.mjs */
import { strict as assert } from 'node:assert';
import { classifyCheckoutReminder, snoozeExpiry } from '../src/features/dashboard/checkoutReminderPolicy.ts';
const baseline = { todayWib: '2026-10-28', recordDate: '2026-10-28', hasCheckIn: true, hasCheckOut: false,
  serverVerified: true, online: true, mode: 'TERJADWAL', activeDay: true, checkOutStart: '14:30', nowHHMM: '15:00' };
const tests = [
  ['scheduled reminder', {}, 'PERLU_PENGINGAT'],
  ['before window', { nowHHMM: '14:29' }, 'BERTUGAS'],
  ['at boundary', { nowHHMM: '14:30' }, 'PERLU_PENGINGAT'],
  ['after checkout end still allowed', { nowHHMM: '23:00' }, 'PERLU_PENGINGAT'],
  ['already checked out', { hasCheckOut: true }, 'SELESAI'],
  ['no checkin', { hasCheckIn: false }, 'BELUM_HADIR'],
  ['server not verified', { serverVerified: false }, 'BELUM_TERVERIFIKASI'],
  ['offline with cached checkout', { online: false, hasCheckOut: true }, 'BELUM_TERVERIFIKASI'],
  ['free mode no alarm', { mode: 'BEBAS' }, 'BERTUGAS'],
  ['inactive day no alarm', { activeDay: false }, 'BERTUGAS'],
  ['old record needs correction', { recordDate: '2026-10-27' }, 'TERLEWAT'],
  ['missing record date', { recordDate: undefined }, 'BELUM_TERVERIFIKASI'],
  ['malformed checkout start', { checkOutStart: 'oops' }, 'BELUM_TERVERIFIKASI'],
];
for (const [name, patch, expected] of tests) {
  assert.equal(classifyCheckoutReminder({ ...baseline, ...patch }), expected, name);
  console.log('PASS', name);
}
assert.equal(snoozeExpiry(0), 20 * 60_000);
console.log('PASS snooze duration');
console.log(`R89-B: ${tests.length + 1}/${tests.length + 1} PASS`);
