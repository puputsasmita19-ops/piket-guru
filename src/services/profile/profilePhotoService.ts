import { auth } from '../firebase/firebaseAuth';

async function request(userId: string, method: 'POST' | 'DELETE', body: object) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Akun telah berubah.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let responded = false;
  try {
    const res = await fetch(`/api/drive/profile-photo/${encodeURIComponent(userId)}`, {
      signal: controller.signal, method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    responded = true;
    const data = await res.json();
    if (auth.currentUser?.uid !== user.uid) throw new Error('Akun telah berubah.');
    if (!res.ok || !data.success) throw new Error(data.error || 'Foto profil belum tersimpan. Coba kembali.');
    return data as { success: true; avatarUrl: string | null; size?: number };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Koneksi lambat. Foto belum terkonfirmasi; coba Simpan foto lagi.');
    if (!responded) throw new Error('Koneksi gagal. Coba Simpan foto lagi.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function setProfileLoginVisibility(userId: string, expectedAvatarUrl: string, visible: boolean): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Akun telah berubah.');
  const res = await fetch(`/api/drive/profile-photo/${encodeURIComponent(userId)}/login-visibility`, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ visible, expectedAvatarUrl }),
  });
  const data = await res.json();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Akun telah berubah.');
  if (!res.ok || !data.success) throw new Error(data.error || 'Pilihan foto login belum berhasil disimpan.');
  return data.loginAvatarVisible === true;
}

export const ProfilePhotoService = {
  save: (userId: string, dataUrl: string, requestId: string, expectedAvatarUrl: string | null) => request(userId, 'POST', { dataUrl, requestId, expectedAvatarUrl }),
  remove: (userId: string, expectedAvatarUrl: string | null) => request(userId, 'DELETE', { expectedAvatarUrl }),
};

// Object URLs exist only while avatars are mounted; concurrent header/dashboard
// instances share one read. Scope prevents account-switch cache reuse.
type Entry = { refs: number; controller: AbortController; url: string; promise: Promise<string> };
const images = new Map<string, Entry>();
let scope = '';
export function acquireProfileImage(path: string) {
  if (!/^\/api\/drive\/(?:profile-photo\/[^/?]+\/|photo\/)[A-Za-z0-9_-]+$/.test(path)) throw new Error('Foto profil belum tersedia.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sesi tidak tersedia.');
  if (scope !== uid) {
    for (const entry of images.values()) { entry.controller.abort(); if (entry.url) URL.revokeObjectURL(entry.url); }
    images.clear(); scope = uid;
  }
  const key = `${uid}:${path}`;
  let entry = images.get(key);
  if (!entry) {
    entry = { refs: 0, controller: new AbortController(), url: '', promise: Promise.resolve('') };
    const current = entry;
    entry.promise = (async () => {
      const token = await auth.currentUser!.getIdToken();
      if (auth.currentUser?.uid !== uid || current.controller.signal.aborted) throw new Error('Sesi berubah.');
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: current.controller.signal });
      if (!res.ok) throw new Error('Foto belum tersedia.');
      const blob = await res.blob();
      if (blob.type !== 'image/jpeg' || auth.currentUser?.uid !== uid || current.controller.signal.aborted) throw new Error('Foto tidak valid.');
      current.url = URL.createObjectURL(blob);
      return current.url;
    })();
    images.set(key, entry);
  }
  entry.refs++;
  let released = false;
  return { promise: entry.promise, release: () => {
    if (released) return; released = true;
    if (--entry!.refs === 0) {
      entry!.controller.abort(); if (entry!.url) URL.revokeObjectURL(entry!.url);
      if (images.get(key) === entry) images.delete(key);
    }
  } };
}
