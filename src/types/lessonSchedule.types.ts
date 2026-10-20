import type { DayOfWeek } from './index';
import type { LessonPeriodConfig } from './period.types';
import { ALL_DAYS_OF_WEEK, getDayOfWeekFromDate, getPeriodsForDay } from './period.types';

export interface LessonScheduleEntry {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  className: string;
  periodNumbers: number[];
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

/** Seven bounded weekly documents; changing one day never scans historical transactions. */
export interface LessonScheduleDay {
  id: DayOfWeek;
  entries: LessonScheduleEntry[];
  updatedAt: string;
  updatedBy: string;
}

export const MAX_LESSONS_PER_DAY = 500;
export function isLessonScheduleDay(value: unknown): value is LessonScheduleDay {
  if (!value || typeof value !== 'object') return false;
  const day = value as LessonScheduleDay;
  if (!ALL_DAYS_OF_WEEK.some(d => d.code === day.id) || !Array.isArray(day.entries) || day.entries.length > MAX_LESSONS_PER_DAY) return false;
  const ids = new Set<string>();
  return day.entries.every(row => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) return false;
    ids.add(row.id);
    return ['teacherId', 'teacherName', 'subject', 'className', 'updatedAt', 'updatedBy'].every(key => typeof (row as any)[key] === 'string' && !!(row as any)[key].trim()) &&
      typeof row.notes === 'string' && typeof row.validFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.validFrom) &&
      typeof row.validUntil === 'string' && (!row.validUntil || (/^\d{4}-\d{2}-\d{2}$/.test(row.validUntil) && row.validUntil >= row.validFrom)) &&
      typeof row.isActive === 'boolean' && Array.isArray(row.periodNumbers) && row.periodNumbers.length > 0 && row.periodNumbers.every(n => Number.isInteger(n) && n > 0);
  });
}
export function lessonAppliesOn(entry: LessonScheduleEntry, date: string): boolean {
  return entry.isActive && !!date && entry.validFrom <= date && (!entry.validUntil || date <= entry.validUntil);
}

export function getTeachingPeriods(config: LessonPeriodConfig | undefined, day: DayOfWeek, date: string) {
  if (config?.effectiveDate && config.effectiveDate > date) return [];
  return getPeriodsForDay(config, day).filter(p => !p.effectiveStartDate || p.effectiveStartDate <= date);
}

export function teacherLessonsForDate(day: LessonScheduleDay | null, teacherId: string, date: string, config?: LessonPeriodConfig): LessonScheduleEntry[] {
  if (!day || day.id !== getDayOfWeekFromDate(date)) return [];
  const periods = new Set(getTeachingPeriods(config, day.id, date).map(p => p.periodNumber));
  return day.entries.filter(e => e.teacherId === teacherId && lessonAppliesOn(e, date) && e.periodNumbers.length > 0 && e.periodNumbers.every(p => periods.has(p)))
    .sort((a, b) => Math.min(...a.periodNumbers) - Math.min(...b.periodNumbers) || a.className.localeCompare(b.className));
}

export function lessonConflict(entry: LessonScheduleEntry, existing: LessonScheduleEntry[]): string | null {
  if (!entry.isActive) return null;
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  for (const other of existing) {
    if (other.id === entry.id || !other.isActive) continue;
    if ((entry.validUntil && other.validFrom > entry.validUntil) || (other.validUntil && entry.validFrom > other.validUntil)) continue;
    if (!other.periodNumbers.some(p => entry.periodNumbers.includes(p))) continue;
    if (other.teacherId === entry.teacherId) return `Guru sudah mengajar ${other.subject} di kelas ${other.className} pada JP yang sama.`;
    if (normalized(other.className) === normalized(entry.className)) return `Kelas ${other.className} sudah dijadwalkan bersama ${other.teacherName} pada JP yang sama.`;
  }
  return null;
}
