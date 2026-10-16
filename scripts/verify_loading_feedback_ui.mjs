// Optional real React/JSDOM tests; install jsdom and @testing-library/dom in an
// isolated tools folder, then set PIKET_UI_TEST_NODE_MODULES to node_modules.
// All authentication, user-list and public-config IO is mocked.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const dep=name=>require(process.env.PIKET_UI_TEST_NODE_MODULES?process.env.PIKET_UI_TEST_NODE_MODULES+'/'+name:name);
const{JSDOM}=dep('jsdom');const{within,waitFor,fireEvent}=dep('@testing-library/dom');
const mocks={
 auth:`const f=window.fixture;export const useAuth=()=>({isLoading:false,isTrustedDevice:true,setTrustedDevice(){},loginWithPin:async()=>{f.loginCalls++;return f.loginResult},loginWithGoogle:async()=>({success:false,error:'Uji batal'})});`,
 users:`export const authService={getUsersList:()=>window.fixture.usersResult};`,
 bootstrap:`export const preloadAuthenticatedShell=()=>{window.fixture.preloads++};`,
};
const built=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{ThemeProvider}from'./src/contexts/ThemeContext';import{LoginPage}from'./src/features/auth/LoginPage';import{PageLoading}from'./src/components/common/PageLoading';const root=createRoot(document.getElementById('root'));window.loading=()=>root.render(<ThemeProvider><PageLoading fullScreen label="Memverifikasi sesi…"/></ThemeProvider>);window.login=()=>root.render(<ThemeProvider><LoginPage/></ThemeProvider>);window.unmount=()=>root.unmount();`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated',setup(b){for(const[filter,path]of[[/AuthContext$/,'auth'],[/authService$/,'users'],[/appBootstrap$/,'bootstrap']])b.onResolve({filter},()=>({path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
let releaseLogin,releaseUsers;const f={loginCalls:0,preloads:0,loginResult:new Promise(r=>releaseLogin=r),usersResult:new Promise(r=>releaseUsers=r)};
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://test.invalid',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fixture=f;w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.fetch=async()=>({json:async()=>({success:true,config:{schoolName:'Sekolah Contoh'}})});}});
const w=dom.window;w.eval(built.outputFiles[0].text);const ui=within(w.document.body);const wait=cb=>waitFor(cb,{container:w.document.body,timeout:3000});let checks=0;
try{
 w.loading();await wait(()=>assert.ok(ui.getByText('Memverifikasi sesi…')));assert.equal(ui.queryByText('Muat ulang'),null);checks++;console.log('PASS startup gives immediate feedback without showing a dashboard');
 const start=Date.now();await wait(()=>assert.ok(ui.getByText('Muat ulang')));const slowMs=Date.now()-start;assert.ok(slowMs>=1400&&slowMs<2300);checks++;console.log('PASS slow startup has recovery control after',slowMs,'ms');
 w.login();await wait(()=>assert.ok(ui.getByRole('button',{name:'Masuk Sekarang'})));const id=ui.getByPlaceholderText('Masukkan ID Login atau NIP...');fireEvent.focusIn(id);assert.ok(f.preloads>0);fireEvent.input(id,{target:{value:'uji-loading'}});
 for(const digit of ['1','2','3','4','5','6']){ui.getByRole('button',{name:digit,exact:true}).click();await new Promise(r=>setTimeout(r,0));}
 assert.equal(ui.getByRole('button',{name:'Masuk Sekarang'}).disabled,false);ui.getByRole('button',{name:'Masuk Sekarang'}).click();await wait(()=>assert.equal(f.loginCalls,1));checks++;console.log('PASS manual login starts while users-summary is still pending');
 const busy=ui.getByRole('button',{name:'Memeriksa…'});assert.equal(busy.disabled,true);busy.click();assert.equal(f.loginCalls,1);checks++;console.log('PASS pending PIN login cannot submit twice');
 await wait(()=>assert.ok(ui.getByText(/Server masih memverifikasi akun/)));checks++;console.log('PASS pending PIN login explains the connection status');
 releaseLogin({success:false,error:'PIN salah.',remainingAttempts:4});await wait(()=>assert.ok(ui.getAllByText(/PIN salah/).length>0));await wait(()=>assert.equal(ui.getByRole('button',{name:'Masuk Sekarang'}).disabled,false));assert.equal(ui.queryByText(/Server masih memverifikasi akun/),null);checks++;console.log('PASS wrong PIN feedback survives and busy state clears');
 releaseUsers([]);console.log(checks,'actual React loading/login flows passed; no external IO.');
}finally{w.unmount();w.close();}
