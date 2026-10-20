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
  for (const [filter,path] of [[/\/(?:firebase|firebaseAuth)$/,'firebase'],[/^firebase\/firestore$/,'sdk'],[/locationService$/,'location'],[/auditService$/,'audit'],[/driveClientService$/,'drive']]) b.onResolve({filter},()=>({path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
}}] });
const context = vm.createContext({ f: fixture, module: { exports: {} }, console, localStorage: { setItem() {} }, TextEncoder, Uint8Array, DataView, URL }); vm.runInContext(built.outputFiles[0].text,context);
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
const oldSettings=JSON.parse(JSON.stringify(fixture.settings));
await service.saveBrandingSettings('/icon.svg','https://example.invalid/school.png',{schoolName:'Kop Khusus',foundationName:'Yayasan Uji',logoWidthMm:500},'admin');
check('branding writes only its three independent fields',Object.keys(fixture.writes.at(-1)).sort().join(',')==='appLogoUrl,letterheadConfig,letterheadLogoUrl,updatedAt');
check('branding preserves GPS, school profile and report settings',fixture.settings.schoolName===oldSettings.schoolName&&fixture.settings.schoolLat===oldSettings.schoolLat&&fixture.settings.printConfig.paperSize===oldSettings.printConfig.paperSize);
check('letterhead values are normalized without undefined',fixture.settings.letterheadConfig.logoWidthMm===32&&!Object.values(fixture.settings.letterheadConfig).includes(undefined));
await service.saveProfile({...oldSettings,schoolName:'Profil lebih baru',appLogoUrl:'https://example.invalid/stale.png',letterheadLogoUrl:'stale',letterheadConfig:{schoolName:'stale'}},'admin');
check('stale profile save preserves newer app/letterhead branding',fixture.settings.appLogoUrl==='/icon.svg'&&fixture.settings.letterheadLogoUrl==='https://example.invalid/school.png'&&fixture.settings.letterheadConfig.schoolName==='Kop Khusus');
const current=fixture.writes.length;
for(const role of ['GURU','inactive','wrong-uid']){fixture.user.role=role==='GURU'?'GURU':'ADMIN';fixture.user.isActive=role!=='inactive';await assert.rejects(()=>service.saveBrandingSettings('/icon.svg','',{schoolName:'Sekolah'},role==='wrong-uid'?'other':'admin'));}
check('branding rejects non-admin, inactive and mismatched sessions',fixture.writes.length===current);
fixture.user.role='ADMIN';fixture.user.isActive=true;
for(const logo of ['javascript:alert(1)','/api/drive/photo/private','http://example.invalid/logo.png','https://user:password@example.invalid/logo.png'])await assert.rejects(()=>service.saveBrandingSettings(logo,'',{schoolName:'Sekolah'},'admin'));
check('branding rejects unsafe or private URLs before saving',fixture.writes.length===current);
await assert.rejects(()=>service.saveBrandingSettings('/icon.svg','',{schoolName:''},'admin'));
check('blank letterhead school name cannot be saved',fixture.writes.length===current);
check('default report signature order is principal left',fixture.settings.printConfig.signatureOrder==='principal_left');
await service.saveOperationalReportSettings({...fixture.settings.printConfig,showPageNumbers:false,pageNumberPosition:'right',pageNumberFormat:'page_only',pageNumberStart:7},fixture.settings.visitorConfig,'admin');
check('admin page numbering settings persist without changing GPS/branding',fixture.settings.printConfig.showPageNumbers===false&&fixture.settings.printConfig.pageNumberPosition==='right'&&fixture.settings.printConfig.pageNumberStart===7&&fixture.settings.appLogoUrl==='/icon.svg'&&fixture.settings.schoolLat===-8);
console.log(`${count} operational settings/access checks passed.`);
