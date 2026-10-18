import type { PrintLayoutConfig, SchoolSettings } from '../types';
import { letterheadLogo, letterheadLines, normalizeLetterhead, reportSigners } from './reportBranding';

export interface ReportSection { title: string; headers: string[]; rows: (string | number | null | undefined)[][] }
export interface OperationalReport { title: string; period: string; headers: string[]; rows: ReportSection['rows']; sections?: ReportSection[]; summary?: { label: string; value: string }[]; date?: string; city?: string }
export const DEFAULT_OPERATIONAL_PRINT: PrintLayoutConfig = { paperSize: 'A4', orientation: 'portrait', marginTopMm: 15, marginRightMm: 15, marginBottomMm: 15, marginLeftMm: 15, showLogo: true, showLetterhead: true, showSignatures: true };
export function normalizeReportPrint(input?: Partial<PrintLayoutConfig>): PrintLayoutConfig {
  const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  return { paperSize: input?.paperSize === 'F4' ? 'F4' : 'A4', orientation: input?.orientation === 'landscape' ? 'landscape' : 'portrait', f4WidthMm: number(input?.f4WidthMm, 215, 180, 240), f4HeightMm: number(input?.f4HeightMm, 330, 280, 360), marginTopMm: number(input?.marginTopMm, 15, 5, 40), marginBottomMm: number(input?.marginBottomMm, 15, 5, 40), marginLeftMm: number(input?.marginLeftMm, 15, 5, 40), marginRightMm: number(input?.marginRightMm, 15, 5, 40), showLogo: input?.showLogo ?? true, showLetterhead: input?.showLetterhead ?? true, showSignatures: input?.showSignatures ?? true, signatureOrder: input?.signatureOrder === 'coordinator_left' ? 'coordinator_left' : 'principal_left', showPageNumbers: input?.showPageNumbers !== false, pageNumberPosition: input?.pageNumberPosition === 'left' || input?.pageNumberPosition === 'right' ? input.pageNumberPosition : 'center', pageNumberFormat: input?.pageNumberFormat === 'page_only' ? 'page_only' : 'page_of_total', pageNumberStart: Math.round(number(input?.pageNumberStart, 1, 1, 999)) };
}
export function reportPageLabel(page: number, total: number, input?: Partial<PrintLayoutConfig>) {
  const config = normalizeReportPrint(input), start = config.pageNumberStart || 1;
  return config.pageNumberFormat === 'page_only' ? `Halaman ${page + start - 1}` : `Halaman ${page + start - 1} dari ${total + start - 1}`;
}
export const reportEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
export function reportPaper(config: PrintLayoutConfig) {
  const width = config.paperSize === 'F4' ? config.f4WidthMm || 215 : 210;
  const height = config.paperSize === 'F4' ? config.f4HeightMm || 330 : 297;
  return config.orientation === 'landscape' ? { width: height, height: width } : { width, height };
}
export interface ReportAsset { key: string; data: Uint8Array; width: number; height: number; dataUrl: string }
export async function loadReportAssets(settings: SchoolSettings): Promise<ReportAsset[]> {
  const config = normalizeReportPrint(settings.printConfig), assets: ReportAsset[] = [];
  const sources = [config.showLetterhead && config.showLogo && ['logo', letterheadLogo(settings)], config.showSignatures && ['principal', settings.principalSignatureUrl], config.showSignatures && ['coordinator', settings.coordinatorSignatureUrl]].filter(Boolean) as [string, string | undefined][];
  for (const [key, src] of sources) {
    if (!src) continue;
    let objectUrl = '', imageUrl = '';
    try {
      if (src.startsWith('/api/drive/photo/')) {
        const { DriveClientService } = await import('../services/drive/driveClientService');
        imageUrl = await DriveClientService.getAuthenticatedPhotoUrl(src.split('?')[0]); objectUrl = imageUrl;
      } else {
        if (!/^(data:image\/(png|jpeg|webp|gif|svg\+xml);base64,|https?:\/\/|\/[^\/])/i.test(src)) throw new Error('Format gambar tidak didukung');
        const response = await fetch(src, { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error('Gambar tidak ditemukan');
        const blob = await response.blob(); if (blob.size > 5_000_000 || !blob.type.startsWith('image/')) throw new Error('Gambar tidak valid');
        imageUrl = URL.createObjectURL(blob); objectUrl = imageUrl;
      }
      const image = new Image(); image.src = imageUrl; await image.decode();
      const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas tidak tersedia'); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png'), bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
      const logoWidth = normalizeLetterhead(settings.letterheadConfig, settings).logoWidthMm * 96 / 25.4;
      const limitHeight = key === 'logo' ? 32 * 96 / 25.4 : 40, limitWidth = key === 'logo' ? logoWidth : 120;
      const fit = Math.min(limitWidth / canvas.width, limitHeight / canvas.height);
      assets.push({ key, data: bytes, dataUrl, width: canvas.width * fit, height: canvas.height * fit });
    } catch { throw new Error('Logo atau tanda tangan pada pengaturan cetak belum dapat dimuat. Periksa gambar di pengaturan admin lalu coba kembali.'); }
    finally { if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl); }
  }
  return assets;
}
export function operationalReportHtml(report: OperationalReport, settings: SchoolSettings, assets: ReportAsset[] = []): string {
  const p = normalizeReportPrint(settings.printConfig), paper = reportPaper(p), e = reportEscape;
  const img = (key: string) => { const a = assets.find(a => a.key === key); return a ? `<img alt="${key}" src="${a.dataUrl}" style="width:${a.width}px;height:${a.height}px;object-fit:contain">` : ''; };
  const letter = normalizeLetterhead(settings.letterheadConfig, settings);
  const withLogo = p.showLogo && assets.some(a => a.key === 'logo');
  const letterhead = `<header><div class="letterhead" style="font-family:'${letter.fontFamily}';display:grid;grid-template-columns:${withLogo ? `${letter.logoWidthMm + 3}mm minmax(0,1fr) ${letter.logoWidthMm + 3}mm` : 'minmax(0,1fr)'};align-items:center;padding-bottom:8px;border-bottom:${letter.borderStyle === 'double' ? '4px double #000' : letter.borderStyle === 'single' ? '1px solid #000' : '0'}">${withLogo ? `<div>${img('logo')}</div>` : ''}<div data-letterhead-text style="min-width:0">${letterheadLines(letter).map(line => `<p style="margin:1px 0;font-size:${line.size}pt;font-weight:${line.bold ? 700 : 400};line-height:1.25">${e(line.text)}</p>`).join('')}</div>${withLogo ? '<div aria-hidden="true"></div>' : ''}</div></header>`;

  const signer = (role: string, name?: string, idType?: string, id?: string, key?: string) => `<td style="width:50%;text-align:center;border:0"><p>${e(role)}</p><div style="height:48px">${key ? img(key) : ''}</div><strong style="text-decoration:underline;text-underline-offset:2px">${e(name || '________________')}</strong><p>${id ? e(`${idType || 'ID'}: ${id}`) : ''}</p></td>`;
  return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>${e(report.title)}</title><style>@page{size:${paper.width}mm ${paper.height}mm;margin:${p.marginTopMm}mm ${p.marginRightMm}mm ${p.marginBottomMm}mm ${p.marginLeftMm}mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#111;background:#fff;margin:0;line-height:1.4;overflow-wrap:anywhere}h1{font-size:15pt;margin:0 0 8px}h2{font-size:12pt;margin:12px 0 6px}p{margin:4px 0}header{text-align:center;margin-bottom:14px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt}th,td{border:1px solid #d9d9d9;padding:6px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#e8edf2;font-weight:bold}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}footer{margin-top:20px;break-inside:avoid}.summary{font-size:9pt;margin-bottom:10px}.signatures{margin-top:16px}.signatures td{vertical-align:top}</style></head><body>${p.showLetterhead ? letterhead : ''}<h2>${e(report.title)}</h2><p class="summary">Periode: ${e(report.period)}<br>Total: ${report.rows.length} catatan · Seluruh hasil filter aktif</p><table><thead><tr><th style="width:7%">No</th>${report.headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${report.rows.map((row, i) => `<tr><td>${i + 1}</td>${report.headers.map((_, index) => `<td>${e(row[index] ?? '-')}</td>`).join('')}</tr>`).join('')}</tbody></table>${p.showSignatures ? `<footer><table class="signatures"><tr>${reportSigners(settings).map(s => `<td style="width:50%;text-align:center;border:0">${e(s.key === 'principal' ? 'Mengetahui' : [report.city ?? settings.reportCity, report.date || new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())].filter(Boolean).join(', '))}</td>`).join('')}</tr><tr>${reportSigners(settings).map(s => signer(s.role, s.name, s.idType, s.id, s.key)).join('')}</tr></table></footer>` : ''}</body></html>`;
}

// A small standards-compliant ZIP writer (stored entries) for OOXML documents.
// No new runtime dependency and no HTML file disguised as .docx.
const encoder = new TextEncoder();
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function zip(entries: [string, Uint8Array][]): Uint8Array {
  const parts: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0, centralSize = 0;
  for (const [path, bytes] of entries) {
    const name = encoder.encode(path), crc = crc32(bytes), local = new Uint8Array(30 + name.length), a = new DataView(local.buffer);
    a.setUint32(0, 0x04034b50, true); a.setUint16(4, 20, true); a.setUint16(6, 0x800, true); a.setUint16(12, 0x21, true); a.setUint32(14, crc, true); a.setUint32(18, bytes.length, true); a.setUint32(22, bytes.length, true); a.setUint16(26, name.length, true); local.set(name, 30);
    const c = new Uint8Array(46 + name.length), b = new DataView(c.buffer); b.setUint32(0, 0x02014b50, true); b.setUint16(4, 20, true); b.setUint16(6, 20, true); b.setUint16(8, 0x800, true); b.setUint32(16, crc, true); b.setUint32(20, bytes.length, true); b.setUint32(24, bytes.length, true); b.setUint16(28, name.length, true); b.setUint32(42, offset, true); c.set(name, 46);
    b.setUint16(14, 0x21, true);
    parts.push(local, bytes); central.push(c); offset += local.length + bytes.length; centralSize += c.length;
  }
  const end = new Uint8Array(22), v = new DataView(end.buffer); v.setUint32(0, 0x06054b50, true); v.setUint16(8, entries.length, true); v.setUint16(10, entries.length, true); v.setUint32(12, centralSize, true); v.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length); let i = 0; for (const part of [...parts, ...central, end]) { result.set(part, i); i += part.length; } return result;
}
export function operationalReportDocx(report: OperationalReport, settings: SchoolSettings, assets: ReportAsset[] = []): Uint8Array {
  const e = reportEscape, config = normalizeReportPrint(settings.printConfig), paper = reportPaper(config), twip = (mm: number) => Math.round(mm * 1440 / 25.4);
  const paragraph = (text: unknown, bold = false, center = false, size = 20, style?: string, keepNext = false, underline = false) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${center ? '<w:jc w:val="center"/>' : ''}${keepNext ? '<w:keepNext/>' : ''}<w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:color w:val="000000"/><w:sz w:val="${size}"/>${bold ? '<w:b/>' : ''}${underline ? '<w:u w:val="single"/>' : ''}</w:rPr>${String(text ?? '').split('\n').map((line, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${e(line)}</w:t>`).join('')}</w:r></w:p>`;
  const image = (key: string) => { const a = assets.find(a => a.key === key); if (!a) return ''; const n = assets.indexOf(a) + 1, cx = Math.round(a.width * 9525), cy = Math.round(a.height * 9525); return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="${key}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${key}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`; };
  const width = twip(paper.width - config.marginLeftMm - config.marginRightMm), count = report.headers.length + 1, numberWidth = 450, cellWidth = Math.floor((width - numberWidth) / (count - 1));
  const row = (values: unknown[], header = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${values.map((v, i) => `<w:tc><w:tcPr><w:tcW w:w="${i ? cellWidth : numberWidth}" w:type="dxa"/>${header ? '<w:shd w:fill="E8EDF2"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${paragraph(v, header, !i, 18)}</w:tc>`).join('')}</w:tr>`;
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('');
  const letter = normalizeLetterhead(settings.letterheadConfig, settings), logo = config.showLogo && assets.some(a => a.key === 'logo');
  const logoWidth = twip(letter.logoWidthMm + 6), letterWidth = width - (logo ? logoWidth * 2 : 0);
  const letterParagraphs = letterheadLines(letter).map(line => paragraph(line.text, line.bold, true, line.size * 2, undefined, true).replace('<w:rPr>', `<w:rPr><w:rFonts w:ascii="${letter.fontFamily}" w:hAnsi="${letter.fontFamily}"/>`).replace('w:after="100"', 'w:after="20"')).join('');
  const letterBorder = letter.borderStyle === 'none' ? '' : `<w:tblBorders><w:bottom w:val="${letter.borderStyle}" w:sz="${letter.borderStyle === 'double' ? 6 : 4}" w:color="000000"/></w:tblBorders>`;
  let body = config.showLetterhead ? `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${letterBorder}<w:tblCellMar><w:bottom w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${logo ? `<w:gridCol w:w="${logoWidth}"/>` : ''}<w:gridCol w:w="${letterWidth}"/>${logo ? `<w:gridCol w:w="${logoWidth}"/>` : ''}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${logo ? `<w:tc><w:tcPr><w:tcW w:w="${logoWidth}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>${image('logo').replace('<w:pPr>', '<w:pPr><w:keepNext/>')}</w:tc>` : ''}<w:tc><w:tcPr><w:tcW w:w="${letterWidth}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${letterParagraphs || paragraph('')}</w:tc>${logo ? `<w:tc><w:tcPr><w:tcW w:w="${logoWidth}" w:type="dxa"/></w:tcPr>${paragraph('')}</w:tc>` : ''}</w:tr></w:tbl>${paragraph('')}` : '';

  body += paragraph(report.title, true, true, 24, 'Title') + paragraph(`Periode: ${report.period}\nTotal: ${report.rows.length} catatan · Seluruh hasil filter aktif`);
  body += `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${[numberWidth, ...report.headers.map(() => cellWidth)].map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(['No', ...report.headers], true)}${report.rows.map((r, i) => row([i + 1, ...report.headers.map((_, j) => r[j] ?? '-')])).join('')}</w:tbl>`;
  if (config.showSignatures) {
    const signers = reportSigners(settings), date = report.date || new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const placeDate = [report.city ?? settings.reportCity, date].filter(Boolean).join(', ');
    const cell = (content: string) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(width / 2)}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${content}</w:tc>`;
    // A shared heading row keeps roles aligned when a long place/date wraps.
    const headings = signers.map(s => cell(paragraph(s.key === 'principal' ? 'Mengetahui' : placeDate, false, true, 20, undefined, true))).join('');
    const signing = signers.map(({role, name, idType: type, id, key}) => cell(paragraph(`${role},`, false, true) + (image(key!) || '<w:p><w:pPr><w:spacing w:before="600" w:after="100"/></w:pPr></w:p>') + paragraph(name || '________________', true, true, 20, undefined, false, true) + paragraph(id ? `${type || 'ID'}: ${id}` : '', false, true))).join('');
    body += paragraph('') + `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${Math.floor(width / 2)}"/><w:gridCol w:w="${Math.floor(width / 2)}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${headings}</w:tr><w:tr><w:trPr><w:cantSplit/></w:trPr>${signing}</w:tr></w:tbl>`;
  }
  const field = (instruction: string, fallback: number) => `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ${instruction} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${fallback}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const start = config.pageNumberStart || 1;
  // Refer to the last content page so a custom starting number also gives the
  // correct final number in Word/LibreOffice, without nested formula fields.
  const totalField = field('PAGEREF PiketReportEnd', start);
  const footer = `<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="ReportFooter"/><w:jc w:val="${config.pageNumberPosition || 'center'}"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Halaman </w:t></w:r>${field('PAGE', start)}${config.pageNumberFormat === 'page_only' ? '' : `<w:r><w:t xml:space="preserve"> dari </w:t></w:r>${totalField}`}</w:p></w:ftr>`;
  if (config.showPageNumbers) {
    const end = body.lastIndexOf('</w:p>');
    body = body.slice(0, end) + '<w:bookmarkStart w:id="99" w:name="PiketReportEnd"/><w:bookmarkEnd w:id="99"/>' + body.slice(end);
    // A leading paragraph anchors the section page offset when the first visible
    // content is a letterhead table (LibreOffice otherwise drops PAGE results).
    body = '<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t></w:t></w:r></w:p>' + body;
  }
  body += `<w:sectPr>${config.showPageNumbers ? `<w:footerReference w:type="default" r:id="rIdPageFooter"/>` : ''}<w:pgSz w:w="${twip(paper.width)}" w:h="${twip(paper.height)}" w:orient="${config.orientation}"/><w:pgMar w:top="${twip(config.marginTopMm)}" w:right="${twip(config.marginRightMm)}" w:bottom="${twip(config.marginBottomMm + (config.showPageNumbers ? 7 : 0))}" w:left="${twip(config.marginLeftMm)}" w:header="0" w:footer="${twip(5)}" w:gutter="0"/>${config.showPageNumbers ? `<w:pgNumType w:start="${start}"/>` : ''}</w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`;
  const entries: [string, Uint8Array][] = [
    ['[Content_Types].xml', encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' + (config.showPageNumbers ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>')],
    ['_rels/.rels', encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
    ['word/document.xml', encoder.encode(document)],
    ['word/styles.xml', encoder.encode('<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ReportFooter"><w:name w:val="Report Footer"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="16"/><w:color w:val="000000"/></w:rPr></w:style></w:styles>')],
    ['word/_rels/document.xml.rels', encoder.encode(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdReportSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${config.showPageNumbers ? '<Relationship Id="rIdPageFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}${assets.map((_, i) => `<Relationship Id="rIdImage${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.png"/>`).join('')}</Relationships>`)],
    ['word/settings.xml', encoder.encode('<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>')],
    ...(config.showPageNumbers ? [['word/footer1.xml', encoder.encode(footer)] as [string, Uint8Array]] : []),
    ...assets.map((asset, i): [string, Uint8Array] => [`word/media/image${i + 1}.png`, asset.data]),
  ];
  return zip(entries);
}

export async function printOperationalReport(html: string): Promise<void> {
  const frame = document.createElement('iframe'); frame.title = 'Dokumen cetak laporan'; frame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none';
  await new Promise<void>((resolve, reject) => {
    frame.onload = async () => {
      try {
        const w = frame.contentWindow; if (!w) throw new Error('Pratinjau cetak tidak tersedia');
        await w.document.fonts.ready; await Promise.all(Array.from(w.document.images, img => img.decode()));
        w.addEventListener('afterprint', () => frame.remove(), { once: true }); w.focus(); w.print(); resolve(); setTimeout(() => frame.remove(), 120_000);
      } catch (e) { frame.remove(); reject(e); }
    };
    frame.srcdoc = html; document.body.appendChild(frame);
  });
}
