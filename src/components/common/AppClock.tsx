import React, { useSyncExternalStore } from 'react';

// One visible-page timer, confined to this small component. Forms, searches,
// notifications and the header no longer render again on every second.
let now = Math.floor(Date.now() / 1000) * 1000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const tick = () => { if (document.hidden) return; now = Math.floor(Date.now() / 1000) * 1000; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  if (listeners.size === 1) { tick(); timer = setInterval(tick, 1000); document.addEventListener('visibilitychange', tick); }
  return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(timer); timer = undefined; document.removeEventListener('visibilitychange', tick); } };
};
const options = { timeZone: 'Asia/Jakarta' };
const full = new Intl.DateTimeFormat('id-ID', { ...options, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const login = new Intl.DateTimeFormat('id-ID', { ...options, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const compact = new Intl.DateTimeFormat('id-ID', { ...options, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const time = new Intl.DateTimeFormat('en-GB', { ...options, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function AppClock({ variant }: { variant: 'login' | 'mobile' | 'desktop' }) {
  const date = new Date(useSyncExternalStore(subscribe, () => now, () => now));
  return <div className={`app-clock app-clock-${variant}`} title={`${full.format(date)}, ${time.format(date)} WIB`} aria-label="Hari, tanggal dan waktu WIB">
    <span className="app-clock-date">{(variant === 'mobile' ? compact : variant === 'login' ? login : full).format(date)}</span>
    <time className="app-clock-time" dateTime={date.toISOString()}>{time.format(date)}<span className="app-clock-zone"> WIB</span></time>
  </div>;
}
