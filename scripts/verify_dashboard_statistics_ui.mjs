// Actual statistics component inside the real dashboard. All records/IO are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const region = page.getByRole('region', { name: 'Statistik hari ini' });
  const stat = tab => region.locator(`[data-statistic="${tab}"]`);
  const measurements = {};
  for (const mode of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto(origin + '/#dashboard'); await region.waitFor();
    await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
    check(`${mode}/${width}: eight statistics fit without horizontal scrolling`, await region.getByRole('button').count() === 8 && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    const height = await region.evaluate(e => e.getBoundingClientRect().height); measurements[`${mode}/${width}`] = height;
    check(`${mode}/${width}: compact statistical layout has responsive column count`, await region.evaluate((e, width) => getComputedStyle(e).gridTemplateColumns.split(' ').length === (width >= 1024 ? 4 : width >= 640 ? 3 : 2), width));
    check(`${mode}/${width}: titles and values fit their cards`, await region.locator('.dashboard-statistic').evaluateAll(es => es.every(e => { const heading = e.querySelector('.statistic-title'), value = e.querySelector('.statistic-amount'); const rect = e.getBoundingClientRect(), v = value.getBoundingClientRect(); return heading.scrollWidth <= heading.clientWidth + 1 && e.scrollWidth <= e.clientWidth && v.left >= rect.left && v.right <= rect.right && v.bottom < rect.bottom; })));
    if (width === 320 || width === 390 || width === 1440) check(`${mode}/${width}: statistics occupy less vertical space`, height < (width === 320 ? 621 : width === 390 ? 554 : 249.5) && height <= (width < 640 ? 430 : 220));
    const contrast = await region.locator('.dashboard-statistic').first().evaluate(e => {
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number), luminance = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
      const background = luminance(rgb(getComputedStyle(e).backgroundColor));
      return Math.min(...['.statistic-title', '.statistic-amount', '.statistic-detail'].map(selector => { const text = luminance(rgb(getComputedStyle(e.querySelector(selector)).color)); return (Math.max(text, background) + .05) / (Math.min(text, background) + .05); }));
    });
    check(`${mode}/${width}: statistic text contrast is readable`, contrast >= 4.5);
    if (process.env.PIKET_QA_SCREENSHOTS) { fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS, { recursive: true }); await region.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.PIKET_QA_SCREENSHOTS}/statistics-${mode}-${width}.png` }); }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin + '/#dashboard'); await region.waitFor();
  check('zero data shows flat real zero charts and no invented percentage trend', await stat('incidents').getAttribute('data-value') === '0' && await stat('incidents').locator('svg[data-series]').getAttribute('data-series') === '0,0,0,0,0,0,0' && !await region.getByText(/last week|minggu lalu|\+\d+%/).count());
  const starts = await page.evaluate(() => window.fixture.subscriptionStarts);
  await page.evaluate(() => {
    const f = window.fixture, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const at = time => `${today}T${time}:00+07:00`;
    f.emitCollection('schedules', Array.from({ length: 3 }, (_, i) => ({ ...f.data.schedules[0], id: `schedule-${i}`, jamMulai: `${7 + i}:00`.padStart(5, '0') })));
    f.emitCollection('attendance', Array.from({ length: 3 }, (_, i) => ({ id: `attendance-${i}`, tanggal: today, userId: `teacher-${i}`, jamMasuk: at(`0${7 + i}:00`), status: i < 2 ? 'DALAM_LOKASI' : 'LUAR_LOKASI' })));
    f.emitCollection('dutyBooks', [{ id: 'book', tanggal: today, petugasId: 'test-officer', status: 'DIAJUKAN' }]);
    f.emitCollection('incidents', Array.from({ length: 3 }, (_, i) => ({ id: `incident-${i}`, tanggal: today, waktu: `0${7 + i}:00`, kategori: 'SISWA', kategoriName: 'Kejadian Siswa', lokasi: 'Gerbang', uraian: 'Data contoh pengujian', pihakTerlibat: 'Contoh', status: i === 0 ? 'SELESAI' : 'BARU' })));
    f.emitCollection('studentTardiness', Array.from({ length: 4 }, (_, i) => ({ id: `tardy-${i}`, tanggal: today, jamDatang: `07:1${i}` })));
    f.emitCollection('studentPermits', [{ id: 'permit', tanggal: today, jamKeluar: '09:00', status: 'SEDANG_KELUAR' }]);
    f.emitCollection('substitutions', [{ id: 'substitution', tanggal: today, createdAt: at('08:00') }]);
    f.emitCollection('visitors', Array.from({ length: 5 }, (_, i) => ({ id: `visitor-${i}`, tanggal: today, jamMasuk: `${String(7 + i).padStart(2, '0')}:00`, status: i < 2 ? 'SEDANG_BERKUNJUNG' : 'SELESAI' })));
  });
  await page.waitForFunction(() => document.querySelector('[data-statistic="attendance"]').dataset.value === '67');
  check('live counts and attendance percentage still match the operational data', await stat('schedules').getAttribute('data-value') === '3' && await stat('attendance').getAttribute('data-value') === '67' && await stat('student-tardiness').getAttribute('data-value') === '4' && await stat('visitors').getAttribute('data-value') === '5');
  check('book keeps its true workflow stage instead of a fabricated numeric value', await stat('duty-book').getAttribute('data-value') === 'Terkirim' && await stat('duty-book').locator('[data-complete="true"]').count() === 2);
  check('secondary statistics show current actual states', await stat('incidents').getByText('1 tuntas ditangani').isVisible() && await stat('student-permits').getByText('1 masih di luar').isVisible() && await stat('visitors').getByText('2 sedang berkunjung').isVisible());
  check('small curves end at the actual timed count, without more subscriptions', (await stat('student-tardiness').locator('svg[data-series]').getAttribute('data-series')).endsWith(',4') && (await stat('attendance').locator('svg[data-series]').getAttribute('data-series')).endsWith(',2') && await page.evaluate(() => window.fixture.subscriptionStarts) === starts);
  await page.evaluate(() => { const f = window.fixture; f.emitCollection('substitutions', [{ ...f.data.substitutions[0], createdAt: undefined }]); });
  await stat('substitutions').getByLabel(/Grafik belum tersedia/).waitFor(); check('legacy records with missing time keep their count without an invented curve', await stat('substitutions').getAttribute('data-value') === '1' && await stat('substitutions').locator('svg[data-series]').count() === 0);
  if (process.env.PIKET_QA_SCREENSHOTS) { await region.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.PIKET_QA_SCREENSHOTS}/statistics-populated-390.png` }); }
  for (const tab of ['schedules', 'attendance', 'duty-book', 'incidents', 'student-tardiness', 'student-permits', 'substitutions', 'visitors']) {
    await page.goto(origin + '/?stat-nav=' + tab + '#dashboard'); await region.waitFor(); await stat(tab).click(); await page.waitForURL(url => url.hash === `#${tab}`); check(`statistic opens its existing ${tab} menu`, true);
  }
  await page.goto(origin + '/#dashboard'); await region.waitFor(); await stat('schedules').focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/#schedules'); check('statistic cards retain keyboard navigation', true);
  await page.goto(origin + '/#dashboard'); await region.waitFor(); await page.evaluate(() => { window.fixture.user = { ...window.fixture.user, role: 'GURU', permissions: ['dashboard.view', 'attendance.view'] }; window.fixture.permissions = ['dashboard.view', 'attendance.view']; window.fixture.force(); });
  await page.waitForFunction(() => document.querySelectorAll('[data-statistic]').length === 1); check('restricted accounts only see statistics for permitted menus', await stat('attendance').isVisible() && await stat('incidents').count() === 0);
  check('statistics do not write operational records', await page.evaluate(() => window.fixture.writes.length) === 0);
  check('no runtime errors in the tested statistic interactions', errors.length === 0);
  console.log(JSON.stringify({ measuredHeights: measurements })); console.log(`${count} compact statistic browser checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
