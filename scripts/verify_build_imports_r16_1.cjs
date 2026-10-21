const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

const repo = process.cwd();
const entry = path.join(repo, 'src/features/schedules/SchedulePreview.tsx');
const service = path.join(repo, 'src/services/firebase/dutyCancellationService.ts');
assert(fs.existsSync(entry), 'SchedulePreview.tsx tidak ditemukan. Jalankan dari root repository.');
assert(fs.existsSync(service), 'dutyCancellationService.ts belum disalin ke src/services/firebase/.');

const scheduleCode = fs.readFileSync(entry, 'utf8');
const serviceCode = fs.readFileSync(service, 'utf8');
assert(scheduleCode.includes("from '../../services/firebase/dutyCancellationService'"), 'Path import belum sesuai.');
for (const method of ['cancel', 'restoreDay', 'restoreRecurring']) {
  assert(serviceCode.includes(`static async ${method}(`), `Method ${method} belum tersedia.`);
}
assert(serviceCode.includes('runTransaction(db'), 'Proses pembatalan harus tetap menggunakan transaksi Firestore.');
assert(serviceCode.includes("doc(db, 'auditLogs'"), 'Audit pembatalan harus tetap tersedia.');

const sourcePaths = ['src', 'api'];
const files = [];
for (const sourcePath of sourcePaths) {
  const root = path.join(repo, sourcePath);
  if (!fs.existsSync(root)) continue;
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(file);
    }
  };
  walk(root);
}
const suffixes = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
const errors = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    let spec;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length && ts.isStringLiteral(node.arguments[0])) spec = node.arguments[0].text;
    if (spec?.startsWith('.')) {
      const target = path.resolve(path.dirname(file), spec);
      const candidates = suffixes.map(ext => target + ext);
      if (spec.endsWith('.js')) {
        candidates.push(target.slice(0, -3) + '.ts', target.slice(0, -3) + '.tsx');
      }
      const exists = candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!exists) errors.push(`${path.relative(repo, file)} -> ${spec}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
assert.equal(errors.length, 0, `Ada import relatif yang tidak ditemukan:\n${errors.join('\n')}`);
console.log(`OK: modul pembatalan tersedia, metode ekspor terverifikasi, dan ${files.length} file TS/JS tidak memiliki import relatif yang hilang.`);
console.log('Catatan: ini verifikasi struktur/import, bukan pengganti npm run lint atau npm run build.');
