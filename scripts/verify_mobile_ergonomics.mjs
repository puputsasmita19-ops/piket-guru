import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/modern_workspace_fixture.mjs';
const dep=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=dep('playwright-core'),chromium=dep('@sparticuz/chromium').default;
if(!server.listening)await new Promise(r=>server.once('listening',r));
const out=process.env.PIKET_QA_SCREENSHOTS||'../mobile-ux-qa';fs.mkdirSync(out,{recursive:true});
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const context=await browser.newContext({hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const url=`http://127.0.0.1:${server.address().port}`;
 for(const width of [320,360,390,768,1440])for(const dark of [false,true]){
  await page.setViewportSize({width,height:844});await page.goto(url+'/?probe=login#login-ui');await page.locator('.app-clock-login').waitFor();await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
  check(`login ${width}/${dark}: date and time share one readable row`,await page.locator('.app-clock-login').evaluate(el=>{const[a,b]=el.children;const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return Math.abs(ar.top-br.top)<3&&ar.right<br.left&&br.right<=innerWidth&&ar.left>=0&&el.scrollWidth<=el.clientWidth+1}));
  await page.screenshot({path:`${out}/login-${width}-${dark}.png`});
  await page.goto(url+'/?probe=dashboard#dashboard');await page.locator('.app-mobile-nav').waitFor({state:'attached'});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
  check(`header ${width}/${dark}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  if(width<1024){check(`mobile ${width}/${dark}: normal-weight one-line bottom labels`,await page.locator('.module-mobile-label').evaluateAll(es=>es.every(el=>getComputedStyle(el).fontWeight==='400'&&el.scrollHeight<=18&&el.scrollWidth<=el.clientWidth+1)));
   check(`mobile ${width}/${dark}: clock and five actions remain separate`,await page.evaluate(()=>{const c=document.querySelector('.app-clock-mobile').getBoundingClientRect(),bs=[...document.querySelectorAll('.app-header-actions .header-icon-button')].map(e=>e.getBoundingClientRect());return bs.length===5&&c.right<=bs[0].left&&bs.every((r,i)=>r.width>=44&&r.right<=innerWidth&&(!i||r.left>=bs[i-1].right))}));}
 }
 await page.setViewportSize({width:390,height:844});
 for(const route of ['attendance','duty-book','student-tardiness','student-permits','incidents','visitors','substitutions','reports']){
  await page.goto(url+'/#'+route);await page.waitForTimeout(250);check(`${route}: mobile content stays within screen`,await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  if(route==='attendance'){const tabs=page.locator('.attendance-tabs');check('attendance tabs have equal width and centered text',await tabs.locator('button').evaluateAll(bs=>Math.abs(bs[0].getBoundingClientRect().width-bs[1].getBoundingClientRect().width)<1&&bs.every(b=>getComputedStyle(b).textAlign==='center')));await page.getByRole('button',{name:/Rekap Kehadiran/}).click();check('user history filter is a compact searchable trigger',await page.getByRole('button',{name:'Pengguna riwayat',exact:true}).evaluate(e=>e.getAttribute('aria-haspopup')==='dialog'&&e.getBoundingClientRect().width<240));await page.screenshot({path:out+'/attendance-history-mobile.png'});}
 }
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});await page.goto(url+'/?probe=dashboard#dashboard');await page.evaluate(()=>{window.fixture.user={...window.fixture.user,role:'GURU'};window.fixture.force()});
  await page.getByRole('button',{name:'Panduan penggunaan',exact:true}).click();const toggle=page.getByRole('switch');await toggle.click();check(`guide ${width}: automatic preference can be changed`,await toggle.getAttribute('aria-checked')==='true');await toggle.click();
  await page.getByRole('button',{name:'Mulai Panduan',exact:true}).click();const card=page.getByRole('dialog',{name:'Panduan Interaktif Penggunaan Aplikasi'});await card.waitFor();
  for(let i=0;i<6;i++){
   await page.waitForTimeout(300);check(`guide ${width}/step ${i+1}: card fits and avoids highlighted controls`,await card.evaluate(el=>{const c=el.getBoundingClientRect(),t=document.querySelector('[data-guide-spotlight]')?.getBoundingClientRect();const overlap=t?Math.max(0,Math.min(c.right,t.right)-Math.max(c.left,t.left))*Math.max(0,Math.min(c.bottom,t.bottom)-Math.max(c.top,t.top)):0;return c.left>=0&&c.right<=innerWidth&&c.top>=0&&c.bottom<=innerHeight&&overlap<5}));
   if(i===0)await page.screenshot({path:`${out}/guide-${width}.png`});await card.getByRole('button',{name:i===5?'Selesai':'Lanjut',exact:true}).click({force:true});
  }
  await page.waitForFunction(()=>!document.querySelector('.guide-card'));check(`guide ${width}: manual tour works while auto is off`,!await card.count());
 }
 check('no runtime errors or operational writes during UI review',!errors.length&&await page.evaluate(()=>window.fixture.writes.length===0));
 console.log(`${count} mobile/login/header/guide checks passed.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
