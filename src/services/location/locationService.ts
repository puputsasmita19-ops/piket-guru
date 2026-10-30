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
  forceFresh?: boolean;
}


/** One browser GPS watcher can serve multiple callers, each with its own deadline. */
interface PositionSubscriber {
  resolve: (position: LocationCoordinates) => void;
  reject: (reason: Error) => void;
  onProgress?: WatchPositionOptions['onProgress'];
  maxStaleAgeMs: number;
  forceFresh: boolean;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
}

interface ActivePositionSearch {
  watchId: number | null;
  stopped: boolean;
  subscribers: Set<PositionSubscriber>;
  bestReading: LocationCoordinates | null;
}

export class LocationService {
  /** Strictly enforced maximum attendance accuracy limit (50 meters) */
  public static readonly MAX_ATTENDANCE_ACCURACY_METERS = 50;
  private static readonly CACHE_KEY = 'piket-guru:last-valid-position';
  private static activeSearch: ActivePositionSearch | null = null;
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
    const posTime = Number.isFinite(position.timestamp) && position.timestamp > 0
      ? position.timestamp : NaN;
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
    // Reject malformed, infinite, out-of-range or undated coordinates, including
    // entries restored from older sessionStorage keys. A missing timestamp must
    // never be silently converted to "now" for an attendance decision.
    if (!Number.isFinite(position.latitude) || Math.abs(position.latitude) > 90) return false;
    if (!Number.isFinite(position.longitude) || Math.abs(position.longitude) > 180) return false;
    if (!Number.isFinite(position.accuracy) || position.accuracy <= 0) return false;
    if (!Number.isFinite(position.timestamp) || position.timestamp <= 0) return false;
    if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) return false;
    const now = Date.now();
    const posTime = position.timestamp;
    // Future device timestamps are not reliable attendance evidence.
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
    // Renew must use the SAME freshness policy as the caller. Callers of
    // getCurrentPosition should pass forceFresh:true/maxStaleAgeMs accordingly.
    const fresh = await renew();
    if (!this.isFreshPosition(fresh, maxAgeMs)) {
      throw new Error('GPS yang diterima masih berasal dari cache lama. Aktifkan lokasi akurat, lalu coba kembali.');
    }
    if (fresh.accuracy > this.MAX_ATTENDANCE_ACCURACY_METERS) {
      throw new Error(`Akurasi GPS ±${Math.round(fresh.accuracy)}m belum memenuhi batas presensi (maksimal 50m).`);
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
    // A malformed school coordinate, radius or GPS accuracy must fail closed,
    // rather than being mislabelled as a valid position near the school.
    if (![userLat, userLng, accuracy, schoolLat, schoolLng, allowedRadiusMeters].every(Number.isFinite) ||
        Math.abs(userLat) > 90 || Math.abs(schoolLat) > 90 ||
        Math.abs(userLng) > 180 || Math.abs(schoolLng) > 180 ||
        accuracy <= 0 || allowedRadiusMeters <= 0) {
      return {
        distanceMeters: Infinity,
        isWithinRadius: false,
        accuracyQuality: 'RENDAH',
        status: 'GPS_ERROR',
      };
    }
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
   * Stop a shared GPS search and settle every waiting caller. Explicit cancellation
   * is reserved for page teardown, not for starting another GPS request.
   */
  public static clearCurrentWatcher(_rejectPending = true): void {
    const search = this.activeSearch;
    if (!search) return;
    const abort = new Error('Pencarian GPS dibatalkan.');
    abort.name = 'AbortError';
    this.rejectSearch(search, abort);
  }

  public static cancelCurrentSearch(): void {
    this.clearCurrentWatcher(true);
  }

  private static stopSearch(search: ActivePositionSearch): void {
    if (search.stopped) return;
    search.stopped = true;
    if (this.activeSearch === search) this.activeSearch = null;
    if (search.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(search.watchId); } catch { /* browser disposed */ }
      search.watchId = null;
    }
  }

  private static finishSubscriber(
    search: ActivePositionSearch,
    subscriber: PositionSubscriber,
    position?: LocationCoordinates,
    error?: Error
  ): void {
    if (subscriber.settled) return;
    subscriber.settled = true;
    if (subscriber.timer !== null) clearTimeout(subscriber.timer);
    subscriber.timer = null;
    search.subscribers.delete(subscriber);
    if (position) subscriber.resolve(position);
    else subscriber.reject(error ?? new Error('Pembacaan GPS tidak tersedia.'));
    if (search.subscribers.size === 0) this.stopSearch(search);
  }

  private static rejectSearch(search: ActivePositionSearch, reason: Error): void {
    for (const subscriber of [...search.subscribers]) {
      this.finishSubscriber(search, subscriber, undefined, reason);
    }
    this.stopSearch(search);
  }

  private static isEligibleForSubscriber(
    reading: LocationCoordinates,
    subscriber: PositionSubscriber
  ): boolean {
    // `forceFresh` must not be satisfied by a previous caller's cached fix.
    // Allow a small provider timestamp delay while disallowing older fixes.
    return this.isFreshPosition(reading, subscriber.maxStaleAgeMs) &&
      (!subscriber.forceFresh || reading.timestamp >= subscriber.startedAt - 5000);
  }

  private static consumeReading(search: ActivePositionSearch, position: GeolocationPosition): void {
    if (search.stopped || this.activeSearch !== search) return;
    const reading = this.normalizePosition(position);
    // Reject malformed, future, or stale readings before updating ANY UI.
    if (!this.isFreshPosition(reading, 30_000)) return;
    if (!search.bestReading || reading.accuracy < search.bestReading.accuracy ||
        !this.isFreshPosition(search.bestReading, 30_000)) {
      search.bestReading = reading;
    }

    for (const subscriber of [...search.subscribers]) {
      if (!this.isEligibleForSubscriber(reading, subscriber)) continue;
      const validAccuracy = reading.accuracy <= this.MAX_ATTENDANCE_ACCURACY_METERS;
      try {
        // `isProvisional` follows the attendance threshold (50m), NOT the
        // aspirational 20m hardware target. 25m is already ready for attendance.
        subscriber.onProgress?.(reading, !validAccuracy);
      } catch { /* UI callback cannot break GPS for other subscribers */ }
      if (validAccuracy) {
        this.persistLastValidPosition(reading);
        this.finishSubscriber(search, subscriber, reading);
      }
    }
  }

  private static startHardwareSearch(
    search: ActivePositionSearch,
    timeoutMs: number,
    maxStaleAgeMs: number,
    forceFresh: boolean
  ): void {
    // Low-power network-assisted reading and precise watcher race each other.
    // Only the first acceptable result is needed; do not wait for 20m accuracy.
    const receive = (position: GeolocationPosition) => this.consumeReading(search, position);
    const permissionFailure = (error: GeolocationPositionError) => {
      if (search.stopped) return;
      if (error.code === 1) {
        this.rejectSearch(search, new Error(
          'Izin lokasi GPS ditolak. Aktifkan izin lokasi untuk aplikasi di pengaturan browser.'
        ));
      }
      // Transient timeouts/position-unavailable are handled by each caller's
      // deadline; the high-accuracy watcher is allowed to improve the fix.
    };
    try {
      navigator.geolocation.getCurrentPosition(receive, permissionFailure, {
        enableHighAccuracy: false,
        maximumAge: forceFresh ? 0 : maxStaleAgeMs,
        timeout: Math.min(timeoutMs, 1200),
      });
      // A synchronous quick callback may already have satisfied every caller.
      if (search.stopped) return;
      const watchId = navigator.geolocation.watchPosition(receive, permissionFailure, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: Math.max(timeoutMs, 15000),
      });
      // Browser adapters can invoke the first watch callback synchronously.
      if (search.stopped) {
        try { navigator.geolocation.clearWatch(watchId); } catch { /* ignore */ }
      } else {
        search.watchId = watchId;
      }
    } catch (error: any) {
      this.rejectSearch(search, new Error(error?.message || 'Gagal memulai pencarian GPS.'));
    }
  }

  /**
   * Share one active hardware lookup across concurrent clients, with separate
   * deadlines, callbacks and freshness requirements. A valid ≤50m reading
   * resolves immediately and clears the watcher when the last caller finishes.
   */
  public static getCurrentPosition(
    options: WatchPositionOptions | boolean = {}
  ): Promise<LocationCoordinates> {
    const opts: WatchPositionOptions = typeof options === 'boolean' ? {} : options;
    const {
      timeoutMs = 8500,
      maxStaleAgeMs = 30000,
      forceFresh = false,
      onProgress,
    } = opts;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.reject(new Error('Perangkat atau peramban Anda tidak mendukung Geolocation GPS.'));
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return Promise.reject(new Error('GPS memerlukan sambungan HTTPS yang aman.'));
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
        !Number.isFinite(maxStaleAgeMs) || maxStaleAgeMs < 0) {
      return Promise.reject(new Error('Pengaturan waktu pencarian GPS tidak valid.'));
    }

    const restored = forceFresh ? null : this.restoreCachedPosition(maxStaleAgeMs);
    if (restored) {
      try { onProgress?.(restored, false); } catch { /* non-critical */ }
      return Promise.resolve(restored);
    }

    return new Promise<LocationCoordinates>((resolve, reject) => {
      let search = this.activeSearch;
      const isNewSearch = !search || search.stopped;
      if (!search || search.stopped) {
        search = { watchId: null, stopped: false, subscribers: new Set(), bestReading: null };
        this.activeSearch = search;
      }
      const subscriber: PositionSubscriber = {
        resolve, reject, onProgress, maxStaleAgeMs, forceFresh,
        startedAt: Date.now(), timer: null, settled: false,
      };
      search.subscribers.add(subscriber);
      subscriber.timer = setTimeout(() => {
        if (subscriber.settled) return;
        const reading = search!.bestReading;
        const reason = reading && this.isFreshPosition(reading, 30_000)
          ? `Akurasi GPS terakhir ±${Math.round(reading.accuracy)}m, belum memenuhi syarat 50m. Pindah ke area terbuka lalu coba lagi.`
          : 'Lokasi belum terbaca. Aktifkan GPS, coba area terbuka, lalu pilih Perbarui GPS.';
        this.finishSubscriber(search!, subscriber, undefined, new Error(reason));
      }, timeoutMs);

      // A new caller can join an existing search without canceling that search.
      // Do not replay an old candidate to `forceFresh` callers: wait for an
      // actual browser callback after subscription.
      if (isNewSearch) this.startHardwareSearch(search, timeoutMs, maxStaleAgeMs, forceFresh);
    });
  }
}
