import type { PhotoWatermarkReview, WatermarkStatus } from '../types/watermark.types';

/** Non-security fingerprint for associating a manual review with a particular image URL. */
export function photoReviewKey(url: string): string {
  let hash = 2166136261;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${url.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Never infer watermark absence from an opaque Drive URL or missing URL marker. */
export function resolvePhotoWatermarkStatus(photoUrl: string, review?: PhotoWatermarkReview | null,
  captureMode?: 'WATERMARK' | 'ORIGINAL' | null,
): { status: WatermarkStatus; source: 'REVIEW' | 'CAPTURE' | 'UNKNOWN'; reviewedAt?: string; reviewedBy?: string } {
  if (review?.photoKey === photoReviewKey(photoUrl) && (review.status === 'WATERMARK' || review.status === 'ORIGINAL')) {
    return { status: review.status, source: 'REVIEW', reviewedAt: review.reviewedAt, reviewedBy: review.reviewedByName };
  }
  if (captureMode === 'WATERMARK' || captureMode === 'ORIGINAL') {
    return { status: captureMode, source: 'CAPTURE' };
  }
  return { status: 'UNKNOWN', source: 'UNKNOWN' };
}

export function getPhotoWatermarkLabel(status: WatermarkStatus): string {
  return status === 'WATERMARK' ? 'Berwatermark' : status === 'ORIGINAL' ? 'Tanpa watermark' : 'Status watermark belum diverifikasi';
}
