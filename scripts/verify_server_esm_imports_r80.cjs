'use strict';
/** R80 — Reproduce the Vercel Node ESM ERR_MODULE_NOT_FOUND regression offline. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const infoPath = path.join(root, 'src/types/dashboardInfo.types.ts');
const welcomePath = path.join(root, 'src/types/dashboardWelcome.types.ts');
const routePath = path.join(root, 'src/server/routes/authRoutes.ts');
const info = fs.readFileSync(infoPath, 'utf8');
const welcome = fs.readFileSync(welcomePath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');
const entry = path.join(root, 'api/index.ts');
let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS', name); }
check('Both original TS modules still exist', () => {
  assert.ok(fs.statSync(infoPath).size && fs.statSync(welcomePath).size);
});
check('Server runtime import to dashboardInfo uses .js', () => {
  assert.match(route, /from ['"]\.\.\/\.\.\/types\/dashboardInfo\.types\.js['"]/);
});
check('DashboardInfo import to dashboardWelcome uses Node ESM .js extension', () => {
  assert.match(info, /from ['"]\.\/dashboardWelcome\.types\.js['"]/);
});
check('No remaining extensionless DashboardWelcome dependency', () => {
  assert.doesNotMatch(info, /from ['"]\.\/dashboardWelcome\.types['"]/);
});
check('API entry has .js runtime specifier', () => {
  assert.match(fs.readFileSync(entry, 'utf8'), /from ['"]\.\.\/src\/server\/app\.js['"]/);
});
check('R77 null and missing defaults preserved', () => {
  assert.match(info, /const requestedDuration = value\?\.durationSeconds/);
});
check('Auth route still uses server-side marq sanitizer without exposing private config', () => {
  assert.match(route, /publicNameMarquee: sanitizeNameMarqueeConfig\(data\.dashboardInfoConfig\?\.nameMarquee\)/);
});
check('Static ESM import chain can be executed by Node, rather than only Vite', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-r80-esm-'));
  try {
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({type:'module'}));
    const jsOptions = {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022};
    const compile = (src, file) => ts.transpileModule(src, {fileName:file, compilerOptions:jsOptions}).outputText;
    fs.writeFileSync(path.join(temp, 'dashboardWelcome.types.js'), compile(welcome, 'dashboardWelcome.types.ts'));
    // Baseline reproduces the exact production import failure despite both .js files existing.
    const oldCode = info.replace("from './dashboardWelcome.types.js'", "from './dashboardWelcome.types'");
    const run = (src, expected) => {
      fs.writeFileSync(path.join(temp, 'dashboardInfo.types.js'), compile(src, 'dashboardInfo.types.ts'));
      const url = pathToFileURL(path.join(temp, 'dashboardInfo.types.js')).href;
      const program = `import(${JSON.stringify(url)}).then(m=>{const result=m.sanitizeDashboardInfoConfig({});if(result.nameMarquee.durationSeconds!==16)process.exit(4);}).catch(e=>{console.error(e.code+': '+e.message);process.exit(3)});`;
      const result = spawnSync(process.execPath, ['--input-type=module','-e',program], {encoding:'utf8',timeout:6000});
      if(expected==='failure'){
        assert.equal(result.status,3,'Before patch this should fail Node ESM');
        assert.match(result.stderr,/ERR_MODULE_NOT_FOUND/);
      } else assert.equal(result.status,0, `After patch ESM must work: ${result.stderr}`);
    };
    run(oldCode, 'failure');
    run(info, 'success');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
check('Additional server runtime relative imports have explicit suffixes', () => {
  const walk = base => fs.readdirSync(base, {withFileTypes:true}).flatMap(d => d.isDirectory()? walk(path.join(base,d.name)) : /\.[cm]?tsx?$/.test(d.name) ? [path.join(base,d.name)] : []);
  const dirs = walk(path.join(root,'src/server')).concat([entry]);
  for(const file of dirs){
    const ast = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    for(const stmt of ast.statements){
      if(!ts.isImportDeclaration(stmt)||!ts.isStringLiteral(stmt.moduleSpecifier))continue;
      const spec = stmt.moduleSpecifier.text;
      if(!spec.startsWith('.'))continue;
      // Type-only imports are erased by TS. The server import graph must point
      // to the emitted .js files. This guards against the same outage elsewhere.
      if(stmt.importClause?.isTypeOnly)continue;
      assert.match(spec,/\.(?:js|mjs|cjs|json)$/u,`Extensionless server import in ${path.relative(root,file)}: ${spec}`);
    }
  }
});
console.log(`R80: ${count}/${count} Node ESM checks passed`);
