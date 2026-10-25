'use strict';
/** R78 regression: legacy R76 UX remains enabled while R77 crash stays fixed. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const checks = [];
const check = (description,fn) => checks.push([description,fn]);
const typesFile = 'src/types/dashboardInfo.types.ts';
const selectorFile = 'src/components/common/MobileChoiceSelect.tsx';
const nameFile = 'src/components/common/OverflowName.tsx';
const greetingFile = 'src/features/dashboard/DashboardWelcome.tsx';

for(const p of [typesFile, selectorFile, nameFile, greetingFile]){
 check(`${p} syntax TS/TSX`,()=>{
  const ast = ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(','));
 });
}
// Run R77 sanitizer directly from current source, with a fake dependency.
const compiled = ts.transpileModule(read(typesFile),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',compiled)(specifier=>{
 assert.equal(specifier,'./dashboardWelcome.types');
 return {sanitizeDashboardWelcomeConfig:()=>({})};
},mod,mod.exports);
const {sanitizeNameMarqueeConfig,sanitizeDashboardInfoConfig}=mod.exports;
for(const value of [undefined,null,{}, {enabled:false}, {durationSeconds:undefined}, {durationSeconds:NaN}, {durationSeconds:'16'}, {durationSeconds:200}]){
 check(`R77 sanitizer safe for ${JSON.stringify(value)}`,()=>{
  assert.doesNotThrow(()=>sanitizeNameMarqueeConfig(value));
  const result=sanitizeNameMarqueeConfig(value);
  assert.equal(result.durationSeconds,16);
 });
}
check('R77 preserves admin disable flag',()=>assert.equal(sanitizeNameMarqueeConfig({enabled:false}).enabled,false));
check('R77 preserves valid speeds',()=>{
 for(const durationSeconds of [8,12,16,20,28])assert.equal(sanitizeNameMarqueeConfig({durationSeconds}).durationSeconds,durationSeconds);
});
check('R77 dashboard handles legacy settings',()=>assert.equal(sanitizeDashboardInfoConfig({}).nameMarquee.durationSeconds,16));
check('R77 type keeps no dangerous non-null duration dereference',()=>assert.ok(!read(typesFile).includes('value!.durationSeconds!')));
check('Login still uses sanitized public option',()=>assert.match(read('src/server/routes/authRoutes.ts'),/publicNameMarquee: sanitizeNameMarqueeConfig\(data\.dashboardInfoConfig\?\.nameMarquee\)/));
check('Dashboard admin settings retained',()=>assert.match(read('src/features/settings/DashboardInfoSettingsCard.tsx'),/Aktifkan teks berjalan nama panjang/));
check('Login mobile name still uses OverflowName',()=>assert.match(read('src/features/auth/LoginPage.tsx'),/<OverflowName name=\{selectedUser\.fullName\}/));
check('Welcome line keeps separate Pause control',()=>assert.match(read('src/index.css'),/\.dashboard-welcome > \.welcome-message-pause-hero \{ grid-column: 2; grid-row: 2/));
check('Dashboard welcomes names after webfonts load',()=>assert.match(read(greetingFile),/fonts\.ready\.then/));
check('Dashboard cleans font loading handler',()=>assert.match(read(greetingFile),/fonts\?\.removeEventListener\?\.\('loadingdone'/));
check('Disabled marquee displays full names',()=>assert.match(read('src/index.css'),/\.overflow-name\[data-wrap="true"\] \.overflow-name-copy \{ white-space: normal; overflow-wrap: anywhere/));
check('Reduced-motion names display full text',()=>assert.match(read('src/index.css'),/\.overflow-name \.overflow-name-clone \{ display: none;/));
check('Picker invalid required selection opens mobile chooser',()=>assert.match(read(selectorFile),/onInvalid=\{handleInvalid\}/));
check('Picker rejects disabled options',()=>assert.match(read(selectorFile),/disabled \|\| !selected \|\| selected\.disabled/));
check('Picker displays disabled state',()=>assert.match(read(selectorFile),/isOpen=\{open && !disabled\}/));
check('Picker keeps desktop native control',()=>assert.match(read(selectorFile),/hidden sm:block/));
check('Photo watermark remains concise',()=>assert.match(read('src/features/student-tardiness/StudentTardyFormModal.tsx'),/Foto dilengkapi watermark otomatis\./));
check('Camera no longer repeats subtitle',()=>assert.match(read('src/components/camera/CameraCaptureModal.tsx'),/watermarkProcessor && !prepareCapture && !subtitle/));
// Compile and invoke MobileChoiceSelect with a lightweight fake JSX runtime to
// prove option values and existing form callbacks are unchanged (no Firebase).
check('Mobile picker preserves existing enum value and rejects disabled choices',()=>{
 const source=ts.transpileModule(read(selectorFile),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const hook = {setCalls:[]};
 const react={
  Fragment:Symbol('Fragment'),
  useMemo:fn=>fn(),useState:initial=>[initial,v=>hook.setCalls.push(v)],useEffect:()=>{},
  Children:{forEach:(children,fn)=>Array.isArray(children)?children.forEach(fn):children!==undefined?fn(children):null},
  isValidElement:child=>Boolean(child&&typeof child==='object'&&child.type&&child.props),
 };
 const jsx=(type,props)=>({type,props});
 const sandbox={exports:{}};
 const fakeRequire=specifier=>{
  if(specifier==='react')return {...react,default:react};
  if(specifier==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:react.Fragment};
  if(specifier==='./Modal')return {Modal:'Modal'};
  if(specifier==='../icons')return {Check:'Check',ChevronDown:'ChevronDown'};
  throw new Error(`Unexpected import ${specifier}`);
 };
 vm.runInNewContext('(function(require,module,exports){'+source+'})',{console})(fakeRequire,sandbox,sandbox.exports);
 const events=[];
 const opts=[jsx('option',{value:'VALID',children:'Pilihan valid'}),jsx('option',{value:'DISABLED',disabled:true,children:'Tidak bisa dipilih'})];
 const tree=sandbox.exports.MobileChoiceSelect({mobileTitle:'Kategori',children:opts,value:'VALID',onChange:ev=>events.push(ev.target.value),className:'w-full'});
 const modal=tree.props.children[2];
 assert.equal(modal.type,'Modal');
 const choices=modal.props.children.props.children;
 choices[1].props.onClick();
 assert.equal(events.length,0);
 choices[0].props.onClick();
 assert.deepEqual(events,['VALID']);
});
(async()=>{
 let successes=0;
 for(const [description,fn] of checks){
  try{await fn();successes++;console.log('PASS',description)}
  catch(e){console.error('FAIL',description,e.message);process.exitCode=1;}
 }
 console.log(`R78 regression: ${successes}/${checks.length} passed`);
})();
