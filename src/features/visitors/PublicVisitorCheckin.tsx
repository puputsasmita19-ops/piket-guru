import { MobileChoiceSelect } from '../../components/common/MobileChoiceSelect';
import React, { useRef, useState } from 'react';
import { VISITOR_CATEGORIES, VisitorCategory } from '../../types/visitor.types';
import { CameraCaptureModal } from '../../components/camera/CameraCaptureModal';
import { compressVisitorQrPhoto } from '../../utils/visitorPhoto';

/** Public form contains no database access, roster, account information or personal records. */
export function PublicVisitorCheckin({ token }: { token: string }) {
  const requestId = useRef(crypto.randomUUID());
  const [names, setNames] = useState(['']);
  const [instansiAsal, setInstansiAsal] = useState('');
  const [kategori, setKategori] = useState<VisitorCategory>('UMUM');
  const [keteranganLainnya, setKeteranganLainnya] = useState('');
  const [noHp, setNoHp] = useState('');
  const [tujuanBertemu, setTujuanBertemu] = useState('');
  const [keperluan, setKeperluan] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fotoUrl, setFotoUrl] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  async function receivePhoto(image: string) {
    setPhotoBusy(true); setPhotoError('');
    try { setFotoUrl(await compressVisitorQrPhoto(image)); setPhotoConsent(false); }
    catch (error: any) { setPhotoError(error?.message || 'Foto tidak dapat diproses.'); }
    finally { setPhotoBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || done) return;
    if (fotoUrl && !photoConsent) { setPhotoError('Setujui penggunaan foto untuk dokumentasi kunjungan sebelum melanjutkan.'); return; }
    setSending(true); setMessage('');
    try {
      const response = await fetch('/api/visitor-registration/self-submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ token, requestId: requestId.current, tanggal: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), namaTamu: names[0], namaRombongan: names, instansiAsal, kategori, keteranganLainnya, noHp, tujuanBertemu, keperluan, ...(fotoUrl ? { fotoUrl, photoConsent } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal mengirim pendaftaran.');
      setMessage(data.message || 'Pendaftaran diterima. Silakan menghubungi petugas.');
      setDone(true);
    } catch (error: any) { setMessage(error?.message || 'Koneksi bermasalah. Coba lagi.'); }
    finally { setSending(false); }
  }
  return <main className="min-h-dvh bg-slate-50 px-3 py-5 sm:px-4 sm:py-8 text-slate-900">
    <section className="mx-auto max-w-xl bg-white border border-slate-200 rounded-3xl p-4 sm:p-7 shadow-sm space-y-5">
      <header className="border-b border-slate-100 pb-4"><p className="text-xs uppercase tracking-wide font-bold text-amber-700">Buku Tamu Digital</p><h1 className="text-xl font-bold mt-1">Registrasi Tamu Mandiri</h1><p className="text-sm text-slate-600 mt-2">Isi data kunjungan Anda. Petugas sekolah akan memeriksa pendaftaran sebelum memberikan badge.</p></header>
      {done ? <div role="status" className="rounded-xl p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2"><h2 className="font-bold">Pendaftaran diterima</h2><p className="text-sm">{message}</p><p className="text-sm">Nomor badge diberikan oleh petugas setelah verifikasi. Tidak perlu mengirim ulang formulir.</p></div> : <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-sm font-semibold">Nama lengkap tamu / rombongan *</label><button type="button" disabled={names.length >= 12} onClick={() => setNames(list => [...list, ''])} className="text-xs font-bold text-sky-700 min-h-10 px-2 disabled:opacity-50">+ Anggota</button></div>
          {names.map((name, index) => <div key={index} className="flex items-center gap-2"><input required maxLength={120} minLength={2} value={name} onChange={e => setNames(list => list.map((v, i) => i === index ? e.target.value : v))} placeholder={index === 0 ? 'Nama lengkap tamu utama' : `Nama anggota ${index + 1}`} className="w-full min-w-0 min-h-11 px-3 rounded-xl border border-slate-300 text-sm" />{index > 0 && <button type="button" aria-label={`Hapus anggota ${index + 1}`} onClick={() => setNames(list => list.filter((_, i) => i !== index))} className="min-w-11 min-h-11 border rounded-xl">×</button>}</div>)}
          <p className="text-xs text-slate-500">{names.length} orang · Maksimal 12 nama</p>
        </div>
        <h2 className="text-sm font-bold text-slate-900 pt-2">Tujuan kunjungan</h2>
        <label className="block space-y-1"><span className="text-sm font-semibold">Instansi / asal *</span><input required minLength={2} maxLength={160} value={instansiAsal} onChange={e => setInstansiAsal(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Kategori tamu *</span><MobileChoiceSelect mobileTitle="Pilih Kategori Tamu" value={kategori} onChange={e => setKategori(e.target.value as VisitorCategory)} className="block w-full min-h-11 px-3 border rounded-xl text-sm">{VISITOR_CATEGORIES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</MobileChoiceSelect></label>
        {kategori === 'LAINNYA' && <label className="block space-y-1"><span className="text-sm font-semibold">Keterangan kategori *</span><input required maxLength={300} value={keteranganLainnya} onChange={e => setKeteranganLainnya(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>}
        <label className="block space-y-1"><span className="text-sm font-semibold">Nomor WhatsApp (opsional)</span><input type="tel" maxLength={30} value={noHp} onChange={e => setNoHp(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Bertemu dengan / unit tujuan *</span><input required minLength={2} maxLength={160} value={tujuanBertemu} onChange={e => setTujuanBertemu(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Keperluan kunjungan *</span><textarea required minLength={3} maxLength={500} rows={3} value={keperluan} onChange={e => setKeperluan(e.target.value)} className="block w-full px-3 py-3 border rounded-xl text-sm" /></label>
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4 space-y-3" aria-label="Foto tamu utama">
          <div><h2 className="font-bold text-sm">Foto tamu utama (opsional)</h2><p className="text-xs text-slate-600 mt-1">Gunakan kamera depan. Untuk rombongan, foto hanya milik tamu utama. Foto baru disimpan setelah dikirim dan diperiksa petugas.</p></div>
          <div className="flex items-center gap-3 flex-wrap">
            {fotoUrl ? <img src={fotoUrl} alt="Pratinjau foto tamu utama" className="h-24 w-24 rounded-2xl border border-amber-200 object-cover" /> : <div className="h-24 w-24 rounded-2xl border border-dashed border-amber-300 flex items-center justify-center text-xs text-amber-900 text-center px-2">Belum ada foto</div>}
            <div className="flex-1 min-w-[160px] space-y-2">
              <button type="button" disabled={photoBusy} onClick={() => setCameraOpen(true)} className="w-full min-h-11 px-4 rounded-xl border border-amber-300 bg-white font-semibold text-sm disabled:opacity-50">{photoBusy ? 'Memproses foto…' : fotoUrl ? 'Ambil Ulang Foto' : 'Ambil Foto Tamu'}</button>
              {fotoUrl && <button type="button" onClick={() => { setFotoUrl(''); setPhotoConsent(false); setPhotoError(''); }} className="text-sm font-semibold text-rose-700 min-h-10 px-2">Hapus foto</button>}
            </div>
          </div>
          {fotoUrl && <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"><input type="checkbox" checked={photoConsent} onChange={event => { setPhotoConsent(event.target.checked); setPhotoError(''); }} className="mt-1 h-4 w-4" /><span>Saya mengizinkan penggunaan foto ini sebagai dokumentasi kunjungan sekolah.</span></label>}
          {photoError && <p role="alert" className="text-xs text-rose-700">{photoError}</p>}
        </section>
        {message && <p role="alert" className="text-sm rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{message}</p>}
        <button type="submit" disabled={sending} className="w-full min-h-12 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-xl disabled:opacity-60">{sending ? 'Mengirim...' : 'Kirim Pendaftaran ke Petugas'}</button>
        <p className="text-xs text-slate-500 leading-relaxed">Data digunakan untuk pencatatan kunjungan sekolah dan hanya dapat ditinjau petugas berwenang. Pendaftaran bukan izin otomatis memasuki area sekolah.</p>
      </form>}
    </section>
    <CameraCaptureModal isOpen={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(image) => { void receivePhoto(image); }} initialFacingMode="user" title="Ambil Foto Tamu Utama" subtitle="Ambil foto wajah yang jelas. Foto diperkecil otomatis sebelum dikirim." />
  </main>;
}
