import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const { chromium: pw } = dep('playwright-core'), chromium = dep('@sparticuz/chromium').default;
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0; const check = (name, value) => { assert.ok(value, name); count++; console.log('PASS', name); };
const out = process.env.PIKET_QA_SCREENSHOTS; if (out) fs.mkdirSync(out, { recursive: true });
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const ctx = await browser.newContext({ hasTouch: true }), page = await ctx.newPage(), errors = []; page.setDefaultTimeout(12000);
  page.on('pageerror', e => errors.push(e.message));
  let config = { mediaPolicy: 'always', background: 'ocean' }, videoRequests = 0, videoAfterLogin = true;
  await page.route('**/*', async r => { const u = new URL(r.request().url()); if (u.hostname !== '127.0.0.1') return r.abort(); if (u.pathname === '/login-ocean.mp4') { videoRequests++; videoAfterLogin &&= await page.getByRole('button', { name: 'Masuk Sekarang', exact: true }).count() === 1; } return r.continue(); });
  await page.route('**/api/auth/public-config', r => r.fulfill({ json: { success: true, config: { appCreator: 'Tim Pengembang Sistem Piket untuk Seluruh Warga Sekolah', loginAppearance: config } } }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin + '/?login#login-ui'); await page.locator('.login-footer').waitFor();
  for (const [width, height] of [[320,740],[360,740],[390,844],[768,900],[1440,900]]) for (const dark of [false,true]) {
    await page.setViewportSize({ width, height }); await page.evaluate(v => document.documentElement.classList.toggle('dark', v), dark); await page.waitForTimeout(250);
    const layout = await page.locator('.login-footer').evaluate(e => { const bs = [...e.querySelectorAll('.login-footer-action')].map(b => b.getBoundingClientRect()), c = document.querySelector('.login-card').getBoundingClientRect(), f = e.getBoundingClientRect(); return { fits: c.top >= 0 && f.bottom <= innerHeight, bottom: f.bottom, top: c.top, overflow: document.documentElement.scrollWidth > innerWidth, targets: bs.length === 2 && bs.every((r,i) => r.width >= 44 && r.height >= 44 && (!i || r.left >= bs[i-1].right)), icons: [...e.querySelectorAll('.login-footer-action > svg')].every(s => s.getBoundingClientRect().width === 16) }; });
    if (out && width === 390) await page.screenshot({ path: `${out}/login-motion-${dark}.png`, fullPage: true });
    check(`${width}/${dark}: logo, login and compact footer fit the viewport ${JSON.stringify(layout)}`, layout.fits && !layout.overflow && layout.targets && layout.icons);
  }
  check('ocean video is deferred until the login controls exist', videoRequests > 0 && videoAfterLogin);
  check('video is muted, inline and decorative', await page.locator('.login-ocean-video').evaluate(v => v.muted && v.playsInline && v.loop && v.closest('[aria-hidden="true"]') !== null));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => document.querySelector('.login-motion-backdrop')?.dataset.motion === 'paused');
  check('hidden tab pauses its background video', await page.locator('.login-ocean-video').evaluate(v => v.paused));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => document.querySelector('.login-motion-backdrop')?.dataset.motion === 'running');

  const credit = page.locator('.login-credit'), track = page.locator('.login-credit-track'); const a = await track.evaluate(e => getComputedStyle(e).transform); await page.waitForTimeout(300);
  check('developer text moves automatically', a !== await track.evaluate(e => getComputedStyle(e).transform));
  await credit.click(); check('tap pauses the credit', await track.evaluate(e => getComputedStyle(e).animationPlayState === 'paused')); await credit.click(); check('tap resumes the credit on touch devices', await track.evaluate(e => getComputedStyle(e).animationPlayState === 'running'));
  await page.getByRole('button', { name: 'Hubungi Admin', exact: true }).click(); await page.getByRole('dialog', { name: 'Hubungi Admin' }).waitFor(); check('small help icon retains its existing contact action', true); await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await page.goto(origin + '/?loginSettings#settings'); await page.getByRole('switch', { name: 'Aktifkan motion background', exact: true }).waitFor();
  await page.getByLabel('Pemakaian data latar', { exact: true }).selectOption('always'); await page.getByLabel('Jenis latar login', { exact: true }).selectOption('gradient'); await page.getByLabel('Kecepatan latar', { exact: true }).selectOption('fast'); await page.getByRole('switch', { name: 'Teks pengembang berjalan', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Simpan tampilan login' }).click(); await page.getByRole('status').filter({ hasText: 'Tampilan login tersimpan' }).waitFor();
  config = await page.evaluate(() => window.fixture.settings.loginAppearance);
  check('admin saves background, speed and running-text choices', config.background === 'gradient' && config.speed === 'fast' && config.runningCredit === false);
  await page.goto(origin + '/?login#login-ui'); await page.locator('.login-credit-static').waitFor(); check('saved appearance reaches login via public config', await page.locator('.login-gradient-motion').count() === 1 && await page.locator('.login-ocean-video').count() === 0 && await page.locator('.login-credit').count() === 0);
  config = { motionEnabled: false, runningCredit: true }; await page.reload(); await page.locator('.login-footer').waitFor(); check('motion OFF leaves a working plain login', await page.locator('.login-motion-backdrop').count() === 0 && await page.getByRole('button', { name: 'Masuk Sekarang', exact: true }).isVisible());
  const quiet = await ctx.newPage(); const quietRequests = []; await quiet.emulateMedia({ reducedMotion: 'reduce' });
  await quiet.route('**/*', r => { if (r.request().url().includes('/login-ocean.mp4')) quietRequests.push(r.request().url()); return new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(); });
  await quiet.route('**/api/auth/public-config', r => r.fulfill({ json: { success: true, config: { loginAppearance: { motionEnabled: true, background: 'ocean', mediaPolicy: 'always', runningCredit: true } } } }));
  await quiet.goto(origin + '/?quiet#login-ui'); await quiet.locator('.login-credit-track').waitFor(); await quiet.waitForTimeout(800);
  check('reduced motion downloads no video and shows static readable credit', quietRequests.length === 0 && await quiet.locator('.login-credit-track').evaluate(e => getComputedStyle(e).animationName === 'none' && getComputedStyle(e.children[1]).display === 'none'));
  await quiet.addInitScript(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, addEventListener() {}, removeEventListener() {} } }); });
  await quiet.emulateMedia({ reducedMotion: 'no-preference' }); await quiet.reload(); await quiet.locator('.login-footer').waitFor(); await quiet.waitForTimeout(800);
  check('data saver uses the poster without downloading the clip', quietRequests.length === 0 && await quiet.locator('.login-ocean-video').evaluate(v => !v.getAttribute('src')));
  check('no exercised interaction raises a runtime error', errors.length === 0);
  console.log(`${count} login motion and layout UI checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
