#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {spawn}=require('node:child_process');
const probe=path.join(__dirname,'r60_health_probe.cjs');
const server=http.createServer((req,res)=>{
  assert.equal(req.method,'GET');
  assert.equal(req.url,'/api/health');
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({status:'OK',authRateLimiter:{status:'HEALTHY'},personName:'MUST-NOT-LOG'}));
});
const run=args=>new Promise(resolve=>{
  const child=spawn(process.execPath,[probe,...args]);
  let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
  child.on('close',status=>resolve({status,stdout,stderr}));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}/api/health`;
  const one=await run(['--url',url]);
  assert.equal(one.status,0,one.stderr);assert.match(one.stdout,/"healthy": true/);assert.doesNotMatch(one.stdout,/MUST-NOT-LOG/);
  console.log('PASS: one healthy loopback probe, PII excluded');
  const bad=await run(['--url',`http://127.0.0.1:${server.address().port}/api/private`]);
  assert.equal(bad.status,1);console.log('PASS: refuses non-health route');
  const insecure=await run(['--url','http://example.com/api/health','--i-understand-production']);
  assert.equal(insecure.status,1);console.log('PASS: refuses external insecure HTTP');
  const unapproved=await run(['--url','https://example.com/api/health']);
  assert.equal(unapproved.status,1);console.log('PASS: production requires explicit opt-in');
  const badQuery=await run(['--url',url+'?token=PRIVATE']);
  assert.equal(badQuery.status,1);console.log('PASS: URL with tokens/query is rejected');
  console.log('R60 health: 5/5 checks passed');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
