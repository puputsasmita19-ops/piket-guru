import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '../common/Button';

export function PdfPagePreview({ bytes }: { bytes: Uint8Array | null }) {
  const canvas = useRef<HTMLCanvasElement>(null), docRef = useRef<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false, opened: PDFDocumentProxy | null = null;
    setPage(1); setTotal(0); setError(''); docRef.current = null;
    if (!bytes) return;
    setLoading(true);
    void import('../../utils/pdfViewer').then(m => m.openPdf(bytes)).then(doc => {
      opened = doc; if (cancelled) { void doc.loadingTask.destroy(); return; }
      docRef.current = doc; setTotal(doc.numPages);
    }).catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Pratinjau PDF belum dapat dimuat.'); setLoading(false); } });
    return () => { cancelled = true; docRef.current = null; if (opened) void opened.loadingTask.destroy(); };
  }, [bytes]);
  useEffect(() => {
    const doc = docRef.current, target = canvas.current;
    if (!doc || !target || !total) return;
    let cancelled = false, task: { cancel: () => void; promise: Promise<unknown> } | undefined;
    setLoading(true); setError('');
    void doc.getPage(page).then(pdfPage => {
      if (cancelled) return;
      const native = pdfPage.getViewport({ scale: 1 }), scale = Math.min(1.7, 1200 / native.width), viewport = pdfPage.getViewport({ scale });
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      const ctx = target.getContext('2d'); if (!ctx) throw new Error('Canvas tidak tersedia.');
      task = pdfPage.render({ canvas: target, viewport }); return task.promise;
    }).then(() => { if (!cancelled) setLoading(false); }).catch(e => { if (!cancelled && e?.name !== 'RenderingCancelledException') { setError('Pratinjau belum dapat digambar. Unduhan PDF tetap tersedia.'); setLoading(false); } });
    return () => { cancelled = true; task?.cancel(); };
  }, [page, total, bytes]);
  if (!bytes) return <p role="status" className="p-6 text-center text-sm text-slate-500">Menyiapkan dokumen…</p>;
  return <div className="space-y-3" data-pdf-preview>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span aria-live="polite">Halaman {total ? page : '…'} dari {total || '…'}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || !total || page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={loading || !total || page >= total} onClick={() => setPage(p => p + 1)}>Berikutnya</Button></div></div>
    {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    {loading && <p role="status" className="text-xs text-slate-500">Memuat halaman…</p>}
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-4"><canvas ref={canvas} aria-label={`Pratinjau halaman ${page}`} className="block w-full h-auto mx-auto bg-white shadow-sm" style={{ maxWidth: 900, opacity: loading ? .45 : 1 }}/></div>
  </div>;
}
