// Compatibility shim for older imports. This app now uses only the free map.
import React from 'react';
import AttendanceOpenStreetMap from './AttendanceOpenStreetMap';
import type { AttendanceMapProps } from './AttendanceMapPreview';
export default function AttendanceGoogleMap(props: AttendanceMapProps & { apiKey?: string; onUnavailable?: () => void }) {
  return <AttendanceOpenStreetMap {...props} />;
}
