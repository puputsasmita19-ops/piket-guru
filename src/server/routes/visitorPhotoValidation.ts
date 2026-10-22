/** Small JPEG-only public photo payload; never accept arbitrary URLs or oversized base64. */
export function validateVisitorQrPhoto(photo: unknown, consent: unknown): string | undefined {
  if (photo === undefined || photo === null || photo === '') return undefined;
  if (typeof photo !== 'string' || photo.length > 115_000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
    throw new Error('Foto harus berupa JPEG berukuran kecil dari kamera registrasi.');
  }
  if (consent !== true) throw new Error('Persetujuan dokumentasi foto wajib diberikan.');
  const bytes = Buffer.from(photo.slice('data:image/jpeg;base64,'.length), 'base64');
  if (bytes.length < 100 || bytes.length > 86_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error('Berkas foto tidak valid atau terlalu besar.');
  }
  return photo;
}
