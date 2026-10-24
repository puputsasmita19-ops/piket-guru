/** R74 — checks the Admin-only bulk permission entry point on the actual project. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(root, 'src/features/users/UserManagementView.tsx'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'src/features/users/BulkPermissionsModal.tsx'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'src/features/users/UsersPreview.tsx'), 'utf8');
const rules = fs.existsSync(path.join(root, 'firestore.rules')) ? fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') : '';
let passed = 0;
function check(title, fn) {
  try { fn(); passed++; console.log('PASS', title); }
  catch (e) { console.error('FAIL', title, '-', e.message); process.exitCode = 1; }
}
function matches(code, pattern) { assert.match(code, pattern); }

check('Entry point imports existing bulk permission modal', () => matches(view, /import \{ BulkPermissionsModal \} from '\.\/BulkPermissionsModal';/));
check('Bulk modal state initially closed', () => matches(view, /\[isBulkPermissionsOpen, setIsBulkPermissionsOpen\] = useState\(false\)/));
check('Action button has recognizable label', () => matches(view, />\s*Hak Akses Massal\s*<\/Button>/));
check('Button sets modal open state', () => matches(view, /onClick=\{\(\) => setIsBulkPermissionsOpen\(true\)\}/));
check('Button guarded inside Admin-only user actions', () => {
  const start = view.indexOf('{isAdmin && (', view.indexOf('const isAdmin'));
  const action = view.indexOf('Hak Akses Massal', start);
  const studentBranch = view.indexOf(') : (', start);
  assert.ok(start !== -1 && action > start && studentBranch > action);
});
check('Only visible on Guru and staff tab', () => {
  const action = view.indexOf('Hak Akses Massal');
  const branch = view.lastIndexOf('activeCategory === \'GURU\' ?', action);
  assert.ok(branch !== -1 && branch < action);
});
check('Admin-only guard also protects modal render', () => matches(view, /\{isAdmin && \(\s*<BulkPermissionsModal/));
check('Modal receives users from real-time source', () => matches(view, /<BulkPermissionsModal[\s\S]*?users=\{users\}/));
check('Modal receives authenticated actor', () => matches(view, /<BulkPermissionsModal[\s\S]*?actor=\{currentUser\}/));
check('Modal supports close action', () => matches(view, /onClose=\{\(\) => setIsBulkPermissionsOpen\(false\)\}/));
check('Existing account management button kept', () => matches(view, />\s*\+ Tambah Pengguna\s*<\/Button>/));
check('Bulk import button kept', () => matches(view, />\s*Import \(\.CSV\)\s*<\/Button>/));
check('Existing per-user permission modal kept', () => matches(view, /<ApplyGuruDutyPermissionsModal/));
check('UsersPreview still mounts account management', () => matches(wrapper, /<UserManagementView\s*\/>/));
check('Bulk modal excludes ADMIN targets', () => matches(modal, /u\.role !== 'ADMIN'/));
check('Bulk modal excludes inactive and wildcard targets', () => {
  matches(modal, /u\.isActive !== false/); matches(modal, /!\(u\.permissions \|\| \[\]\)\.includes\('\*'\)/);
});
check('Bulk modal requires an Admin actor before save', () => matches(modal, /actor\.role !== 'ADMIN'/));
check('Permission set operations preserved', () => matches(modal, /transaction\.update\(ref, \{ permissions: after, updatedAt \}\)/));
check('Permission changes keep audit logging', () => matches(modal, /transaction\.set\(audit, \{/));
check('Firestore rules contain an Admin authorization guard for user updates', () => {
  if (rules) {
    matches(rules, /match \/users\/\{userId\}/);
    matches(rules, /allow update: if \(\s*isAdmin\(\)/);
  }
});
console.log(`R74: ${passed}/20 checks passed.`);
if (passed !== 20) process.exitCode = 1;
