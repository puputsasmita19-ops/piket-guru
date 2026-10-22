import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { auth } from '../../services/firebase/firebaseAuth';
import { createQrSvg } from '../../utils/visitorQrSvg';

interface PendingVisitor {
  id: string; namaTamu: string; namaRombongan?: string[]; instansiAsal: string;
  tujuanBertemu: string; keperluan: string; createdAt: string;
}

async function visitorAdminApi(path: string, method: 'GET' | 'POST' = 'GET', data?: object) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.');
  const response = await fetch(`/api/visitor-registration/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined, cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.error || 'Layanan buku tamu belum tersedia.');
  return result;
}

export function VisitorSelfCheckinPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [pending, setPending] = useState<PendingVisitor[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState('');
  const [feedback, setFeedback] = useState('');
  const qrMarkup = useMemo(() => {
    if (!link) return '';
    try { return createQrSvg(link, 5); } catch { return ''; }
  }, [link]);
  const qrSrc = useMemo(() => qrMarkup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrMarkup)}` : '', [qrMarkup]);

  const refresh = useCallback(async () => {
    try {
      const result = await visitorAdminApi('pending');
      setPending(result.items || []);
    } catch (error: any) { setFeedback(error?.message || 'Daftar belum dapat dibaca.'); }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => window.clearInterval(interval);
  }, [isOpen, refresh]);

  async function createLink() {
    setBusy(true); setFeedback('');
    try {
      const result = await visitorAdminApi('qr-session', 'POST');
      const url = new URL(window.location.origin);
      url.searchParams.set('visitor-checkin', result.id);
      setLink(url.toString()); setExpiresAt(result.expiresAt);
    } catch (error: any) { setFeedback(error?.message || 'QR tidak dapat dibuat.'); }
    finally { setBusy(false); }
  }

  async function review(item: PendingVisitor, decision: 'APPROVED' | 'REJECTED') {
    if (decision === 'REJECTED' && !window.confirm(`Tolak pendaftaran ${item.namaTamu}?`)) return;
    if (decision === 'APPROVED' && !window.confirm(`Data identitas sudah diperiksa? Terima ${item.namaRombongan?.length || 1} tamu dan terbitkan badge sekarang?`)) return;
    setReviewing(item.id); setFeedback('');
    try {
      const result = await visitorAdminApi('review', 'POST', { id: item.id, decision });
      setFeedback(decision === 'APPROVED' ? `Pendaftaran diterima. Badge mulai ${result.firstBadge}, total ${result.count} tamu.` : `Pendaftaran ${item.namaTamu} ditolak.`);
      await refresh();
    } catch (error: any) { setFeedback(error?.message || 'Gagal memeriksa pendaftaran.'); }
    finally { setReviewing(''); }
  }

  function downloadQr() {
    if (!qrMarkup) return;
    const blob = new Blob([qrMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'qr-registrasi-tamu-sekolah.svg'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return <Modal isOpen={isOpen} onClose={onClose} title="Registrasi QR & Verifikasi Tamu" maxWidth="lg">
    <div className="space-y-5 text-sm">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-bold">QR untuk pengisian mandiri</h3>
        <p className="text-xs text-slate-500">Buat QR berlaku 8 jam. Tamu memindai dengan kamera HP, mengisi data, lalu meminta pemeriksaan petugas. QR tidak langsung memberi izin masuk atau menerbitkan badge.</p>
        <button type="button" disabled={busy} onClick={createLink} className="min-h-11 px-4 bg-amber-400 text-slate-900 font-bold text-xs rounded-xl disabled:opacity-40">{busy ? 'Membuat QR...' : link ? 'Buat QR Baru' : 'Buat QR Registrasi'}</button>
        {link && <div className="space-y-2 flex flex-col items-center">
          {qrSrc && <img src={qrSrc} alt="QR pendaftaran tamu mandiri" width={260} height={260} className="w-[260px] max-w-full aspect-square object-contain border rounded-xl p-2 bg-white" />}
          <p className="text-xs text-slate-500">Berlaku hingga {new Date(expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
          <input value={link} readOnly aria-label="Tautan registrasi mandiri" className="w-full text-xs border rounded-lg px-3 py-2 bg-slate-50 text-slate-900" />
          <div className="flex gap-2 flex-wrap justify-center">
            <button type="button" onClick={() => navigator.clipboard.writeText(link).then(() => setFeedback('Tautan registrasi disalin.')).catch(() => setFeedback('Silakan salin tautan dari kolom di atas.'))} className="px-3 min-h-10 border rounded-lg text-xs font-semibold">Salin Link</button>
            <button type="button" onClick={downloadQr} disabled={!qrMarkup} className="px-3 min-h-10 border rounded-lg text-xs font-semibold">Unduh QR (SVG)</button>
          </div>
        </div>}
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex justify-between gap-3 items-center"><h3 className="font-bold">Menunggu Verifikasi ({pending.length})</h3><button type="button" onClick={() => void refresh()} className="min-h-10 px-3 border rounded-lg text-xs font-semibold">Segarkan</button></div>
        <p className="text-xs text-slate-500">Periksa identitas dan tujuan kunjungan secara langsung sebelum menekan Terima. Badge baru diterbitkan setelah persetujuan.</p>
        <div className="space-y-3 max-h-[360px] overflow-y-auto">
          {pending.length === 0 && <p className="text-xs text-slate-500">Belum ada pendaftaran mandiri yang menunggu.</p>}
          {pending.map(item => <article key={item.id} className="border rounded-xl p-3 space-y-2">
            <h4 className="text-sm font-bold">{item.namaTamu} {item.namaRombongan && item.namaRombongan.length > 1 ? `+${item.namaRombongan.length - 1} anggota` : ''}</h4>
            {item.namaRombongan && item.namaRombongan.length > 1 && <p className="text-xs text-slate-600 dark:text-slate-300">{item.namaRombongan.join(', ')}</p>}
            <p className="text-xs text-slate-500">{item.instansiAsal} · {item.tujuanBertemu}</p><p className="text-xs">{item.keperluan}</p>
            <div className="flex gap-2 flex-wrap"><button type="button" disabled={Boolean(reviewing)} onClick={() => void review(item, 'APPROVED')} className="min-h-10 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">Terima & Terbitkan Badge</button><button type="button" disabled={Boolean(reviewing)} onClick={() => void review(item, 'REJECTED')} className="min-h-10 px-4 border border-rose-300 text-rose-700 rounded-lg text-xs font-semibold disabled:opacity-40">Tolak</button></div>
          </article>)}
        </div>
      </div>
      {feedback && <p role="status" className="rounded-xl p-3 text-xs bg-sky-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">{feedback}</p>}
    </div>
  </Modal>;
}
