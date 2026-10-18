// Real settings, report exports and print components. All identity/database IO is synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
const out = process.env.PIKET_BRANDING_QA;
if (out) fs.mkdirSync(out, { recursive: true });
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage({ hasTouch: true, acceptDownloads: true }); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.addInitScript(() => { window.print = () => { if (parent !== window && parent.fixture) parent.fixture.printedHtml = document.documentElement.outerHTML; }; });
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url + '/?brandingSettings#settings');
  await page.getByRole('button', { name: 'Isi format sesuai contoh' }).waitFor();
  check('new application logo is available before any admin edits', await page.getByAltText('Pratinjau logo aplikasi').getAttribute('src') === '/icon.svg' && await page.getByAltText('Pratinjau logo aplikasi').evaluate(i => i.complete && i.naturalWidth > 0));
  await page.getByRole('button', { name: 'Isi format sesuai contoh' }).click();
  check('reference preset fills the foundation, accreditation, NSS and contacts as editable fields', await page.getByLabel('Nama yayasan / instansi', { exact: true }).inputValue() === 'YAYASAN PENDIDIKAN JEMBER INTERNATIONAL SCHOOL' && await page.getByLabel('NSS', { exact: true }).inputValue() === '342052429294' && await page.getByLabel('NPSN pada kop').inputValue() === '60724703');
  const logo = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#000'; x.lineWidth = 20; x.strokeRect(100, 100, 1400, 1000); x.fillStyle = '#000'; x.font = 'bold 220px Arial'; x.fillText('SEKOLAH', 180, 700); return c.toDataURL('image/png'); });
  await page.getByLabel('Unggah logo kop', { exact: true }).setInputFiles({ name: 'logo-uji.png', mimeType: 'image/png', buffer: Buffer.from(logo.split(',')[1], 'base64') });
  await page.getByAltText('Pratinjau logo kop').waitFor();
  await page.waitForFunction(() => document.querySelector('img[alt="Pratinjau logo kop"]')?.naturalWidth > 0);
  check('logo upload is compressed and preserves its aspect ratio', await page.getByAltText('Pratinjau logo kop').evaluate(i => i.naturalWidth <= 512 && Math.abs(i.naturalWidth / i.naturalHeight - 4 / 3) < .01 && i.src.length < 110000));
  for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
    check(`settings at ${width}px/${dark ? 'dark' : 'light'} has no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    if (out && width === 390 && !dark) await page.screenshot({ path: out + '/settings-mobile.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Simpan logo & kop surat' }).click(); await page.getByRole('status').filter({ hasText: 'Logo dan kop surat tersimpan.' }).waitFor();
  check('saving keeps app and letterhead logos independent without rewriting the school profile', await page.evaluate(() => window.fixture.brandingSaves.length === 1 && window.fixture.settings.appLogoUrl === '/icon.svg' && window.fixture.settings.letterheadLogoUrl.startsWith('data:image/png') && window.fixture.settings.schoolName === 'SMK dr. Soebandi'));
  const settings = await page.evaluate(() => ({ ...window.fixture.settings, principalName: 'Kepala Uji', principalIdType: 'NIP', principalIdNumber: '0001', coordinatorName: 'Koordinator Uji', coordinatorIdNumber: '0002', printConfig: { signatureOrder: 'principal_left', showLetterhead: true, showLogo: true, showSignatures: true } }));
  await page.getByLabel('Nama yayasan / instansi', { exact: true }).fill('Draf belum tersimpan'); await page.evaluate(() => { window.fixture.failSettingsSave = true; });
  await page.getByRole('button', { name: 'Simpan logo & kop surat' }).click(); await page.getByRole('alert').waitFor();
  check('failed save preserves the administrator draft', await page.getByLabel('Nama yayasan / instansi', { exact: true }).inputValue() === 'Draf belum tersimpan');
  await page.goto(url + '/?reportsSettings#settings'); await page.getByLabel('Posisi tanda tangan laporan').selectOption('coordinator_left'); await page.getByRole('button', { name: 'Simpan pengaturan cetak & buku tamu' }).click();
  await page.waitForFunction(() => window.fixture.reportSettingsSaves?.length === 1);
  check('admin report signature order is saved through its existing settings section', await page.evaluate(() => window.fixture.reportSettingsSaves[0].printConfig.signatureOrder === 'coordinator_left'));
  await page.goto(url + '/?limited&brandingSettings#settings'); await page.waitForFunction(() => window.fixture?.force); await page.waitForTimeout(50);
  check('non-admin has no logo or letterhead editor', await page.getByRole('button', { name: 'Simpan logo & kop surat' }).count() === 0);
  console.log(`${count} branding and print UI checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
