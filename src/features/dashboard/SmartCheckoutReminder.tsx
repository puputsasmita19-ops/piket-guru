import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Clock, Info, ArrowRight } from '../../components/icons';
import { db } from '../../services/firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../config/permissions';
import { getShiftHoursForDay } from '../../utils/scheduleUtils';
import { getCurrentDayName, getCurrentTimeHHMM, getTodayISODate } from '../../utils/dateUtils';
import type { AttendanceRecord, SchoolSettings } from '../../types';
import { isOperationalRecord } from '../../types';
import { classifyCheckoutReminder, snoozeExpiry } from './checkoutReminderPolicy';

interface Props {
  todayISO: string;
  settings: SchoolSettings;
  settingsReady: boolean;
  /** Existing dashboard list: used only to suppress ambiguous legacy IDs. */
  legacyAttendance?: AttendanceRecord;
  onOpenAttendance: () => void;
}

type ServerRecord = {
  userId: string;
  date: string;
  verified: boolean;
  record: AttendanceRecord | null;
  error: boolean;
};

function snoozeKey(userId: string, todayISO: string): string {
  return `piket:r89b:checkout-snooze:${userId}:${todayISO}`;
}

function loadSnooze(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch { return 0; }
}

/** Isolated from dashboard metrics: one own-document listener, never a collection scan. */
export const SmartCheckoutReminder: React.FC<Props> = ({ todayISO, settings, settingsReady, legacyAttendance, onOpenAttendance }) => {
  const { currentUser, hasPermission, isOffline } = useAuth();
  const userId = currentUser?.id || '';
  const canView = currentUser?.role === 'GURU' && hasPermission(PERMISSIONS.ATTENDANCE_VIEW);
  const key = snoozeKey(userId, todayISO);
  const [snapshot, setSnapshot] = useState<ServerRecord | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [snoozedUntil, setSnoozedUntil] = useState(() => loadSnooze(key));

  useEffect(() => {
    setSnoozedUntil(loadSnooze(key));
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setSnoozedUntil(loadSnooze(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  useEffect(() => {
    if (!canView || !userId) return;
    let live = true;
    // A document snapshot with metadata distinguishes the server from offline/cache data.
    const stop = onSnapshot(
      doc(db, 'attendance', `att-${todayISO}-${userId}`),
      { includeMetadataChanges: true },
      snap => {
        if (!live) return;
        const record = snap.exists() ? ({ id: snap.id, ...snap.data() } as AttendanceRecord) : null;
        setSnapshot({
          userId, date: todayISO,
          verified: !snap.metadata.fromCache && !snap.metadata.hasPendingWrites,
          record: record && record.userId === userId && record.tanggal === todayISO && isOperationalRecord(record) ? record : null,
          error: false,
        });
      },
      () => { if (live) setSnapshot({ userId, date: todayISO, verified: false, record: null, error: true }); },
    );
    return () => { live = false; stop(); };
  }, [canView, todayISO, userId]);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    // No Firestore polling. Handle tab resume and the moment a checkout window opens.
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  if (!canView || !settingsReady || !userId) return null;
  const sameIdentity = snapshot?.userId === userId && snapshot?.date === todayISO;
  const record = sameIdentity ? snapshot.record : null;
  const currentTime = new Date(nowMs);
  const shift = getShiftHoursForDay(getCurrentDayName(currentTime), settings);
  const mode = settings.attendanceMode === 'BEBAS' ? 'BEBAS' : 'TERJADWAL';
  const online = !isOffline && (typeof navigator === 'undefined' || navigator.onLine);
  // If a legacy ID appears in the collection but not under the canonical ID, stay conservative.
  const ambiguousLegacy = !!legacyAttendance && (!record || record.id !== legacyAttendance.id);
  const status = classifyCheckoutReminder({
    todayWib: todayISO,
    recordDate: record?.tanggal,
    hasCheckIn: !!record?.jamMasuk,
    hasCheckOut: !!record?.jamPulang,
    serverVerified: !!sameIdentity && !!snapshot?.verified && !snapshot?.error && !ambiguousLegacy
      && getTodayISODate(currentTime) === todayISO,
    online,
    mode,
    activeDay: shift.isActive,
    checkOutStart: shift.checkOutStart,
    nowHHMM: getCurrentTimeHHMM(currentTime),
  });

  if (status === 'BELUM_TERVERIFIKASI') {
    if (!record?.jamMasuk || !!record.jamPulang || online) return null;
    return (
      <section className="flex items-start gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300" role="status">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Status presensi pulang belum dapat diverifikasi. Hubungkan kembali internet untuk memeriksa status terbaru.</span>
      </section>
    );
  }
  // A free-mode shift receives only a quiet shortcut, never a timed alarm.
  const freeModeNudge = mode === 'BEBAS' && status === 'BERTUGAS';
  if ((status !== 'PERLU_PENGINGAT' && !freeModeNudge) || nowMs < snoozedUntil) return null;

  const postpone = () => {
    const until = snoozeExpiry(Date.now());
    setSnoozedUntil(until);
    try { localStorage.setItem(key, String(until)); } catch { /* snooze still works in this tab */ }
  };

  return (
    <section aria-label="Pengingat presensi pulang" className="rounded-2xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-light)]/40 dark:bg-[var(--theme-card-bg)] px-3.5 py-3.5 sm:px-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-white/80 dark:bg-slate-800 text-[var(--theme-primary-text)]">
          <Clock className="w-4.5 h-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {freeModeNudge ? 'Presensi pulang tersedia' : 'Pengingat presensi pulang'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {freeModeNudge
              ? 'Anda sudah presensi masuk. Saat selesai bertugas, lakukan presensi pulang.'
              : `Presensi pulang sudah dibuka sejak ${shift.checkOutStart} WIB. Jangan lupa mencatat kepulangan sebelum meninggalkan sekolah.`}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" onClick={onOpenAttendance}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 bg-[var(--theme-primary)] text-white text-xs font-bold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]">
              Presensi Pulang <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={postpone}
              className="inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2">
              Ingatkan lagi 20 menit
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
