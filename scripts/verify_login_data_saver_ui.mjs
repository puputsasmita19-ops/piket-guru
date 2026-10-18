// Actual login/admin components, with synthetic settings and no production IO.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const { chromium: pw } = dep('playwright-core'), chromium = dep('@sparticuz/chromium').default;
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const context = await browser.newContext({ hasTouch: true }), page = await context.newPage(), assets = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => { if (/\/login-ocean(?:-poster\.jpg|\.mp4)/.test(r.request().url())) assets.push(r.request().url()); return new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(); });
  let config = { background: 'ocean' }, hold = null;
  await page.route('**/api/auth/public-config', async r => { if (hold) await hold; await r.fulfill({ json: { success: true, config: { loginAppearance: config } } }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.setViewportSize({ width: 360, height: 740 }); await page.goto(origin + '/?economy#login-ui'); await page.locator('.login-gradient-motion').waitFor(); await page.waitForTimeout(800);
  check('existing ocean configuration without a policy defaults to zero background-media requests', assets.length === 0 && await page.locator('.login-ocean-video').count() === 0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    check(`${width}: economical motion remains visible with an ergonomic footer`, await page.locator('.login-gradient-motion').isVisible() && await page.locator('.login-footer').evaluate(e => e.getBoundingClientRect().bottom <= innerHeight && document.documentElement.scrollWidth === innerWidth));
  }
  // A cached video preference must not download media while the new server policy is pending.
  await page.evaluate(() => localStorage.setItem('piket_guru_school_config', JSON.stringify({ loginAppearance: { background: 'ocean', mediaPolicy: 'always' } })));
  let release; hold = new Promise(r => { release = r; });
  await page.reload(); await page.getByRole('button', { name: 'Masuk Sekarang', exact: true }).waitFor(); await page.waitForTimeout(800);
  check('login remains usable and media-free while fresh settings are pending', assets.length === 0 && await page.locator('.login-ocean-video').count() === 0);
  release(); hold = null; await page.waitForTimeout(100);
  config = { background: 'ocean', mediaPolicy: 'adaptive' };
  await page.addInitScript(() => { window.testConnection = { effectiveType: '3g', saveData: false, addEventListener() {}, removeEventListener() {} }; Object.defineProperty(navigator, 'connection', { configurable: true, get: () => window.testConnection }); });
  await page.reload(); await page.locator('.login-gradient-motion').waitFor(); await page.waitForTimeout(800);
  check('adaptive mode on a slow connection downloads neither poster nor video', assets.length === 0);
  // Unknown connection support is treated conservatively as well.
  await page.evaluate(() => { window.testConnection.effectiveType = undefined; document.dispatchEvent(new Event('visibilitychange')); });
  check('unknown connection keeps economical background', await page.locator('.login-gradient-motion').isVisible());
  await page.evaluate(() => { window.testConnection.effectiveType = '4g'; document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('.login-ocean-video').waitFor(); await page.waitForFunction(() => document.querySelector('.login-ocean-video')?.getAttribute('src'));
  check('adaptive mode allows video only after fast connection information is available', assets.some(url => url.includes('.mp4')));
  await page.evaluate(() => { window.testConnection.saveData = true; document.dispatchEvent(new Event('visibilitychange')); }); await page.locator('.login-gradient-motion').waitFor();
  check('turning on device data saver removes the active video', await page.locator('.login-ocean-video').count() === 0);
  await page.goto(origin + '/?loginSettings#settings'); await page.getByLabel('Pemakaian data latar', { exact: true }).waitFor();
  check('admin starts with recommended economy mode', await page.getByLabel('Pemakaian data latar', { exact: true }).inputValue() === 'economy');
  await page.getByLabel('Pemakaian data latar', { exact: true }).selectOption('always'); await page.getByLabel('Jenis latar login', { exact: true }).selectOption('ocean');
  await page.getByRole('button', { name: 'Gunakan mode hemat', exact: true }).click();
  check('one-click savings selects gradient and preserves the running credit', await page.getByLabel('Pemakaian data latar', { exact: true }).inputValue() === 'economy' && await page.getByLabel('Jenis latar login', { exact: true }).inputValue() === 'gradient' && await page.getByRole('switch', { name: 'Teks pengembang berjalan', exact: true }).isChecked());
  await page.evaluate(() => { window.fixture.failSettingsSave = true; }); await page.getByRole('button', { name: 'Simpan tampilan login' }).click(); await page.getByRole('alert').waitFor();
  check('failed save retains the economical draft', await page.getByLabel('Pemakaian data latar', { exact: true }).inputValue() === 'economy');
  await page.evaluate(() => { window.fixture.failSettingsSave = false; }); await page.getByRole('button', { name: 'Simpan tampilan login' }).click(); await page.getByRole('status').filter({ hasText: 'tersimpan' }).waitFor();
  check('saving persists economy mode in the administrator settings', await page.evaluate(() => window.fixture.settings.loginAppearance.mediaPolicy === 'economy' && window.fixture.settings.loginAppearance.background === 'gradient'));
  if (process.env.PIKET_QA_SCREENSHOTS) { fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS, { recursive: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.screenshot({ path: process.env.PIKET_QA_SCREENSHOTS + '/login-data-settings.png', fullPage: true }); }
  await page.evaluate(() => { window.fixture.user = { ...window.fixture.user, role: 'GURU' }; window.fixture.force(); }); await page.getByRole('button', { name: 'Simpan tampilan login' }).waitFor({ state: 'detached' });
  check('teachers cannot change the policy and no operational records are created', await page.getByLabel('Pemakaian data latar', { exact: true }).count() === 0 && await page.evaluate(() => window.fixture.writes.length === 0) && errors.length === 0);
  console.log(`${count} login data-saver UI checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
