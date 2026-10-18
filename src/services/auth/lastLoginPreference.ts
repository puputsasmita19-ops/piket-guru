import firebaseConfig from '../../../firebase-applet-config.json';

// This is a display preference, never a session, credential or permission cache.
export const LAST_LOGIN_KEY = `piket_last_login_v1:${firebaseConfig.projectId}`;
const CHANGE_EVENT = 'piket:last-login-change';
let memoryUid: string | null = null;
const validUid = (uid: unknown): uid is string => typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && uid.trim() === uid && !/[\x00-\x1f/\\]/.test(uid);
export const LastLoginPreference = {
  read(trusted: boolean): string | null {
    if (!trusted) return null;
    let raw: string | null;
    try { raw = localStorage.getItem(LAST_LOGIN_KEY); } catch { return memoryUid; }
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value?.version === 1 && validUid(value.uid) ? value.uid : null;
    } catch { return null; }
  },
  remember(user: { id: string; isActive?: boolean }, trusted: boolean) {
    if (!trusted) { this.forget(); return; }
    if (!user.isActive || !validUid(user.id)) return;
    memoryUid = user.id;
    try { localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ version: 1, uid: user.id, updatedAt: Date.now() })); } catch { /* Login works when storage is blocked. */ }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
  },
  forget(notify = true) {
    memoryUid = null;
    try { localStorage.removeItem(LAST_LOGIN_KEY); } catch { /* Non-fatal. */ }
    if (notify && typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
  },
  subscribe(callback: () => void) {
    const storage = (e: StorageEvent) => { if (e.key === LAST_LOGIN_KEY || e.key === null) callback(); };
    window.addEventListener('storage', storage); window.addEventListener(CHANGE_EVENT, callback);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(CHANGE_EVENT, callback); };
  },
};
