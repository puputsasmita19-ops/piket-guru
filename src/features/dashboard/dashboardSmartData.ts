import type { TeacherRecord, StaffRecord } from '../../types/master.types';

/** R113-B: full teacher/staff directories are session-local and only live while
 * a roster modal is open. Avoid applying a delayed callback from an old account. */
export interface RosterMasterState {
  key: string;
  teachers: TeacherRecord[];
  staff: StaffRecord[];
  teachersReady: boolean;
  staffReady: boolean;
}

export function createRosterMasterState(key: string): RosterMasterState {
  return { key, teachers: [], staff: [], teachersReady: false, staffReady: false };
}

export function updateRosterMasterState(
  state: RosterMasterState | null,
  accountKey: string,
  source: 'teachers' | 'staff',
  records: TeacherRecord[] | StaffRecord[],
): RosterMasterState | null {
  if (!state || !accountKey || state.key !== accountKey) return state;
  if (source === 'teachers') return {
    ...state, teachers: records as TeacherRecord[], teachersReady: true,
  };
  return { ...state, staff: records as StaffRecord[], staffReady: true };
}

export function areRosterMastersReady(state: RosterMasterState | null, accountKey: string, modalOpen: boolean): boolean {
  return Boolean(modalOpen && accountKey && state?.key === accountKey && state.teachersReady && state.staffReady);
}
