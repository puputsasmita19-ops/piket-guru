import { UserRole } from '../types';

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  COMMAND_CENTER_VIEW: 'command_center.view',
  KIOSK_VIEW: 'kiosk.view',
  
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',

  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_VIEW_ALL: 'attendance.view_all',
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_UPDATE: 'attendance.update',

  DUTYBOOK_VIEW: 'dutybook.view',
  DUTYBOOK_VIEW_ALL: 'dutybook.view_all',
  DUTYBOOK_CREATE: 'dutybook.create',
  DUTYBOOK_UPDATE: 'dutybook.update',
  DUTYBOOK_VERIFY: 'dutybook.verify',
  DUTYBOOK_UNLOCK: 'dutybook.unlock',

  INCIDENT_VIEW: 'incident.view',
  INCIDENT_CREATE: 'incident.create',
  INCIDENT_UPDATE: 'incident.update',
  INCIDENT_DELETE: 'incident.delete',

  STUDENT_TARDY_VIEW: 'student_tardy.view',
  STUDENT_TARDY_CREATE: 'student_tardy.create',
  STUDENT_TARDY_ADMIT: 'student_tardy.admit',

  VISITORS_VIEW: 'visitors.view',
  VISITORS_CREATE: 'visitors.create',
  VISITORS_CHECKOUT: 'visitors.checkout',

  STUDENT_PERMITS_VIEW: 'student_permits.view',
  STUDENT_PERMITS_CREATE: 'student_permits.create',
  STUDENT_PERMITS_RETURN: 'student_permits.return',

  SUBSTITUTIONS_VIEW: 'substitutions.view',
  SUBSTITUTIONS_CREATE: 'substitutions.create',
  SUBSTITUTIONS_UPDATE: 'substitutions.update',

  DOCUMENTATION_VIEW: 'documentation.view',
  DOCUMENTATION_UPLOAD: 'documentation.upload',
  DOCUMENTATION_DELETE: 'documentation.delete',

  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',

  BACKUP_VIEW: 'backup.view',
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',

  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | '*';

export interface AppPermissionItem {
  id: string;
  label: string;
  category: 'Dashboard' | 'Pusat Komando' | 'TV Lobi' | 'Jadwal' | 'Presensi' | 'Buku Piket' | 'Kejadian' | 'Laporan' | 'Sistem';
  description?: string;
}

export const APP_PERMISSION_ITEMS: AppPermissionItem[] = [
  { id: PERMISSIONS.DASHBOARD_VIEW, label: 'Lihat Dashboard Piket', category: 'Dashboard', description: 'Akses ke ringkasan beranda dan status piket guru' },
  { id: PERMISSIONS.COMMAND_CENTER_VIEW, label: 'Pusat Komando', category: 'Pusat Komando', description: 'Membuka menu pusat komando' },
  { id: PERMISSIONS.KIOSK_VIEW, label: 'Mode TV Lobi', category: 'TV Lobi', description: 'Membuka tampilan TV dengan konfigurasi admin' },
  { id: PERMISSIONS.SCHEDULE_VIEW, label: 'Lihat Jadwal Piket', category: 'Jadwal', description: 'Melihat pembagian jadwal dan pos petugas piket' },
  { id: 'manage_schedules', label: 'Kelola & Buat Jadwal Piket', category: 'Jadwal', description: 'Menambah, mengedit, dan mengatur shift jadwal' },
  { id: PERMISSIONS.ATTENDANCE_CREATE, label: 'Presensi Piket Mandiri (GPS)', category: 'Presensi', description: 'Melakukan presensi masuk dan pulang tugas piket' },
  { id: PERMISSIONS.DUTYBOOK_CREATE, label: 'Isi/Edit Buku Piket Sendiri', category: 'Buku Piket', description: 'Mengisi jurnal harian 7 aspek kondisi sekolah' },
  { id: PERMISSIONS.DUTYBOOK_VERIFY, label: 'Verifikasi Buku Piket (Koordinator)', category: 'Buku Piket', description: 'Memverifikasi draf jurnal sebelum pengesahan' },
  { id: PERMISSIONS.DUTYBOOK_UNLOCK, label: 'Persetujuan & Buka Kunci (Kepala Sekolah)', category: 'Buku Piket', description: 'Menyetujui secara resmi dan membuka kunci jurnal' },
  { id: PERMISSIONS.INCIDENT_CREATE, label: 'Input & Tindak Lanjut Insiden', category: 'Kejadian', description: 'Melaporkan kejadian khusus dan siswa terlambat/izin' },
  { id: PERMISSIONS.REPORTS_VIEW, label: 'Lihat Analisis & Rekap Laporan', category: 'Laporan', description: 'Melihat rekapitulasi data kehadiran dan jurnal piket' },
  { id: PERMISSIONS.REPORTS_EXPORT, label: 'Ekspor Data CSV & Spreadsheet', category: 'Laporan', description: 'Mengunduh laporan rekapitulasi resmi' },
  { id: 'manage_master_data', label: 'Kelola Master Data & Petugas', category: 'Sistem', description: 'Mengatur data guru, staf, ruangan, dan kategori' },
  { id: 'system_settings', label: 'Pengaturan Sekolah & Geofence GPS', category: 'Sistem', description: 'Konfigurasi radius sekolah, jam operasional, dan backup' },
];

