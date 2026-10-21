/** Tests safe to run without Firebase credentials; execute after npm ci: node scripts/verify_admin_attendance_round8.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const files = [
  'src/services/firebase/adminAttendanceService.ts',
  'src/features/attendance/AdminAttendanceDialog.tsx',
  'src/features/attendance/AdminAttendanceDashboard.tsx',
  'src/features/attendance/AttendancePreview.tsx',
  'src/AuthenticatedShell.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/contexts/NavigationContext.tsx',
  'src/config/moduleAppearance.ts',
  'src/types/index.ts',
];
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('PASS', name); };
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  test(`Syntax ${file}`, () => assert.equal(parsed.parseDiagnostics.length, 0, parsed.parseDiagnostics.map(d => d.messageText).join('\n')));
}
const source = fs.readFileSync('src/services/firebase/adminAttendanceService.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }}).outputText;
let userProfile = { role: 'ADMIN', isActive: true, requiresActivation: false };
let record = { id:'att-2026-10-21-u1', userId:'u1', userName:'Guru A', tanggal:'2026-10-21', jamMasuk:'2026-10-21T00:00:00.000Z', jamPulang:null, status:'DALAM_LOKASI', keteranganCheckout:'', distance:10, latitude:-6, longitude:107, accuracy:5, updatedAt:'2026-10-21T00:00:00.000Z', photoUrl:'data:long-photo' };
const logs = new Map();
const auth = { currentUser: { uid:'admin-1' }};
const toEpochMs = v => !v ? 0 : typeof v === 'string' ? Date.parse(v) : v.toMillis ? v.toMillis() : v.seconds * 1000;
const firestore = {
  doc: (_, col, id) => ({ col, id }),
  async runTransaction(_, callback) {
    const writes=[];
    const tx={
      get: async ref => ({ id: ref.id, exists: () => ref.col === 'users' ? Boolean(userProfile) : ref.col === 'attendance' ? Boolean(record) : false,
        data: () => ref.col === 'users' ? { ...userProfile } : { ...record }}),
      update: (ref, patch) => writes.push(() => {if (ref.col === 'attendance') record = { ...record, ...patch };}),
      delete: (ref) => writes.push(() => { if (ref.col === 'attendance') record = null; }),
      set: (ref, payload) => writes.push(() => { if (ref.col === 'auditLogs') logs.set(ref.id, payload); }),
    };
    const result = await callback(tx); writes.forEach(write => write()); return result;
  },
};
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module, exports: module.exports, crypto: { randomUUID: () => `test-${logs.size}` }, navigator: {onLine:true},
  require(name) {
    if (name === 'firebase/firestore') return firestore;
    if (name === './firebase') return { auth, db:{} };
    if (name === '../../utils/dateUtils') return { toEpochMs };
    throw Error(`Unexpected import ${name}`);
  }, Intl, Date, Error, Promise,
}, { filename: 'adminAttendanceService.js' });
const { wibTimeToIso, isoToWibTime, validateAttendanceCorrection, AdminAttendanceService } = module.exports;
const good = { jamMasuk:'07:00', jamPulang:'14:00', status:'DALAM_LOKASI', keteranganCheckout:'Selesai', alasan:'Koreksi sesuai log buku piket' };
test('WIB conversion correct', () => assert.equal(wibTimeToIso('2026-10-21','07:00'),'2026-10-21T00:00:00.000Z'));
test('Round-trip timezone display', () => assert.equal(isoToWibTime('2026-10-21T08:30:00.000Z'),'15:30'));
test('Reject incorrect 25:00 time', () => assert.throws(()=>wibTimeToIso('2026-10-21','25:00')));
test('Reject impossible calendar date', () => assert.throws(()=>wibTimeToIso('2026-02-30','07:00')));
test('Valid admin change data', () => assert.equal(validateAttendanceCorrection(record, good).jamPulang,'2026-10-21T07:00:00.000Z'));
test('Reject check-out before check-in', () => assert.throws(()=>validateAttendanceCorrection(record,{...good,jamPulang:'06:00'})));
test('Reject short reasons', () => assert.throws(()=>validateAttendanceCorrection(record,{...good,alasan:'bad'})));
test('Reject invalid statuses', () => assert.throws(()=>validateAttendanceCorrection(record,{...good,status:'FORGED'})));
const run = async(name,fn) => {await fn(); checks++; console.log('PASS',name);};
await run('Successful correction commits updated record and audit', async () => { const before={...record}; await AdminAttendanceService.change(before,good,'edit','Admin A');assert.equal(record.jamPulang, '2026-10-21T07:00:00.000Z');assert.equal(logs.size,1);assert.equal([...logs.values()][0].action,'UPDATE');assert.equal(record.photoUrl,'data:long-photo'); });
await run('Stale concurrent record rejected', async () => { await assert.rejects(()=>AdminAttendanceService.change({...record, jamMasuk:'2026-10-21T01:30:00.000Z'}, good,'edit','Admin A'),/berubah/);assert.equal(logs.size,1); });
await run('Non-admin access rejected', async () => {const before={...record};userProfile.role='GURU';await assert.rejects(()=>AdminAttendanceService.change(before,good,'delete','Guru'),/administrator/);assert.equal(logs.size,1);userProfile.role='ADMIN';});
await run('Delete preserves audit and removes record', async () => {const before={...record};await AdminAttendanceService.change(before,good,'delete','Admin A');assert.equal(record,null);assert.equal(logs.size,2);assert.equal([...logs.values()][1].metadata.photoAttached,true);assert.equal([...logs.values()][1].metadata.before.userId,undefined);});
test('Firestore backend enforces ADMIN write roles', () => {const rules=fs.readFileSync('firestore.rules','utf8');assert.match(rules,/match \/attendance\/\{attendanceId\}/);assert.match(rules,/allow update: if isAdmin\(\)/);assert.match(rules,/allow delete: if isAdmin\(\)/);});
test('Sidebar route is admin-only', () => {const sidebar=fs.readFileSync('src/components/layout/Sidebar.tsx','utf8');assert.match(sidebar,/item\.id !== 'attendance-monitor' \|\| hasRole\('ADMIN'\)/);});
test('Standalone dashboard is guarded on route', () => {const shell=fs.readFileSync('src/AuthenticatedShell.tsx','utf8');assert.match(shell,/case 'attendance-monitor'/);assert.match(shell,/hasRole\('ADMIN'\)/);});
test('Existing history restricts actions to ADMIN', () => {const view=fs.readFileSync('src/features/attendance/AttendancePreview.tsx','utf8');assert.match(view,/const canManageHistory = hasRole\('ADMIN'\)/);});
console.log(`SUCCESS ${checks} checks`);
