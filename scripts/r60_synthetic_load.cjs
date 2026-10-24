#!/usr/bin/env node
/** R60 LOCAL SYNTHETIC LOAD TEST. NEVER targets Firebase, Vercel, or user databases. */
'use strict';
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');

const num = (flag, fallback, max) => {
  const pos=process.argv.indexOf(flag);
  if(pos<0) return fallback;
  const value=Number(process.argv[pos+1]);
  if(!Number.isInteger(value)||value<1||value>max)throw Error(`${flag} harus 1–${max}`);
  return value;
};
const teachers=num('--users',50,100);
const concurrency=num('--concurrency',25,50);
const stageTimeout=7000;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const p95 = values => {if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return +sorted[Math.min(sorted.length-1,Math.ceil(.95*sorted.length)-1)].toFixed(1);};

function mockServer() {
  const records=new Map();
  const settled=new Map();
  const active=new Map();
  const hits=new Map();
  const counts={writes:0,transient503:0,unknown504:0,requests:0};
  const server=http.createServer(async(req,res)=>{
    // Loopback-only mock endpoint. No Firebase or external service calls.
    if(req.url!=='/synthetic-operation'||req.method!=='POST'){res.writeHead(404);res.end();return;}
    counts.requests++;
    let raw='';
    for await(const chunk of req){raw+=chunk;if(raw.length>512){res.writeHead(413);res.end();return;}}
    let payload;
    try{payload=JSON.parse(raw)}catch{res.writeHead(400);res.end();return;}
    const {operationId,uid,action}=payload;
    if(!/^r60-(in|out)-TEST-\d{3}$/.test(operationId)||!/^TEST-\d{3}$/.test(uid)||!['in','out'].includes(action)){
      res.writeHead(422);res.end();return;
    }
    const hit=(hits.get(operationId)||0)+1;hits.set(operationId,hit);
    const numeric=Number(uid.slice(-3));
    // Fault before commit. A different concurrent request/retry can still commit.
    if(hit===1 && numeric%13===0){counts.transient503++;res.writeHead(503);res.end('retry');return;}
    if(!active.has(operationId)){
      const work=(async()=>{
        if(settled.has(operationId))return settled.get(operationId);
        await sleep(2+numeric%9);
        const current=records.get(uid)||{checkIn:0,checkOut:0};
        if(action==='in') current.checkIn++;
        else {
          if(current.checkIn!==1)throw Error('check-out-before-check-in');
          current.checkOut++;
        }
        records.set(uid,current);
        counts.writes++;
        settled.set(operationId,{ok:true,operationId});
        return settled.get(operationId);
      })();
      active.set(operationId,work);
      work.then(()=>active.delete(operationId),()=>active.delete(operationId));
    }
    try{
      const data=await active.get(operationId);
      // Simulate acknowledgement lost AFTER committed once; clients must retry same key.
      if(hit===1&&numeric%11===0){counts.unknown504++;res.writeHead(504);res.end('unknown');return;}
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
    }catch{res.writeHead(500);res.end('failure');}
  });
  return {server,records,counts};
}
function pool(items,max,run){let idx=0;const results=new Array(items.length);return Promise.all(Array.from({length:Math.min(max,items.length)},async()=>{
  while(true){const n=idx++;if(n>=items.length)break;results[n]=await run(items[n]);}
})).then(()=>results);}
async function main(){
  const mock=mockServer();
  await new Promise((resolve,reject)=>{mock.server.once('error',reject);mock.server.listen(0,'127.0.0.1',resolve)});
  const endpoint=`http://127.0.0.1:${mock.server.address().port}/synthetic-operation`;
  const latencies=[];let attempts=0,retries=0,failed=0;
  async function send(op){
    const started=performance.now();
    try {
      for(let n=0;n<5;n++){
        attempts++;
        let status;
        try{
          const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(op),signal:AbortSignal.timeout(stageTimeout)});
          status=res.status;
          if(status===200){latencies.push(performance.now()-started);return true;}
        }catch{status=503;}
        if(![503,504,429].includes(status))break;
        retries++;await sleep(4*(n+1));
      }
      failed++;return false;
    }catch{failed++;return false;}
  }
  const people=Array.from({length:teachers},(_,i)=>`TEST-${String(i).padStart(3,'0')}`);
  const runStage=async(action)=>{
    // Every synthetic action arrives twice, as if sent from two browser tabs.
    // 20% of requests are queued 'offline', then sent with the same operationId.
    const ops=people.flatMap(uid=>[0,1].map(()=>({operationId:`r60-${action}-${uid}`,uid,action})));
    const delayed=ops.filter((_,index)=>index%5===0);
    const online=ops.filter((_,index)=>index%5!==0);
    const a=await pool(online,concurrency,send);
    await sleep(10); // simulated reconnection: no requests during the offline window
    const b=await pool(delayed,concurrency,send);
    assert.ok(a.every(Boolean)&&b.every(Boolean),`${action} had client failures`);
  };
  try{
    const start=performance.now();
    await runStage('in');await runStage('out');
    const elapsed=performance.now()-start;
    assert.equal(mock.counts.writes,teachers*2,'Duplicate logical writes detected');
    assert.equal(mock.records.size,teachers,'Wrong number of teachers');
    for(const rec of mock.records.values()){assert.equal(rec.checkIn,1);assert.equal(rec.checkOut,1)}
    const report={schema:'R60_SYNTHETIC_V1',environment:'loopback-mock-only',teachers,
      concurrency,logicalOperations:teachers*2,clientRequests:teachers*4,
      mockWrites:mock.counts.writes,httpAttempts:attempts,retries,failed,
      injectedTransient503:mock.counts.transient503,injectedLostAck504:mock.counts.unknown504,
      p95ClientMs:p95(latencies),elapsedMs:+elapsed.toFixed(1),
      invariants:{oneCheckInAndCheckOutPerTeacher:true,zeroFailedClientActions:true}};
    console.log(JSON.stringify(report,null,2));
  }finally {await new Promise(resolve=>mock.server.close(resolve));}
}
main().catch(error=>{console.error('R60 SYNTHETIC FAIL:',error.message);process.exitCode=1;});
