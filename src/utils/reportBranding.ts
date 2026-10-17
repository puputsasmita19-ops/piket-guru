import type { LetterheadConfig, SchoolSettings } from '../types';

export const DEFAULT_APP_LOGO = '/icon.svg';
export const appLogo = (settings: Pick<SchoolSettings, 'appLogoUrl'>) => settings.appLogoUrl || DEFAULT_APP_LOGO;
// An explicit empty value hides the letterhead logo; old installations retain their school logo.
export const letterheadLogo = (settings: Pick<SchoolSettings, 'letterheadLogoUrl' | 'logoUrl'>) => settings.letterheadLogoUrl ?? settings.logoUrl ?? '';

export function normalizeLetterhead(input?: Partial<LetterheadConfig>, school?: Partial<SchoolSettings>): LetterheadConfig {
  const text = (key: keyof LetterheadConfig, fallback = '', max = 250) => String(input?.[key] ?? fallback).trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
  return {
    foundationName: text('foundationName'), schoolName: text('schoolName', school?.schoolName),
    accreditation: text('accreditation'), accreditationNumber: text('accreditationNumber'),
    nss: text('nss', '', 60), npsn: text('npsn', school?.npsn, 60),
    address: text('address', school?.address, 400), phone: text('phone', school?.phone, 100),
    email: text('email', school?.email), website: text('website', school?.website),
    borderStyle: input?.borderStyle === 'none' || input?.borderStyle === 'single' ? input.borderStyle : 'double',
    fontFamily: input?.fontFamily === 'Times New Roman' ? 'Times New Roman' : 'Arial',
    logoWidthMm: typeof input?.logoWidthMm === 'number' && Number.isFinite(input.logoWidthMm) ? Math.max(14, Math.min(32, input.logoWidthMm)) : 22,
  };
}

export function letterheadLines(config: LetterheadConfig): { text: string; size: number; bold: boolean }[] {
  return [
    { text: config.foundationName, size: 10, bold: true },
    { text: config.schoolName, size: 15, bold: true },
    { text: config.accreditation, size: 10, bold: true },
    { text: config.accreditationNumber, size: 9, bold: true },
    { text: [config.nss && `NSS: ${config.nss}`, config.npsn && `NPSN: ${config.npsn}`].filter(Boolean).join('     '), size: 9, bold: true },
    { text: [config.address, config.phone && `Telp. ${config.phone}`].filter(Boolean).join(', '), size: 9, bold: false },
    { text: [config.email && `E-mail: ${config.email}`, config.website && `Website: ${config.website}`].filter(Boolean).join(', '), size: 9, bold: false },
  ].filter(line => line.text);
}

export function reportSigners(settings: SchoolSettings) {
  const principal = { key: 'principal', role: 'Kepala Sekolah', name: settings.principalName, idType: settings.principalIdType, id: settings.principalIdNumber, signature: settings.principalSignatureUrl };
  const coordinator = { key: 'coordinator', role: 'Koordinator Piket', name: settings.coordinatorName, idType: settings.coordinatorIdType, id: settings.coordinatorIdNumber, signature: settings.coordinatorSignatureUrl };
  return settings.printConfig?.signatureOrder === 'coordinator_left' ? [coordinator, principal] : [principal, coordinator];
}

/** Public branding images must work before login. Never accept private Drive photo endpoints here. */
export function validateBrandLogo(value: string, allowBuiltin = false): string {
  const url = String(value || '').trim();
  if (!url || (allowBuiltin && url === DEFAULT_APP_LOGO)) return url;
  if (url.length > 220_000) throw new Error('Logo terlalu besar. Unggah kembali agar dikompres terlebih dahulu.');
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(url)) return url;
  try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return url; } catch { /* actionable validation below */ }
  throw new Error('Gunakan unggahan PNG/JPG/WebP atau URL gambar HTTPS yang dapat dibuka sebelum login.');
}
