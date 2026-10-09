import type { LocationCoordinates } from '../location/locationService';

export interface SelfieEvidence {
  userId: string;
  userName: string;
  loginId?: string;
  schoolName: string;
  capturedAt: number;
  coords: LocationCoordinates;
}

export interface CapturedSelfie extends SelfieEvidence {
  dataUrl: string;
}

// Keep the existing photoUrl field comfortably below Firestore's document limit.
export const MAX_SELFIE_DATA_URL_LENGTH = 700_000;
export const SELFIE_GPS_MAX_AGE_MS = 30_000;

export function validateSelfieEvidence(evidence: SelfieEvidence, now = Date.now()): void {
  const { coords, capturedAt } = evidence;
  if (!evidence.userId?.trim() || !evidence.userName?.trim() || !evidence.schoolName?.trim()) {
    throw new Error('Nama akun atau sekolah belum tersedia. Muat ulang halaman sebelum mengambil foto.');
  }
  if (!coords || !Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90 ||
      !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180 ||
      !Number.isFinite(coords.accuracy) || coords.accuracy <= 0 || coords.accuracy > 50 ||
      !Number.isFinite(coords.timestamp) || coords.timestamp <= 0 ||
      !Number.isFinite(capturedAt) || capturedAt <= 0 ||
      capturedAt > now + 5000 || now - capturedAt > SELFIE_GPS_MAX_AGE_MS ||
      coords.timestamp > capturedAt + 5000 || capturedAt - coords.timestamp > SELFIE_GPS_MAX_AGE_MS) {
    throw new Error('Foto atau GPS sudah kedaluwarsa/tidak valid. Ambil ulang swafoto dengan GPS akurat.');
  }
}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatSelfieTime(timestamp: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(timestamp)) + ' WIB';
}

/** Stamp into JPEG pixels. The appended panel never covers or mirrors the face. */
export function stampCheckInSelfie(source: HTMLCanvasElement, evidence: SelfieEvidence): string {
  validateSelfieEvidence(evidence);
  if (source.width <= 0 || source.height <= 0) throw new Error('Kamera belum siap. Coba ambil foto lagi.');
  const width = Math.max(640, Math.min(960, source.width));
  const photoHeight = Math.round(width * source.height / source.width);
  if (photoHeight > 1920) throw new Error('Rasio foto tidak didukung. Gunakan kamera dalam posisi normal.');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Watermark tidak dapat dibuat. Coba gunakan browser lain.');
  const padding = Math.round(width * 0.035);
  const fontSize = Math.round(width * 0.027);
  const lineHeight = Math.round(fontSize * 1.5);
  context.font = `500 ${fontSize}px Arial, sans-serif`;
  const textWidth = width - padding * 2;
  const wrap = (value: string): string[] => {
    const result: string[] = [];
    let line = '';
    for (const word of cleanText(value).split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= textWidth) {
        line = candidate;
        continue;
      }
      if (line) result.push(line);
      line = '';
      // Split only unusually long words/IDs; preserve every character of the identity.
      for (const character of word) {
        if (context.measureText(line + character).width > textWidth && line) {
          result.push(line);
          line = character;
        } else line += character;
      }
    }
    if (line.trim()) result.push(line.trim());
    return result;
  };
  const lines = [
    ...wrap(evidence.schoolName),
    ...wrap(`Nama: ${evidence.userName}`),
    ...(evidence.loginId?.trim() ? wrap(`ID login: ${evidence.loginId}`) : []),
    ...wrap(`Waktu foto: ${formatSelfieTime(evidence.capturedAt)}`),
    ...wrap(`GPS: ${evidence.coords.latitude.toFixed(6)}, ${evidence.coords.longitude.toFixed(6)}`),
    ...wrap(`Akurasi GPS: ±${evidence.coords.accuracy.toFixed(1)} m`),
    ...wrap(`Waktu GPS: ${formatSelfieTime(evidence.coords.timestamp)}`),
  ];
  if (lines.length > 24) throw new Error('Nama akun/sekolah terlalu panjang untuk watermark. Hubungi admin.');
  canvas.width = width;
  canvas.height = photoHeight + padding * 2 + lineHeight * (lines.length + 1) + 10;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, width, photoHeight);
  context.fillStyle = '#0f172a';
  context.fillRect(0, photoHeight, width, canvas.height - photoHeight);
  context.fillStyle = '#34d399';
  context.fillRect(0, photoHeight, width, 5);
  context.textBaseline = 'top';
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.fillText('PRESENSI MASUK • CHECK-IN', padding, photoHeight + padding);
  context.font = `500 ${fontSize}px Arial, sans-serif`;
  context.fillStyle = '#f8fafc';
  lines.forEach((line, index) => context.fillText(line, padding, photoHeight + padding + lineHeight * (index + 1) + 5));
  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.startsWith('data:image/jpeg;base64,') && dataUrl.length <= MAX_SELFIE_DATA_URL_LENGTH) return dataUrl;
  }
  if (width > 640) {
    // Re-render the panel at a readable font size instead of shrinking stamped text.
    const smaller = document.createElement('canvas');
    smaller.width = 640;
    smaller.height = Math.round(640 * source.height / source.width);
    const smallerContext = smaller.getContext('2d');
    if (!smallerContext) throw new Error('Watermark tidak dapat dibuat. Coba gunakan browser lain.');
    smallerContext.drawImage(source, 0, 0, smaller.width, smaller.height);
    return stampCheckInSelfie(smaller, evidence);
  }
  throw new Error('Ukuran foto terlalu besar. Dekatkan kamera dan ambil ulang foto.');
}
