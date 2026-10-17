// All seven real screens. Synthetic Firestore/Auth only, external HTTP blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
let browser, count = 0; const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
const routes = { attendance: 'attendance', 'duty-book': 'dutyBooks', 'student-tardiness': 'studentTardiness', 'student-permits': 'studentPermits', incidents: 'incidents', visitors: 'visitors', substitutions: 'substitutions' };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage({ hasTouch: true, acceptDownloads: true }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const url = `http://127.0.0.1:${server.address().port}`;
  const seed = async collection => page.evaluate(collection => {
    const f = window.fixture, date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const records = Array.from({ length: 18 }, (_, i) => ({ id: `rec-${i}`, tanggal: date, hari: 'SABTU', userId: i % 2 ? 'teacher-other' : 'test-officer', userName: i % 2 ? 'Guru Lain' : 'Petugas Contoh', jamMasuk: collection === 'attendance' ? date + 'T07:00:00+07:00' : '07:00', jamPulang: i === 0 ? null : date + 'T14:30:00+07:00', distance: 15, latitude: -8, longitude: 113, accuracy: 10, scheduleId: null,
      petugasId: i % 2 ? 'teacher-other' : 'test-officer', petugasName: i % 2 ? 'Guru Lain' : 'Petugas Contoh', ruangName: 'Gerbang', jamMulai: '07:00', jamSelesai: '14:30', catatanPiket: `Catatan ${i}`, absensiGuru: [], absensiSiswa: [],
      namaSiswa: `Siswa Uji ${String(i).padStart(2, '0')}`, kelas: 'X TKJ 1', nisn: `0123456${i}`, jamDatang: '07:12', menitTerlambat: 12, alasan: 'LAINNYA', keteranganLainnya: 'Ban bocor', pembinaan: 'MEMBACA', poinPelanggaran: 1, frekuensiBulanIni: 1, noHpOrangTua: '', jamKeluar: '', jenisIzin: 'KEPERLUAN_KELUARGA', penjemput: 'ORANG_TUA', guruPengajarName: 'Guru Pengajar',
      namaTamu: `Tamu Uji ${String(i).padStart(2, '0')}`, instansiAsal: 'Orang tua', kategori: collection === 'incidents' ? 'SISWA' : 'UMUM', kategoriName: 'Kejadian Siswa', nomorBadge: 'TAMU-' + i, noHp: '', nomorIdentitas: '', tujuanBertemu: 'Guru Contoh', keperluan: 'Konsultasi',
      guruBerhalanganName: 'Guru Berhalangan ' + i, mataPelajaran: 'Bahasa Indonesia', guruPenggantiName: 'Guru Pengganti', jamPelajaran: 'JP 1–2', materiDanTugasSiswa: 'Kerjakan latihan', alasanBerhalangan: 'SAKIT',
      waktu: '09:00', tingkatKeparahan: 'SEDANG', lokasi: 'Halaman', pihakTerlibat: 'Siswa Uji', uraian: 'Kronologi uji', tindakanAwal: 'Pendampingan', penanggungJawab: 'Petugas', pelaporName: 'Petugas Contoh', pelaporId: 'test-officer', photos: [],
      status: { attendance: 'DALAM_LOKASI', dutyBooks: 'DRAFT', studentTardiness: 'DALAM_PEMBINAAN', studentPermits: 'SEDANG_KELUAR', incidents: 'BARU', visitors: 'SEDANG_BERKUNJUNG', substitutions: 'MENUNGGU_GURU_INVAL' }[collection],
      petugasPiketName: 'Petugas Contoh', petugasPiketId: 'test-officer', createdBy: 'Petugas Contoh', updatedBy: 'Petugas Contoh', createdAt: date + 'T08:00:00+07:00', updatedAt: date + 'T08:00:00+07:00', dataSource: 'PRODUCTION', isDemo: false }));
    f.emitCollection(collection, records); f.seededRows = records;
  }, collection);
  for (const [tab, collection] of Object.entries(routes).filter(([tab]) => !process.env.PIKET_HISTORY_MODULES || process.env.PIKET_HISTORY_MODULES.split(',').includes(tab))) {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(url + '/#' + tab);
    if (tab === 'attendance') await page.getByRole('button', { name: /Rekap Kehadiran/ }).click();
    const period = page.getByRole('combobox', { name: 'Periode riwayat', exact: true }); await period.waitFor(); await seed(collection);
    check(`${tab}: six compact period choices`, await period.locator('option').count() === 6);
    check(`${tab}: exactly 15 rendered records per view with page controls`, (await page.locator('.history-pagination').innerText()).includes('1–15 dari 18 data'));
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    check(`${tab}: second page contains the remaining records`, (await page.locator('.history-pagination').innerText()).includes('16–18 dari 18 data'));
    await period.selectOption('today');
    check(`${tab}: changing period resets pagination`, (await page.locator('.history-pagination').innerText()).includes('1–15 dari 18 data'));
    for (const mode of ['week', 'month', 'semester', 'year']) { await period.selectOption(mode); await page.waitForTimeout(20); }
    await page.getByLabel('Tahun riwayat').fill(''); await page.getByLabel('Tahun riwayat').pressSequentially('2026');
    check(`${tab}: the year can be typed digit by digit`, await page.getByLabel('Tahun riwayat').inputValue() === '2026');
    check(`${tab}: period queries remain bounded in Firestore`, await page.evaluate(collection => window.fixture.queries.filter(q => q.collection === collection).every(q => q.constraints.length > 0 && q.constraints.some(c => c.type === 'where' && /^\d{4}-\d{2}-\d{2}$/.test(c.value))), collection));
    await period.selectOption('custom'); await page.getByLabel('Dari tanggal', { exact: true }).fill('2099-02-02'); await page.getByLabel('Sampai tanggal', { exact: true }).fill('2099-02-01');
    check(`${tab}: reversed custom range is explained and never displays old rows`, await page.getByRole('alert').filter({ hasText: 'Tanggal awal tidak boleh' }).isVisible() && (await page.locator('.history-pagination').innerText()).includes('0 data'));
    await period.selectOption('today'); await seed(collection);
    for (const mode of ['light', 'dark']) for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
      for (const view of ['grid', 'list']) {
        await page.getByRole('button', { name: `Tampilan ${view}`, exact: true }).click();
        check(`${tab}/${mode}/${width}/${view}: controls work and the page does not overflow`, await page.getByRole('button', { name: `Tampilan ${view}`, exact: true }).getAttribute('aria-pressed') === 'true' && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
      }
    }
    if (['attendance', 'duty-book'].includes(tab)) {
      await page.getByRole('combobox', { name: 'Pengguna riwayat' }).selectOption('me');
      check(`${tab}: own-user filter isolates records`, (await page.locator('.history-pagination').innerText()).includes('dari 9 data'));
      await page.getByRole('combobox', { name: 'Pengguna riwayat' }).selectOption('teacher-other');
      check(`${tab}: another visible user can be selected`, (await page.locator('.history-pagination').innerText()).includes('dari 9 data'));
      await page.getByRole('combobox', { name: 'Pengguna riwayat' }).selectOption('all');
      if (tab === 'attendance') check('attendance: elapsed duration and pending checkout are distinct', await page.getByText('7 jam 30 menit', { exact: true }).first().isVisible() && await page.getByText('Belum pulang', { exact: true }).isVisible());
    } else {
      check(`${tab}: the former Excel action is removed`, await page.getByRole('button', { name: /Ekspor Excel/ }).count() === 0);
      await page.getByRole('button', { name: 'Ekspor Word / PDF', exact: true }).click();
      check(`${tab}: export contains all 18 filtered records rather than 15 visible rows`, (await page.getByRole('dialog', { name: 'Ekspor laporan' }).innerText()).includes('18 catatan'));
      const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Unduh Word (.docx)' }).click(); const download = await downloadEvent;
      const path = `${process.env.PIKET_HISTORY_QA || '/workspace/scratch/98cae2589cf1/history-qa'}/${tab}.docx`; fs.mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true }); await download.saveAs(path);
      check(`${tab}: a real DOCX file is downloaded`, fs.readFileSync(path).subarray(0, 2).toString() === 'PK');
      await page.keyboard.press('Escape');
    }
    if (process.env.PIKET_QA_SCREENSHOTS) { await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Tampilan grid', exact: true }).click(); fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.PIKET_QA_SCREENSHOTS}/${tab}.png` }); }
    check(`${tab}: browsing and exporting do not write school records`, await page.evaluate(() => window.fixture.writes.length) === 0);
  }
  check('all exercised screens have no runtime errors', errors.length === 0);
  console.log(`${count} operational history/browser scenarios passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
