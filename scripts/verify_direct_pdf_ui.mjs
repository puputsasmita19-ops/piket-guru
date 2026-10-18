// Real ReportsPreview and print components; synthetic records, blocked external services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const chromium = dep('@sparticuz/chromium').default, { chromium: pw } = dep('playwright-core');
if (!server.listening) await new Promise(r => server.once('listening', r));
const out = process.env.PIKET_CENTER_QA || path.resolve('../direct-pdf-qa'); fs.mkdirSync(out, { recursive: true });
let browser, count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const context=await browser.newContext({hasTouch:true,acceptDownloads:true,viewport:{width:390,height:844}});const page=await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.addInitScript(()=>{window.print=()=>{const f=parent.fixture||window.fixture;if(f){if(parent===window)f.appPrintCalls=(f.appPrintCalls||0)+1;else{f.printedHtml=document.documentElement.outerHTML;f.printCalls=(f.printCalls||0)+1}}}});
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
    const pdfEvent=page.waitForEvent('download');await modal.getByRole('button',{name:'Unduh PDF Tab Aktif'}).click();const pdf=await pdfEvent;await pdf.saveAs(out+'/'+module+'.pdf');check(module+': PDF downloads directly without opening print',fs.readFileSync(out+'/'+module+'.pdf').subarray(0,4).toString()==='%PDF'&&await page.evaluate(()=>!window.fixture.printCalls&&!window.fixture.appPrintCalls));
    await modal.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  }
  await page.getByPlaceholder('Cari nama siswa, guru, kelas, uraian kejadian, tamu, atau nomor identitas...').fill('Rina Alpha'); await action.click();
  check('Word export tracks the active search filter', (await page.getByRole('dialog').innerText()).includes('1 catatan'));
  const filtered = (await download('visitors-filtered')).toString('utf8'); check('filtered Word contains only the matching visitor', filtered.includes('Rina Alpha') && !filtered.includes('Budi Beta'));
  await page.getByRole('button',{name:'Tutup dialog',exact:true}).click();
  await page.getByPlaceholder('Cari nama siswa, guru, kelas, uraian kejadian, tamu, atau nomor identitas...').fill('');
  await page.evaluate(()=>{const f=window.fixture;f.emitCollection('teachers',Array.from({length:70},(_,i)=>({id:'guru-'+i,fullName:'Petugas'+String(i+1).padStart(3,'0')+' Nama Guru Uji',nip:'0000123'+String(i).padStart(3,'0'),mataPelajaran:'Matematika',isActive:true,isDemo:false,dataSource:'PRODUCTION'})))});
  await action.click();await page.getByRole('button',{name:'Pratinjau & Cetak Resmi',exact:true}).click();
  const waitPreview=async()=>{await page.waitForFunction(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Cetak'),c=document.querySelector('[data-pdf-preview] canvas');return b&&!b.disabled&&c?.width>500&&c?.height>500&&!Array.from(document.querySelectorAll('[role="status"]')).some(e=>e.textContent.includes('Memuat halaman'))})};
  const pdfDownload=async name=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh PDF',exact:true}).click();await(await event).saveAs(out+'/'+name+'.pdf')};
  await waitPreview();await pdfDownload('monthly-long');
  check('long official report is paginated before print and preview is rendered',await page.locator('[data-pdf-preview] canvas').evaluate(c=>c.width>500&&c.height>500));
  await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await waitPreview();check('preview can show the next page without scrolling through the entire report',(await page.locator('[data-pdf-preview] [aria-live]').innerText()).startsWith('Halaman 2'));
  for(const width of [320,390,1440])for(const dark of [false,true]){await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);check('PDF preview '+width+'/'+dark+' fits the screen',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth))}
  await page.screenshot({path:out+'/monthly-preview.png',fullPage:true});
  await page.getByRole('button',{name:'Cetak',exact:true}).click();await page.waitForFunction(()=>window.fixture.printCalls===1);
  const printed=await page.evaluate(()=>window.fixture.printedHtml);fs.writeFileSync(out+'/isolated-print.html',printed);
  const proof=await page.context().newPage();await proof.setContent(printed);await proof.pdf({path:out+'/isolated-print.pdf',preferCSSPageSize:true,printBackground:true});
  check('print sends only rendered report pages to a separate iframe',printed.includes('class="report-page"')&&!printed.includes('app-content')&&!printed.includes('Navigasi Utama')&&await page.evaluate(()=>!window.fixture.appPrintCalls));
  check('new UI separates download from print labels',await page.getByRole('button',{name:/Cetak.*Simpan PDF/}).count()===0);
  check('PDF exports are audited without operational writes',await page.evaluate(()=>window.fixture.exportAudits.length===15&&window.fixture.writes.length===0));
  await page.getByRole('button',{name:'Tutup dialog',exact:true}).click();
  // Configure numbering through the actual admin card, then reopen the real report screen.
  await page.evaluate(()=>{history.replaceState(null,'','?reportsSettings#reports');location.hash='#settings'});
  await page.getByLabel('Posisi nomor halaman',{exact:true}).selectOption('right');await page.getByLabel('Format nomor halaman',{exact:true}).selectOption('page_only');await page.getByLabel('Nomor halaman awal',{exact:true}).fill('7');await page.getByLabel('Kertas laporan',{exact:true}).selectOption('F4');await page.getByLabel('Orientasi laporan',{exact:true}).selectOption('landscape');await page.getByRole('button',{name:'Simpan pengaturan cetak & buku tamu'}).click();await page.waitForFunction(()=>window.fixture.reportSettingsSaves?.length===1);
  check('admin can save numbering position, format and starting number',await page.evaluate(()=>window.fixture.settings.printConfig.pageNumberStart===7&&window.fixture.settings.printConfig.pageNumberPosition==='right'));
  await page.evaluate(()=>location.hash='#reports');await action.click();await page.getByRole('button',{name:'Pratinjau & Cetak Resmi',exact:true}).click();await waitPreview();await pdfDownload('monthly-f4-start7');
  await page.getByRole('button',{name:'Tutup dialog',exact:true}).click();await page.evaluate(()=>location.hash='#settings');await page.getByLabel('Tampilkan nomor halaman',{exact:true}).uncheck();await page.getByRole('button',{name:'Simpan pengaturan cetak & buku tamu'}).click();await page.waitForFunction(()=>window.fixture.reportSettingsSaves.length===2);await page.evaluate(()=>location.hash='#reports');await action.click();await page.getByRole('button',{name:'Pratinjau & Cetak Resmi',exact:true}).click();await waitPreview();await pdfDownload('monthly-no-numbers');
  // Real photo renderer: full images, explicit download/print, both 2/4 layouts.
  await page.goto(url+'/#print-test');await page.waitForFunction(()=>window.fixture?.force);
  await page.evaluate(s=>{const f=window.fixture;f.settings={...s,printConfig:{showPageNumbers:true,pageNumberStart:3,pageNumberPosition:'left',showSignatures:true}};const sample={sourceModule:'VISITOR',sourceId:'demo',photoUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#eef2ee"/><text x="80" y="150" font-size="28">Foto contoh</text></svg>'),briefIdentity:'Dokumentasi uji',tanggalKejadian:'2026-10-18'};f.photos=Array.from({length:4},(_,i)=>({...sample,id:'foto-'+i,title:'Dokumentasi '+(i+1)}));f.force()},settings);
  await waitPreview();await pdfDownload('photos-4');await page.getByLabel('Foto per halaman').selectOption('2');await waitPreview();await pdfDownload('photos-2');
  check('photo reports also download real PDF files',fs.readFileSync(out+'/photos-2.pdf').subarray(0,4).toString()==='%PDF');
  check('all tested flows have no runtime errors',errors.length===0);
  console.log(`${count} direct PDF/download/print UI checks passed.`);
} catch(e){console.error('PDF UI test failed:',e.message);throw e;} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
