'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const marker = 'R61 MOBILE TARDY CARD';
const legacyHeaderHash = '053065648c56b1b7e86a4788e60f8d9d89d11539a0d1c3503493a2e1f2cee077';
const startTag = '                          {/* Row Header */}';
const endTag = '                          {/* Accordion: Penyesuaian Individual per Siswa */}';
function single(old, find, replacement, label) {
  const count = old.split(find).length - 1;
  if (count !== 1) throw new Error(`R61 tidak cocok (${label}): ditemukan ${count} pola, dibutuhkan 1.`);
  return old.replace(find, replacement);
}
function transformTardyForm(source, templatePath=path.join(__dirname, 'r61_templates', 'tardy_selected_card_header.tsx.txt')) {
  if (source.includes(marker)) throw new Error('R61 sudah diterapkan. Dilarang memasang ulang.');
  const i = source.indexOf(startTag), j = source.indexOf(endTag, i + startTag.length);
  if (i < 0 || j < 0 || source.indexOf(startTag, i + 1) >= 0) throw new Error('Batas kartu siswa tidak cocok.');
  const oldHeader = source.slice(i,j);
  if (crypto.createHash('sha256').update(oldHeader).digest('hex') !== legacyHeaderHash) {
    throw new Error('Header kartu siswa telah berubah dari source acuan. R61 dihentikan supaya kode baru tidak tertimpa.');
  }
  let newHeader = fs.readFileSync(templatePath, 'utf8');
  if (!newHeader.includes(marker) || !newHeader.includes('handleRemoveStudent(entry.student.id)') || !newHeader.includes('setTargetStudentIdForPhoto(entry.student.id)')) {
    throw new Error('Template kartu tidak lengkap atau rusak.');
  }
  let updated = source.slice(0,i)+newHeader+source.slice(j);
  updated = single(updated,
    'className="space-y-5" actions={<div className="app-form-actions flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">',
    'className="min-w-0 space-y-4 sm:space-y-5" actions={<div className="app-form-actions flex w-full min-w-0 items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">',
    'form actions');
  updated = single(updated,
    '!editingTardy ? (\n            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">',
    '!editingTardy ? (\n            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4 space-y-3">',
    'multi-student panel');
  updated = single(updated,
    'className="space-y-2 max-h-72 overflow-y-auto pr-1"',
    'className="min-w-0 space-y-2 max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5 sm:max-h-80 sm:pr-1"',
    'selected student scroll');
  updated = single(updated,
    'className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs space-y-2 shadow-xs"',
    'className="min-w-0 space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-3.5"',
    'selected student card');
  updated = single(updated,
    '<div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl animate-in fade-in">',
    '<div id={`student-tardy-adjust-${idx}`} className="min-w-0 space-y-3 rounded-xl border-t border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40 animate-in fade-in">',
    'customization panel');
  updated = single(updated,
    '<div className="flex items-center justify-between">\n                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">\n                                  Penyesuaian Khusus: {entry.student.nama}',
    '<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">\n                                <span className="min-w-0 break-words text-xs font-bold leading-snug text-slate-700 dark:text-slate-300">\n                                  Penyesuaian Khusus: {entry.student.nama}',
    'customization heading');
  updated = single(updated,
    'className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"',
    'className="min-h-9 self-start rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300 dark:hover:bg-blue-950"',
    'reset customization');
  updated = single(updated,
    'className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"',
    'className="grid min-w-0 grid-cols-1 gap-3 text-xs sm:grid-cols-3"',
    'individual input layout');
  for (const inputClass of [
    'w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold',
    'w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium',
  ]) {
    // the second pattern appears twice in the individual editor (reason + coaching)
    const found = updated.split(`className="${inputClass}"`).length-1;
    const expected = inputClass.includes('font-mono')?1:2;
    if (found !== expected) throw new Error(`R61 tidak cocok (individual input, diharapkan ${expected}, ditemukan ${found}).`);
    updated = updated.replaceAll(`className="${inputClass}"`, `className="min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900 sm:text-xs ${inputClass.includes('font-mono')?'font-mono font-bold':'font-medium'}"`);
  }
  updated = single(updated,
    'className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2"',
    'className="flex min-w-0 flex-col gap-2 border-b border-slate-100 pb-2 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between"',
    'shared defaults heading');
  // Prevent flex children with long labels from widening the mobile dialog.
  updated = single(updated,
    '<span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">\n                <Clock className="w-4 h-4 text-rose-500" />',
    '<span className="flex min-w-0 items-start gap-1.5 text-xs font-bold leading-snug text-slate-900 dark:text-white">\n                <Clock className="h-4 w-4 shrink-0 text-rose-500" />',
    'shared defaults heading title');
  return updated;
}
module.exports = { transformTardyForm, legacyHeaderHash, marker };
