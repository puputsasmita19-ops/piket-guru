// Actual login component and preference storage. Auth and public summaries are synthetic.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const req = createRequire(import.meta.url), modules = process.env.PIKET_UI_TEST_NODE_MODULES;
const dep = name => req(modules ? modules + '/' + name : name);
const { JSDOM } = dep('jsdom'), { within, waitFor, fireEvent } = dep('@testing-library/dom');
const mocks = {
  auth: `const f=window.fixture;export const useAuth=()=>({isLoading:false,isTrustedDevice:f.trusted,setTrustedDevice(){},loginWithPin:async(id,pin)=>{f.logins.push({id,pin});return{success:false,error:'PIN salah.'}},loginWithGoogle:async()=>({success:false})});`,
  users: `const f=window.fixture;export const authService={getUsersList:async options=>{f.reads++;f.options.push(options);if(f.pending)await f.pending;return f.users},getUsersListStatus:()=>({verified:f.verified,updatedAt:Date.now()})};`,
  bootstrap: `export const preloadAuthenticatedShell=()=>{};`,
};
const bundle = await build({ stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';import{ThemeProvider}from'./src/contexts/ThemeContext';import{LoginPage}from'./src/features/auth/LoginPage';import{LastLoginPreference,LAST_LOGIN_KEY}from'./src/services/auth/lastLoginPreference';window.pref=LastLoginPreference;window.prefKey=LAST_LOGIN_KEY;const root=createRoot(document.getElementById('root'));window.renderLogin=()=>root.render(<ThemeProvider><LoginPage/></ThemeProvider>);window.unmount=()=>root.unmount();`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'mock-io', setup(b) { for (const [filter, path] of [[/AuthContext$/, 'auth'], [/authService$/, 'users'], [/appBootstrap$/, 'bootstrap']]) b.onResolve({ filter }, () => ({ path, namespace: 'mock' })); b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' })); } }] });
const admin = { id: 'uid-admin', userId: 'uid-admin', loginId: 'ADMIN-001', fullName: 'Administrator', role: 'ADMIN', nip: '', isActive: true };
const teacher = { id: 'uid-teacher', userId: 'uid-teacher', loginId: 'GURU-001', fullName: 'Dian Alamsyah', role: 'GURU', nip: '', isActive: true };
function setup({ trusted = true, remembered, users = [admin, teacher], pending, verified = true } = {}) {
  const f = { trusted, users, pending, verified, reads: 0, options: [], logins: [] };
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://test.invalid', pretendToBeVisual: true, runScripts: 'dangerously', beforeParse(w) { w.fixture = f; w.HTMLElement.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.fetch = async () => ({ json: async () => ({ success: true, config: { loginAppearance: { mediaPolicy: 'economy', background: 'gradient' } } }) }); } });
  const w = dom.window; w.eval(bundle.outputFiles[0].text); if (remembered) w.pref.remember({ id: remembered, isActive: true }, true); w.renderLogin();
  const ui = within(w.document.body), wait = cb => waitFor(cb, { container: w.document.body });
  const trigger = () => w.document.querySelector('button[aria-haspopup="listbox"]');
  return { f, w, ui, wait, trigger, close: () => { w.unmount(); w.close(); } };
}
let count = 0; async function check(name, options, test) { const s = setup(options); try { await test(s); count++; console.log('PASS', name); } finally { s.close(); } }
await check('new personal device does not default to the first admin', {}, async ({ wait, trigger }) => { await wait(() => assert.ok(trigger())); assert.ok(trigger().textContent.includes('Pilih pengguna...')); assert.ok(!trigger().textContent.includes('Administrator')); });
await check('remembered UID resolves current name and changed login ID from server', { remembered: teacher.id, users: [admin, { ...teacher, fullName: 'Dian Terbaru', loginId: 'GURU-BARU' }] }, async ({ wait, trigger, f }) => { await wait(() => assert.ok(trigger()?.textContent.includes('Dian Terbaru'))); assert.ok(trigger().textContent.includes('GURU-BARU')); assert.equal(f.options[0].forceRefresh, true); });
await check('name updates arrive without reload and PIN submission uses the same canonical UID', { remembered: teacher.id }, async ({ f, w, ui, wait, trigger }) => {
  await wait(() => assert.ok(trigger()?.textContent.includes(teacher.fullName))); f.users = [admin, { ...teacher, fullName: 'Nama Diperbarui', loginId: 'GURU-NEW' }]; w.dispatchEvent(new w.Event('focus')); await wait(() => assert.ok(trigger()?.textContent.includes('Nama Diperbarui')));
  fireEvent.input(ui.getByLabelText('6-digit PIN keamanan'), { target: { value: '123456' } }); assert.equal(f.logins.length, 0); ui.getByRole('button', { name: 'Masuk Sekarang', exact: true }).click(); await wait(() => assert.equal(f.logins.length, 1)); assert.equal(f.logins[0].id, teacher.id); assert.equal(w.pref.read(true), teacher.id);
});
await check('deactivated or removed remembered account is cleared without selecting admin', { remembered: teacher.id, users: [admin, { ...teacher, isActive: false }] }, async ({ w, wait, trigger }) => { await wait(() => assert.ok(trigger())); assert.ok(trigger().textContent.includes('Pilih pengguna...')); assert.equal(w.pref.read(true), null); });
await check('duplicate legacy NIP values cannot display a different account than the remembered UID', { remembered: teacher.id, users: [{ ...admin, loginId: '', nip: '123' }, { ...teacher, loginId: '', nip: '123' }] }, async ({ wait, trigger }) => { await wait(() => assert.ok(trigger()?.textContent.includes(teacher.fullName))); assert.ok(!trigger().textContent.includes('Administrator')); });
await check('a failed summary request does not destroy the saved preference', { remembered: teacher.id, verified: false, users: [] }, async ({ f, w, wait }) => { await wait(() => assert.equal(f.reads, 1)); assert.equal(w.pref.read(true), teacher.id); });
await check('shared devices ignore remembered personal account', { remembered: teacher.id, trusted: false }, async ({ wait, trigger }) => { await wait(() => assert.ok(trigger())); assert.ok(trigger().textContent.includes('Pilih pengguna...')); });
await check('manual ID typed before summary arrives stays visible and is never replaced by admin', { pending: Promise.resolve(), users: [] }, async s => {
  let release; s.f.pending = new Promise(r => { release = r; }); await s.wait(() => assert.ok(s.ui.getByPlaceholderText('Masukkan ID Login atau NIP...'))); fireEvent.input(s.ui.getByPlaceholderText('Masukkan ID Login atau NIP...'), { target: { value: 'MANUAL-123' } }); s.f.users = [admin, teacher]; release(); await s.wait(() => assert.ok(s.ui.getByRole('button', { name: 'Pilih dari Daftar' }))); assert.equal(s.ui.getByPlaceholderText('Masukkan ID Login atau NIP...').value, 'MANUAL-123');
});
await check('preference updates synchronize idle login tabs but cannot interrupt PIN entry', { remembered: teacher.id }, async ({ w, ui, wait, trigger }) => {
  await wait(() => assert.ok(trigger()?.textContent.includes(teacher.fullName))); w.pref.remember({ id: admin.id, isActive: true }, true); await wait(() => assert.ok(trigger()?.textContent.includes('Administrator')));
  fireEvent.input(ui.getByLabelText('6-digit PIN keamanan'), { target: { value: '12' } }); w.pref.remember({ id: teacher.id, isActive: true }, true); await new Promise(r => setTimeout(r, 20)); assert.ok(trigger().textContent.includes('Administrator')); assert.equal(ui.getByLabelText('6-digit PIN keamanan').value, '12');
});
await check('another browser context has independent selection and no leaked account details', { remembered: teacher.id }, async ({ w, wait, trigger }) => { await wait(() => assert.ok(trigger()?.textContent.includes(teacher.fullName))); const second = setup(); try { await second.wait(() => assert.ok(second.trigger())); assert.ok(second.trigger().textContent.includes('Pilih pengguna...')); assert.equal(second.w.pref.read(true), null); const record = JSON.parse(w.localStorage.getItem(w.prefKey)); assert.deepEqual(Object.keys(record).sort(), ['uid', 'updatedAt', 'version']); } finally { second.close(); } });
await check('corrupt preference is ignored safely', {}, async ({ w, wait, trigger }) => { await wait(() => assert.ok(trigger())); w.localStorage.setItem(w.prefKey, '{invalid'); w.dispatchEvent(new w.StorageEvent('storage', { key: w.prefKey })); await new Promise(r => setTimeout(r, 20)); assert.equal(w.pref.read(true), null); assert.ok(trigger().textContent.includes('Pilih pengguna...')); });
console.log(`${count} last-login selection DOM checks passed. No external IO.`);
