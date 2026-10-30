import type { LocationCoordinates } from '../location/locationService';
import {
  DocumentationWatermarkConfig,
  DEFAULT_DOCUMENTATION_WATERMARK_CONFIG,
  WatermarkPayload,
  WatermarkModuleType,
} from '../../types/watermark.types';

// Target size range: 150 - 280 KB JPEG (Base64 length ~200k - 380k chars)
export const TARGET_MAX_DATA_URL_LENGTH = 380_000;
// Safe maximum limit for Firestore doc safety (< 450 KB JPEG Base64, well under Firestore 1MB limit)
export const SAFE_MAX_DATA_URL_LENGTH = 550_000;

export function formatWibDateTime(timestamp: number): string {
  try {
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(timestamp)) + ' WIB'
    );
  } catch {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID')} WIB`;
  }
}

/**
 * Strips sensitive strings such as PINs, 16-digit NIKs, phone/WhatsApp numbers.
 */
function sanitizeWatermarkText(value: string): string {
  if (!value) return '';
  return value
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
    // Mask sensitive phone numbers (e.g. 0812..., +62...)
    .replace(/(?:\+?62|08)[0-9]{8,13}/g, '[No HP Dirahasiakan]')
    // Mask 16-digit NIK / ID numbers
    .replace(/\b[0-9]{16}\b/g, '[No Identitas Dirahasiakan]')
    // Mask explicit PIN keywords
    .replace(/pin\s*[:=]?\s*[0-9]+/gi, 'PIN: ******')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a human-readable module title for the watermark header badge.
 */
export function getWatermarkModuleTitle(module: WatermarkModuleType): string {
  switch (module) {
    case 'INCIDENT':
      return 'DOKUMENTASI LAPORAN KEJADIAN';
    case 'STUDENT_TARDY':
      return 'DOKUMENTASI SISWA TERLAMBAT';
    case 'VISITOR':
      return 'DOKUMENTASI BUKU TAMU DIGITAL';
    case 'ATTENDANCE':
      return 'PRESENSI MASUK • CHECK-IN';
    default:
      return 'DOKUMENTASI RESMI SEKOLAH';
  }
}

export const WATERMARK_TAG = '#wtmk_v1';

/**
 * Loads image from URL or dataURL safely for canvas drawing with timeout.
 */
export async function loadLogoImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url || typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 1500);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = url;
  });
}

/**
 * Checks if an image is already watermarked (to prevent double watermarking on edit / retry).
 */
export function isPhotoAlreadyWatermarked(urlOrDataUrl?: string): boolean {
  if (!urlOrDataUrl) return false;
  // If it contains the explicit metadata marker or watermark tag
  if (
    urlOrDataUrl.includes('#wtmk_') ||
    urlOrDataUrl.includes('wtmk_v1') ||
    urlOrDataUrl.includes('watermarked=1') ||
    urlOrDataUrl.includes('wtmk=')
  ) {
    return true;
  }
  return false;
}

/**
 * Quietly detects device GPS without throwing errors or blocking modules that don't mandate GPS.
 * Times out after 2.5 seconds if location is denied, unavailable, or sluggish.
 */
export async function detectLocationForWatermark(): Promise<LocationCoordinates | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 2500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        }
      },
      () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 2500,
        maximumAge: 15000,
      }
    );
  });
}

/**
 * Stamping documentation photos with a bottom panel watermark and strict compression.
 * Conforms to all requirements:
 * - Doesn't obscure main subject (bottom anchored)
 * - Contrast & typography adapted to portrait / landscape
 * - Distinguishes event date vs photo taken/uploaded date
 * - Does not claim upload time as capture time
 * - Shows genuine GPS if available, or "Lokasi tidak dicatat" without blocking non-GPS modules
 * - Strips sensitive credentials / phone / PIN
 * - Prevents double watermarking
 */
