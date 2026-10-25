#!/usr/bin/env node
'use strict';
// R86-E2 install: modify only the ReportsPreview component in the CURRENT checkout.
// Preview by default; use --apply to write. Fail closed for unexpected source layout.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.cwd());
const rel='src/features/reports/ReportsPreview.tsx';
const file=path.join(root,rel);
const apply=process.argv.includes('--apply');
function stop(reason){ console.error('STOP R86-E2:',reason);process.exit(2); }
if(!fs.existsSync(file))stop('ReportsPreview.tsx tidak ditemukan; jangan menimpa source dengan arsip lama.');
const original=fs.readFileSync(file,'utf8');
const marker='// R86-E2: report-only controlled optimization pilot (read-only listeners)';
if(original.includes(marker)){
  console.log('R86-E2 already installed. No changes.');process.exit(0);
}
const importAnchor="import React, { useState, useEffect, useMemo } from 'react';";
const stateAnchor="  // Master Data Subscription (schedules, teachers, categories, settings)";
const operationalAnchor="  // Operational Data Subscriptions bounded strictly by computed date range";
const effectStart=`${operationalAnchor}\n  useEffect(() => {\n    let active = true;`;
const effectEnd="  }, [startDate, endDate]);";
const busyAnchor="  const [watermarkReviewConfirm, setWatermarkReviewConfirm] = useState(false);";
for (const [label,anchor] of [['React import',importAnchor],['master subscriptions',stateAnchor],['operational listener effect',effectStart],['operation dependency array',effectEnd],['editing state',busyAnchor]]) {
  const count=original.split(anchor).length-1;
  if(count!==1)stop(`${label}: anchor ditemukan ${count} kali (harus tepat 1). Source HEAD berbeda; audit manual diperlukan.`);
}
const opStart=original.indexOf(operationalAnchor);
const opEnd=original.indexOf(effectEnd,opStart);
if(opStart<0||opEnd<opStart||opEnd-opStart>6500)stop('Boundary effect operasional tidak sesuai; hentikan pemasangan.');
let result=original.replace(importAnchor,`${importAnchor}\nimport { useR86E2ReportLive } from '../../services/multitab/useR86E2ReportLive';`);
result=result.replace(busyAnchor,`${busyAnchor}\n\n  ${marker}\n  // Conservative opt-in: never pause during modal, export, photo editing, or server writes.\n  const reportRealtimeEnabled = useR86E2ReportLive(\n    isExportingDocument || isReportActionsOpen || isPrintModalOpen || isPhotoRecapPrintOpen ||\n    bulkReviewBusy || bulkReviewItems.length > 0 || visitorPhotoMoveBusy ||\n    watermarkReviewBusy || previewPhotoItem !== null\n  );`);
result=result.replace(effectStart,`${operationalAnchor}\n  useEffect(() => {\n    // When resuming the tab, keep report export controls in loading state until fresh snapshots arrive.\n    if (!reportRealtimeEnabled) { setIsLoadingData(true); return; }\n    let active = true;`);
result=result.replace(effectEnd,'  }, [startDate, endDate, reportRealtimeEnabled]);');
if(result===original)stop('Tidak ada modifikasi; periksa source.');
// Check that all 7 subscriptions remain in the operational effect, rather than deleting one.
const section=result.slice(result.indexOf(operationalAnchor),result.indexOf('  }, [startDate, endDate, reportRealtimeEnabled]);'));
const count=(section.match(/FirestoreService\.subscribeToCollection/g)||[]).length;
if(count!==7)stop(`Jumlah 7 listener laporan tidak cocok, ditemukan ${count}; hentikan pemasangan.`);
if(!apply){console.log('R86-E2 dry-run OK. Would modify:',rel);console.log('Add two new files under src/services/multitab/ from ZIP.');console.log('Use --apply to change ONLY the current ReportsPreview.tsx.');process.exit(0);}
fs.writeFileSync(file,result);
console.log('APPLIED R86-E2:',rel);console.log('Opt-in only; no Firebase/Auth/OfflineStorage modifications.');
