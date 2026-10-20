// Real dashboard/carousel with synthetic IO. Checks clipping, one-click disclosure,
// scroll after commit, touch, keyboard, themes, stable slide height and playback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const deps=createRequire((process.env.PIKET_BROWSER_TEST_TOOLS||process.cwd())+'/package.json');
const {chromium:pw}=deps('playwright-core'),chromium=deps('@sparticuz/chromium').default;
const mocks={
 auth:`export const useAuth=()=>({currentUser:window.fixture.user,isTrustedDevice:true,hasRole:(...r)=>r.includes(window.fixture.user.role),hasPermission:()=>true});`,
 firebase:`export const auth={get currentUser(){return{uid:window.fixture.user.id}}};export const db={};`,
 offline:`export const OfflineStorage={isTrustedDevice:()=>true,registerListener:f=>f};`,
 firestore:`const f=window.fixture;export class FirestoreService{static subscribeToDocument(c,id,cb){f.settingsObservers.add(cb);queueMicrotask(()=>cb(f.settings));return()=>f.settingsObservers.delete(cb)}static subscribeToCollection(c,cb){const s=f.observers.get(c)||new Set();s.add(cb);f.observers.set(c,s);queueMicrotask(()=>cb(f.data[c]||[]));return()=>s.delete(cb)}static async setDocument(){f.writes++}static async setDocumentWithAudit(){f.writes++}}`,
};
const preamble=`window.fixture={user:{id:'test',fullName:'Petugas Contoh',role:'ADMIN',isActive:true,permissions:['*']},settings:{schoolName:'Sekolah Uji',schoolLat:-8,schoolLng:113,workHours:{start:'07:00',end:'15:00'},dashboardInfoConfig:{enabled:true,autoPlay:false,panels:{substitutions:false,announcements:true,dutyRoster:false,incidents:false,operations:false}}},data:{},observers:new Map(),settingsObservers:new Set(),scrolls:[],writes:0};const f=window.fixture;f.emit=(c,rows)=>{f.data[c]=rows;for(const fn of f.observers.get(c)||[])fn(rows)};f.emitSchool=s=>{f.settings=s;for(const fn of f.settingsObservers)fn(s)};const scroll=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){if(this.id==='personal-duty-details')f.scrolls.push({body:!!document.getElementById('personal-duty-body'),behavior:options.behavior});return scroll.call(this,options)};`;
const entry=`import React from'react';import{createRoot}from'react-dom/client';import{NavigationProvider}from'./src/contexts/NavigationContext';import{DashboardView}from'./src/features/dashboard/DashboardView';import{ScrollToTop}from'./src/components/common/ScrollToTop';createRoot(document.getElementById('root')).render(<NavigationProvider><main id="main-content-scroll" style={{height:"calc(100dvh - 32px)",overflowY:"auto"}}><DashboardView onNavigateTab={()=>{}}/><div style={{height:1400}} /></main><ScrollToTop targetSelector="#main-content-scroll"/></NavigationProvider>);`;
const built=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'/virtual-flash-details',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-io',setup(b){for(const[filter,path]of[[/AuthContext$/,'auth'],[/\/(?:firebase|firebaseAuth)$/,'firebase'],[/firestoreService$/,'firestore'],[/offlineStorage$/,'offline']])b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text,extra=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
const manifest=JSON.parse(fs.readFileSync('dist/.vite/manifest.json','utf8')),css=fs.readFileSync('dist/'+manifest['index.html'].css[0],'utf8');
const server=http.createServer((req,res)=>{if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');return res.end(js)}res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${extra}\nbody{margin:0;padding:16px;background:var(--theme-bg-app)}#root{max-width:1120px;margin:auto}</style><div id="root"></div><script>${preamble}</script><script src="/probe.js"></script></html>`)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,count=0,completed=false;
process.on('beforeExit',()=>{if(!completed){console.error('INCOMPLETE announcement layout suite:',count);process.exitCode=1}});
const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
try{
 browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
 const flash=page.getByRole('region',{name:'Flash info sekolah'});
 const fullTitle='Pengumuman penting: '+('Informasi kegiatan sekolah dan jadwal petugas harian '.repeat(8));
 const fullContent="Assalamu’alaikum, Bapak/Ibu guru. "+('Mohon membaca instruksi kegiatan sekolah dan melakukan pencatatan sesuai jadwal yang telah ditentukan. '.repeat(18))+"\n\nKode tautan: "+'https://contoh.sekolah/'+('abcdef'.repeat(90))+"\nKalimat penutup ini hanya ada di pesan lengkap.";
 const announce=(content=fullContent,title=fullTitle)=>page.evaluate(({content,title})=>{
  window.fixture.emit('announcements',[{id:'long',title,content,priority:'PENTING',targetRole:'SEMUA',isActive:true,authorName:'Koordinator Piket',date:'2026-10-19',createdAt:'2026-10-19T01:00:00.000Z',updatedAt:'2026-10-19T02:00:00.000Z',updatedBy:'test',updatedByName:'Admin',dataSource:'PRODUCTION',isDemo:false},...['second','third'].map(id=>({id,title:'Pengumuman lain '+id,content:'Pesan berikutnya',priority:'INFO',targetRole:'SEMUA',isActive:true,authorName:'Admin',date:'2026-10-19',dataSource:'PRODUCTION',isDemo:false}))]);
 },{content,title});
 await announce();await flash.waitFor();await flash.getByRole('button',{name:'Info berikutnya'}).tap();await page.waitForFunction(()=>document.querySelector('.dashboard-flash').dataset.transitioning==='false');
 const slide=flash.locator('.flash-announcement-slide:not([inert])');await slide.waitFor();
 check('flash displays one primary announcement and indicates two additional messages',await slide.locator('li').count()===1&&await slide.getByText('+2 pengumuman lainnya',{exact:true}).isVisible());
 check('the preview is bounded while the full text is retained in the source',await slide.locator('.flash-item-detail').evaluate(e=>e.textContent.length<=241&&!e.textContent.includes('Kalimat penutup')));
 const heights={};
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.getElementById('main-content-scroll').scrollTo({top:0,behavior:'instant'})},theme);
  const metrics=await slide.evaluate(async el=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const detail=el.querySelector('.flash-item-detail'),title=el.querySelector('.flash-item-title'),style=getComputedStyle(detail),vp=el.closest('.flash-viewport').getBoundingClientRect(),footer=el.closest('.dashboard-flash').querySelector('.flash-controls').getBoundingClientRect(),box=detail.getBoundingClientRect(),titleBox=title.getBoundingClientRect();return{lines:box.height/parseFloat(style.lineHeight),wrap:style.whiteSpace,clipped:detail.scrollHeight>detail.clientHeight,titleLines:titleBox.height/parseFloat(getComputedStyle(title).lineHeight),safe:box.left>=vp.left+3&&box.right<=vp.right-3&&box.bottom<=vp.bottom&&footer.top-box.bottom>=12,overflow:document.documentElement.scrollWidth>innerWidth||el.scrollWidth>el.clientWidth,font:parseFloat(style.fontSize),height:el.closest('.dashboard-flash').offsetHeight}});
  check(`${theme}/${width}: long title/detail wrap within two/three lines without touching border or controls`,metrics.wrap==='normal'&&metrics.lines<=3.05&&metrics.lines>1&&metrics.titleLines<=2.05&&metrics.safe&&!metrics.overflow&&metrics.font>=(width<640?13:14));
  heights[theme+width]=metrics.height;
  const contrast=await slide.evaluate(el=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const rgb=c=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
    const lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const bg=lum(getComputedStyle(el).getPropertyValue('--theme-card-bg'));
    return ['h2','.flash-item-title','.flash-item-detail'].every(selector=>{const fg=lum(getComputedStyle(el.querySelector(selector)).color);return(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5});
  });
  check(`${theme}/${width}: preview headings and body retain readable contrast`,contrast);
 }
 await page.setViewportSize({width:390,height:844});await announce('https://contoh.sekolah/'+('TANPASPASI'.repeat(120)));check('an unbroken URL cannot expand the card horizontally',await slide.locator('.flash-item-detail').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*3+1));
 await announce('Rapat pukul 07.00 di ruang guru.','Informasi singkat');check('short announcements remain intact instead of adding a false ellipsis',await slide.locator('.flash-item-detail').innerText()==='Rapat pukul 07.00 di ruang guru.');
 await announce();await flash.getByRole('button',{name:'Buka pengumuman',exact:true}).tap();const dialog=page.getByRole('dialog');await dialog.waitFor();
 check('one tap opens the board with every original character and newline',await dialog.locator('.announcement-body').first().textContent()===fullContent&&await dialog.locator('.announcement-title').first().textContent()===fullTitle);
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
  const metrics=await dialog.evaluate(async el=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const body=el.querySelector('.announcement-body'),heading=el.querySelector('.announcement-title'),meta=el.querySelector('.announcement-meta');return{body:parseFloat(getComputedStyle(body).fontSize),title:parseFloat(getComputedStyle(heading).fontSize),meta:parseFloat(getComputedStyle(meta).fontSize),bodyFits:body.scrollWidth<=body.clientWidth+1,dialogFits:el.scrollWidth<=el.clientWidth+1,all:[...el.querySelectorAll('.announcement-body')].length}});
  check(`${theme}/${width}: full-board fonts increase and long words fit without horizontal scrolling`,metrics.body>=(width<640?15:16)&&metrics.title>=(width<640?16:17)&&metrics.meta>=(width<640?13:14)&&metrics.bodyFits&&metrics.dialogFits&&metrics.all===3);
 }
 if(process.env.PIKET_QA_SCREENSHOTS){fs.mkdirSync(process.env.PIKET_QA_SCREENSHOTS,{recursive:true});await dialog.screenshot({path:process.env.PIKET_QA_SCREENSHOTS+'/announcement-board.png'})}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 const top=page.getByRole('button',{name:'Kembali ke atas',exact:true});
 for(const theme of ['light','dark'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.getElementById('main-content-scroll').scrollTo({top:650,behavior:'instant'})},theme);await top.waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.back-to-top-button')).opacity==='1');
  const metrics=await top.evaluate(el=>{const surface=el.querySelector('.back-to-top-surface'),icon=el.querySelector('svg'),bg=getComputedStyle(surface).backgroundColor;return{target:el.offsetWidth,surface:surface.offsetWidth,icon:icon.getBoundingClientRect().width,bg,alpha:parseFloat(bg.match(/\/\s*([\d.]+)/)?.[1]??bg.match(/,\s*([\d.]+)\)$/)?.[1]??'1')}});
  check(`${theme}/${width}: smaller translucent surface retains a 44px target and readable icon`,metrics.target>=44&&metrics.surface===(width<640?36:40)&&metrics.icon<=(width<640?18.1:20.1)&&metrics.alpha>0&&metrics.alpha<1);
  await top.tap();await page.waitForFunction(()=>document.getElementById('main-content-scroll').scrollTop===0);check(`${theme}/${width}: one tap returns the actual main container to its top`,true);
 }
 await page.evaluate(()=>document.getElementById('main-content-scroll').scrollTo({top:650,behavior:'instant'}));await top.waitFor();await top.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('main-content-scroll').scrollTop===0);check('keyboard activation remains functional',true);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{const el=document.getElementById('main-content-scroll');const native=el.scrollTo.bind(el);el.scrollTo=function(opts){window.fixture.scrollBehavior=opts.behavior;native(opts)};el.scrollTo({top:650,behavior:'instant'})});await top.waitFor();await top.tap();check('reduced-motion scrolling is immediate',await page.evaluate(()=>window.fixture.scrollBehavior==='auto'));
 await page.waitForFunction(()=>document.querySelector('.back-to-top-button').getAttribute('aria-hidden')==='true');check('hidden top button is removed from keyboard navigation',await page.locator('.back-to-top-button').getAttribute('tabindex')==='-1');
 await page.evaluate(()=>document.getElementById('main-content-scroll').scrollTo({top:650,behavior:'instant'}));await top.waitFor();await flash.getByRole('button',{name:'Buka pengumuman',exact:true}).click();await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('.back-to-top-button').getAttribute('aria-hidden')==='true');check('top button is hidden behind an open board dialog',true);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>document.getElementById('main-content-scroll').scrollTo({top:0,behavior:'instant'}));await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await flash.getByRole('button',{name:'Info sebelumnya'}).tap();await page.waitForFunction(()=>document.querySelector('.dashboard-flash').dataset.transitioning==='false');check('rotating away and back keeps the card height stable',Math.abs(await flash.evaluate(e=>e.offsetHeight)-heights.light390)<=1);
 if(process.env.PIKET_QA_SCREENSHOTS){await flash.getByRole('button',{name:'Info berikutnya'}).tap();await page.waitForFunction(()=>document.querySelector('.dashboard-flash').dataset.transitioning==='false');await flash.screenshot({path:process.env.PIKET_QA_SCREENSHOTS+'/flash-preview.png'})}
 check('read-only layout interactions issue no database writes or runtime errors',await page.evaluate(()=>window.fixture.writes===0)&&errors.length===0);
 completed=true;console.log(`${count} announcement preview/board/scroll-button UI scenarios passed. Synthetic data only.`);
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
