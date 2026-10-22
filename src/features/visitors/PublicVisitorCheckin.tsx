import React, { useRef, useState } from 'react';
import { VISITOR_CATEGORIES, VisitorCategory } from '../../types/visitor.types';

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || done) return;
    setSending(true); setMessage('');
    try {
      const response = await fetch('/api/visitor-registration/self-submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ token, requestId: requestId.current, tanggal: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), namaTamu: names[0], namaRombongan: names, instansiAsal, kategori, keteranganLainnya, noHp, tujuanBertemu, keperluan }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal mengirim pendaftaran.');
      setMessage(data.message || 'Pendaftaran diterima. Silakan menghubungi petugas.');
      setDone(true);
    } catch (error: any) { setMessage(error?.message || 'Koneksi bermasalah. Coba lagi.'); }
    finally { setSending(false); }
  }
  return <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
    <section className="mx-auto max-w-xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
      <header className="border-b border-slate-100 pb-4"><p className="text-xs uppercase tracking-wide font-bold text-amber-700">Buku Tamu Digital</p><h1 className="text-xl font-bold mt-1">Registrasi Tamu Mandiri</h1><p className="text-sm text-slate-600 mt-2">Isi data kunjungan Anda. Petugas sekolah akan memeriksa pendaftaran sebelum memberikan badge.</p></header>
      {done ? <div role="status" className="rounded-xl p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2"><h2 className="font-bold">Pendaftaran diterima</h2><p className="text-sm">{message}</p><p className="text-sm">Nomor badge diberikan oleh petugas setelah verifikasi. Tidak perlu mengirim ulang formulir.</p></div> : <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-sm font-semibold">Nama lengkap tamu / rombongan *</label><button type="button" disabled={names.length >= 12} onClick={() => setNames(list => [...list, ''])} className="text-xs font-bold text-sky-700 min-h-10 px-2 disabled:opacity-50">+ Anggota</button></div>
          {names.map((name, index) => <div key={index} className="flex items-center gap-2"><input required maxLength={120} minLength={2} value={name} onChange={e => setNames(list => list.map((v, i) => i === index ? e.target.value : v))} placeholder={index === 0 ? 'Nama lengkap tamu utama' : `Nama anggota ${index + 1}`} className="w-full min-w-0 min-h-11 px-3 rounded-xl border border-slate-300 text-sm" />{index > 0 && <button type="button" aria-label={`Hapus anggota ${index + 1}`} onClick={() => setNames(list => list.filter((_, i) => i !== index))} className="min-w-11 min-h-11 border rounded-xl">×</button>}</div>)}
          <p className="text-xs text-slate-500">{names.length} orang · Maksimal 12 nama</p>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold">Instansi / asal *</span><input required minLength={2} maxLength={160} value={instansiAsal} onChange={e => setInstansiAsal(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Kategori tamu *</span><select value={kategori} onChange={e => setKategori(e.target.value as VisitorCategory)} className="block w-full min-h-11 px-3 border rounded-xl text-sm">{VISITOR_CATEGORIES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        {kategori === 'LAINNYA' && <label className="block space-y-1"><span className="text-sm font-semibold">Keterangan kategori *</span><input required maxLength={300} value={keteranganLainnya} onChange={e => setKeteranganLainnya(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>}
        <label className="block space-y-1"><span className="text-sm font-semibold">Nomor WhatsApp (opsional)</span><input type="tel" maxLength={30} value={noHp} onChange={e => setNoHp(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Bertemu dengan / unit tujuan *</span><input required minLength={2} maxLength={160} value={tujuanBertemu} onChange={e => setTujuanBertemu(e.target.value)} className="block w-full min-h-11 px-3 border rounded-xl text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Keperluan kunjungan *</span><textarea required minLength={3} maxLength={500} rows={3} value={keperluan} onChange={e => setKeperluan(e.target.value)} className="block w-full px-3 py-3 border rounded-xl text-sm" /></label>
        {message && <p role="alert" className="text-sm rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{message}</p>}
        <button type="submit" disabled={sending} className="w-full min-h-12 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-xl disabled:opacity-60">{sending ? 'Mengirim...' : 'Kirim Pendaftaran ke Petugas'}</button>
        <p className="text-xs text-slate-500 leading-relaxed">Data digunakan untuk pencatatan kunjungan sekolah dan hanya dapat ditinjau petugas berwenang. Pendaftaran bukan izin otomatis memasuki area sekolah.</p>
      </form>}
    </section>
  </main>;
}
