// Real dashboard, welcome animation and admin editor. Synthetic Firebase IO only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { server } from './fixtures/welcome_motion_fixture.mjs';
const require=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=require('playwright-core'),chromium=require('@sparticuz/chromium').default;
if(!server.listening)await new Promise(r=>server.once('listening',r));
let browser,count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const context=await browser.newContext({hasTouch:true,timezoneId:'America/Los_Angeles'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const origin=`http://127.0.0.1:${server.address().port}`;
 const shots=process.env.PIKET_QA_SCREENSHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});
 await page.clock.install({time:new Date('2026-10-19T01:40:00Z')});
 await page.goto(origin+'/#dashboard');await page.locator('.welcome-message-text').waitFor();
 await page.clock.pauseAt(new Date('2026-10-19T01:40:02Z'));
 const emit=async patch=>{await page.evaluate(p=>{const f=window.fixture;f.emitSchool({...f.settings,dashboardInfoConfig:{...f.settings.dashboardInfoConfig,welcome:{...f.settings.dashboardInfoConfig?.welcome,...p}}})},patch);await page.waitForTimeout(20)};
 await emit({enabled:true,mode:'interval',category:'all',intervalSeconds:10,animationEnabled:true,transitionDurationMs:600,templates:[{id:'custom-long',category:'general',text:'Semoga setiap langkah kecil membawa kebaikan bagi seluruh warga sekolah. Mari bekerja sama, saling membantu, dan menjaga semangat belajar agar kegiatan hari ini berjalan lancar.'}]});
 await page.clock.runFor(700);await page.waitForTimeout(20);await page.clock.runFor(700);await page.waitForTimeout(20);
 const initial=await page.locator('.welcome-message-text').innerText();
 const subscriptions=await page.evaluate(()=>window.fixture.subscriptionStarts),requests=[];page.on('request',r=>requests.push(r.url()));
 for(const width of [320,390,768,1440])for(const dark of [false,true]){
  await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
  if(shots&&[390,1440].includes(width))await page.locator('.dashboard-welcome').screenshot({path:`${shots}/welcome-${width}-${dark}.png`});
  check(`${width}/${dark}: one visible sentence, reserved wrapping and no overflow`,await page.locator('.welcome-sentence').evaluate(el=>{const text=el.querySelector('.welcome-message-text'),measure=el.querySelector('.welcome-message-measure');return !!text&&el.querySelectorAll('.welcome-message-text').length===1&&getComputedStyle(measure).visibility==='hidden'&&el.getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth===innerWidth}));
 }
 check('pause icon aligns with the first sentence line',await page.locator('.welcome-sentence').evaluate(e=>{const a=e.querySelector('.welcome-message-text').getBoundingClientRect(),b=e.querySelector('.welcome-message-pause').getBoundingClientRect();return b.top>=a.top-6&&b.top<=a.top+2}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);const height=await page.locator('.welcome-message').evaluate(e=>e.getBoundingClientRect().height);
 await page.clock.runFor(await page.evaluate(()=>10000-Date.now()%10000+21));await page.waitForTimeout(20);
 check('outgoing text starts a rise-up exit before replacement',await page.locator('.welcome-message-text').getAttribute('data-phase')==='exit'&&await page.locator('.welcome-message-text').innerText()===initial);
 check('exit uses a transform/opacity animation without blur',await page.locator('.welcome-message-text').evaluate(e=>getComputedStyle(e).animationName==='welcome-rise-out'&&getComputedStyle(e).filter==='none'));
 await page.clock.runFor(241);await page.waitForTimeout(20);
 check('new text enters downwards after the outgoing phase',await page.locator('.welcome-message-text').getAttribute('data-phase')==='enter'&&await page.locator('.welcome-message-text').innerText()!==initial&&await page.locator('.welcome-message-text').evaluate(e=>getComputedStyle(e).animationName==='welcome-down-in'));
 await page.clock.runFor(361);await page.waitForTimeout(20);
 check('transition settles without hiding text or shifting its reserved height',await page.locator('.welcome-message-text').getAttribute('data-phase')==='idle'&&await page.locator('.welcome-message').evaluate((e,h)=>Math.abs(e.getBoundingClientRect().height-h)<1,height));
 await page.getByRole('button',{name:'Jeda rotasi kalimat',exact:true}).click();const paused=await page.locator('.welcome-message-text').innerText();await page.clock.runFor(30000);
 check('pause keeps the sentence readable across three rotation boundaries',await page.locator('.welcome-message-text').innerText()===paused&&await page.getByRole('button',{name:'Lanjutkan rotasi kalimat',exact:true}).getAttribute('aria-pressed')==='true');
 await page.getByRole('button',{name:'Lanjutkan rotasi kalimat',exact:true}).click();await page.clock.runFor(11000);await page.waitForTimeout(20);await page.clock.runFor(650);await page.waitForTimeout(20);
 check('resume restores automatic rotation without reloading',await page.locator('.welcome-message-text').innerText()!==paused&&await page.getByRole('button',{name:'Jeda rotasi kalimat',exact:true}).count()===1);
 await emit({animationEnabled:false});await page.clock.runFor(11000);await page.waitForTimeout(20);await page.clock.runFor(650);await page.waitForTimeout(20);
 check('admin animation OFF retains rotation without CSS motion',await page.locator('.welcome-message-text').getAttribute('data-motion')==='off'&&await page.locator('.welcome-message-text').evaluate(e=>getComputedStyle(e).animationName==='none'));
 await page.emulateMedia({reducedMotion:'reduce'});await emit({animationEnabled:true});await page.clock.runFor(11000);await page.waitForTimeout(20);await page.clock.runFor(650);await page.waitForTimeout(20);
 check('OS reduced motion overrides admin animation while preserving information',await page.locator('.welcome-message-text').getAttribute('data-motion')==='off'&&await page.locator('.welcome-message-text').evaluate(e=>getComputedStyle(e).animationName==='none'&&!!e.textContent));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});const hidden=await page.locator('.welcome-message-text').innerText();await page.clock.runFor(40000);
 check('hidden tab suspends sentence rotation instead of running background updates',await page.locator('.welcome-message-text').innerText()===hidden);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(700);await page.waitForTimeout(20);await page.clock.runFor(650);await page.waitForTimeout(20);
 check('returning to the tab resumes a current readable sentence',await page.locator('.welcome-message-text').getAttribute('data-phase')==='idle');
 check('all rotations add no database subscriptions, writes or HTTP requests',await page.evaluate(n=>window.fixture.subscriptionStarts===n&&window.fixture.writes.length===0,subscriptions)&&requests.length===0);
 await emit({mode:'custom',customMessage:'Kalimat pertama'});await page.clock.runFor(100);await emit({customMessage:'Kalimat terbaru'});await page.clock.runFor(700);await page.waitForTimeout(20);
 check('rapid live changes settle on the latest sentence without stale timers',await page.locator('.welcome-message-text').innerText()==='Kalimat terbaru');
 await emit({enabled:false});check('OFF removes the sentence and pause control but keeps greeting',await page.locator('.welcome-sentence').count()===0&&await page.locator('.dashboard-eyebrow').isVisible());
 // Admin preview shares the same component and settings persistence flow.
 await page.clock.resume();await page.goto(origin+'/?welcome-motion-settings#settings');await page.getByLabel('Cara menampilkan kalimat').waitFor();
 await page.getByLabel('Cara menampilkan kalimat').selectOption('interval');
 check('choosing automatic cadence offers a ten-second starting point',await page.getByLabel('Jeda pergantian kalimat',{exact:true}).inputValue()==='10');
 await page.getByLabel('Jeda pergantian kalimat',{exact:true}).selectOption('15');await page.getByLabel('Kecepatan transisi kalimat',{exact:true}).selectOption('800');
 await page.getByRole('switch',{name:'Animasi kalimat',exact:true}).uncheck();
 check('animation switch OFF hides only motion speed options',await page.getByLabel('Kecepatan transisi kalimat',{exact:true}).count()===0&&await page.getByLabel('Jeda pergantian kalimat',{exact:true}).isEnabled());
 await page.getByRole('switch',{name:'Animasi kalimat',exact:true}).check();await page.getByRole('button',{name:'Simpan info dashboard',exact:true}).click();await page.getByRole('status').filter({hasText:'tersimpan'}).waitFor();
 check('admin save retains cadence, animation and selected transition duration',await page.evaluate(()=>{const w=window.fixture.settingsSaves.at(-1).config.welcome;return w.intervalSeconds===15&&w.animationEnabled===true&&w.transitionDurationMs===800}));
 check('admin controls fit mobile without horizontal scroll',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 await page.evaluate(()=>{window.fixture.user={...window.fixture.user,role:'GURU'};window.fixture.force()});await page.getByRole('button',{name:'Simpan info dashboard'}).waitFor({state:'detached'});
 check('teacher has no admin animation controls and no runtime errors occurred',await page.getByRole('switch',{name:'Animasi kalimat'}).count()===0&&errors.length===0);
 console.log(`${count} welcome motion/cadence/admin browser checks passed; no production IO.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
