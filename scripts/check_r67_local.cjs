'use strict';
/* Safe, read-only local gate. Does NOT contact or write Firebase production. */
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=process.cwd();
const required=['package.json','src/features/student-tardiness/StudentTardyFormModal.tsx','scripts/test_r67_concurrency.cjs'];
const issues=[];
for(const filename of required) if(!fs.existsSync(path.join(root,filename))) issues.push('Missing '+filename);
if(!fs.existsSync(path.join(root,'package-lock.json'))) issues.push('Missing package-lock.json; do not run npm ci until dependency tree is reconciled.');
const source=fs.existsSync(path.join(root,required[1]))?fs.readFileSync(path.join(root,required[1]),'utf8'):'';
if(!source.includes('data-r67="active"')) issues.push('R67 UI marker missing; source TSX has not been replaced.');
if(!fs.existsSync(path.join(root,'node_modules','typescript'))) issues.push('node_modules is missing; run npm ci on your own machine.');
if(issues.length){console.error('R67 PRECHECK FAILED');for(const x of issues)console.error(' - '+x);process.exit(1)}
const scripts=[
 ['R67 race tests',['node','scripts/test_r67_concurrency.cjs']],
 ...(fs.existsSync(path.join(root,'scripts/verify_photo_recap_r66.cjs'))?[['R66 photo report regressions',['node','scripts/verify_photo_recap_r66.cjs']]]:[]),
 ['TypeScript lint',['npm','run','lint']],
 ['Vite build',['npm','run','build']],
];
let fail=0;
for(const [label,argv] of scripts){
  console.log('\n========================================');
  console.log('R67 CHECK:',label);
  // On Windows .cmd/.bat must be executed through cmd.exe (shell:false
  // cannot execute npm.cmd directly on supported Node versions).
  const command = process.platform==='win32' && argv[0]==='npm' ? 'cmd.exe' : argv[0];
  const args = process.platform==='win32' && argv[0]==='npm'
    ? ['/d','/s','/c','npm',...argv.slice(1)] : argv.slice(1);
  const run=spawnSync(command,args,{
    cwd:root,stdio:'inherit',shell:false,timeout:180000,
  });
  if(run.error)console.error('R67 CHECK ERROR:',run.error.message);
  if(run.status!==0){console.error('R67 FAIL:',label,'exit',run.status);fail++;}
  else console.log('R67 PASS:',label);
}
if(fail){console.error(`\nR67 LOCAL GATE: FAIL (${fail} checks). Do not push until resolved.`);process.exit(1)}
console.log('\nR67 LOCAL GATE: PASS. This is NOT a staging/production load-test certificate.');
