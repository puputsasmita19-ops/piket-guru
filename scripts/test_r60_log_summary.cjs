'use strict';
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const file=path.join(os.tmpdir(),`r60-log-${process.pid}.txt`);
try{
  fs.writeFileSync(file,`2026 [R60_HTTP] {"schema":"R60_HTTP_V1","group":"auth","statusClass":"5xx","rateLimited":false,"duration":"3-10s"}\n`+
    `2026 [R60_HTTP] {"schema":"R60_HTTP_V1","group":"drive","statusClass":"4xx","rateLimited":true,"duration":"lt300ms"}\n`+
    `UNTRUSTED PRIVATE_USER_ID SECRET-PIN 60012\n`+
    `2026 [R60_HTTP] {"schema":"R60_HTTP_V1","group":"other_api","statusClass":"2xx","rateLimited":false,"duration":"3-10s"}\n`+
    `2026 [R60_HTTP] {"schema":"invalid","group":"auth","statusClass":"5xx"}\n`);
  const r=spawnSync(process.execPath,[path.join(__dirname,'r60_log_summary.cjs'),'--file',file],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout.split('\nCATATAN:')[0]);
  assert.equal(result.matchedEvents,3);assert.equal(result.serverErrors5xx,1);assert.equal(result.rateLimited429,1);assert.equal(result.slowEvents,2);
  assert.equal(result.groups.auth,1);assert.equal(result.groups.drive,1);
  assert.doesNotMatch(r.stdout,/PRIVATE_USER_ID|SECRET-PIN|60012/);
  console.log('PASS: 7/7 R60 log aggregation checks');
}finally{fs.rmSync(file,{force:true})}
