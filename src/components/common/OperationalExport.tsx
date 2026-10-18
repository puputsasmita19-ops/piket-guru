import React, { useState } from 'react';
import { Download } from '../icons';
import { Button } from './Button';
import { Modal } from './Modal';
import type { SchoolSettings } from '../../types';
import type { OperationalReport } from '../../utils/operationalReport';
export function OperationalExport({ report, settings, disabled = false }: { report: OperationalReport; settings: SchoolSettings; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const exportReport = async (format: 'word' | 'pdf' | 'print') => {
    if (busy || disabled || !report.rows.length || !settings.schoolName) return; setBusy(true); setError('');
    try {
      if (format === 'word') {
        const m = await import('../../utils/operationalReport'), assets = await m.loadReportAssets(settings), bytes = m.operationalReportDocx(report, settings, assets);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })), a = document.createElement('a');
        a.href = url; a.download = `${report.title.replace(/[^\p{L}\p{N} -]/gu, '')}-${Date.now()}.docx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } else {
        const m = await import('../../utils/reportPdf'), bytes = await m.createReportPdf(report, settings);
        if (format === 'pdf') m.downloadPdf(bytes, report.title);
        else { const viewer = await import('../../utils/pdfViewer'); await viewer.printPdfDocument(bytes, settings.printConfig); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ekspor gagal. Silakan coba kembali.'); } finally { setBusy(false); }
  };
  return <><Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4"/>} disabled={disabled || !report.rows.length || !settings.schoolName} onClick={() => { setError(''); setOpen(true); }}>Ekspor Word / PDF</Button>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Ekspor laporan" maxWidth="sm"><div className="space-y-4 text-sm"><p>{report.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{report.period} · {report.rows.length} catatan. Mencakup seluruh hasil filter, termasuk halaman lain.</p><p className="text-xs">Kertas, margin, kop, tanda tangan dan nomor halaman mengikuti pengaturan admin. PDF diunduh langsung sebagai berkas.</p>{error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}<div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void exportReport('word')}>Unduh Word (.docx)</Button><Button variant="outline" disabled={busy} onClick={() => void exportReport('pdf')}>Unduh PDF</Button><Button variant="outline" disabled={busy} onClick={() => void exportReport('print')}>Cetak</Button></div>{busy && <p role="status" className="text-xs">Menyiapkan dokumen…</p>}</div></Modal></>;
}
