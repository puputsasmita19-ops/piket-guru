import { PROFILE_PHOTO_EDGE, PROFILE_PHOTO_TARGET_BYTES, PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SOURCE_MAX_BYTES } from '../../config/profilePhotoPolicy';

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

/** Canvas crops/re-encodes pixels and removes source metadata. No Base64 persists. */
export function compressProfilePhoto(img: HTMLImageElement, position = 50) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const fraction = Math.max(0, Math.min(100, position)) / 100;
  const sx = (img.naturalWidth - side) * fraction, sy = (img.naturalHeight - side) * fraction;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(PROFILE_PHOTO_EDGE, side);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Perangkat belum dapat memproses foto.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
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
