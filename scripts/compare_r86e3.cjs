#!/usr/bin/env node
'use strict';
/**
 * R86-E3 offline analyzer. Reads ONLY explicitly exported aggregate local JSON.
 * No network, Firebase SDK, browser profile, or authentication access.
 * Does not assert lower billed reads from listener counts.
 */
const fs=require('node:fs');const path=require('node:path');
const argv=process.argv.slice(2);
function arg(key,defaultValue){const i=argv.indexOf(key);return i===-1?defaultValue:argv[i+1];}
if(argv.includes('--help')){
 console.log('node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results');
 console.log('Input: JSON exported via window.__PIKET_R86E3__.download(); output: summary.json/.md');process.exit(0);
}
const input=arg('--input',null),out=arg('--out',null);
if(!input||!out){console.error('Usage: node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results');process.exit(2);}
const inDir=path.resolve(input),outDir=path.resolve(out);
if(!fs.existsSync(inDir)||!fs.statSync(inDir).isDirectory()){console.error('STOP: folder input tidak ditemukan.');process.exit(2);}
if(inDir===outDir||outDir.startsWith(inDir+path.sep)){console.error('STOP: --out harus di luar folder raw input.');process.exit(2);}
const files=fs.readdirSync(inDir).filter(name=>/^r86e3_(?:baseline|pilot)_[1235]_[1-5]\.json$/.test(name)).sort();
const errors=[];
const scenarios=new Map();
const modes=['baseline','pilot'];
const ns=[1,2,3,5];
const fields=['opened','active','closed','emissions','errors'];
function valid(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0;}
function check(raw,file){
 if(raw.schema!=='piket-r86e3-v1'||raw.release!=='R86-E3'||!modes.includes(raw.arm)||!ns.includes(raw.tabCount)||!Number.isInteger(raw.tabIndex)||raw.tabIndex<1||raw.tabIndex>raw.tabCount)throw Error('header tidak valid');
 if(raw.r86cPresent!==true||raw.r86dPresent!==true)throw Error('R86-C/R86-D belum tersedia');
 if(raw.pilotFlagActive!==(raw.arm==='pilot'))throw Error('flag pilot tidak sesuai arm');
 if(!Array.isArray(raw.samples)||raw.samples.length<2||raw.samples.length>900||!valid(raw.durationMs)||!valid(raw.intervalMs))throw Error('sampel tidak lengkap/invalid');
 const match=file.match(/^r86e3_(baseline|pilot)_([1235])_([1-5])\.json$/);
 if(!match||match[1]!==raw.arm||Number(match[2])!==raw.tabCount||Number(match[3])!==raw.tabIndex)throw Error('nama berkas tidak sesuai metadata');
 let previous=-1;
 for(const s of raw.samples){
  if(!valid(s.elapsedMs)||s.elapsedMs<previous||s.elapsedMs>raw.durationMs+10000||typeof s.hidden!=='boolean'||typeof s.online!=='boolean')throw Error('sample timeline/visibility invalid');
  previous=s.elapsedMs;
  for(const type of ['collection','document','notification','announcement'])for(const fld of fields)if(!valid(s.counters?.[type]?.[fld]))throw Error(`counter invalid: ${type}.${fld}`);
  if(s.heapBytes!==null&&!valid(s.heapBytes))throw Error('heap invalid');
 }
 return raw;
}
function metrics(raw){
 const seq=raw.samples;let weighted=0,hiddenMs=0,weightedAll=0,max=0,peerMs=0,covered=0,heapWeighted=0,heapTime=0;
 let hiddenContinuous=0,longestHiddenMs=0;
 // Last-known value describes next interval, capped at recording end.
 for(let i=0;i<seq.length;i++){
  const s=seq[i];const end=i+1<seq.length?seq[i+1].elapsedMs:raw.durationMs;
  const dt=Math.max(0,Math.min(raw.durationMs,end)-s.elapsedMs); if(!dt)continue;
  covered+=dt;const collection=s.counters.collection.active;
  weighted+=collection*dt;weightedAll+=Object.values(s.counters).reduce((n,o)=>n+o.active,0)*dt;
  max=Math.max(max,collection);
  if(s.hidden){hiddenMs+=dt;hiddenContinuous+=dt;longestHiddenMs=Math.max(longestHiddenMs,hiddenContinuous);}else hiddenContinuous=0;
  if(s.peersVisible!==null&&s.peersVisible>0)peerMs+=dt;
  if(s.heapBytes!==null){heapWeighted+=s.heapBytes*dt;heapTime+=dt;}
 }
 const first=seq[0].counters,last=seq[seq.length-1].counters;
 const deltas={};
 for(const type of ['collection','document','notification','announcement']){
  deltas[type]={};for(const field of fields){if(field==='active')continue;
   const n=last[type][field]-first[type][field];deltas[type][field]=n<0?null:n;
  }
 }
 return {durationMs:raw.durationMs,coveredMs:covered,samples:seq.length,hiddenMs,longestHiddenMs,visiblePeerMs:peerMs,
  collectionAvg:covered>0?weighted/covered:null,allSourcesAvg:covered>0?weightedAll/covered:null,
  collectionPeak:max,collectionListenerMinutes:weighted/60000,
  heapAvgMB:heapTime>0?heapWeighted/heapTime/1048576:null,
  deltas,
  warnings:[...(raw.durationMs<180000?['OBSERVATION_TOO_SHORT_UNDER_3MIN']:[]),
    ...(raw.durationMs>0&&covered/raw.durationMs<.85?['SAMPLE_COVERAGE_UNDER_85_PERCENT']:[]),
    ...(raw.tabIndex>1&&hiddenMs<120000?['NOT_BACKGROUND_FOR_2_MINUTES']:[]),
    ...(raw.tabIndex>1&&seq.some(s=>s.peersVisible!==null)&&peerMs===0?['NO_R86B_VISIBLE_PEER_EVIDENCE']:[]),
    ...(raw.arm==='pilot'&&raw.tabIndex>1&&longestHiddenMs<120000?['PILOT_GRACE_NOT_OBSERVED']:[]),
    ...(Object.values(deltas).some(c=>Object.values(c).some(n=>n===null))?['COUNTER_RESET_DURING_RUN']:[]),
  ],};
}
for(const filename of files){
 try{const parsed=check(JSON.parse(fs.readFileSync(path.join(inDir,filename),'utf8')),filename);
  const key=`${parsed.tabCount}/${parsed.arm}`;const current=scenarios.get(key)||new Map();
  if(current.has(parsed.tabIndex))throw Error('tabIndex duplikat');
  current.set(parsed.tabIndex,{raw:parsed,stats:metrics(parsed)});scenarios.set(key,current);
 }catch(e){errors.push(`${filename}: ${e.message}`);}
}
const summary=[];
for(const tabCount of ns){
 const modesResult={};const warnings=[];
 for(const mode of modes){
  const set=scenarios.get(`${tabCount}/${mode}`)||new Map();
  const n=set.size;
  const runs=[...set.values()].map(x=>x.stats);
  const invalid=[...Array(tabCount)].map((_,i)=>i+1).filter(i=>!set.has(i));
  if(invalid.length)warnings.push(`MISSING_${mode.toUpperCase()}_TABS_${invalid.join('_')}`);
  for(const r of runs)for(const reason of r.warnings)if(!warnings.includes(reason))warnings.push(reason);
  const sum=(key)=>runs.reduce((v,r)=>v+(typeof r[key]==='number'?r[key]:0),0);
  modesResult[mode]={fileCount:n,requiredTabs:tabCount,tabIndexes:[...set.keys()].sort((a,b)=>a-b),
   totalAvgActiveCollections:n===tabCount?sum('collectionAvg'):null,
   totalListenerMinutes:n===tabCount?sum('collectionListenerMinutes'):null,
   totalAvgActiveAllSources:n===tabCount?sum('allSourcesAvg'):null,
   totalHiddenMinutes:sum('hiddenMs')/60000,
   totalOpenedEvents:n===tabCount?runs.reduce((s,r)=>s+(r.deltas.collection.opened??0),0):null,
   totalCallbackEvents:n===tabCount?runs.reduce((s,r)=>s+(r.deltas.collection.emissions??0),0):null,
   totalErrorEvents:n===tabCount?runs.reduce((s,r)=>s+(r.deltas.collection.errors??0),0):null,
   sampleCount:sum('samples'),details:[...set.entries()].sort((a,b)=>a[0]-b[0]).map(([index,val])=>({tabIndex:index,...val.stats})),
  };
 }
 const a=modesResult.baseline.totalAvgActiveCollections,b=modesResult.pilot.totalAvgActiveCollections;
 const complete=a!==null&&b!==null;
 if (complete && tabCount>1 && b>=a) warnings.push('NO_LISTENER_REDUCTION_OBSERVED');
 if (complete) {
  for (let i=0;i<tabCount;i++) {
   const before=modesResult.baseline.details[i]?.durationMs; const after=modesResult.pilot.details[i]?.durationMs;
   if (before && after && Math.abs(before-after)/Math.max(before,after)>.2 && !warnings.includes('DURATION_MISMATCH_OVER_20_PERCENT')) warnings.push('DURATION_MISMATCH_OVER_20_PERCENT');
  }
 }
 summary.push({tabCount,baseline:modesResult.baseline,pilot:modesResult.pilot,
  changeAvgActiveCollection:complete?Number((b-a).toFixed(3)):null,
  changePercent:complete&&a>0?Number(((b-a)/a*100).toFixed(2)):null,
  status:!complete?'INCOMPLETE':warnings.length?'REVIEW_WARNINGS':'READY_FOR_MANUAL_REVIEW',warnings});
}
const result={schema:'piket-r86e3-comparison-v1',inputFiles:files.length,acceptedFiles:files.length-errors.length,rejectedFiles:errors,
 scenarios:summary,doesNotMeasureFirestoreBillableReads:true,doesNotProveDataIntegrityOrSessionValidity:true,
 conclusion:'No automatic release/pass decision. Combine with Firebase usage, data integrity and manual staging checks.'};
