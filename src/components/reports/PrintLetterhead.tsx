import React from 'react';
import type { SchoolSettings } from '../../types';
import { letterheadLogo, letterheadLines, normalizeLetterhead, reportSigners } from '../../utils/reportBranding';

export function PrintLetterhead({ settings, showLogo = true }: { settings: SchoolSettings; showLogo?: boolean }) {
  const config = normalizeLetterhead(settings.letterheadConfig, settings), logo = letterheadLogo(settings);
  return <div data-print-letterhead style={{ color: '#000', background: '#fff', fontFamily: config.fontFamily, paddingBottom: '8px', borderBottom: config.borderStyle === 'none' ? 'none' : config.borderStyle === 'double' ? '4px double #000' : '1px solid #000', breakInside: 'avoid', width: '100%' }}>
    <div style={{ display: 'grid', gridTemplateColumns: showLogo && logo ? `${config.logoWidthMm + 3}mm minmax(0, 1fr) ${config.logoWidthMm + 3}mm` : 'minmax(0, 1fr)', alignItems: 'center', width: '100%' }}>
      {showLogo && logo && <img src={logo} alt="Logo kop surat" style={{ width: `${config.logoWidthMm}mm`, maxHeight: '32mm', objectFit: 'contain', flexShrink: 0 }} />}
      <div data-letterhead-text style={{ minWidth: 0, textAlign: 'center' }}>{letterheadLines(config).map((line, index) => <p key={index} style={{ margin: '1px 0', fontSize: `${line.size}pt`, fontWeight: line.bold ? 700 : 400, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{line.text}</p>)}</div>
      {showLogo && logo && <div aria-hidden="true"/>}
    </div>
  </div>;
}

export function ReportSignatures({ settings, date, city }: { settings: SchoolSettings; date: string; city?: string }) {
  return <div data-report-signatures style={{ color: '#000', background: '#fff', breakInside: 'avoid', pageBreakInside: 'avoid', paddingTop: '20px', fontSize: '10pt' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '20px', rowGap: '8px', textAlign: 'center' }}>
      {reportSigners(settings).map(signer => <p key={signer.key} data-signer-heading={signer.key} style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{signer.key === 'principal' ? 'Mengetahui' : [city ?? settings.reportCity, date].filter(Boolean).join(', ')}</p>)}
      {reportSigners(settings).map(signer => <div key={signer.key} data-signer={signer.key} style={{ minWidth: 0 }}>
      <p style={{ margin: 0 }}>{signer.role},</p>
      <div style={{ height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{signer.signature && <img src={signer.signature} alt={`Tanda tangan ${signer.role}`} style={{ maxWidth: '120px', maxHeight: '64px', objectFit: 'contain' }}/>}</div>
      <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline', overflowWrap: 'anywhere' }}>{signer.name || '________________'}</p>
      {signer.id && <p style={{ margin: '3px 0 0', fontSize: '9pt' }}>{signer.idType || 'ID'}: {signer.id}</p>}
    </div>)}</div>
  </div>;
}
