import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { PdfPagePreview } from '../../components/reports/PdfPagePreview';
import type { PrintLayoutConfig, SchoolSettings } from '../../types';
import { normalizeReportPrint } from '../../utils/operationalReport';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';
import { monthlyReportDocument, type MonthlyReportInput } from './monthlyReportDocument';
import { useAuth } from '../../contexts/AuthContext';
import { AuditService } from '../../services/audit/auditService';

interface MonthlyReportPrintModalProps extends MonthlyReportInput { isOpen: boolean; onClose: () => void; settings: SchoolSettings }
export const MonthlyReportPrintModal: React.FC<MonthlyReportPrintModalProps> = props => {
  const { isOpen, onClose, settings } = props, { currentUser } = useAuth();
  const [print, setPrint] = useState<PrintLayoutConfig>(() => normalizeReportPrint(settings.printConfig));
  const [showConfig, setShowConfig] = useState(false), [date, setDate] = useState(() => getTodayISODate()), [city, setCity] = useState(settings.reportCity || '');
  const [bytes, setBytes] = useState<Uint8Array | null>(null), [error, setError] = useState(''), [generating, setGenerating] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  useEffect(() => { if (isOpen) { setPrint(normalizeReportPrint(settings.printConfig)); setCity(settings.reportCity || ''); } }, [isOpen, settings.printConfig, settings.reportCity]);
  const report = useMemo(() => ({ ...monthlyReportDocument(props), date: formatIndonesianDate(date), city }), [props.periodLabel, props.attendanceSummaries, props.incidentSummaries, props.totalIncidents, props.resolvedIncidents, props.tardyRecords, props.permitRecords, props.substitutionRecords, props.visitorRecords, props.dutyBookRecords, date, city]);
  const pdfSettings = useMemo(() => ({ ...settings, printConfig: normalizeReportPrint(print) }), [settings, print]);
  useEffect(() => {
    let active = true; setBytes(null); setError(''); if (!isOpen) return; setGenerating(true);
    const timer = setTimeout(() => { void import('../../utils/reportPdf').then(m => m.createReportPdf(report, pdfSettings)).then(data => { if (active) setBytes(data); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Dokumen belum dapat dibuat.'); }).finally(() => { if (active) setGenerating(false); }); }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [isOpen, report, pdfSettings]);
  if (!isOpen) return null;
  const act = async (mode: 'print' | 'download') => {
    if (!bytes || busy) return; setBusy(true); setError('');
    try {
      if (mode === 'download') { const m = await import('../../utils/reportPdf'); m.downloadPdf(bytes, `Rekap Resmi-${getTodayISODate()}`); }
      else { const m = await import('../../utils/pdfViewer'); await m.printPdfDocument(bytes, print, (p, t) => setProgress(`Menyiapkan cetak ${p}/${t}…`)); }
      if (currentUser) void AuditService.log({ userId: currentUser.id, action: 'EXPORT', module: 'REPORTS', status: 'SUCCESS', target: 'Rekap Laporan Resmi', details: `${mode === 'print' ? 'Membuka dialog cetak' : 'Mengunduh PDF'} rekap resmi, periode ${props.periodLabel}` });
    } catch (e) { setError(e instanceof Error ? e.message : 'Dokumen belum dapat diproses.'); } finally { setBusy(false); setProgress(''); }
  };
  return <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title="Pratinjau & Cetak Rekapitulasi Laporan Piket Resmi" maxWidth="3xl"><div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500 dark:text-slate-400">Pratinjau sama dengan dokumen cetak. Kepala tabel diulang pada halaman lanjutan.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => setShowConfig(v => !v)}>{showConfig ? 'Tutup Pengaturan' : 'Pengaturan Cetak'}</Button><Button size="sm" variant="outline" disabled={!bytes || busy || generating} onClick={() => void act('download')}>Unduh PDF</Button><Button size="sm" disabled={!bytes || busy || generating} onClick={() => void act('print')}>{busy ? progress || 'Menyiapkan…' : 'Cetak'}</Button></div></div>
    {showConfig && <div className="rounded-xl border border-[var(--theme-card-border)] p-4 space-y-3"><p className="text-xs text-slate-500">Penyesuaian untuk cetakan ini. Pengaturan permanen terdapat di menu admin Cetak & Buku Tamu.</p><div className="history-controls-row">
      <label className="history-field"><span>Kertas</span><select aria-label="Kertas pratinjau" value={print.paperSize} onChange={e => setPrint(p => ({ ...p, paperSize: e.target.value as typeof p.paperSize }))}><option>A4</option><option>F4</option></select></label><label className="history-field"><span>Orientasi</span><select aria-label="Orientasi pratinjau" value={print.orientation} onChange={e => setPrint(p => ({ ...p, orientation: e.target.value as typeof p.orientation }))}><option value="portrait">Tegak</option><option value="landscape">Mendatar</option></select></label>
      {(['marginTopMm', 'marginRightMm', 'marginBottomMm', 'marginLeftMm'] as const).map((key, i) => <label key={key} className="history-field"><span>Margin {['atas', 'kanan', 'bawah', 'kiri'][i]} (mm)</span><input type="number" min="5" max="40" value={print[key]} onChange={e => setPrint(p => ({ ...p, [key]: Number(e.target.value) }))}/></label>)}
      <label className="history-field"><span>Kota pengesahan</span><input value={city} onChange={e => setCity(e.target.value)}/></label><label className="history-field"><span>Tanggal dokumen</span><input type="date" required value={date} onChange={e => setDate(e.target.value || getTodayISODate())}/></label></div>
      <div className="flex flex-wrap gap-3 text-xs">{(['showLetterhead', 'showLogo', 'showSignatures', 'showPageNumbers'] as const).map((key, i) => <label key={key} className="flex items-center gap-2 min-h-11"><input type="checkbox" checked={print[key] !== false} onChange={e => setPrint(p => ({ ...p, [key]: e.target.checked }))}/>{['Kop surat', 'Logo kop', 'Tanda tangan', 'Nomor halaman'][i]}</label>)}</div><Button size="sm" variant="outline" onClick={() => setPrint(normalizeReportPrint(settings.printConfig))}>Gunakan pengaturan admin</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}{generating && <p role="status" className="text-xs text-slate-500">Menyusun halaman laporan…</p>}<PdfPagePreview bytes={bytes}/>
  </div></Modal>;
};
