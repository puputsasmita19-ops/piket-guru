import type { ScheduleItem, UserProfile } from '../../types';
import type { StaffRecord, TeacherRecord } from '../../types/master.types';

/** Keep photo reads tied to only the teachers in the visible roster. */
export const ROSTER_PHOTO_QUERY_BATCH = 10;
export const ROSTER_PHOTO_MAX_RECORDS = 60;

const normalizedName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');

function relatedUserIds(item: ScheduleItem, teachers: TeacherRecord[], staff: StaffRecord[]): string[] {
  const masters = [...teachers, ...staff];
  const directMaster = masters.find(person =>
    person.id === item.petugasId || (Boolean(person.userId) && person.userId === item.petugasId)
  );
  const nameMatches = directMaster ? [] : masters.filter(person =>
    normalizedName(person.fullName) === normalizedName(item.petugasName)
  );
  // A shared name is not reliable evidence that two records are the same person.
  const master = directMaster || (nameMatches.length === 1 ? nameMatches[0] : undefined);
  return [...new Set([item.petugasId, master?.userId].filter((v): v is string => Boolean(v && !v.includes('/'))))];
}

export function rosterCandidateIds(roster: ScheduleItem[], teachers: TeacherRecord[], staff: StaffRecord[]): string[] {
  return [...new Set(roster.flatMap(item => relatedUserIds(item, teachers, staff)))].slice(0, ROSTER_PHOTO_MAX_RECORDS);
}

export function rosterUnresolvedNames(roster: ScheduleItem[], users: UserProfile[], teachers: TeacherRecord[], staff: StaffRecord[]): string[] {
  const knownIds = new Set(users.map(u => u.id));
  const knownNames = new Set(users.map(u => normalizedName(u.fullName || '')));
  return [...new Set(roster.filter(item =>
    !relatedUserIds(item, teachers, staff).some(id => knownIds.has(id)) && !knownNames.has(normalizedName(item.petugasName))
  ).map(item => item.petugasName.trim()).filter(Boolean))].slice(0, ROSTER_PHOTO_MAX_RECORDS);
}

export function resolveRosterPhoto(item: ScheduleItem, users: UserProfile[], teachers: TeacherRecord[], staff: StaffRecord[]): string | null {
  const ids = new Set(relatedUserIds(item, teachers, staff));
  const byId = users.find(person => person.isActive !== false && ids.has(person.id));
  if (byId) return byId.avatarUrl || null;
  const byName = users.filter(person => person.isActive !== false && normalizedName(person.fullName || '') === normalizedName(item.petugasName));
  return byName.length === 1 ? byName[0].avatarUrl || null : null;
}
