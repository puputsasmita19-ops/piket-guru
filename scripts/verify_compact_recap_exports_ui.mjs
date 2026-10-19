// Actual ReportsPreview + DOCX export. Synthetic records and blocked external IO.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const deps=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=deps('playwright-core'),chromium=deps('@sparticuz/chromium').default;
if(!server.listening)await new Promise(r=>server.once('listening',r));
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/#dashboard`);await page.waitForFunction(()=>window.fixture?.emitSchool);
 await page.evaluate(()=>{
  const f=window.fixture,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
  f.data.teachers=Array.from({length:40},(_,i)=>({id:'guru-'+i,fullName:'Guru'+String(i+1).padStart(3,'0')+' Contoh',nip:'198001012006041'+String(i).padStart(3,'0'),isActive:true,mataPelajaran:'Matematika'}));
  f.data.schedules=f.data.teachers.map(t=>({id:'sch-'+t.id,tanggal:today,petugasId:t.id,petugasName:t.fullName,ruangName:'Gerbang',jamMulai:'07:00',jamSelesai:'14:00',hari:'SENIN'}));
  f.data.attendance=f.data.teachers.map(t=>({id:'att-'+t.id,tanggal:today,userId:t.id,userName:t.fullName,status:'DALAM_LOKASI',jamMasuk:'07:00'}));
  for(const c of ['dutyBooks','incidents','studentTardiness','studentPermits','substitutions','visitors'])f.data[c]=[];
  location.hash='#reports';
 });
 const region=page.getByRole('region',{name:'Rekap Kehadiran Guru Piket'});await region.waitFor();await page.waitForFunction(()=>document.querySelectorAll('.attendance-summary tbody tr').length===5);await page.getByRole('button',{name:'Pratinjau & Ekspor',exact:true}).waitFor();
 check('report screen contains only one search and initially five of forty teachers',await page.locator('[data-tour=reports-container] input[placeholder^="Cari nama siswa"]').count()===0&&await region.getByRole('searchbox').count()===1&&await region.locator('tbody tr').count()===5);
 await region.getByRole('button',{name:'Halaman rekap berikutnya'}).click();check('page two keeps overall statistics unchanged',await page.getByText('Total Guru Terdaftar',{exact:true}).locator('..').innerText().then(t=>t.includes('40')));
 await page.getByRole('button',{name:'Pratinjau & Ekspor',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Pratinjau & Ekspor Laporan'});await dialog.waitFor();check('active export sees all forty records while table is on page two',await dialog.getByText(/40 catatan/).isVisible());
 const out=path.resolve(process.env.PIKET_COMPACT_EXPORT_QA||'../compact-recap-work/qa');fs.mkdirSync(out,{recursive:true});
 const download=async name=>{const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Unduh Word Tab Aktif',exact:true}).click();const file=await event;const dest=path.join(out,name+'.docx');await file.saveAs(dest);return execFileSync('python3',['-c','import sys,zipfile,xml.etree.ElementTree as ET\nwith zipfile.ZipFile(sys.argv[1]) as z:\n root=ET.fromstring(z.read("word/document.xml")); print(" ".join(root.itertext()))',dest],{encoding:'utf8'})};
 const complete=await download('all-forty-teachers');check('real DOCX includes every teacher, not only the five visible rows',Array.from({length:40},(_,i)=>'Guru'+String(i+1).padStart(3,'0')+' Contoh').every(name=>complete.includes(name)));
 await page.keyboard.press('Escape');await region.getByRole('searchbox').fill('Guru040');await page.waitForFunction(()=>document.querySelectorAll('.attendance-summary tbody tr').length===1);check('search narrows the table without changing the overall statistics',await region.getByText('Guru040 Contoh',{exact:true}).isVisible()&&await page.getByText('Total Guru Terdaftar',{exact:true}).locator('..').innerText().then(t=>t.includes('40')));
 await page.getByRole('button',{name:'Pratinjau & Ekspor',exact:true}).click();await dialog.waitFor();check('active export respects the name filter and exposes its complete result count',await dialog.getByText(/1 catatan/).isVisible());const filtered=await download('filtered-teacher');check('filtered DOCX contains the selected teacher and excludes non-matching teachers',filtered.includes('Guru040 Contoh')&&!filtered.includes('Guru001 Contoh'));
 check('browsing/export never writes operational school records',await page.evaluate(()=>window.fixture.writes.length===0));check('integration has no unhandled browser errors',errors.length===0);console.log(`${count} compact report/export integration scenarios passed. No production IO.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
