// Native touch and keyboard focus regression. Uses the real carousel with synthetic IO.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0;
const check = (name, result) => { assert.ok(result, name); count++; console.log('PASS', name); };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/?touch-resume=' + width + '#dashboard');
    const flash = page.getByRole('region', { name: 'Flash info sekolah' }); await flash.waitFor();
    await page.evaluate(() => window.fixture.emitSchool({ ...window.fixture.settings, dashboardInfoConfig: { enabled: true, autoPlay: true, intervalMs: 2000 } }));
    await flash.getByRole('button', { name: 'Jeda flash info' }).tap();
    const pausedTitle = await flash.getByRole('heading').innerText();
    await page.waitForTimeout(2800);
    check(`${width}: touch pause keeps the slide stopped`, await flash.getByRole('heading').innerText() === pausedTitle);
    await flash.getByRole('button', { name: 'Putar flash info' }).tap();
    check(`${width}: Play preserves the focused control for accessibility`, await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Jeda flash info'));
    // Deliberately do not blur, tap elsewhere, or move a mouse after pressing Play.
    await page.waitForFunction(title => document.querySelector('.flash-slide:not([inert]) h2')?.textContent !== title, pausedTitle, { timeout: 4500, polling: 100 });
    check(`${width}: touch Play resumes automatically without another tap or blur`, await flash.getByRole('heading').innerText() !== pausedTitle);
    const firstResumedTitle = await flash.getByRole('heading').innerText();
    await page.waitForFunction(title => document.querySelector('.flash-slide:not([inert]) h2')?.textContent !== title, firstResumedTitle, { timeout: 4500, polling: 100 });
    check(`${width}: automatic rotation continues on the following cycle`, true);
    await page.waitForFunction(() => document.querySelector('[aria-label="Flash info sekolah"]').dataset.transitioning === 'false');
    await flash.getByRole('button', { name: 'Info berikutnya' }).tap();
    const manualTitle = await flash.getByRole('heading').innerText();
    await page.waitForFunction(title => document.querySelector('.flash-slide:not([inert]) h2')?.textContent !== title, manualTitle, { timeout: 4500, polling: 100 });
    check(`${width}: touching manual Next does not leave autoplay stuck on focus`, true);
    await flash.getByRole('button', { name: 'Jeda flash info' }).tap();
    const pausedAgain = await flash.getByRole('heading').innerText(); await page.waitForTimeout(2800);
    check(`${width}: Pause still works after resuming`, await flash.getByRole('heading').innerText() === pausedAgain);
    check(`${width}: no runtime errors or operational writes`, errors.length === 0 && await page.evaluate(() => window.fixture.writes.length) === 0);
  }
  const desktop = page; await desktop.setViewportSize({ width: 1440, height: 900 });
  await desktop.goto(origin + '/?desktop-resume#dashboard');
  const flash = desktop.getByRole('region', { name: 'Flash info sekolah' }); await flash.waitFor();
  await desktop.evaluate(() => window.fixture.emitSchool({ ...window.fixture.settings, dashboardInfoConfig: { enabled: true, autoPlay: true, intervalMs: 2000 } }));
  await flash.getByRole('button', { name: 'Jeda flash info' }).click(); await flash.getByRole('button', { name: 'Putar flash info' }).click();
  const hovered = await flash.getByRole('heading').innerText();
  await desktop.waitForFunction(title => document.querySelector('.flash-slide:not([inert]) h2')?.textContent !== title, hovered, { timeout: 4500, polling: 100 });
  check('desktop Play also resumes while the mouse remains over the control', true);
  await flash.getByRole('button', { name: 'Jeda flash info' }).click();
  await desktop.mouse.move(0, 0); await flash.getByRole('button', { name: 'Putar flash info' }).focus();
  await desktop.keyboard.press('Enter'); const keyboardTitle = await flash.getByRole('heading').innerText();
  await desktop.waitForFunction(title => document.querySelector('.flash-slide:not([inert]) h2')?.textContent !== title, keyboardTitle, { timeout: 4500, polling: 100 });
  check('keyboard Play resumes without blurring or moving keyboard focus away', await desktop.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Jeda flash info'));
  await desktop.close();
  console.log(`${count} touch carousel resume checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
