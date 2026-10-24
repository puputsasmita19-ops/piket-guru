import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { requireAuth, requireAdmin, recordServerAuditLog } from './authRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { DriveStore } from '../services/driveStore.js';
import { validateProfileJpeg, validateLoginThumbnailJpeg } from '../services/profilePhotoValidation.js';
import { LOGIN_THUMB_MAX_BYTES } from '../../config/profilePhotoPolicy.js';

export const profilePhotoRouter = Router();
const photoPath = (uid: string, fileId: string) => `/api/drive/profile-photo/${encodeURIComponent(uid)}/${fileId}`;
const validUid = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\/\\\x00-\x1f?#]/.test(id);
profilePhotoRouter.post('/profile-photo/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const uid = req.params.userId, { dataUrl, thumbnailDataUrl, requestId, expectedAvatarUrl } = req.body || {};
  if (!validUid(uid) || typeof requestId !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(requestId) || !(expectedAvatarUrl === null || typeof expectedAvatarUrl === 'string')) {
    res.status(400).json({ success: false, error: 'Permintaan foto profil tidak lengkap.' }); return;
  }
  if (!adminDb) { res.status(503).json({ success: false, error: 'Database belum tersedia.' }); return; }
  let buffer: Buffer, thumbBuffer: Buffer | null = null;
  try {
    buffer = validateProfileJpeg(dataUrl);
    // Accept older deployed clients during staggered rollout; they keep legacy
    // behaviour until the next photo change. New clients send a strict thumbnail.
    if (thumbnailDataUrl !== undefined) thumbBuffer = validateLoginThumbnailJpeg(thumbnailDataUrl);
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); return; }
  const ref = adminDb.collection('users').doc(uid);
  try {
    const target = await ref.get();
    if (!target.exists) { res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' }); return; }
    // Save thumbnail once at admin upload time, rather than resizing on every
    // unauthenticated login GET. Distinct idempotency keys prevent collisions.
    const thumbnailResult = thumbBuffer ? await DriveStore.uploadPhoto({ buffer: thumbBuffer, mimeType: 'image/jpeg', module: 'profilePhotos', recordId: uid,
      uploadedBy: (req as any).user.uid, contentHash: createHash('sha256').update(thumbBuffer).digest('hex'),
      clientPhotoId: 'login-thumb-' + createHash('sha256').update(`${uid}:${requestId}`).digest('hex') }) : null;
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
      // A new photo needs fresh, explicit approval before appearing publicly.
      tx.update(ref, { avatarUrl, loginAvatarVisible: false, loginAvatarThumbFileId: thumbnailResult?.fileId || null, updatedAt: new Date().toISOString() });
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
      tx.update(ref, { avatarUrl: null, loginAvatarVisible: false, loginAvatarThumbFileId: null, updatedAt: new Date().toISOString() });
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


/**
 * Public login avatars are OPT-IN per user, controlled only by an administrator.
 * Private profile photos remain protected by the existing authenticated route.
 */
profilePhotoRouter.post('/profile-photo/:userId/login-visibility', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const uid = req.params.userId;
  const { visible, expectedAvatarUrl } = req.body || {};
  if (!validUid(uid) || typeof visible !== 'boolean' || typeof expectedAvatarUrl !== 'string' || !/^\/api\/drive\/profile-photo\//.test(expectedAvatarUrl)) {
    res.status(400).json({ success: false, error: 'Pilihan tampilan foto atau foto referensi tidak valid.' }); return;
  }
  if (!adminDb) { res.status(503).json({ success: false, error: 'Database belum tersedia.' }); return; }
  try {
    const ref = adminDb.collection('users').doc(uid);
    let changed = false;
    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!snap.exists || data?.isActive !== true) throw new Error('PROFILE_NOT_FOUND');
      if (data?.avatarUrl !== expectedAvatarUrl) throw new Error('PROFILE_CONFLICT');
      changed = data?.loginAvatarVisible !== visible;
      if (changed) tx.update(ref, { loginAvatarVisible: visible, updatedAt: new Date().toISOString() });
    });
    if (changed) {
      await recordServerAuditLog({ userId: (req as any).user.uid, userName: (req as any).callerData?.fullName || 'Administrator', role: 'ADMIN', action: 'UPDATE', module: 'USERS', status: 'SUCCESS', recordId: uid, details: visible ? 'Mengizinkan foto profil tampil pada halaman login publik.' : 'Menonaktifkan foto profil dari halaman login publik.' }).catch(() => {});
    }
    res.json({ success: true, loginAvatarVisible: visible });
  } catch (e: any) {
    res.status(e?.message === 'PROFILE_CONFLICT' ? 409 : e?.message === 'PROFILE_NOT_FOUND' ? 404 : 503).json({ success: false, error: e?.message === 'PROFILE_CONFLICT' ? 'Foto berubah. Buka kembali pengaturan foto lalu coba lagi.' : 'Izin foto belum tersimpan.' });
  }
});

profilePhotoRouter.get('/login-avatar/:userId/:fileId', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const uid = req.params.userId, fileId = String(req.params.fileId);
  if (!validUid(uid) || !/^[A-Za-z0-9_-]+$/.test(fileId)) { res.status(400).end(); return; }
  if (!adminDb) { res.status(503).end(); return; }
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    const data = snap.data();
    // Never serve unapproved, inactive, old or guessed Drive files.
    if (!snap.exists || data?.isActive !== true || data?.loginAvatarVisible !== true || data?.avatarUrl !== photoPath(uid, fileId)) {
      res.status(404).end(); return;
    }
    // The endpoint still uses the currently approved *original* file id in
    // its URL so changing/revoking the photo invalidates old URLs. Only after
    // the Firestore permission check does it resolve the smaller derivative.
    const thumbId = data.loginAvatarThumbFileId;
    const useThumbnail = typeof thumbId === 'string' && /^[A-Za-z0-9_-]+$/.test(thumbId);
    const photo = await DriveStore.getPhotoStream(useThumbnail ? thumbId : fileId);
    if (photo.mimeType !== 'image/jpeg' || (photo.size !== undefined && (photo.size < 12 || photo.size > (useThumbnail ? LOGIN_THUMB_MAX_BYTES : 153600)))) {
      photo.stream.destroy(); res.status(415).end(); return;
    }
    res.type('image/jpeg');
    if (photo.size) res.setHeader('Content-Length', photo.size);
    res.setHeader('X-Avatar-Variant', useThumbnail ? 'thumbnail' : 'legacy');
    photo.stream.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.destroy(); });
    res.on('close', () => { if (!res.writableEnded) photo.stream.destroy(); });
    photo.stream.pipe(res);
  } catch { if (!res.headersSent) res.status(502).end(); }
});
