import type { AttendanceRecord } from '../types';

/** R89-C: a read-only, conservative classification of server-verified attendance. */
export type MissingCheckoutRow = { record: AttendanceRecord; duplicateCount: number };
export type CheckoutHistorySummary = {
  missing: MissingCheckoutRow[];
  conflicts: MissingCheckoutRow[];
  completed: number;
  ignored: number;
  boundaryDeferred: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function wibDateDaysBefore(today: string, days: number): string {
  if (!DATE.test(today) || !Number.isInteger(days) || days < 0 || days > 366) {
    throw new Error('Tanggal WIB atau rentang hari tidak valid.');
  }
  const anchor = new Date(`${today}T12:00:00Z`);
  if (!Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== today) {
    throw new Error('Tanggal WIB tidak valid.');
  }
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return anchor.toISOString().slice(0, 10);
}

function validInstant(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return Number.isFinite(Date.parse(value));
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === 'object' && value !== null) {
    const obj = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
    if (typeof obj.toMillis === 'function') return Number.isFinite(obj.toMillis());
    if (typeof obj.toDate === 'function') return Number.isFinite(obj.toDate()?.getTime());
    if (typeof obj.seconds === 'number') return Number.isFinite(obj.seconds);
  }
  return false;
}

/** A missing checkout is not proof the teacher did not attempt an offline checkout. */
export function summarizeCheckoutHistory(records: readonly AttendanceRecord[], today: string, partialBoundaryDate?: string): CheckoutHistorySummary {
  const groups = new Map<string, AttendanceRecord[]>();
  let ignored = 0;
  let boundaryDeferred = 0;
  for (const record of records) {
    if (!record || record.isDemo === true || record.dataSource === 'SEED' ||
        !record.id || !record.userId || !DATE.test(record.tanggal || '') ||
        record.tanggal >= today || !validInstant(record.jamMasuk)) {
      ignored++;
      continue;
    }
    if (partialBoundaryDate && record.tanggal === partialBoundaryDate) {
      boundaryDeferred++;
      continue;
    }
    const key = `${record.tanggal}\u0000${record.userId}`;
    const group = groups.get(key) || [];
    if (!group.some(item => item.id === record.id)) group.push(record);
    groups.set(key, group);
  }

  const missing: MissingCheckoutRow[] = [];
  const conflicts: MissingCheckoutRow[] = [];
  let completed = 0;
  for (const group of groups.values()) {
    // A duplicate or invalid checkout can mask a later sync: require manual review.
    if (group.length > 1 || group.some(item => item.jamPulang !== null && item.jamPulang !== undefined && item.jamPulang !== '' && !validInstant(item.jamPulang))) {
      conflicts.push({ record: group[0], duplicateCount: group.length });
    } else if (validInstant(group[0].jamPulang)) {
      completed++;
    } else {
      missing.push({ record: group[0], duplicateCount: 1 });
    }
  }
  const newestFirst = (a: MissingCheckoutRow, b: MissingCheckoutRow) =>
    b.record.tanggal.localeCompare(a.record.tanggal) || a.record.userName.localeCompare(b.record.userName, 'id-ID');
  return { missing: missing.sort(newestFirst), conflicts: conflicts.sort(newestFirst), completed, ignored, boundaryDeferred };
}
