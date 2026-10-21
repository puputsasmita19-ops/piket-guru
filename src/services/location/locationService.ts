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
  /** Strictly enforced maximum attendance accuracy limit (50 meters) */
  public static readonly MAX_ATTENDANCE_ACCURACY_METERS = 50;
  private static readonly CACHE_KEY = 'piket-guru:last-valid-position';
  private static activeWatchId: number | null = null;
  private static activeTimeoutId: any = null;
  private static activeRefineTimeoutId: any = null;
  private static currentRequestId = 0;
  private static activeRejector: ((reason?: any) => void) | null = null;
  public static lastValidPosition: LocationCoordinates | null = null;

  private static persistLastValidPosition(position: LocationCoordinates | null): void {
    this.lastValidPosition = position;
    if (typeof window === 'undefined') return;
    try {
      if (!position) {
        window.sessionStorage.removeItem(this.CACHE_KEY);
        return;
      }
      window.sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(position));
    } catch {}
  }

  private static restoreCachedPosition(maxAgeMs: number): LocationCoordinates | null {
    if (this.isFreshPosition(this.lastValidPosition, maxAgeMs) && this.lastValidPosition!.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
      return this.lastValidPosition;
    }
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocationCoordinates;
      if (!this.isFreshPosition(parsed, maxAgeMs) || parsed.accuracy > this.MAX_ATTENDANCE_ACCURACY_METERS) {
        window.sessionStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      this.lastValidPosition = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  private static normalizePosition(position: GeolocationPosition): LocationCoordinates {
    const now = Date.now();
    const posTime = position.timestamp || now;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      timestamp: posTime,
    };
  }

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
   */
  public static async ensureFreshPosition(
    previous: LocationCoordinates | null | undefined,
    renew: () => Promise<LocationCoordinates>,
    maxAgeMs = 30000
  ): Promise<LocationCoordinates> {
    if (this.isFreshPosition(previous, maxAgeMs) && previous!.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
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
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
      return Infinity;
    }
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
   * Strictly evaluates user's real coordinates against official school coordinates and tolerance radius.
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
        const abortErr = new Error('Pencarian GPS dibatalkan.');
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
   * Retrieves current position using geolocation with strict wait time (2.5 seconds max UI wait).
   * Displays real-time onProgress updates, stops loading spinner instantly on timeout or resolution.
   */
  public static getCurrentPosition(
    options: WatchPositionOptions | boolean = {}
  ): Promise<LocationCoordinates> {
    const opts: WatchPositionOptions = typeof options === 'boolean' ? {} : options;

    const {
      timeoutMs = 2500, // Capped strictly at 2.5 seconds (2,500 ms)
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
            'Koneksi browser tidak aman (HTTPS diperlukan untuk izin lokasi GPS). Silakan buka aplikasi melalui protokol HTTPS.'
          )
        );
        return;
      }

      // Fast Path: If recent valid reading exists (<=30s) and meets accuracy (<=50m), return immediately
      const restored = this.restoreCachedPosition(maxStaleAgeMs);
      if (restored) {
        if (onProgress) onProgress(restored, false);
        resolve(restored);
        return;
      }

      // Cancel any previous concurrent search immediately
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
        this.persistLastValidPosition(coords);
        resolve(coords);
      };

      const finishError = (err: Error) => {
        if (hasCompleted || requestId !== this.currentRequestId) return;
        hasCompleted = true;
        cleanup();
        reject(err);
      };

      // Strict 2,500ms timeout handler
      this.activeTimeoutId = setTimeout(() => {
        if (hasCompleted || requestId !== this.currentRequestId) return;

        if (bestReading && bestReading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
          finishSuccess(bestReading);
        } else if (bestReading && bestReading.accuracy > this.MAX_ATTENDANCE_ACCURACY_METERS) {
          finishError(
            new Error(
              `Akurasi sinyal GPS terdeteksi ±${Math.round(
                bestReading.accuracy
              )}m, belum memenuhi batas presensi (≤50m). Silakan pindah ke area terbuka lalu klik Coba Lagi.`
            )
          );
        } else {
          finishError(
            new Error(
              'Pencarian GPS mencapai batas waktu tunggu (2,5 detik). Pastikan GPS HP aktif di area terbuka lalu klik Coba Lagi.'
            )
          );
        }
      }, timeoutMs);

      const quickTimeout = Math.min(timeoutMs, 1200);
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (hasCompleted || requestId !== this.currentRequestId) return;
            const reading = this.normalizePosition(pos);
            if (!this.isFreshPosition(reading, maxStaleAgeMs)) return;

            bestReading = !bestReading || reading.accuracy < bestReading.accuracy ? reading : bestReading;
            onProgress?.(reading, reading.accuracy > desiredAccuracyMeters);

            if (reading.accuracy <= desiredAccuracyMeters) {
              finishSuccess(reading);
            }
          },
          () => {
            // Ignore quick-path failures and continue with watchPosition.
          },
          {
            enableHighAccuracy: false,
            maximumAge: maxStaleAgeMs,
            timeout: quickTimeout,
          }
        );

        this.activeWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (hasCompleted || requestId !== this.currentRequestId) return;

            const now = Date.now();
            const posTime = pos.timestamp || now;
            // Reject stale readings > 30s or future timestamps
            if (now - posTime > maxStaleAgeMs || posTime > now + 5000) {
              return;
            }

            const reading = this.normalizePosition(pos);

            if (!bestReading || reading.accuracy < bestReading.accuracy) {
              bestReading = reading;
            }

            if (onProgress) {
              onProgress(reading, reading.accuracy > desiredAccuracyMeters);
            }

            // High accuracy (<=20m) -> resolve immediately
            if (reading.accuracy <= desiredAccuracyMeters) {
              finishSuccess(reading);
              return;
            }

            // Valid accuracy (<=50m) -> set 1s refine timer or finish
            if (reading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS && !this.activeRefineTimeoutId) {
              this.activeRefineTimeoutId = setTimeout(() => {
                if (hasCompleted || requestId !== this.currentRequestId) return;
                if (bestReading && bestReading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS) {
                  finishSuccess(bestReading);
                }
              }, 1000);
            }
          },
          (err) => {
            if (hasCompleted || requestId !== this.currentRequestId) return;

            let msg = 'Sinyal GPS tidak tersedia.';
            switch (err.code) {
              case err.PERMISSION_DENIED:
                msg =
                  'Izin lokasi GPS ditolak oleh browser/perangkat. Aktifkan izin lokasi di pengaturan browser Anda.';
                break;
              case err.POSITION_UNAVAILABLE:
                msg =
                  'Sinyal lokasi GPS tidak tersedia. Pastikan GPS/Location HP aktif dan berada di area terbuka.';
                break;
              case err.TIMEOUT:
                msg =
                  'Waktu permintaan lokasi GPS habis (2,5 detik). Pastikan sinyal GPS aktif lalu klik Coba Lagi.';
                break;
            }

            if (!bestReading) {
              finishError(new Error(msg));
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: timeoutMs,
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
