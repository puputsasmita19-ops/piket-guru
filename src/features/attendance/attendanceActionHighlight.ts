/** R96: UI guidance only. Backend attendance and GPS validation remain authoritative. */
export interface AttendanceActionGuidanceInput {
  activeTab: 'presensi' | 'riwayat';
  hasUser: boolean;
  online: boolean;
  settingsReady: boolean;
  validSchoolLocation: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  hasPhoto: boolean;
  hasPosition: boolean;
  gpsWithinRadius: boolean;
  gpsAccuracyOk: boolean;
  gpsHasError: boolean;
  hasSchedulePermission: boolean;
  checkOutWindowAllowed: boolean;
  busy: boolean;
  locating: boolean;
  cameraOpen: boolean;
}

export function shouldHighlightCheckIn(input: AttendanceActionGuidanceInput): boolean {
  return input.activeTab === 'presensi' && input.hasUser && input.online &&
    input.settingsReady && input.validSchoolLocation && !input.hasCheckIn &&
    input.hasPhoto && input.hasPosition && input.gpsWithinRadius && input.gpsAccuracyOk &&
    !input.gpsHasError && input.hasSchedulePermission && !input.busy && !input.locating &&
    !input.cameraOpen;
}

/** Check-out gets a prompt when its time window opens. GPS is refreshed on submission. */
export function shouldHighlightCheckOut(input: AttendanceActionGuidanceInput): boolean {
  return input.activeTab === 'presensi' && input.hasUser && input.online &&
    input.settingsReady && input.validSchoolLocation && input.hasCheckIn &&
    !input.hasCheckOut && input.checkOutWindowAllowed && !input.busy &&
    !input.locating && !input.cameraOpen;
}
