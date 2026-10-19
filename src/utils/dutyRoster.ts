import { isOperationalRecord, type ScheduleItem } from '../types';
import { isScheduleOnDate } from './scheduleUtils';

/** Input is already a WIB calendar date; UTC calendar arithmetic avoids host timezone changes. */
export function nextDutyDate(todayISO: string): string {
  const date = new Date(`${todayISO}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayISO) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== todayISO) throw new Error('Tanggal jadwal tidak valid.');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function dutyRosterForDate(schedules: ScheduleItem[], dateISO: string): ScheduleItem[] {
  return schedules.filter(s => isOperationalRecord(s) && isScheduleOnDate(s, dateISO))
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai) || a.petugasName.localeCompare(b.petugasName, 'id-ID') || a.ruangName.localeCompare(b.ruangName, 'id-ID'));
}