const fmt=n=>typeof n==='number'?n.toFixed(2):'—';
const md=['# Piket Guru R86-E3 — Perbandingan Runtime', '',
 'Angka berikut berasal dari JSON ekspor lokal. **Bukan billed reads Firestore, bukan sertifikat keamanan, dan bukan bukti sesi Firebase valid.**', '',
 `File diterima: ${result.acceptedFiles}/${result.inputFiles}; file ditolak: ${result.rejectedFiles.length}.`, '',
 '| Tab | Listener collection rata-rata baseline | Pilot | Selisih | % | Status |', '|---:|---:|---:|---:|---:|---|',
 ...summary.map(s=>`| ${s.tabCount} | ${fmt(s.baseline.totalAvgActiveCollections)} | ${fmt(s.pilot.totalAvgActiveCollections)} | ${fmt(s.changeAvgActiveCollection)} | ${fmt(s.changePercent)} | ${s.status} |`),
 '', '## Peringatan',
 ...summary.map(s=>`- ${s.tabCount} tab: ${s.warnings.length?s.warnings.join('; '):'Tidak ada peringatan otomatis; tetap perlu review manual.'}`),
 ...(errors.length?['','## File ditolak',...errors.map(x=>`- ${x}`)]:[]),
 '', '## Batasan / Gate',
 '- Counter `opened`, `active`, `emissions` dari R86-C hanya mengukur instrumentasi client, bukan biaya Firestore.',
 '- Baseline dan pilot harus menggunakan kode/build, data, durasi, jalur menu Laporan, akun uji, serta profil browser yang sebanding.',
 '- Uji UI, real-time refresh, presensi, login, antrean offline, ekspor/cetak/foto harus lulus terpisah.',
 '- Untuk mengevaluasi penghematan biaya, bandingkan Firebase Usage dalam jendela waktu terpisah dengan trafik uji terkendali.',
 '- Durasi minimal 3 menit untuk melihat grace 2 menit, disarankan 4–5 menit. Background timer dapat ditunda browser.',
 '- `READY_FOR_MANUAL_REVIEW` tidak berarti siap produksi.',
 ''];
fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(outDir,'summary.md'),md.join('\n'));
console.log('R86-E3 compare selesai:',result.acceptedFiles,'valid JSON;',summary.map(s=>`${s.tabCount}-tab:${s.status}`).join(', '));
console.log('Laporan:',path.join(outDir,'summary.md'));
if(errors.length)process.exitCode=1;
