import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { requireAuth, requireAdmin, recordServerAuditLog } from './authRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { DriveStore } from '../services/driveStore.js';
import { validateProfileJpeg } from '../services/profilePhotoValidation.js';

export const profilePhotoRouter = Router();
const photoPath = (uid: string, fileId: string) => `/api/drive/profile-photo/${encodeURIComponent(uid)}/${fileId}`;
const validUid = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\/\\\x00-\x1f?#]/.test(id);
profilePhotoRouter.post('/profile-photo/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const uid = req.params.userId, { dataUrl, requestId, expectedAvatarUrl } = req.body || {};
  if (!validUid(uid) || typeof requestId !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(requestId) || !(expectedAvatarUrl === null || typeof expectedAvatarUrl === 'string')) {
    res.status(400).json({ success: false, error: 'Permintaan foto profil tidak lengkap.' }); return;
  }
  if (!adminDb) { res.status(503).json({ success: false, error: 'Database belum tersedia.' }); return; }
  let buffer: Buffer;
  try { buffer = validateProfileJpeg(dataUrl); } catch (e: any) { res.status(400).json({ success: false, error: e.message }); return; }
  const ref = adminDb.collection('users').doc(uid);
  try {
    const target = await ref.get();
    if (!target.exists) { res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' }); return; }
    const result = await DriveStore.uploadPhoto({ buffer, mimeType: 'image/jpeg', module: 'profilePhotos', recordId: uid,
      uploadedBy: (req as any).user.uid, contentHash: createHash('sha256').update(buffer).digest('hex'),
      clientPhotoId: 'profile-' + createHash('sha256').update(`${uid}:${requestId}`).digest('hex') });
    // Old files remain private Drive archives; never delete across a profile transaction.
    const avatarUrl = photoPath(uid, result.fileId);
    let changed = false;
    await adminDb.runTransaction(async tx => {
      changed = false;
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('PROFILE_NOT_FOUND');
      const current = snap.data()?.avatarUrl || null;
      if (current === avatarUrl) return; // response lost after an earlier successful save
      if (current !== expectedAvatarUrl) throw new Error('PROFILE_CONFLICT');
      changed = true;
      tx.update(ref, { avatarUrl, updatedAt: new Date().toISOString() });
    });
    if (changed) {
      const caller = (req as any).callerData || {};
      await recordServerAuditLog({ userId: (req as any).user.uid, userName: caller.fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'USERS', status: 'SUCCESS', recordId: uid,
        target: target.data()?.fullName || uid, details: 'Memperbarui foto profil pengguna melalui Google Drive.', metadata: { bytes: buffer.length } }).catch(() => {});
    }
    res.json({ success: true, avatarUrl, size: result.size, folderPath: result.folderPath });
  } catch (e: any) {
    const conflict = e?.message === 'PROFILE_CONFLICT';
    res.status(conflict ? 409 : e?.message === 'PROFILE_NOT_FOUND' ? 404 : 503).json({ success: false, error: conflict ? 'Foto telah diubah admin lain. Tutup lalu buka kembali pengaturan foto.' : 'Foto belum tersimpan. Periksa koneksi Google Drive lalu coba lagi; foto sebelumnya tetap dipertahankan.' });
  }
});

profilePhotoRouter.delete('/profile-photo/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const uid = req.params.userId, expected = req.body?.expectedAvatarUrl;
  if (!validUid(uid) || !(expected === null || typeof expected === 'string')) { res.status(400).json({ success: false, error: 'Permintaan tidak valid.' }); return; }
  if (!adminDb) { res.status(503).json({ success: false, error: 'Database belum tersedia.' }); return; }
  let previous: string | null = null;
  let name = uid;
  try {
    const ref = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async tx => {
      previous = null;
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('PROFILE_NOT_FOUND');
      name = snap.data()?.fullName || uid;
      const current = snap.data()?.avatarUrl || null;
      if (current === null) return;
      if (current !== expected) throw new Error('PROFILE_CONFLICT');
      previous = current;
      tx.update(ref, { avatarUrl: null, updatedAt: new Date().toISOString() });
    });
    if (previous) {
      await recordServerAuditLog({ userId: (req as any).user.uid, userName: (req as any).callerData?.fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'USERS', status: 'SUCCESS', recordId: uid, target: name, details: 'Menghapus foto profil pengguna dan mengembalikan inisial.' }).catch(() => {});
    }
    res.json({ success: true, avatarUrl: null });
  } catch (e: any) { res.status(e?.message === 'PROFILE_CONFLICT' ? 409 : 503).json({ success: false, error: 'Foto belum dapat dihapus. Muat ulang profil dan coba lagi.' }); }
});

profilePhotoRouter.get('/profile-photo/:userId/:fileId', requireAuth, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const uid = req.params.userId, fileId = req.params.fileId;
  if (!validUid(uid) || !/^[A-Za-z0-9_-]+$/.test(String(fileId))) { res.status(400).end(); return; }
  if (!adminDb) { res.status(503).end(); return; }
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists || snap.data()?.avatarUrl !== photoPath(uid, String(fileId)) || (snap.data()?.isActive !== true && (req as any).user.role !== 'ADMIN')) { res.status(404).end(); return; }
    const photo = await DriveStore.getPhotoStream(String(fileId));
    if (photo.mimeType !== 'image/jpeg') { res.status(415).end(); return; }
    res.type('image/jpeg');
    photo.stream.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.destroy(); });
    photo.stream.pipe(res);
  } catch { if (!res.headersSent) res.status(502).end(); }
});
