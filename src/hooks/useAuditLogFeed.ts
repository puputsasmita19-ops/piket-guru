import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY_AUDIT_FEED, subscribeLatestAuditLogs, type AuditLogFeedSnapshot } from '../services/audit/auditLogFeedService';

export interface AuditFeedStatus {
  loading: boolean;
  fromCache: boolean;
  online: boolean;
  error: string | null;
  receivedAt: string | null;
  reload: () => void;
}
export function useAuditLogFeed() {
  const { currentUser, hasRole } = useAuth();
  const uid = currentUser?.id || '';
  const authorized = !!uid && hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const owner = authorized ? `${uid}:${currentUser?.role}` : '';
  const [state, setState] = useState<{ owner: string; value: AuditLogFeedSnapshot }>({ owner: '', value: EMPTY_AUDIT_FEED });
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    setState({ owner, value: EMPTY_AUDIT_FEED });
    const unsub = subscribeLatestAuditLogs(uid, value => { if (active) setState({ owner, value }); });
    return () => { active = false; unsub(); };
  }, [owner, uid, authorized, attempt]);
  const data = authorized && state.owner === owner ? state.value : { ...EMPTY_AUDIT_FEED, logs: [], loading: authorized };
  return { logs: data.logs, status: { loading: data.loading, fromCache: data.fromCache, error: data.error, receivedAt: data.receivedAt, online, reload } satisfies AuditFeedStatus };
}
