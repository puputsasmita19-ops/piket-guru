import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { UserAvatar } from '../../components/common/UserAvatar';
import { Camera, Trash2, Maximize, Plus, MinusCircle, RotateCcw } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile } from '../../types';
import { ProfilePhotoService, setProfileLoginVisibility } from '../../services/profile/profilePhotoService';
import { openProfilePhoto, compressProfilePhoto, getProfilePhotoLayout, DEFAULT_PROFILE_PHOTO_FRAME, PROFILE_PHOTO_MAX_ZOOM, type ProfilePhotoFrame } from '../../services/profile/profilePhotoCompression';

export default function ProfilePhotoModal({ user, onClose, onSaved, onVisibilityChanged }: { user: UserProfile; onClose: () => void; onSaved: (url: string | null) => void; onVisibilityChanged?: (visible: boolean) => void }) {
  const { hasRole, currentUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<ProfilePhotoFrame>({ ...DEFAULT_PROFILE_PHOTO_FRAME });
  const [photo, setPhoto] = useState<ReturnType<typeof compressProfilePhoto> | null>(null);
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [loginAvatarVisible, setLoginAvatarVisible] = useState(user.loginAvatarVisible === true);
  const admin = hasRole('ADMIN');
  const viewer = useRef(currentUser?.id);
  useEffect(() => () => { ++request.current; }, []);
  useEffect(() => { if (viewer.current !== currentUser?.id || !admin) onClose(); }, [currentUser?.id, admin]);
  const crop = (img: HTMLImageElement, value: ProfilePhotoFrame) => {
    const result = compressProfilePhoto(img, value);
    setPhoto(result); setRequestId(crypto.randomUUID()); setFrame(value); setError('');
  };
  const adjust = (change: Partial<ProfilePhotoFrame>) => {
    if (!image || busy || processing) return;
    try { crop(image, { ...frame, ...change }); }
    catch (err: any) { setError(err.message || 'Bingkai foto belum dapat diubah.'); }
  };
  const layout = image ? getProfilePhotoLayout(image.naturalWidth, image.naturalHeight, frame) : null;
  const select = async (file?: File) => {
    if (!file || busy || !admin) return;
    const id = ++request.current;
    setProcessing(true); setError('');
    try { setRemoveConfirm(false); const img = await openProfilePhoto(file); if (id !== request.current) return; crop(img, { ...DEFAULT_PROFILE_PHOTO_FRAME }); setImage(img); }
    catch (e: any) { if (id === request.current) setError(e.message || 'Foto tidak dapat diproses.'); }
    finally { if (id === request.current) setProcessing(false); if (input.current) input.current.value = ''; }
  };
  const save = async (remove = false) => {
    if (busy || processing || !admin || (!remove && !photo)) return;
    setBusy(true); setError('');
    const id = ++request.current;
    try {
      const result = remove ? await ProfilePhotoService.remove(user.id, user.avatarUrl || null) : await ProfilePhotoService.save(user.id, photo!.dataUrl, photo!.thumbnailDataUrl, requestId, user.avatarUrl || null);
      if (id !== request.current) return;
      onSaved(result.avatarUrl); onClose();
    } catch (e: any) { if (id === request.current) setError(e.message || 'Foto belum tersimpan.'); }
    finally { if (id === request.current) setBusy(false); }
  };
  const changeLoginVisibility = async (visible: boolean) => {
    if (!admin || busy || !user.avatarUrl) return;
    setBusy(true); setError('');
    try {
      const saved = await setProfileLoginVisibility(user.id, user.avatarUrl, visible);
      setLoginAvatarVisible(saved);
      onVisibilityChanged?.(saved);
    } catch (e: any) { setError(e?.message || 'Pengaturan foto login belum tersimpan.'); }
    finally { setBusy(false); }
  };
  if (!admin) return null;
  return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title="Foto profil pengguna" maxWidth="md" footer={<div className="flex gap-2 justify-end"><Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button><Button onClick={() => save()} disabled={!photo || processing} isLoading={busy} loadingText="Memproses…">Simpan foto</Button></div>}>
    <div className="space-y-4 text-sm">
      <div><h3 className="font-bold">{user.fullName}</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Foto utama tetap berkualitas; thumbnail login 128 × 128 dibuat otomatis dan hanya dipakai jika Admin mengizinkannya.</p></div>
      <div className="flex justify-center">{photo ? <img src={photo.dataUrl} alt="Pratinjau bingkai foto profil" className="w-44 h-44 sm:w-48 sm:h-48 rounded-3xl object-contain bg-white border border-[var(--theme-card-border)]" /> : <UserAvatar user={user} className="w-36 h-36 rounded-3xl text-4xl" />}</div>
      {image && layout && <div className="space-y-2 rounded-2xl p-3 border border-[var(--theme-card-border)] bg-[var(--theme-surface-subtle)]">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mode bingkai foto">
          <Button size="sm" variant={frame.mode === 'fit' ? 'primary' : 'outline'} aria-pressed={frame.mode === 'fit'} className="min-h-[44px]" leftIcon={<Maximize className="w-4 h-4" />} disabled={busy || processing} onClick={() => adjust({ ...DEFAULT_PROFILE_PHOTO_FRAME })}>Fit · foto utuh</Button>
          <Button size="sm" variant={frame.mode === 'fill' ? 'primary' : 'outline'} aria-pressed={frame.mode === 'fill'} className="min-h-[44px]" disabled={busy || processing} onClick={() => adjust({ ...DEFAULT_PROFILE_PHOTO_FRAME, mode: 'fill' })}>Isi bingkai</Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{frame.mode === 'fit' ? 'Fit menampilkan foto utuh dengan ruang putih bila diperlukan.' : 'Isi bingkai memenuhi kotak foto; sebagian tepi dapat terpotong.'} Perbesar untuk menyesuaikan wajah.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" aria-label="Perkecil foto" className="min-h-[44px] min-w-[44px] !px-2" disabled={busy || processing || frame.zoom <= 1} onClick={() => adjust({ zoom: Math.max(1, Math.round((frame.zoom - .1) * 100) / 100) })}><MinusCircle className="w-4 h-4" /></Button>
          <label className="flex-1 min-w-0 text-xs font-semibold"><span className="flex justify-between gap-2"><span>Zoom</span><span>{Math.round(frame.zoom * 100)}%</span></span><input aria-label="Perbesaran foto" type="range" min="100" max={PROFILE_PHOTO_MAX_ZOOM * 100} step="5" value={Math.round(frame.zoom * 100)} disabled={busy || processing} onChange={e => adjust({ zoom: Number(e.target.value) / 100 })} className="w-full min-h-[44px] accent-[var(--theme-primary)]" /></label>
          <Button size="sm" variant="outline" aria-label="Perbesar foto" className="min-h-[44px] min-w-[44px] !px-2" disabled={busy || processing || frame.zoom >= PROFILE_PHOTO_MAX_ZOOM} onClick={() => adjust({ zoom: Math.min(PROFILE_PHOTO_MAX_ZOOM, Math.round((frame.zoom + .1) * 100) / 100) })}><Plus className="w-4 h-4" /></Button>
        </div>
        {layout.overflowX > .5 && <label className="block text-xs font-semibold">Posisi kiri–kanan<input aria-label="Posisi foto kiri kanan" type="range" min="-100" max="100" value={frame.positionX} disabled={busy || processing} onChange={e => adjust({ positionX: Number(e.target.value) })} className="w-full min-h-[44px] accent-[var(--theme-primary)]" /></label>}
        {layout.overflowY > .5 && <label className="block text-xs font-semibold">Posisi atas–bawah<input aria-label="Posisi foto atas bawah" type="range" min="-100" max="100" value={frame.positionY} disabled={busy || processing} onChange={e => adjust({ positionY: Number(e.target.value) })} className="w-full min-h-[44px] accent-[var(--theme-primary)]" /></label>}
        <Button size="sm" variant="ghost" className="min-h-[44px] w-full" leftIcon={<RotateCcw className="w-4 h-4" />} disabled={busy || processing} onClick={() => adjust({ ...DEFAULT_PROFILE_PHOTO_FRAME })}>Atur ulang bingkai</Button>
      </div>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto profil" className="sr-only" disabled={busy || processing} onChange={e => select(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2 justify-center"><Button variant="outline" leftIcon={<Camera className="w-4 h-4" />} disabled={busy || processing} onClick={() => input.current?.click()}>{processing ? 'Mengompres foto…' : 'Pilih foto'}</Button>{user.avatarUrl && <Button variant="ghost" leftIcon={<Trash2 className="w-4 h-4" />} disabled={busy || processing} onClick={() => setRemoveConfirm(true)}>Hapus dari profil</Button>}</div>
      {user.avatarUrl && <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer text-xs leading-relaxed">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={loginAvatarVisible} disabled={busy || processing} onChange={e => void changeLoginVisibility(e.target.checked)} />
          <span><strong>Tampilkan foto akun ini di halaman login</strong><span className="block text-slate-600 dark:text-slate-300 mt-1">Bila diaktifkan, foto dapat dilihat publik tanpa masuk akun. Hanya foto profil yang dipilih, bukan arsip Google Drive lainnya.</span></span>
        </label>
        <p className="text-[11px] text-slate-600 dark:text-slate-400" role="status">{loginAvatarVisible ? 'Foto login publik aktif untuk akun ini.' : 'Foto tetap privat dan login menampilkan ikon pengguna.'}</p>
      </div>}
      {removeConfirm && <div className="p-3 rounded-xl bg-[var(--theme-primary-light)] border border-[var(--theme-primary-border)] text-xs space-y-2"><p>Gunakan inisial kembali? Foto tetap tersimpan sebagai arsip privat di Google Drive.</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => setRemoveConfirm(false)}>Batalkan</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => save(true)}>Ya, gunakan inisial</Button></div></div>}
      <p role="status" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{photo ? `Siap disimpan: ${photo.edge} × ${photo.edge} px · ${Math.ceil(photo.bytes / 1024)} KB JPEG.` : 'JPG, PNG, atau WebP · sumber maksimal 8 MB.'} Foto dikompres otomatis dan disimpan di Google Drive sekolah.</p>
      {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs leading-relaxed">{error}</p>}
    </div>
  </Modal>;
}
