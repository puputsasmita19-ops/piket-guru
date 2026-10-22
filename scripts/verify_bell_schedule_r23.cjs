const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const paths = [
  'src/types/commandCenterConfig.types.ts',
  'src/features/settings/CommandCenterSettingsCard.tsx',
  'src/features/settings/BellEmergencyAutomationCard.tsx',
  'src/features/command-center/CommandCenterPreview.tsx',
  'src/services/firebase/schoolSettingsService.ts',
];
let checks = 0;
const check = (result, message) => { assert.ok(result, message); checks++; };
for (const file of paths) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
  });
  check(!(output.diagnostics || []).length, `Sintaks: ${file}`);
}
const output = ts.transpileModule(fs.readFileSync(paths[0], 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
const exported = {};
vm.runInNewContext(output.outputText, { exports: exported });
const {normalizeCommandCenterConfig: normalize, validateCommandCenterConfig: validate} = exported;
const oldConfig = normalize({heading:'Pos Piket Sekolah'});
check(oldConfig.scheduledBells.length === 7, 'Pengaturan lama dimigrasi menjadi 7 sesi default');
check(validate(oldConfig).length === 0, 'Pengaturan lama tetap valid');
check(oldConfig.heading === 'Pos Piket Sekolah', 'Judul pengaturan lama dipertahankan');
check(normalize({scheduledBells: []}).scheduledBells.length === 0, 'Daftar bel kosong adalah pilihan yang sah');
const mod = normalize({scheduledBells:[{id:'t1',time:'08:10',label:'Pagi',description:'',toneType:'BREAK',isActive:true,days:[1,3]}]});
check(mod.scheduledBells.length === 1 && mod.scheduledBells[0].days.length === 2, 'Pengaturan sesi dan hari tersimpan');
check(validate(mod).length === 0, 'Sesi yang benar valid');
const badTime = normalize({scheduledBells:[{...mod.scheduledBells[0],time:'28:99'}]});
check(validate(badTime).some(x=>x.includes('HH:mm')), 'Jam tidak valid ditolak');
const badDays = normalize({scheduledBells:[{...mod.scheduledBells[0],days:[]}]});
check(validate(badDays).some(x=>x.includes('minimal satu hari')), 'Hari kosong ditolak');
const collision = normalize({scheduledBells:[mod.scheduledBells[0],{...mod.scheduledBells[0],id:'t2'}]});
check(validate(collision).some(x=>x.includes('bentrok')), 'Bel aktif bersamaan ditolak');
const differentDays = normalize({scheduledBells:[mod.scheduledBells[0],{...mod.scheduledBells[0],id:'t2',days:[2]}]});
check(validate(differentDays).length === 0, 'Jam sama pada hari berbeda diizinkan');
const inactive = normalize({scheduledBells:[mod.scheduledBells[0],{...mod.scheduledBells[0],id:'t2',isActive:false}]});
check(validate(inactive).length === 0, 'Bel nonaktif tidak dianggap benturan');
const noInjection = normalize({scheduledBells:[{...mod.scheduledBells[0],toneType:'FIRE'}]});
check(noInjection.scheduledBells[0].toneType === 'PERIOD_CHANGE', 'Nada sirene darurat tidak bisa disisipkan ke bel sekolah');
const editor=fs.readFileSync(paths[1],'utf8');
check(editor.includes("['schedule','Jadwal Bel']"), 'Tab Jadwal Bel tersedia');
check(editor.includes('Tambah Sesi') && editor.includes('Hapus sesi jadwal bel'), 'Admin dapat menambah dan menghapus sesi');
check(editor.includes('saveCommandCenterConfig(draft, currentUser.id, original)'), 'Penyimpanan memakai layanan admin yang ada');
const card=fs.readFileSync(paths[2],'utf8');
check(!card.includes('DEFAULT_SCHEDULED_BELLS'), 'Jadwal tidak hardcoded lagi di tampilan');
check(card.includes("timeZone:'Asia/Jakarta'"), 'Hitung mundur mengikuti WIB');
check(card.includes('tidak memutar suara otomatis'), 'Tidak mengklaim jadwal menyalakan audio otomatis');
const command=fs.readFileSync(paths[3],'utf8');
check(command.includes('commandConfig.scheduledBells.filter'), 'Pusat Komando menampilkan jadwal yang dikonfigurasi');
const service=fs.readFileSync(paths[4],'utf8');
check(service.includes("userSnap.data()?.role !== 'ADMIN'") && service.includes('expectedConfig'), 'Hak admin dan konflik update tetap berlaku');
console.log(`OK ${checks}/${checks} pemeriksaan R23 lulus`);
