'use strict';
/** R64 — exact, atomic patch for both legacy and R61–R63 student-tardy cards.
 * Does not touch data, security, submission, or other features.
 */
const fs = require('node:fs');
const path = require('node:path');

const CARD_HEADER = `                          {/* R64 — guaranteed 3-row mobile card; no horizontally scrolling content */}
                          <div className="r64-tardy-header">
                            <div className="r64-tardy-identity">
                              <span className="r64-tardy-index" aria-hidden="true">{idx + 1}</span>
                              <div className="r64-tardy-person">
                                <div className="r64-tardy-name">{entry.student.nama}</div>
                                <div className="r64-tardy-meta">
                                  <span>Kelas: <strong>{entry.student.kelas}</strong></span>
                                  {entry.student.noHpOrangTua && (
                                    <span>Ortu: {entry.student.noHpOrangTua}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="r64-tardy-status-row">
                              <span className={\`r64-tardy-status \${
                                calc.minutesLate === null
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : calc.isLate
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }\`}>{calc.displayText}</span>
                              <span className={\`r64-tardy-frequency \${entry.frekuensiBulanIni >= 3
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                              }\`}>Ke-{entry.frekuensiBulanIni}</span>
                            </div>
                            <div className="r64-tardy-actions" role="group" aria-label={\`Aksi untuk \${entry.student.nama}\`}>
                              <button type="button"
                                onClick={() => {
                                  setTargetStudentIdForPhoto(entry.student.id);
                                  setIsCameraOpen(true);
                                }}
                                className="r64-tardy-action"
                                aria-label={\`\${entry.fotoUrl ? 'Ganti' : 'Ambil'} foto \${entry.student.nama}\`}
                                title="Foto dokumentasi siswa">
                                <Camera className="h-4 w-4" /> <span>{entry.fotoUrl ? 'Ganti Foto' : 'Foto'}</span>
                              </button>
                              <button type="button"
                                onClick={() => setExpandedStudentId(isExpanded ? null : entry.student.id)}
                                className="r64-tardy-action"
                                aria-expanded={isExpanded}
                                aria-controls={isExpanded ? \`student-tardy-adjust-\${idx}\` : undefined}
                                aria-label={\`\${isExpanded ? 'Tutup' : 'Buka'} pengaturan \${entry.student.nama}\`}
                                title="Penyesuaian individual">
                                <Sliders className="h-4 w-4" /> <span>{entry.isCustomized ? 'Diubah' : 'Atur'}</span>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              <button type="button"
                                onClick={() => handleRemoveStudent(entry.student.id)}
                                className="r64-tardy-action r64-tardy-delete"
                                aria-label={\`Hapus \${entry.student.nama} dari daftar siswa terpilih\`}
                                title="Hapus siswa dari pilihan">
                                <Trash2 className="h-4 w-4" /> <span>Hapus</span>
                              </button>
                            </div>
                          </div>

`;

function replaceExactly(text, needle, replacement, description) {
  const occurrences = text.split(needle).length - 1;
  if (occurrences !== 1) throw new Error(`${description}: diperlukan satu pola, ditemukan ${occurrences}.`);
  return text.replace(needle, replacement);
}

