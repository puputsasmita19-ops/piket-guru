// Actual welcome selection logic; no database, network, or production data.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const bundle = await build({ entryPoints: ['src/types/dashboardWelcome.types.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const ctx = vm.createContext({ module: { exports: {} }, Intl, Date });
vm.runInContext(bundle.outputFiles[0].text, ctx);
const { getDashboardWelcome: welcome, sanitizeDashboardWelcomeConfig: sanitize, WELCOME_TEMPLATES: templates } = ctx.module.exports;
let count = 0;
const check = (name, fn) => { fn(); count++; console.log('PASS', name); };
for (const [iso, period] of [
  ['2026-10-17T20:59:00Z', 'malam'], ['2026-10-17T21:00:00Z', 'pagi'],
  ['2026-10-18T03:59:00Z', 'pagi'], ['2026-10-18T04:00:00Z', 'siang'],
  ['2026-10-18T07:59:00Z', 'siang'], ['2026-10-18T08:00:00Z', 'sore'],
  ['2026-10-18T10:59:00Z', 'sore'], ['2026-10-18T11:00:00Z', 'malam'],
  ['2026-10-18T17:00:00Z', 'malam'],
]) check(`WIB boundary ${iso} is ${period}`, () => assert.equal(welcome(null, new Date(iso)).greeting, 'Selamat ' + period));
check('existing installations show the original encouragement by default', () => assert.equal(welcome().message, 'Semoga kegiatan sekolah hari ini berjalan lancar.'));
check('fifteen unique templates cover all five categories', () => { assert.equal(templates.length, 15); assert.equal(new Set(templates.map(t => t.id)).size, 15); assert.equal(new Set(templates.map(t => t.category)).size, 5); });
for (const category of ['general', 'islamic', 'motivation', 'inspiration', 'humor']) check(`${category}: automatic selection only uses this category and changes at WIB midnight`, () => {
  const config = { mode: 'daily', category };
  const before = welcome(config, new Date('2026-10-18T16:59:00Z')).message;
  const after = welcome(config, new Date('2026-10-18T17:00:00Z')).message;
  assert.notEqual(before, after);
  assert.ok(templates.some(t => t.category === category && t.text === after));
  assert.equal(before, welcome(config, new Date('2026-10-18T00:00:00Z')).message);
});
for (const minutes of [5, 15, 30, 60]) check(`interval ${minutes}: stable inside a slot, rotates at the next boundary`, () => {
  const config = { mode: 'interval', category: 'motivation', intervalMinutes: minutes };
  const start = Date.parse('2026-10-18T00:00:00Z');
  assert.equal(welcome(config, start).message, welcome(config, start + minutes * 60000 - 1).message);
  assert.notEqual(welcome(config, start).message, welcome(config, start + minutes * 60000).message);
});
check('fixed template ignores date and time', () => assert.equal(welcome({ templateId: 'islamic-ease' }, 0).message, welcome({ templateId: 'islamic-ease' }, Date.now()).message));
check('custom text is normalized and capped at 180 characters', () => { assert.equal(welcome({ mode: 'custom', customMessage: '  Salam\n   semangat  ' }).message, 'Salam semangat'); assert.equal(sanitize({ customMessage: 'a'.repeat(300) }).customMessage.length, 180); });
check('empty custom text and invalid remote settings fall back safely', () => { const v = sanitize({ mode: 'unknown', category: '__proto__', templateId: 'missing', intervalMinutes: 0, customMessage: 42 }); assert.equal(v.mode, 'fixed'); assert.equal(v.category, 'all'); assert.equal(v.intervalMinutes, 15); assert.equal(v.customMessage, ''); assert.equal(welcome({ mode: 'custom', customMessage: '' }).message, templates[0].text); });
check('message OFF keeps the automatic WIB greeting', () => { const v = welcome({ enabled: false }, new Date('2026-10-18T08:00:00Z')); assert.equal(v.message, ''); assert.equal(v.greeting, 'Selamat sore'); });
console.log(`${count} dashboard welcome logic checks passed.`);
