// UI-only preferences. Never grants a permission or changes school data.
const memory = new Map<string, string[]>();
export const shortcutStorageKey = (project: string, uid: string) => `piket_shortcuts_v1:${project}:${uid}`;
export function sanitizeShortcutIds(value: unknown, knownIds: readonly string[], maximum = 8): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && knownIds.includes(id)))].slice(0, maximum);
}
export function loadShortcutIds(project: string, uid: string, trusted: boolean, knownIds: readonly string[]): string[] | null {
  if (!uid) return null;
  const key = shortcutStorageKey(project, uid);
  try {
    const raw = (trusted ? localStorage : sessionStorage).getItem(key);
    if (raw !== null) return sanitizeShortcutIds(JSON.parse(raw), knownIds);
  } catch { /* Storage restrictions do not block navigation. */ }
  return memory.get(key) ?? null;
}
export function saveShortcutIds(project: string, uid: string, trusted: boolean, ids: string[], knownIds: readonly string[]): boolean {
  if (!uid) return false;
  const safe = sanitizeShortcutIds(ids, knownIds), key = shortcutStorageKey(project, uid);
  memory.set(key, safe);
  try { (trusted ? localStorage : sessionStorage).setItem(key, JSON.stringify(safe)); return true; } catch { return false; }
}
