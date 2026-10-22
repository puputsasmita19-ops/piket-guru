/** Keep public QR selfie photos small enough to avoid large Firestore documents. */
export const MAX_VISITOR_QR_PHOTO_DATA_URL = 115_000;

export async function compressVisitorQrPhoto(source: string): Promise<string> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(source)) {
    throw new Error('Format foto tidak didukung. Gunakan kamera atau berkas JPG/PNG.');
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Foto tidak dapat dibaca. Silakan ambil ulang.'));
    image.src = source;
  });
  const ratio = Math.min(1, 440 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Pengolahan foto tidak tersedia pada perangkat ini.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.67, 0.52, 0.4]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= MAX_VISITOR_QR_PHOTO_DATA_URL) return data;
  }
  throw new Error('Foto terlalu besar. Gunakan gambar lain atau minta petugas mengambil foto.');
}
