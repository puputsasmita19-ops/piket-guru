#!/usr/bin/env node
/** Exactly two read-only GET requests to explicitly confirmed STAGING origin. No credentials. */
'use strict';
const args=process.argv.slice(2);
const dryRun=args.includes('--dry-run');
const stageProject=process.env.R60_STAGING_PROJECT_ID;
const productionProject=process.env.R60_PRODUCTION_PROJECT_ID;
const urlString=process.env.R60_STAGING_URL;
const confirmed=process.env.R60_STAGING_CONFIRMED==='YES';
function deny(msg){throw Error(`R60 STAGING REFUSED: ${msg}`)}
function validate(){
 if(!stageProject||!productionProject||stageProject===productionProject)deny('ID proyek staging dan produksi wajib berbeda dan eksplisit.');
 if(!/^[a-z0-9][a-z0-9-]{4,70}$/i.test(stageProject)||!/^[a-z0-9][a-z0-9-]{4,70}$/i.test(productionProject))deny('Format ID proyek tidak valid');
 if(!confirmed)deny('Set R60_STAGING_CONFIRMED=YES setelah memeriksa pengaturan Firebase staging secara manual.');
 let url;try{url=new URL(urlString)}catch{deny('Set R60_STAGING_URL ke alamat staging yang valid.');}
 if(url.pathname!=='/'||url.search||url.hash||url.username||url.password)deny('URL harus origin staging tanpa path/query/kredensial.');
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!local&&url.protocol!=='https:')deny('Staging jarak jauh wajib HTTPS.');
 if(local&&!['http:','https:'].includes(url.protocol))deny('Skema tidak aman');
 // Exact host allowlist prevents accidental use of the normal school production URL.
 const allowedHost=process.env.R60_STAGING_HOST;
 if(!allowedHost||allowedHost!==url.hostname)deny('Set R60_STAGING_HOST tepat sama dengan hostname staging.');
 if(!local&&!(/(^|[-.])(staging|preview|git)([-.]|$)/i.test(url.hostname)))deny('Nama host harus menunjukkan lingkungan staging/preview (bukan alamat produksi).');
 return url;
}
(async()=>{
 const origin=validate();
 if(dryRun){console.log('R60 STAGING DRY RUN PASSED (tidak ada jaringan). Verifikasi manual pemisahan proyek tetap wajib.');return;}
 const started=Date.now();
 // Read-only: no auth, cookies, writes, photos, rules changes, or load testing.
 const health=new URL('/api/health',origin);
 const res=await fetch(health,{method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
 if(res.status!==200)deny('Health harus HTTP 200; aktual HTTP '+res.status);
 const buffer=await res.arrayBuffer(); if(buffer.byteLength>8192)deny('Respons health terlalu besar');
 let body;try{body=JSON.parse(Buffer.from(buffer).toString('utf8'));}catch{deny('Respons health bukan JSON');}
 if(body?.status!=='OK')deny('Health status tidak OK');
 const rootRes=await fetch(new URL('/',origin),{method:'GET',redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(8000)});
 if(rootRes.status!==200)deny('Halaman utama harus HTTP 200; aktual HTTP '+rootRes.status);
 if(!String(rootRes.headers.get('content-type')||'').includes('text/html'))deny('Halaman utama bukan HTML');
 await rootRes.body?.cancel().catch(()=>{});
 console.log(JSON.stringify({schema:'R60_STAGING_READONLY_V1',result:'PASS',health:200,appShell:200,durationMs:Date.now()-started,
   limitations:'Hanya smoke GET; tidak menguji Firestore Auth, transaksi, upload, atau beban banyak pengguna.'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
