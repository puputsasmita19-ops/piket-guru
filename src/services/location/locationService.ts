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

export interface WatchPositionOptions {
  timeoutMs?: number;
  desiredAccuracyMeters?: number;
  maxStaleAgeMs?: number;
  onProgress?: (pos: LocationCoordinates, isProvisional: boolean) => void;
}

export class LocationService {
  public static readonly MAX_ATTENDANCE_ACCURACY_METERS = 50;
  private static activeWatchId: number | null = null;
  private static activeTimeoutId: any = null;
  private static activeRefineTimeoutId: any = null;
  private static currentRequestId = 0;
  private static activeRejector: ((reason?: any) => void) | null = null;
  public static lastValidPosition: LocationCoordinates | null = null;

  /**
   * Checks whether a given position reading is fresh and mathematically valid.
   * Strictly verifies timestamp is not from the future and within maxAgeMs (default 30s).
   */
  public static isFreshPosition(
    position?: LocationCoordinates | null,
    maxAgeMs = 30000
  ): boolean {
    if (!position) return false;
    if (typeof position.latitude !== 'number' || isNaN(position.latitude)) return false;
    if (typeof position.longitude !== 'number' || isNaN(position.longitude)) return false;
    if (typeof position.accuracy !== 'number' || isNaN(position.accuracy) || position.accuracy <= 0) return false;
    const now = Date.now();
    const posTime = position.timestamp || now;
    // Disallow future timestamps (tolerance 5s for slight clock skew)
    if (posTime > now + 5000) return false;
    if (now - posTime > maxAgeMs) return false;
    return true;
  }

