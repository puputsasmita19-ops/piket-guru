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
  GURU: [
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
    PERMISSIONS.INCIDENT_UPDATE,
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
    PERMISSIONS.SUBSTITUTIONS_UPDATE,
    PERMISSIONS.DOCUMENTATION_VIEW,
    PERMISSIONS.DOCUMENTATION_UPLOAD,
  ],
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
  manage_schedules: ['schedule.view', 'schedule.create', 'schedule.update', 'schedule.delete'],
  input_duty_book: ['dutybook.view', 'dutybook.create', 'dutybook.update'],
  verify_duty_book: ['dutybook.verify'],
  approve_duty_book: ['dutybook.verify', 'dutybook.unlock'],
  report_incidents: ['incident.view', 'incident.create', 'incident.update', 'student_tardy.view', 'student_tardy.create', 'student_permits.view', 'student_permits.create'],
  view_reports: ['reports.view'],
  export_data: ['reports.export'],
  manage_master_data: ['users.view', 'users.create', 'users.update'],
  system_settings: ['settings.view', 'settings.update', 'backup.view', 'backup.create'],
};

export function checkUserPermission(userPermissions: string[] | undefined, requiredPermission: PermissionKey): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(requiredPermission)) return true;

  // Check alias mappings configured from Admin UI
  for (const perm of userPermissions) {
    const mapped = PERMISSION_ALIAS_MAP[perm];
    if (mapped && mapped.includes(requiredPermission)) {
      return true;
    }
  }

  return false;
}
