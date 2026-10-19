import { DayOfWeek, SchoolSettings, UserProfile, UserRole, ScheduleItem } from '../types';
import { TeacherRecord, StaffRecord } from '../types/master.types';
import { DEFAULT_DAILY_SCHEDULES } from '../config/constants';
import { getCurrentDayName, getTodayISODate } from './dateUtils';

export function getScheduleRecurrence(schedule: { recurrence?: 'WEEKLY' | 'ONCE' }): 'WEEKLY' | 'ONCE' {
  return schedule.recurrence === 'ONCE' ? 'ONCE' : 'WEEKLY';
}

export function isScheduleOnDate(schedule: ScheduleItem, dateISO: string): boolean {
  if (schedule.status === 'DIBATALKAN') return false;
  return getScheduleRecurrence(schedule) === 'ONCE'
    ? schedule.tanggal === dateISO
    : schedule.hari === getCurrentDayName(`${dateISO}T12:00:00+07:00`);
}

export function filterOfficerCandidates(candidates: OfficerCandidate[], search: string): OfficerCandidate[] {
  const terms = search.trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
  return candidates.filter(c => {
    const text = [c.fullName, c.loginId, c.nip, c.nuptk, c.role, c.mataPelajaran, c.divisi].join(' ').toLocaleLowerCase('id-ID');
    return terms.every(term => text.includes(term));
  });
}

/** Stable identity for new slots; a retry cannot create another copy. */
export function scheduleSlotId(schedule: Pick<ScheduleItem, 'hari' | 'tanggal' | 'recurrence' | 'petugasId' | 'ruangId' | 'jamMulai' | 'jamSelesai'>): string {
  const recurrence = getScheduleRecurrence(schedule);
  return ['sch-v2', recurrence, recurrence === 'ONCE' ? schedule.tanggal : schedule.hari,
    schedule.petugasId, schedule.ruangId, schedule.jamMulai, schedule.jamSelesai]
    .map(part => encodeURIComponent(part).replace(/~/g, '%7E')).join('~');
}

export function schedulePeriodsOverlap(a: Pick<ScheduleItem, 'hari' | 'tanggal' | 'recurrence'>, b: Pick<ScheduleItem, 'hari' | 'tanggal' | 'recurrence'>): boolean {
  const aOnce = getScheduleRecurrence(a) === 'ONCE', bOnce = getScheduleRecurrence(b) === 'ONCE';
  if (aOnce && bOnce) return Boolean(a.tanggal) && a.tanggal === b.tanggal;
  if (aOnce) return Boolean(a.tanggal) && getCurrentDayName(`${a.tanggal}T12:00:00+07:00`) === b.hari;
  if (bOnce) return Boolean(b.tanggal) && getCurrentDayName(`${b.tanggal}T12:00:00+07:00`) === a.hari;
  return a.hari === b.hari;
}

/** Count weekly occurrences arithmetically; never generate future Firestore documents. */
export function countScheduleOccurrences(schedule: ScheduleItem, startDate: string, endDate: string): number {
  if (schedule.status === 'DIBATALKAN' || !startDate || !endDate || startDate > endDate) return 0;
  // Keep historical report semantics for legacy records; only new explicit templates expand.
  if (schedule.recurrence !== 'WEEKLY') return schedule.tanggal >= startDate && schedule.tanggal <= endDate ? 1 : 0;
  const created = schedule.createdAt && Number.isFinite(Date.parse(schedule.createdAt)) ? getTodayISODate(schedule.createdAt) : '';
  const start = new Date(`${created > startDate ? created : startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const weekday = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].indexOf(schedule.hari);
  if (weekday < 0 || !Number.isFinite(+start) || !Number.isFinite(+end)) return 0;
  const days = Math.floor((+end - +start) / 86400000);
  const offset = (weekday - start.getUTCDay() + 7) % 7;
  return days < offset ? 0 : Math.floor((days - offset) / 7) + 1;
}

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
