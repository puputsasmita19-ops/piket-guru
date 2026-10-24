#!/usr/bin/env node
/** Local reducer for copied R60-HTTP log lines; ignores all other raw log content. */
'use strict';
const fs=require('node:fs');
const args=process.argv;
const pos=args.indexOf('--file');
if(pos<0||!args[pos+1]){
  console.error('Usage: node scripts/r60_log_summary.cjs --file path/to/exported-vercel-log.txt');
  process.exit(2);
}
try{
  const stat=fs.statSync(args[pos+1]);
  if(stat.size>10*1024*1024)throw Error('Log terlalu besar (maksimum 10 MB).');
  const raw=fs.readFileSync(args[pos+1],'utf8');
  const allowed=new Set(['health','auth','drive','other_api','not_api']);
  const allowedStatus=new Set(['1xx','2xx','3xx','4xx','5xx']);
  const groups={};let lines=0,errors5xx=0,rateLimited=0,slow=0;
  for(const line of raw.split(/\r?\n/)){
    const match=line.match(/\[R60_HTTP\]\s*(\{[^\r\n}]*\})/);
    if(!match)continue;
    let obj;try{obj=JSON.parse(match[1]);}catch{continue;}
    if(obj?.schema!=='R60_HTTP_V1'||!allowed.has(obj.group)||!allowedStatus.has(obj.statusClass))continue;
    lines++;
    groups[obj.group]=(groups[obj.group]||0)+1;
    if(obj.statusClass==='5xx')errors5xx++;
    if(obj.rateLimited===true)rateLimited++;
    if(obj.duration==='3-10s'||obj.duration==='gte10s')slow++;
  }
  console.log(JSON.stringify({schema:'R60_LOG_SUMMARY_V1',matchedEvents:lines,serverErrors5xx:errors5xx,
    rateLimited429:rateLimited,slowEvents:slow,groups},null,2));
  console.log('CATATAN: log hanya memuat kegagalan dan respons lambat; ini BUKAN persentase error total.');
}catch(error){console.error('R60 LOG SUMMARY FAIL:',error.message);process.exitCode=1}
