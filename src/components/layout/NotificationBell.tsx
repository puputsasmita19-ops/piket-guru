import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, X, ShieldCheck, FileText, Megaphone, RefreshCw } from '../icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { auth } from '../../services/firebase/firebaseAuth';
import { subscribeNotificationFeed, type FeedSnapshot } from '../../services/notifications/notificationFeedService';
import { flushNotificationOutbox } from '../../services/notifications/notificationPublisher';
import { loadNotificationReadState, saveNotificationReadState } from '../../services/notifications/notificationReadState';
import { buildNotificationFeed, sanitizeNotificationConfig, type NotificationConfig } from '../../types/notification.types';
import { Tooltip } from '../common/Tooltip';

const EMPTY: FeedSnapshot = { events: [], announcements: [], loading: true, fromCache: false, error: null };
const timestamp = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) + ' WIB';

export const NotificationBell: React.FC<{ isOpen: boolean; onToggle: () => void; onClose: () => void; config?: NotificationConfig }> = ({ isOpen, onToggle, onClose, config: rawConfig }) => {
  const { currentUser, isTrustedDevice } = useAuth();
  const { setActiveTab } = useNavigation();
  const uid = currentUser?.id || '';
  const project = auth.app.options.projectId || 'piket-guru';
  const configJson = JSON.stringify(sanitizeNotificationConfig(rawConfig));
  const [retry, setRetry] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [state, setState] = useState<{ uid: string; config: string; data: FeedSnapshot }>({ uid: '', config: '', data: EMPTY });
  const [readState, setReadState] = useState<{ uid: string; ids: string[] }>({ uid: '', ids: [] });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const config = JSON.parse(configJson) as NotificationConfig;
  useEffect(() => {
    setReadState({ uid, ids: uid ? loadNotificationReadState(project, uid, isTrustedDevice) : [] });
  }, [uid, project, isTrustedDevice]);
  useEffect(() => {
    if (!uid) return;
    const settings = JSON.parse(configJson) as NotificationConfig;
    return subscribeNotificationFeed(uid, settings, data => setState({ uid, config: configJson, data }));
  }, [uid, configJson, retry]);
  useEffect(() => {
    const connected = () => { setOnline(true); void flushNotificationOutbox(); };
    const disconnected = () => setOnline(false);
    const syncRead = (e: StorageEvent) => { if (e.key?.endsWith(`:${uid}`)) setReadState({ uid, ids: loadNotificationReadState(project, uid, isTrustedDevice) }); };
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('storage', syncRead);
    void flushNotificationOutbox();
    // Expire the displayed history while the app stays open; no polling or network reads.
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); window.removeEventListener('storage', syncRead); };
  }, [uid, project, isTrustedDevice]);
  useEffect(() => { if (isOpen) closeRef.current?.focus(); }, [isOpen]);
  const data = state.uid === uid && state.config === configJson ? state.data : EMPTY;
  const items = currentUser ? buildNotificationFeed(data.events, data.announcements, currentUser, config, clock) : [];
  const readIds = readState.uid === uid ? readState.ids : [];
  const unread = items.filter(item => !readIds.includes(item.id)).length;
  const mark = (ids: string[]) => { if (uid) setReadState({ uid, ids: saveNotificationReadState(project, uid, isTrustedDevice, [...readIds, ...ids]) }); };
  const close = () => { onClose(); buttonRef.current?.focus(); };
  const status = !config.enabled ? 'Dinonaktifkan oleh admin' : !online ? 'Offline • menunggu koneksi' : data.error ? 'Perlu diperiksa' : data.loading ? 'Menghubungkan…' : data.fromCache ? 'Data cache • menunggu server' : 'Terhubung realtime';
  const actionClass = 'min-h-[44px] px-2.5 rounded-xl text-xs font-semibold cursor-pointer hover:bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]';
  return <div className="relative">
    <Tooltip content="Notifikasi terbaru" position="bottom">
      <button ref={buttonRef} type="button" onClick={onToggle} aria-label={`Pusat Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`} aria-haspopup="dialog" aria-expanded={isOpen} aria-controls="notification-panel"
        className={`p-2 sm:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${isOpen ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)]'}`}>
        <Bell className="w-4 h-4" />
        {unread > 0 && <span className="absolute top-0.5 right-0 text-[9px] font-bold min-w-4 h-4 px-0.5 rounded-full bg-[var(--theme-primary)] text-white flex items-center justify-center" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </Tooltip>
    {isOpen && <section id="notification-panel" role="dialog" aria-label="Pusat Notifikasi" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
      className="fixed top-16 left-3 right-3 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2 sm:w-[390px] max-w-[calc(100vw-24px)] rounded-2xl shadow-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] text-slate-800 dark:text-slate-100 z-50 flex flex-col max-h-[min(560px,calc(100dvh-5rem))] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div className="px-3.5 pt-2.5 pb-2 border-b border-[var(--theme-card-border)] shrink-0">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-sm">Notifikasi {unread > 0 && <span className="text-xs font-medium text-[var(--theme-primary-text)]">({unread} baru)</span>}</h3><button ref={closeRef} type="button" onClick={close} aria-label="Tutup Notifikasi" className={actionClass}><X className="w-4 h-4" /></button></div>
        <div className="flex items-center justify-between gap-2"><p role="status" className="text-[11px] text-slate-500 dark:text-slate-400">{status}</p>{unread > 0 && <button className={actionClass} type="button" onClick={() => mark(items.map(i => i.id))}>Baca semua</button>}</div>
      </div>
      <div className="overflow-y-auto overscroll-contain min-h-0 p-3 space-y-2">
        {data.error && config.enabled && <div role="alert" className="p-3 text-xs rounded-xl bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800"><p>{data.error}</p><button type="button" className={actionClass} onClick={() => { setRetry(n => n + 1); void flushNotificationOutbox(); }}><RefreshCw className="w-3 h-3 inline mr-1" />Coba lagi</button></div>}
        {!items.length && <p className="py-8 px-3 text-center text-xs text-slate-500 dark:text-slate-400">{!config.enabled ? 'Notifikasi aplikasi sedang dinonaktifkan oleh admin.' : data.loading && online ? 'Memuat informasi terbaru…' : 'Belum ada notifikasi pada kategori yang diaktifkan.'}</p>}
        {items.map(item => {
          const read = readIds.includes(item.id);
          const Icon = item.category === 'SESSION' ? ShieldCheck : item.category === 'ANNOUNCEMENT' ? Megaphone : FileText;
          return <article key={item.id} className={`p-3 rounded-xl border ${read ? 'border-[var(--theme-card-border)] bg-[var(--theme-surface-subtle)]' : 'border-[var(--theme-primary-border)] bg-[var(--theme-primary-light)]'}`}>
            <div className="flex items-start gap-2.5"><Icon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--theme-primary-text)]" /><div className="min-w-0 flex-1">
              <div className="flex items-start gap-2"><h4 className="text-xs font-bold leading-relaxed break-words flex-1">{item.title}</h4>{!read && <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[var(--theme-primary)] shrink-0" aria-label="Belum dibaca" />}</div>
              {item.urgent && <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300">PENGUMUMAN DARURAT</p>}
              <p className="text-xs mt-1 leading-relaxed break-words whitespace-pre-line text-slate-600 dark:text-slate-300">{item.description}</p>
              <time dateTime={item.createdAt} className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">{timestamp(item.createdAt)}</time>
              <div className="flex items-center justify-between gap-1 mt-1">{item.tab ? <button type="button" className={actionClass} onClick={() => { mark([item.id]); setActiveTab(item.tab!); close(); }}>Buka {item.category === 'ANNOUNCEMENT' ? 'pengumuman' : 'menu'}</button> : <span className="text-[10px] text-slate-500">Pribadi</span>}{!read && <button type="button" onClick={() => mark([item.id])} className={actionClass} aria-label={`Tandai dibaca: ${item.title}`}><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Dibaca</button>}</div>
            </div></div>
          </article>;
        })}
      </div>
      {config.enabled && <p className="px-3.5 py-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-[var(--theme-card-border)] shrink-0">Maks. {config.maxItems} informasi • aktivitas {config.historyDays} hari terakhir</p>}
    </section>}
  </div>;
};
