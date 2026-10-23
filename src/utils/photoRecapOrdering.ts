import type { PhotoRecapItem, WatermarkStatus } from '../types/watermark.types';

export type PhotoSortDirection = 'NEWEST' | 'OLDEST';
export type PhotoWatermarkFilter = 'ALL' | WatermarkStatus;

/** Stable local-day ordering. Documentation time takes precedence over incident time. */
export function photoChronologyKey(photo: PhotoRecapItem): string {
  const date = (photo.tanggalDokumentasi || photo.tanggalKejadian || '').slice(0, 10);
  const time = (photo.waktuDokumentasi || photo.waktuKejadian || '').match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  return `${date}T${time ? `${time[1].padStart(2, '0')}:${time[2]}:${time[3] || '00'}` : '00:00:00'}`;
}

export function orderPhotoRecap(items: PhotoRecapItem[], direction: PhotoSortDirection): PhotoRecapItem[] {
  return [...items].sort((a, b) => {
    const dateDiff = photoChronologyKey(a).localeCompare(photoChronologyKey(b));
    return (direction === 'NEWEST' ? -dateDiff : dateDiff) || a.id.localeCompare(b.id);
  });
}

export function eligibleForVisualReview(photo: PhotoRecapItem): boolean {
  return (photo.sourceModule === 'VISITOR' || photo.sourceModule === 'INCIDENT') &&
    photo.watermarkStatus === 'UNKNOWN' && Boolean(photo.sourceId && photo.photoUrl);
}