/**
 * Standard Core Permissions for Guru Piket (Never includes wildcard '*')
 */
export const GURU_PIKET_CORE_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.SCHEDULE_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.ATTENDANCE_CREATE,
  PERMISSIONS.DUTYBOOK_VIEW,
  PERMISSIONS.DUTYBOOK_CREATE,
  PERMISSIONS.DUTYBOOK_UPDATE,
  PERMISSIONS.INCIDENT_VIEW,
  PERMISSIONS.INCIDENT_CREATE,
  PERMISSIONS.STUDENT_TARDY_VIEW,
  PERMISSIONS.STUDENT_PERMITS_VIEW,
  PERMISSIONS.SUBSTITUTIONS_VIEW,
  PERMISSIONS.VISITORS_VIEW,
];

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  ADMIN: ['*'],
  KEPALA_SEKOLAH: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.KIOSK_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW_ALL,
    PERMISSIONS.DUTYBOOK_VIEW,
    PERMISSIONS.DUTYBOOK_VIEW_ALL,
    PERMISSIONS.DUTYBOOK_VERIFY,
    PERMISSIONS.DUTYBOOK_UNLOCK,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.STUDENT_TARDY_VIEW,
    PERMISSIONS.VISITORS_VIEW,
    PERMISSIONS.STUDENT_PERMITS_VIEW,
    PERMISSIONS.SUBSTITUTIONS_VIEW,
    PERMISSIONS.DOCUMENTATION_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
  GURU: [...GURU_PIKET_CORE_PERMISSIONS] as PermissionKey[],
  TENAGA_KEPENDIDIKAN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.KIOSK_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.DUTYBOOK_VIEW,
    PERMISSIONS.DUTYBOOK_CREATE,
    PERMISSIONS.DUTYBOOK_UPDATE,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_CREATE,
    PERMISSIONS.STUDENT_TARDY_VIEW,
    PERMISSIONS.STUDENT_TARDY_CREATE,
    PERMISSIONS.STUDENT_TARDY_ADMIT,
    PERMISSIONS.VISITORS_VIEW,
    PERMISSIONS.VISITORS_CREATE,
    PERMISSIONS.VISITORS_CHECKOUT,
    PERMISSIONS.STUDENT_PERMITS_VIEW,
    PERMISSIONS.STUDENT_PERMITS_CREATE,
    PERMISSIONS.STUDENT_PERMITS_RETURN,
    PERMISSIONS.SUBSTITUTIONS_VIEW,
    PERMISSIONS.SUBSTITUTIONS_CREATE,
    PERMISSIONS.DOCUMENTATION_VIEW,
    PERMISSIONS.DOCUMENTATION_UPLOAD,
  ],
  SATPAM: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.COMMAND_CENTER_VIEW,
    PERMISSIONS.KIOSK_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_CREATE,
    PERMISSIONS.STUDENT_TARDY_VIEW,
    PERMISSIONS.STUDENT_TARDY_CREATE,
    PERMISSIONS.STUDENT_TARDY_ADMIT,
    PERMISSIONS.VISITORS_VIEW,
    PERMISSIONS.VISITORS_CREATE,
    PERMISSIONS.VISITORS_CHECKOUT,
    PERMISSIONS.STUDENT_PERMITS_VIEW,
    PERMISSIONS.STUDENT_PERMITS_CREATE,
    PERMISSIONS.STUDENT_PERMITS_RETURN,
    PERMISSIONS.SUBSTITUTIONS_VIEW,
    PERMISSIONS.SUBSTITUTIONS_CREATE,
    PERMISSIONS.DOCUMENTATION_VIEW,
    PERMISSIONS.DOCUMENTATION_UPLOAD,
  ],
};

