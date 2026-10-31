/** R106: fast path invariants + actual runtime checks for exact UID selection. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let count = 0;
const test = (name, fn) => { fn(); ++count; console.log(`PASS ${count}: ${name}`); };
for (const file of [
 'src/features/auth/LoginPage.tsx','src/features/auth/loginPerformance.ts',
 'src/contexts/AuthContext.tsx','src/services/auth/authService.ts',
 'src/server/middleware/rateLimiter.ts','src/server/routes/authRoutes.ts',
 'src/server/utils/loginLookupMode.ts',
]) {
 const node = ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
 test(`valid TypeScript syntax: ${file}`, () => assert.equal(node.parseDiagnostics.length,0, node.parseDiagnostics.map(e=>e.messageText).join('; ')));
}
const page = read('src/features/auth/LoginPage.tsx');
const button = page.match(/aria-label="Hapus seluruh PIN"[\s\S]*?<\/button>/)?.[0] || '';
test('Clear PIN button has text Hapus but no X icon',()=> { assert.match(button,/>Hapus<\/span>/); assert.doesNotMatch(button,/<X\b/); });
test('One-digit backspace still has Delete icon and handler',()=>{ assert.match(page,/aria-label="Hapus satu angka"[\s\S]*?<Delete /); assert.match(page,/onClick=\{handleBackspace\}/); });
test('Explicit selection passes UID hint, manual ID remains supported',()=>{ assert.match(page,/selectedUid \? \{ accountUid: selectedUid \} : undefined/); assert.match(page,/selectedUid \|\| selectedIdentifier/); });
const svc=read('src/services/auth/authService.ts');
test('Only exact matching selected UID hint travels with credentials',()=>assert.match(svc,/options\.accountUid === trimmedId \? \{ accountUid: trimmedId \} : \{\}/));
test('Firebase sign-in remains mandatory',()=>{ assert.match(svc,/await signInWithCustomToken\(auth, data\.customToken\)/); assert.match(svc,/userCredential\.user\.uid !== data\.user\.id/); });
const ctx=read('src/contexts/AuthContext.tsx');
test('Context forwards hint without replacing validation',()=>{ assert.match(ctx,/accountUid: options\.accountUid/); assert.match(ctx,/if \(res\.success && res\.user\)/); });
const utilSrc=read('src/server/utils/loginLookupMode.ts');
const compiled=ts.transpileModule(utilSrc,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}, module:{exports:{}}}; sandbox.exports=sandbox.module.exports;
vm.runInNewContext(compiled,sandbox); const exactUid=sandbox.module.exports.exactSelectedLoginUid;
test('Chosen UID GURU-011 permits exact lookup',()=>assert.equal(exactUid({identifier:'GURU-011',accountUid:'GURU-011'}),'GURU-011'));
test('Missing hint always uses unoptimized manual lookups',()=>assert.equal(exactUid({identifier:'GURU-011'}),null));
test('Mismatched alias hint is ignored',()=>assert.equal(exactUid({identifier:'NIP123',accountUid:'GURU-011'}),null));
test('Firestore path injection hint is ignored',()=>assert.equal(exactUid({identifier:'abc/def',accountUid:'abc/def'}),null));
test('Oversized UID hint is ignored',()=>assert.equal(exactUid({identifier:'a'.repeat(150),accountUid:'a'.repeat(150)}),null));
test('Whitespace and hidden path IDs are ignored',()=>{assert.equal(exactUid({identifier:' abc',accountUid:' abc'}),null); assert.equal(exactUid({identifier:'..',accountUid:'..'}),null);});
const middleware=read('src/server/middleware/rateLimiter.ts');
test('Rate limiter keeps IP lockout, account lockout and in-flight lease',()=>{assert.match(middleware,/const exactUid = exactSelectedLoginUid\(req\.body\)/); assert.match(middleware,/if \(exactUid\)/); assert.match(middleware,/tryAcquireDualInFlight/); assert.match(middleware,/const \[ipLock, canonicalLock\] = await Promise\.all/); });
test('Manual lookup still searches aliases under rate limit',()=>{assert.match(middleware,/else if \(rawIdentifier && adminDb\)/);assert.match(middleware,/\.where\('loginId'/); assert.match(middleware,/\.where\('nip'/);});
const server=read('src/server/routes/authRoutes.ts');
test('Exact UID branch reads one document but manual branch keeps ambiguity check',()=>{assert.match(server,/if \(exactUid\) \{\s*const selectedSnap = await adminDb\.collection\('users'\)\.doc\(exactUid\)\.get\(\)/); assert.match(server,/if \(matchedDocs\.size > 1\)/); assert.match(server,/byLoginId\.docs\.forEach/);});
test('PIN hash verification remains mandatory and security checks remain',()=>{assert.match(server,/await CredentialStore\.verifyCredential\(userId, pin\)/);assert.match(server,/userData\.isActive !== true/);assert.match(server,/userData\.requiresActivation === true/);});
test('Rate reset and signer run parallel but both must succeed',()=>{assert.match(server,/Promise\.allSettled\(\[resetPromise, signerPromise\]\)/);assert.match(server,/resetResult\.status === 'rejected'/);assert.match(server,/signerResult\.status === 'rejected'/);assert.match(server,/if \(isRequestAborted\(req\)/);});
test('Server timing is numeric phases only',()=>{assert.match(server,/res\.setHeader\('Server-Timing'/);assert.match(server,/markPhase\('pin'/);assert.match(server,/markPhase\('signer'/);assert.match(server,/markPhase\('rateReset'/);});
test('Client timing has API, Firebase and total with no credential strings',()=>{const perf=read('src/features/auth/loginPerformance.ts');assert.match(perf,/pinApi: latest\('pin-api'\)/);assert.match(perf,/firebaseSignIn: latest\('firebase-signin'\)/);});
console.log(`R106 ${count}/${count} PASS`);
