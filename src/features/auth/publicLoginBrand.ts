/**
 * R103: Tiny, public-only login identity cache. This must never contain GPS,
 * work hours, session state, contact secrets or the full school configuration.
 * The authoritative source remains /api/auth/public-config.
 */
export const PUBLIC_LOGIN_BRAND_CACHE_KEY = 'piket_guru_public_login_brand_v1';
const TTL_MS = 15 * 60 * 1000;

const LEGACY_DEMO_NAME = /^sma\s+negeri\s+1\s+prestasi\s+bangsa$/i;

export function validSchoolDisplayName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, 160);
  return LEGACY_DEMO_NAME.test(trimmed) ? '' : trimmed;
}

/** Only allow innocuous public display metadata into this cache. */
export function pickPublicLoginBrand(value: unknown) {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (field: string, limit: number) => typeof item[field] === 'string' ? (item[field] as string).trim().slice(0, limit) : '';
  return {
    schoolName: validSchoolDisplayName(item.schoolName),
    address: text('address', 220),
    appName: text('appName', 80),
    appSubtitle: text('appSubtitle', 140),
    appCreator: text('appCreator', 120),
  };
}

export function readPublicLoginBrand(storage?: Pick<Storage, 'getItem'>, now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PUBLIC_LOGIN_BRAND_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; brand?: unknown; source?: string; version?: number };
    if (parsed.version !== 1 || parsed.source !== 'DATABASE' || typeof parsed.savedAt !== 'number'
      || parsed.savedAt > now || now - parsed.savedAt > TTL_MS) return null;
    const brand = pickPublicLoginBrand(parsed.brand);
    return brand.schoolName ? brand : null;
  } catch { return null; }
}

export function storePublicLoginBrand(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  serverData: unknown,
  now = Date.now(),
) {
  if (!storage) return;
  const brand = pickPublicLoginBrand(serverData);
  try {
    if (brand.schoolName) {
      storage.setItem(PUBLIC_LOGIN_BRAND_CACHE_KEY, JSON.stringify({ version: 1, source: 'DATABASE', savedAt: now, brand }));
    } else {
      storage.removeItem(PUBLIC_LOGIN_BRAND_CACHE_KEY);
    }
  } catch { /* Storage is optional, never block login. */ }
}
