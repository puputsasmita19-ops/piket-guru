import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PrintLayoutConfig } from '../types';
import { normalizeReportPrint, printOperationalReport, reportPaper } from './operationalReport';

GlobalWorkerOptions.workerSrc = workerUrl;
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // PDF.js transfers its buffer to the worker; retain the original for download/print/retries.
  return getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
}

export async function printPdfDocument(bytes: Uint8Array, input?: Partial<PrintLayoutConfig>, progress?: (page: number, total: number) => void) {
  const config = normalizeReportPrint(input), paper = reportPaper(config), documentPdf = await openPdf(bytes), pages: string[] = [];
  const canvas = document.createElement('canvas');
  try {
    for (let i = 1; i <= documentPdf.numPages; i++) {
      const page = await documentPdf.getPage(i), viewport = page.getViewport({ scale: 2 });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Pratinjau cetak belum tersedia pada perangkat ini.');
      await page.render({ canvas, viewport, intent: 'print' }).promise;
      pages.push(`<section class="report-page"><img alt="Halaman ${i}" src="${canvas.toDataURL('image/png')}"></section>`);
      page.cleanup(); progress?.(i, documentPdf.numPages);
    }
    // Only these pages enter the print iframe. App cards/navigation/modal cannot be printed behind them.
    await printOperationalReport(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Cetak laporan</title><style>@page{size:${paper.width}mm ${paper.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.report-page{width:${paper.width}mm;height:${paper.height}mm;margin:0;padding:0;break-after:page;page-break-after:always;overflow:hidden}.report-page:last-child{break-after:auto;page-break-after:auto}.report-page img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body>${pages.join('')}</body></html>`);
  } finally { canvas.width = canvas.height = 1; await documentPdf.loadingTask.destroy(); }
}
