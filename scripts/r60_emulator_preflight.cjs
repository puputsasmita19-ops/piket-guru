#!/usr/bin/env node
/** Refuse unsafe test environments. Does not connect or mutate. */
'use strict';
const net=require('node:net');
const project=process.env.GCLOUD_PROJECT||process.env.FIREBASE_PROJECT_ID||'';
function hostOk(str){if(!str)return false;const m=/^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/.exec(str);return !!m&&Number(m[2])>0&&Number(m[2])<=65535;}
const checks={demoProject:/^demo-[a-z0-9-]+$/.test(project),firestoreLocal:hostOk(process.env.FIRESTORE_EMULATOR_HOST),authLocal:hostOk(process.env.FIREBASE_AUTH_EMULATOR_HOST),node22:Number(process.versions.node.split('.')[0])>=22};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({schema:'R60_EMULATOR_PREFLIGHT_V1',safeToRun:ok,checks,warning:'Belum menjalankan Emulator atau tes aturan; ini hanya pengaman lingkungan.'},null,2));
if(!ok)process.exitCode=1;
