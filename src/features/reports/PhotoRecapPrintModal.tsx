import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { PdfPagePreview } from '../../components/reports/PdfPagePreview';
import type { SchoolSettings } from '../../types';
import type { PhotoRecapItem } from '../../types/watermark.types';
import { getTodayISODate, formatIndonesianDate } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { AuditService } from '../../services/audit/auditService';
interface PhotoRecapPrintModalProps { isOpen: boolean; onClose: () => void; settings: SchoolSettings; periodLabel: string; selectedPhotos: PhotoRecapItem[] }
export const PhotoRecapPrintModal: React.FC<PhotoRecapPrintModalProps> = ({ isOpen, onClose, settings, periodLabel, selectedPhotos }) => {
  const { currentUser } = useAuth(), imageCache = useRef(new Map<string, string>());
  const [perPage, setPerPage] = useState<2 | 4>(2), [date, setDate] = useState(() => getTodayISODate()), [city, setCity] = useState(settings.reportCity || ''), [signatures, setSignatures] = useState(settings.printConfig?.showSignatures !== false);
  const [bytes, setBytes] = useState<Uint8Array | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  useEffect(() => { if (isOpen) { setSignatures(settings.printConfig?.showSignatures !== false); setCity(settings.reportCity || ''); } else imageCache.current.clear(); }, [isOpen, settings.printConfig?.showSignatures, settings.reportCity]);
  useEffect(() => { imageCache.current.clear(); }, [currentUser?.id]);
  const pdfSettings = useMemo(() => ({ ...settings, printConfig: { ...settings.printConfig!, showSignatures: signatures } }), [settings, signatures]);
  // Avoid regenerating for a parent's equivalent array instance; only printable metadata determines this key.
  const photoKey = JSON.stringify(selectedPhotos);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setBytes(null); setError(''); if (!isOpen || !selectedPhotos.length) return; setLoading(true);
    const timer = setTimeout(() => { void import('../../utils/reportPdf').then(m => m.createPhotoReportPdf(selectedPhotos, pdfSettings, { perPage, period: periodLabel, date: formatIndonesianDate(date), city, imageCache: imageCache.current, signal: controller.signal })).then(data => { if (active) setBytes(data); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Foto belum dapat dimuat.'); }).finally(() => { if (active) setLoading(false); }); }, 150);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [isOpen, photoKey, pdfSettings, perPage, periodLabel, date, city]);
  if (!isOpen) return null;
  const act = async (mode: 'print' | 'download') => {
    if (!bytes || busy) return; setBusy(true); setError('');
    try {
      if (mode === 'download') { const m = await import('../../utils/reportPdf'); m.downloadPdf(bytes, `Lampiran Dokumentasi-${getTodayISODate()}`); }
      else { const m = await import('../../utils/pdfViewer'); await m.printPdfDocument(bytes, pdfSettings.printConfig, (p, t) => setProgress(`Menyiapkan cetak ${p}/${t}…`)); }
      if (currentUser) void AuditService.log({ userId: currentUser.id, action: 'EXPORT', module: 'REPORTS', status: 'SUCCESS', target: 'Lampiran Dokumentasi', details: `${mode === 'print' ? 'Membuka dialog cetak' : 'Mengunduh PDF'} ${selectedPhotos.length} foto, ${perPage} foto per halaman, periode ${periodLabel}` });
    } catch (e) { setError(e instanceof Error ? e.message : 'Dokumen belum dapat diproses.'); } finally { setBusy(false); setProgress(''); }
  };
  return <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title="Pratinjau Dokumentasi Foto" maxWidth="3xl"><div className="space-y-4">
    <div className="history-controls-row"><label className="history-field"><span>Foto per halaman</span><select aria-label="Foto per halaman" value={perPage} onChange={e => setPerPage(Number(e.target.value) as 2 | 4)}><option value="2">2 foto (lebih jelas)</option><option value="4">4 foto (ringkas)</option></select></label><label className="history-field"><span>Kota pengesahan</span><input value={city} onChange={e => setCity(e.target.value)}/></label><label className="history-field"><span>Tanggal dokumen</span><input type="date" value={date} onChange={e => setDate(e.target.value || getTodayISODate())}/></label></div>
    <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={signatures} onChange={e => setSignatures(e.target.checked)}/>Tampilkan tanda tangan</label>
    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedPhotos.length} foto terpilih. Kertas, margin dan nomor halaman mengikuti pengaturan admin. Layout R66: foto tampil utuh, keterangan berada tepat di bawahnya. Gunakan 2 foto per halaman untuk keterangan panjang.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!bytes || busy || loading} onClick={() => void act('download')}>Unduh PDF</Button><Button disabled={!bytes || busy || loading} onClick={() => void act('print')}>{busy ? progress || 'Menyiapkan…' : 'Cetak'}</Button></div>
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}{loading && <p role="status" className="text-xs text-slate-500">Menyiapkan foto dan halaman…</p>}<PdfPagePreview bytes={bytes}/>
  </div></Modal>;
};
