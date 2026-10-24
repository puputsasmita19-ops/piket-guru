import { PROFILE_PHOTO_EDGE, PROFILE_PHOTO_MAX_BYTES, LOGIN_THUMB_EDGE, LOGIN_THUMB_MAX_BYTES } from '../../config/profilePhotoPolicy.js';

/** Read actual JPEG dimensions, not client MIME/size claims. */
export function validateProfileJpeg(dataUrl: unknown, maxBytes = PROFILE_PHOTO_MAX_BYTES, requiredEdge?: number): Buffer {
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(maxBytes / 3) * 4 + 30 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) throw new Error('Foto harus JPEG terkompres, maksimal 150 KB.');
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  if (buffer.length < 12 || buffer.length > maxBytes || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) throw new Error('Berkas JPEG tidak valid.');
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset++] !== 0xff) break;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 8) {
      const height = buffer.readUInt16BE(offset + 3), width = buffer.readUInt16BE(offset + 5);
      if (width < 1 || height < 1 || width > PROFILE_PHOTO_EDGE || height > PROFILE_PHOTO_EDGE || width !== height || (requiredEdge !== undefined && width !== requiredEdge)) throw new Error('Dimensi JPEG tidak sesuai kebijakan foto.');
      return buffer;
    }
    offset += length;
  }
  throw new Error('Dimensi foto JPEG tidak dapat diverifikasi.');
}

/** JPEG square thumbnail with hard cap and exact dimensions; server never trusts the browser. */
export function validateLoginThumbnailJpeg(dataUrl: unknown): Buffer {
  return validateProfileJpeg(dataUrl, LOGIN_THUMB_MAX_BYTES, LOGIN_THUMB_EDGE);
}
