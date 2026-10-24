#!/usr/bin/env node
'use strict';
/** Preview-first. Never deploy rules, touch firestore.rules or modify data. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { transform } = require('./r58_security_transform.cjs');
const root = process.cwd();
const defaultRules = 'public/exports/firestore_rules.txt';
const provided = process.argv.find(x=>x.startsWith('--rules='));
const rulesRel = provided ? provided.slice('--rules='.length) : defaultRules;
const dryRun = process.argv.includes('--dry-run');
const outRel = 'security-review/r58/firestore_rules_R58_CANDIDATE.txt';
function inside(relative) {
  const resolved=path.resolve(root,relative);
  if(resolved===root || !resolved.startsWith(root+path.sep))throw Error('R58 STOPPED SAFELY: invalid path');
  return resolved;
}
try {
  const filename=inside(rulesRel);
  if(!fs.existsSync(filename))throw Error(`R58 STOPPED SAFELY: source rules not found (${rulesRel}). Pass --rules=<actual-path> or verify checkout.`);
  const original=fs.readFileSync(filename,'utf8');
  const updated=transform(original);
  const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
  console.log(`R58 SOURCE: ${rulesRel}`);
  console.log(`SHA256 original: ${digest(original)}`);
  console.log(`SHA256 candidate: ${digest(updated)}`);
  console.log('Changed: auditLogs, substitutions, studentTardiness, studentPermits, visitors, dutyBooks approver');
  console.log('Original rules stay UNCHANGED. No Firebase deployment or database operation is performed.');
  if(dryRun){console.log('R58 DRY RUN PASSED — candidate can be generated.');process.exit(0)}
  const out=inside(outRel);
  if(fs.existsSync(out))throw Error('R58 STOPPED SAFELY: candidate already exists. Review first; do not overwrite.');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,updated,{flag:'wx'});
  console.log(`R58 CANDIDATE GENERATED: ${outRel}`);
  console.log('NEXT: run emulator tests before manually choosing to deploy this file.');
} catch(e) {console.error(e.message);process.exitCode=1}
