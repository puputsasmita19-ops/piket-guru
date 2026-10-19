import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createAuthenticatedSession } from '../services/firebase/sessionGuard';
import { auditReadError } from '../services/audit/auditLogFeedService';
import { EMPTY_AUDIT_HISTORY_PAGE, hasAuditHistoryFilters, readAuditHistoryPage, subscribeAuditHistoryHead, type AuditCursor, type AuditHistoryFilters, type AuditHistoryPage } from '../services/audit/auditHistoryService';

interface HistoryState extends AuditHistoryPage { key: string; index: number; visited: number; loading: boolean; error: string | null; newer: boolean }
const empty = (key = ''): HistoryState => ({ ...EMPTY_AUDIT_HISTORY_PAGE, key, index: 0, visited: 1, loading: true, error: null, newer: false });
export function useAuditLogHistory(filters: AuditHistoryFilters, pageSize: number, enabled = true) {
  const { currentUser, hasRole } = useAuth();
  const authorized = enabled && !!currentUser?.id && hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const uid = currentUser?.id || '';
  const key = JSON.stringify([authorized ? uid : '', currentUser?.role, pageSize, filters]);
  const [state, setState] = useState<HistoryState>(() => empty());
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const controls = useRef({ go: (_: number) => {}, more: () => {} });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    controls.current = { go: () => {}, more: () => {} };
    if (!authorized) return;
    let active = true, busy = false, index = 0, visited = 1, newer = false, fatal = false;
    let stop: () => void = () => {};
    const session = (() => {
      try { return createAuthenticatedSession(uid, () => { active = false; stop(); }); }
      catch { setState({ ...empty(key), loading: false, error: 'Sesi akun berubah. Masuk kembali untuk membaca riwayat audit.' }); return null; }
    })();
    if (!session) return;
    let latest: AuditHistoryPage | null = null, headSignature: string | null = null;
    const pages = new Map<number, { start: AuditCursor | null; result: AuditHistoryPage | null }>([[0, { start: null, result: null }]]);
    const filtered = hasAuditHistoryFilters(filters);
    const signature = (page: AuditHistoryPage) => page.logs.map(log => log.id).join('|');
    const valid = () => { if (!active || fatal) throw Object.assign(new Error('Sesi audit berubah.'), { code: 'SESSION_CHANGED' }); session.assertActive(); };
    const publish = (page: AuditHistoryPage, error: string | null = null) => {
      if (!active) return;
      setState({ ...page, key, index, visited, loading: busy, error, newer });
    };
    const fail = (error: any) => {
      if (!active) return;
      if (fatal && error?.code === 'SESSION_CHANGED') return;
      busy = false;
      try { session.assertActive(); } catch { setState(empty()); return; }
      const denied = /permission-denied|unauthenticated/.test(error?.code || '');
      if (denied) { fatal = true; pages.clear(); latest = null; }
      const page = denied ? EMPTY_AUDIT_HISTORY_PAGE : pages.get(index)?.result || EMPTY_AUDIT_HISTORY_PAGE;
      publish(page, error?.code ? auditReadError(error.code) : error?.message || auditReadError());
    };
    const load = async (target: number, append = false) => {
      if (busy || fatal || target < 0 || target >= visited) return;
      const entry = pages.get(target); if (!entry) return;
      if (!append && target === 0 && !filtered && latest) {
        if (newer || (entry.result && signature(entry.result) !== signature(latest))) { pages.clear(); visited = 1; }
        pages.set(0, { start: null, result: latest }); index = 0; newer = false; publish(latest); return;
      }
      if (!append && entry.result) { index = target; publish(entry.result); return; }
      busy = true; publish(pages.get(index)?.result || EMPTY_AUDIT_HISTORY_PAGE);
      try {
        valid();
        const partial = append ? entry.result : null;
        const page = await readAuditHistoryPage(filters, pageSize - (partial?.logs.length || 0), partial?.cursor || entry.start, valid);
        valid();
        const merged = { ...page, logs: [...(partial?.logs || []), ...page.logs], scanned: (partial?.scanned || 0) + page.scanned };
        pages.set(target, { ...entry, result: merged }); index = target;
        // At most five page bodies are retained; primitive cursors remain for visited page buttons.
        const cached = [...pages.keys()].filter(i => pages.get(i)?.result && i !== index).sort((a, b) => Math.abs(a-index)-Math.abs(b-index));
        for (const i of cached.slice(4)) pages.get(i)!.result = null;
        busy = false; publish(merged);
      } catch (error) { busy = false; fail(error); }
    };
    controls.current = {
      go: target => {
        if (busy || fatal) return;
        const current = pages.get(index)?.result;
        if (target === visited && target === index + 1 && current?.hasNext && !current.incomplete) { pages.set(target, { start: current.cursor, result: null }); visited++; }
        void load(target);
      },
      more: () => { if (pages.get(index)?.result?.incomplete) void load(index, true); },
    };
    setState(empty(key));
    stop = subscribeAuditHistoryHead(filtered ? 1 : pageSize, valid, page => {
      if (!active || fatal) return;
      const nextSignature = signature(page);
      if (headSignature !== null && nextSignature !== headSignature) newer = true;
      headSignature = nextSignature; latest = page;
      if (!filtered && index === 0 && !busy) {
        if (pages.get(0)?.result && signature(pages.get(0)!.result!) !== nextSignature) { pages.clear(); visited = 1; }
        pages.set(0, { start: null, result: page }); newer = false; publish(page);
      } else if (pages.get(index)?.result) publish(pages.get(index)!.result!);
    }, fail);
    const timer = setTimeout(() => { if (filtered) void load(0); }, filters.search.trim() ? 350 : 0);
    return () => { active = false; clearTimeout(timer); stop(); session.close(); pages.clear(); };
  }, [key, attempt, authorized, uid]);
  const data = authorized && state.key === key ? state : empty(key);
  return { ...data, online, goTo: (page: number) => controls.current.go(page - 1), continueSearch: () => controls.current.more(), reload: () => setAttempt(n => n+1) };
}
