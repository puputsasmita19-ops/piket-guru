import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LetterheadConfig, SchoolSettings } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { appLogo, DEFAULT_APP_LOGO, letterheadLogo, normalizeLetterhead } from '../../utils/reportBranding';
import { PrintLetterhead } from '../../components/reports/PrintLetterhead';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

async function compressLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Pilih PNG/JPG/WebP berukuran maksimal 2 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    for (const edge of [512, 384, 256, 192, 128]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Kompresi gambar belum tersedia.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png'); if (data.length < 110_000) return data;
    }
    throw new Error('Logo masih terlalu besar. Pilih gambar dengan detail lebih sederhana.');
  } finally { URL.revokeObjectURL(url); }
}

function LetterheadPreview({ settings }: { settings: SchoolSettings }) {
  const host = useRef<HTMLDivElement>(null), paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 220 });
  useLayoutEffect(() => {
    const measure = () => { if (host.current && paper.current) { const scale = Math.min(1, host.current.clientWidth / 680); const height = paper.current.scrollHeight * scale; setSize(p => p.scale === scale && p.height === height ? p : { scale, height }); } };
    measure(); const observer = new ResizeObserver(measure); if (host.current) observer.observe(host.current); if (paper.current) observer.observe(paper.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className="w-full min-w-0 overflow-hidden rounded-xl bg-slate-100 p-0 mt-2" aria-label="Pratinjau kop surat" style={{ height: size.height }}><div ref={paper} className="bg-white p-5" style={{ width: 680, transform: `scale(${size.scale})`, transformOrigin: 'top left' }}><PrintLetterhead settings={settings}/><p className="text-black text-center font-semibold text-sm mt-4">CONTOH JUDUL LAPORAN</p></div></div>;
}

export function BrandingSettingsCard({ settings, onSaved }: { settings: SchoolSettings; onSaved: (settings: SchoolSettings) => void }) {
  const { currentUser } = useAuth();
  const [application, setApplication] = useState(() => appLogo(settings));
  const [letterLogo, setLetterLogo] = useState(() => letterheadLogo(settings));
  const [letter, setLetter] = useState(() => normalizeLetterhead(settings.letterheadConfig, settings));
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { if (!dirty) { setApplication(appLogo(settings)); setLetterLogo(letterheadLogo(settings)); setLetter(normalizeLetterhead(settings.letterheadConfig, settings)); } }, [settings, dirty]);
  if (currentUser?.role !== 'ADMIN') return null;
  const edit = () => { setDirty(true); setMessage(''); };
  const change = <K extends keyof LetterheadConfig>(key: K, value: LetterheadConfig[K]) => { edit(); setLetter(p => ({ ...p, [key]: value })); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'app' | 'letter') => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    edit(); setError(''); setUploading(true);
    try { const result = await compressLogo(file); if (target === 'app') setApplication(result); else setLetterLogo(result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Logo belum dapat dibaca.'); } finally { setUploading(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || uploading) return; setBusy(true); setError(''); setMessage('');
    try { const result = await SchoolSettingsService.saveBrandingSettings(application, letterLogo, letter, currentUser.id); onSaved(result.settings); setDirty(false); setMessage(result.confirmed ? 'Logo dan kop surat tersimpan.' : 'Perubahan terkirim. Muat ulang untuk memastikan penyimpanan.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Pengaturan belum tersimpan.'); } finally { setBusy(false); }
  };
  const example = () => {
    edit(); setLetter(p => ({ ...p, foundationName: 'YAYASAN PENDIDIKAN JEMBER INTERNATIONAL SCHOOL', schoolName: 'SMK dr. SOEBANDI', accreditation: 'TERAKREDITASI (A)', accreditationNumber: '(BAN-PDM) NOMOR : 604/BAN-PDM/SK/2025', nss: '342052429294', npsn: '60724703', address: 'Jl. dr. Soebandi No. 99A, Jember', phone: '(0331) 5104296', email: 'smkdr.soebandi@gmail.com', website: 'www.smkdrsoebandijember.sch.id', borderStyle: 'double', fontFamily: 'Arial', logoWidthMm: 22 }));
  };
  const draftSettings = { ...settings, appLogoUrl: application, letterheadLogoUrl: letterLogo, letterheadConfig: letter };
  const textFields: [keyof LetterheadConfig, string][] = [['foundationName', 'Nama yayasan / instansi'], ['schoolName', 'Nama sekolah pada kop'], ['accreditation', 'Keterangan akreditasi'], ['accreditationNumber', 'Nomor SK akreditasi'], ['nss', 'NSS'], ['npsn', 'NPSN pada kop'], ['address', 'Alamat pada kop'], ['phone', 'Telepon pada kop'], ['email', 'Email pada kop'], ['website', 'Website pada kop']];
  return <div className="space-y-4"><Card><CardHeader title="Logo aplikasi & kop surat" subtitle="Logo aplikasi untuk login dan header. Logo kop untuk dokumen resmi. Keduanya dapat diatur secara terpisah."/><CardContent><form onSubmit={save} className="space-y-5">
    <fieldset disabled={busy || uploading} className="space-y-5 min-w-0">
      <div className="grid gap-4 md:grid-cols-2">{(['app', 'letter'] as const).map(target => <section key={target} className="p-4 rounded-2xl border border-[var(--theme-card-border)] space-y-3 min-w-0">
        <h3 className="font-semibold text-sm">{target === 'app' ? 'Logo aplikasi' : 'Logo kop surat'}</h3>
        <div className="flex items-center gap-3"><div className="w-20 h-20 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 flex items-center justify-center">{(target === 'app' ? application : letterLogo) ? <img src={target === 'app' ? application : letterLogo} alt={target === 'app' ? 'Pratinjau logo aplikasi' : 'Pratinjau logo kop'} className="max-w-full max-h-full object-contain"/> : <span className="text-xs text-slate-500 text-center">Tanpa logo</span>}</div><p className="text-xs text-slate-500 dark:text-slate-400">{target === 'app' ? 'Simbol pendidikan dan centang berwarna arang pada bidang krem polos.' : 'Gunakan lambang resmi sekolah. Logo aplikasi tidak digunakan pada kop.'}</p></div>
        <label className="history-field"><span>Unggah {target === 'app' ? 'logo aplikasi' : 'logo kop'}</span><input aria-label={target === 'app' ? 'Unggah logo aplikasi' : 'Unggah logo kop'} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e, target)}/></label>
        <label className="history-field"><span>Atau URL gambar HTTPS</span><input aria-label={target === 'app' ? 'URL logo aplikasi' : 'URL logo kop'} type="text" inputMode="url" value={(target === 'app' ? application : letterLogo).startsWith('data:') ? '' : target === 'app' ? application : letterLogo} placeholder="https://…" onChange={e => { edit(); if (target === 'app') setApplication(e.target.value); else setLetterLogo(e.target.value); }}/></label>
        <Button type="button" variant="outline" size="sm" onClick={() => { edit(); if (target === 'app') setApplication(DEFAULT_APP_LOGO); else setLetterLogo(''); }}>{target === 'app' ? 'Gunakan logo bawaan' : 'Tanpa logo kop'}</Button>
      </section>)}</div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Unggahan maksimal 2 MB, otomatis diperkecil tanpa memotong logo menjadi sekitar 80 KB atau kurang. URL harus dapat dibuka tanpa login. Perubahan berlaku setelah disimpan.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--theme-card-border)] pt-4"><h3 className="font-semibold">Isi kop surat</h3><Button type="button" variant="outline" size="sm" onClick={example}>Isi format sesuai contoh</Button></div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Kolom kosong tidak dicetak. Isi contoh dapat diedit; periksa nomor dan kontak sebelum menyimpan. Profil sekolah dan koordinat GPS tetap tersimpan.</p>
      <div className="grid gap-3 sm:grid-cols-2">{textFields.map(([key, label]) => <label className="history-field" key={key}><span>{label}</span><input aria-label={label} maxLength={key === 'address' ? 400 : 250} value={String(letter[key])} onChange={e => change(key, e.target.value as never)}/></label>)}
        <label className="history-field"><span>Garis bawah kop</span><select aria-label="Garis bawah kop" value={letter.borderStyle} onChange={e => change('borderStyle', e.target.value as LetterheadConfig['borderStyle'])}><option value="double">Garis ganda</option><option value="single">Garis tunggal</option><option value="none">Tanpa garis</option></select></label>
        <label className="history-field"><span>Huruf kop</span><select aria-label="Huruf kop" value={letter.fontFamily} onChange={e => change('fontFamily', e.target.value as LetterheadConfig['fontFamily'])}><option>Arial</option><option>Times New Roman</option></select></label>
        <label className="history-field"><span>Lebar logo kop (mm)</span><input aria-label="Lebar logo kop" type="number" min="14" max="32" required value={letter.logoWidthMm} onChange={e => change('logoWidthMm', Number(e.target.value))}/></label>
      </div>
    </fieldset>
    <details className="rounded-2xl border border-[var(--theme-card-border)] p-3" open><summary className="cursor-pointer font-semibold text-sm min-h-8">Pratinjau kop surat</summary><LetterheadPreview settings={draftSettings}/><p className="text-xs text-slate-500 mt-2">Pratinjau diperkecil mengikuti lebar layar. Ukuran cetak tetap mengikuti kertas laporan.</p></details>
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    <Button type="submit" disabled={busy || uploading}>{uploading ? 'Menyiapkan logo…' : busy ? 'Menyimpan…' : 'Simpan logo & kop surat'}</Button>
  </form></CardContent></Card></div>;
}