  /**
   * Helper that ensures the caller has a fresh, valid GPS position before submitting.
   * If previous is still fresh and valid, returns it immediately.
   * If previous is stale (>30s) or missing, executes renew() to fetch a fresh reading.
   * Never mutates or fakes the timestamp of an expired position.
   */
  public static async ensureFreshPosition(
    previous: LocationCoordinates | null | undefined,
    renew: () => Promise<LocationCoordinates>,
    maxAgeMs = 30000
  ): Promise<LocationCoordinates> {
    if (this.isFreshPosition(previous, maxAgeMs)) {
      return previous!;
    }
    const fresh = await renew();
    if (!this.isFreshPosition(fresh, maxAgeMs)) {
      throw new Error(
        'Hasil pembacaan GPS baru tidak memenuhi batas kesegaran waktu (maksimal 30 detik). Silakan coba kembali.'
      );
    }
    return fresh;
  }

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
   * Evaluates geofence condition based on distance and device accuracy.
   * Strictly evaluates the user's real coordinates against school coordinates and tolerance radius.
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
   * Cleans up any running geolocation watcher and timeout timers immediately.
   * Cancels in-flight requests and protects against stale callbacks.
   */
  public static clearCurrentWatcher(rejectPending = false): void {
    this.currentRequestId++;
    if (this.activeWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(this.activeWatchId);
      } catch {}
      this.activeWatchId = null;
    }
    if (this.activeTimeoutId !== null) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }
    if (this.activeRefineTimeoutId !== null) {
      clearTimeout(this.activeRefineTimeoutId);
      this.activeRefineTimeoutId = null;
    }
    if (rejectPending && this.activeRejector) {
      const reject = this.activeRejector;
      this.activeRejector = null;
      try {
        const abortErr = new Error('Pencarian GPS dibatalkan oleh pengguna.');
        abortErr.name = 'AbortError';
        reject(abortErr);
      } catch {}
    } else {
      this.activeRejector = null;
    }
  }

  /**
   * Explicit action to cancel an ongoing GPS search.
   */
  public static cancelCurrentSearch(): void {
    this.clearCurrentWatcher(true);
  }

  /**
   * Retrieves current position using progressive watchPosition with high accuracy.
   * Capped at maximum 10 seconds refinement window.
   * Displays real-time onProgress updates, finishes immediately on <=20m,
   * or after brief refinement on <=50m.
   */
  public static getCurrentPosition(
    options: WatchPositionOptions | boolean = {}
  ): Promise<LocationCoordinates> {
    const opts: WatchPositionOptions =
      typeof options === 'boolean' ? {} : options;

    const {
      timeoutMs = 10000, // Strictly capped at max 10 seconds
      desiredAccuracyMeters = 20,
      maxStaleAgeMs = 30000,
      onProgress,
    } = opts;

    return new Promise((resolve, reject) => {
      // 1. Browser capability check
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Perangkat atau peramban Anda tidak mendukung Geolocation GPS.'));
        return;
      }

      // 2. Insecure context check (Geolocation requires HTTPS)
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        reject(
          new Error(
            'Koneksi browser tidak aman (HTTPS diperlukan untuk izin GPS Geolocation). Silakan buka aplikasi melalui protokol HTTPS.'
          )
        );
        return;
      }

      // 3. Permissions-Policy introspection check (if available in modern browser/iframe)
      if (typeof document !== 'undefined') {
        const policy = (document as any).featurePolicy || (document as any).permissionsPolicy;
        if (policy && typeof policy.allowsFeature === 'function') {
          try {
            if (!policy.allowsFeature('geolocation')) {
              reject(
                new Error(
                  'Akses GPS dibatasi oleh Permissions-Policy panel/iframe. Silakan buka tautan aplikasi langsung di tab baru browser ponsel Anda.'
                )
              );
              return;
            }
          } catch {
            // If policy introspection throws or is not implemented, do not reject; let browser callback decide.
          }
        }
      }

      this.clearCurrentWatcher(false);
      const requestId = ++this.currentRequestId;
      this.activeRejector = reject;

      let bestReading: LocationCoordinates | null = null;
      let hasCompleted = false;

      const cleanup = () => {
        if (this.activeWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            navigator.geolocation.clearWatch(this.activeWatchId);
          } catch {}
          this.activeWatchId = null;
        }
        if (this.activeTimeoutId !== null) {
          clearTimeout(this.activeTimeoutId);
          this.activeTimeoutId = null;
        }
        if (this.activeRefineTimeoutId !== null) {
          clearTimeout(this.activeRefineTimeoutId);
          this.activeRefineTimeoutId = null;
        }
        this.activeRejector = null;
      };

      const finishSuccess = (coords: LocationCoordinates) => {
        if (hasCompleted || requestId !== this.currentRequestId) return;
        hasCompleted = true;
        cleanup();
        this.lastValidPosition = coords;
        resolve(coords);
      };

      const finishError = (err: Error) => {
        if (hasCompleted || requestId !== this.currentRequestId) return;
        hasCompleted = true;
        cleanup();
        reject(err);
      };

      // Max 10-second overall timeout handler
      this.activeTimeoutId = setTimeout(() => {
        if (hasCompleted || requestId !== this.currentRequestId) return;
        if (bestReading && bestReading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
          // Finish with best fresh reading obtained within 10s
          finishSuccess(bestReading);
        } else if (bestReading && bestReading.accuracy > this.MAX_ATTENDANCE_ACCURACY_METERS) {
          finishError(
            new Error(
              `Pencarian GPS selesai (10 detik). Akurasi sinyal belum memadai (±${Math.round(
                bestReading.accuracy
              )}m, kebijakan presensi memerlukan akurasi ≤50m). Silakan pindah ke area terbuka dan klik Coba Lagi.`
            )
          );
        } else {
          finishError(
            new Error(
              'Waktu pencarian sinyal GPS habis (10 detik). Pastikan GPS HP aktif dan berada di area terbuka yang tidak terhalang.'
            )
          );
        }
      }, timeoutMs);

      try {
        this.activeWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (hasCompleted || requestId !== this.currentRequestId) return;

            const now = Date.now();
            const posTime = pos.timestamp || now;
            // Reject stale cached readings older than 30s or future timestamps
            if (now - posTime > maxStaleAgeMs || posTime > now + 5000) {
              return;
            }

            const reading: LocationCoordinates = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              speed: pos.coords.speed,
              timestamp: posTime,
            };

            if (!bestReading || reading.accuracy < bestReading.accuracy) {
              bestReading = reading;
            }

            // High accuracy desired (<= 20 meters) -> resolve immediately
            if (reading.accuracy <= desiredAccuracyMeters) {
              if (onProgress) onProgress(reading, false);
              finishSuccess(reading);
              return;
            }

            // If acceptable accuracy (<= 50 meters), give a brief refinement window (1.5s) to get <=20m, otherwise finish
            if (reading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
              if (onProgress) onProgress(reading, true);
              if (!this.activeRefineTimeoutId) {
                this.activeRefineTimeoutId = setTimeout(() => {
                  if (hasCompleted || requestId !== this.currentRequestId) return;
                  if (bestReading && bestReading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
                    finishSuccess(bestReading);
                  }
                }, 1500);
              }
              return;
            }

            // Immediately report valid provisional reading and real-time distance
            if (onProgress) {
              onProgress(reading, true);
            }
          },
          (err) => {
            if (hasCompleted || requestId !== this.currentRequestId) return;

            // If a valid reading was already obtained, don't fail on transient TIMEOUT
            if (bestReading && err.code === err.TIMEOUT) {
              return;
            }

            let msg = 'Gagal mendeteksi lokasi GPS.';
            switch (err.code) {
              case err.PERMISSION_DENIED:
                msg =
                  'Izin lokasi GPS ditolak oleh browser/perangkat. Mohon aktifkan izin lokasi di pengaturan browser Anda (atau buka di tab baru jika di dalam frame preview).';
                break;
              case err.POSITION_UNAVAILABLE:
                msg =
                  'Sinyal lokasi GPS tidak tersedia atau perangkat belum dapat menentukan posisi. Pastikan GPS/Location HP aktif dan coba di area terbuka.';
                break;
              case err.TIMEOUT:
                msg = 'Waktu permintaan lokasi GPS habis (Timeout 10 detik). Pastikan sinyal GPS aktif dan berada di area terbuka.';
                break;
            }

            if (!bestReading) {
              finishError(new Error(msg));
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 8000,
          }
        );
      } catch (err: any) {
        finishError(
          new Error(err?.message || 'Terjadi kesalahan saat memulai penelusuran lokasi GPS.')
        );
      }
    });
  }
}
