/** R55: index once per realtime snapshot instead of scanning attendance for every scheduled teacher. */
export interface MonitorScheduleRef {
  petugasId: string;
  petugasName: string;
  ruangName: string;
}
export interface MonitorAttendanceRef {
  id: string;
  userId: string;
  userName: string;
}
export type MonitorDailyRow<T extends MonitorAttendanceRef> = {
  id: string;
  name: string;
  assignment: string;
  attendance?: T;
};

const normalizeName = (name: string): string => name.trim().toLocaleLowerCase('id-ID');

/**
 * Preserves R54 selection semantics: an exact userId wins over a name match;
 * first matching attendance remains authoritative if duplicate records exist.
 * A teacher assigned multiple shifts appears only once.
 */
export function buildAdminMonitorRows<T extends MonitorAttendanceRef, S extends MonitorScheduleRef>(
  schedules: readonly S[],
  attendance: readonly T[],
  isActiveSchedule: (schedule: S) => boolean,
): MonitorDailyRow<T>[] {
  const attendanceById = new Map<string, T>();
  const attendanceByName = new Map<string, T>();
  for (const record of attendance) {
    if (!attendanceById.has(record.userId)) attendanceById.set(record.userId, record);
    const name = normalizeName(record.userName);
    if (!attendanceByName.has(name)) attendanceByName.set(name, record);
  }

  const rows = new Map<string, MonitorDailyRow<T>>();
  const assignedAttendanceIds = new Set<string>();
  for (const schedule of schedules) {
    if (!isActiveSchedule(schedule)) continue;
    const key = schedule.petugasId || `name:${schedule.petugasName}`;
    const matching = attendanceById.get(schedule.petugasId) || attendanceByName.get(normalizeName(schedule.petugasName));
    const previous = rows.get(key);
    if (previous) {
      previous.assignment += ` · ${schedule.ruangName}`;
    } else {
      rows.set(key, {
        id: key,
        name: schedule.petugasName,
        assignment: schedule.ruangName || 'Piket',
        attendance: matching,
      });
      if (matching) assignedAttendanceIds.add(matching.id);
    }
  }
  for (const record of attendance) {
    if (!assignedAttendanceIds.has(record.id)) {
      rows.set(`extra:${record.id}`, {
        id: `extra:${record.id}`,
        name: record.userName,
        assignment: 'Presensi tambahan / tanpa jadwal',
        attendance: record,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
}
