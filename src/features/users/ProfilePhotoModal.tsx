import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { UserAvatar } from '../../components/common/UserAvatar';
import { Camera, Trash2 } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile } from '../../types';
import { ProfilePhotoService } from '../../services/profile/profilePhotoService';
import { openProfilePhoto, compressProfilePhoto } from '../../services/profile/profilePhotoCompression';

export default function ProfilePhotoModal({ user, onClose, onSaved }: { user: UserProfile; onClose: () => void; onSaved: (url: string | null) => void }) {
  const { hasRole, currentUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState(50);
  const [photo, setPhoto] = useState<ReturnType<typeof compressProfilePhoto> | null>(null);
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const admin = hasRole('ADMIN');
  const viewer = useRef(currentUser?.id);
  useEffect(() => () => { ++request.current; }, []);
  useEffect(() => { if (viewer.current !== currentUser?.id || !admin) onClose(); }, [currentUser?.id, admin]);
  const crop = (img: HTMLImageElement, value: number) => {
    setPhoto(compressProfilePhoto(img, value)); setRequestId(crypto.randomUUID()); setPosition(value);
  };
  const select = async (file?: File) => {
    if (!file || busy || !admin) return;
    const id = ++request.current;
    setProcessing(true); setError('');
    try { setRemoveConfirm(false); const img = await openProfilePhoto(file); if (id !== request.current) return; crop(img, 50); setImage(img); }
    catch (e: any) { if (id === request.current) setError(e.message || 'Foto tidak dapat diproses.'); }
    finally { if (id === request.current) setProcessing(false); if (input.current) input.current.value = ''; }
  };
  const save = async (remove = false) => {
    if (busy || processing || !admin || (!remove && !photo)) return;
    setBusy(true); setError('');
    const id = ++request.current;
    try {
      const result = remove ? await ProfilePhotoService.remove(user.id, user.avatarUrl || null) : await ProfilePhotoService.save(user.id, photo!.dataUrl, requestId, user.avatarUrl || null);
      if (id !== request.current) return;
      onSaved(result.avatarUrl); onClose();
    } catch (e: any) { if (id === request.current) setError(e.message || 'Foto belum tersimpan.'); }
    finally { if (id === request.current) setBusy(false); }
  };
  if (!admin) return null;
  return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title="Foto profil pengguna" maxWidth="md" footer={<div className="flex gap-2 justify-end"><Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button><Button onClick={() => save()} disabled={!photo || processing} isLoading={busy} loadingText="Memproses…">Simpan foto</Button></div>}>
    <div className="space-y-4 text-sm">
      <div><h3 className="font-bold">{user.fullName}</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Foto ini tampil di beranda, header, dan profil pengguna.</p></div>
      <div className="flex justify-center">{photo ? <img src={photo.dataUrl} alt="Pratinjau bingkai foto profil" className="w-36 h-36 rounded-3xl object-cover border border-[var(--theme-card-border)]" /> : <UserAvatar user={user} className="w-36 h-36 rounded-3xl text-4xl" />}</div>
      {image && image.naturalWidth !== image.naturalHeight && <label className="block text-xs font-semibold">{image.naturalHeight > image.naturalWidth ? 'Geser bingkai atas–bawah' : 'Geser bingkai kiri–kanan'}<input type="range" min="0" max="100" value={position} disabled={busy || processing} onChange={e => { try { crop(image, Number(e.target.value)); } catch (err: any) { setError(err.message); } }} className="w-full mt-3 accent-[var(--theme-primary)] min-h-[44px]" /></label>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto profil" className="sr-only" disabled={busy || processing} onChange={e => select(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2 justify-center"><Button variant="outline" leftIcon={<Camera className="w-4 h-4" />} disabled={busy || processing} onClick={() => input.current?.click()}>{processing ? 'Mengompres foto…' : 'Pilih foto'}</Button>{user.avatarUrl && <Button variant="ghost" leftIcon={<Trash2 className="w-4 h-4" />} disabled={busy || processing} onClick={() => setRemoveConfirm(true)}>Hapus dari profil</Button>}</div>
      {removeConfirm && <div className="p-3 rounded-xl bg-[var(--theme-primary-light)] border border-[var(--theme-primary-border)] text-xs space-y-2"><p>Gunakan inisial kembali? Foto tetap tersimpan sebagai arsip privat di Google Drive.</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => setRemoveConfirm(false)}>Batalkan</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => save(true)}>Ya, gunakan inisial</Button></div></div>}
      <p role="status" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{photo ? `Siap disimpan: ${photo.edge} × ${photo.edge} px · ${Math.ceil(photo.bytes / 1024)} KB JPEG.` : 'JPG, PNG, atau WebP · sumber maksimal 8 MB.'} Foto dikompres otomatis dan disimpan di Google Drive sekolah.</p>
      {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs leading-relaxed">{error}</p>}
    </div>
  </Modal>;
}
