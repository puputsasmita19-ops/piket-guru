import { db } from '../firebase/firebase';
import { auth } from '../firebase/firebaseAuth';
import { doc, setDoc } from 'firebase/firestore';
import { OfflineStorage } from '../offline/offlineStorage';
import type { NotificationEvent } from '../../types/notification.types';

// Tiny metadata outbox, isolated by Firebase project + authenticated UID. No photo data.
const memory = new Map<string, NotificationEvent[]>();
const running = new Set<string>();
const key = (uid: string) => `piket_notification_outbox:${auth.app.options.projectId}:${uid}`;
function read(uid: string): NotificationEvent[] {
  try {
    if (OfflineStorage.isTrustedDevice()) {
      const parsed = JSON.parse(localStorage.getItem(key(uid)) || '[]');
      if (Array.isArray(parsed)) return parsed.filter(e => e?.actorId === uid && e.scope === 'SCHOOL').slice(-100);
    }
  } catch { /* Memory remains available when browser storage is full. */ }
  return memory.get(uid) || [];
}
function save(uid: string, items: NotificationEvent[]) {
  memory.set(uid, items);
  try {
    if (OfflineStorage.isTrustedDevice()) {
      if (items.length) localStorage.setItem(key(uid), JSON.stringify(items));
      else localStorage.removeItem(key(uid));
    }
  } catch { /* Non-fatal metadata cache. */ }
}
export async function flushNotificationOutbox(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || running.has(uid) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  running.add(uid);
  try {
    for (let attempts = 0; attempts < 100; attempts++) {
      const event = read(uid)[0];
      if (!event) break;
      if (auth.currentUser?.uid !== uid) break;
      // setDoc with a stable event ID is safe to repeat; rules permit identical retries only.
      await setDoc(doc(db, 'notificationEvents', event.id), event);
      save(uid, read(uid).filter(e => e.id !== event.id));
    }
  } catch {
    // A notification is secondary. Never roll back a successful operational save.
  } finally { running.delete(uid); }
}
export async function publishNotificationEvent(event: NotificationEvent): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== event.actorId || event.scope !== 'SCHOOL') return;
  save(uid, [...read(uid).filter(e => e.id !== event.id), event].slice(-100));
  await flushNotificationOutbox();
}
