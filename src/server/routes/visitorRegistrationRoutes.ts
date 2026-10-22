import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { adminDb } from '../firebaseAdmin.js';
import { requireAuth } from './authRoutes.js';
import { normalizeVisitorNames, formatVisitorBadge } from '../../utils/visitorRegistrationUtils.js';

export const visitorRegistrationRouter = Router();
const STAFF_ROLES = new Set(['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM']);
const CATEGORIES = new Set(['DINAS_INSTANSI', 'ORANG_TUA', 'VENDOR_MITRA', 'ALUMNI', 'UMUM', 'LAINNYA']);
const MAX_REQUESTS_PER_LINK = 80;
const MAX_REQUESTS_PER_MINUTE = 6;

function staffOnly(req: Request, res: Response, next: NextFunction): void {
  if (!STAFF_ROLES.has(String((req as any).user?.role || ''))) {
    res.status(403).json({ success: false, error: 'Hanya petugas sekolah yang berwenang.' });
    return;
  }
  next();
}
const clean = (input: unknown, max = 160) => typeof input === 'string' ? input.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf());
const validId = (value: unknown) => typeof value === 'string' && /^vis-[a-zA-Z0-9-]{6,95}$/.test(value);
function validateVisit(data: any, names: string[], publicRequest = false): void {
  if (!validDate(clean(data.tanggal, 10))) throw new Error('Tanggal kunjungan tidak valid.');
  if (!CATEGORIES.has(data.kategori)) throw new Error('Kategori tamu tidak valid.');
  if (clean(data.instansiAsal).length < 2 || clean(data.tujuanBertemu).length < 2 || clean(data.keperluan, 500).length < 3) throw new Error('Instansi, tujuan, dan keperluan wajib diisi.');
  if (names.length < 1) throw new Error('Nama tamu wajib diisi.');
  if (data.kategori === 'LAINNYA' && clean(data.keteranganLainnya, 300).length < 2) throw new Error('Keterangan kategori wajib diisi.');
  if (publicRequest && data.tanggal !== new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)) throw new Error('QR hanya untuk registrasi hari ini.');
}
function visitorPayload(data: any, name: string, index: number, names: string[], id: string, badge: string, actor: string, now: string, groupId: string) {
  const payload: Record<string, unknown> = {
    id, tanggal: data.tanggal, jamMasuk: clean(data.jamMasuk, 5) || new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }),
    namaTamu: name, ...(index === 0 && names.length > 1 ? { namaRombongan: names } : {}), groupId, groupSize: names.length, groupIndex: index + 1,
    instansiAsal: clean(data.instansiAsal), kategori: data.kategori,
    noHp: clean(data.noHp, 30), nomorIdentitas: index === 0 ? clean(data.nomorIdentitas, 80) : '', nomorBadge: badge,
    tujuanBertemu: clean(data.tujuanBertemu), keperluan: clean(data.keperluan, 500),
    status: 'SEDANG_BERKUNJUNG', petugasPiketName: actor, petugasPiketId: clean(data.petugasPiketId, 130),
    createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor, dataSource: 'PRODUCTION', isDemo: false,
  };
  for (const key of ['tujuanRecipientId', 'tujuanUserId', 'tujuanTargetType', 'tujuanDetail', 'keteranganLainnya', 'catatanPetugas']) {
    if (typeof data[key] === 'string' && data[key].trim()) payload[key] = clean(data[key], key === 'catatanPetugas' ? 500 : 300);
  }
  if (index === 0 && typeof data.fotoUrl === 'string' && (data.fotoUrl.startsWith('/api/drive/') || /^data:image\/(jpeg|png|webp);base64,/.test(data.fotoUrl)) && data.fotoUrl.length <= 500000) payload.fotoUrl = data.fotoUrl;
  return payload;
}