function modify(source) {
  if (source.includes('R64 — guaranteed 3-row mobile card') || source.includes('StudentTardyMobileR64.css')) {
    throw new Error('R64 sudah ada di source; pemasangan ulang dibatalkan.');
  }
  const required = [
    'Daftar Siswa Terpilih:',
    '{selectedStudents.map((entry, idx) => {',
    'handleRemoveStudent(entry.student.id)',
    'setTargetStudentIdForPhoto(entry.student.id)',
    'setExpandedStudentId(isExpanded ? null : entry.student.id)',
    '{/* Accordion: Penyesuaian Individual per Siswa */}',
  ];
  for (const term of required) if (!source.includes(term)) throw new Error(`Struktur source belum dikenali: ${term}`);
  // Version marker inside visible UI. If it is absent on the phone after deploy,
  // this TSX has not made it into the deployed bundle (or client still runs old PWA).
  if (source.includes('r63-tardy-version')) {
    source = replaceExactly(source,
      '<span className="r63-tardy-version" aria-label="Tampilan buku siswa terlambat R63">R63</span>',
      '<span className="r64-tardy-version" data-r64="active" aria-label="Tampilan buku siswa terlambat R64">R64</span>',
      'Label rilis R63');
  } else {
    source = replaceExactly(source, 'Daftar Siswa Terpilih:',
      'Daftar Siswa Terpilih: <span className="r64-tardy-version" data-r64="active">R64</span>',
      'Label rilis');
  }
  const startMap = source.indexOf('{selectedStudents.map((entry, idx) => {');
  const cardKey = source.indexOf('key={entry.student.id}', startMap);
  const accordion = source.indexOf('                          {/* Accordion: Penyesuaian Individual per Siswa */}', cardKey);
  if (cardKey < 0 || accordion < 0) throw new Error('Gagal menemukan batas header kartu siswa.');
  const openAfterKey = source.slice(cardKey, cardKey + 450);
  const match = /^key=\{entry\.student\.id\}\s+className="([^"]+)"/.exec(openAfterKey);
  if (!match) throw new Error('Kartu siswa berubah; className tidak dikenali.');
  const headerStart = source.indexOf('>', cardKey + match[0].length);
  if (headerStart < 0 || headerStart > accordion) throw new Error('Tag kartu siswa tidak ditemukan.');
  const oldHeader = source.slice(headerStart + 1, accordion);
  if (!oldHeader.includes('calc.displayText') || !oldHeader.includes('entry.frekuensiBulanIni')) {
    throw new Error('Header kartu bukan versi yang diaudit; tidak aman menggantinya.');
  }
  source = source.slice(0, headerStart + 1) + '\n' + CARD_HEADER + source.slice(accordion);
  source = replaceExactly(source,
    `key={entry.student.id}\n                          className="${match[1]}"`,
    `key={entry.student.id}\n                          className="r64-tardy-card ${match[1]}"`, 'Class kartu siswa');

  // Replace entire list class to eliminate implicit overflow-x:auto created by
  // overflow-y:auto (the actual cause of horizontally scrolled/clipped text).
  const mapPos = source.indexOf('{selectedStudents.map((entry, idx) => {');
  const wrapperStart = source.lastIndexOf('<div className="', mapPos);
  const wrapperEnd = source.indexOf('"', wrapperStart + '<div className="'.length);
  if (wrapperStart < 0 || wrapperEnd >= mapPos) throw new Error('Pembungkus daftar siswa tidak dikenali.');
  const listClass = source.slice(wrapperStart + '<div className="'.length, wrapperEnd);
  if (!listClass.includes('space-y-2') || (!listClass.includes('overflow-y-auto') && !listClass.includes('r62-tardy-selected-list'))) {
    throw new Error(`Pembungkus daftar berubah: ${listClass}`);
  }
  source = source.slice(0, wrapperStart) + '<div className="r64-tardy-selected-list space-y-3 min-w-0 w-full max-w-full">' + source.slice(wrapperEnd + 2);

  // Distinct picker wrapper so the layout fix applies even in legacy source.
  const pickerComment = source.indexOf('{/* BAGIAN 1: PEMILIHAN SISWA');
  const pickerState = source.indexOf('!editingTardy ? (', pickerComment);
  const matchPicker = /^\s*<div(?:\s+ref=\{r62PickerRef\})?\s+className="([^"]+)"/.exec(source.slice(pickerState + '!editingTardy ? ('.length));
  if (pickerComment < 0 || pickerState < 0 || !matchPicker) throw Error('Pembungkus Pilih Siswa tidak dikenali.');
  const pickerClass = matchPicker[1];
  if (!/rounded-2xl/.test(pickerClass)) throw new Error('Pembungkus Pilih Siswa tidak sesuai.');
  const token = `className="${pickerClass}"`;
  const pickerTokenStart = pickerState + '!editingTardy ? ('.length + matchPicker[0].indexOf(token);
  source = source.slice(0, pickerTokenStart) + `className="r64-tardy-picker ${pickerClass}"` + source.slice(pickerTokenStart + token.length);

  // Inject scoped stylesheet into TSX so no global CSS or application feature is changed.
  const importAnchor = "import { DialogForm } from '../../components/common/DialogForm';";
  source = replaceExactly(source, importAnchor,
    `${importAnchor}\nimport './StudentTardyMobileR64.css';`, 'Import stylesheet R64');
  // Effect only resets horizontal scroll on the relevant selected list when it
  // opens/changes; does not alter user vertical scroll or typed field values.
  const componentStart = '  // Multi-Student Selected List';
  if (!source.includes(componentStart)) throw new Error('State daftar siswa tidak ditemukan.');
  source = replaceExactly(source, componentStart, `  // R64: never restore a sideways scroll offset after selecting or expanding a student.\n  useEffect(() => {\n    if (!isOpen) return;\n    const frame = requestAnimationFrame(() => {\n      document.querySelectorAll<HTMLElement>('.r64-tardy-selected-list, .r64-tardy-picker').forEach(node => {\n        if (node.scrollLeft !== 0) node.scrollLeft = 0;\n      });\n    });\n    return () => cancelAnimationFrame(frame);\n  }, [isOpen, selectedStudents.length, expandedStudentId]);\n\n${componentStart}`, 'Pengaman scroll horizontal');
  // Above insertion occurs after useState used? the selectedStudents const is declared below the marker!
  // Reposition effect after the existing selectedStudents/expandedStudentId pair.
  const effectStart = source.indexOf('  // R64: never restore');
  const effectEnd = source.indexOf('  // Multi-Student Selected List', effectStart);
  const effect = source.slice(effectStart, effectEnd);
  source = source.slice(0, effectStart) + source.slice(effectEnd);
  const anchor = "  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);";
  source = replaceExactly(source, anchor, `${anchor}\n\n${effect.trimEnd()}`, 'Posisi effect setelah deklarasi state');

  if (!source.includes('data-r64="active"') || !source.includes('r64-tardy-card')) throw new Error('Hasil R64 tidak lengkap.');
  return source;
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const root = process.cwd();
  const rel = 'src/features/student-tardiness/StudentTardyFormModal.tsx';
  const dst = path.join(root, rel);
  try {
    if (!fs.existsSync(path.join(root, 'package.json'))) throw Error('Jalankan dari root repository Piket Guru.');
    if (!fs.existsSync(path.join(root, 'src/features/student-tardiness/StudentTardyMobileR64.css'))) {
      throw Error('CSS R64 belum diekstrak ke folder src/features/student-tardiness.');
    }
    const previous = fs.readFileSync(dst, 'utf8');
    const next = modify(previous);
    if (dry) {
      console.log('R64 DRY RUN PASSED — source cocok; tidak ada file yang diubah.');
      console.log('File yang AKAN berubah:', rel);
      return;
    }
    const temp = `${dst}.r64-${process.pid}.tmp`;
    try {
      fs.writeFileSync(temp, next, {flag:'wx'});
      fs.renameSync(temp, dst);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    console.log('R64 APPLIED: ', rel);
    console.log('WAJIB COMMIT: file TSX di atas DAN file CSS R64.');
    console.log('Konfirmasi isi source: node scripts/test_r64_mobile_tardy.cjs');
  } catch (e) {
    console.error('R64 STOPPED SAFELY:', e.message);
    process.exitCode=1;
  }
}
if (require.main === module) main();
module.exports = {modify};
