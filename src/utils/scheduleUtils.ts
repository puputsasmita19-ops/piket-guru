import { DayOfWeek, SchoolSettings, UserProfile, UserRole, ScheduleItem } from '../types';
import { TeacherRecord, StaffRecord } from '../types/master.types';
import { DEFAULT_DAILY_SCHEDULES } from '../config/constants';

export interface ShiftHoursResult {
  start: string;
  end: string;
  isActive: boolean;
  checkInStart: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
}

/**
 * Resolves duty shift hours for a specific day from school configuration (`settings/school_config`).
 * Falls back to general school workHours, then to system default day schedules.
 */
export function getShiftHoursForDay(
  day: DayOfWeek,
  settings?: SchoolSettings
): ShiftHoursResult {
  const daily = settings?.workHours?.dailySchedules?.[day];
  const activeDays = settings?.workHours?.activeDays;

  // Determine if day is active in settings
  let isActive = true;
  if (daily && typeof daily.isActive === 'boolean') {
    isActive = daily.isActive;
  } else if (activeDays && Array.isArray(activeDays)) {
    isActive = activeDays.includes(day);
  } else {
    isActive = day !== 'MINGGU';
  }

  // Determine start & end time
  const start =
    (daily?.start && daily.start.trim()) ||
    (settings?.workHours?.start && settings.workHours.start.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.start ||
    '06:30';

  const end =
    (daily?.end && daily.end.trim()) ||
    (settings?.workHours?.end && settings.workHours.end.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.end ||
    '15:30';

  const checkInStart =
    (daily?.checkInStart && daily.checkInStart.trim()) ||
    (settings?.workHours?.checkInStart && settings.workHours.checkInStart.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.checkInStart ||
    '06:00';

  const checkInEnd =
    (daily?.checkInEnd && daily.checkInEnd.trim()) ||
    (settings?.workHours?.checkInEnd && settings.workHours.checkInEnd.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.checkInEnd ||
    '07:30';

  const checkOutStart =
    (daily?.checkOutStart && daily.checkOutStart.trim()) ||
    (settings?.workHours?.checkOutStart && settings.workHours.checkOutStart.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.checkOutStart ||
    '14:30';

  const checkOutEnd =
    (daily?.checkOutEnd && daily.checkOutEnd.trim()) ||
    (settings?.workHours?.checkOutEnd && settings.workHours.checkOutEnd.trim()) ||
    DEFAULT_DAILY_SCHEDULES[day]?.checkOutEnd ||
    '17:00';

  return {
    start,
    end,
    isActive,
    checkInStart,
    checkInEnd,
    checkOutStart,
    checkOutEnd,
  };
}

export interface OfficerCandidate {
  userId: string;         // users.id (strictly used as petugasId in schedules)
  loginId: string;        // users.loginId
  fullName: string;       // users.fullName
  role: UserRole;         // users.role
  nip: string;            // users.nip
  nuptk: string;          // users.nuptk
  phone: string;
  isLinkedToTeacher: boolean;
  linkedTeacherId?: string;
  mataPelajaran?: string;
  isLinkedToStaff: boolean;
  linkedStaffId?: string;
  divisi?: string;
  displayLabel: string;
}

/**
 * Builds the list of eligible active duty officer candidates from `users` collection.
 * Includes all active users with roles (GURU, TENAGA_KEPENDIDIKAN, SATPAM, ADMIN, KEPALA_SEKOLAH)
 * even if NIP/NUPTK is empty (e.g. Guru Uji).
 *
 * Links to master data strictly through `teachers.userId` or `staff.userId`.
 * Never matches by empty string or unverified names.
 */
export function buildOfficerCandidates(
  users: UserProfile[],
  teachers: TeacherRecord[] = [],
  staff: StaffRecord[] = []
): OfficerCandidate[] {
  // Only active user accounts
  const activeUsers = users.filter((u) => u.isActive !== false);

  const eligibleRoles: UserRole[] = [
    'GURU',
    'TENAGA_KEPENDIDIKAN',
    'SATPAM',
    'ADMIN',
    'KEPALA_SEKOLAH',
  ];

  return activeUsers
    .filter(
      (u) =>
        eligibleRoles.includes(u.role) ||
        (Array.isArray(u.permissions) && u.permissions.length > 0)
    )
    .map((u) => {
      // Find linked master teacher strictly by userId
      const linkedTeacher = teachers.find(
        (t) => t.userId && t.userId.trim() !== '' && t.userId.trim() === u.id
      );

      // Find linked master staff strictly by userId
      const linkedStaff = staff.find(
        (s) => s.userId && s.userId.trim() !== '' && s.userId.trim() === u.id
      );

      const parts: string[] = [];
      if (u.loginId) parts.push(`ID: ${u.loginId}`);
      if (u.nip && u.nip.trim() !== '') parts.push(`NIP: ${u.nip}`);
      if (linkedTeacher?.mataPelajaran) parts.push(linkedTeacher.mataPelajaran);
      else if (linkedStaff?.divisi) parts.push(linkedStaff.divisi);
      else parts.push(u.role);

      const displayLabel = `${u.fullName} (${parts.join(' • ')})`;

      return {
        userId: u.id,
        loginId: u.loginId || '',
        fullName: u.fullName || 'Petugas Piket',
        role: u.role,
        nip: u.nip || '',
        nuptk: u.nuptk || '',
        phone: u.phone || linkedTeacher?.phone || linkedStaff?.phone || '',
        isLinkedToTeacher: Boolean(linkedTeacher),
        linkedTeacherId: linkedTeacher?.id,
        mataPelajaran: linkedTeacher?.mataPelajaran,
        isLinkedToStaff: Boolean(linkedStaff),
        linkedStaffId: linkedStaff?.id,
        divisi: linkedStaff?.divisi,
        displayLabel,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Helper to check whether a schedule item belongs to the given user account.
 * Supports both new schedules (`petugasId === users.id`) and legacy schedules (`petugasId === teacher.id`).
 */
export function isScheduleMatchingUser(
  schedule: ScheduleItem,
  user?: UserProfile | null,
  teachers: TeacherRecord[] = [],
  staff: StaffRecord[] = []
): boolean {
  if (!user || !schedule) return false;

  // Primary: Direct match by users.id
  if (schedule.petugasId === user.id) return true;

  // Legacy fallback: If user is linked to teacher.id or staff.id stored in legacy schedule
  const linkedTeacher = teachers.find((t) => t.userId && t.userId === user.id);
  if (linkedTeacher && schedule.petugasId === linkedTeacher.id) return true;

  const linkedStaff = staff.find((s) => s.userId && s.userId === user.id);
  if (linkedStaff && schedule.petugasId === linkedStaff.id) return true;

  return false;
}
