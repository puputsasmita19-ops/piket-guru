#!/usr/bin/env node
/** One read-only health probe; never performs stress testing or authenticated actions. */
'use strict';
const {URL}=require('node:url');
const args=process.argv;
const index=args.indexOf('--url');
if(index<0||!args[index+1]){
  console.error('Contoh: node scripts/r60_health_probe.cjs --url https://domain-sekolah.vercel.app/api/health --i-understand-production');
  process.exit(2);
}
(async()=>{
  let url;
  try{url=new URL(args[index+1])}catch{throw Error('URL tidak valid')}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(!((url.protocol==='https:')||(loopback&&url.protocol==='http:')))throw Error('Hanya HTTPS atau localhost.');
  if(url.pathname!=='/api/health'||url.search||url.hash||url.username||url.password)throw Error('Hanya /api/health tanpa query/token.');
  if(!loopback&&!args.includes('--i-understand-production'))throw Error('Tambahkan --i-understand-production untuk satu pemeriksaan baca ke domain nyata.');
  const started=Date.now();
  // Exactly one GET, no redirects, no cookie/auth, and no POSTs.
  const res=await fetch(url,{method:'GET',redirect:'manual',headers:{'Accept':'application/json'},signal:AbortSignal.timeout(7000)});
  const text=await res.text();
  if(text.length>8192)throw Error('Health payload too large');
  let data={};try{data=JSON.parse(text)}catch{}
  const healthy=res.status===200 && data.status==='OK';
  console.log(JSON.stringify({schema:'R60_HEALTH_V1',httpStatus:res.status,healthy,
    durationMs:Date.now()-started,rateLimiterStatus:
      ['HEALTHY','DEGRADED','UNAVAILABLE'].includes(data?.authRateLimiter?.status)
        ?data.authRateLimiter.status:'UNVERIFIED'},null,2));
  if(!healthy)process.exitCode=1;
})().catch(error=>{console.error('R60 HEALTH FAIL:',error.message);process.exitCode=1});
