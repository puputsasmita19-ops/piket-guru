// Real header/sidebar with synthetic IO. External requests are blocked.
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
  const page = await browser.newPage({ hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const url = `http://127.0.0.1:${server.address().port}`;
  const actions = page.locator('.app-header-actions .header-icon-button');
  for (const mode of ['light', 'dark']) for (const width of [320, 360, 390, 400, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(url + '/#dashboard');
    await actions.last().waitFor();
    await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
    check(`${mode}/${width}: five 44px actions, separated and within the header`, await actions.evaluateAll(es => {
      const rects = es.map(e => e.getBoundingClientRect());
      return es.length === 5 && rects.every((r, i) => r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= 64 && r.right <= innerWidth && (!i || r.left >= rects[i - 1].right + 1));
    }) && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    for (let i = 0; i < 5; i++) {
      // Tap the next icon while the previous panel is still open: no outside tap.
      await actions.nth(i).tap();
      await page.waitForFunction(i => document.querySelectorAll('.app-header-actions .header-icon-button')[i].getAttribute('aria-expanded') === 'true', i);
      await page.waitForTimeout(170);
      check(`${mode}/${width}: action ${i + 1} opens alone with a soft frameless surface`, await actions.evaluateAll((es, i) => {
        const s = getComputedStyle(es[i]);
        return es.filter(e => e.getAttribute('aria-expanded') === 'true').length === 1 && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(s.borderWidth) === 0 && s.boxShadow === 'none' && s.outlineStyle === 'none';
      }, i));
    }
    check(`${mode}/${width}: open profile retains identity and existing actions`, await page.getByRole('button', { name: 'Profil & Ganti PIN' }).isVisible() && await page.getByText('Petugas Contoh', { exact: true }).first().isVisible());
    await actions.last().tap();
    check(`${mode}/${width}: tapping profile again closes it`, await actions.last().getAttribute('aria-expanded') === 'false');
    check(`${mode}/${width}: opening panels never blurs the header`, await page.locator('header').evaluate(e => getComputedStyle(e).filter === 'none' && getComputedStyle(e).backdropFilter === 'none'));
    if (process.env.PIKET_QA_SCREENSHOTS && [390, 1440].includes(width)) {
      await actions.nth(3).tap(); fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: `${process.env.PIKET_QA_SCREENSHOTS}/header-${mode}-${width}.png` }); await actions.nth(3).tap();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(url + '/?desktop-controls#dashboard');
  const toggle = page.locator('.header-sidebar-toggle'); await toggle.waitFor();
  check('desktop has exactly one sidebar toggle beside the logo', await page.getByRole('button', { name: 'Sembunyikan panel menu (Ctrl+B)', exact: true }).count() === 1 && await page.locator('aside').getByRole('button', { name: /Sembunyikan panel/ }).count() === 0 && await toggle.getAttribute('aria-controls') === 'app-sidebar');
  await toggle.click(); await page.waitForFunction(() => getComputedStyle(document.querySelector('#app-sidebar')).visibility === 'hidden');
  check('the same minimal header button restores the hidden sidebar without floating duplicates', await toggle.getAttribute('aria-expanded') === 'false' && await page.getByRole('button', { name: 'Tampilkan panel navigasi (Ctrl+B)', exact: true }).count() === 0);
  await page.reload(); await toggle.waitFor();
  check('hidden preference survives reload and the header control stays available', await toggle.getAttribute('aria-expanded') === 'false' && await toggle.isVisible());
  await toggle.click(); await page.waitForFunction(() => getComputedStyle(document.querySelector('#app-sidebar')).visibility === 'visible');
  const pin = page.getByRole('button', { name: 'Lepas sematan menu (Menu ikut tergulir)', exact: true }); await pin.click();
  check('pin can still be released independently', await page.getByRole('button', { name: 'Sematkan menu (Freeze menu tetap di posisi)', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Sematkan menu (Freeze menu tetap di posisi)', exact: true }).click();
  await page.keyboard.press('Control+b'); await page.waitForFunction(() => document.querySelector('.header-sidebar-toggle').getAttribute('aria-expanded') === 'false');
  await page.keyboard.press('Control+b'); await page.waitForFunction(() => document.querySelector('.header-sidebar-toggle').getAttribute('aria-expanded') === 'true');
  check('Ctrl+B still hides and restores the sidebar', true);
  await actions.nth(3).focus(); await page.keyboard.press('Tab');
  check('keyboard focus remains visible inside the profile button without overlapping neighbours', await actions.last().evaluate(e => {
    const s = getComputedStyle(e); return document.activeElement === e && e.matches(':focus-visible') && s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 2 && parseFloat(s.outlineOffset) < 0 && s.boxShadow === 'none';
  }));
  await page.keyboard.press('Enter');
  check('keyboard can still open profile actions', await page.getByRole('button', { name: 'Profil & Ganti PIN' }).isVisible());
  check('no operational writes or runtime errors', await page.evaluate(() => window.fixture.writes.length) === 0 && errors.length === 0);
  console.log(`${count} clean header/sidebar browser checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
