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

// Target size range: 150 - 250 KB JPEG (Base64 length ~200k - 340k chars)
export const TARGET_MAX_DATA_URL_LENGTH = 340_000;
// Safe maximum limit for Firestore doc safety (< 400 KB JPEG Base64, well under Firestore 1MB limit)
export const SAFE_MAX_DATA_URL_LENGTH = 550_000;
export const MAX_SELFIE_DATA_URL_LENGTH = SAFE_MAX_DATA_URL_LENGTH;
export const SELFIE_GPS_MAX_AGE_MS = 30_000;

export interface SelfieSizeCheckResult {
  isValid: boolean;
  sizeKb: number;
  isWithinTarget: boolean;
  error?: string;
}

export function checkSelfieDataUrlSize(dataUrl: string): SelfieSizeCheckResult {
  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
    return {
      isValid: false,
      sizeKb: 0,
      isWithinTarget: false,
      error: 'Format foto presensi tidak valid. Ambil ulang swafoto dari kamera.',
    };
  }

  const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length;
  const sizeBytes = Math.round(base64Length * 0.75);
  const sizeKb = Math.round(sizeBytes / 1024);

  if (dataUrl.length > SAFE_MAX_DATA_URL_LENGTH) {
    return {
      isValid: false,
      sizeKb,
      isWithinTarget: false,
      error: `Ukuran foto presensi (${sizeKb} KB) melebihi batas aman dokumen (${Math.round((SAFE_MAX_DATA_URL_LENGTH * 0.75) / 1024)} KB). Silakan ambil ulang foto dengan jarak dan pencahayaan yang pas.`,
    };
  }

  return {
    isValid: true,
    sizeKb,
    isWithinTarget: dataUrl.length <= TARGET_MAX_DATA_URL_LENGTH,
  };
}

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

/** Stamp into JPEG pixels with progressive compression and strict size bounds. */
export function stampCheckInSelfie(source: HTMLCanvasElement, evidence: SelfieEvidence): string {
  validateSelfieEvidence(evidence);
  if (source.width <= 0 || source.height <= 0) throw new Error('Kamera belum siap. Coba ambil foto lagi.');

  const sourceWidth = source.width;
  const sourceHeight = source.height;

  // Never scale up source image if source is smaller than target resolution
  const targetWidths = [800, 640, 480];
  const candidateWidths: number[] = [];
  for (const tw of targetWidths) {
    const w = Math.min(tw, sourceWidth);
    if (w >= 320 && !candidateWidths.includes(w)) {
      candidateWidths.push(w);
    }
  }
  if (candidateWidths.length === 0) candidateWidths.push(Math.max(320, sourceWidth));

  let bestSafeCandidate: string | null = null;
  const qualitySequence = [0.80, 0.70, 0.60, 0.50, 0.45];

  for (const width of candidateWidths) {
    const photoHeight = Math.round((width * sourceHeight) / sourceWidth);
    if (photoHeight > 1920) throw new Error('Rasio foto tidak didukung. Gunakan kamera dalam posisi normal.');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Watermark tidak dapat dibuat. Coba gunakan browser lain.');

    const padding = Math.max(12, Math.round(width * 0.035));
    const fontSize = Math.max(13, Math.round(width * 0.028));
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

    for (const quality of qualitySequence) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.startsWith('data:image/jpeg;base64,')) {
        if (dataUrl.length <= TARGET_MAX_DATA_URL_LENGTH) {
          // Hitting target size (150 - 250 KB), return immediately
          return dataUrl;
        }
        if (dataUrl.length <= SAFE_MAX_DATA_URL_LENGTH && !bestSafeCandidate) {
          bestSafeCandidate = dataUrl;
        }
      }
    }
  }

  if (bestSafeCandidate) {
    return bestSafeCandidate;
  }

  throw new Error('Ukuran foto terlalu besar dan melebihi batas aman (maksimal ~400 KB). Posisikan kamera lebih dekat dan ambil ulang foto.');
}
