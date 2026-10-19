import { db } from '../firebase/firebase';
import { auth } from '../firebase/firebaseAuth';
import { doc, setDoc } from 'firebase/firestore';
import type { NotificationEvent } from '../../types/notification.types';
import { enqueueNotification, pendingNotifications, acknowledgeNotification } from './notificationOutbox';

// Tiny metadata outbox, isolated by Firebase project + authenticated UID. No photo data.
const running = new Set<string>();
const retryAfter = new Map<string, number>();
export async function flushNotificationOutbox(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || running.has(uid) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  running.add(uid);
  try {
    const pending = pendingNotifications(uid).slice(0, 100);
    const keys = new Set(pending.map(event => `${uid}:${event.id}`));
    for (const key of retryAfter.keys()) if (key.startsWith(`${uid}:`) && !keys.has(key)) retryAfter.delete(key);
    const attempted = new Set<string>();
    for (let attempts = 0; attempts < 100; attempts++) {
      if (auth.currentUser?.uid !== uid) break;
      // Re-read after each awaited send so arrivals during the flush are drained.
      const event = pendingNotifications(uid).find(item => !attempted.has(item.id) &&
        (retryAfter.get(`${uid}:${item.id}`) || 0) <= Date.now());
      if (!event) break;
      attempted.add(event.id);
      const retryKey = `${uid}:${event.id}`;
      // setDoc with a stable event ID is safe to repeat; rules permit identical retries only.
      try {
        await setDoc(doc(db, 'notificationEvents', event.id), event);
        acknowledgeNotification(event);
        retryAfter.delete(retryKey);
      } catch (error) {
        if (auth.currentUser?.uid !== uid) break;
        const code = (error as { code?: string })?.code || '';
        if (!/permission-denied|invalid-argument/.test(code)) break;
        // Retain a rejected event for retry, but let healthy later events through.
        // Avoid retrying the same bad entry on every subsequent activity.
        retryAfter.set(retryKey, Date.now() + 5 * 60_000);
      }
    }
  } catch {
    // A notification is secondary. Never roll back a successful operational save.
  } finally { running.delete(uid); }
}
export async function publishNotificationEvent(event: NotificationEvent): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== event.actorId || event.scope !== 'SCHOOL') return;
  enqueueNotification(event);
  await flushNotificationOutbox();
}
