import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { acquireProfileImage } from '../../services/profile/profilePhotoService';

export function UserAvatar({ user, className = '', thumbnail = false }: { user?: { fullName?: string; avatarUrl?: string | null } | null; className?: string; thumbnail?: boolean }) {
  const { currentUser } = useAuth();
  const [photo, setPhoto] = useState<{ source: string; url: string } | null>(null);
  const source = user?.avatarUrl || '';
  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (!source) return;
    try {
      const image = acquireProfileImage(source, thumbnail ? 'thumbnail' : 'original');
      image.promise.then(url => { if (active) setPhoto({ source, url }); }).catch(() => {});
      return () => { active = false; image.release(); };
    } catch { /* Initials remain visible if no authenticated image is available. */ }
  }, [source, currentUser?.id, thumbnail]);
  return <span className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-bold ${className}`}>
    <span aria-hidden="true">{user?.fullName?.trim().charAt(0).toUpperCase() || 'P'}</span>
    {photo?.source === source && <img src={photo.url} alt={`Foto profil ${user?.fullName || 'pengguna'}`} className="absolute inset-0 w-full h-full object-cover" decoding="async" loading="lazy" onError={() => setPhoto(null)} />}
  </span>;
}
