import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../config/permissions';
import { NavigationTab } from '../../types';
import { getModuleStyle } from '../../config/moduleAppearance';
import { MapPin, BookOpenCheck, ClockCountdown, DoorOpen, AlertTriangle, UserCheck, ChevronRight } from '../../components/icons';

const actions = [
  { tab: 'attendance', title: 'Presensi GPS', description: 'Masuk dan pulang', icon: MapPin, permission: PERMISSIONS.ATTENDANCE_VIEW },
  { tab: 'duty-book', title: 'Buku piket', description: 'Kegiatan hari ini', icon: BookOpenCheck, permission: PERMISSIONS.DUTYBOOK_VIEW },
  { tab: 'student-tardiness', title: 'Siswa terlambat', description: 'Data keterlambatan', icon: ClockCountdown, permission: PERMISSIONS.STUDENT_TARDY_VIEW },
  { tab: 'student-permits', title: 'Izin keluar siswa', description: 'Izin dan kepulangan', icon: DoorOpen, permission: PERMISSIONS.STUDENT_PERMITS_VIEW },
  { tab: 'incidents', title: 'Laporan kejadian', description: 'Dokumentasi kejadian', icon: AlertTriangle, permission: PERMISSIONS.INCIDENT_VIEW },
  { tab: 'visitors', title: 'Buku tamu', description: 'Kunjungan ke sekolah', icon: UserCheck, permission: PERMISSIONS.VISITORS_VIEW },
] as const;

export function QuickActions({ onNavigate }: { onNavigate: (tab: NavigationTab) => void }) {
  const { hasPermission } = useAuth();
  const visible = actions.filter((action) => hasPermission(action.permission));
  if (!visible.length) return null;
  return (
    <section aria-labelledby="quick-actions-heading" data-tour="quick-actions" className="space-y-3">
      <div><h2 id="quick-actions-heading" className="text-base font-bold text-slate-900 dark:text-white">Akses cepat</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Pilih kegiatan yang ingin Anda buka.</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {visible.map(({ tab, title, description, icon: Icon }) => (
          <button key={tab} type="button" onClick={() => onNavigate(tab)} aria-label={`Buka ${title}`}
            data-module={tab} style={getModuleStyle(tab)}
            className="quick-action group flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 text-left rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] hover:border-[var(--theme-primary-border)] hover:bg-[var(--theme-primary-light)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]">
            <span className="module-icon flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl shrink-0"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug text-slate-800 dark:text-slate-100">{title}</span>
              <span className="module-description block mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</span></span>
            <ChevronRight className="hidden sm:block h-4 w-4 mt-2 text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
