import React from 'react';
import { LocationService } from '../../services/location/locationService';
import type { AttendanceMapProps } from './AttendanceMapPreview';

export const validMapPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
export function getMapPosition(props: AttendanceMapProps) {
  const { coords, schoolLat, schoolLng } = props;
  const user = coords && validMapPoint(coords.latitude, coords.longitude) && Number.isFinite(coords.accuracy) && coords.accuracy > 0 ? coords : null;
  const distance = user ? LocationService.calculateHaversineDistance(user.latitude, user.longitude, schoolLat, schoolLng) : null;
  const params = new URLSearchParams({ api: '1', destination: `${schoolLat},${schoolLng}` });
  if (user) params.set('origin', `${user.latitude},${user.longitude}`);
  return { user, distance, directionsUrl: `https://www.google.com/maps/dir/?${params}` };
}
export function AttendanceMapDetails(props: AttendanceMapProps) {
  const { user, distance, directionsUrl } = getMapPosition(props);
  return <>
    <div className="gps-map-legend"><span><i className="gps-legend-school">S</i> Sekolah</span><span><i className="gps-legend-user">A</i> Anda{props.provisional ? ' (sementara)' : ''}</span><span><i className="gps-legend-radius" /> Batas presensi</span></div>
    {user && <div className="gps-map-connection"><span>Anda → Sekolah <strong>{distance! < 1000 ? `${Math.round(distance!)} m` : `${(distance! / 1000).toFixed(1)} km`}</strong><small>Garis jarak lurus</small></span><a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="gps-map-directions">Petunjuk jalan ↗</a></div>}
    <p className="gps-map-caption">GPS, akurasi, dan radius admin tetap menjadi acuan presensi.</p>
  </>;
}
