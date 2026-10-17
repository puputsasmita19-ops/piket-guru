// Persist only read IDs, never notification bodies. Shared devices use sessionStorage.
const MAX_READ_IDS = 500;
export const notificationReadKey = (project: string, uid: string) => `piket_notification_read:${project}:${uid}`;
export function loadNotificationReadState(project: string, uid: string, trusted: boolean): string[] {
  try {
    const raw = JSON.parse((trusted ? localStorage : sessionStorage).getItem(notificationReadKey(project, uid)) || '[]');
    return Array.isArray(raw) ? raw.filter(v => typeof v === 'string').slice(-MAX_READ_IDS) : [];
  } catch { return []; }
}
export function saveNotificationReadState(project: string, uid: string, trusted: boolean, ids: string[]): string[] {
  const safe = [...new Set(ids)].slice(-MAX_READ_IDS);
  try { (trusted ? localStorage : sessionStorage).setItem(notificationReadKey(project, uid), JSON.stringify(safe)); } catch { /* Read status is non-critical. */ }
  return safe;
}