/** One counter transaction for all group members prevents duplicate numbers across devices. */
async function createVisitGroup(input: any, names: string[], actor: string, requestId: string, actorRole: string, pendingId?: string) {
  const date = clean(input.tanggal, 10);
  const ref = adminDb.collection('visitorBadgeCounters').doc(date);
  const firstRef = adminDb.collection('visitors').doc(requestId);
  const pendingRef = pendingId ? adminDb.collection('visitorSelfCheckinRequests').doc(pendingId) : null;
  return adminDb.runTransaction(async tx => {
    const [counter, first, pending] = await Promise.all([tx.get(ref), tx.get(firstRef), pendingRef ? tx.get(pendingRef) : Promise.resolve(null)]);
    if (first.exists) return { firstId: requestId, firstBadge: String(first.data()?.nomorBadge || ''), count: names.length, alreadyRegistered: true };
    if (pendingRef && (pending?.data()?.status !== 'PENDING')) throw new Error('Permintaan sudah diproses. Muat ulang daftar.');
    const previous = Number(counter.data()?.last || 0);
    if (!Number.isSafeInteger(previous) || previous < 0 || previous > 99999999) throw new Error('Nomor urut badge bermasalah. Hubungi administrator.');
    const next = previous + names.length;
    const now = new Date().toISOString();
    const groupId = names.length > 1 ? requestId : '';
    for (let i = 0; i < names.length; i++) {
      const id = i === 0 ? requestId : `${requestId}-${i + 1}`;
      const badge = formatVisitorBadge(date, previous + i + 1);
      tx.create(adminDb.collection('visitors').doc(id), visitorPayload(input, names[i], i, names, id, badge, actor, now, groupId));
      const auditRef = adminDb.collection('auditLogs').doc(`visitor-${id}`);
      tx.create(auditRef, { id: auditRef.id, timestamp: now, userId: clean(input.petugasPiketId), userName: actor, role: actorRole, action: 'CREATE', module: 'VISITORS', status: 'SUCCESS', recordId: id, details: `Check-in tamu ${names[i]}, nomor badge ${badge}` });
    }
    tx.set(ref, { last: next, updatedAt: now }, { merge: true });
    if (pendingRef) tx.update(pendingRef, { status: 'APPROVED', reviewedAt: now, approvedVisitId: requestId, reviewedBy: actor });
    return { firstId: requestId, firstBadge: formatVisitorBadge(date, previous + 1), count: names.length, alreadyRegistered: false };
  });
}

visitorRegistrationRouter.post('/register', requireAuth, staffOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const input = req.body || {};
    if (!validId(input.id)) { res.status(400).json({ success: false, error: 'Identitas registrasi tidak valid.' }); return; }
    const names = normalizeVisitorNames(input.namaRombongan, input.namaTamu);
    validateVisit(input, names);
    if (typeof input.fotoUrl === 'string' && input.fotoUrl && !input.fotoUrl.startsWith('/api/drive/') && !(/^data:image\/(jpeg|png|webp);base64,/.test(input.fotoUrl) && input.fotoUrl.length <= 500000)) throw new Error('Foto tidak valid atau terlalu besar untuk check-in.');
    const caller = (req as any).callerData || {};
    const actor = clean(caller.fullName) || 'Petugas Sekolah';
    const data = { ...input, petugasPiketId: (req as any).user.uid };
    const result = await createVisitGroup(data, names, actor, input.id, String((req as any).user.role));
    res.json({ success: true, ...result });
  } catch (err: any) { res.status(400).json({ success: false, error: err.message || 'Gagal registrasi tamu.' }); }
});

visitorRegistrationRouter.post('/qr-session', requireAuth, staffOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = randomUUID();
  try {
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    await adminDb.collection('visitorCheckinLinks').doc(id).create({ createdBy: (req as any).user.uid, createdAt: new Date().toISOString(), expiresAt, submissions: 0 });
    res.json({ success: true, id, expiresAt });
  } catch { res.status(503).json({ success: false, error: 'Belum bisa membuat QR registrasi.' }); }
});

