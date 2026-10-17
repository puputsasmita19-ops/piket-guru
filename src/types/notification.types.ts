import type { NavigationTab, UserProfile } from './index';
import type { PermissionKey } from '../config/permissions';
import { checkUserPermission } from '../config/permissions';
import type { AnnouncementRecord } from './announcement.types';

export const NOTIFICATION_MODULES = {
  ATTENDANCE: { label: 'Presensi GPS', tab: 'attendance', permission: 'attendance.view' },
  DUTY_BOOK: { label: 'Buku Piket', tab: 'duty-book', permission: 'dutybook.view' },
  TARDINESS: { label: 'Siswa Terlambat', tab: 'student-tardiness', permission: 'student_tardy.view' },
  PERMITS: { label: 'Izin Siswa & Gerbang', tab: 'student-permits', permission: 'student_permits.view' },
  SUBSTITUTIONS: { label: 'Guru Pengganti', tab: 'substitutions', permission: 'substitutions.view' },
  VISITORS: { label: 'Buku Tamu', tab: 'visitors', permission: 'visitors.view' },
  INCIDENTS: { label: 'Laporan Kejadian', tab: 'incidents', permission: 'incident.view' },
  SCHEDULES: { label: 'Jadwal Piket', tab: 'schedules', permission: 'schedule.view' },
} as const;
export type NotificationModule = keyof typeof NOTIFICATION_MODULES;
export const NOTIFICATION_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ATTENDANCE', 'IMPORT', 'CHECK_IN', 'CHECK_OUT', 'VERIFY', 'UNLOCK'] as const;
export interface NotificationConfig {
  enabled: boolean;
  sessionEvents: boolean;
  operationalUpdates: boolean;
  announcements: boolean;
  historyDays: number;
  maxItems: number;
  modules: Record<NotificationModule, boolean>;
}
export function sanitizeNotificationConfig(value?: Partial<NotificationConfig> | null): NotificationConfig {
  const v = value || {};
  return {
    enabled: v.enabled !== false,
    sessionEvents: v.sessionEvents !== false,
    operationalUpdates: v.operationalUpdates !== false,
    announcements: v.announcements !== false,
    historyDays: [1, 3, 7].includes(v.historyDays!) ? v.historyDays! : 7,
    maxItems: [20, 30, 50].includes(v.maxItems!) ? v.maxItems! : 30,
    modules: Object.fromEntries(Object.keys(NOTIFICATION_MODULES).map(key => [key, v.modules?.[key as NotificationModule] !== false])) as Record<NotificationModule, boolean>,
  };
}
export interface NotificationEvent {
  id: string;
  scope: 'USER' | 'SCHOOL';
  actorId: string;
  actorName: string;
  module: NotificationModule | 'AUTH';
  action: string;
  createdAt: string;
}
export interface FeedItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  category: 'SESSION' | 'ACTIVITY' | 'ANNOUNCEMENT';
  tab?: NavigationTab;
  urgent?: boolean;
}
export function operationalEventFromAudit(record: { id: string; userId: string; userName: string; module: string; action: string; status?: string; timestamp: string }): NotificationEvent | null {
  if (!Object.hasOwn(NOTIFICATION_MODULES, record.module) || !NOTIFICATION_ACTIONS.includes(record.action as any) || !['SUCCESS', 'BERHASIL'].includes(record.status || 'SUCCESS')) return null;
  if (!record.userId || record.userId === 'anonymous' || !Number.isFinite(Date.parse(record.timestamp))) return null;
  // Deliberately never copy audit details, photos, GPS, tokens, or student identities.
  return { id: record.id, scope: 'SCHOOL', actorId: record.userId, actorName: (record.userName || 'Petugas').slice(0, 160), module: record.module as NotificationModule, action: record.action, createdAt: record.timestamp };
}
export function mayViewNotificationModule(user: Pick<UserProfile, 'permissions'>, module: NotificationModule): boolean {
  return checkUserPermission(user.permissions, NOTIFICATION_MODULES[module].permission as PermissionKey);
}
export function buildNotificationFeed(events: NotificationEvent[], announcements: AnnouncementRecord[], user: UserProfile, config: NotificationConfig, now = Date.now()): FeedItem[] {
  if (!config.enabled) return [];
  const oldest = now - config.historyDays * 86400000;
  const result = new Map<string, FeedItem>();
  const verbs: Record<string, string> = { CREATE: 'menambahkan data', UPDATE: 'memperbarui data', DELETE: 'menghapus data', STATUS_CHANGE: 'memperbarui status', ATTENDANCE: 'mencatat presensi', IMPORT: 'mengimpor data', CHECK_IN: 'mencatat kedatangan', CHECK_OUT: 'mencatat kepulangan', VERIFY: 'memverifikasi data', UNLOCK: 'membuka kunci data' };
  for (const e of events) {
    if (typeof e.createdAt !== 'string') continue;
    const time = Date.parse(e.createdAt);
    if (!Number.isFinite(time) || time < oldest || time > now + 60000) continue;
    if (e.scope === 'USER' && e.actorId === user.id && e.module === 'AUTH' && config.sessionEvents && ['LOGIN', 'LOGOUT'].includes(e.action)) {
      result.set(e.id, { id: e.id, title: e.action === 'LOGIN' ? 'Anda berhasil masuk' : 'Anda keluar dari aplikasi', description: 'Riwayat sesi akun Anda.', category: 'SESSION', createdAt: e.createdAt });
    } else if (e.scope === 'SCHOOL' && e.actorId !== user.id && Object.hasOwn(NOTIFICATION_MODULES, e.module) && config.operationalUpdates && config.modules[e.module as NotificationModule] && mayViewNotificationModule(user, e.module as NotificationModule) && verbs[e.action]) {
      const module = NOTIFICATION_MODULES[e.module as NotificationModule];
      result.set(e.id, { id: e.id, title: module.label, description: `${e.actorName} ${verbs[e.action]}.`, category: 'ACTIVITY', createdAt: e.createdAt, tab: module.tab });
    }
  }
  if (config.announcements) for (const a of announcements) {
    if (typeof a.title !== 'string' || typeof a.content !== 'string') continue;
    const target = a.targetRole || 'SEMUA';
    if (!a.isActive || a.isDemo || a.dataSource === 'SEED' || !(target === 'SEMUA' || target === user.role || (target === 'TENDIK' && user.role === 'TENAGA_KEPENDIDIKAN'))) continue;
    // Keep active instructions visible even when their original publication is older than the activity window.
    const createdAt = typeof a.updatedAt === 'string' ? a.updatedAt : a.createdAt;
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    const id = `announcement:${a.id}:${createdAt}`;
    result.set(id, { id, title: a.title, description: a.content.slice(0, 320), createdAt, category: 'ANNOUNCEMENT', urgent: a.priority === 'DARURAT', tab: checkUserPermission(user.permissions, 'dashboard.view') ? 'dashboard' : undefined });
  }
  return [...result.values()].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, config.maxItems);
}
