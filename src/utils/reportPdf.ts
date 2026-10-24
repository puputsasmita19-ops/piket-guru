// Imported only when a report is previewed/downloaded. No server rendering or external PDF service.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { SchoolSettings } from '../types';
import { letterheadLines, normalizeLetterhead, reportSigners } from './reportBranding';
import { loadReportAssets, normalizeReportPrint, reportPaper, reportPageLabel, type OperationalReport, type ReportAsset } from './operationalReport';
import type { PhotoRecapItem } from '../types/watermark.types';

const PT = 25.4 / 72;
let fonts: Promise<string[]> | undefined;
async function fontFiles() {
  if (!fonts) fonts = Promise.all(['regular', 'bold'].map(async name => {
    const response = await fetch(`/report-fonts/${name}.ttf`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Font laporan belum tersedia. Muat ulang aplikasi atau periksa pembaruan berkas public.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 100 || bytes[0] !== 0 || bytes[1] !== 1) throw new Error('Berkas font laporan tidak valid.');
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })).catch(e => { fonts = undefined; throw e; });
  return fonts;
}
const text = (v: unknown) => String(v ?? '-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\t/g, ' ');

async function pdfDocument(settings: SchoolSettings) {
  const config = normalizeReportPrint(settings.printConfig), paper = reportPaper(config);
  const [fontData, assets] = await Promise.all([fontFiles(), loadReportAssets(settings)]);
  const doc = new jsPDF({ unit: 'mm', format: [paper.width, paper.height], orientation: config.orientation, compress: true, putOnlyUsedFonts: true });
  for (const [i, style] of ['normal', 'bold'].entries()) { doc.addFileToVFS(`PiketReport-${style}.ttf`, fontData[i]); doc.addFont(`PiketReport-${style}.ttf`, 'PiketReport', style); }
  doc.setFont('PiketReport'); doc.setTextColor(0);
  const left = config.marginLeftMm, right = paper.width - config.marginRightMm, width = right - left;
  const bottom = paper.height - config.marginBottomMm - (config.showPageNumbers ? 7 : 0);
  const write = (value: unknown, x: number, y: number, size = 9, bold = false, align: 'left' | 'center' | 'right' = 'left', maxWidth = width, family = 'PiketReport') => {
    doc.setFont(family, bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(0);
    const lines: string[] = doc.splitTextToSize(text(value), Math.max(5, maxWidth));
    doc.text(lines, x, y, { align, lineHeightFactor: 1.25 }); return lines.length * size * PT * 1.25;
  };
  const image = (asset: ReportAsset, x: number, y: number, w: number, h: number) => {
    const ratio = Math.min(w / asset.width, h / asset.height), iw = asset.width * ratio, ih = asset.height * ratio;
    doc.addImage(asset.dataUrl, 'PNG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  };
  const letterhead = () => {
    let y = config.marginTopMm;
    if (!config.showLetterhead) return y;
    const letter = normalizeLetterhead(settings.letterheadConfig, settings), logo = config.showLogo && assets.find(a => a.key === 'logo');
    const textWidth = width - (logo ? 2 * (letter.logoWidthMm + 3) : 0), start = y;
    for (const line of letterheadLines(letter)) { y += line.size * PT; y += write(line.text, (left + right) / 2, y, line.size, line.bold, 'center', textWidth, letter.fontFamily === 'Times New Roman' ? 'times' : 'PiketReport') - line.size * PT + .7; }
    if (logo) { const h = Math.max(y - start, letter.logoWidthMm); image(logo, left, start, letter.logoWidthMm, Math.min(32, h)); y = Math.max(y, start + Math.min(32, h)); }
    y += 2; doc.setDrawColor(0); doc.setLineWidth(.3);
    if (letter.borderStyle !== 'none') doc.line(left, y, right, y);
    if (letter.borderStyle === 'double') doc.line(left, y + .8, right, y + .8);
    return y + 5;
  };
  const signatures = (y: number, date?: string, city?: string) => {
    if (!config.showSignatures) return y;
    const signers = reportSigners(settings), half = width / 2;
    const dateText = [city ?? settings.reportCity, date || new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())].filter(Boolean).join(', ');
    doc.setFont('PiketReport', 'normal'); doc.setFontSize(9);
    const headingHeight = Math.max(1, doc.splitTextToSize(dateText, half - 8).length) * 9 * PT * 1.25;
    const nameHeights = signers.map(s => { doc.setFont('PiketReport', 'bold'); doc.setFontSize(9); return doc.splitTextToSize(s.name || '________________', half - 8).length * 9 * PT * 1.25; });
    doc.setFont('PiketReport', 'normal'); doc.setFontSize(8);
    const idHeight = Math.max(...signers.map(s => s.id ? doc.splitTextToSize(`${s.idType || 'ID'}: ${s.id}`, half - 8).length * 8 * PT * 1.25 : 0));
    const height = 6 + headingHeight + 2 + 24 + Math.max(...nameHeights) + 2 + idHeight;
    if (y + height > bottom) { doc.addPage(); y = config.marginTopMm; }
    const top = y + 6, roleY = top + headingHeight + 2;
    signers.forEach((s, i) => {
      const x = left + half * i, center = x + half / 2;
      write(s.key === 'principal' ? 'Mengetahui' : dateText, center, top, 9, false, 'center', half - 8);
      write(s.role + ',', center, roleY, 9, false, 'center', half - 6);
      const asset = assets.find(a => a.key === s.key); if (asset) image(asset, x + 8, roleY + 3, half - 16, 17);
      const nameY = roleY + 24; write(s.name || '________________', center, nameY, 9, true, 'center', half - 8);
      // Underline each name line, including wrapped names; never underline the ID.
      doc.setFont('PiketReport', 'bold'); doc.setFontSize(9); doc.setDrawColor(0); doc.setLineWidth(.2);
      const lines = doc.splitTextToSize(s.name || '________________', half - 8) as string[];
      lines.forEach((line, index) => { const w = doc.getTextWidth(line), baseline = nameY + index * 9 * PT * 1.25; doc.line(center - w / 2, baseline + .7, center + w / 2, baseline + .7); });
      if (s.id) write(`${s.idType || 'ID'}: ${s.id}`, center, nameY + nameHeights[i] + 1, 8, false, 'center', half - 8);
    });
    return y + height;
  };
  const finish = () => {
    const total = doc.getNumberOfPages();
    if (config.showPageNumbers) for (let p = 1; p <= total; p++) {
      doc.setPage(p); const align = config.pageNumberPosition || 'center';
      const x = align === 'left' ? left : align === 'right' ? right : (left + right) / 2;
      write(reportPageLabel(p, total, config), x, paper.height - Math.max(6, config.marginBottomMm / 2), 8, false, align);
    }
    return new Uint8Array(doc.output('arraybuffer'));
  };
  return { doc, config, paper, left, right, width, bottom, write, letterhead, signatures, finish };
}

export async function createReportPdf(report: OperationalReport, settings: SchoolSettings): Promise<Uint8Array> {
  const f = await pdfDocument(settings), { doc, config, width, left } = f;
  doc.setProperties({ title: report.title, subject: report.period, author: settings.schoolName || '', creator: 'Piket Guru' });
  let y = f.letterhead(); y += f.write(report.title, left + width / 2, y + 3, 11, true, 'center') + 4;
  y += f.write(`Periode: ${report.period}`, left, y, 9) + 3;
  if (report.summary?.length) {
    const colWidth = width / 3;
    report.summary.forEach((item, index) => {
      const x = left + (index % 3) * colWidth, rowY = y + Math.floor(index / 3) * 14;
      doc.setDrawColor(205); doc.setFillColor(249, 249, 249); doc.setLineWidth(.15); doc.rect(x, rowY, colWidth, 14, 'FD');
      f.write(item.label, x + 2, rowY + 4, 8, false, 'left', colWidth - 4); f.write(item.value, x + 2, rowY + 10, 9, true, 'left', colWidth - 4);
    });
    y += Math.ceil(report.summary.length / 3) * 14 + 6;
  }
  const sections = report.sections || [{ title: '', headers: report.headers, rows: report.rows }];
  for (const section of sections) {
    // Keep a heading with the first table row, never move a whole long table as one block.
    if (y + 22 > f.bottom) { doc.addPage(); y = config.marginTopMm; }
    autoTable(doc, {
      startY: y, margin: { top: config.marginTopMm, left, right: config.marginRightMm, bottom: f.paper.height - f.bottom },
      head: [...(section.title ? [[{ content: section.title, colSpan: section.headers.length + 1, styles: { fillColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, cellPadding: { top: 3, bottom: 2, left: 0, right: 0 }, lineWidth: 0 } }]] : []), ['No', ...section.headers]], body: section.rows.length ? section.rows.map((row, i) => [String(i + 1), ...section.headers.map((_, j) => text(row[j]))]) : [['-', ...section.headers.map((_, i) => i === 0 ? 'Tidak ada catatan pada periode ini.' : '')]],
      styles: { font: 'PiketReport', fontSize: 8, cellPadding: 1.8, textColor: 0, lineColor: 175, lineWidth: .15, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [237, 239, 241], textColor: 0, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' } }, tableWidth: width, theme: 'grid', rowPageBreak: 'avoid', showHead: 'everyPage',
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
  f.signatures(y, report.date, report.city);
  return f.finish();
}

async function photoData(src: string, signal?: AbortSignal): Promise<string> {
  let url = '';
  try {
    if (src.startsWith('/api/drive/photo/')) { const { DriveClientService } = await import('../services/drive/driveClientService'); url = await DriveClientService.getAuthenticatedPhotoUrl(src.split('?')[0], signal); }
    else { const response = await fetch(src, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }); if (!response.ok) throw new Error('Foto tidak ditemukan'); const blob = await response.blob(); if (!blob.type.startsWith('image/') || blob.size > 10_000_000) throw new Error('Berkas foto tidak valid'); url = URL.createObjectURL(blob); }
    const img = new Image(); img.src = url; await img.decode(); const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas tidak tersedia'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .88);
  } finally { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }
}

export async function createPhotoReportPdf(photos: PhotoRecapItem[], settings: SchoolSettings, options: { perPage: 2 | 4; period: string; date: string; city: string; imageCache?: Map<string, string>; signal?: AbortSignal }): Promise<Uint8Array> {
  if (!photos.length) throw new Error('Pilih foto terlebih dahulu.');
  const f = await pdfDocument(settings), { doc, config } = f, total = Math.ceil(photos.length / options.perPage);
  doc.setProperties({ title: 'Lampiran Dokumentasi Bulanan', subject: options.period, creator: 'Piket Guru' });
  for (let page = 0; page < total; page++) {
    options.signal?.throwIfAborted();
    if (page) doc.addPage(); let y = f.letterhead();
    y += f.write('LAMPIRAN DOKUMENTASI BULANAN', f.left + f.width / 2, y + 3, 11, true, 'center') + 4;
    y += f.write(`Periode: ${options.period}`, f.left, y, 9) + 3;
    const final = page === total - 1, signatureSpace = final && config.showSignatures ? 55 : 0;
    // R66: dynamically reserve caption height before placing each uncropped image.
    const pageStart = page * options.perPage;
    const pageItems = photos.slice(pageStart, pageStart + options.perPage);
    const columns = options.perPage === 4 && pageItems.length > 1 ? 2 : 1;
    const rows = Math.ceil(pageItems.length / columns);
    const gap = 4;
    const cw = (f.width - (columns - 1) * gap) / columns;
    const ch = (f.bottom - y - signatureSpace - (rows - 1) * gap) / rows;
    if (ch < 35) throw new Error('Ruang rekap foto terlalu sempit. Pilih 2 foto per halaman, kurangi margin, atau ubah orientasi kertas.');
    for (let i = 0; i < pageItems.length; i++) {
      const photo = pageItems[i];
      const x = f.left + (i % columns) * (cw + gap);
      const top = y + Math.floor(i / columns) * (ch + gap);
      options.signal?.throwIfAborted();
      const cache = options.imageCache;
      let data = cache?.get(photo.photoUrl);
      if (!data) {
        data = await photoData(photo.photoUrl, options.signal);
        options.signal?.throwIfAborted();
        if (cache) {
          if (cache.size >= 24) cache.delete(cache.keys().next().value!);
          cache.set(photo.photoUrl, data);
        }
      }
      const compact = options.perPage === 4 && columns === 2;
      const titleSize = compact ? 7.3 : 8.4;
      const detailSize = compact ? 6.6 : 7.4;
      const parts: { value: string; size: number; bold: boolean }[] = [
        { value: photo.title, size: titleSize, bold: true },
        { value: photo.briefIdentity, size: detailSize, bold: false },
        { value: `Kejadian: ${photo.tanggalKejadian}${photo.waktuKejadian ? ` ${photo.waktuKejadian}` : ''}`, size: detailSize, bold: false },
        ...(photo.tanggalDokumentasi && photo.tanggalDokumentasi !== photo.tanggalKejadian ? [{ value: `Dokumentasi: ${photo.tanggalDokumentasi}`, size: detailSize, bold: false }] : []),
        ...(photo.petugasName ? [{ value: `Petugas: ${photo.petugasName}`, size: detailSize, bold: false }] : []),
      ].filter(part => part.value.trim());
      const captionWidth = cw - 7;
      const segments = parts.map(part => {
        doc.setFont('PiketReport', part.bold ? 'bold' : 'normal');
        doc.setFontSize(part.size);
        const lines = doc.splitTextToSize(text(part.value), captionWidth) as string[];
        return { ...part, lines, height: lines.length * part.size * PT * 1.24 + .6 };
      });
      const captionHeight = segments.reduce((sum, segment) => sum + segment.height, 0);
      const pad = 3, imageGap = 2.5;
      const imageBoxHeight = ch - 2 * pad - imageGap - captionHeight;
      if (imageBoxHeight < 22) {
        throw new Error('Keterangan foto tidak muat dengan rapi. Pilih 2 foto per halaman atau kurangi margin laporan.');
      }
      doc.setDrawColor(208, 216, 225); doc.setLineWidth(.2); doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, top, cw, ch, 2, 2, 'FD');
      const props = doc.getImageProperties(data);
      const scale = Math.min((cw - 2 * pad) / props.width, imageBoxHeight / props.height);
      const imgW = props.width * scale, imgH = props.height * scale;
      const imageY = top + pad;
      doc.addImage(data, 'JPEG', x + (cw - imgW) / 2, imageY + (imageBoxHeight - imgH) / 2, imgW, imgH);
      doc.setDrawColor(225, 231, 237); doc.setLineWidth(.15);
      doc.line(x + pad, imageY + imageBoxHeight + imageGap / 2, x + cw - pad, imageY + imageBoxHeight + imageGap / 2);
      let cursor = imageY + imageBoxHeight + imageGap;
      for (const segment of segments) {
        doc.setFont('PiketReport', segment.bold ? 'bold' : 'normal'); doc.setFontSize(segment.size); doc.setTextColor(25, 36, 52);
        doc.text(segment.lines, x + pad + .25, cursor + segment.size * PT, { lineHeightFactor: 1.24 });
        cursor += segment.height;
      }
      doc.setTextColor(0);
    }
    if (final) f.signatures(f.bottom - signatureSpace, options.date, options.city);
  }
  return f.finish();
}

export function downloadPdf(bytes: Uint8Array, title: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = title.replace(/[^\p{L}\p{N} _.-]/gu, '') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
