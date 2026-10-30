import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); }
catch { console.error('Instal dependensi proyek terlebih dahulu agar test TypeScript bisa dijalankan.'); process.exit(1); }

const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};
for (const name of [
  'src/features/dashboard/DashboardView.tsx',
  'src/features/dashboard/RosterTeacherAvatar.tsx',
  'src/features/dashboard/rosterPhotoLookup.ts',
  'src/components/common/UserAvatar.tsx',
  'src/services/profile/profilePhotoService.ts',
  'src/server/routes/profilePhotoRoutes.ts',
]) {
  check(`Sintaks TypeScript: ${name}`, () => {
    const result = ts.transpileModule(read(name), { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  });
}
const utilPath = 'src/features/dashboard/rosterPhotoLookup.ts';
const moduleObj = { exports: {} };
vm.runInNewContext(ts.transpileModule(read(utilPath), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: moduleObj, exports: moduleObj.exports, require }, { filename: utilPath });
const { rosterCandidateIds, rosterUnresolvedNames, resolveRosterPhoto, ROSTER_PHOTO_MAX_RECORDS } = moduleObj.exports;
const roster = [
  { id: 'a', petugasId: 'teacher-1', petugasName: 'Ibu Nur Wafiroh' },
  { id: 'b', petugasId: 'user-2', petugasName: 'Pak Ahmad' },
  { id: 'c', petugasId: 'teacher-1', petugasName: 'Ibu Nur Wafiroh' },
];
const teachers = [{ id: 'teacher-1', userId: 'user-1', fullName: 'Ibu Nur Wafiroh' }];
const staff = [];
const users = [
  { id: 'user-1', fullName: 'Ibu Nur Wafiroh', avatarUrl: '/api/drive/profile-photo/user-1/abc', isActive: true },
  { id: 'user-2', fullName: 'Pak Ahmad', avatarUrl: null, isActive: true },
];
check('Legacy master teacher ID resolves to user ID', () => assert.ok(rosterCandidateIds(roster, teachers, staff).includes('user-1')));
check('Duplicate duty shifts do not multiply user ID queries', () => assert.equal(rosterCandidateIds(roster, teachers, staff).filter(id => id === 'user-1').length, 1));
check('Existing user photo matches legacy schedule', () => assert.equal(resolveRosterPhoto(roster[0], users, teachers, staff), '/api/drive/profile-photo/user-1/abc'));
check('Missing photo falls back to initials', () => assert.equal(resolveRosterPhoto(roster[1], users, teachers, staff), null));
check('Unresolved name query excludes users already found by ID', () => assert.equal(rosterUnresolvedNames(roster, users, teachers, staff).length, 0));
check('Unresolved legacy name can still be queried', () => assert.equal(rosterUnresolvedNames([{ id:'d', petugasId:'missing', petugasName:'Bu Sari' }], users, teachers, staff)[0], 'Bu Sari'));
check('Only bounded number of document IDs queried', () => assert.ok(rosterCandidateIds(Array.from({length:300}, (_,i)=>({petugasId:'user-'+i,petugasName:'Guru '+i})), [], []).length <= ROSTER_PHOTO_MAX_RECORDS));
check('Inactive profiles do not expose photo', () => assert.equal(resolveRosterPhoto(roster[0], [{...users[0], isActive:false}], teachers, staff), null));
check('Two accounts with identical full names cannot show the wrong photo', () => assert.equal(resolveRosterPhoto({petugasId:'missing',petugasName:'Pak Ahmad'}, [{...users[1],avatarUrl:'/image/1'},{...users[1],id:'duplicate',avatarUrl:'/image/2'}], [], []), null));

const dashboard = read('src/features/dashboard/DashboardView.tsx');
const avatar = read('src/features/dashboard/RosterTeacherAvatar.tsx');
const userAvatar = read('src/components/common/UserAvatar.tsx');
const service = read('src/services/profile/profilePhotoService.ts');
const server = read('src/server/routes/profilePhotoRoutes.ts');
check('Photo reads are gated by open roster modal', () => assert.match(dashboard, /if \(!isRosterModalOpen\) \{ setRosterPhotoUsers\(\[\]\); return; \}/));
check('Roster queries document IDs in small batches', () => assert.match(dashboard, /where\(documentId\(\), 'in', candidateIds\.slice\(/));
check('Roster does not subscribe to whole users collection', () => assert.doesNotMatch(dashboard, /subscribeToCollection<UserProfile>\('users'/));
check('No images requested until row enters viewport', () => assert.match(avatar, /IntersectionObserver/));
check('Thumbnail is opted in on roster only', () => assert.match(avatar, /<UserAvatar thumbnail /));
check('Existing avatar users retain original image by default', () => assert.match(userAvatar, /thumbnail = false/));
check('Thumbnail downloads are separated in memoized image cache', () => assert.match(service, /\$\{uid\}:\$\{variant\}:\$\{path\}/));
check('Private endpoint checks active user and current avatar', () => assert.match(server, /data\?\.avatarUrl !== photoPath/));
check('Thumbnail endpoint never uses arbitrary user-supplied Drive file id', () => assert.match(server, /const thumbId = data\?\.loginAvatarThumbFileId/));
check('No changes to GPS/attendance modules', () => assert.doesNotMatch(dashboard, /adminCorrection\s*:/));
console.log(`\n${passed}/${passed} PASS`);
