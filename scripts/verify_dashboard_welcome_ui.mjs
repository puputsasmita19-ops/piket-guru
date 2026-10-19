// Actual dashboard/admin UI with synthetic auth and Firestore IO; no production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/welcome_motion_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const { chromium: pw } = dep('playwright-core'), chromium = dep('@sparticuz/chromium').default;
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0;
const check = (label, value) => { assert.ok(value, label); count++; console.log('PASS', label); };
const out = process.env.PIKET_QA_SCREENSHOTS;
if (out) fs.mkdirSync(out, { recursive: true });
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', hasTouch: true });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin + '/#dashboard'); await page.locator('.dashboard-intro').waitFor();
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
    await page.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
    await page.waitForTimeout(350);
    check(`${width}/${dark}: mobile and desktop both show the encouragement and a smaller greeting without overflow`, await page.locator('.dashboard-welcome').evaluate(el => {
      const p = el.querySelector('.dashboard-intro'), h = el.querySelector('h1'), a = el.querySelector('.dashboard-avatar');
      const pr = p.getBoundingClientRect(), hr = h.getBoundingClientRect(), ar = a.getBoundingClientRect();
      return p.textContent === 'Semoga kegiatan sekolah hari ini berjalan lancar.' && pr.height > 0 && getComputedStyle(p).display !== 'none' && parseFloat(getComputedStyle(h).fontSize) <= 23 && hr.right <= ar.left && pr.top >= ar.bottom && el.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth === innerWidth;
    }));
    check(`${width}/${dark}: school label is replaced with a WIB time greeting`, /^Selamat (pagi|siang|sore|malam)$/.test(await page.locator('.dashboard-eyebrow').innerText()));
    if (out && [390, 1440].includes(width)) await page.screenshot({ path: `${out}/welcome-${width}-${dark}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/#settings'); await page.getByLabel('Cara menampilkan kalimat').waitFor();
  await page.getByLabel('Template kalimat', { exact: true }).selectOption('islamic-ease');
  await page.waitForTimeout(650);
  check('admin preview immediately shows a selected Islamic template', (await page.getByLabel('Pratinjau sapaan dashboard').innerText()).includes('Bismillah'));
  await page.getByLabel('Cara menampilkan kalimat').selectOption('interval');
  await page.getByLabel('Kategori kalimat otomatis').selectOption('humor');
  await page.getByLabel('Jeda pergantian kalimat').selectOption('1800');
  await page.getByRole('switch', { name: /Tampilkan flash info/ }).uncheck();
  await page.evaluate(() => { window.fixture.failSettingsSave = true; });
  await page.getByRole('button', { name: 'Simpan info dashboard' }).click(); await page.getByRole('alert').waitFor();
  check('failed save preserves welcome choices', await page.getByLabel('Kategori kalimat otomatis').inputValue() === 'humor' && await page.getByLabel('Jeda pergantian kalimat').inputValue() === '1800');
  await page.evaluate(() => { window.fixture.failSettingsSave = false; });
  await page.getByRole('button', { name: 'Simpan info dashboard' }).click(); await page.getByRole('status').filter({ hasText: 'tersimpan' }).waitFor();
  check('admin saves welcome and existing flash settings together', await page.evaluate(() => { const c = window.fixture.settingsSaves.at(-1).config; return c.welcome.mode === 'interval' && c.welcome.category === 'humor' && c.welcome.intervalMinutes === 30 && c.enabled === false; }));
  await page.getByLabel('Cara menampilkan kalimat').selectOption('custom');
  await page.getByLabel('Kalimat sendiri', { exact: true }).fill('Semangat bertugas, warga sekolah!');
  if (out) await page.screenshot({ path: `${out}/welcome-settings-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Simpan info dashboard' }).click(); await page.getByRole('status').filter({ hasText: 'tersimpan' }).waitFor();
  await page.evaluate(() => { location.hash = '#dashboard'; }); await page.locator('.dashboard-intro').waitFor();
  check('saved custom sentence appears while flash info is OFF', await page.locator('.dashboard-intro').innerText() === 'Semangat bertugas, warga sekolah!');
  const subscriptions = await page.evaluate(() => window.fixture.subscriptionStarts);
  await page.evaluate(() => { const f = window.fixture; f.emitSchool({ ...f.settings, dashboardInfoConfig: { ...f.settings.dashboardInfoConfig, welcome: { ...f.settings.dashboardInfoConfig.welcome, mode: 'fixed', templateId: 'motivation-small' } } }); });
  await page.getByText('Langkah kecil yang konsisten membantu menciptakan sekolah yang lebih baik.', { exact: true }).waitFor();
  check('live settings replace the sentence without a reload or extra listeners', await page.evaluate(n => window.fixture.subscriptionStarts === n, subscriptions));
  await page.evaluate(() => { const f = window.fixture; f.emitSchool({ ...f.settings, dashboardInfoConfig: { ...f.settings.dashboardInfoConfig, welcome: { ...f.settings.dashboardInfoConfig.welcome, enabled: false } } }); });
  await page.locator('.dashboard-intro').waitFor({ state: 'detached' }); check('message OFF keeps the time greeting and name visible', await page.locator('.dashboard-eyebrow').isVisible() && await page.locator('.dashboard-welcome h1').isVisible());
  await page.evaluate(() => { const f = window.fixture; f.user = { ...f.user, role: 'GURU' }; f.force(); location.hash = '#settings'; });
  await page.getByRole('button', { name: 'Simpan info dashboard' }).waitFor({ state: 'detached' });
  check('teachers cannot open the admin editor', await page.getByRole('button', { name: 'Simpan info dashboard' }).count() === 0);
  // Use a separate virtual clock to cross a WIB boundary without waiting in real time.
  const clockPage = await ctx.newPage(); clockPage.on('pageerror', e => errors.push(e.message));
  await clockPage.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await clockPage.clock.install({ time: new Date('2026-10-18T03:59:50Z') });
  await clockPage.goto(origin + '/#dashboard'); await clockPage.locator('.dashboard-eyebrow').waitFor();
  check('greeting uses WIB even when the browser timezone is Los Angeles', await clockPage.locator('.dashboard-eyebrow').innerText() === 'Selamat pagi');
  await clockPage.clock.fastForward(15000);
  await clockPage.waitForFunction(() => document.querySelector('.dashboard-eyebrow')?.textContent === 'Selamat siang');
  check('an open dashboard changes from morning to noon automatically', await clockPage.locator('.dashboard-eyebrow').innerText() === 'Selamat siang');
  await clockPage.evaluate(() => { const f = window.fixture; f.emitSchool({ ...f.settings, dashboardInfoConfig: { enabled: false, welcome: { enabled: true, mode: 'interval', category: 'islamic', intervalMinutes: 5 } } }); });
  await clockPage.waitForFunction(() => /Allah|niat baik|Alhamdulillah/.test(document.querySelector('.dashboard-intro')?.textContent || ''));
  const previous = await clockPage.locator('.dashboard-intro').innerText();
  await clockPage.clock.fastForward(300000);
  await clockPage.waitForFunction(text => document.querySelector('.dashboard-intro')?.textContent !== text, previous);
  check('automatic interval changes the visible sentence without reload', await clockPage.locator('.dashboard-intro').innerText() !== previous);

  check('UI review has no runtime errors or operational records', errors.length === 0 && await page.evaluate(() => window.fixture.writes.length === 0));
  console.log(`${count} dashboard welcome UI checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
