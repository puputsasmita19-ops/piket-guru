'use strict';
/** R58: Pure transformation of Firestore Security Rules. Never deploys or mutates original. */
const assert = require('node:assert/strict');
const MARKER = '// R58 OWNERSHIP/INTEGRITY HARDENING — candidate; emulator approval required.';

function once(source, oldText, newText, label) {
  const matches = source.split(oldText).length - 1;
  if (matches !== 1) throw Error(`R58 STOPPED SAFELY: ${label}: expected 1 known block, got ${matches}. Rules may differ. No changes.`);
  return source.replace(oldText,newText);
}
function replaceCollection(source, collection, oldBlock, newBlock) {
  const tag = `match /${collection}/{`;
  const position = source.indexOf(tag);
  if (position < 0 || source.indexOf(tag, position+tag.length) >= 0) throw Error(`R58 STOPPED SAFELY: unknown/duplicate collection ${collection}`);
  // Scoped region: close at the next top-level match declaration or next numbered comment.
  const end = source.indexOf('\n    match /', position + tag.length);
  const partEnd = end === -1 ? source.length : end;
  const original = source.slice(position,partEnd);
  const patched = once(original,oldBlock,newBlock,`${collection} permission block`);
  return source.slice(0,position)+patched+source.slice(partEnd);
}
function transform(input) {
  if (input.includes(MARKER)) throw Error('R58 STOPPED SAFELY: candidate already patched; refuse duplicate update.');
  if (!input.startsWith("rules_version = '2';") || !input.includes('isValidActiveUser()') || !input.includes('function isAdmin()')) {
    throw Error('R58 STOPPED SAFELY: unfamiliar Firestore Rules header / role helpers.');
  }
  if (!input.includes('match /auditLogs/{logId} {')) throw Error('R58 STOPPED SAFELY: auditor document-ID binding differs.');
  let s = input;
  // Audit records from untrusted client remain client assertions, not authoritative
  // forensic logs. Prevent straightforward identity and role impersonation on CREATE.
  s = replaceCollection(s,'auditLogs',
    `      allow create: if isValidActiveUser();\n      allow update, delete: if false;`,
    `      // R58: a client cannot claim another user/role or write a log under a foreign ID.\n      // NOTE: descriptive fields remain client-provided/untrusted. Server audit is higher trust.\n      allow create: if isValidActiveUser() &&\n        request.resource.data.keys().hasAll(['id', 'userId', 'role', 'timestamp', 'action', 'module', 'details']) &&\n        request.resource.data.id == logId &&\n        request.resource.data.userId == request.auth.uid &&\n        request.resource.data.role == userRole() &&\n        request.resource.data.timestamp is string &&\n        request.resource.data.timestamp.matches('[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\\\.[0-9]{3}Z') &&\n        request.resource.data.action is string && request.resource.data.action.size() <= 48 &&\n        request.resource.data.module is string && request.resource.data.module.size() <= 48 &&\n        request.resource.data.details is string && request.resource.data.details.size() <= 2000;\n      allow update, delete: if false;`);
  // Four user-generated operational collections: owner creates/updates, Admin manages all.
  s = replaceCollection(s,'substitutions',
    `      allow create, update: if isStaff();\n      allow delete: if isAdmin();`,
    `      allow create: if isAdmin() || (isStaff() && request.resource.data.petugasPiketId == request.auth.uid);\n      allow update: if isAdmin() || (isStaff() && resource.data.petugasPiketId == request.auth.uid &&\n        request.resource.data.petugasPiketId == resource.data.petugasPiketId &&\n        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['id', 'createdAt', 'createdBy', 'dataSource', 'isDemo']));\n      allow delete: if isAdmin();`);
  s = replaceCollection(s,'studentTardiness',
    `      allow create: if isStaff();\n      // Admin can update all fields including correction; non-admin staff can only update standard records without altering admin correction fields\n      allow update: if isValidActiveUser() && (\n        isAdmin() ||\n        (\n          isStaff() &&\n          !request.resource.data.diff(resource.data).affectedKeys().hasAny(['isCorrectedByAdmin', 'adminCorrection', 'menitTerlambatAsli']) &&\n          resource.data.get('isCorrectedByAdmin', false) == false\n        )\n      );\n      allow delete: if isAdmin();`,
    `      allow create: if isAdmin() || (isStaff() && request.resource.data.petugasPiketId == request.auth.uid);\n      // Correction metadata is Admin-only. Regular staff can update only records they created.\n      allow update: if isAdmin() || (\n        isStaff() &&\n        resource.data.petugasPiketId == request.auth.uid &&\n        request.resource.data.petugasPiketId == resource.data.petugasPiketId &&\n        !request.resource.data.diff(resource.data).affectedKeys().hasAny([\n          'id', 'createdAt', 'createdBy', 'dataSource', 'isDemo',\n          'isCorrectedByAdmin', 'adminCorrection', 'menitTerlambatAsli'\n        ]) && resource.data.get('isCorrectedByAdmin', false) == false\n      );\n      allow delete: if isAdmin();`);
  for (const collection of ['studentPermits','visitors']) {
    s = replaceCollection(s, collection,
      `      allow create, update: if isStaff();\n      allow delete: if isAdmin();`,
      `      allow create: if isAdmin() || (isStaff() && request.resource.data.petugasPiketId == request.auth.uid);\n      allow update: if isAdmin() || (isStaff() && resource.data.petugasPiketId == request.auth.uid &&\n        request.resource.data.petugasPiketId == resource.data.petugasPiketId &&\n        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['id', 'createdAt', 'createdBy', 'dataSource', 'isDemo']));\n      allow delete: if isAdmin();`);
  }
  // Approvers may change status/approval metadata, but not teacher's journal body.
  const beforeApprover=`          hasDutyBookApprovePerm() &&\n          (`;
  const afterApprover=`          hasDutyBookApprovePerm() &&\n          !request.resource.data.diff(resource.data).affectedKeys().hasAny([\n            'id', 'petugasId', 'petugasName', 'tanggal', 'kondisiKeamanan',\n            'kondisiKebersihan', 'kondisiKelas', 'kondisiFasilitas', 'kondisiSiswa',\n            'catatanPiket', 'createdAt', 'createdBy', 'dataSource', 'isDemo'\n          ]) &&\n          (`;
  s=replaceCollection(s,'dutyBooks',beforeApprover,afterApprover);
  // Insert marker only after every anchor has been safely validated.
  s=once(s,"rules_version = '2';", "rules_version = '2';\n"+MARKER, 'rules header');
  assert(s.includes(MARKER));
  return s;
}
module.exports={transform,MARKER};
