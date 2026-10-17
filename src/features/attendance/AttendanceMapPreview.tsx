import React, { useEffect, useState } from 'react';
import type { LocationCoordinates } from '../../services/location/locationService';

export interface AttendanceMapProps {
  schoolLat: number;
  schoolLng: number;
  radiusMeters: number;
  schoolName: string;
  coords: LocationCoordinates | null;
  provisional: boolean;
}

/** Map failure is isolated from GPS, camera, and attendance submission. */
export default function AttendanceMapPreview(props: AttendanceMapProps) {
  const [Component, setComponent] = useState<React.ComponentType<AttendanceMapProps> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    import('./AttendanceLocationMap').then(module => {
      if (active) setComponent(() => module.default);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (Component) return <Component {...props} />;
  return <div className="gps-map-placeholder">
    <p>{error ? 'Peta belum dapat dimuat. GPS dan presensi tetap dapat digunakan.' : 'Menyiapkan peta lokasi…'}</p>
    {error && <button type="button" className="gps-map-text-button" onClick={() => setAttempt(n => n + 1)}>Coba muat peta</button>}
  </div>;
}
