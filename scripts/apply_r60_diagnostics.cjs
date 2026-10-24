#!/usr/bin/env node
/** R60 safe installer. Two existing files + two new helpers. Never edits data/rules. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const appRel = 'src/server/app.ts';
const mainRel = 'src/main.tsx';
const backendRel = 'src/server/middleware/r60ApiRequestMetrics.ts';
const clientRel = 'src/services/monitoring/r60BrowserDiagnostics.ts';
function exactly(source, needle, desc) {
  if (source.split(needle).length !== 2) throw Error(`${desc} tidak cocok (R60 belum aman diterapkan)`);
}
function prepare() {
  if (!fs.existsSync(path.join(root,'package.json'))) throw Error('Jalankan di root repo Piket Guru.');
  for (const file of [appRel,mainRel]) if (!fs.existsSync(path.join(root,file))) throw Error(`${file} tidak ditemukan.`);
  for (const file of [backendRel,clientRel]) if (fs.existsSync(path.join(root,file))) throw Error(`${file} sudah ada; tolak pemasangan ulang.`);
  const app = fs.readFileSync(path.join(root,appRel),'utf8');
  const main = fs.readFileSync(path.join(root,mainRel),'utf8');
  const loggerStart='  // Request logger for API calls';
  const loggerEnd='  // Mount API routes';
  exactly(app,loggerStart,'Awal logger API');
  exactly(app,loggerEnd,'Akhir logger API');
  const begin = app.indexOf(loggerStart), end = app.indexOf(loggerEnd);
  if (end <= begin || end - begin > 2000 || !app.slice(begin,end).includes('app.use(') || !app.slice(begin,end).includes('sanitizedBody')) {
    throw Error('Logger lama telah berubah; R60 STOPPED SAFELY.');
  }
  const serverImport = "import { r60ApiRequestMetrics } from './middleware/r60ApiRequestMetrics.js'; // R60-HTTP-METRICS";
  const serverAnchor="import { profilePhotoRouter } from './routes/profilePhotoRoutes.js';";
  exactly(app,serverAnchor,'Import app.ts');
  const newApp=app.replace(serverAnchor,serverAnchor+'\n'+serverImport)
    .slice(0); // clear naming for audit
  const appBegin=newApp.indexOf(loggerStart), appEnd=newApp.indexOf(loggerEnd);
  const updatedApp=newApp.slice(0,appBegin)+`  // R60-HTTP-METRICS: only coarse error/latency counts. No request bodies.\n  app.use(r60ApiRequestMetrics);\n\n`+newApp.slice(appEnd);
  const clientAnchor="import App from './App.tsx';";
  const renderAnchor="createRoot(document.getElementById('root')!).render(<App />);";
  exactly(main,clientAnchor,'Import main.tsx');
  exactly(main,renderAnchor,'React root');
  const updatedMain=main.replace(clientAnchor,clientAnchor+"\nimport { installR60BrowserDiagnostics } from './services/monitoring/r60BrowserDiagnostics'; // R60-CLIENT-DIAGNOSTICS")
    .replace(renderAnchor,'installR60BrowserDiagnostics();\n\n'+renderAnchor);
  const template=(x)=>fs.readFileSync(path.join(__dirname,'r60_templates',x),'utf8');
  return [
    [appRel,updatedApp,app],
    [mainRel,updatedMain,main],
    [backendRel,template('r60ApiRequestMetrics.ts'),null],
    [clientRel,template('r60BrowserDiagnostics.ts'),null],
  ].map(([relative,content,original])=>({relative,file:path.join(root,relative),content,original}));
}
try {
  const changes=prepare();
  if (dryRun) {
    console.log('R60 DRY RUN PASSED: kompatibel, tidak mengubah file.');
    for (const x of changes) console.log(x.original===null?'CREATE':'MODIFY',x.relative);
  } else {
    const changed=[];
    try {
      for (const x of changes) {
        fs.mkdirSync(path.dirname(x.file),{recursive:true});
        const temp=`${x.file}.r60-${process.pid}.tmp`;
        try {fs.writeFileSync(temp,x.content,{flag:'wx'});fs.renameSync(temp,x.file)}
        finally {if(fs.existsSync(temp))fs.unlinkSync(temp)}
        changed.push(x);
      }
    } catch (error) {
      for (const x of changed.reverse()) {
        if (x.original===null) fs.rmSync(x.file,{force:true});
        else fs.writeFileSync(x.file,x.original,'utf8');
      }
      throw error;
    }
    console.log('R60 APPLIED: sanitasi server log + diagnostik browser terpasang, belum dideploy.');
  }
} catch(error){console.error('R60 STOPPED SAFELY:',error.message);process.exitCode=1}
