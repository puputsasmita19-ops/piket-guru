'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const base = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(base, f), 'utf8');
const login = read('src/features/auth/LoginPage.tsx');
const picker = read('src/components/common/MobileChoiceSelect.tsx');
let passed=0;
const testsExpected=26;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message);process.exitCode=1}};
for(const p of ['src/features/auth/LoginPage.tsx','src/components/common/MobileChoiceSelect.tsx']) {
 test('TSX parse: '+p,()=>{const a=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);assert.equal(a.parseDiagnostics.length,0,a.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join(';'));});
 test('TSX transpilation: '+p,()=>{const r=ts.transpileModule(read(p),{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);});
}
test('Toggle group aligned at right inside one input row',()=>assert.match(login,/className="ml-auto mr-0\.5 grid grid-cols-\[52px_62px\] sm:grid-cols-\[62px_72px\]/));
test('One name mode, one manual mode',()=>{assert.equal((login.match(/aria-label="Cari berdasarkan nama"/g)||[]).length,1);assert.equal((login.match(/aria-label="Masuk dengan ID atau NIP"/g)||[]).length,1)});
test('Input appears before right-side switch in single border control',()=>{const row=login.indexOf('className="relative flex min-w-0 items-center rounded-xl');const field=login.indexOf('id="login-account-search"',row);const group=login.indexOf('aria-label="Cari menggunakan nama atau ID/NIP"',row);assert.ok(row>=0 && field>row && group>field);});
test('Both method controls keep 44px mobile touch targets',()=>assert.equal((login.match(/className=\{`inline-flex min-h-11 sm:min-h-10/g)||[]).length,2));
test('Segmented group remains compact',()=>assert.match(login,/grid-cols-\[52px_62px\] sm:grid-cols-\[62px_72px\]/));
test('Manual input cannot submit invisible unverified ID',()=>assert.match(login,/if \(!selectedUidRef\.current\) \{[\s\S]*?setSelectedIdentifier\(''\);[\s\S]*?setPin\(''\);/));
test('PIN remains 6 digits',()=>assert.match(login,/maxLength=\{6\}/));
test('Google login remains',()=>assert.match(login,/loginWithGoogle\(\)/));
test('Trusted device remains',()=>assert.match(login,/setTrustedDevice/));
test('R79 retry remains',()=>assert.match(login,/Coba Lagi<\/button>/));
test('Search key navigation remains',()=>assert.match(login,/onKeyDown=\{handleComboboxKeyDown\}/));
test('No direct Firestore added in Login',()=>assert.doesNotMatch(login,/getDocs\(|onSnapshot\(|getFirestore\(/));
test('Mobile picker handles nested JSX children text',()=>assert.match(picker,/function optionCaption\(children: React\.ReactNode\)/));
test('Option selection passes original backend code',()=>assert.match(picker,/onChange\?\.\(\{ target: \{ value: selectedValue \} \}/));
test('Desktop native select preserved',()=>assert.match(picker,/hidden sm:block/));
test('Mobile row has 48px touch height',()=>assert.match(picker,/min-h-12/));
test('Label has no underline styles',()=>assert.doesNotMatch(picker,/(?:underline|text-decoration)/));

const jsx=(type,props)=>({type,props});
const React={
  Fragment:Symbol('Fragment'),
  Children:{forEach(children,callback){const visit=x=>{if(Array.isArray(x))return x.forEach(visit);if(x!==null&&x!==undefined)callback(x);};visit(children);}},
  isValidElement:e=>e!==null&&typeof e==='object'&&'type'in e&&'props'in e,
  useEffect:()=>{},useMemo:fn=>fn(),useState:v=>[v,()=>{}],
};
const compiled=ts.transpileModule(picker,{fileName:'MobileChoiceSelect.tsx',compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleObject={exports:{}};
const importer=x=>({
  'react':{default:React,...React},
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:React.Fragment},
  './Modal':{Modal:'Modal'},
  '../icons':{Check:'Check',ChevronDown:'ChevronDown'},
}[x]??(()=>{throw new Error('Unexpected module '+x)})());
vm.runInNewContext('(function(require,module,exports){'+compiled+'})',{console})(importer,moduleObject,moduleObject.exports);
const {MobileChoiceSelect}=moduleObject.exports;
const names=[['SAKIT_PULANG','🩺','Sakit (Pulang / Rujukan UKS)'],['URUSAN_KELUARGA','👨‍👩‍👧','Urusan Keluarga Mendesak'],['DISPENSASI_LOMBA','🏆','Dispensasi Lomba / Tugas Sekolah'],['KELUAR_SEBENTAR','⏳','Izin Keluar Sebentar (Kembali Lagi)'],['LAINNYA','📝','Lain-lain']];
let lastValue='';
const children=names.map(([code,icon,label])=>jsx('option',{value:code,children:[icon,' ',label]}));
const tree=MobileChoiceSelect({mobileTitle:'Jenis Izin Siswa',children,value:'SAKIT_PULANG',onChange:event=>lastValue=event.target.value,className:'w-full h-11'});
const modal=tree.props.children[2];
const buttons=modal.props.children.props.children;
test('Five student leave categories preserved',()=>assert.equal(buttons.length,5));
test('JSX fragments show friendly captions instead of codes',()=>{
 for(let i=0;i<names.length;i++){
  const label=buttons[i].props.children[0].props.children;
  assert.equal(label,`${names[i][1]} ${names[i][2]}`);
  assert.ok(!label.includes('_'));
 }
});
test('Selected category label is friendly too',()=>{
 const btn=tree.props.children[1];
 assert.match(btn.props['aria-label'],/Sakit \(Pulang \/ Rujukan UKS\)/);
});
test('Click stores exact enum code, not friendly label',()=>{
 buttons[1].props.onClick();
 assert.equal(lastValue,'URUSAN_KELUARGA');
});
test('Fallback option without readable caption is humanized',()=>{
 const t=MobileChoiceSelect({mobileTitle:'Jenis Izin Siswa',children:[jsx('option',{value:'SAKIT_PULANG'})],value:'SAKIT_PULANG'});
 const label=t.props.children[2].props.children.props.children[0].props.children[0].props.children;
 assert.equal(label,'Sakit Pulang');
});
console.log(`R85 ${passed}/${testsExpected} checks passed`);
