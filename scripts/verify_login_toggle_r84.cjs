'use strict';
/** R84 — verify login toggle semantics without logging in or touching Firebase. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/features/auth/LoginPage.tsx');
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let passed = 0;
const check = (title, fn) => {fn(); ++passed; console.log('PASS',title);};
const must = (name, pattern) => check(name, () => assert.match(source,pattern));
const absent = (name, pattern) => check(name, () => assert.doesNotMatch(source,pattern));
const buttons = new Map();
(function inspect(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.text === 'button') {
    const label = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.text === 'aria-label');
    if (label?.initializer && ts.isStringLiteral(label.initializer)) {
      const click = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.text === 'onClick');
      const pressed = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.text === 'aria-pressed');
      buttons.set(label.initializer.text,{node,click,pressed});
    }
  }
  ts.forEachChild(node, inspect);
})(ast);
check('TSX parses without syntax diagnostics',()=>assert.equal(ast.parseDiagnostics.length,0));
check('Runtime TSX transpilation has no errors',()=>{
  const result=ts.transpileModule(source,{fileName:'LoginPage.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
check('Two explicit method buttons are always present',()=>{
  assert.ok(buttons.has('Cari berdasarkan nama'));
  assert.ok(buttons.has('Masuk dengan ID atau NIP'));
});
check('Both method buttons have independent onClick handlers',()=>{
  for (const label of ['Cari berdasarkan nama','Masuk dengan ID atau NIP'])
    assert.ok(buttons.get(label).click?.initializer?.expression && ts.isArrowFunction(buttons.get(label).click.initializer.expression));
});
check('Both method buttons expose aria-pressed',()=>{
  for (const label of ['Cari berdasarkan nama','Masuk dengan ID atau NIP'])
    assert.ok(buttons.get(label).pressed?.initializer && ts.isJsxExpression(buttons.get(label).pressed.initializer));
});
must('Two-column toggle now aligned right above full-width search', /role="group"\s+aria-label="Cari menggunakan nama atau ID\/NIP"\s+className="grid grid-cols-\[56px_67px\] sm:grid-cols-\[60px_72px\]/);
must('Compact mode control stays inside login section', /<section className="login-method-panel min-w-0 space-y-2"/);
absent('No old opaque tap-to-cycle icon', /<RefreshCw\s/);
absent('No obsolete RefreshCw import', /^\s*RefreshCw,/m);
must('Name control visibly says Nama', /<span>Nama<\/span>/);
must('ID control visibly says ID\/NIP', /<span>ID\/NIP<\/span>/);
must('Two 44px mobile tap targets', /inline-flex min-h-11 sm:min-h-10/g);
must('Controls have visible keyboard focus', /focus-visible:outline-2 focus-visible:outline-offset-2/);
must('Disabled while authentication is running', /disabled=\{isSubmitting \|\| isGoogleSubmitting\}/);
must('Manual ID and name fields are conditional', /\{isManualInput \? \(\s*<input/);
must('Name field still supports suggestions', /visibleUsers\.map\(\(u, idx\)/);
must('Name keyboard navigation preserved', /onKeyDown=\{handleComboboxKeyDown\}/);
must('Name clear button preserved', /aria-label="Hapus pencarian nama"/);
must('Selected account avatar and long-name support intact', /<LoginAvatar user=\{selectedUser\} compact\s*\/>[\s\S]{0,200}<OverflowName/);
must('Retry failed account directory remains available', /Coba Lagi<\/button>/);
must('PIN login unchanged', /loginWithPin\(selectedUidRef\.current \|\| selectedIdentifier, pin\)/);
must('Google login still available', /loginWithGoogle\(\)/);
must('Trusted-device storage preserved', /setTrustedDevice/);
must('User directory still requires verified summary response', /getUsersListStatus\?\.\(\)\.verified === false/);
absent('No unauthenticated Firestore reads added', /onSnapshot\(|getDocs\(|getFirestore\(/);

const compileHandler = label => {
  const expr = buttons.get(label).click.initializer.expression;
  const arrow = expr.getText(ast);
  const transpiled = ts.transpileModule(`const callback = ${arrow};`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function('ctx',`const {isManualInput,selectedUidRef,selectionTouchedRef,setSelectedIdentifier,setPin,setErrorMessage,setHasError,setIsManualInput,setIsComboboxOpen,setSearchQuery,setHighlightedIndex,usersList,isLoadingUsers,refreshLoginUsers,window,manualInputRef,searchInputRef} = ctx; ${transpiled}; return callback;`);
};
const makeContext = (manual, verifiedUid = null) => {
  const ctx = {
    isManualInput:manual,
    selectedUidRef:{current:verifiedUid},
    selectionTouchedRef:{current:false},
    usersList:[{id:'abc'}],isLoadingUsers:false,refreshLoginUsers:()=>Promise.resolve(),
    window:{requestAnimationFrame: fn=>fn()},
    manualInputRef:{current:{focus:()=>ctx.focus='manual'}},
    searchInputRef:{current:{focus:()=>ctx.focus='name'}},
    selectedIdentifier:'user-unverified',pin:'123456',searchQuery:'old-query',
  };
  for (const key of ['SelectedIdentifier','Pin','ErrorMessage','HasError','IsManualInput','IsComboboxOpen','SearchQuery','HighlightedIndex']) {
    const prop=key[0].toLowerCase()+key.slice(1);
    ctx['set'+key]=(v)=>{ctx[prop]=v;};
  }
  return ctx;
};
const toName = compileHandler('Cari berdasarkan nama');
const toManual = compileHandler('Masuk dengan ID atau NIP');
check('Clicking ID while in Nama immediately selects manual mode and focuses input',()=>{
  const ctx=makeContext(false);toManual(ctx)();assert.equal(ctx.isManualInput,true);assert.equal(ctx.focus,'manual');assert.equal(ctx.selectionTouchedRef.current,true);assert.equal(ctx.searchQuery,'');
});
check('Clicking Nama after unverified manual ID clears hidden identity and PIN',()=>{
  const ctx=makeContext(true);toName(ctx)();assert.equal(ctx.isManualInput,false);assert.equal(ctx.selectedIdentifier,'');assert.equal(ctx.pin,'');assert.equal(ctx.focus,'name');
});
check('Clicking Nama with verified UID retains identity and PIN',()=>{
  const ctx=makeContext(true,'verified-uid');toName(ctx)();assert.equal(ctx.isManualInput,false);assert.equal(ctx.selectedIdentifier,'user-unverified');assert.equal(ctx.pin,'123456');
});
check('Clicking active Nama does not reset query or PIN',()=>{
  const ctx=makeContext(false);toName(ctx)();assert.equal(ctx.searchQuery,'old-query');assert.equal(ctx.pin,'123456');assert.equal(ctx.focus,'name');
});
check('Clicking active ID does not reset typed ID or PIN',()=>{
  const ctx=makeContext(true);toManual(ctx)();assert.equal(ctx.selectedIdentifier,'user-unverified');assert.equal(ctx.pin,'123456');assert.equal(ctx.focus,'manual');
});
console.log(`R84: ${passed} checks passed`);
