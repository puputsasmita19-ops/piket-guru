'use strict';
/** R63: don't replace source; transform only known R62 elements atomically. */
function once(source, find, replace, purpose) {
  const occurrences = source.split(find).length - 1;
  if (occurrences !== 1) throw new Error(`${purpose}: pola source tidak cocok (${occurrences} ditemukan, perlu 1).`);
  return source.replace(find, replace);
}
function transformForm(source) {
  if (source.includes('R63 FULLWIDTH TARDY') || source.includes('StudentTardyMobileR63.css')) throw new Error('R63 sudah diterapkan pada formulir.');
  if (!source.includes("import './StudentTardyMobileR62.css'") || !source.includes('r62-tardy-card')) throw new Error('R62 belum ditemukan; tidak aman menimpa formulir.');
  for (const handler of [
    'handleAddStudent(std)', 'handleRemoveStudent(entry.student.id)',
    'setTargetStudentIdForPhoto(entry.student.id)',
    'setExpandedStudentId(isExpanded ? null : entry.student.id)',
  ]) if (!source.includes(handler)) throw new Error(`Handler penting tidak ditemukan: ${handler}`);
  source = once(source,
    "import './StudentTardyMobileR62.css';",
    "import './StudentTardyMobileR62.css';\nimport './StudentTardyMobileR63.css';",
    'Import stylesheet R63');
  source = once(source,
    '        maxWidth="2xl"\n      >',
    '        maxWidth="2xl"\n        className="r63-tardy-dialog"\n      >',
    'Class modal khusus R63');
  source = once(source,
    'className="r62-tardy-fields min-w-0 w-full max-w-full space-y-4 sm:space-y-5"',
    `className="r62-tardy-fields r63-tardy-fields min-w-0 w-full max-w-full space-y-4 sm:space-y-5"`,
    'Kelas form khusus R63');
  source = once(source,
    '                    Daftar Siswa Terpilih:\n                  </div>',
    `                    Daftar Siswa Terpilih:\n                    <span className="r63-tardy-version" aria-label="Tampilan buku siswa terlambat R63">R63</span>\n                  </div>`,
    'Penanda versi yang terlihat di HP');
  // Remove nested, independent scroll: the form must have a single vertical scroll.
  source = once(source,
    'className="r62-tardy-selected-list min-w-0 w-full max-w-full space-y-2 max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5 sm:max-h-80 sm:pr-1"',
    'className="r62-tardy-selected-list r63-tardy-selected-list min-w-0 w-full max-w-full space-y-2 pr-0.5 sm:pr-1"',
    'Hapus nested scroll siswa terpilih');
  // Guard against horizontal auto scrolling after focus, while preserving vertical position.
  source = once(source,
    '<DialogForm onSubmit={handleInitiateSubmit} noValidate className="r62-tardy-fields r63-tardy-fields',
    `<DialogForm onSubmit={handleInitiateSubmit} noValidate onScrollCapture={(event) => {\n          const target = event.target;\n          if (target instanceof HTMLElement &&\n            (target.classList.contains('app-form-fields') || target.classList.contains('r62-tardy-selected-list') || target.classList.contains('r62-tardy-picker')) && target.scrollLeft !== 0) {\n            target.scrollLeft = 0;\n          }\n        }} className="r62-tardy-fields r63-tardy-fields`,
    'Pengaman scroll horizontal terbatas');
  if (!source.includes('r63-tardy-version') || !source.includes('r63-tardy-dialog')) throw Error('Form R63 tidak lengkap');
  return `// R63 FULLWIDTH TARDY (mobile modal + one vertical scroll)\n${source}`;
}
function transformModal(source) {
  if (source.includes('  className?: string;') && source.includes(' ${className}')) {
    return source; // Shared Modal might already support className from elsewhere.
  }
  source = once(source,
    "  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';",
    "  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';\n  /** Optional isolated styling for feature-specific dialogs. */\n  className?: string;",
    'ModalProps className');
  source = once(source,
    "footer, maxWidth = 'lg' }) => {",
    "footer, maxWidth = 'lg', className = '' }) => {",
    'Modal destructuring');
  source = once(source,
    'outline-none`}',
    'outline-none ${className}`}',
    'Modal class output');
  return source;
}
module.exports = {transformForm, transformModal};
