/** R106: An explicitly selected public-directory UID means a single account document.
 * A typed ID/NIP never uses this hint, keeping the legacy ambiguity checks.
 * The UID is NOT proof of identity: PIN, rate limiting and Firebase checks remain mandatory.
 */
export function exactSelectedLoginUid(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  if (typeof value.accountUid !== 'string' || typeof value.identifier !== 'string') return null;
  const uid = value.accountUid;
  if (!uid || uid.length > 128 || uid !== uid.trim() || uid.includes('/') || uid === '.' || uid === '..') return null;
  if (value.identifier !== uid) return null;
  return uid;
}
