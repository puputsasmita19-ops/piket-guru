import type { GeofenceResult, LocationCoordinates } from '../../services/location/locationService';

/** UI navigation only. Capture and submission retain their own strict GPS validation. */
export function shouldGuideToSelfie(input: {
  activeTab: 'presensi' | 'riwayat';
  settingsReady: boolean;
  validSchoolLocation: boolean;
  userId?: string | null;
  hasCheckIn: boolean;
  hasSelfie: boolean;
  isCameraOpen: boolean;
  isSubmitting: boolean;
  canCheckIn: boolean;
  gpsError?: string | null;
  position: LocationCoordinates | null;
  geofence: GeofenceResult | null;
  isGpsFresh: boolean;
}): boolean {
  return input.activeTab === 'presensi' &&
    input.settingsReady && input.validSchoolLocation && !!input.userId &&
    !input.hasCheckIn && !input.hasSelfie && !input.isCameraOpen &&
    !input.isSubmitting && input.canCheckIn && !input.gpsError &&
    input.isGpsFresh && !!input.position && !!input.geofence &&
    input.position.accuracy > 0 && input.position.accuracy <= 50 &&
    input.geofence.status === 'DALAM_LOKASI' && input.geofence.isWithinRadius;
}
