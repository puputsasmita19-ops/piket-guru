const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

let count = 0;
function test(label, callback) { callback(); count++; console.log(`PASS ${count}: ${label}`); }
const ownerFile = 'src/utils/recordOwnership.ts';
const source = fs.readFileSync(ownerFile, 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports });
const { mayEditOwnRecord, assertRecordOwner } = compiledModule.exports;
const creator = { id: 'u1', role: 'GURU' }, another = { id: 'u2', role: 'GURU' }, admin = { id: 'admin', role: 'ADMIN' };
const record = { petugasPiketId: 'u1', pelaporId: 'u1', petugasId: 'u1' };
for (const field of ['pelaporId','petugasPiketId','petugasId']) {
 test(`${field}: creator can edit`, () => assert(mayEditOwnRecord(creator, record, field)));
 test(`${field}: another user denied`, () => assert(!mayEditOwnRecord(another, record, field)));
 test(`${field}: admin can edit`, () => assert(mayEditOwnRecord(admin, record, field)));
 test(`${field}: legacy no UID denied`, () => assert(!mayEditOwnRecord(creator, { createdBy: 'Name' }, field)));
}
test('missing actor denied', () => assert(!mayEditOwnRecord(null, record, 'pelaporId')));
test('write guard throws for a nonowner', () => assert.throws(() => assertRecordOwner(another, record, 'pelaporId'), /pencatat asli/));
const rules = fs.readFileSync('firestore.rules', 'utf8');
for (const coll of ['substitutions','studentTardiness','studentPermits','visitors']) {
 test(`rules: ${coll} owner create/update`, () => {
  const block = rules.slice(rules.indexOf(`match /${coll}/`), rules.indexOf('allow delete:', rules.indexOf(`match /${coll}/`)));
  assert(block.includes("creatingOwnRecord('petugasPiketId')"));
  assert(block.includes("isRecordOwner('petugasPiketId')"));
 });
}
test('rules: incident and dutybook owner edit', () => assert(rules.includes("isRecordOwner('pelaporId')") && rules.includes("isRecordOwner('petugasId')")));
test('rules: announcement author UID', () => assert(rules.includes("isRecordOwner('authorId')")));
const bulk = fs.readFileSync('src/features/users/BulkPermissionsModal.tsx', 'utf8');
test('bulk permissions preserve existing rights and read latest', () => assert(bulk.includes('runTransaction(') && bulk.includes('transaction.get(ref)') && bulk.includes('...old, ...selectedPerms') && bulk.includes('transaction.update(ref, { permissions: after, updatedAt })')));
test('bulk permissions use audit in same transaction', () => assert(bulk.includes("collection(db, 'auditLogs')") && bulk.includes('transaction.set(audit,')));
test('bulk excludes admin and wildcard accounts', () => assert(bulk.includes("u.role !== 'ADMIN'") && bulk.includes("if (old.includes('*'))")));
const image = fs.readFileSync('src/features/incidents/IncidentDetailModal.tsx', 'utf8');
test('incident photo uses natural proportions and scroll', () => assert(image.includes('object-contain') && image.includes('h-auto') && image.includes('overflow-y-auto') && !image.includes('object-cover max-h-[70vh]')));
const changedFiles = [ownerFile,'src/features/users/BulkPermissionsModal.tsx','src/features/users/UserManagementView.tsx','src/features/incidents/IncidentDetailModal.tsx','src/features/incidents/IncidentPreview.tsx','src/features/visitors/VisitorPreview.tsx','src/features/substitutions/SubstitutionPreview.tsx','src/features/student-permits/StudentPermitsPreview.tsx','src/features/student-tardiness/StudentTardyPreview.tsx','src/features/duty-book/DutyBookPreview.tsx','src/features/dashboard/DashboardView.tsx','src/services/firebase/announcementService.ts','src/services/firebase/incidentService.ts','src/services/firebase/dutyBookService.ts','src/services/firebase/studentTardyService.ts','src/services/firebase/studentPermitService.ts','src/services/firebase/visitorService.ts','src/services/firebase/substitutionService.ts'];
for (const file of changedFiles) {
 const tree = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if (tree.parseDiagnostics.length) throw new Error(`${file}: ${tree.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
}
test('TypeScript AST parse changed sources', () => assert.equal(changedFiles.length,18));
console.log(`SUCCESS: ${count} focused checks passed. Full Firestore emulator and production build are separate requirements.`);
