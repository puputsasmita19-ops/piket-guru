/** Run with: node --experimental-strip-types scripts/test_r89d_checkout_reminder_settings.mjs */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  CHECKOUT_REMINDER_DELAYS, CHECKOUT_REMINDER_SNOOZES,
  normalizeCheckoutReminderConfig, validateCheckoutReminderConfig,
} from '../src/types/checkoutReminder.types.ts';
import { reminderWindowOpen, snoozeExpiry, classifyCheckoutReminder } from '../src/features/dashboard/checkoutReminderPolicy.ts';

let tests = 0;
function check(label, fn) { fn(); tests += 1; console.log('PASS', label); }
const baseline = { todayWib: '2026-10-29', recordDate: '2026-10-29', hasCheckIn: true, hasCheckOut: false,
  serverVerified: true, online: true, mode: 'TERJADWAL', activeDay: true, checkOutStart: '14:30', nowHHMM: '14:30' };
check('legacy defaults retain R89-B behavior', () => assert.deepEqual(normalizeCheckoutReminderConfig(undefined), {
  enabled: true, delayMinutes: 0, snoozeMinutes: 20, freeModeHintEnabled: true,
}));
check('invalid persisted options use safe fallbacks', () => assert.deepEqual(normalizeCheckoutReminderConfig({
  enabled: 'yes', delayMinutes: -100, snoozeMinutes: 100_000, freeModeHintEnabled: null,
}), normalizeCheckoutReminderConfig(undefined)));
check('disabled setting is preserved exactly', () => assert.equal(normalizeCheckoutReminderConfig({ enabled: false }).enabled, false));
check('free-mode setting can be disabled without changing scheduled alarm', () => assert.equal(normalizeCheckoutReminderConfig({ freeModeHintEnabled: false }).freeModeHintEnabled, false));
for (const minutes of CHECKOUT_REMINDER_DELAYS) {
  check(`delay option ${minutes} accepted`, () => validateCheckoutReminderConfig({ ...normalizeCheckoutReminderConfig(), delayMinutes: minutes }));
}
for (const minutes of CHECKOUT_REMINDER_SNOOZES) {
  check(`snooze option ${minutes} accepted`, () => validateCheckoutReminderConfig({ ...normalizeCheckoutReminderConfig(), snoozeMinutes: minutes }));
}
for (const value of [-1, 1, 31, NaN, Infinity]) {
  check(`invalid delay ${String(value)} rejected`, () => assert.throws(() => validateCheckoutReminderConfig({ ...normalizeCheckoutReminderConfig(), delayMinutes: value })));
}
for (const value of [0, 19, 2000, NaN]) {
  check(`invalid snooze ${String(value)} rejected`, () => assert.throws(() => validateCheckoutReminderConfig({ ...normalizeCheckoutReminderConfig(), snoozeMinutes: value })));
}
check('starts at checkout opening with default delay', () => assert.equal(reminderWindowOpen('14:30', '14:30', 0), true));
check('five-minute delay suppresses early reminder', () => assert.equal(reminderWindowOpen('14:30', '14:34', 5), false));
check('five-minute delay activates exactly at boundary', () => assert.equal(reminderWindowOpen('14:30', '14:35', 5), true));
check('friday earlier hours remain anchored to that day', () => assert.equal(reminderWindowOpen('11:30', '11:45', 15), true));
check('delay crossing midnight does not remind on previous day', () => assert.equal(reminderWindowOpen('23:50', '23:59', 30), false));
check('rejects invalid times and negative delay', () => {
  assert.equal(reminderWindowOpen('25:00', '15:00', 0), false);
  assert.equal(reminderWindowOpen('14:30', '24:00', 0), false);
  assert.equal(reminderWindowOpen('xx:yy', '14:30', 0), false);
  assert.equal(reminderWindowOpen('14:30', '14:30', -1), false);
});
check('admin chosen snooze duration used', () => assert.equal(snoozeExpiry(0, 60), 3_600_000));
check('default snooze remains compatible with R89-B', () => assert.equal(snoozeExpiry(0), 1_200_000));
check('absence of checkout cannot be inferred while offline', () => assert.equal(classifyCheckoutReminder({ ...baseline, online: false }), 'BELUM_TERVERIFIKASI'));
check('checked out data cannot be prompted', () => assert.equal(classifyCheckoutReminder({ ...baseline, hasCheckOut: true }), 'SELESAI'));
check('historical record stays a correction issue, not a reminder', () => assert.equal(classifyCheckoutReminder({ ...baseline, recordDate: '2026-10-28' }), 'TERLEWAT'));

const from = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const service = from('src/services/firebase/schoolSettingsService.ts');
const teacher = from('src/features/dashboard/SmartCheckoutReminder.tsx');
const view = from('src/features/settings/SettingsView.tsx');
check('saveProfile excludes reminder configuration from broad profile writes', () => {
  const patch = service.slice(service.indexOf('public static async saveProfile'), service.indexOf('public static async saveCommandCenterConfig'));
  assert.match(patch, /'checkoutReminderConfig'/);
});
check('admin save updates only reminder settings with an audit trail', () => {
  const method = service.slice(service.indexOf('public static async saveCheckoutReminderConfig('), service.indexOf('public static async saveNotificationSettings('));
  assert.match(method, /role !== 'ADMIN'/);
  assert.match(method, /transaction\.update\(ref, \{ checkoutReminderConfig: payload, updatedAt: serverTimestamp\(\) \}\)/);
  assert.match(method, /expectedConfig/);
  assert.match(method, /AuditService\.log/);
  assert.doesNotMatch(method, /attendance[^A-Z]/i);
});
check('teacher renders only enabled and due reminder and respects snooze setting', () => {
  assert.match(teacher, /if \(!reminderConfig\.enabled\) return null/);
  assert.match(teacher, /reminderWindowOpen\(/);
  assert.match(teacher, /reminderConfig\.freeModeHintEnabled/);
  assert.match(teacher, /snoozeExpiry\(Date\.now\(\), reminderConfig\.snoozeMinutes\)/);
});
check('profile tab renders separate admin card and a scroll shortcut', () => {
  assert.match(view, /<CheckoutReminderSettingsCard settings=\{settings\} settingsReady=\{settingsReady\} onSaved=\{setSettings\} \/>/);
  assert.match(view, /getElementById\('pengingat-presensi'\)/);
});
console.log(`R89-D: ${tests}/${tests} PASS`);
