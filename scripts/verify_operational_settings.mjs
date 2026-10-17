import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const fixture = { uid: 'admin', user: { role: 'ADMIN', isActive: true, fullName: 'Admin' }, settings: { schoolName: 'Sekolah', schoolLat: -8, schoolLng: 113, allowedRadiusMeters: 100, schoolLocationLocked: true, dashboardInfoConfig: { enabled: true }, notificationConfig: { enabled: true } }, writes: [], logs: [] };
const mocks = {
  firebase: 'export const db={};export const auth={get currentUser(){return{uid:globalThis.f.uid}}};',
  sdk: `export const doc=(db,collection,id)=>({collection,id});export const serverTimestamp=()=> 'SERVER_TIME';export async function getDocFromServer(ref){return{exists:()=>true,data:()=>ref.collection==='users'?globalThis.f.user:globalThis.f.settings,id:ref.id}};export async function runTransaction(db,callback){const f=globalThis.f;await callback({get:ref=>getDocFromServer(ref),update:(ref,patch)=>{f.writes.push(patch);Object.assign(f.settings,patch)},set:(ref,patch)=>{f.writes.push(patch);Object.assign(f.settings,patch)}})}`,
  location: 'export const LocationService={};', audit: 'export const AuditService={log:async event=>{globalThis.f.logs.push(event)}};', drive: 'export const DriveClientService={};',
};
const built = await build({ stdin: { contents: "export{SchoolSettingsService}from'./src/services/firebase/schoolSettingsService';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'synthetic-settings', setup(b) {
  for (const [filter,path] of [[/\/firebase$/,'firebase'],[/^firebase\/firestore$/,'sdk'],[/locationService$/,'location'],[/auditService$/,'audit'],[/driveClientService$/,'drive']]) b.onResolve({filter},()=>({path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
}}] });
const context = vm.createContext({ f: fixture, module: { exports: {} }, console, localStorage: { setItem() {} }, TextEncoder, Uint8Array, DataView }); vm.runInContext(built.outputFiles[0].text,context);
const service = context.module.exports.SchoolSettingsService; let count=0;const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS',name)};
await service.saveOperationalReportSettings({ paperSize:'F4',orientation:'landscape',marginLeftMm:20,showLogo:false,showLetterhead:false,showSignatures:false },{allowCustomDestination:false,customDestinations:[' Koperasi ','Koperasi','Panitia']},'admin');
check('admin saves only print and visitor configuration',fixture.writes.length===1 && Object.keys(fixture.writes[0]).sort().join(',')==='printConfig,updatedAt,visitorConfig');
check('GPS, notifications and flash settings are preserved',fixture.settings.schoolLat===-8 && fixture.settings.notificationConfig.enabled && fixture.settings.dashboardInfoConfig.enabled);
check('visitor destinations are trimmed and deduplicated',fixture.settings.visitorConfig.customDestinations.join(',')==='Koperasi,Panitia');
check('paper size, margins, orientation and switches persist',fixture.settings.printConfig.paperSize==='F4'&&fixture.settings.printConfig.orientation==='landscape'&&fixture.settings.printConfig.marginLeftMm===20&&!fixture.settings.printConfig.showSignatures);
const before=fixture.writes.length;fixture.user.role='GURU';await assert.rejects(()=>service.saveOperationalReportSettings({}, {},'admin'));check('non-admin cannot save these settings',fixture.writes.length===before);
fixture.user.role='ADMIN';fixture.user.isActive=false;await assert.rejects(()=>service.saveOperationalReportSettings({}, {},'admin'));check('inactive admin cannot save these settings',fixture.writes.length===before);
fixture.user.isActive=true;await assert.rejects(()=>service.saveOperationalReportSettings({}, {},'different-user'));check('mismatched authenticated UID is rejected',fixture.writes.length===before);
await service.saveProfile({...fixture.settings,schoolName:'Nama baru',printConfig:{paperSize:'A4'},visitorConfig:{allowCustomDestination:true,customDestinations:['stale']}},'admin');
check('a stale profile save cannot overwrite newer report/visitor settings',fixture.settings.printConfig.paperSize==='F4'&&!fixture.settings.visitorConfig.allowCustomDestination&&fixture.settings.schoolName==='Nama baru');
check('settings save creates an audit entry',fixture.logs.some(event=>event.module==='SETTINGS'&&event.details.includes('format cetak')));
console.log(`${count} operational settings/access checks passed.`);
