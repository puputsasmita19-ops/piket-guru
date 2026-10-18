import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SyncQueueService } from '../services/offline/syncQueueService';
import { OfflineStorage } from '../services/offline/offlineStorage';

/** One lightweight recovery loop per authenticated shell; never polls an empty queue over HTTP. */
export function useAutomaticSync() {
  const { currentUser, isOfflineSession, revalidateSessionOnline } = useAuth();
  const current = useRef({ currentUser, isOfflineSession, revalidateSessionOnline });
  current.current = { currentUser, isOfflineSession, revalidateSessionOnline };
  useEffect(() => {
    if (!currentUser?.id) return;
    let stopped = false, busy = false, timer: ReturnType<typeof setTimeout>;
    const check = async (recovered = false) => {
      if (stopped || busy || document.hidden || !navigator.onLine) return;
      const { currentUser: user, isOfflineSession: offlineSession, revalidateSessionOnline: verify } = current.current;
      if (!user || user.id !== currentUser.id) return;
      busy = true;
      try {
        const items = await OfflineStorage.getSyncItemsByUser(user.id);
        if (!items.some(i => i.status === 'PENDING_NETWORK' || i.status === 'SENDING')) return;
        if (offlineSession) { await verify(); return; }
        if (!stopped) {
          if (recovered) await SyncQueueService.resumeNetwork(user);
          await SyncQueueService.triggerSync(user);
        }
      } catch (error) { console.warn('Sinkronisasi akan dicoba kembali:', error); }
      finally { busy = false; }
    };
    const wake = () => { void check(true); };
    const schedule = () => { timer = setTimeout(() => { void check().finally(() => { if (!stopped) schedule(); }); }, 20000 + Math.random() * 10000); };
    timer = setTimeout(() => { wake(); schedule(); }, 600);
    window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); SyncQueueService.cancelSync(); };
  }, [currentUser?.id]);
}