export const PERMISSION_ALIAS_MAP: Record<string, string[]> = {
  // Legacy aliases compatibility
  manage_schedules: ['schedule.view', 'schedule.create', 'schedule.update', 'schedule.delete'],
  input_duty_book: [
    'dutybook.view',
    'dutybook.create',
    'dutybook.update',
    'dashboard.view',
    'schedule.view',
    'attendance.view',
    'attendance.create',
  ],
  verify_duty_book: ['dutybook.verify'],
  approve_duty_book: ['dutybook.verify', 'dutybook.unlock'],
  report_incidents: [
    'incident.view',
    'incident.create',
    'incident.update',
    'student_tardy.view',
    'student_tardy.create',
    'student_permits.view',
    'student_permits.create',
  ],
  view_reports: ['reports.view'],
  export_data: ['reports.export'],
  manage_master_data: ['users.view', 'users.create', 'users.update'],
  system_settings: ['settings.view', 'settings.update', 'backup.view', 'backup.create'],

  // Canonical UI aliases with automatic implied read permissions
  'schedules.view': ['schedule.view'],
  'attendance.create': ['attendance.view', 'attendance.create'],
  'attendance.view': ['attendance.view'],
  'dutybook.create': ['dutybook.view', 'dutybook.create', 'dutybook.update'],
  'dutybook.edit': ['dutybook.view', 'dutybook.update'],
  'dutybook.update': ['dutybook.view', 'dutybook.update'],
  'dutybook.view': ['dutybook.view'],
  'journal.view': ['dutybook.view'],
  'journal.create': ['dutybook.view', 'dutybook.create', 'dutybook.update'],
  'journal.edit': ['dutybook.view', 'dutybook.update'],
  'incident.create': [
    'incident.view',
    'incident.create',
    'incident.update',
    'student_tardy.view',
    'student_tardy.create',
    'student_permits.view',
    'student_permits.create',
  ],
};

/**
 * Family of permissions that must be granted or revoked as an atomic bundle
 * when toggled in the Admin User Management UI.
 */
export const PERMISSION_FAMILY_MAP: Record<string, string[]> = {
  [PERMISSIONS.DASHBOARD_VIEW]: ['dashboard.view'],
  [PERMISSIONS.COMMAND_CENTER_VIEW]: ['command_center.view'],
  [PERMISSIONS.KIOSK_VIEW]: ['kiosk.view'],
  [PERMISSIONS.SCHEDULE_VIEW]: ['schedule.view', 'schedules.view'],
  manage_schedules: ['manage_schedules', 'schedule.create', 'schedule.update', 'schedule.delete'],
  [PERMISSIONS.ATTENDANCE_CREATE]: ['attendance.create', 'attendance.view'],
  [PERMISSIONS.DUTYBOOK_CREATE]: [
    'dutybook.create',
    'dutybook.update',
    'dutybook.view',
    'journal.create',
    'journal.edit',
    'journal.view',
  ],
  [PERMISSIONS.DUTYBOOK_VERIFY]: ['dutybook.verify', 'verify_duty_book'],
  [PERMISSIONS.DUTYBOOK_UNLOCK]: ['dutybook.unlock', 'approve_duty_book'],
  [PERMISSIONS.INCIDENT_CREATE]: [
    'incident.create',
    'incident.update',
    'incident.view',
    'report_incidents',
    'student_tardy.create',
    'student_tardy.view',
    'student_permits.create',
    'student_permits.view',
  ],
  [PERMISSIONS.REPORTS_VIEW]: ['reports.view', 'view_reports'],
  [PERMISSIONS.REPORTS_EXPORT]: ['reports.export', 'export_data'],
  manage_master_data: ['manage_master_data', 'users.view', 'users.create', 'users.update'],
  system_settings: ['system_settings', 'settings.view', 'settings.update', 'backup.view', 'backup.create'],
};

export function isPermissionItemChecked(permId: string, userPermissions: string[] | undefined): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(permId)) return true;

  const family = PERMISSION_FAMILY_MAP[permId];
  if (family && family.some((p) => userPermissions.includes(p))) {
    return true;
  }
  return false;
}

export function togglePermissionItem(
  permId: string,
  currentPermissions: string[],
  userRole: UserRole
): string[] {
  let workingPerms = currentPermissions.filter((p) => p !== '*');

  const isChecked = isPermissionItemChecked(permId, currentPermissions);
  const family = PERMISSION_FAMILY_MAP[permId] || [permId];

  if (isChecked) {
    // Revoke: remove permId and all family members
    const familySet = new Set([...family, permId]);
    workingPerms = workingPerms.filter((p) => !familySet.has(p));
  } else {
    // Grant: add permId and all family members
    const set = new Set(workingPerms);
    set.add(permId);
    family.forEach((p) => set.add(p));
    workingPerms = Array.from(set);
  }

  // Security rule: GURU must NEVER receive wildcard '*'
  if (userRole === 'GURU') {
    workingPerms = workingPerms.filter((p) => p !== '*');
  }

  return workingPerms;
}

export function checkUserPermission(userPermissions: string[] | undefined, requiredPermission: PermissionKey): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(requiredPermission)) return true;

  // Check alias mappings granted to user (e.g. dutybook.create grants dutybook.view)
  for (const perm of userPermissions) {
    const mapped = PERMISSION_ALIAS_MAP[perm];
    if (mapped && mapped.includes(requiredPermission as string)) {
      return true;
    }
  }

  return false;
}
