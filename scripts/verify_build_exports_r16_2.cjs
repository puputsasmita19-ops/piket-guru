/** Verifies named/default local TypeScript imports AND automatic shift/cancellation behavior. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');

const project = process.cwd();
const files = [];
for (const start of ['src', 'api']) {
  const root = path.join(project, start);
  if (!fs.existsSync(root)) continue;
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(file);
    }
  };
  walk(root);
}
const sourceCache = new Map();
function ast(file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(file, ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  }
  return sourceCache.get(file);
}
function resolveLocal(from, specifier) {
  const direct = path.resolve(path.dirname(from), specifier);
  const base = specifier.endsWith('.js') ? direct.slice(0, -3) : direct;
  for (const candidate of [direct, base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '.json',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'), path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}
const exportCache = new Map();
function exportsOf(file, visited = new Set()) {
  if (file.endsWith('.json')) return new Set(['default']);
  if (exportCache.has(file)) return exportCache.get(file);
  if (visited.has(file)) return new Set();
  const visiting = new Set(visited); visiting.add(file);
  const names = new Set();
  for (const stmt of ast(file).statements) {
    const mods = stmt.modifiers || [];
    const isExport = mods.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (isExport && mods.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) names.add('default');
    if (isExport && (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && stmt.name) names.add(stmt.name.text);
    if (isExport && ts.isVariableStatement(stmt)) for (const decl of stmt.declarationList.declarations)
      if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
    if (ts.isExportAssignment(stmt)) names.add('default');
    if (ts.isExportDeclaration(stmt)) {
      const target = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text.startsWith('.') ? resolveLocal(file, stmt.moduleSpecifier.text) : null;
      if (!stmt.exportClause && target) for (const name of exportsOf(target, visiting)) names.add(name);
      else if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) for (const element of stmt.exportClause.elements)
        names.add(element.name.text);
    }
  }
  exportCache.set(file, names);
  return names;
}
const errors = [];
let bindings = 0;
for (const file of files) {
  for (const stmt of ast(file).statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause ||
      !ts.isStringLiteral(stmt.moduleSpecifier) || !stmt.moduleSpecifier.text.startsWith('.')) continue;
    const target = resolveLocal(file, stmt.moduleSpecifier.text);
    if (!target) { errors.push(`${path.relative(project, file)}: module not found: ${stmt.moduleSpecifier.text}`); continue; }
    const names = exportsOf(target);
    if (stmt.importClause.name) {
      bindings++;
      if (!names.has('default')) errors.push(`${path.relative(project, file)}: missing default export in ${path.relative(project, target)}`);
    }
    const binding = stmt.importClause.namedBindings;
    if (binding && ts.isNamedImports(binding)) for (const element of binding.elements) {
      bindings++;
      const requested = (element.propertyName || element.name).text;
      if (!names.has(requested)) errors.push(`${path.relative(project, file)}: missing export ${requested} from ${path.relative(project, target)}`);
    }
  }
}
assert.equal(errors.length, 0, `Missing exports/modules:\n${errors.join('\n')}`);
console.log(`OK: ${files.length} source files; ${bindings} named/default relative import bindings resolve to real exports.`);

const utilsFile = path.join(project, 'src/utils/scheduleUtils.ts');
const compiled = ts.transpileModule(fs.readFileSync(utilsFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
});
assert.equal((compiled.diagnostics || []).length, 0, 'scheduleUtils syntax has diagnostics');
const scheduleApi = {};
vm.runInNewContext(compiled.outputText, {
  exports: scheduleApi,
  require(moduleName) {
    if (moduleName === './dateUtils') return {
      getCurrentDayName(d) {
        const day = new Date(String(d || '2026-10-21').slice(0, 10) + 'T12:00:00Z').getUTCDay();
        return ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'][day];
      },
      getTodayISODate() { return '2026-10-21'; },
    };
    if (moduleName === '../config/constants') return { DEFAULT_DAILY_SCHEDULES: {} };
    return {};
  },
});
const date = '2026-10-21';
const source = { id:'sch-1', hari:'RABU', tanggal:date, jamMulai:'06:30', jamSelesai:'07:15',
  petugasId:'guru-a', petugasName:'Guru A', ruangId:'pos', ruangName:'Pos', status:'TERJADWAL', recurrence:'WEEKLY' };
const cancellation = { ...source, id:scheduleApi.dutyCancellationId(date,source.id), recurrence:'ONCE',
  status:'DIBATALKAN', cancelForScheduleId:source.id };
const pending = { ...source, id:scheduleApi.dutyCoverageId(date,source.id), recurrence:'ONCE',
  status:'DIBATALKAN', coverageForScheduleId:source.id };
const substitute = { ...pending, status:'TERJADWAL', petugasId:'guru-b', petugasName:'Guru B' };
const checkedIn = { tanggal:date, userId:'guru-a', scheduleId:source.id, jamMasuk:'2026-10-20T23:30:00.000Z' };
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source],[],date),'TERJADWAL');
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source],[checkedIn],date),'BERJALAN');
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source],[{...checkedIn,jamPulang:'2026-10-21T01:00:00Z'}],date),'SELESAI');
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source,pending],[],date),'MENUNGGU_PENGGANTI');
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source,substitute],[],date),'DIGANTIKAN');
assert.equal(scheduleApi.getOperationalScheduleStatus(source,[source,cancellation],[],date),'DIBATALKAN');
assert.equal(scheduleApi.getEffectiveSchedulesOnDate([source,cancellation],date).length,0);
assert.equal(scheduleApi.getEffectiveSchedulesOnDate([source,pending],date).length,0);
assert.equal(scheduleApi.getEffectiveSchedulesOnDate([source,substitute],date)[0]?.petugasId,'guru-b');
assert.equal(scheduleApi.getEffectiveSchedulesOnDate([source,cancellation],'2026-10-28')[0]?.petugasId,'guru-a');
assert.equal(scheduleApi.getDutyCancellationForDate([source,cancellation],'2026-10-28').length,0);
assert.equal(scheduleApi.getDutyCancellationForDate([source,cancellation],date).length,1);
assert.equal(scheduleApi.getDutyCancellationForDate([source,{...cancellation,id:'wrong'}],date).length,0);
console.log('OK: 13 schedule status/override/cancellation regression assertions passed.');