visitorRegistrationRouter.post('/self-submit', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const input = req.body || {};
    if (typeof input.token !== 'string' || !/^[0-9a-f-]{36}$/.test(input.token)) throw new Error('Tautan QR tidak valid.');
    const names = normalizeVisitorNames(input.namaRombongan, input.namaTamu);
    validateVisit(input, names, true);
    const requestId = typeof input.requestId === 'string' && /^[0-9a-f-]{36}$/.test(input.requestId) ? input.requestId : randomUUID();
    const linkRef = adminDb.collection('visitorCheckinLinks').doc(input.token);
    const pendingRef = adminDb.collection('visitorSelfCheckinRequests').doc(requestId);
    const result = await adminDb.runTransaction(async tx => {
      const [link, existing] = await Promise.all([tx.get(linkRef), tx.get(pendingRef)]);
      if (existing.exists) return { id: requestId };
      if (!link.exists || Number(link.data()?.expiresAt || 0) <= Date.now()) throw new Error('QR sudah kedaluwarsa. Minta QR baru kepada petugas.');
      if (Number(link.data()?.submissions || 0) >= MAX_REQUESTS_PER_LINK) throw new Error('Kuota QR penuh. Minta QR baru kepada petugas.');
      const minuteStart = Number(link.data()?.minuteStart || 0);
      const inCurrentMinute = Date.now() - minuteStart < 60_000;
      const minuteCount = inCurrentMinute ? Number(link.data()?.minuteCount || 0) : 0;
      if (minuteCount >= MAX_REQUESTS_PER_MINUTE) throw new Error('Terlalu banyak pendaftaran melalui QR ini. Coba lagi sebentar.');
      tx.update(linkRef, {
        submissions: Number(link.data()?.submissions || 0) + 1,
        minuteStart: inCurrentMinute ? minuteStart : Date.now(), minuteCount: minuteCount + 1,
      });
      tx.create(pendingRef, {
        id: requestId, status: 'PENDING', tanggal: input.tanggal, namaTamu: names[0], namaRombongan: names, kategori: input.kategori,
        keteranganLainnya: clean(input.keteranganLainnya, 300), instansiAsal: clean(input.instansiAsal),
        noHp: clean(input.noHp, 30), tujuanBertemu: clean(input.tujuanBertemu), keperluan: clean(input.keperluan, 500),
        createdAt: new Date().toISOString(), qrLinkId: input.token,
      });
      return { id: requestId };
    });
    res.json({ success: true, id: result.id, message: 'Pendaftaran diterima. Silakan menemui petugas untuk verifikasi dan menerima badge.' });
  } catch (err: any) { res.status(400).json({ success: false, error: err.message || 'Pendaftaran belum berhasil.' }); }
});

visitorRegistrationRouter.get('/pending', requireAuth, staffOnly, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const snapshot = await adminDb.collection('visitorSelfCheckinRequests').where('status', '==', 'PENDING').limit(60).get();
    res.json({ success: true, items: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch { res.status(503).json({ success: false, error: 'Daftar pendaftaran mandiri belum dapat dibaca.' }); }
});

visitorRegistrationRouter.post('/review', requireAuth, staffOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { id, decision } = req.body || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id) || !['APPROVED', 'REJECTED'].includes(decision)) {
    res.status(400).json({ success: false, error: 'Pilihan verifikasi tidak valid.' }); return;
  }
  try {
    const ref = adminDb.collection('visitorSelfCheckinRequests').doc(id);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.status !== 'PENDING') throw new Error('Pendaftaran sudah diproses atau tidak ditemukan.');
    const actor = clean((req as any).callerData?.fullName) || 'Petugas Sekolah';
    if (decision === 'REJECTED') {
      await adminDb.runTransaction(async tx => {
        const fresh = await tx.get(ref);
        if (fresh.data()?.status !== 'PENDING') throw new Error('Pendaftaran sudah diproses.');
        tx.update(ref, { status: 'REJECTED', reviewedBy: actor, reviewedAt: new Date().toISOString() });
      });
      res.json({ success: true }); return;
    }
    const input = doc.data()!;
    const names = normalizeVisitorNames(input.namaRombongan, input.namaTamu);
    validateVisit(input, names);
    const visitId = `vis-qr-${id}`;
    const result = await createVisitGroup({ ...input, petugasPiketId: (req as any).user.uid }, names, actor, visitId, String((req as any).user.role), id);
    res.json({ success: true, ...result });
  } catch (err: any) { res.status(409).json({ success: false, error: err.message || 'Verifikasi gagal.' }); }
});
