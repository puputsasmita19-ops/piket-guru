'use strict';
/** R62: safe, single-file TSX transform. Only works after R61. */
const R61 = 'R61 MOBILE TARDY CARD';
const R62 = 'R62 MOBILE STUDENT PICKER';

function once(source, before, after, description) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${description}: struktur berubah (${count} ditemukan; perlu tepat 1).`);
  return source.replace(before, after);
}

function transform(source) {
  if (source.includes(R62) || source.includes('StudentTardyMobileR62.css')) throw Error('R62 sudah terpasang. Jangan ulangi.');
  if (!source.includes(R61)) throw Error('Source belum menunjukkan R61. Tidak aman untuk dipatch.');
  for (const handler of [
    'handleAddStudent(std)', 'handleRemoveStudent(entry.student.id)',
    'setTargetStudentIdForPhoto(entry.student.id)', 'setExpandedStudentId(isExpanded ? null : entry.student.id)',
  ]) if (!source.includes(handler)) throw Error(`Handler ${handler} tidak tersedia.`);

  source = once(source,
    "import { DialogForm } from '../../components/common/DialogForm';",
    "import { DialogForm } from '../../components/common/DialogForm';\nimport './StudentTardyMobileR62.css';",
    'CSS import');
  source = once(source,
    "import React, { useState, useEffect, useMemo, useRef } from 'react';",
    "import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';",
    'React hook import');
  source = once(source,
    '  const [selectedStudents, setSelectedStudents] = useState<SelectedStudentEntry[]>([]);',
    '  const [selectedStudents, setSelectedStudents] = useState<SelectedStudentEntry[]>([]);\n  const r62PickerRef = useRef<HTMLDivElement>(null);',
    'picker reference');
  source = once(source,
    '  // Autocomplete student filter',
    `  // ${R62}: keep the left edge in view when a student/accordion is selected.
  // Only reset horizontal scrolling. Never disturb form vertical scroll or field focus.
  useLayoutEffect(() => {
    if (!isOpen || editingTardy || !r62PickerRef.current) return;
    const picker = r62PickerRef.current;
    picker.scrollLeft = 0;
    const fields = picker.closest<HTMLElement>('.app-form-fields');
    if (fields) fields.scrollLeft = 0;
    const body = picker.closest<HTMLElement>('.app-dialog-body');
    if (body) body.scrollLeft = 0;
  }, [isOpen, editingTardy, selectedStudents.length, expandedStudentId]);

  // Autocomplete student filter`,
    'scroll position reset');
  source = once(source,
    'className="min-w-0 space-y-4 sm:space-y-5" actions=',
    'className="r62-tardy-fields min-w-0 w-full max-w-full space-y-4 sm:space-y-5" actions=',
    'form field constraints');
  source = once(source,
    '<div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4 space-y-3">',
    '<div ref={r62PickerRef} className="r62-tardy-picker min-w-0 w-full max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4 space-y-3">',
    'picker container');
  source = once(source,
    'className="flex items-center justify-between gap-2 flex-wrap">\n                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">',
    'className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">\n                <label className="flex min-w-0 items-start gap-1.5 text-xs font-bold leading-snug text-slate-900 dark:text-white">',
    'heading layout');
  source = once(source, '<span>Pilih Siswa (Bisa Pilih Beberapa Sekaligus) *</span>',
    '<span className="min-w-0 break-words">Pilih Siswa (Bisa Pilih Beberapa Sekaligus) *</span>',
    'picker label');
  source = once(source,
    '              {/* Search Autocomplete Input */}\n              <div className="relative">',
    '              {/* Search Autocomplete Input */}\n              <div className="r62-tardy-search relative min-w-0 w-full max-w-full">',
    'search wrapper');
  source = once(source,
    'className="w-full min-h-[44px] pl-9 pr-4 py-2.5 rounded-xl',
    'className="box-border w-full min-w-0 max-w-full min-h-[44px] pl-9 pr-4 py-2.5 rounded-xl',
    'search input width');
  source = once(source,
    '<div className="absolute z-40 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">',
    '<div role="group" aria-label="Hasil pencarian siswa" className="r62-tardy-results absolute z-40 left-0 right-0 top-full mt-1.5 max-h-56 overflow-x-hidden overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">',
    'search result container');
  const oldOpen = [
    '                        <div',
    '                          key={std.id}',
    '                          onMouseDown={(e) => {',
    '                            e.preventDefault();',
    '                            if (!isAlreadySelected) handleAddStudent(std);',
    '                          }}',
    '                          className={`p-3 text-xs transition-colors flex items-center justify-between gap-2 ${',
  ].join('\n');
  const newOpen = [
    '                        <button',
    '                          type="button"',
    '                          key={std.id}',
    '                          disabled={isAlreadySelected}',
    '                          onClick={() => { if (!isAlreadySelected) void handleAddStudent(std); }}',
    '                          aria-label={`${std.nama}, kelas ${std.kelas}${isAlreadySelected ? ", sudah dipilih" : ", tambah ke daftar"}`}',
    '                          className={`r62-tardy-result-row flex w-full min-h-[52px] min-w-0 flex-wrap items-start gap-2 p-3 text-left text-xs transition-colors ${',
  ].join('\n');
  source = once(source, oldOpen, newOpen, 'search result touch/keyboard button');
  source = once(source,
    '                        </div>\n                      );\n                    })}\n                  </div>\n                )}\n              </div>',
    '                        </button>\n                      );\n                    })}\n                  </div>\n                )}\n              </div>',
    'search result closing tag');
  source = once(source,
    '<div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">',
    '<div className="flex min-w-0 flex-wrap items-center gap-1.5 font-bold text-slate-900 dark:text-white">',
    'search result name row');
  source = once(source, '<span className="truncate">{std.nama}</span>',
    '<span className="min-w-0 break-words">{std.nama}</span>', 'search name wrap');
  source = once(source, '<div className="text-[10px] text-slate-500 font-mono mt-0.5">',
    '<div className="r62-tardy-option-meta mt-1 min-w-0 text-[11px] leading-snug text-slate-500">', 'search metadata wrap');
  source = once(source,
    '<div className="space-y-2 pt-2">\n                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">',
    '<div className="min-w-0 w-full max-w-full space-y-2 pt-2">\n                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">',
    'selected students wrapper');
  source = once(source,
    'className="min-w-0 space-y-2 max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5 sm:max-h-80 sm:pr-1"',
    'className="r62-tardy-selected-list min-w-0 w-full max-w-full space-y-2 max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5 sm:max-h-80 sm:pr-1"',
    'selected students scroll');
  source = once(source,
    'className="min-w-0 space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-3.5"',
    'className="r62-tardy-card min-w-0 w-full max-w-full space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-3.5"',
    'selected student card');
  source = once(source,
    'className="grid min-w-0 grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:flex sm:justify-end"',
    'className="r62-tardy-actions grid min-w-0 grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:flex sm:justify-end"',
    'touch actions');
  if (!source.includes(R62) || !source.includes("import './StudentTardyMobileR62.css'")) throw Error('Output R62 tidak lengkap.');
  return source;
}
module.exports = { transform, R61, R62 };
