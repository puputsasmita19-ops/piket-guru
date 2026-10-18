// Real ReportsPreview and print components; synthetic records, blocked external services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
const out = process.env.PIKET_CENTER_QA || path.resolve('../centered-reports-qa'); fs.mkdirSync(out, { recursive: true });
let browser, count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage({ hasTouch: true, acceptDownloads: true, viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url + '/#dashboard'); await page.waitForFunction(() => window.fixture?.emitSchool);
  const settings = await page.evaluate(() => {
    const f = window.fixture, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const c = document.createElement('canvas'); c.width = 160; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 160, 160); x.strokeRect(10, 10, 140, 140); x.fillStyle = '#111'; x.font = 'bold 22px Arial'; x.fillText('SEKOLAH', 23, 85);
    f.settings = { ...f.settings, principalName: 'Kepala Uji', coordinatorName: 'Koordinator Uji', appLogoUrl: '/icon.svg', letterheadLogoUrl: c.toDataURL('image/png'), letterheadConfig: { foundationName: 'YAYASAN PENDIDIKAN JEMBER INTERNATIONAL SCHOOL', schoolName: 'SMK dr. SOEBANDI', accreditation: 'TERAKREDITASI (A)', accreditationNumber: '(BAN-PDM) NOMOR : 604/BAN-PDM/SK/2025', nss: '342052429294', npsn: '60724703', address: 'Jl. dr. Soebandi No. 99A, Jember', phone: '(0331) 5104296', email: 'smkdr.soebandi@gmail.com', website: 'www.smkdrsoebandijember.sch.id', borderStyle: 'double', fontFamily: 'Arial', logoWidthMm: 22 } };
    const base = { tanggal: today, createdAt: today + 'T08:00:00+07:00', updatedAt: today + 'T08:00:00+07:00', isDemo: false, dataSource: 'PRODUCTION', petugasPiketId: 'test-officer', petugasPiketName: 'Petugas Uji' };
    f.data.teachers = [1, 2].map(i => ({ id: 'teacher-' + i, fullName: 'Guru Uji ' + i, nip: '0000123' + i, isActive: true, mataPelajaran: 'Matematika', dataSource: 'PRODUCTION', isDemo: false }));
    f.data.schedules = f.data.teachers.map(t => ({ ...base, id: 'sch-' + t.id, hari: 'MINGGU', petugasId: t.id, petugasName: t.fullName, jamMulai: '07:00', jamSelesai: '14:00' }));
    f.data.attendance = f.data.teachers.map(t => ({ ...base, id: 'att-' + t.id, userId: t.id, userName: t.fullName, status: 'DALAM_LOKASI', jamMasuk: '07:00' }));
    const records = (name, make) => { f.data[name] = [1, 2].map(i => ({ ...base, id: name + '-record-' + i, ...make(i) })); f.data[name].push({ ...f.data[name][0], id: 'ARSIP-DI-LUAR-PERIODE', tanggal: '2020-01-01' }); };
    records('incidents', i => ({ waktu: '08:00', kategori: 'KEDISIPLINAN', kategoriCode: 'SISWA', kategoriName: 'Kejadian Siswa', tingkatKeparahan: 'SEDANG', lokasi: 'Gerbang', pihakTerlibat: 'Siswa Uji ' + i, uraian: 'Uraian kejadian ' + i, tindakanAwal: 'Pendampingan', status: 'SELESAI', penanggungJawab: 'Petugas Uji' }));
    records('dutyBooks', i => ({ hari: 'MINGGU', jamMulai: '07:00', jamSelesai: '14:00', petugasName: 'Petugas Uji ' + i, ruangName: 'Gerbang', kondisiKeamanan: 'Aman', kondisiKebersihan: 'Bersih', kondisiKelas: 'Kondusif', kondisiFasilitas: 'Baik', kondisiSiswa: 'Tertib', catatanPiket: 'Catatan jurnal', tindakLanjut: 'Koordinasi', status: 'DRAFT' }));
    records('studentTardiness', i => ({ namaSiswa: 'Siswa Uji ' + i, kelas: 'X TKJ 1', nisn: '0000123' + i, jamDatang: '07:10', menitTerlambat: 10, alasan: 'TERLAMBAT_BANGUN', pembinaan: 'TEGURAN_LISAN', poinPelanggaran: 5, status: 'SELESAI' }));
    records('studentPermits', i => ({ namaSiswa: 'Siswa Uji ' + i, kelas: 'X TKJ 1', nisn: '0000123' + i, jamKeluar: '10:00', jenisIzin: 'KEPERLUAN_KELUARGA', alasan: 'Keperluan keluarga', penjemput: 'ORANG_TUA', namaPenjemput: 'Wali Uji', noHpOrangTua: '0812340000', guruPengajarName: 'Guru Uji', status: 'SEDANG_KELUAR' }));
    records('substitutions', i => ({ guruBerhalanganName: 'Guru Uji ' + i, guruPenggantiName: 'Guru Inval Uji', mataPelajaran: 'Matematika', kelas: 'X TKJ 1', jamPelajaran: '1–2', alasan: 'SAKIT', materiDanTugasSiswa: 'Latihan soal', status: 'SELESAI_INVAL' }));
    records('visitors', i => ({ namaTamu: i === 1 ? 'Rina Alpha' : 'Budi Beta', instansiAsal: 'Wali Siswa', kategori: 'ORANG_TUA', jamMasuk: '09:00', jamKeluar: '10:00', noHp: '0812340000', nomorIdentitas: '0000123' + i, nomorBadge: 'TAMU-' + i, tujuanBertemu: 'Guru Uji', keperluan: 'Konsultasi', status: 'SELESAI' }));
    f.holdCollections = ['visitors']; location.hash = '#reports'; return f.settings;
  });
  const action = page.getByRole('button', { name: 'Pratinjau & Ekspor', exact: true }); await action.waitFor();
  await page.waitForTimeout(1300);
  check('export waits for all operational subscriptions rather than a timeout', await action.isDisabled());
  await page.evaluate(() => { window.fixture.heldCallbacks.forEach(fn => fn()); window.fixture.holdCollections = []; });
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Pratinjau & Ekspor')?.disabled);
  check('Excel has been replaced by one report action button', await page.getByRole('button', { name: /Excel/ }).count() === 0 && await action.count() === 1);
  const modules = ['attendance', 'incidents', 'dutyBooks', 'studentTardiness', 'studentPermits', 'substitutions', 'visitors'];
  const download = async file => { const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Unduh Word Tab Aktif' }).click(); const d = await event; assert.ok(d.suggestedFilename().endsWith('.docx')); await d.saveAs(out + '/' + file + '.docx'); return fs.readFileSync(out + '/' + file + '.docx'); };
  for (const module of modules) {
    await page.getByLabel('Pilih Tampilan Laporan').selectOption(module); await action.click(); const modal = page.getByRole('dialog', { name: 'Pratinjau & Ekspor Laporan' }); await modal.waitFor();
    check(`${module}: active-tab Word scope is explicit`, (await modal.innerText()).includes('2 catatan'));
    const bytes = await download(module), text = bytes.toString('utf8');
    check(`${module}: genuine Word includes both records and omits out-of-period archives`, bytes[0] === 80 && bytes[1] === 75 && text.includes('word/document.xml') && !text.includes('ARSIP-DI-LUAR-PERIODE') && (module === 'attendance' ? text.includes('Guru Uji 1') && text.includes('Guru Uji 2') : text.includes(module + '-record-1') && text.includes(module + '-record-2')));
    await modal.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  }
  await page.getByPlaceholder('Cari nama siswa, guru, kelas, uraian kejadian, tamu, atau nomor identitas...').fill('Rina Alpha'); await action.click();
  check('Word export tracks the active search filter', (await page.getByRole('dialog').innerText()).includes('1 catatan'));
  const filtered = (await download('visitors-filtered')).toString('utf8'); check('filtered Word contains only the matching visitor', filtered.includes('Rina Alpha') && !filtered.includes('Budi Beta'));
  await page.getByRole('button', { name: 'Pratinjau & Cetak Resmi', exact: true }).click();
  await page.locator('[data-print-letterhead]').waitFor();
  const centered = () => page.locator('[data-print-letterhead]').first().evaluate(e => { const a = e.getBoundingClientRect(), b = e.querySelector('[data-letterhead-text]').getBoundingClientRect(); return Math.abs(a.left + a.width / 2 - b.left - b.width / 2) < 1; });
  check('the same action menu opens official print preview with a centered letterhead', await centered());
  check('Word exports are audited without operational writes or runtime errors', await page.evaluate(() => window.fixture.exportAudits.length === 8 && window.fixture.writes.length === 0) && errors.length === 0);
  for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
    check(`print preview at ${width}px/${dark ? 'dark' : 'light'} remains centered without page overflow`, await centered() && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  }
  await page.screenshot({ path: out + '/preview-desktop.png', fullPage: true });
  await page.goto(url + '/#monthly-print'); await page.waitForFunction(() => window.fixture?.force);
  for (const [width, logo] of [[22, true], [32, true], [22, false]]) {
    await page.evaluate(({s, width, logo}) => { window.fixture.settings = { ...s, letterheadConfig: { ...s.letterheadConfig, logoWidthMm: width }, printConfig: { showLogo: logo } }; window.fixture.force(); }, {s: settings, width, logo});
    check(`letterhead center is stable at ${width}mm/logo ${logo}`, await centered());
  }
  console.log(`${count} centered letterhead/report actions checks passed.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
