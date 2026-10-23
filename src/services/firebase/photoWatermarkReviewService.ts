import { FirestoreService } from './firestoreService';
import { auth } from './firebase';
import type { UserProfile } from '../../types';
import type { IncidentRecord } from '../../types/incident.types';
import type { VisitorRecord } from '../../types/visitor.types';
import type { PhotoWatermarkReview, WatermarkStatus } from '../../types/watermark.types';
import { photoReviewKey } from '../../utils/photoWatermarkStatus';

/** This confirms only whether the watermark is visibly present, NOT authenticity of the photo. */
export class PhotoWatermarkReviewService {
  static async review(
    module: 'VISITOR' | 'INCIDENT', recordId: string, photoUrl: string,
    status: Exclude<WatermarkStatus, 'UNKNOWN'>, user: UserProfile,
    photoIndex?: number
  ): Promise<PhotoWatermarkReview> {
    if (user.role !== 'ADMIN' || !auth.currentUser || auth.currentUser.uid !== user.id) {
      throw new Error('Hanya Admin dengan sesi aktif yang boleh memverifikasi watermark foto.');
    }
    if (status !== 'WATERMARK' && status !== 'ORIGINAL') throw new Error('Status watermark tidak valid.');
    if (!recordId || !photoUrl) throw new Error('Identitas foto tidak tersedia.');

    const collection = module === 'VISITOR' ? 'visitors' : 'incidents';
    const existing = await FirestoreService.getByIdStrict<VisitorRecord | IncidentRecord>(collection, recordId);
    if (!existing) throw new Error('Data sumber tidak ditemukan. Muat ulang arsip.');
    const review: PhotoWatermarkReview = {
      status,
      photoKey: photoReviewKey(photoUrl),
      reviewedAt: new Date().toISOString(),
      reviewedById: user.id,
      reviewedByName: user.fullName,
    };
    let updated: Record<string, unknown>;
    if (module === 'VISITOR') {
      const visitor = existing as VisitorRecord;
      const actualUrl = visitor.fotoUrl || (visitor as any).photoUrl || (visitor as any).fotoTamu || (visitor as any).foto;
      if (actualUrl !== photoUrl) throw new Error('Foto telah berubah. Tutup lalu buka ulang detail foto.');
      updated = { ...visitor, fotoWatermarkReview: review };
    } else {
      const incident = existing as IncidentRecord;
      if (photoIndex !== undefined) {
        if (!Number.isInteger(photoIndex) || photoIndex < 0 || !incident.photos?.[photoIndex] ||
            (incident.photos[photoIndex].url || (incident.photos[photoIndex] as any).photoUrl || (incident.photos[photoIndex] as any).fotoUrl || (incident.photos[photoIndex] as any).urlFoto) !== photoUrl) {
          throw new Error('Foto kejadian sudah berubah. Muat ulang arsip.');
        }
        updated = { ...incident, photos: incident.photos.map((photo, idx) => idx === photoIndex ? { ...photo, watermarkReview: review } : photo) };
      } else {
        const legacyUrl = (incident as any).fotoUrl || (incident as any).photoUrl || (incident as any).foto || (incident as any).buktiFoto;
        if (legacyUrl !== photoUrl) throw new Error('Foto kejadian telah berubah. Muat ulang arsip.');
        updated = { ...incident, fotoWatermarkReview: review };
      }
    }

    await FirestoreService.setDocumentWithAudit(collection, recordId, {
      ...updated, updatedAt: FirestoreService.nextUpdatedAt(existing), updatedBy: user.fullName,
    } as any, {
      userId: user.id, userName: user.fullName, role: user.role,
      action: 'UPDATE', module: module === 'VISITOR' ? 'VISITORS' : 'INCIDENTS', recordId,
      details: `Verifikasi visual watermark foto ${module === 'VISITOR' ? 'Buku Tamu' : 'Kejadian'}: ${status}. Tidak mengubah berkas foto.`,
      metadata: { photoIndex: photoIndex ?? null, status, reviewedAt: review.reviewedAt },
    }, { expectedState: existing });
    return review;
  }
}
