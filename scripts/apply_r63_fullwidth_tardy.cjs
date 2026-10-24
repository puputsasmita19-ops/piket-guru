#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {transformForm,transformModal} = require('./r63_mobile_tardy_transform.cjs');
const root = process.cwd();
const dry = process.argv.includes('--dry-run');
const targets = [
  ['src/features/student-tardiness/StudentTardyFormModal.tsx',transformForm],
  ['src/components/common/Modal.tsx',transformModal],
];
try {
  if (!fs.existsSync(path.join(root,'package.json'))) throw new Error('Jalankan dari root repository Piket Guru.');
  if (!fs.existsSync(path.join(root,'src/features/student-tardiness/StudentTardyMobileR63.css'))) throw new Error('Ekstrak CSS R63 ke folder src terlebih dahulu.');
  const changes = targets.map(([name,transform])=>{
    const file=path.join(root,name);
    if(!fs.existsSync(file)) throw new Error(`File source tidak ditemukan: ${name}`);
    const before=fs.readFileSync(file,'utf8');
    const after=transform(before);
    return {name,file,before,after};
  });
  if(dry) { console.log('R63 DRY RUN PASSED — kedua file sesuai, tidak ada file source diubah.'); process.exit(0); }
  // Stage every transformed file before modifying either destination.
  const staged=[]; const written=[];
  try {
    for(const item of changes){
      const tmp = `${item.file}.r63-${process.pid}.tmp`;
      fs.writeFileSync(tmp,item.after,{flag:'wx'});
      staged.push(tmp);
    }
    for(let i=0;i<changes.length;i++){
      fs.renameSync(staged[i],changes[i].file);
      written.push(changes[i]);
    }
  } catch (err) {
    for(const item of written) fs.writeFileSync(item.file,item.before,'utf8');
    throw err;
  } finally {
    for(const tmp of staged) if(fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  console.log('R63 APPLIED — modal mobile full-width + satu area scroll + penanda UI R63.');
  console.log('Jalankan tes, lint, build lalu commit/push.');
} catch(err) {
  console.error('R63 STOPPED SAFELY:',err.message);
  process.exitCode=1;
}
