import React, { useState } from 'react';
import { Download } from '../icons';
import { Button } from './Button';
import { Modal } from './Modal';
import type { SchoolSettings } from '../../types';
import type { OperationalReport } from '../../utils/operationalReport';

export function OperationalExport({ report, settings, disabled = false }: { report: OperationalReport; settings: SchoolSettings; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const exportReport = async (format: 'word' | 'pdf') => {
    if (busy || disabled || !report.rows.length || !settings.schoolName) return; setBusy(true); setError('');
    try {
      const service = await import('../../utils/operationalReport');
      const assets = await service.loadReportAssets(settings);
      if (format === 'pdf') await service.printOperationalReport(service.operationalReportHtml(report, settings, assets));
      else {
        const bytes = service.operationalReportDocx(report, settings, assets), blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${report.title.replace(/[^\p{L}\p{N} -]/gu, '')}-${Date.now()}.docx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ekspor gagal. Silakan coba kembali.'); }
    finally { setBusy(false); }
  };
  return <><Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4"/>} disabled={disabled || !report.rows.length || !settings.schoolName} onClick={() => { setError(''); setOpen(true); }}>Ekspor Word / PDF</Button>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Ekspor laporan" maxWidth="sm"><div className="space-y-4 text-sm"><p>{report.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{report.period} · {report.rows.length} catatan. Ekspor mencakup seluruh hasil filter, termasuk halaman lain.</p><p className="text-xs">Kertas, orientasi, margin, kop, dan tanda tangan mengikuti Pengaturan Sekolah → Cetak & Buku Tamu. Untuk PDF, pilih <strong>Simpan sebagai PDF</strong> pada dialog cetak perangkat.</p>{error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}<div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void exportReport('word')}>Unduh Word (.docx)</Button><Button disabled={busy} onClick={() => void exportReport('pdf')}>{busy ? 'Menyiapkan…' : 'Cetak / Simpan PDF'}</Button></div></div></Modal></>;
}
