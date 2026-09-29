export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface GeofenceResult {
  distanceMeters: number;
  isWithinRadius: boolean;
  accuracyQuality: 'TINGGI' | 'SEDANG' | 'RENDAH';
  status: 'DALAM_LOKASI' | 'DI_LUAR_LOKASI' | 'GPS_ERROR' | 'AKURASI_RENDAH';
}

export class LocationService {
  /**
   * Calculates Haversine great-circle distance between two geographic coordinates in meters.
   */
  public static calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const deltaPhi = (lat2 - lat1) * rad;
    const deltaLambda = (lon2 - lon1) * rad;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // return in integer meters
  }

  /**
   * Evaluates geofence condition based on distance and device accuracy
   */
  public static evaluateGeofence(
    userLat: number,
    userLng: number,
    accuracy: number,
    schoolLat: number,
    schoolLng: number,
    allowedRadiusMeters: number
  ): GeofenceResult {
    const distanceMeters = this.calculateHaversineDistance(userLat, userLng, schoolLat, schoolLng);
    const isWithinRadius = distanceMeters <= allowedRadiusMeters;

    let accuracyQuality: 'TINGGI' | 'SEDANG' | 'RENDAH' = 'TINGGI';
    if (accuracy > 50) {
      accuracyQuality = 'RENDAH';
    } else if (accuracy > 20) {
      accuracyQuality = 'SEDANG';
    }

    let status: 'DALAM_LOKASI' | 'DI_LUAR_LOKASI' | 'GPS_ERROR' | 'AKURASI_RENDAH' = isWithinRadius
      ? 'DALAM_LOKASI'
      : 'DI_LUAR_LOKASI';

    if (accuracyQuality === 'RENDAH') {
      status = 'AKURASI_RENDAH';
    }

    return {
      distanceMeters,
      isWithinRadius,
      accuracyQuality,
      status,
    };
  }

  /**
   * Retrieves current position using browser Geolocation API with high accuracy
   */
  public static getCurrentPosition(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Perangkat atau browser Anda tidak mendukung Geolocation GPS.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          });
        },
        (error) => {
          let msg = 'Gagal mendeteksi lokasi GPS.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = 'Izin lokasi GPS ditolak oleh browser/perangkat. Mohon izinkan akses lokasi.';
              break;
            case error.POSITION_UNAVAILABLE:
              msg = 'Informasi lokasi GPS tidak tersedia pada perangkat Anda saat ini.';
              break;
            case error.TIMEOUT:
              msg = 'Waktu permintaan lokasi GPS habis (Timeout). Pastikan GPS aktif.';
              break;
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }
}
