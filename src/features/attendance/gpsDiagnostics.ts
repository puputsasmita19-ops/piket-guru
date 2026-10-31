import type { AttendanceRecord } from '../../types';
import { toEpochMs } from '../../utils/dateUtils';

/** R104-D: view-only interpretation. Never treat diagnostics as proof of trusted GPS. */
export interface GpsDiagnosticSnapshot {
  distance: number | null;
  accuracy: number | null;
  capturedAtMs: number | null;
  validatedAtMs: number | null;
  radiusMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'DALAM_LOKASI' | 'DI_LUAR_LOKASI' | 'AKURASI_RENDAH' | 'GPS_ERROR' | null;
  source: 'record' | 'checkout' | 'unavailable';
}

function meter(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function lat(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90 ? value : null;
}
function lng(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180 ? value : null;
}
function eventTime(value: unknown): number | null {
  if (!value) return null;
  const epoch = toEpochMs(value as AttendanceRecord['jamMasuk']);
  return Number.isFinite(epoch) && epoch > 0 ? epoch : null;
}

export function getGpsDiagnostic(record: AttendanceRecord, phase: 'in' | 'out'): GpsDiagnosticSnapshot {
  if (phase === 'out') {
    const gps = record.checkoutGps;
    if (!gps) return { distance:null, accuracy:null, capturedAtMs:null, validatedAtMs:null,
      radiusMeters:null, latitude:null, longitude:null, status:null, source:'unavailable' };
    return {
      distance:meter(gps.distance), accuracy:meter(gps.accuracy),
      capturedAtMs:eventTime(gps.capturedAt), validatedAtMs:eventTime(gps.validatedAt),
      radiusMeters:meter(gps.radiusMeters), latitude:lat(gps.latitude), longitude:lng(gps.longitude),
      status:gps.status === 'DALAM_LOKASI' ? 'DALAM_LOKASI' : null, source:'checkout',
    };
  }
  return {
    distance:meter(record.distance), accuracy:meter(record.accuracy),
    // R104-D and later store hardware reading timestamp. Older records do not have it;
    // jamMasuk is the time of check-in, NOT a GPS reading timestamp.
    capturedAtMs:eventTime(record.checkInGpsCapturedAt),
    validatedAtMs:eventTime(record.jamMasuk), radiusMeters:meter(record.checkInRadiusMeters),
    latitude:lat(record.latitude), longitude:lng(record.longitude),
    status:record.status ?? null, source:'record',
  };
}

export function getGpsDiagnosticLabel(snapshot: GpsDiagnosticSnapshot): 'Tidak tersedia' | 'Perlu diperiksa' | 'Memenuhi batas' {
  if (snapshot.source === 'unavailable' || snapshot.accuracy === null || snapshot.distance === null) return 'Tidak tersedia';
  if (snapshot.accuracy <= 0 || snapshot.accuracy > 50 ||
      (snapshot.radiusMeters !== null && snapshot.distance > snapshot.radiusMeters) ||
      snapshot.status !== 'DALAM_LOKASI') return 'Perlu diperiksa';
  return 'Memenuhi batas';
}