export async function stampDocumentationPhoto(
  source: HTMLCanvasElement | HTMLImageElement,
  payload: WatermarkPayload,
  config: DocumentationWatermarkConfig = DEFAULT_DOCUMENTATION_WATERMARK_CONFIG
): Promise<string> {
  // If explicitly flagged as already watermarked or source contains watermark marker
  const sourceSrc = 'src' in source ? (source as HTMLImageElement).src : '';
  if (payload.alreadyWatermarked || isPhotoAlreadyWatermarked(sourceSrc)) {
    if ('toDataURL' in source) {
      const dataUrl = (source as HTMLCanvasElement).toDataURL('image/jpeg', 0.85);
      return dataUrl.includes('#wtmk_') ? dataUrl : `${dataUrl}${WATERMARK_TAG}`;
    }
    return sourceSrc;
  }

  const sourceWidth = 'videoWidth' in source ? (source as any).videoWidth : source.width;
  const sourceHeight = 'videoHeight' in source ? (source as any).videoHeight : source.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Gambar tidak valid atau belum siap diproses.');
  }

  // Determine module-specific settings
  let moduleConfig = config.modules.incidents;
  if (payload.module === 'STUDENT_TARDY') {
    moduleConfig = config.modules.studentTardy;
  } else if (payload.module === 'VISITOR') {
    moduleConfig = config.modules.visitors;
  }

  // If watermark is disabled for this module in config, compress and return plain image
  if (moduleConfig && moduleConfig.enabled === false && payload.module !== 'ATTENDANCE') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(800, sourceWidth);
    canvas.height = Math.round((canvas.width * sourceHeight) / sourceWidth);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl.includes('#wtmk_') ? dataUrl : `${dataUrl}${WATERMARK_TAG}`;
    }
  }

  // Optionally load school logo image if enabled in config
  let schoolLogoImg: HTMLImageElement | null = null;
  if (config.showSchoolLogo !== false && payload.schoolLogoUrl) {
    try {
      schoolLogoImg = await loadLogoImage(payload.schoolLogoUrl);
    } catch {
      schoolLogoImg = null;
    }
  }

  // Candidate widths
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
  const qualitySequence = [0.8, 0.7, 0.6, 0.5, 0.45];

  for (const width of candidateWidths) {
    const photoHeight = Math.round((width * sourceHeight) / sourceWidth);
    if (photoHeight > 2400) {
      throw new Error('Rasio foto terlalu panjang. Gunakan posisi kamera standar.');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Watermark tidak dapat diproses pada peramban ini.');

    // Font multiplier from config
    const fontMultiplier =
      config.fontSize === 'small' ? 0.024 : config.fontSize === 'large' ? 0.034 : 0.028;
    const fontSize = Math.max(12, Math.round(width * fontMultiplier));
    const titleFontSize = Math.round(fontSize * 1.15);
    const lineHeight = Math.round(fontSize * 1.45);
    const padding = Math.max(12, Math.round(width * 0.035));
    const textWidth = width - padding * 2;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

    const wrap = (value: string): string[] => {
      const sanitized = sanitizeWatermarkText(value);
      const result: string[] = [];
      let line = '';
      for (const word of sanitized.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= textWidth) {
          line = candidate;
          continue;
        }
        if (line) result.push(line);
        line = '';
        for (const character of word) {
          if (ctx.measureText(line + character).width > textWidth && line) {
            result.push(line);
            line = character;
          } else {
            line += character;
          }
        }
      }
      if (line.trim()) result.push(line.trim());
      return result;
    };

    // Assemble watermark lines
    const lines: string[] = [];

    // 1. School Name & Logo distinction
    if (config.showSchoolLogo !== false) {
      lines.push(...wrap(`🏛️ ${payload.schoolName}`));
    } else {
      lines.push(...wrap(`INSTANSI: ${payload.schoolName}`));
    }

    // 2. Documentation Time & Upload Distinction
    const wibDocTime = formatWibDateTime(payload.documentationTime || Date.now());
    if (payload.isUploadedPhoto) {
      lines.push(...wrap(`📁 Foto Berkas Unggahan • Waktu Unggah: ${wibDocTime}`));
    } else {
      lines.push(...wrap(`📸 Waktu Dokumentasi: ${wibDocTime}`));
    }

    // 3. Event Date distinction (if distinct from documentation time)
    if (
      moduleConfig?.showEventDate !== false &&
      payload.eventDate &&
      payload.eventDate.trim().length > 0
    ) {
      const eventTimeStr = payload.eventTime ? ` pukul ${payload.eventTime} WIB` : '';
      lines.push(...wrap(`📅 Tanggal Kejadian / Kunjungan: ${payload.eventDate}${eventTimeStr}`));
    }

    // 4. Officer Name
    if (moduleConfig?.showOfficerName !== false && payload.officerName) {
      lines.push(...wrap(`👤 Petugas Pencatat: ${payload.officerName}`));
    }

    // 5. Compact Identity (Incident, Student Tardy, Visitor)
    if (moduleConfig?.showCompactIdentity !== false && payload.briefIdentity) {
      lines.push(...wrap(`📋 ${payload.briefIdentity}`));
    }

    // 6. Notes if provided
    if (payload.notes && payload.notes.trim()) {
      lines.push(...wrap(`💬 Catatan: ${payload.notes}`));
    }

    // 7. GPS Coordinates
    if (moduleConfig?.showGpsIfAvailable !== false) {
      if (
        payload.coords &&
        Number.isFinite(payload.coords.latitude) &&
        Number.isFinite(payload.coords.longitude) &&
        payload.coords.accuracy > 0
      ) {
        lines.push(
          ...wrap(
            `📍 GPS: ${payload.coords.latitude.toFixed(6)}, ${payload.coords.longitude.toFixed(6)} (±${payload.coords.accuracy.toFixed(1)} m)`
          )
        );
      } else {
        lines.push(...wrap(`📍 GPS: Lokasi tidak dicatat / tidak tersedia`));
      }
    }

    // Calculate dimensions
    const headerHeight = titleFontSize + 8;
    const bannerHeight = padding * 2 + headerHeight + lineHeight * lines.length + 8;
    canvas.width = width;
    canvas.height = photoHeight + bannerHeight;

    // 1. Fill base canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw photo
    ctx.drawImage(source, 0, 0, width, photoHeight);

    // 3. Draw Watermark Bottom Panel
    if (config.panelStyle === 'dark_subtle') {
      ctx.fillStyle = '#1e293b';
    } else if (config.panelStyle === 'navy_accent') {
      ctx.fillStyle = '#0f172a';
    } else {
      ctx.fillStyle = '#090d16'; // dark solid
    }
    ctx.fillRect(0, photoHeight, width, bannerHeight);

    // 4. Accent Strip (Color-coded by module)
    let stripColor = '#3b82f6'; // blue default
    if (payload.module === 'INCIDENT') stripColor = '#ef4444'; // red
    else if (payload.module === 'STUDENT_TARDY') stripColor = '#f59e0b'; // amber
    else if (payload.module === 'VISITOR') stripColor = '#10b981'; // emerald
    else if (payload.module === 'ATTENDANCE') stripColor = '#06b6d4'; // cyan

    ctx.fillStyle = stripColor;
    ctx.fillRect(0, photoHeight, width, 5);

    // 5. Draw Module Title Header
    ctx.textBaseline = 'top';
    ctx.font = `700 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillStyle = stripColor;
    const moduleTitle = getWatermarkModuleTitle(payload.module);
    ctx.fillText(moduleTitle, padding, photoHeight + padding);

    // 5b. Draw School Logo in header right corner if available and enabled
    if (schoolLogoImg) {
      try {
        const maxLogoH = Math.round(titleFontSize * 1.5);
        const naturalW = schoolLogoImg.naturalWidth || schoolLogoImg.width || 1;
        const naturalH = schoolLogoImg.naturalHeight || schoolLogoImg.height || 1;
        const logoAspect = naturalW / naturalH;
        const logoW = Math.round(maxLogoH * (Number.isFinite(logoAspect) && logoAspect > 0 ? logoAspect : 1));
        ctx.drawImage(schoolLogoImg, width - padding - logoW, photoHeight + padding, logoW, maxLogoH);
      } catch {
        // Logo render failure is non-fatal
      }
    }

    // 6. Draw Content Lines
    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillStyle = '#f8fafc';

    lines.forEach((line, index) => {
      ctx.fillText(line, padding, photoHeight + padding + headerHeight + lineHeight * index);
    });

    // Compress to safe bounds
    for (const quality of qualitySequence) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.startsWith('data:image/jpeg;base64,')) {
        if (dataUrl.length <= TARGET_MAX_DATA_URL_LENGTH) {
          return dataUrl.includes('#wtmk_') ? dataUrl : `${dataUrl}${WATERMARK_TAG}`;
        }
        if (dataUrl.length <= SAFE_MAX_DATA_URL_LENGTH && !bestSafeCandidate) {
          bestSafeCandidate = dataUrl.includes('#wtmk_') ? dataUrl : `${dataUrl}${WATERMARK_TAG}`;
        }
      }
    }
  }

  if (bestSafeCandidate) {
    return bestSafeCandidate.includes('#wtmk_') ? bestSafeCandidate : `${bestSafeCandidate}${WATERMARK_TAG}`;
  }

  throw new Error('Ukuran foto terlalu besar. Posisikan kamera lebih dekat atau ambil ulang.');
}

/**
 * Generates an instant local sample watermark image for admin settings preview.
 */
export async function generateSampleWatermarkPreview(
  config: DocumentationWatermarkConfig,
  schoolName: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw simulated classroom / gate photography background
  const grad = ctx.createLinearGradient(0, 0, 640, 400);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(0.5, '#818cf8');
  grad.addColorStop(1, '#c084fc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 400);

  // Decorative grid lines & placeholder text
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  for (let i = 40; i < 640; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 400);
    ctx.stroke();
  }
  for (let j = 40; j < 400; j += 60) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(640, j);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONTOH FOTO DOKUMENTASI', 320, 180);
  ctx.font = '14px sans-serif';
  ctx.fillText('(Pratinjau Watermark Otomatis)', 320, 210);
  ctx.textAlign = 'left';

  const samplePayload: WatermarkPayload = {
    module: 'STUDENT_TARDY',
    schoolName: schoolName || 'Sekolah',
    officerName: 'Budi Santoso, S.Pd. (Petugas Piket)',
    documentationTime: Date.now(),
    eventDate: new Date().toISOString().split('T')[0],
    eventTime: '07:15',
    briefIdentity: 'Siswa: Ahmad Fauzan • Kelas: X-MIPA 1',
    coords: {
      latitude: -6.208763,
      longitude: 106.845599,
      accuracy: 12.5,
      timestamp: Date.now(),
    },
    notes: 'Terlambat 15 menit (Kendaraan mogok)',
  };

  return stampDocumentationPhoto(canvas, samplePayload, config);
}
