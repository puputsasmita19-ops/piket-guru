const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');

const source = file => fs.readFileSync(file,'utf8');
const checks = [];
const test = (name,fn) => checks.push([name,fn]);
const contains = (file,regex) => assert.match(source(file),regex);

test('Thumbnail has 128px hard edge',()=>contains('src/config/profilePhotoPolicy.ts',/LOGIN_THUMB_EDGE = 128/));
test('Public thumb has 30 KB max',()=>contains('src/config/profilePhotoPolicy.ts',/LOGIN_THUMB_MAX_BYTES = 30 \* 1024/));
test('Original photo 512px remains unchanged',()=>contains('src/config/profilePhotoPolicy.ts',/PROFILE_PHOTO_EDGE = 512/));
test('Thumbnail generated from approved cropped canvas',()=>contains('src/services/profile/profilePhotoCompression.ts',/thumbContext\.drawImage\(canvas, 0, 0, LOGIN_THUMB_EDGE, LOGIN_THUMB_EDGE\)/));
test('Photo upload includes thumbnail bytes',()=>contains('src/features/users/ProfilePhotoModal.tsx',/photo!\.thumbnailDataUrl/));
test('Admin required to upload photos',()=>contains('src/server/routes/profilePhotoRoutes.ts',/profilePhotoRouter\.post\('\/profile-photo\/:userId', requireAuth, requireAdmin/));
test('Server validates thumbnail dimension',()=>contains('src/server/routes/profilePhotoRoutes.ts',/validateLoginThumbnailJpeg\(thumbnailDataUrl\)/));
test('Separate idempotent Drive file',()=>contains('src/server/routes/profilePhotoRoutes.ts',/clientPhotoId: 'login-thumb-'/));
test('Firestore saves thumbnail id on upload',()=>contains('src/server/routes/profilePhotoRoutes.ts',/loginAvatarThumbFileId: thumbnailResult\?\.fileId \|\| null/));
test('Removing profile deletes public pointer',()=>contains('src/server/routes/profilePhotoRoutes.ts',/avatarUrl: null, loginAvatarVisible: false, loginAvatarThumbFileId: null/));
test('New upload revokes public visibility',()=>contains('src/server/routes/profilePhotoRoutes.ts',/avatarUrl, loginAvatarVisible: false/));
test('Public endpoint requires active account/opt-in/current original file',()=>contains('src/server/routes/profilePhotoRoutes.ts',/data\?\.isActive !== true \|\| data\?\.loginAvatarVisible !== true \|\| data\?\.avatarUrl !== photoPath\(uid, fileId\)/));
test('Only after permission validation resolves thumb',()=>{
 const s=source('src/server/routes/profilePhotoRoutes.ts');
 const a=s.indexOf('profilePhotoRouter.get(\'/login-avatar/');
 const block=s.slice(a);
 assert.ok(block.indexOf('data?.loginAvatarVisible !== true') < block.indexOf('const thumbId = data.loginAvatarThumbFileId'));
});
test('Public route remains no-store to allow immediate revocation',()=>contains('src/server/routes/profilePhotoRoutes.ts',/profilePhotoRouter\.get\('\/login-avatar\/.*?\n  res\.setHeader\('Cache-Control', 'no-store'\)/s));
test('Legacy images still work',()=>contains('src/server/routes/profilePhotoRoutes.ts',/getPhotoStream\(useThumbnail \? thumbId : fileId\)/));
test('Only selected profile image loaded',()=>contains('src/features/auth/LoginPage.tsx',/<LoginAvatar user=\{selectedUser\}/));
test('Login UI fallback neutral icon',()=>contains('src/features/auth/LoginAvatar.tsx',/<User aria-hidden/));

const changedTs = [
 'src/config/profilePhotoPolicy.ts',
 'src/services/profile/profilePhotoCompression.ts',
 'src/server/services/profilePhotoValidation.ts',
 'src/server/routes/profilePhotoRoutes.ts',
 'src/services/profile/profilePhotoService.ts',
 'src/features/users/ProfilePhotoModal.tsx',
];
for(const file of changedTs) test(`TypeScript syntax ${file}`,()=>{
 const result=ts.transpileModule(source(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
});

// Execute validation function with actual JPEG bytes, using only the global Sharp
// fixture generator. No Firebase/Drive access; verifies corrupted/oversize/wrong
// dimensions are rejected before any upload.
test('Strict JPEG thumbnail validator with real image bytes',async()=>{
 const sharp = require('sharp');
 const validation = ts.transpileModule(source('src/server/services/profilePhotoValidation.ts'),{
  fileName:'profilePhotoValidation.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const local = {exports:{}};
 const constants={PROFILE_PHOTO_EDGE:512,PROFILE_PHOTO_MAX_BYTES:150*1024,LOGIN_THUMB_EDGE:128,LOGIN_THUMB_MAX_BYTES:30*1024};
 const fn = new Function('require','module','exports','Buffer',validation);
 fn((name)=>{
  if(name==='../../config/profilePhotoPolicy.js')return constants;
  throw new Error('Unexpected import:'+name);
 },local,local.exports,Buffer);
 const validate=local.exports.validateLoginThumbnailJpeg;
 const valid = await sharp({create:{width:128,height:128,channels:3,background:{r:110,g:155,b:205}}}).jpeg({quality:78}).toBuffer();
 assert.deepEqual(validate(`data:image/jpeg;base64,${valid.toString('base64')}`),valid);
 const largeEdge=await sharp({create:{width:300,height:300,channels:3,background:{r:110,g:155,b:205}}}).jpeg().toBuffer();
 assert.throws(()=>validate(`data:image/jpeg;base64,${largeEdge.toString('base64')}`),/Dimensi JPEG/);
 assert.throws(()=>validate('data:image/png;base64,AA=='),/Foto harus JPEG/);
 assert.throws(()=>validate('data:image/jpeg;base64,AA=='),/Berkas JPEG tidak valid/);
});

(async()=>{
 let passed=0;
 for(const [name,fn] of checks){
  try {await fn();console.log('PASS',++passed,name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}
 }
 console.log(`R52 checks: ${passed}/${checks.length} passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
