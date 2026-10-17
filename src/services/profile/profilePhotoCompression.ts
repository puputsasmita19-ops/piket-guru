import { PROFILE_PHOTO_EDGE, PROFILE_PHOTO_TARGET_BYTES, PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SOURCE_MAX_BYTES } from '../../config/profilePhotoPolicy';

export type ProfilePhotoFrame = { mode: 'fit' | 'fill'; zoom: number; positionX: number; positionY: number };
export const DEFAULT_PROFILE_PHOTO_FRAME: ProfilePhotoFrame = { mode: 'fit', zoom: 1, positionX: 0, positionY: 0 };
export const PROFILE_PHOTO_MAX_ZOOM = 3;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

/** A single, uniform scale preserves proportions for both preview and saved JPEG. */
export function getProfilePhotoLayout(width: number, height: number, frame: ProfilePhotoFrame) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error('Ukuran foto tidak valid.');
  const edge = Math.min(PROFILE_PHOTO_EDGE, width, height);
  const scale = (frame.mode === 'fill' ? Math.max(edge / width, edge / height) : Math.min(edge / width, edge / height)) * clamp(frame.zoom, 1, PROFILE_PHOTO_MAX_ZOOM);
  const drawWidth = width * scale, drawHeight = height * scale;
  const overflowX = Math.max(0, drawWidth - edge), overflowY = Math.max(0, drawHeight - edge);
  return {
    edge, drawWidth, drawHeight, overflowX, overflowY,
    left: (edge - drawWidth) / 2 - overflowX * clamp(frame.positionX, -100, 100) / 200,
    top: (edge - drawHeight) / 2 - overflowY * clamp(frame.positionY, -100, 100) / 200,
  };
}

export async function openProfilePhoto(file: File): Promise<HTMLImageElement> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Pilih foto JPG, PNG, atau WebP.');
  if (file.size > PROFILE_PHOTO_SOURCE_MAX_BYTES) throw new Error('Foto sumber maksimal 8 MB. Pilih ukuran yang lebih kecil.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Foto tidak dapat dibuka.');
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** Canvas re-encodes the exact framing shown in preview, removing source metadata. */
export function compressProfilePhoto(img: HTMLImageElement, frame: ProfilePhotoFrame = DEFAULT_PROFILE_PHOTO_FRAME) {
  const { edge, drawWidth, drawHeight, left, top } = getProfilePhotoLayout(img.naturalWidth, img.naturalHeight, frame);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = edge;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Perangkat belum dapat memproses foto.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, edge, edge);
  ctx.drawImage(img, left, top, drawWidth, drawHeight);
  let dataUrl = '', bytes = 0;
  for (const quality of [.85, .75, .65, .55, .45]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];
    bytes = base64.length * .75 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (bytes <= PROFILE_PHOTO_TARGET_BYTES) break;
  }
  if (bytes > PROFILE_PHOTO_MAX_BYTES) throw new Error('Foto masih terlalu besar. Pilih foto lain.');
  return { dataUrl, bytes, edge: canvas.width };
}
