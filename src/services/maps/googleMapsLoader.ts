// Retired compatibility API: never inserts a remote script or uses a key.
export function onGoogleMapsFailure(_callback: () => void) { return () => {}; }
export function loadGoogleMaps(_key: string): Promise<never> {
  return Promise.reject(new Error('GOOGLE_MAPS_DISABLED_USE_OPENSTREETMAP'));
}
