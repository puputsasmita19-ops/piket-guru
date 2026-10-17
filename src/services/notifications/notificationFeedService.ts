import { OfflineStorage } from '../offline/offlineStorage';
import { collection, query, where, orderBy, limit, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import type { NotificationConfig, NotificationEvent } from '../../types/notification.types';
import type { AnnouncementRecord } from '../../types/announcement.types';

export interface FeedSnapshot {
  events: NotificationEvent[];
  announcements: AnnouncementRecord[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
}
export function notificationErrorMessage(code?: string) {
  if (code?.includes('failed-precondition')) return 'Index notifikasi belum siap. Hubungi admin untuk menerapkan Firestore index.';
  if (code?.includes('permission-denied')) return 'Akses notifikasi ditolak. Admin perlu memeriksa sesi dan Firestore Rules terbaru.';
  return 'Notifikasi belum tersambung. Periksa koneksi lalu coba lagi.';
}
export function subscribeNotificationFeed(uid: string, config: NotificationConfig, onChange: (snapshot: FeedSnapshot) => void): () => void {
  let stopped = false;
  const rows = new Map<string, NotificationEvent[] | AnnouncementRecord[]>();
  const states = new Map<string, { pending: boolean; cached: boolean; error: string | null }>();
  const cleanups: (() => void)[] = [];
  const emit = () => {
    if (stopped || auth.currentUser?.uid !== uid) return;
    const sources = [...states.values()];
    onChange({ events: [...(rows.get('session') || []), ...(rows.get('school') || [])] as NotificationEvent[], announcements: (rows.get('announcements') || []) as AnnouncementRecord[], loading: sources.some(s => s.pending), fromCache: sources.some(s => s.cached), error: sources.find(s => s.error)?.error || null });
  };
  const since = new Date(Date.now() - config.historyDays * 86400000).toISOString();
  const specs: { key: string; source: string; filters: QueryConstraint[] }[] = [];
  if (config.enabled && config.sessionEvents) specs.push({ key: 'session', source: 'notificationEvents', filters: [where('scope', '==', 'USER'), where('actorId', '==', uid), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(config.maxItems)] });
  if (config.enabled && config.operationalUpdates && Object.values(config.modules).some(Boolean)) specs.push({ key: 'school', source: 'notificationEvents', filters: [where('scope', '==', 'SCHOOL'), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(config.maxItems)] });
  if (config.enabled && config.announcements) specs.push({ key: 'announcements', source: 'announcements', filters: [where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(config.maxItems)] });
  for (const spec of specs) states.set(spec.key, { pending: true, cached: false, error: null });
  emit();
  for (const spec of specs) {
    cleanups.push(onSnapshot(query(collection(db, spec.source), ...spec.filters), { includeMetadataChanges: true }, snap => {
      if (stopped || auth.currentUser?.uid !== uid) return;
      rows.set(spec.key, snap.docs.map(d => ({ ...d.data(), id: d.id })) as any);
      states.set(spec.key, { pending: false, cached: snap.metadata.fromCache, error: null });
      emit();
    }, error => {
      if (stopped) return;
      rows.delete(spec.key);
      states.set(spec.key, { pending: false, cached: false, error: notificationErrorMessage(error.code) });
      emit();
    }));
  }
  return OfflineStorage.registerListener(() => { stopped = true; cleanups.forEach(unsub => unsub()); rows.clear(); });
}
