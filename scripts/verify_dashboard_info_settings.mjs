// Actual settings service and normalizer, with all Firebase IO replaced in memory.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const f = { uid: 'admin', role: 'ADMIN', active: true, state: { schoolName: 'Sekolah Contoh', schoolLat: -8, schoolLng: 113, allowedRadiusMeters: 100, notificationConfig: { enabled: false }, dashboardInfoConfig: { enabled: false } }, writes: [], audits: [] };
const mocks = {
  firebase: `export const auth={get currentUser(){return globalThis.f.uid?{uid:globalThis.f.uid}:null}};export const db={};`,
  sdk: `export const doc=(_,c,id)=>({c,id});const snap=ref=>({exists:()=>true,data:()=>ref.c==='users'?{role:globalThis.f.role,isActive:globalThis.f.active,fullName:'Admin Contoh'}:{...globalThis.f.state}});export const getDocFromServer=async ref=>snap(ref);export const serverTimestamp=()=> 'SERVER_TIME';export const runTransaction=async(_,cb)=>cb({get:async ref=>snap(ref),update:(ref,data)=>{globalThis.f.writes.push(data);Object.assign(globalThis.f.state,data)},set:(ref,data)=>{globalThis.f.writes.push(data);Object.assign(globalThis.f.state,data)}});`,
  audit: `export const AuditService={log:async row=>globalThis.f.audits.push(row)};`,
  location: `export const LocationService={};`,
};
const b = await build({ stdin: { contents: "export{SchoolSettingsService}from'./src/services/firebase/schoolSettingsService';export{sanitizeDashboardInfoConfig}from'./src/types/dashboardInfo.types';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [{ name: 'synthetic', setup(b) {
  for (const [filter, path] of [[/\/(?:firebase|firebaseAuth)$/, 'firebase'], [/^firebase\/firestore$/, 'sdk'], [/auditService$/, 'audit'], [/locationService$/, 'location']]) b.onResolve({ filter }, () => ({ path, namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' }));
} }] });
const c = vm.createContext({ f, module: { exports: {} }, console, TextEncoder, TextDecoder, localStorage: { setItem() {}, getItem() { return null; } } });
vm.runInContext(b.outputFiles[0].text, c);
const { SchoolSettingsService: service, sanitizeDashboardInfoConfig: sanitize } = c.module.exports;
let n = 0;
const check = (name, fn) => { fn(); n++; console.log('PASS', name); };
check('new config defaults to all panels, enabled and three-second autoplay', () => { const v = sanitize(); assert.equal(v.intervalMs, 3000); assert.equal(v.enabled, true); assert.equal(v.autoPlay, true); assert.ok(Object.values(v.panels).every(Boolean)); });
check('invalid config cannot create an unbounded rotation frequency', () => assert.equal(sanitize({ intervalMs: -1 }).intervalMs, 3000));
check('expanded reading intervals remain valid including one minute', () => { for (const intervalMs of [2000,2500,3000,4000,5000,6000,7000,8000,10000,12000,15000,20000,30000,45000,60000]) assert.equal(sanitize({intervalMs}).intervalMs, intervalMs); });
check('only known panels are persisted and false is retained', () => { const v = sanitize({ enabled: false, autoPlay: false, intervalMs: 2500, panels: { dutyRoster: false, unknown: true } }); assert.equal(v.intervalMs, 2500); assert.equal(v.panels.dutyRoster, false); assert.equal(Object.keys(v.panels).length, 4); assert.equal(v.enabled, false); });
const config = sanitize({ intervalMs: 2500, panels: { incidents: false } });
config.welcome = { enabled: true, mode: 'interval', category: 'islamic', templateId: 'islamic-ease', customMessage: 'Salam sekolah', intervalMinutes: 30, templates: [{ id: 'custom-school', category: 'islamic', text: 'Semoga sekolah kita penuh kebaikan.' }] };
await service.saveDashboardInfoSettings(config, 'admin');
check('welcome settings persist through the actual admin transaction alongside existing panels', () => { assert.equal(f.state.dashboardInfoConfig.welcome.templates[0].id, 'custom-school'); assert.equal(f.state.dashboardInfoConfig.welcome.category, 'islamic'); assert.equal(f.state.dashboardInfoConfig.welcome.mode, 'interval'); assert.equal(f.state.dashboardInfoConfig.welcome.intervalMinutes, 30); assert.equal(f.state.dashboardInfoConfig.panels.incidents, false); });
check('admin save changes only dashboard configuration and timestamp', () => { assert.deepEqual(Object.keys(f.writes[0]).sort(), ['dashboardInfoConfig', 'updatedAt']); assert.equal(f.state.schoolLat, -8); assert.equal(f.state.notificationConfig.enabled, false); });
check('dashboard configuration save is audited', () => assert.equal(f.audits.at(-1).module, 'SETTINGS'));
await service.saveDashboardInfoSettings(sanitize({ intervalMs: 60000 }), 'admin');
check('long interval is retained by the actual settings service', () => assert.equal(f.state.dashboardInfoConfig.intervalMs, 60000));
await service.saveLoginAppearanceSettings({ motionEnabled: false, background: 'gradient', speed: 'fast', intensity: 'clear', runningCredit: false, creditDuration: 45, secret: 'DROP_ME' }, 'admin');
check('login appearance writes only its own sanitized public fields', () => { assert.deepEqual(Object.keys(f.writes.at(-1)).sort(), ['loginAppearance', 'updatedAt']); assert.equal(f.state.loginAppearance.motionEnabled, false); assert.equal(f.state.loginAppearance.creditDuration, 45); assert.equal(Object.keys(f.state.loginAppearance).length, 7); assert.equal(f.state.loginAppearance.secret, undefined); });
const latestLogin = JSON.stringify(f.state.loginAppearance);
const latest = JSON.stringify(f.state.dashboardInfoConfig);
await service.saveProfile({ ...f.state, schoolName: 'Sekolah Diperbarui', schoolLat: 0, loginAppearance: { motionEnabled: true }, dashboardInfoConfig: { enabled: false } }, 'admin');
check('stale profile form cannot overwrite the latest dashboard settings or GPS', () => { assert.equal(JSON.stringify(f.state.dashboardInfoConfig), latest); assert.equal(f.state.schoolLat, -8); assert.equal(f.state.schoolName, 'Sekolah Diperbarui'); assert.equal(JSON.stringify(f.state.loginAppearance), latestLogin); });
for (const [role, active] of [['GURU', true], ['ADMIN', false], ['KEPALA_SEKOLAH', true]]) {
  f.role = role; f.active = active; const before = f.writes.length;
  await assert.rejects(() => service.saveDashboardInfoSettings(config, 'admin'), /administrator aktif/);
  await assert.rejects(() => service.saveLoginAppearanceSettings({}, 'admin'), /administrator aktif/);
  check(`${role}/${active}: unauthorized save never reaches the write`, () => assert.equal(f.writes.length, before));
}
f.role = 'ADMIN'; f.active = true; f.uid = 'another-user';
await assert.rejects(() => service.saveDashboardInfoSettings(config, 'admin'), /Sesi administrator/);
console.log('PASS mismatched authenticated user cannot save'); n++;
console.log(`${n} dashboard settings checks passed. No production IO.`);
