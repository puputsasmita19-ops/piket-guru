// Actual welcome component, responsive CSS and controls; synthetic settings only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {server} from './fixtures/welcome_motion_fixture.mjs';
const require=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=require('playwright-core'),chromium=require('@sparticuz/chromium').default;
if(!server.listening)await new Promise(r=>server.once('listening',r));
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const context=await browser.newContext({hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.clock.install({time:new Date('2026-10-19T03:00:00Z')});await page.goto(`http://127.0.0.1:${server.address().port}/#dashboard`);await page.locator('.welcome-message-text').waitFor();
 await page.evaluate(()=>{const f=window.fixture;f.emitSchool({...f.settings,dashboardInfoConfig:{...f.settings.dashboardInfoConfig,welcome:{enabled:true,mode:'interval',category:'humor',intervalSeconds:3600,animationEnabled:false}}})});
 await page.locator('.welcome-message-text').filter({hasText:'Jadwal boleh padat'}).waitFor();
 const out=process.env.PIKET_QA_SCREENSHOTS;if(out)fs.mkdirSync(out,{recursive:true});
 for(const width of [320,390,768,1440])for(const dark of [false,true]){
  await page.setViewportSize({width,height:844});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);await page.waitForTimeout(40);
  check(`${width}/${dark}: control follows second wrapped line or single-line baseline`,await page.locator('.welcome-sentence').evaluate((el,width)=>{
   const text=el.querySelector('.welcome-message-text'),icon=el.querySelector('svg'),line=parseFloat(getComputedStyle(text).lineHeight),r=text.getBoundingClientRect(),i=icon.getBoundingClientRect(),wrapped=text.clientHeight>line*1.5;
   return(width>390||wrapped)&&Math.abs((i.top+i.height/2)-(r.top+line*(wrapped?1.5:.5)))<1&&document.documentElement.scrollWidth===innerWidth;
  },width));
  if(out&&[390,1440].includes(width))await page.locator('.dashboard-welcome').screenshot({path:`${out}/control-${width}-${dark}.png`});
 }
 const button=page.getByRole('button',{name:'Jeda rotasi kalimat',exact:true});
 check('pause is drawn with two thin lines, no filled bars or frame',await button.evaluate(e=>{const s=e.querySelector('svg'),c=getComputedStyle(e),p=s.querySelector('path');return s.getAttribute('fill')==='none'&&s.getAttribute('stroke-width')==='1.25'&&p.getAttribute('d')==='M7 4v12M13 4v12'&&c.borderTopWidth==='0px'&&c.backgroundColor==='rgba(0, 0, 0, 0)'}));
 check('small visual icon retains a 44px touch area',await button.evaluate(e=>{const c=getComputedStyle(e,'::before'),r=e.getBoundingClientRect();return r.width-parseFloat(c.left)-parseFloat(c.right)>=44&&r.height-parseFloat(c.top)-parseFloat(c.bottom)>=44}));
 await button.click();const play=page.getByRole('button',{name:'Lanjutkan rotasi kalimat',exact:true});
 check('play remains a thin outline and pause action still works',await play.getAttribute('aria-pressed')==='true'&&await play.locator('svg').getAttribute('fill')==='none'&&await play.locator('path').getAttribute('d')==='m7 4 9 6-9 6Z');
 await page.keyboard.press('Tab');await play.focus();check('keyboard focus remains visible for accessibility',await play.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
 await play.press('Enter');check('keyboard activation resumes playback',await page.getByRole('button',{name:'Jeda rotasi kalimat',exact:true}).getAttribute('aria-pressed')==='false');
 await page.setViewportSize({width:390,height:844});
 // A shorter live template must move the control back to line one without reload.
 await page.evaluate(()=>{const f=window.fixture;f.emitSchool({...f.settings,dashboardInfoConfig:{...f.settings.dashboardInfoConfig,welcome:{...f.settings.dashboardInfoConfig.welcome,category:'general',intervalSeconds:3600}}})});
 await page.locator('.welcome-message-text').filter({hasText:'Selamat bertugas.'}).waitFor();
 check('live text/category updates recalculate wrapping without stale alignment',await page.locator('.welcome-sentence').evaluate(e=>{const t=e.querySelector('.welcome-message-text'),i=e.querySelector('svg').getBoundingClientRect(),r=t.getBoundingClientRect(),line=parseFloat(getComputedStyle(t).lineHeight);return Math.abs(i.top+i.height/2-r.top-line*(t.clientHeight>line*1.5?1.5:.5))<1}));
 check('no operational writes or runtime errors',await page.evaluate(()=>window.fixture.writes.length===0)&&errors.length===0);
 console.log(`${count} thin welcome control/layout browser checks passed, no production IO.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
