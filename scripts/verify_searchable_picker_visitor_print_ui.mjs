// Real search dialog + visitor slip. Synthetic records only; no production IO.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const deps = createRequire((process.env.PIKET_BROWSER_TEST_TOOLS || process.cwd()) + '/package.json');
const { chromium: pw } = deps('playwright-core'), chromium = deps('@sparticuz/chromium').default;
const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{Modal}from'./src/components/common/Modal';import{SearchableSelect}from'./src/components/common/SearchableSelect';import{VisitorPassPrintModal}from'./src/features/visitors/VisitorPassPrintModal';
function App(){const[value,setValue]=useState(''),[disabled,setDisabled]=useState(false),[print,setPrint]=useState(false),[visitor,setVisitor]=useState(window.f.visitor);window.f.setDisabled=setDisabled;window.f.setValue=setValue;window.f.setVisitor=setVisitor;return <><table><tbody><tr><td>LEAK_MAIN_TABLE</td></tr></tbody></table><button onClick={()=>setPrint(true)}>Pratinjau slip</button><Modal isOpen={!print} title="Formulir induk" onClose={()=>window.f.parentClosed++}><form onSubmit={e=>{e.preventDefault();window.f.submits++}}><SearchableSelect required label="Guru contoh" value={value} options={window.f.options} disabled={disabled} onChange={v=>{window.f.picks.push(v);setValue(v)}}/><button type="submit">Simpan formulir</button><p>LEAK_OTHER_DIALOG</p><button type="button" onClick={()=>setPrint(true)}>Buka slip</button></form></Modal><VisitorPassPrintModal isOpen={print} onClose={()=>setPrint(false)} visitor={visitor} settings={window.f.settings}/></>};createRoot(document.getElementById('root')).render(<App/>);`;
const built = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outdir: '/picker-print-probe', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' } });
const js = built.outputFiles.find(f => f.path.endsWith('.js')).text, extra = built.outputFiles.find(f => f.path.endsWith('.css')).text;
const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json', 'utf8')), css = fs.readFileSync('dist/' + manifest['index.html'].css[0], 'utf8');
const fixture = `window.f={parentClosed:0,submits:0,picks:[],prints:0,settings:{schoolName:'SMK DR. SOEBANDI',npsn:'60724703'},visitor:{id:'v1',namaTamu:'Pak Bambang',instansiAsal:'Orang tua',kategoriTamu:'UMUM',nomorBadge:'TAMU-1',tanggal:'2026-10-16',jamMasuk:'07:45',tujuanBertemu:'Bimbingan & Konseling (BK)',keperluan:'Mengantarkan surat dokter.',petugasPiketName:'Puput Sasmita, S.Pd., Gr.'}};f.options=[{value:'',label:'Belum ditugaskan'},...Array.from({length:200},(_,i)=>({value:'guru-'+i,label:'Guru Contoh '+i,description:i===177?'Bahasa Inggris':'Umum',keywords:'NIP-'+String(i).padStart(3,'0')})),{value:'accent',label:'Dían Álam',description:'Seni Budaya'},{value:'disabled',label:'Guru nonaktif',disabled:true}];window.print=()=>f.prints++;`;
const server = http.createServer((req, res) => {
  if (req.url === '/probe.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(js); }
  res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html lang="id"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${extra}body{margin:0;padding:16px}</style><div id="root"></div><script>${fixture}</script><script src="/probe.js"></script></html>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser, count = 0, complete = false;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log('PASS', name); };
process.on('beforeExit', () => { if (!complete) { console.error('INCOMPLETE picker/print suite', count); process.exitCode = 1; } });
try {
  browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const trigger = page.getByRole('button', { name: 'Guru contoh', exact: true }), picker = page.getByRole('dialog', { name: 'Guru contoh', exact: true });
  await page.getByRole('button', { name: 'Simpan formulir', exact: true }).click(); await picker.waitFor();
  check('required choice prevents submission and opens the searchable picker', await page.evaluate(() => f.submits === 0));
  const search = picker.getByRole('combobox', { name: 'Cari guru contoh', exact: true });
  await search.fill('NIP-177'); check('ID search finds records beyond the first visible options', await picker.getByRole('option').count() === 1);
  await search.press('Enter'); await picker.waitFor({ state: 'hidden' });
  check('Enter chooses the correct ID once and keeps the parent form open', await trigger.innerText() === 'Guru Contoh 177' && await page.evaluate(() => f.picks.join() === 'guru-177' && f.parentClosed === 0 && f.submits === 0));
  await trigger.click(); await search.fill('bahasa INGGRIS'); check('search is case-insensitive and includes subject descriptions', await picker.getByRole('option').count() === 1);
  await search.press('Escape'); await picker.waitFor({ state: 'hidden' });
  check('Escape cancels only the picker, restores focus and retains selection', await trigger.evaluate(e => e === document.activeElement) && await page.evaluate(() => f.parentClosed === 0 && f.picks.length === 1));
  await trigger.click(); await search.fill('dian alam'); check('accented names can be found using plain characters', await picker.getByRole('option').count() === 1); await search.press('Enter');
  await trigger.click(); await search.fill('No such teacher'); check('empty results explain the failed search without changing selection', await picker.getByText('Tidak ditemukan. Coba kata kunci lain.', { exact: true }).isVisible() && await page.evaluate(() => f.picks.at(-1) === 'accent'));
  await search.fill('Guru Contoh'); await search.press('ArrowDown'); await search.press('Enter'); await picker.waitFor({ state: 'hidden' }); assert.equal(await trigger.innerText(), 'Guru Contoh 1'); check('keyboard arrows select the next matching ID', true);
  await trigger.click(); await search.fill('nonaktif'); check('disabled options cannot be chosen', await picker.getByRole('option').isDisabled()); await search.press('Escape');
  for (const theme of ['light', 'dark']) for (const [width, height] of [[320, 640], [390, 844], [390, 420], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(t => document.documentElement.classList.toggle('dark', t === 'dark'), theme); await trigger.click();
    check(`${theme}/${width}×${height}: picker is bounded with local scrolling and 44px targets`, await picker.evaluate(e => { const r=e.getBoundingClientRect(), list=e.querySelector('[role=listbox]'); return r.height<=innerHeight-4 && r.left>=0 && r.right<=innerWidth+1 && list.clientHeight<=281 && list.scrollHeight>list.clientHeight && [...list.querySelectorAll('[role=option]')].every(o=>o.getBoundingClientRect().height>=44) && document.documentElement.scrollWidth<=innerWidth; }));
    await search.press('Escape');
  }
  await page.evaluate(() => f.setValue('legacy-missing')); check('a saved missing ID is retained rather than silently selecting the first teacher', await trigger.innerText() === 'Pilihan tersimpan (tidak ada di daftar aktif)' && await page.locator('form input.sr-only').inputValue() === 'legacy-missing');
  await trigger.click(); await page.evaluate(() => f.setDisabled(true)); await picker.waitFor({ state: 'hidden' }); check('disabling a busy form also closes its picker', await trigger.isDisabled());
  await page.getByRole('button', { name: 'Buka slip', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Cetak Slip Izin Tamu', exact: true }); await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Cetak Slip Tamu', exact: true }).click(); check('print action opens the existing print flow once', await page.evaluate(() => f.prints === 1));
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); check(`${width}: slip preview wraps without horizontal overflow`, await dialog.locator('.visitor-pass').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().right<=innerWidth)); }
  await page.emulateMedia({ media: 'print' });
  check('print media contains only the isolated slip, without app table or modal', await page.locator('#root').isHidden() && await dialog.isHidden() && await page.locator('#visitor-pass-print-root').isVisible());
  const output = process.env.PIKET_QA_PDF_DIR; assert.ok(output, 'PIKET_QA_PDF_DIR is required for print verification'); fs.mkdirSync(output, { recursive: true });
  await page.pdf({ path: output + '/visitor-slip.pdf', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  await page.evaluate(()=>f.setVisitor({...f.visitor,namaTamu:'Bapak / Ibu dengan nama panjang '.repeat(4),instansiAsal:'Instansi luar sekolah '.repeat(8),tujuanBertemu:'Koordinator Hubungan Masyarakat '.repeat(8),keperluan:('Koordinasi kegiatan pendidikan bersama sekolah. ').repeat(70)+' AKHIR_KEPERLUAN',petugasPiketName:'Petugas Piket dengan nama panjang '.repeat(3)}));
  await page.pdf({ path: output + '/visitor-slip-long.pdf', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  check('long names and full purpose remain in a flowing print layout', await page.locator('#visitor-pass-print-root').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.textContent.includes('AKHIR_KEPERLUAN')));
  await page.emulateMedia({ media: 'screen' }); await dialog.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  check('closing the slip removes its print-only stylesheet and returns to the form', await page.locator('#visitor-pass-print-root').count() === 0 && await page.getByRole('dialog', { name: 'Formulir induk', exact: true }).isVisible());
  check('no browser runtime errors during picker and slip flow', errors.length === 0);
  complete = true; console.log(`${count} searchable picker/visitor slip browser scenarios passed. Synthetic data only.`);
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
