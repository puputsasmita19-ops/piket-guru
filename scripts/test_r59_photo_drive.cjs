'use strict';
const fs=require('node:fs'); const path=require('node:path');const assert=require('node:assert/strict');const vm=require('node:vm');const os=require('node:os');const cp=require('node:child_process');
const ts=require('typescript');const {transformImage,transformDriveRoutes,transformDriveStore}=require('./r59_transform.cjs');
const here=path.resolve(__dirname,'..'); const root=process.cwd();let passed=0;
function test(name,fn){fn();console.log(`PASS ${++passed}: ${name}`)}
function source(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
function parseTs(input,file){const fileAst=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(fileAst.parseDiagnostics.length,0,fileAst.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join(';'))}
const helper=fs.readFileSync(path.join(here,'scripts/r59_templates/photoUploadValidation.ts'),'utf8');
test('template validator parses as TypeScript',()=>parseTs(helper,'validator.ts'));
const validationJs=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={exports:{}, Buffer};vm.runInNewContext(validationJs,env);const decoder=env.exports.decodeDrivePhotoUpload;
const jpeg=Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(10)]);
const webp=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.alloc(12)]);
function validate(b,mime,ext='jpeg'){return decoder(`data:image/${ext};base64,${b.toString('base64')}`,mime)}
test('valid JPEG accepted',()=>assert.equal(validate(jpeg,'image/jpeg').buffer.length,jpeg.length));
test('valid old watermark tag accepted',()=>assert.equal(decoder(`data:image/jpeg;base64,${jpeg.toString('base64')}#wtmk_v1`,undefined).buffer.length,jpeg.length));
test('raw JPEG base64 accepted',()=>assert.equal(decoder(jpeg.toString('base64'),undefined).mimeType,'image/jpeg'));
test('PNG supported without transcoding',()=>assert.equal(validate(png,'image/png','png').mimeType,'image/png'));
test('WebP supported without transcoding',()=>assert.equal(validate(webp,'image/webp','webp').mimeType,'image/webp'));
test('MIME spoof rejected',()=>assert.throws(()=>validate(jpeg,'image/png'),/MIME/));
test('wrong binary magic rejected',()=>assert.throws(()=>decoder(Buffer.alloc(24).toString('base64'),undefined),/File bukan/));
test('malformed base64 rejected',()=>assert.throws(()=>decoder('zz$$==',undefined),/Base64|Ukuran/));
test('too large request rejected before decoding',()=>assert.throws(()=>decoder('A'.repeat(14_000_000),undefined),/10 MB/));
test('invalid data header rejected',()=>assert.throws(()=>decoder(`data:text/html;base64,${jpeg.toString('base64')}`,undefined),/Format data/));
test('noncanonical base64 rejected',()=>assert.throws(()=>decoder(`${jpeg.toString('base64').slice(0,-1)}A`,undefined),/rusak|Base64/));
const fImg='src/components/common/AuthenticatedImage.tsx',fRoute='src/server/routes/driveRoutes.ts',fStore='src/server/services/driveStore.ts';
const img=source(fImg),route=source(fRoute),store=source(fStore);
const installed=img.includes('R59_PHOTO_OPTIMIZED')&&route.includes('R59_PHOTO_OPTIMIZED');
const transformedImage=installed?img:transformImage(img);
const transformedRoute=installed?route:transformDriveRoutes(route);
const transformedStore=installed?store:transformDriveStore(store);
test('image patch TypeScript syntax',()=>parseTs(transformedImage,'AuthenticatedImage.tsx'));
test('route patch TypeScript syntax',()=>parseTs(transformedRoute,'driveRoutes.ts'));
test('DriveStore patch TypeScript syntax',()=>parseTs(transformedStore,'driveStore.ts'));
test('uploaded file extension respects validated MIME',()=>assert.match(transformedStore,/options\.mimeType === 'image\/png'/));
test('lazy image fetch requires visibility',()=>assert.match(transformedImage,/if \(!src \|\| !isVisible\)/));
test('image observer supports browser fallback',()=>assert.match(transformedImage,/typeof IntersectionObserver === 'undefined'/));
test('image requests can be aborted on unmount',()=>assert.match(transformedImage,/controller\.abort\(\)/));
test('route validates prior to Drive upload',()=>assert.ok(transformedRoute.indexOf('decodeDrivePhotoUpload(base64, mimeType)')<transformedRoute.indexOf('await DriveStore.uploadPhoto')));
test('route rejects malformed requests with 400',()=>assert.match(transformedRoute,/err instanceof PhotoUploadValidationError/));
test('route checks idempotency identifier',()=>assert.match(transformedRoute,/clientPhotoId !== undefined/));
test('proxy cancels upstream download on close',()=>assert.match(transformedRoute,/photoData\.stream\.destroy\(\)/));
test('authenticated photo endpoint still checks Firebase tokens',()=>assert.match(transformedRoute,/adminAuth\.verifyIdToken\(token\)/));
test('upload route still enforces logged-in user',()=>assert.match(transformedRoute,/post\('\/upload', requireAuth/));
if (installed) {
 test('installed template matches project',()=>assert.ok(fs.existsSync(path.join(root,'src/server/services/photoUploadValidation.ts'))));
} else {
 // Installer smoke tests on the current source copied to a disposable directory.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'r59-install-'));
 try {
  for(const f of ['package.json', fImg,fRoute,fStore]){const dest=path.join(temp,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest)}
  fs.mkdirSync(path.join(temp,'scripts/r59_templates'),{recursive:true});
  for(const f of ['apply_r59_photo_drive.cjs','r59_transform.cjs'])fs.copyFileSync(path.join(__dirname,f),path.join(temp,'scripts',f));
  fs.copyFileSync(path.join(__dirname,'r59_templates/photoUploadValidation.ts'),path.join(temp,'scripts/r59_templates/photoUploadValidation.ts'));
  const call=(...args)=>cp.spawnSync(process.execPath,['scripts/apply_r59_photo_drive.cjs',...args],{cwd:temp,encoding:'utf8'});
  const initial=source(fImg);
  test('dry run succeeds',()=>assert.equal(call('--dry-run').status,0));
  test('dry run does not mutate source',()=>assert.equal(fs.readFileSync(path.join(temp,fImg),'utf8'),initial));
  test('safe installer succeeds',()=>assert.equal(call().status,0));
  test('repeated install rejected',()=>assert.notEqual(call().status,0));
  test('deployed upload validator created',()=>assert.ok(fs.existsSync(path.join(temp,'src/server/services/photoUploadValidation.ts'))));
  // Incompatible source must fail before editing ANY file.
  const incompatible=fs.mkdtempSync(path.join(os.tmpdir(),'r59-incompatible-'));
  try {
    for(const f of ['package.json',fImg,fRoute,fStore]) {const dest=path.join(incompatible,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest)}
    fs.mkdirSync(path.join(incompatible,'scripts/r59_templates'),{recursive:true});
    for(const f of ['apply_r59_photo_drive.cjs','r59_transform.cjs']) fs.copyFileSync(path.join(__dirname,f),path.join(incompatible,'scripts',f));
    fs.copyFileSync(path.join(__dirname,'r59_templates/photoUploadValidation.ts'),path.join(incompatible,'scripts/r59_templates/photoUploadValidation.ts'));
    const target=path.join(incompatible,fRoute);
    fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('    // Strip Base64 header prefix if present','    // Code changed since R57'));
    const beforeImage=fs.readFileSync(path.join(incompatible,fImg),'utf8');
    const result=cp.spawnSync(process.execPath,['scripts/apply_r59_photo_drive.cjs'],{cwd:incompatible,encoding:'utf8'});
    test('incompatible R58 source rejected safely',()=>assert.notEqual(result.status,0));
    test('rejected install never modifies image component',()=>assert.equal(fs.readFileSync(path.join(incompatible,fImg),'utf8'),beforeImage));
    test('rejected install never creates helper',()=>assert.ok(!fs.existsSync(path.join(incompatible,'src/server/services/photoUploadValidation.ts'))));
  }finally{fs.rmSync(incompatible,{recursive:true,force:true})}

 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
console.log(`R59: ${passed}/${passed} checks PASSED`);
