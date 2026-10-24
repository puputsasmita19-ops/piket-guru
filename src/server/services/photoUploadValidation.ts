/** R59 - Validate compressed documentation before creating Drive streams.
 * Allow canonical Base64 with optional existing #wtmk_v1 marker. Never log bytes.
 */
export const MAX_DOCUMENTATION_PHOTO_BYTES = 10 * 1024 * 1024;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export class PhotoUploadValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PhotoUploadValidationError'; }
}

export function decodeDrivePhotoUpload(payload: unknown, declaredMime: unknown): { buffer: Buffer; mimeType: string } {
  if (typeof payload !== 'string' || !payload) throw new PhotoUploadValidationError('Data foto wajib berupa Base64.');
  // Existing watermark pipeline tags encoded JPEG with a URL-fragment marker.
  let encoded = payload.endsWith('#wtmk_v1') ? payload.slice(0, -8) : payload;
  const prefixed = encoded.startsWith('data:');
  const match = DATA_URL.exec(encoded);
  if (prefixed && !match) throw new PhotoUploadValidationError('Format data gambar tidak didukung.');
  if (match) encoded = encoded.slice(match[0].length);
  // Prevent Buffer.from from decoding huge or malformed strings silently.
  const encodedMaximum = Math.ceil(MAX_DOCUMENTATION_PHOTO_BYTES / 3) * 4 + 4;
  if (encoded.length > encodedMaximum || encoded.length < 16) throw new PhotoUploadValidationError('Ukuran foto tidak sesuai batas 10 MB.');
  if (!B64.test(encoded) || encoded.length % 4 !== 0) throw new PhotoUploadValidationError('Data Base64 foto tidak valid.');
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length < 12 || buffer.length > MAX_DOCUMENTATION_PHOTO_BYTES || buffer.toString('base64') !== encoded) {
    throw new PhotoUploadValidationError('Berkas foto rusak atau melebihi 10 MB.');
  }
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  const actual = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : '';
  if (!actual) throw new PhotoUploadValidationError('File bukan JPEG, PNG, atau WebP yang valid.');
  const claimed = declaredMime === undefined || declaredMime === null ? actual : String(declaredMime).toLowerCase();
  const normalizedClaim = claimed === 'image/jpg' ? 'image/jpeg' : claimed;
  if (normalizedClaim !== actual || (match && (match[1].toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${match[1].toLowerCase()}`) !== actual)) {
    throw new PhotoUploadValidationError('Jenis MIME tidak sesuai dengan isi gambar.');
  }
  return { buffer, mimeType: actual };
}
