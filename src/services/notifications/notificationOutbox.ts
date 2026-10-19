import { auth } from '../firebase/firebaseAuth';
import { OfflineStorage } from '../offline/offlineStorage';
import type { NotificationEvent } from '../../types/notification.types';

// Secondary activity metadata only; operational records and drafts live elsewhere.
const memory = new Map<string, NotificationEvent>();
const MAX_PENDING = 100;
const prefix = (uid: string) => `piket_notification_v2:${encodeURIComponent(auth.app.options.projectId || '')}:${encodeURIComponent(uid)}:`;
const keyFor = (event: NotificationEvent) => `${prefix(event.actorId)}${encodeURIComponent(event.id)}`;
const legacyKey = (uid: string) => `piket_notification_outbox:${auth.app.options.projectId}:${uid}`;
const valid = (event: any, uid: string): event is NotificationEvent => typeof uid === 'string' && !!uid && !!event && event.actorId === uid &&
  event.scope === 'SCHOOL' && typeof event.id === 'string' && !!event.id &&
  typeof event.actorName === 'string' && typeof event.createdAt === 'string' &&
  Number.isFinite(Date.parse(event.createdAt)) && typeof event.module === 'string' && typeof event.action === 'string';

/** Merge session fallback with persistent entries; one broken entry cannot hide others. */
export function pendingNotifications(uid: string): NotificationEvent[] {
  const result = new Map<string, NotificationEvent>();
  if (OfflineStorage.isTrustedDevice()) {
    try {
      const ownerPrefix = prefix(uid);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(ownerPrefix)) continue;
        try {
          const event = JSON.parse(localStorage.getItem(key) || 'null');
          if (valid(event, uid) && key === keyFor(event)) result.set(event.id, event);
        } catch { /* Skip just this malformed entry. */ }
      }
    } catch { /* Session fallback remains readable when storage is unavailable. */ }
    try {
      const legacy = JSON.parse(localStorage.getItem(legacyKey(uid)) || '[]');
      if (Array.isArray(legacy)) for (const event of legacy) {
        if (valid(event, uid) && !result.has(event.id)) result.set(event.id, event);
      }
    } catch { /* An invalid pre-upgrade queue does not hide new entries. */ }
  }
  for (const [key, event] of memory) if (key.startsWith(prefix(uid))) result.set(event.id, event);
  return [...result.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function acknowledgeNotification(event: NotificationEvent): void {
  memory.delete(keyFor(event));
  try {
    localStorage.removeItem(keyFor(event));
    if (!OfflineStorage.isTrustedDevice()) return;
    // Compatibility only: re-read before removing an acknowledged legacy ID.
    const legacy = JSON.parse(localStorage.getItem(legacyKey(event.actorId)) || '[]');
    if (Array.isArray(legacy) && legacy.some(item => item?.id === event.id && item?.actorId === event.actorId)) {
      const remaining = legacy.filter(item => item?.id !== event.id || item?.actorId !== event.actorId);
      if (remaining.length) localStorage.setItem(legacyKey(event.actorId), JSON.stringify(remaining));
      else localStorage.removeItem(legacyKey(event.actorId));
    }
  } catch { /* A failed acknowledgement can retry the same stable ID. */ }
}

/** Separate keys prevent a successful send from overwriting another tab's append. */
export function enqueueNotification(event: NotificationEvent): void {
  if (!valid(event, event.actorId)) return;
  const pending = pendingNotifications(event.actorId);
  if (pending.some(item => item.id === event.id)) return;
  const key = keyFor(event);
  memory.set(key, event);
  if (OfflineStorage.isTrustedDevice()) {
    try { localStorage.setItem(key, JSON.stringify(event)); memory.delete(key); }
    catch { /* Keep this new event in memory even if an older persistent queue exists. */ }
  }
  // Preserve the existing 100-item bound for secondary notification metadata.
  // Only known oldest IDs are removed; other tabs' later appends are not replaced.
  const overflow = [...pending, event].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, Math.max(0, pending.length + 1 - MAX_PENDING));
  for (const old of overflow) acknowledgeNotification(old);
}
