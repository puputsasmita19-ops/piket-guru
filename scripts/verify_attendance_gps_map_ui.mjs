// Actual attendance, GPS service and Leaflet. Fake coordinates/Firestore only;
// no device permissions, production records or external tile requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default;
const { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, passed = 0;
const check = (name, ok) => { assert.ok(ok, name); console.log('PASS', name); passed++; };
const initGPS = () => {
  const watchers = new Map(); let id = 0;
  window.gpsMock = { watchers, cleared: [], calls: 0, all: new Map(),
    emit(lat = -8, lng = 113, accuracy = 8, target) { const targets = target ? [this.all.get(target)] : [...watchers.values()]; for (const x of targets) x?.success({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() }); },
    fail(code = 1) { for (const x of [...watchers.values()]) x.error({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); },
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(success, error) { const n = ++id; window.gpsMock.calls++; watchers.set(n, { success, error }); window.gpsMock.all.set(n, { success, error }); return n; },
    clearWatch(n) { watchers.delete(n); window.gpsMock.cleared.push(n); },
  } });
};
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  let failTiles = false;
  await page.route('**/*', r => {
    const url = new URL(r.request().url());
    if (url.hostname === '127.0.0.1') return r.continue();
    external.push(url.hostname);
    if (url.hostname === 'tile.openstreetmap.org' && !failTiles) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9e7db"/><path d="M0 65H256M90 0V256M0 190L256 90" fill="none" stroke="#fff" stroke-width="8"/><text x="12" y="30" fill="#777" font-size="12">Peta uji sintetis</text></svg>' });
    return r.abort();
  });
  await page.addInitScript(initGPS);
  const url = `http://127.0.0.1:${server.address().port}`;
  const open = async (mode = 'light', width = 390, query = '') => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url + '/' + query + '#attendance');
    await page.evaluate(mode => { localStorage.setItem('piket_guru_theme', mode); localStorage.setItem('piket_guru_pastel_theme', 'default'); }, mode);
    await page.reload();
  };
  for (const mode of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    await open(mode, width);
    await page.locator('[data-gps-search="active"]').waitFor();
    check(`${mode}/${width}: one GPS animation, no badge/button spinners`, await page.locator('.gps-search-indicator').count() === 1 && await page.locator('.attendance-gps-panel [class*="animate-spin"], .attendance-gps-panel [class*="animate-pulse"]').count() === 0);
    await page.evaluate(() => window.gpsMock.emit(-8.00005, 113.00005));
    await page.locator('.gps-user-marker').waitFor();
    await page.locator('[data-gps-search="idle"]').waitFor();
    check(`${mode}/${width}: real school/user markers and visible attribution`, await page.locator('.gps-school-marker').count() === 1 && await page.getByRole('link', { name: 'OpenStreetMap', exact: true }).isVisible());
    check(`${mode}/${width}: map fits screen and GPS search stops`, await page.evaluate(() => document.documentElement.scrollWidth === innerWidth) && await page.locator('.gps-map-canvas').evaluate(e => e.clientWidth > 100 && e.clientHeight >= 230) && await page.locator('.gps-search-indicator').count() === 0);
    if (process.env.PIKET_QA_SCREENSHOTS) { fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS, { recursive: true }); await page.locator('[data-tour="gps-status"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.PIKET_QA_SCREENSHOTS + `/gps-${mode}-${width}.png` }); }
  }
  await open();
  await page.locator('.gps-school-marker').waitFor();
  check('no invented user marker before device returns a reading', await page.locator('.gps-user-marker').count() === 0);
  const start = Date.now();
  await page.locator('[data-gps-search="idle"]').waitFor();
  check('GPS timeout releases UI within three seconds', Date.now() - start < 3000 && await page.getByRole('button', { name: 'Coba GPS lagi' }).isEnabled());
  await page.getByRole('button', { name: 'Coba GPS lagi' }).click();
  await page.evaluate(() => window.gpsMock.fail(1));
  await page.getByText(/Izin lokasi GPS ditolak/).waitFor();
  check('permission denial clears animation and provides recovery', await page.locator('.gps-search-indicator').count() === 0 && await page.getByRole('button', { name: 'Coba GPS lagi' }).isEnabled());
  await page.getByRole('button', { name: 'Coba GPS lagi' }).click();
  await page.evaluate(() => window.gpsMock.emit(-8, 113, 90));
  await page.getByText('Menyempurnakan posisi Anda').waitFor();
  check('provisional position remains clearly provisional with only one animation', await page.locator('.gps-user-marker').count() === 1 && await page.getByText(/Anda \(sementara\)/).isVisible() && await page.locator('.gps-search-indicator').count() === 1);
  await page.locator('[data-gps-search="idle"]').waitFor();
  check('unacceptable accuracy never becomes a valid displayed user fix', await page.locator('.gps-user-marker').count() === 0 && await page.getByText(/belum memenuhi batas presensi/).isVisible());
  await page.getByRole('button', { name: 'Coba GPS lagi' }).click();
  const oldWatch = await page.evaluate(() => window.gpsMock.calls);
  await page.evaluate(() => window.fixture.emitSchool({ ...window.fixture.settings, schoolLat: -7.9, schoolLng: 113.1, allowedRadiusMeters: 180, schoolName: 'Sekolah Diperbarui' }));
  await page.getByText('Radius sekolah 180 m', { exact: false }).waitFor();
  await page.evaluate(n => { window.gpsMock.emit(-8, 113, 8, n); window.gpsMock.emit(-7.90002, 113.10002, 8); }, oldWatch);
  await page.locator('[data-gps-search="idle"]').waitFor();
  check('live admin coordinates/radius replace old settings; cancelled result cannot overwrite', await page.getByText(/Sekolah Diperbarui · radius 180 m/).isVisible() && await page.getByText('-7.900020, 113.100020').isVisible() && await page.getByText('Dalam Radius Sekolah', { exact: true }).isVisible());
  await open('light', 390, '?settingsdelay=1');
  await page.getByText('Menunggu pengaturan sekolah').waitFor();
  await page.evaluate(() => window.fixture.emitSchool({ ...window.fixture.settings, schoolLat: 0, schoolLng: 0, allowedRadiusMeters: 50 }));
  await page.locator('[data-gps-search="active"]').waitFor();
  await page.evaluate(() => window.gpsMock.emit(0, 0));
  await page.locator('.gps-user-marker').waitFor();
  check('zero latitude/longitude are valid, not treated as missing', await page.getByText('0.000000, 0.000000').isVisible());
  await page.getByRole('button', { name: 'Perbesar peta' }).click(); await page.getByRole('button', { name: 'Perkecil peta' }).click(); await page.getByRole('button', { name: 'Tampilkan sekolah dan posisi Anda' }).click();
  check('zoom and reframe do not request GPS again', await page.evaluate(() => window.gpsMock.watchers.size === 0));
  await page.evaluate(() => window.fixture.emitSchool({ ...window.fixture.settings, schoolLat: 999 }));
  await page.getByText('Lokasi sekolah belum valid').waitFor();
  check('invalid school coordinates disable GPS and remove misleading map', await page.locator('.gps-map-canvas').count() === 0 && await page.getByRole('button', { name: 'Perbarui GPS' }).isDisabled());
  await open('light', 390, '?settingsdelay=1');
  await page.getByText('Menunggu pengaturan sekolah').waitFor();
  check('no default-school lookup while authoritative settings are pending', await page.evaluate(() => window.gpsMock.calls === 0) && await page.locator('.gps-map-canvas').count() === 0);
  await page.evaluate(() => window.fixture.emitSchool(window.fixture.settings));
  await page.locator('[data-gps-search="active"]').waitFor();
  await page.getByRole('button', { name: /Rekap Kehadiran/ }).click();
  check('switching to recap removes map UI and map controls', await page.locator('.gps-map-canvas').count() === 0);
  failTiles = true;
  await open(); await page.evaluate(() => window.gpsMock.emit());
  await page.getByText(/Latar peta belum tersedia/).waitFor();
  check('tile failure keeps real GPS marker and usable refresh', await page.locator('.gps-user-marker').count() === 1 && await page.getByRole('button', { name: 'Perbarui GPS' }).isEnabled());
  failTiles = false; await page.getByRole('button', { name: 'Coba peta lagi' }).click();
  await page.getByText(/Latar peta belum tersedia/).waitFor({ state: 'detached' });
  check('map tile retry recovers without a new GPS request', await page.evaluate(() => window.gpsMock.calls === 1));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(); await page.locator('[data-gps-search="active"]').waitFor();
  check('reduced motion uses a static indicator', await page.locator('.gps-search-indicator').evaluate(e => getComputedStyle(e, '::after').animationName === 'none'));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.addInitScript(initGPS); await mobile.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await mobile.goto(url + '/#attendance'); await mobile.getByRole('button', { name: 'Geser peta', exact: true }).waitFor();
  check('touch map starts locked so the page remains easy to scroll', await mobile.getByRole('button', { name: 'Geser peta', exact: true }).getAttribute('aria-pressed') === 'false');
  await mobile.getByRole('button', { name: 'Geser peta', exact: true }).click();
  check('touch user can explicitly explore and finish dragging', await mobile.getByRole('button', { name: 'Selesai geser peta' }).getAttribute('aria-pressed') === 'true');
  await mobile.getByRole('button', { name: 'Selesai geser peta' }).click();
  check('map requests only tile images from external hosts', external.every(h => h === 'tile.openstreetmap.org'));
  check('viewing/changing map does not write operational records', await page.evaluate(() => window.fixture.writes.length === 0));
  check('attendance map and GPS flow have no runtime errors', errors.length === 0);
  console.log(`${passed} attendance GPS/map scenarios passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
